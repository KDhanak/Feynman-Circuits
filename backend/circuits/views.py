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
        pk = kwargs.get('pk')
        circuit, created = Circuit.objects.update_or_create(
            id=pk,
            user=request.user,
            defaults={
                'name': request.data.get('name', 'Untitled Circuit'),
                'ir': request.data.get('ir'),
                'description': request.data.get('description', ''),
                'is_public': request.data.get('is_public', False),
            }
        )
        serializer = self.get_serializer(circuit)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serializer.data, status=status_code)
