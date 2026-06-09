from rest_framework import status
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated

from accounts.authentication import CookieJWTAuthentication
from .models import Circuit
from .serializers import CircuitListSerializer, CircuitDetailSerializer


class CircuitViewSet(ModelViewSet):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Circuit.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'list':
            return CircuitListSerializer
        return CircuitDetailSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)

        # Try to find an existing circuit owned by this user
        queryset = Circuit.objects.filter(id=self.kwargs['pk'], user=request.user)
        instance = queryset.first()

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        if instance is None:
            # First save for this circuit — create it with the client-generated UUID
            Circuit.objects.create(
                id=self.kwargs['pk'],
                user=request.user,
                name=serializer.validated_data.get('name', 'Untitled Circuit'),
                ir=serializer.validated_data.get('ir'),
                description=serializer.validated_data.get('description', ''),
                is_public=serializer.validated_data.get('is_public', False),
            )
            circuit = Circuit.objects.get(id=self.kwargs['pk'])
            return Response(self.get_serializer(circuit).data, status=status.HTTP_201_CREATED)

        serializer.save(user=request.user)
        return Response(serializer.data)

    def next_name(self, request):
        name = Circuit.next_untitled_name(request.user)
        return Response({'name': name})
