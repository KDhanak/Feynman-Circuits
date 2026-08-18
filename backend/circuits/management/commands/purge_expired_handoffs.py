"""Delete handoff payloads past their expiry.

Creating a handoff already sweeps a small batch opportunistically, which keeps
the table flat under normal traffic. This command is the backstop: run it on a
schedule (or by hand after a burst) to guarantee nothing lingers.
"""

from django.core.management.base import BaseCommand

from circuits.models import CircuitHandoff


class Command(BaseCommand):
    help = "Delete expired circuit handoff payloads."

    def handle(self, *args, **options):
        deleted = CircuitHandoff.purge_expired()
        self.stdout.write(self.style.SUCCESS(f"Purged {deleted} expired circuit import(s)."))
