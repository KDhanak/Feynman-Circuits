"""Builds the Stim circuit for the d=3 surface code memory, and decodes it.

This file does two separate jobs, and it is important to keep them apart:

* `build_circuit` makes the memory-Z experiment. The errors the user placed
  are added as Pauli channels with probability 1, so a run always gives the
  exact same result instead of a random one: click a qubit, and see exactly
  which checks fire.
* `decode` builds the matching graph from a SEPARATE circuit that has a small
  amount of noise spread evenly everywhere. A decoder needs a model of which
  errors are likely. An error with probability 1 is not something it can
  match on, and a circuit with no random noise has an empty detector error
  model, so there would be nothing to match.

Both circuits have exactly the same detectors, so the syndrome numbers line up.

The CNOT order is the standard one that keeps the X and Z stabilisers
commuting: X checks visit their neighbours row by row, Z checks column by
column. If this order is wrong, nothing crashes. Instead the detectors quietly
start giving random results. That is why `tests.py` checks that a run with no
noise fires no detectors.
"""

from dataclasses import dataclass

import numpy as np
import pymatching
import stim

from . import layout
from .layout import CHECKS, DATA_QUBITS, LOGICAL_Z, X_CHECKS, Z_CHECKS

# The order each ancilla visits its neighbours, as (dx, dy) steps from the
# ancilla. One order is the other one flipped along the diagonal. Because of
# this, when an X check and a Z check share two data qubits, they touch them
# in opposite order.
X_ORDER = ((-1, -1), (1, -1), (-1, 1), (1, 1))  # row by row
Z_ORDER = ((-1, -1), (-1, 1), (1, -1), (1, 1))  # column by column

PAULI_CHANNEL = {"X": "X_ERROR", "Y": "Y_ERROR", "Z": "Z_ERROR"}

#: A small, even amount of noise used only to build the decoding graph. It is
#: never added to the circuit that produces the user's syndrome.
DECODER_NOISE = 0.001

N_DATA = len(DATA_QUBITS)
N_CHECKS = len(CHECKS)


@dataclass(frozen=True)
class InjectedError:
    qubit: int
    pauli: str
    round: int

    def to_dict(self) -> dict:
        return {"qubit": self.qubit, "pauli": self.pauli, "round": self.round}


def build_circuit(rounds: int, errors=(), noise: float = 0.0) -> stim.Circuit:
    """Rotated d=3 surface code, memory Z, with `rounds` stabiliser rounds.

    Each error in `errors` is added just before the stabiliser measurement of
    its round. So "an X on qubit 4 in round 2" means the round-2 checks are the
    first ones that can see it. `noise` adds a small depolarising noise to
    every qubit, which we only need when building the decoder graph. Keep it at
    0 for an exact run.
    """
    x_anc = [layout.ANCILLA_INDEX[c.id] for c in X_CHECKS]
    z_anc = [layout.ANCILLA_INDEX[c.id] for c in Z_CHECKS]

    c = stim.Circuit()
    for q in DATA_QUBITS:
        c.append("QUBIT_COORDS", [q.id], [q.x, q.y])
    for check in CHECKS:
        c.append("QUBIT_COORDS", [layout.ANCILLA_INDEX[check.id]], [check.x, check.y])

    c.append("R", [q.id for q in DATA_QUBITS])

    for r in range(rounds):
        for err in errors:
            if err.round == r:
                c.append(PAULI_CHANNEL[err.pauli], [err.qubit], 1.0)
        if noise > 0:
            c.append("DEPOLARIZE1", [q.id for q in DATA_QUBITS], noise)

        c.append("RX", x_anc)
        c.append("R", z_anc)
        c.append("TICK")

        for step in range(4):
            for check in CHECKS:
                dx, dy = (X_ORDER if check.type == "X" else Z_ORDER)[step]
                neighbour = layout.DATA_AT.get((check.x + dx, check.y + dy))
                if neighbour is None or neighbour not in check.data_qubits:
                    continue
                anc = layout.ANCILLA_INDEX[check.id]
                # For X checks the ancilla is the CNOT control. For Z checks it is the target.
                c.append("CX", [anc, neighbour] if check.type == "X" else [neighbour, anc])
            c.append("TICK")

        if noise > 0:
            c.append("X_ERROR", x_anc + z_anc, noise)
        c.append("MX", x_anc)
        c.append("M", z_anc)

        if r == 0:
            # All data qubits start in |0>, so in the first round only the Z
            # stabilisers give a fixed, known result. The X checks give random
            # results in round one. They only become useful from the next
            # round, when there is an earlier round to compare them with.
            for i, check in enumerate(Z_CHECKS):
                c.append("DETECTOR", [stim.target_rec(-len(Z_CHECKS) + i)], [check.x, check.y, 0])
        else:
            for i, check in enumerate(CHECKS):
                k = -N_CHECKS + i
                c.append(
                    "DETECTOR",
                    [stim.target_rec(k), stim.target_rec(k - N_CHECKS)],
                    [check.x, check.y, r],
                )

    # Final transversal Z readout (every data qubit is measured in Z at the
    # same time). Each Z check is compared with the parity of its own data
    # qubits. This finishes the last round without needing one more round of
    # ancilla measurement.
    c.append("M", [q.id for q in DATA_QUBITS])
    for i, check in enumerate(Z_CHECKS):
        recs = [stim.target_rec(-N_DATA + q) for q in check.data_qubits]
        recs.append(stim.target_rec(-N_DATA - N_CHECKS + len(X_CHECKS) + i))
        c.append("DETECTOR", recs, [check.x, check.y, rounds])

    c.append("OBSERVABLE_INCLUDE", [stim.target_rec(-N_DATA + q) for q in LOGICAL_Z], 0)
    return c


def detector_labels(rounds: int) -> list[tuple[str, int]]:
    """Maps each detector number to (check id, round), in the order they are added.

    The DETECTOR lines above and this list must always match. We don't just
    hope both get edited together: the tests compare this list with the
    coordinates Stim stores for each detector.
    """
    labels: list[tuple[str, int]] = []
    for r in range(rounds):
        source = Z_CHECKS if r == 0 else CHECKS
        labels += [(c.id, r) for c in source]
    labels += [(c.id, rounds) for c in Z_CHECKS]
    return labels


def _timeline(rounds: int, errors, events_by_round: dict[int, dict[str, int]]) -> list[dict]:
    """Builds the frontend's `TimelineSnapshot[]`, which has 2*rounds + 1 steps.

    Each round has two steps: first the error is placed, then we show what the
    ancillas measured. After all rounds there is one last decode step that
    holds the detectors from the final data qubit readout. We keep "place" and
    "measure" as separate steps on purpose, because that is what the timeline
    slider is for: it lets the user see that the error was there for a moment
    before anything reported it.
    """
    snapshots: list[dict] = []
    syndrome = {c.id: 0 for c in CHECKS}

    def truth_through(r: int) -> dict:
        return {"injected": [e.to_dict() for e in errors if e.round <= r]}

    for r in range(rounds):
        # Injection step: the error has been placed, but nothing has been
        # measured yet. So the syndrome shown here is still the previous round's.
        snapshots.append(
            {
                "round": r,
                "phase": "inject",
                "truth": truth_through(r),
                "measured": {
                    "syndrome": dict(syndrome),
                    "detectionEvents": {c.id: 0 for c in CHECKS},
                },
            }
        )
        events = events_by_round.get(r, {})
        full = {c.id: events.get(c.id, 0) for c in CHECKS}
        for cid, v in full.items():
            syndrome[cid] ^= v
        snapshots.append(
            {
                "round": r,
                "phase": "measure",
                "truth": truth_through(r),
                "measured": {"syndrome": dict(syndrome), "detectionEvents": full},
            }
        )

    final = events_by_round.get(rounds, {})
    full = {c.id: final.get(c.id, 0) for c in CHECKS}
    for cid, v in full.items():
        syndrome[cid] ^= v
    snapshots.append(
        {
            "round": rounds,
            "phase": "decode",
            "truth": truth_through(rounds),
            "measured": {"syndrome": dict(syndrome), "detectionEvents": full},
        }
    )
    return snapshots


def _decode(rounds: int, detections: np.ndarray, observed_flip: int) -> dict:
    """Layer 3: what MWPM works out from the syndrome alone.

    The matching graph is built from a circuit with even noise everywhere,
    never from the circuit the user's errors came from. The decoder is only
    allowed to see layer 2 (the measurements). If we built its model from the
    real injected errors, we would secretly be giving it the answer.
    """
    graph_circuit = build_circuit(rounds, errors=(), noise=DECODER_NOISE)
    dem = graph_circuit.detector_error_model(decompose_errors=True)
    matcher = pymatching.Matching.from_detector_error_model(dem)

    prediction = matcher.decode(detections)
    predicted_flip = int(prediction[0])

    labels = detector_labels(rounds)

    def ref(index: int) -> dict:
        check_id, r = labels[index]
        return {"round": r, "checkId": check_id}

    matching: list[dict] = []
    for a, b in matcher.decode_to_matched_dets_array(detections):
        if a < 0 and b < 0:
            continue
        if a < 0 or b < 0:
            matching.append({"kind": "boundary", "a": ref(int(max(a, b)))})
        else:
            matching.append({"kind": "pair", "a": ref(int(a)), "b": ref(int(b))})

    return {
        "matching": matching,
        # This is empty on purpose. To turn the matching into a list of data
        # qubits to fix, we would first need to map each error in the DEM back
        # to its place on the lattice. Making up a chain that only looks right
        # would mix up layer 2 (what was measured) and layer 3 (what was
        # guessed), and this schema exists to stop exactly that.
        "correction": [],
        "logical": {
            "observedFlip": observed_flip,
            "predictedFlip": predicted_flip,
            # The decoder succeeds when its guess matches what really
            # happened, not when it makes no correction.
            "success": observed_flip == predicted_flip,
        },
    }


def run(rounds: int, errors) -> dict:
    """One exact run. Returns the frontend's `QecResult`."""
    errors = tuple(errors)
    circuit = build_circuit(rounds, errors=errors, noise=0.0)

    sampler = circuit.compile_detector_sampler()
    det, obs = sampler.sample(1, separate_observables=True)
    detections = det[0]
    observed_flip = int(obs[0][0])

    events_by_round: dict[int, dict[str, int]] = {}
    for index, (check_id, r) in enumerate(detector_labels(rounds)):
        events_by_round.setdefault(r, {})[check_id] = int(detections[index])

    return {
        "layout": layout.to_dict(),
        "request": {"rounds": rounds, "errors": [e.to_dict() for e in errors]},
        "timeline": _timeline(rounds, errors, events_by_round),
        "inferred": _decode(rounds, detections, observed_flip),
    }


def logical_error_rate(rounds: int, noise: float, shots: int) -> dict:
    """The random (probability) path: how often MWPM fails at this noise level.

    This is kept apart from `run` on purpose. `run` answers "what does THIS
    error do?". This function answers "how good is the code?", which needs
    many shots and no errors placed by the user.
    """
    circuit = build_circuit(rounds, errors=(), noise=noise)
    dem = circuit.detector_error_model(decompose_errors=True)
    matcher = pymatching.Matching.from_detector_error_model(dem)

    det, obs = circuit.compile_detector_sampler().sample(shots, separate_observables=True)
    predictions = matcher.decode_batch(det)
    failures = int(np.sum(np.any(predictions != obs, axis=1)))
    return {
        "rounds": rounds,
        "noise": noise,
        "shots": shots,
        "failures": failures,
        "logicalErrorRate": failures / shots,
    }
