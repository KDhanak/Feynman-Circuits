"""Route behind FC share links. No login needed.

It sits at the project root instead of under /circuits/, so the public path
looks like a product URL (/api/v1/circuits/<id>/) and does not show how our
Django apps are organised. The internal routes in urls.py (which use the
login cookie) are not changed and keep their paths.
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
