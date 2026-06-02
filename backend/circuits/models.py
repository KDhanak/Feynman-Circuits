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
