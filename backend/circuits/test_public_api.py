"""Tests for the read endpoint behind FC share links (no login needed), and for
the IR validation that this endpoint's data goes through.

People who open share links may not have an account, so this endpoint answers
without any login details. Most of these tests are about that.
"""

import uuid

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Circuit
from .public_views import PublicCircuitDetailView

User = get_user_model()

BELL_IR = {
    "version": "1.0",
    "registers": {"q": 2, "c": 0},
    "qubitLabels": ["Qubit 0", "Qubit 1"],
    "operations": [
        {
            "kind": "unitary", "gate": "h", "column": 0,
            "targets": [0], "controls": [], "antiControls": [], "params": [],
        },
        {
            "kind": "unitary", "gate": "x", "column": 1,
            "targets": [1], "controls": [0], "antiControls": [], "params": [],
        },
    ],
}


def clear_throttles():
    """Rate-limit history is kept in the default cache and carries over between tests."""
    from django.core.cache import cache
    cache.clear()


class PublicCircuitReadTests(APITestCase):
    def setUp(self):
        clear_throttles()
        self.owner = User.objects.create_user(
            email="owner@example.com", password="Str0ngP@ssw0rd!",
            first_name="Own", last_name="Er",
        )

    def _url(self, circuit_id):
        return f"/api/v1/circuits/{circuit_id}/"

    def test_public_circuit_is_readable_without_auth(self):
        circuit = Circuit.objects.create(
            user=self.owner, name="Bell", ir=BELL_IR, is_public=True
        )
        resp = self.client.get(self._url(circuit.id))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["ir"], BELL_IR)
        self.assertEqual(resp.data["name"], "Bell")

    def test_response_does_not_leak_the_owner(self):
        circuit = Circuit.objects.create(
            user=self.owner, name="Bell", ir=BELL_IR, is_public=True
        )
        resp = self.client.get(self._url(circuit.id))
        self.assertNotIn("user", resp.data)
        self.assertNotIn("is_public", resp.data)
        self.assertNotIn("owner@example.com", str(resp.data))

    def test_response_exposes_exactly_the_published_fields(self):
        """Checks the exact list of fields that are allowed.

        The tests above only catch leaks that someone already thought of. A new
        field added to the serializer tomorrow would pass all of them. This test
        fixes the whole list of keys, so making the public response bigger has to
        be done on purpose, by editing this test.
        """
        circuit = Circuit.objects.create(
            user=self.owner, name="Bell", ir=BELL_IR, is_public=True
        )
        resp = self.client.get(self._url(circuit.id))
        self.assertEqual(
            set(resp.data),
            {"circuit_id", "name", "ir", "created_at", "updated_at"},
        )

    def test_owner_is_never_loaded_from_the_database(self):
        """The `.only()` query, not just the serializer, keeps the owner out.

        This is an extra safety layer. Even if some later code tried to use
        `.user`, that column was never loaded, so it cannot end up in a response
        or a log line by accident.
        """
        circuit = Circuit.objects.create(
            user=self.owner, name="Bell", ir=BELL_IR, is_public=True
        )
        instance = PublicCircuitDetailView().get_queryset().get(pk=circuit.id)
        self.assertTrue({"user", "user_id"} & instance.get_deferred_fields())

    def test_private_circuit_is_404_not_403(self):
        """A 403 would tell people the id exists, which would let them guess ids to find circuits."""
        circuit = Circuit.objects.create(
            user=self.owner, name="Secret", ir=BELL_IR, is_public=False
        )
        resp = self.client.get(self._url(circuit.id))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_unknown_circuit_is_404(self):
        resp = self.client.get(self._url(uuid.uuid4()))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_stale_access_token_cookie_does_not_break_the_public_read(self):
        """The bug that is the reason we set `authentication_classes = []`.

        CookieJWTAuthentication is the default for the whole project, and it
        raises an error when a token has expired. So a visitor who still has an
        old, expired cookie would get a 401 from an endpoint that does not need
        an account at all.
        """
        circuit = Circuit.objects.create(
            user=self.owner, name="Bell", ir=BELL_IR, is_public=True
        )
        self.client.cookies["access_token"] = "not-a-valid-jwt"
        resp = self.client.get(self._url(circuit.id))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_signed_in_user_can_still_read_a_public_circuit(self):
        circuit = Circuit.objects.create(
            user=self.owner, name="Bell", ir=BELL_IR, is_public=True
        )
        token = str(RefreshToken.for_user(self.owner).access_token)
        self.client.cookies["access_token"] = token
        resp = self.client.get(self._url(circuit.id))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class IRValidationHardeningTests(APITestCase):
    """validate_circuit_ir is used by every path that accepts a circuit, so
    these tests call it through the save endpoint (which needs a login)."""

    def setUp(self):
        clear_throttles()
        self.user = User.objects.create_user(
            email="owner@example.com", password="pw12345!"
        )
        self.client.cookies["access_token"] = str(
            RefreshToken.for_user(self.user).access_token
        )

    def _post(self, ir):
        return self.client.put(
            f"/circuits/api/circuits/{uuid.uuid4()}/",
            {"name": f"C{uuid.uuid4().hex[:8]}", "ir": ir},
            format="json",
        )

    def _with_op(self, op):
        return {**BELL_IR, "operations": [op]}

    def test_rejects_qubit_index_outside_the_register(self):
        resp = self._post(self._with_op({
            "kind": "unitary", "gate": "h", "column": 0,
            "targets": [7], "controls": [], "antiControls": [], "params": [],
        }))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_target_that_is_also_a_control(self):
        resp = self._post(self._with_op({
            "kind": "unitary", "gate": "x", "column": 0,
            "targets": [0], "controls": [0], "antiControls": [], "params": [],
        }))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_parametric_gate_without_params(self):
        resp = self._post(self._with_op({
            "kind": "unitary", "gate": "rx", "column": 0,
            "targets": [0], "controls": [], "antiControls": [], "params": [],
        }))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_wrong_target_count_for_gate_arity(self):
        resp = self._post(self._with_op({
            "kind": "unitary", "gate": "swap", "column": 0,
            "targets": [0], "controls": [], "antiControls": [], "params": [],
        }))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_operation_with_no_targets_at_all(self):
        """The exact shape that the old, less strict validator let through."""
        resp = self._post(self._with_op(
            {"kind": "unitary", "gate": "h", "column": 0}
        ))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_classical_target_outside_the_register(self):
        resp = self._post(self._with_op({
            "kind": "measure", "gate": "measure", "column": 0,
            "targets": [0], "classicalTargets": [3],
        }))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_too_many_operations(self):
        op = {
            "kind": "unitary", "gate": "h", "column": 0,
            "targets": [0], "controls": [], "antiControls": [], "params": [],
        }
        resp = self._post({**BELL_IR, "operations": [dict(op) for _ in range(241)]})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_duplicate_operation_ids(self):
        op = {
            "id": "same", "kind": "unitary", "gate": "h", "column": 0,
            "targets": [0], "controls": [], "antiControls": [], "params": [],
        }
        resp = self._post({**BELL_IR, "operations": [dict(op), dict(op)]})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_accepts_operations_without_ids(self):
        """The handoff format leaves out each operation's id to keep links short.
        The client makes new ids when it imports the circuit."""
        resp = self._post(BELL_IR)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_rejects_label_count_mismatch(self):
        resp = self._post({**BELL_IR, "qubitLabels": ["Only one"]})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
