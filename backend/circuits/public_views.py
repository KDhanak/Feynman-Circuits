"""Unauthenticated read endpoint backing FC share links.

When someone follows `/?circuit=<id>`, the app fetches the circuit here. The
visitor may have no account at all, which is the whole point of a share link, so
this view carries no authentication.

`authentication_classes = []` is load-bearing, not tidiness: CookieJWTAuthentication
is the project-wide default and it *raises* on an expired token, so leaving the
default in place would 401 any visitor who happens to still be carrying a stale
access_token cookie — on an endpoint that is supposed to need no account at all.
"""

from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle

from .models import Circuit
from .public_serializers import PublicCircuitSerializer


class PublicCircuitDetailView(RetrieveAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = PublicCircuitSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'public_read'

    # Exactly the fields PublicCircuitSerializer publishes. Anything outside this
    # list — `user` above all — is never selected, so the owner is not merely
    # left out of the response, it is never loaded into memory on this path.
    PUBLIC_FIELDS = ('id', 'name', 'ir', 'created_at', 'updated_at')

    def get_queryset(self):
        # 404 rather than 403 for private circuits: a 403 would confirm the id
        # exists, turning this endpoint into an oracle for enumerating circuits.
        return Circuit.objects.filter(is_public=True).only(*self.PUBLIC_FIELDS)
