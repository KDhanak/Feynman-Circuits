"""
ASGI settings for the config project.

It makes the ASGI app available as a top-level variable named ``application``.

To learn more about this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_asgi_application()
