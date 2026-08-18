"""Serializers for the public /api/v1/ namespace.

Kept apart from serializers.py because these shape the *published* contract:
what a third-party platform sees and what it is allowed to send. Anything added
here is something partners may start depending on, so the field lists are
written out explicitly rather than inherited from the internal serializers.
"""

from rest_framework import serializers

from .models import Circuit, CircuitHandoff
from .validation import validate_circuit_ir


class PublicCircuitSerializer(serializers.ModelSerializer):
    """A circuit its owner has marked public.

    Note what is absent: no `user`, no email, no `is_public` flag. The owner is
    never disclosed, and echoing the flag back would only invite clients to
    treat it as a filter they can set.
    """

    circuit_id = serializers.UUIDField(source='id', read_only=True)

    class Meta:
        model = Circuit
        fields = ['circuit_id', 'name', 'description', 'ir', 'created_at', 'updated_at']
        read_only_fields = fields


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
