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
        """Returns `desired`, or the closest free version of that name, for this user.

        Each user's circuit names must all be different. But saving a circuit
        someone shared with you should not fail just because you already have one
        called "Bell". Instead it becomes "Bell (copy)", then "Bell (copy 2)", and
        so on.
        """
        desired = (desired or '').strip() or 'Untitled Circuit'
        taken = set(cls.objects.filter(user=user).values_list('name', flat=True))
        if desired not in taken:
            return desired

        # Leave room for the longest ending this loop can add, so that even a
        # name at the 255-character limit still gives a name we can save.
        stem = desired[:200]
        n = 1
        while True:
            candidate = f'{stem} (copy)' if n == 1 else f'{stem} (copy {n})'
            if candidate not in taken:
                return candidate
            n += 1
