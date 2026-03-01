from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .serializers import RegisterSerializer

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        s = RegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = s.save()
        return Response({"id": user.id, "email": user.email}, status=status.HTTP_201_CREATED)
