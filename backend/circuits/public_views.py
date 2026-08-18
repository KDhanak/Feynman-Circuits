"""Public, unauthenticated API for cross-platform circuit exchange.

Two directions:

* Inbound — a partner platform POSTs a circuit to /api/v1/handoffs/ and gets back
  an `open_url`. Putting that behind an "Open in Feynman Circuits" button hands
  the circuit over in one click.
* Outbound — anyone may GET a circuit whose owner has marked it public.

Every view here sets `authentication_classes = []`. That is load-bearing, not
tidiness: CookieJWTAuthentication is the project-wide default and it *raises* on
an expired token, so leaving the default in place would 401 any visitor who
happens to still be carrying a stale access_token cookie — on an endpoint that
is supposed to need no account at all.
"""

from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import Circuit, CircuitHandoff
from .public_serializers import (
    CircuitHandoffCreateSerializer,
    CircuitHandoffReadSerializer,
    PublicCircuitSerializer,
)


class PublicAPIView:
    """Shared posture for every endpoint in this module."""

    authentication_classes = []
    permission_classes = [AllowAny]


@extend_schema(
    tags=['handoff'],
    summary='Hand a circuit to Feynman Circuits',
    description=(
        'Park a circuit under a short-lived token and receive a link that opens '
        'it in the Feynman Circuits builder. Point your "Open in Feynman '
        'Circuits" button at the returned `open_url`.\n\n'
        'For small circuits you can skip this call entirely and build a link '
        'directly — see the inline transport in docs/api-v1.md.'
    ),
    request=CircuitHandoffCreateSerializer,
    responses={
        201: OpenApiResponse(description='Handoff created.'),
        400: OpenApiResponse(description='The circuit IR failed validation.'),
        413: OpenApiResponse(description='Request body too large.'),
        429: OpenApiResponse(description='Rate limit exceeded.'),
    },
    examples=[
        OpenApiExample(
            'Bell state',
            value={
                'name': 'Bell State',
                'source': 'quantumcanvas',
                'ir': {
                    'version': '1.0',
                    'registers': {'q': 2, 'c': 0},
                    'qubitLabels': ['Qubit 0', 'Qubit 1'],
                    'operations': [
                        {
                            'kind': 'unitary', 'gate': 'h', 'column': 0,
                            'targets': [0], 'controls': [], 'antiControls': [], 'params': [],
                        },
                        {
                            'kind': 'unitary', 'gate': 'x', 'column': 1,
                            'targets': [1], 'controls': [0], 'antiControls': [], 'params': [],
                        },
                    ],
                },
            },
            request_only=True,
        ),
    ],
)
class CircuitHandoffCreateView(PublicAPIView, APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'circuit_handoff'

    def post(self, request):
        # Check the declared length before touching request.data so an oversized
        # body is rejected without being parsed into memory first.
        declared_length = request.META.get('CONTENT_LENGTH') or 0
        try:
            declared_length = int(declared_length)
        except (TypeError, ValueError):
            declared_length = 0
        if declared_length > settings.MAX_HANDOFF_BODY_BYTES:
            return Response(
                {'detail': (
                    f'Request body exceeds the '
                    f'{settings.MAX_HANDOFF_BODY_BYTES}-byte limit.'
                )},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        serializer = CircuitHandoffCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        handoff = serializer.save()

        # Opportunistic sweep so abandoned handoffs do not accumulate between
        # runs of the purge_expired_handoffs command.
        CircuitHandoff.purge_expired()

        return Response(
            {
                'token': handoff.token,
                'open_url': f'{settings.APP_BASE_URL}/?handoff={handoff.token}',
                'api_url': request.build_absolute_uri(
                    reverse('public-circuit-handoff-detail', args=[handoff.token])
                ),
                'expires_at': handoff.expires_at,
            },
            status=status.HTTP_201_CREATED,
        )


@extend_schema(
    tags=['handoff'],
    summary='Read a parked handoff',
    description=(
        'Fetch the circuit behind a handoff token. Reads do not consume the '
        'token — it stays usable until it expires — so refreshing or reopening '
        'the link keeps working.'
    ),
    responses={
        200: CircuitHandoffReadSerializer,
        404: OpenApiResponse(description='Unknown or expired token.'),
    },
)
class CircuitHandoffDetailView(PublicAPIView, RetrieveAPIView):
    serializer_class = CircuitHandoffReadSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'public_read'
    lookup_field = 'token'

    def get_queryset(self):
        # Filtering on expiry here means an expired handoff 404s naturally,
        # without a separate branch in the view.
        return CircuitHandoff.objects.filter(expires_at__gt=timezone.now())


@extend_schema(
    tags=['circuits'],
    summary='Read a public circuit',
    description=(
        'Fetch a circuit its owner has marked public, as a Circuit IR v1.0 '
        'document. Private circuits are indistinguishable from circuits that do '
        'not exist.'
    ),
    responses={
        200: PublicCircuitSerializer,
        404: OpenApiResponse(description='No public circuit with that id.'),
    },
)
class PublicCircuitDetailView(PublicAPIView, RetrieveAPIView):
    serializer_class = PublicCircuitSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'public_read'

    def get_queryset(self):
        # 404 rather than 403 for private circuits: a 403 would confirm the id
        # exists, turning this endpoint into an oracle for enumerating circuits.
        return Circuit.objects.filter(is_public=True)
