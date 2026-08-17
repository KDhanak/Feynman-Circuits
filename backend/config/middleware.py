"""Middleware for the public /api/v1/ namespace."""

from django.http import HttpResponse

PUBLIC_API_PREFIX = "/api/v1/"


class PublicApiCorsMiddleware:
    """Serve `Access-Control-Allow-Origin: *` on the public API.

    django-cors-headers handles the rest of the site, where requests carry the
    session cookie and the allowed origins are an explicit list. That model
    cannot express "open to everyone": the browser refuses to honour `*`
    together with credentials, so the public namespace needs its own headers and
    is excluded from django-cors-headers via CORS_URLS_REGEX in settings.

    Keeping the two strictly disjoint also avoids emitting two
    Access-Control-Allow-Origin headers on one response, which browsers treat as
    a CORS failure rather than picking one.
    """

    ALLOWED_METHODS = "GET, POST, OPTIONS"
    ALLOWED_HEADERS = "content-type"
    # Preflight result cache, in seconds. Saves a round-trip per partner client.
    MAX_AGE = "86400"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path.startswith(PUBLIC_API_PREFIX):
            return self.get_response(request)

        # Answer the preflight here rather than letting it fall through to a
        # view: the public endpoints only allow GET/POST, so an OPTIONS would
        # otherwise 405 and the real request would never be sent.
        if request.method == "OPTIONS":
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)

        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = self.ALLOWED_METHODS
        response["Access-Control-Allow-Headers"] = self.ALLOWED_HEADERS
        response["Access-Control-Max-Age"] = self.MAX_AGE
        # Responses vary by nothing origin-specific, but say so explicitly so
        # shared caches never serve a credentialed response from elsewhere here.
        response["Vary"] = "Origin"
        return response
