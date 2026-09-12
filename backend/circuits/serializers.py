from rest_framework import serializers
from .models import Circuit
from .validation import validate_circuit_ir


class CircuitListSerializer(serializers.ModelSerializer):
    circuit_id = serializers.UUIDField(source='id', read_only=True)

    class Meta:
        model = Circuit
        fields = ['circuit_id', 'name', 'description', 'is_public', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class CircuitDetailSerializer(serializers.ModelSerializer):
    circuit_id = serializers.UUIDField(source='id', read_only=True)

    class Meta:
        model = Circuit
        fields = ['circuit_id', 'name', 'description', 'ir', 'is_public', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def validate_name(self, value):
        user = self.context['request'].user
        qs = Circuit.objects.filter(user=user, name=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "A circuit with this name already exists. Please choose a different name."
            )
        return value

    def validate_ir(self, value):
        # Also used by the public handoff API. See circuits/validation.py.
        return validate_circuit_ir(value)
