import uuid

from django.http import Http404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination

from accounts.authentication import CookieJWTAuthentication
from .models import Circuit
from .serializers import CircuitListSerializer, CircuitDetailSerializer


class CircuitPagination(PageNumberPagination):
    """Paginate the circuits list so the payload stays bounded as users
    accumulate circuits. Clients read `results`/`next`; `?page_size=` lets a
    caller request a smaller page (capped at max_page_size)."""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class CircuitViewSet(ModelViewSet):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    pagination_class = CircuitPagination

    def get_queryset(self):
        return Circuit.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'list':
            return CircuitListSerializer
        return CircuitDetailSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def update(self, request, *args, **kwargs):
        """Upsert a circuit under a client-generated UUID.

        The client mints the id (`crypto.randomUUID()`), so a PUT to an id we do
        not hold is the normal way circuits get created. That makes "no circuit
        with this id belongs to you" ambiguous, and the two readings need
        opposite handling:

        * Nobody holds the id — a genuine first save. Create it as asked.
        * Somebody else holds it — the user is saving a circuit that was shared
          with them, whose id belongs to the sender. Inserting under that id
          would collide with the sender's row, so they get their own copy under
          a fresh id instead, and the response tells the client which id to use
          from now on.
        """
        partial = kwargs.pop('partial', False)
        pk = self.kwargs['pk']

        instance = Circuit.objects.filter(id=pk, user=request.user).first()
        owned_by_someone_else = instance is None and Circuit.objects.filter(pk=pk).exists()

        if owned_by_someone_else and partial:
            # PATCH carries only the fields being changed, which is not enough to
            # copy a circuit from — and a partial edit of a circuit you do not
            # own is meaningless anyway. 404 rather than 403 so this matches the
            # public endpoint and does not confirm the id exists.
            raise Http404

        data = request.data
        if owned_by_someone_else:
            # Names are unique per user, so the copy cannot simply reuse the
            # sender's. Resolve before validation, which would otherwise reject
            # the duplicate.
            data = {
                **data,
                'name': Circuit.available_name(request.user, data.get('name')),
            }

        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)

        if instance is None:
            circuit = Circuit.objects.create(
                id=uuid.uuid4() if owned_by_someone_else else pk,
                user=request.user,
                name=serializer.validated_data.get('name', 'Untitled Circuit'),
                ir=serializer.validated_data.get('ir'),
                description=serializer.validated_data.get('description', ''),
                # A copy is never born public; publishing is the new owner's call.
                is_public=False if owned_by_someone_else
                else serializer.validated_data.get('is_public', False),
            )
            return Response(self.get_serializer(circuit).data, status=status.HTTP_201_CREATED)

        serializer.save(user=request.user)
        return Response(serializer.data)

    def next_name(self, request):
        name = Circuit.next_untitled_name(request.user)
        return Response({'name': name})
