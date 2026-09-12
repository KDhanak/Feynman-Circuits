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
    """Split the circuits list into pages, so the response does not keep growing
    as users save more circuits. Clients read `results`/`next`. A caller can ask
    for a smaller page with `?page_size=` (up to max_page_size)."""
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
        """Create or update a circuit, using a UUID made by the client.

        The client makes the id itself (`crypto.randomUUID()`), so a PUT to an id
        we don't have yet is the normal way new circuits get created. Because of
        this, "none of your circuits has this id" can mean two different things,
        and each one needs different handling:

        * Nobody has this id yet: this is a real first save. Create it as asked.
        * Someone else has this id: the user is saving a circuit that was shared
          with them, and the id belongs to the sender. Saving under that id would
          clash with the sender's row, so instead the user gets their own copy
          with a new id. The response tells the client which id to use from now
          on.
        """
        partial = kwargs.pop('partial', False)
        pk = self.kwargs['pk']

        instance = Circuit.objects.filter(id=pk, user=request.user).first()
        owned_by_someone_else = instance is None and Circuit.objects.filter(pk=pk).exists()

        if owned_by_someone_else and partial:
            # PATCH only sends the fields being changed, which is not enough to
            # copy a circuit. And changing part of a circuit you don't own makes no
            # sense anyway. We return 404 instead of 403 so this matches the public
            # endpoint and does not reveal that the id exists.
            raise Http404

        data = request.data
        if owned_by_someone_else:
            # Each user's circuit names must all be different, so the copy cannot
            # just use the sender's name. Pick a free name before validation,
            # because validation would otherwise reject the repeated name.
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
                # A copy always starts private. Making it public is the new owner's choice.
                is_public=False if owned_by_someone_else
                else serializer.validated_data.get('is_public', False),
            )
            return Response(self.get_serializer(circuit).data, status=status.HTTP_201_CREATED)

        serializer.save(user=request.user)
        return Response(serializer.data)

    def next_name(self, request):
        name = Circuit.next_untitled_name(request.user)
        return Response({'name': name})
