"""Unauthenticated route backing FC share links.

Mounted at the project root rather than under /circuits/ so the published path
reads as a product-level URL (/api/v1/circuits/<id>/) instead of leaking the
Django app layout. The internal, cookie-authenticated routes in urls.py are
untouched and keep their existing paths.
"""

from django.urls import path

from .public_views import PublicCircuitDetailView

urlpatterns = [
    path(
        "circuits/<uuid:pk>/",
        PublicCircuitDetailView.as_view(),
        name="public-circuit-detail",
    ),
]
