from rest_framework import serializers
from .models import Circuit

VALID_KINDS = {'unitary', 'measure', 'reset', 'barrier'}
VALID_GATES = {'x', 'y', 'z', 'h', 's', 't', 'rx', 'rz'}


class CircuitListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Circuit
        fields = ['id', 'name', 'description', 'is_public', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class CircuitDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Circuit
        fields = ['id', 'name', 'description', 'ir', 'is_public', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def validate_ir(self, value):
        if value.get('version') != '1.0':
            raise serializers.ValidationError("IR must have version '1.0'")

        registers = value.get('registers', {})
        q = registers.get('q', 0)
        c = registers.get('c', 0)
        if not (1 <= q <= 8):
            raise serializers.ValidationError("Qubit count must be between 1 and 8")
        if c < 0:
            raise serializers.ValidationError("Classical bit count cannot be negative")

        operations = value.get('operations', [])
        for op in operations:
            if op.get('kind') == 'unitary' and op.get('gate') not in VALID_GATES:
                raise serializers.ValidationError(f"Invalid gate: {op.get('gate')}")
            if op.get('kind') not in VALID_KINDS:
                raise serializers.ValidationError(f"Invalid operation kind: {op.get('kind')}")
            col = op.get('column', -1)
            if not (0 <= col <= 29):
                raise serializers.ValidationError(f"Column {col} out of range (0–29)")

        return value
