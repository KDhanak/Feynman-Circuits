"""Serializers for the public /api/v1/ namespace.

Kept apart from serializers.py because these shape the *published* contract:
what a third-party platform sees and what it is allowed to send. Anything added
here is something partners may start depending on, so the field lists are
written out explicitly rather than inherited from the internal serializers.
"""

from rest_framework import serializers

from .models import Circuit, CircuitHandoff
from .validation import validate_circuit_ir


class PublicCircuitSerializer(serializers.Serializer):
    """A circuit its owner has marked public.

    Note what is absent: no `user`, no email, no `is_public` flag. The owner is
    never disclosed, and echoing the flag back would only invite clients to
    treat it as a filter they can set.

    Deliberately a plain Serializer rather than a ModelSerializer. A
    ModelSerializer is bound to Circuit, which carries a foreign key to the user
    — so it is always one `fields = '__all__'`, or one well-meant "let's also
    return the author", away from disclosing account data. With no model
    attached, this class cannot reach the owner however it is edited later. The
    field list was already explicit, so nothing is lost by giving up the
    binding. PublicCircuitDetailView pairs this with a matching `.only()` so the
    owner is never even loaded from the database on this path.
    """

    circuit_id = serializers.UUIDField(source='id', read_only=True)
    name = serializers.CharField(read_only=True)
    description = serializers.CharField(read_only=True)
    ir = serializers.JSONField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)


class CircuitHandoffCreateSerializer(serializers.Serializer):
    """Inbound handoff from a partner platform."""

    ir = serializers.JSONField()
    name = serializers.CharField(max_length=255, required=False, default='Imported Circuit')
    source = serializers.CharField(max_length=64, required=False, allow_blank=True, default='')

    def validate_ir(self, value):
        return validate_circuit_ir(value)

    def create(self, validated_data):
        return CircuitHandoff.objects.create(**validated_data)


class CircuitHandoffReadSerializer(serializers.ModelSerializer):
    """A parked handoff, as the app reads it back when the user follows the link."""

    class Meta:
        model = CircuitHandoff
        fields = ['ir', 'name', 'source', 'created_at', 'expires_at']
        read_only_fields = fields
