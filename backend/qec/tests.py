"""Tests for the surface code backend.

There are three kinds of tests, from most to least important:

1. The Python vs TypeScript check: `layout.py` really is the same as
   `layout.ts`. The frontend draws the picture and the backend does the
   physics, so if they differ we get a wrong diagram, not an error.
2. Circuit rules. A wrong CNOT order does not crash. It makes the detectors
   give random results. So we check that a run with no noise fires nothing.
3. Fixed examples: placing a specific error must fire exactly the checks the
   layout says it should, and the distance-3 logical failure must stay hidden.

The tests above mostly check the code against its own design. The last group,
`StimGeneratorCrossCheckTest`, is an outside check: it compares our hand-built
circuit with the surface code circuit that Stim builds by itself.
"""

import re
from pathlib import Path

import stim
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from . import experiment, layout

LAYOUT_TS = (
    Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "qec" / "layout.ts"
)


class LayoutGoldenTest(TestCase):
    """Checks that layout.py matches the TypeScript table it is copied from."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.ts = LAYOUT_TS.read_text(encoding="utf-8")

    def test_typescript_source_is_where_we_think(self):
        self.assertTrue(LAYOUT_TS.exists(), f"missing {LAYOUT_TS}")

    def test_data_qubits_match(self):
        found = re.findall(r"\{\s*id:\s*(\d+),\s*x:\s*(\d+),\s*y:\s*(\d+)\s*\}", self.ts)
        ts = {(int(i), int(x), int(y)) for i, x, y in found}
        py = {(q.id, q.x, q.y) for q in layout.DATA_QUBITS}
        self.assertEqual(ts, py)

    def test_checks_match(self):
        pattern = (
            r"\{\s*id:\s*'(\w+)',\s*type:\s*'([XZ])',\s*x:\s*(\d+),\s*y:\s*(\d+),"
            r"\s*dataQubits:\s*\[([\d,\s]+)\]\s*\}"
        )
        ts = {
            (cid, typ, int(x), int(y), tuple(int(n) for n in dq.split(",")))
            for cid, typ, x, y, dq in re.findall(pattern, self.ts)
        }
        py = {(c.id, c.type, c.x, c.y, c.data_qubits) for c in layout.CHECKS}
        self.assertEqual(ts, py)

    def test_logical_z_matches(self):
        m = re.search(r"logicalZ:\s*\[([\d,\s]+)\]", self.ts)
        self.assertIsNotNone(m)
        ts = tuple(int(n) for n in m.group(1).split(","))
        self.assertEqual(ts, layout.LOGICAL_Z)


class LayoutInvariantTest(TestCase):
    def test_counts(self):
        self.assertEqual(len(layout.DATA_QUBITS), 9)
        self.assertEqual(len(layout.CHECKS), 8)
        self.assertEqual(len(layout.LOGICAL_Z), layout.DISTANCE)

    def test_stabilisers_commute(self):
        # An X check and a Z check commute only if they share an even number
        # of data qubits. This catches a wrongly typed coordinate straight away.
        for x in layout.X_CHECKS:
            for z in layout.Z_CHECKS:
                shared = len(set(x.data_qubits) & set(z.data_qubits))
                self.assertEqual(shared % 2, 0, f"{x.id} and {z.id} share {shared}")

    def test_ancilla_indices_follow_check_order(self):
        self.assertEqual(
            [layout.ANCILLA_INDEX[c.id] for c in layout.CHECKS], list(range(9, 17))
        )

    def test_parity_of_sites(self):
        for q in layout.DATA_QUBITS:
            self.assertEqual((q.x % 2, q.y % 2), (1, 1))
        for c in layout.CHECKS:
            self.assertEqual((c.x % 2, c.y % 2), (0, 0))


class CircuitTest(TestCase):
    def test_qubit_count(self):
        c = experiment.build_circuit(3)
        self.assertEqual(c.num_qubits, 17)

    def test_detector_count_is_eight_per_round(self):
        for rounds in (1, 2, 3, 5):
            self.assertEqual(experiment.build_circuit(rounds).num_detectors, 8 * rounds)

    def test_detector_labels_align_with_stim_coordinates(self):
        # Stim stores (x, y, t) for each detector. If the DETECTOR lines and
        # detector_labels() ever stop matching, every syndrome gets the wrong labels.
        rounds = 3
        circuit = experiment.build_circuit(rounds)
        coords = circuit.get_detector_coordinates()
        labels = experiment.detector_labels(rounds)
        self.assertEqual(len(labels), len(coords))
        for index, (check_id, r) in enumerate(labels):
            check = layout.get_check(check_id)
            self.assertEqual(coords[index], [check.x, check.y, float(r)])

    def test_noiseless_run_fires_nothing(self):
        # The most important test for the CNOT order. A wrong order does not
        # crash. Instead it makes the detectors give random results.
        for rounds in (1, 2, 3, 5):
            circuit = experiment.build_circuit(rounds)
            det, obs = circuit.compile_detector_sampler().sample(
                256, separate_observables=True
            )
            self.assertEqual(det.sum(), 0, f"{rounds} rounds: a detector fired")
            self.assertEqual(obs.sum(), 0, f"{rounds} rounds: observable flipped")


class InjectionAnchorTest(TestCase):
    """Injected errors must fire exactly the checks the layout predicts."""

    def fired(self, rounds, errors):
        circuit = experiment.build_circuit(rounds, errors=errors)
        det, obs = circuit.compile_detector_sampler().sample(1, separate_observables=True)
        labels = experiment.detector_labels(rounds)
        return (
            sorted({labels[i][0] for i, v in enumerate(det[0]) if v}),
            int(obs[0][0]),
        )

    def test_single_qubit_errors_match_layout_prediction(self):
        for qubit, pauli in [(4, "X"), (0, "X"), (8, "X"), (4, "Z"), (4, "Y"), (2, "Z")]:
            with self.subTest(qubit=qubit, pauli=pauli):
                got, _ = self.fired(3, [experiment.InjectedError(qubit, pauli, 1)])
                self.assertEqual(got, sorted(layout.checks_affected_by(qubit, pauli)))

    def test_logical_x_chain_is_undetectable_but_flips_the_observable(self):
        # This is what distance 3 means: three X errors at the same time down
        # one column break the logical qubit, and not a single detector fires.
        chain = [experiment.InjectedError(q, "X", 1) for q in (0, 3, 6)]
        got, flip = self.fired(3, chain)
        self.assertEqual(got, [])
        self.assertEqual(flip, 1)

    def test_z_errors_on_the_logical_operator_do_not_flip_a_z_memory(self):
        chain = [experiment.InjectedError(q, "Z", 1) for q in layout.LOGICAL_Z]
        got, flip = self.fired(3, chain)
        self.assertEqual(got, [])
        self.assertEqual(flip, 0)


class RunTest(TestCase):
    def test_timeline_shape(self):
        result = experiment.run(3, [experiment.InjectedError(4, "X", 1)])
        self.assertEqual(len(result["timeline"]), 2 * 3 + 1)
        self.assertEqual(
            [s["phase"] for s in result["timeline"]],
            ["inject", "measure"] * 3 + ["decode"],
        )

    def test_error_appears_in_truth_only_from_its_own_round(self):
        result = experiment.run(3, [experiment.InjectedError(4, "X", 2)])
        by_step = [len(s["truth"]["injected"]) for s in result["timeline"]]
        self.assertEqual(by_step[0], 0)  # round 0 inject
        self.assertEqual(by_step[-1], 1)

    def test_detection_events_land_in_the_round_they_were_injected(self):
        result = experiment.run(3, [experiment.InjectedError(4, "X", 1)])
        measure_steps = [s for s in result["timeline"] if s["phase"] == "measure"]
        fired = {
            cid
            for cid, v in measure_steps[1]["measured"]["detectionEvents"].items()
            if v
        }
        self.assertEqual(fired, {"Z0", "Z1"})

    def test_decoder_corrects_a_single_error(self):
        result = experiment.run(3, [experiment.InjectedError(4, "X", 1)])
        self.assertTrue(result["inferred"]["logical"]["success"])

    def test_decoder_is_defeated_by_a_logical_chain(self):
        # The decoder cannot see the error, so it predicts no flip, but the
        # observable did flip. The decoder failing here is correct, not a bug.
        chain = [experiment.InjectedError(q, "X", 1) for q in (0, 3, 6)]
        result = experiment.run(3, chain)
        logical = result["inferred"]["logical"]
        self.assertEqual(logical["observedFlip"], 1)
        self.assertEqual(logical["predictedFlip"], 0)
        self.assertFalse(logical["success"])

    def test_layout_is_echoed(self):
        result = experiment.run(1, [])
        self.assertEqual(result["layout"], layout.to_dict())


class ErrorRateTest(TestCase):
    def test_more_noise_means_more_logical_failures(self):
        low = experiment.logical_error_rate(3, 0.001, 4000)
        high = experiment.logical_error_rate(3, 0.02, 4000)
        self.assertLess(low["logicalErrorRate"], high["logicalErrorRate"])


class ApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_layout_endpoint(self):
        response = self.client.get(reverse("qec-layout"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["distance"], 3)

    def test_run_endpoint(self):
        response = self.client.post(
            reverse("qec-run"),
            {"rounds": 3, "errors": [{"qubit": 4, "pauli": "X", "round": 1}]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["timeline"]), 7)

    def test_run_rejects_an_ancilla_qubit(self):
        response = self.client.post(
            reverse("qec-run"),
            {"rounds": 3, "errors": [{"qubit": 12, "pauli": "X", "round": 1}]},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_run_rejects_an_error_after_the_last_round(self):
        response = self.client.post(
            reverse("qec-run"),
            {"rounds": 2, "errors": [{"qubit": 4, "pauli": "X", "round": 5}]},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_run_rejects_too_many_rounds(self):
        response = self.client.post(reverse("qec-run"), {"rounds": 99}, format="json")
        self.assertEqual(response.status_code, 400)


class StimGeneratorCrossCheckTest(TestCase):
    """Compares our circuit with Stim's own `surface_code:rotated_memory_z`.

    Stim's circuit was written by different people, so agreeing with it is
    real evidence that ours is right, not just that it matches itself.

    Stim draws the same lattice mirrored left to right: a qubit we put at
    (x, y), Stim puts at (6 - x, y). The mirror moves every check to the other
    side but changes nothing about how the code works, so each comparison
    below first flips Stim's x coordinates back.
    """

    ROUNDS = 3
    PAULI_CHANNEL = {"X": "X_ERROR", "Y": "Y_ERROR", "Z": "Z_ERROR"}

    def stim_circuit(self, **noise):
        return stim.Circuit.generated(
            "surface_code:rotated_memory_z", distance=3, rounds=self.ROUNDS, **noise
        )

    @staticmethod
    def mirrored(coords):
        x, y, t = (int(c) for c in coords)
        return (6 - x, y, t)

    def fired(self, circuit, mirror=False):
        """(x, y, round) of every detector that fires, sorted."""
        det = circuit.compile_detector_sampler().sample(1)[0]
        coords = circuit.get_detector_coordinates()
        out = []
        for i in range(len(det)):
            if det[i]:
                out.append(self.mirrored(coords[i]) if mirror else tuple(int(c) for c in coords[i]))
        return sorted(out)

    def stim_with_error(self, qubit_xy, pauli, after_round):
        """Stim's circuit with one error placed after its n-th round of checks.

        The error is a noise channel with probability 1, like ours. A plain X
        gate would not show up: Stim reports detection events relative to the
        circuit's own noiseless run, and a gate is part of that run.
        """
        base = self.stim_circuit()
        by_xy = {
            (int(c[0]), int(c[1])): q for q, c in base.get_final_qubit_coordinates().items()
        }
        qubit = by_xy[(6 - qubit_xy[0], qubit_xy[1])]
        out = stim.Circuit()
        rounds_seen = 0
        for ins in base.flattened():
            out.append(ins)
            if ins.name == "MR":  # Stim measures and resets its ancillas in one step
                rounds_seen += 1
                if rounds_seen == after_round:
                    out.append(self.PAULI_CHANNEL[pauli], [qubit], 1.0)
        return out

    def test_same_size_as_stim(self):
        ours = experiment.build_circuit(self.ROUNDS)
        theirs = self.stim_circuit()
        self.assertEqual(ours.num_detectors, theirs.num_detectors)
        self.assertEqual(ours.num_observables, theirs.num_observables)

    def test_every_single_error_fires_the_same_detectors_as_stim(self):
        # 9 data qubits x 3 Paulis x 2 rounds = 54 cases.
        for q in layout.DATA_QUBITS:
            for pauli in "XYZ":
                for r in (1, 2):
                    with self.subTest(qubit=q.id, pauli=pauli, round=r):
                        ours = experiment.build_circuit(
                            self.ROUNDS, errors=[experiment.InjectedError(q.id, pauli, r)]
                        )
                        theirs = self.stim_with_error((q.x, q.y), pauli, r)
                        ours_fired = self.fired(ours)
                        # Every single error trips at least one check. Without this,
                        # two circuits that both fire nothing would wrongly "agree".
                        self.assertTrue(ours_fired)
                        self.assertEqual(ours_fired, self.fired(theirs, mirror=True))

    def test_same_noise_gives_the_same_list_of_possible_errors(self):
        """With the same noise on the data qubits, both circuits must list the
        same possible errors, each setting off the same detectors with the same
        probability. This is exact, so it cannot pass or fail by chance.

        Only data noise is compared. Stim's measurement noise also hits the
        final data readout, while ours only hits the ancillas, so those two
        models differ on purpose.
        """
        p = 0.01
        ours = stim.Circuit()
        for ins in experiment.build_circuit(self.ROUNDS, noise=p).flattened():
            if ins.name != "X_ERROR":  # drop our ancilla measurement noise
                ours.append(ins)
        theirs = self.stim_circuit(before_round_data_depolarization=p)

        def possible_errors(circuit, mirror):
            coords = circuit.get_detector_coordinates()
            errors = {}
            for inst in circuit.detector_error_model().flattened():
                if inst.type != "error":
                    continue
                dets, flips_logical = [], False
                for t in inst.targets_copy():
                    if t.is_relative_detector_id():
                        c = coords[t.val]
                        dets.append(self.mirrored(c) if mirror else tuple(int(v) for v in c))
                    elif t.is_logical_observable_id():
                        flips_logical = True
                key = (frozenset(dets), flips_logical)
                errors[key] = errors.get(key, 0) + inst.args_copy()[0]
            return errors

        mine, stims = possible_errors(ours, False), possible_errors(theirs, True)
        self.assertEqual(set(mine), set(stims))
        for key, prob in mine.items():
            self.assertAlmostEqual(prob, stims[key], places=12)
