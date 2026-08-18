"""Tests for the public /api/v1/ cross-platform API.

Covers the two things that make this namespace different from the rest of the
site: it answers without any credentials, and it accepts input from platforms we
do not control.
"""

import uuid
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Circuit, CircuitHandoff
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
    """Throttle history lives in the default cache and leaks between tests."""
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
        """The contract, asserted positively.

        The negative assertions above only catch leaks someone already thought
        of; a field added to the serializer tomorrow would pass them all. This
        pins the whole key set, so widening the public response has to be a
        deliberate edit to this test.
        """
        circuit = Circuit.objects.create(
            user=self.owner, name="Bell", ir=BELL_IR, is_public=True
        )
        resp = self.client.get(self._url(circuit.id))
        self.assertEqual(
            set(resp.data),
            {"circuit_id", "name", "description", "ir", "created_at", "updated_at"},
        )

    def test_owner_is_never_loaded_from_the_database(self):
        """The `.only()` projection, not just the serializer, keeps the owner out.

        Belt and braces: even if something downstream reached for `.user`, the
        column was never selected, so it is not sitting in memory waiting to be
        rendered into a response or a log line.
        """
        circuit = Circuit.objects.create(
            user=self.owner, name="Bell", ir=BELL_IR, is_public=True
        )
        instance = PublicCircuitDetailView().get_queryset().get(pk=circuit.id)
        self.assertTrue({"user", "user_id"} & instance.get_deferred_fields())

    def test_private_circuit_is_404_not_403(self):
        """403 would confirm the id exists, making this an enumeration oracle."""
        circuit = Circuit.objects.create(
            user=self.owner, name="Secret", ir=BELL_IR, is_public=False
        )
        resp = self.client.get(self._url(circuit.id))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_unknown_circuit_is_404(self):
        resp = self.client.get(self._url(uuid.uuid4()))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_stale_access_token_cookie_does_not_break_the_public_read(self):
        """The regression that motivates `authentication_classes = []`.

        CookieJWTAuthentication is the project-wide default and raises on an
        expired token, so a visitor still carrying a dead cookie would get a 401
        from an endpoint that needs no account at all.
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


class CircuitHandoffTests(APITestCase):
    create_url = "/api/v1/handoffs/"

    def setUp(self):
        clear_throttles()

    def _detail_url(self, token):
        return f"/api/v1/handoffs/{token}/"

    def test_partner_can_park_a_circuit_and_read_it_back(self):
        resp = self.client.post(
            self.create_url,
            {"ir": BELL_IR, "name": "Bell State", "source": "quantumcanvas"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        token = resp.data["token"]
        self.assertIn(f"?handoff={token}", resp.data["open_url"])

        read = self.client.get(self._detail_url(token))
        self.assertEqual(read.status_code, status.HTTP_200_OK)
        self.assertEqual(read.data["ir"], BELL_IR)
        self.assertEqual(read.data["name"], "Bell State")
        self.assertEqual(read.data["source"], "quantumcanvas")

    def test_reading_a_handoff_does_not_consume_it(self):
        """Refresh, back-button, and open-on-another-device must all work."""
        token = self.client.post(
            self.create_url, {"ir": BELL_IR}, format="json"
        ).data["token"]
        for _ in range(3):
            resp = self.client.get(self._detail_url(token))
            self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_expired_handoff_is_404(self):
        handoff = CircuitHandoff.objects.create(
            ir=BELL_IR, expires_at=timezone.now() - timedelta(seconds=1)
        )
        resp = self.client.get(self._detail_url(handoff.token))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_unknown_token_is_404(self):
        resp = self.client.get(self._detail_url("nope"))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_ir_is_rejected(self):
        bad = {**BELL_IR, "version": "9.9"}
        resp = self.client.post(self.create_url, {"ir": bad}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_creating_a_handoff_purges_expired_ones(self):
        stale = CircuitHandoff.objects.create(
            ir=BELL_IR, expires_at=timezone.now() - timedelta(hours=1)
        )
        self.client.post(self.create_url, {"ir": BELL_IR}, format="json")
        self.assertFalse(CircuitHandoff.objects.filter(token=stale.token).exists())

    @override_settings(MAX_HANDOFF_BODY_BYTES=64)
    def test_oversized_body_is_rejected(self):
        resp = self.client.post(
            self.create_url,
            {"ir": BELL_IR, "name": "Bell State"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

    def test_handoff_creation_is_throttled(self):
        # DRF reads THROTTLE_RATES off the throttle class at import time, so
        # override_settings(REST_FRAMEWORK=...) never reaches it — patch the
        # resolved rate table instead.
        with mock.patch.dict(
            ScopedRateThrottle.THROTTLE_RATES, {"circuit_handoff": "2/hour"}
        ):
            clear_throttles()
            for _ in range(2):
                resp = self.client.post(self.create_url, {"ir": BELL_IR}, format="json")
                self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
            resp = self.client.post(self.create_url, {"ir": BELL_IR}, format="json")
            self.assertEqual(resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class PublicApiCorsTests(APITestCase):
    """The public namespace serves `*`; the rest of the site keeps its
    credentialed, origin-specific headers. The two must never both write the
    header on one response — browsers reject a duplicated
    Access-Control-Allow-Origin outright."""

    def setUp(self):
        clear_throttles()
        self.owner = User.objects.create_user(
            email="cors@example.com", password="Str0ngP@ssw0rd!",
            first_name="C", last_name="O",
        )
        self.circuit = Circuit.objects.create(
            user=self.owner, name="Bell", ir=BELL_IR, is_public=True
        )

    def test_public_read_allows_any_origin_exactly_once(self):
        resp = self.client.get(
            f"/api/v1/circuits/{self.circuit.id}/",
            HTTP_ORIGIN="https://quantumcanvas.example",
        )
        headers = resp.headers
        self.assertEqual(headers["Access-Control-Allow-Origin"], "*")
        # Django's HttpResponse collapses repeats, so assert the app origin did
        # not win instead of `*`.
        self.assertNotIn("localhost", headers["Access-Control-Allow-Origin"])

    def test_app_origin_is_not_given_a_wildcard_on_internal_routes(self):
        """django-cors-headers must still own the credentialed endpoints."""
        resp = self.client.get(
            "/circuits/api/circuits/",
            HTTP_ORIGIN="http://localhost:5173",
        )
        self.assertNotEqual(resp.headers.get("Access-Control-Allow-Origin"), "*")

    def test_preflight_is_answered_for_the_handoff_post(self):
        resp = self.client.options(
            "/api/v1/handoffs/",
            HTTP_ORIGIN="https://quantumcanvas.example",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type",
        )
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(resp.headers["Access-Control-Allow-Origin"], "*")
        self.assertIn("POST", resp.headers["Access-Control-Allow-Methods"])
        self.assertIn("content-type", resp.headers["Access-Control-Allow-Headers"])


class IRValidationHardeningTests(APITestCase):
    """The public endpoint takes IR from platforms we do not control, so the
    checks the frontend used to guarantee by construction are enforced here."""

    url = "/api/v1/handoffs/"

    def setUp(self):
        clear_throttles()

    def _post(self, ir):
        return self.client.post(self.url, {"ir": ir}, format="json")

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
        """The exact shape the old loose validator let through."""
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
        """The handoff wire format drops per-op ids to keep links short; the
        client regenerates them on import."""
        resp = self._post(BELL_IR)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_rejects_label_count_mismatch(self):
        resp = self._post({**BELL_IR, "qubitLabels": ["Only one"]})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class SchemaTests(APITestCase):
    def setUp(self):
        clear_throttles()

    def test_schema_is_served_and_publishes_only_the_public_namespace(self):
        resp = self.client.get("/api/v1/schema/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        body = resp.content.decode()
        self.assertIn("/api/v1/handoffs/", body)
        # Internal, cookie-authenticated routes are not a published contract.
        self.assertNotIn("/circuits/api/circuits/", body)
        self.assertNotIn("/accounts/", body)
