"""Serializer for the public circuit endpoint.

Kept apart from serializers.py because this shapes what an unauthenticated
visitor sees when they follow a share link, rather than what the owner sees in
their own library.
"""

from rest_framework import serializers


class PublicCircuitSerializer(serializers.Serializer):
    """A circuit its owner has marked public.

    Note what is absent: no `user`, no email, no `is_public` flag. The owner is
    never disclosed, and echoing the flag back would only invite clients to
    treat it as a filter they can set.

    Deliberately a plain Serializer rather than a ModelSerializer. A
    ModelSerializer is bound to Circuit, which carries a foreign key to the user
    — so it is always one `fields = '__all__'`, or one well-meant "let's also
    return the author", away from disclosing account data. With no model
    attached, this class cannot reach the owner however it is edited later.
    PublicCircuitDetailView pairs this with a matching `.only()` so the owner is
    never even loaded from the database on this path.
    """

    circuit_id = serializers.UUIDField(source='id', read_only=True)
    name = serializers.CharField(read_only=True)
    ir = serializers.JSONField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
