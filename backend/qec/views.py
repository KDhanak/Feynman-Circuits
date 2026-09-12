"""Endpoints for the QEC experiment.

Nothing here reads or writes the database. A run only depends on (rounds,
errors). We use POST only because the request data is too complex to fit
nicely in a URL query string.
"""

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import experiment, layout
from .experiment import InjectedError
from .serializers import ErrorRateRequestSerializer, QecRequestSerializer


class LayoutView(APIView):
    """Returns the lattice. The frontend uses this to check that its copy matches ours."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(layout.to_dict())


class RunView(APIView):
    """One exact run: place the errors, measure, then decode."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "qec_run"

    def post(self, request):
        serializer = QecRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        errors = [InjectedError(**e) for e in data["errors"]]
        return Response(experiment.run(data["rounds"], errors))


class ErrorRateView(APIView):
    """Runs many shots at a fixed noise level to see how often the decoder fails."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "qec_run"

    def post(self, request):
        serializer = ErrorRateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        return Response(experiment.logical_error_rate(d["rounds"], d["noise"], d["shots"]))
