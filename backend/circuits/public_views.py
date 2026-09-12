"""Read endpoint behind FC share links. No login needed.

When someone opens `/?circuit=<id>`, the app loads the circuit from here. The
visitor may have no account at all, which is the whole point of a share link,
so this view has no authentication.

`authentication_classes = []` is really needed here, it is not just for
neatness. CookieJWTAuthentication is the default for the whole project and it
*raises an error* on an expired token. If we kept the default, any visitor who
still has an old access_token cookie would get a 401, on an endpoint that is
meant to need no account at all.
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

    # Only the fields that PublicCircuitSerializer shows. Anything not in this
    # list, and most of all `user`, is never loaded. So the owner is not just
    # left out of the response, it is never even loaded into memory here.
    PUBLIC_FIELDS = ('id', 'name', 'ir', 'created_at', 'updated_at')

    def get_queryset(self):
        # Return 404 instead of 403 for private circuits. A 403 would tell people
        # the id exists, which would let them use this endpoint to guess ids and find circuits.
        return Circuit.objects.filter(is_public=True).only(*self.PUBLIC_FIELDS)
