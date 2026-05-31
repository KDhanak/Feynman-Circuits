from django.urls import path
from .views import CircuitViewSet

urlpatterns = [
    path(
        "api/circuits/",
        CircuitViewSet.as_view({'get': 'list', 'post': 'create'}),
        name="circuit-list"
    ),
    path(
        "api/circuits/<uuid:pk>/",
        CircuitViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}),
        name="circuit-detail"
    ),
]
