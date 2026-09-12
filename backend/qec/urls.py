from django.urls import path

from .views import ErrorRateView, LayoutView, RunView

urlpatterns = [
    path("api/qec/layout/", LayoutView.as_view(), name="qec-layout"),
    path("api/qec/run/", RunView.as_view(), name="qec-run"),
    path("api/qec/error-rate/", ErrorRateView.as_view(), name="qec-error-rate"),
]
