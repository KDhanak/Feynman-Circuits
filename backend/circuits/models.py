import uuid

from django.db import models
from django.conf import settings


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

    @classmethod
    def available_name(cls, user, desired):
        """`desired`, or the nearest free variant of it, for this user.

        Names are unique per user, so saving a circuit someone shared with you
        must not fail just because you already have one called "Bell" — it
        becomes "Bell (copy)", then "Bell (copy 2)", and so on.
        """
        desired = (desired or '').strip() or 'Untitled Circuit'
        taken = set(cls.objects.filter(user=user).values_list('name', flat=True))
        if desired not in taken:
            return desired

        # Leave room for the longest suffix this loop can append, so a name at
        # the 255-char limit still yields a storable variant.
        stem = desired[:200]
        n = 1
        while True:
            candidate = f'{stem} (copy)' if n == 1 else f'{stem} (copy {n})'
            if candidate not in taken:
                return candidate
            n += 1
