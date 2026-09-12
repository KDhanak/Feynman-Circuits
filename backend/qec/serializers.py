"""Checks the requests sent to the QEC endpoint.

The limits are chosen for a reason. Each run builds a Stim circuit and a
matching graph. Without a limit on `rounds`, a client could easily make the
server do a lot of heavy work. These limits are the same ones written in the
frontend's `QecRequest`.
"""

from rest_framework import serializers

from . import layout

MAX_ROUNDS = 15
MAX_ERRORS = 20
VALID_QUBITS = {q.id for q in layout.DATA_QUBITS}


class InjectedErrorSerializer(serializers.Serializer):
    qubit = serializers.IntegerField(min_value=0, max_value=max(VALID_QUBITS))
    pauli = serializers.ChoiceField(choices=["X", "Y", "Z"])
    round = serializers.IntegerField(min_value=0, max_value=MAX_ROUNDS - 1)

    def validate_qubit(self, value: int) -> int:
        # Errors cannot be placed on ancillas. Ancillas are reset every round,
        # so an error on one would be wiped out before it could be measured.
        if value not in VALID_QUBITS:
            raise serializers.ValidationError("Not a data qubit.")
        return value


class QecRequestSerializer(serializers.Serializer):
    rounds = serializers.IntegerField(min_value=1, max_value=MAX_ROUNDS)
    errors = InjectedErrorSerializer(many=True, required=False, default=list)

    def validate_errors(self, value: list) -> list:
        if len(value) > MAX_ERRORS:
            raise serializers.ValidationError(f"At most {MAX_ERRORS} errors per run.")
        return value

    def validate(self, attrs: dict) -> dict:
        # This check looks at two fields together. An error in a round the
        # experiment never reaches would do nothing, and in the UI that would
        # look like a bug.
        rounds = attrs["rounds"]
        for err in attrs.get("errors", []):
            if err["round"] >= rounds:
                raise serializers.ValidationError(
                    {"errors": f"Round {err['round']} is outside a {rounds}-round run."}
                )
        return attrs


class ErrorRateRequestSerializer(serializers.Serializer):
    rounds = serializers.IntegerField(min_value=1, max_value=MAX_ROUNDS, default=3)
    noise = serializers.FloatField(min_value=0.0, max_value=0.5, default=0.005)
    # Limited because every shot takes real work, and the user waits until all of it is done.
    shots = serializers.IntegerField(min_value=100, max_value=50_000, default=10_000)
