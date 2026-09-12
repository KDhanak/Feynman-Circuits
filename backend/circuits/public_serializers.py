"""Serializer for the public circuit endpoint.

Kept separate from serializers.py because this decides what a visitor who is
not logged in sees when they open a share link, not what the owner sees in
their own library.
"""

from rest_framework import serializers


class PublicCircuitSerializer(serializers.Serializer):
    """A circuit that its owner has made public.

    Notice what is missing: no `user`, no email, no `is_public` flag. The owner
    is never shown. And sending the flag back would only tempt clients to treat
    it as a filter they can set.

    This is a plain Serializer, not a ModelSerializer, on purpose. A
    ModelSerializer is linked to Circuit, which has a foreign key to the user.
    So it would take just one `fields = '__all__'`, or one friendly "let's also
    show the author", to leak account data. With no model attached, this class
    cannot reach the owner, no matter how it is changed later.
    PublicCircuitDetailView also uses a matching `.only()`, so the owner is
    never even loaded from the database here.
    """

    circuit_id = serializers.UUIDField(source='id', read_only=True)
    name = serializers.CharField(read_only=True)
    ir = serializers.JSONField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
