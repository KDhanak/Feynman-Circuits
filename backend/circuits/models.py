import secrets
import uuid
from datetime import timedelta

from django.db import models
from django.conf import settings
from django.utils import timezone

# How long a handoff link stays openable. Long enough that a user can follow the
# link later from another device, short enough that abandoned payloads do not
# accumulate.
IMPORT_TOKEN_TTL = timedelta(hours=24)


def _new_import_token():
    return secrets.token_urlsafe(24)


def _default_import_expiry():
    return timezone.now() + IMPORT_TOKEN_TTL


class Circuit(models.Model):
    id = models.UUIDField(primary_key=True, editable=False, default=uuid.uuid4)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='circuits')
    name = models.CharField(max_length=255, default='Untitled Circuit')
    description = models.TextField(blank=True, default='')
    ir = models.JSONField()
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    @classmethod
    def next_untitled_name(cls, user):
        names = cls.objects.filter(
            user=user,
            name__startswith='Untitled Circuit'
        ).values_list('name', flat=True)

        numbers = set()
        for name in names:
            if name == 'Untitled Circuit':
                numbers.add(1)
            else:
                suffix = name.removeprefix('Untitled Circuit ')
                if suffix.isdigit():
                    numbers.add(int(suffix))

        if not numbers:
            return 'Untitled Circuit'

        n = 1
        while n in numbers:
            n += 1
        return 'Untitled Circuit' if n == 1 else f'Untitled Circuit {n}'


class CircuitImport(models.Model):
    """A circuit handed to us by another platform, parked under an opaque token
    until the user follows the link and opens it.

    Deliberately a separate table rather than an ownerless Circuit row: a
    handoff has no owner yet, is short-lived, and must not show up in anyone's
    library or perturb Circuit.next_untitled_name(). It becomes a real Circuit
    only if the visitor signs in and saves, which goes through the normal
    upsert path.

    Reads do not consume the token — a user may refresh, hit back, or open the
    link on a second device, and all of those should keep working. Expiry is
    the only lifecycle control.
    """

    token = models.CharField(max_length=64, primary_key=True, default=_new_import_token, editable=False)
    ir = models.JSONField()
    name = models.CharField(max_length=255, default='Imported Circuit')
    # Free-text platform identifier supplied by the caller ("quantumcanvas").
    # Shown to the user in the confirmation dialog, so it is displayed as
    # untrusted text and never used for any authorization decision.
    source = models.CharField(max_length=64, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=_default_import_expiry, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def is_expired(self):
        return timezone.now() >= self.expires_at

    @classmethod
    def purge_expired(cls):
        """Delete every handoff past its expiry. Returns the number removed."""
        deleted, _ = cls.objects.filter(expires_at__lte=timezone.now()).delete()
        return deleted
