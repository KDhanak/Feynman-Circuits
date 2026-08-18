"""API tests for the circuits app: cloud save/load, ownership isolation, the
client-UUID upsert path (PUT), IR validation, and the next-name helper.

Auth is via the `access_token` cookie that CookieJWTAuthentication reads, so we
mint a token per user and drop it on the test client's cookie jar.
"""

import uuid

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Circuit

User = get_user_model()

# Minimal circuit IR the serializer's validate_ir accepts: version 1.0, a valid
# qubit register (1–8), and one operation using a registered gate id in range.
# The operation field is `targets` — an earlier version of this fixture said
# `qubits`, which the schema has never had; validation was loose enough to let
# a target-less operation through until circuits/validation.py tightened it.
VALID_IR = {
    "version": "1.0",
    "registers": {"q": 2, "c": 0},
    "qubitLabels": ["Qubit 0", "Qubit 1"],
    "operations": [
        {
            "kind": "unitary",
            "gate": "h",
            "column": 0,
            "targets": [0],
            "controls": [],
            "antiControls": [],
            "params": [],
        },
    ],
}


def make_user(email, password="Str0ngP@ssw0rd!"):
    return User.objects.create_user(
        email=email, password=password, first_name="Test", last_name="User"
    )


class CircuitAPITests(APITestCase):
    list_url = "/circuits/api/circuits/"
    next_name_url = "/circuits/api/circuits/next-name/"

    def setUp(self):
        self.user = make_user("owner@example.com")
        self.other = make_user("intruder@example.com")
        self._authenticate(self.user)

    def _authenticate(self, user):
        access = str(RefreshToken.for_user(user).access_token)
        self.client.cookies["access_token"] = access

    def _detail_url(self, pk):
        return f"/circuits/api/circuits/{pk}/"

    # --- auth ---------------------------------------------------------------

    def test_list_requires_authentication(self):
        self.client.cookies.clear()
        resp = self.client.get(self.list_url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    # --- create / list ------------------------------------------------------

    def test_create_circuit(self):
        resp = self.client.post(
            self.list_url,
            {"name": "Bell", "ir": VALID_IR},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        circuit = Circuit.objects.get(name="Bell")
        self.assertEqual(circuit.user, self.user)

    def test_list_returns_only_own_circuits(self):
        Circuit.objects.create(user=self.user, name="Mine", ir=VALID_IR)
        Circuit.objects.create(user=self.other, name="Theirs", ir=VALID_IR)
        resp = self.client.get(self.list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        names = [c["name"] for c in resp.data["results"]]
        self.assertIn("Mine", names)
        self.assertNotIn("Theirs", names)

    def test_duplicate_name_rejected(self):
        Circuit.objects.create(user=self.user, name="Bell", ir=VALID_IR)
        resp = self.client.post(
            self.list_url,
            {"name": "Bell", "ir": VALID_IR},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # --- retrieve / ownership ----------------------------------------------

    def test_retrieve_own_circuit_includes_ir(self):
        circuit = Circuit.objects.create(user=self.user, name="Mine", ir=VALID_IR)
        resp = self.client.get(self._detail_url(circuit.id))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["ir"], VALID_IR)

    def test_cannot_retrieve_another_users_circuit(self):
        circuit = Circuit.objects.create(user=self.other, name="Theirs", ir=VALID_IR)
        resp = self.client.get(self._detail_url(circuit.id))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    # --- update / upsert (PUT with a client-generated UUID) -----------------

    def test_put_creates_circuit_with_client_uuid(self):
        pk = uuid.uuid4()
        resp = self.client.put(
            self._detail_url(pk),
            {"name": "Fresh", "ir": VALID_IR},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Circuit.objects.filter(id=pk, user=self.user).exists())

    def test_put_updates_existing_circuit(self):
        circuit = Circuit.objects.create(user=self.user, name="Old", ir=VALID_IR)
        resp = self.client.put(
            self._detail_url(circuit.id),
            {"name": "Renamed", "ir": VALID_IR},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        circuit.refresh_from_db()
        self.assertEqual(circuit.name, "Renamed")

    # --- saving a circuit that was shared with you --------------------------

    def test_saving_a_shared_circuit_creates_your_own_copy(self):
        """The recipient of a share link keeps the sender's circuit id on their
        board, so their first save arrives as a PUT to an id they do not own."""
        shared = Circuit.objects.create(user=self.other, name="Bell", ir=VALID_IR)

        resp = self.client.put(
            self._detail_url(shared.id),
            {"name": "Bell", "ir": VALID_IR},
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        # A new row, under a new id, owned by the recipient.
        self.assertNotEqual(resp.data["circuit_id"], str(shared.id))
        copy = Circuit.objects.get(id=resp.data["circuit_id"])
        self.assertEqual(copy.user, self.user)
        # The sender's circuit is untouched and still theirs.
        shared.refresh_from_db()
        self.assertEqual(shared.user, self.other)
        self.assertEqual(shared.name, "Bell")

    def test_copy_is_renamed_when_the_name_is_already_taken(self):
        Circuit.objects.create(user=self.user, name="Bell", ir=VALID_IR)
        shared = Circuit.objects.create(user=self.other, name="Bell", ir=VALID_IR)

        resp = self.client.put(
            self._detail_url(shared.id),
            {"name": "Bell", "ir": VALID_IR},
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["name"], "Bell (copy)")

    def test_copy_keeps_a_free_name_unchanged(self):
        shared = Circuit.objects.create(user=self.other, name="Bell", ir=VALID_IR)

        resp = self.client.put(
            self._detail_url(shared.id),
            {"name": "Bell", "ir": VALID_IR},
            format="json",
        )

        self.assertEqual(resp.data["name"], "Bell")

    def test_copy_is_not_published_even_if_the_original_was(self):
        shared = Circuit.objects.create(
            user=self.other, name="Bell", ir=VALID_IR, is_public=True
        )

        resp = self.client.put(
            self._detail_url(shared.id),
            {"name": "Bell", "ir": VALID_IR, "is_public": True},
            format="json",
        )

        self.assertFalse(Circuit.objects.get(id=resp.data["circuit_id"]).is_public)

    def test_patching_a_circuit_you_do_not_own_is_404(self):
        """PATCH cannot copy — it carries only the changed fields — and editing
        someone else's circuit is not a thing this endpoint should invent."""
        shared = Circuit.objects.create(user=self.other, name="Bell", ir=VALID_IR)

        resp = self.client.patch(
            self._detail_url(shared.id), {"is_public": True}, format="json"
        )

        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        shared.refresh_from_db()
        self.assertFalse(shared.is_public)

    # --- delete -------------------------------------------------------------

    def test_delete_circuit(self):
        circuit = Circuit.objects.create(user=self.user, name="Doomed", ir=VALID_IR)
        resp = self.client.delete(self._detail_url(circuit.id))
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Circuit.objects.filter(id=circuit.id).exists())

    # --- IR validation ------------------------------------------------------

    def test_create_rejects_wrong_ir_version(self):
        bad_ir = {**VALID_IR, "version": "2.0"}
        resp = self.client.post(
            self.list_url,
            {"name": "BadVersion", "ir": bad_ir},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_rejects_unknown_gate(self):
        bad_ir = {
            **VALID_IR,
            "operations": [{"kind": "unitary", "gate": "nope", "column": 0}],
        }
        resp = self.client.post(
            self.list_url,
            {"name": "BadGate", "ir": bad_ir},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_rejects_out_of_range_qubit_count(self):
        bad_ir = {**VALID_IR, "registers": {"q": 99, "c": 0}}
        resp = self.client.post(
            self.list_url,
            {"name": "TooManyQubits", "ir": bad_ir},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # --- next-name helper ---------------------------------------------------

    def test_next_name_starts_at_untitled(self):
        resp = self.client.get(self.next_name_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["name"], "Untitled Circuit")

    def test_next_name_increments(self):
        Circuit.objects.create(
            user=self.user, name="Untitled Circuit", ir=VALID_IR
        )
        resp = self.client.get(self.next_name_url)
        self.assertEqual(resp.data["name"], "Untitled Circuit 2")
