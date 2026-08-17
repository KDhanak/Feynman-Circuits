"""URLs for the public /api/v1/ namespace.

Mounted at the project root rather than under /circuits/ so the published paths
read as a product-level API (/api/v1/circuits/<id>/) instead of leaking the
Django app layout. The internal, cookie-authenticated routes in urls.py are
untouched and keep their existing paths.
"""

from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from .public_views import (
    CircuitImportCreateView,
    CircuitImportDetailView,
    PublicCircuitDetailView,
)

urlpatterns = [
    path(
        "circuits/<uuid:pk>/",
        PublicCircuitDetailView.as_view(),
        name="public-circuit-detail",
    ),
    path(
        "imports/",
        CircuitImportCreateView.as_view(),
        name="public-circuit-import-create",
    ),
    path(
        "imports/<str:token>/",
        CircuitImportDetailView.as_view(),
        name="public-circuit-import-detail",
    ),
    path("schema/", SpectacularAPIView.as_view(), name="public-schema"),
    path(
        "docs/",
        SpectacularSwaggerView.as_view(url_name="public-schema"),
        name="public-docs",
    ),
]
