"""drf-spectacular preprocessing hooks."""


def public_endpoints_only(endpoints, **kwargs):
    """Restrict the generated OpenAPI document to the public /api/v1/ namespace.

    Without this the schema would also advertise the cookie-authenticated
    circuit and account endpoints, which are an internal contract between this
    backend and its own frontend — free to change without notice, and not
    something a partner should build against.
    """
    return [
        (path, path_regex, method, callback)
        for path, path_regex, method, callback in endpoints
        if path.startswith("/api/v1/")
    ]
