from django.contrib.auth import authenticate
from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import RegisterSerializer, MeSerializer

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        s = RegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = s.save()
        return Response({"id": user.id, "email": user.email}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        user = authenticate(request, email=email, password=password)
        if user is None:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        access = str(refresh.access_token)

        resp = Response({"message": "Login successful"}, status=status.HTTP_200_OK)

        # 30 min access token cookie
        resp.set_cookie(
            key=ACCESS_COOKIE,
            value=access,
            httponly=True,
            secure=False if settings.DEBUG else True,     # True in production (HTTPS)
            samesite="Lax" if settings.DEBUG else "None",  # "None" in production
            max_age=60 * 30,
        )

        # 7 day refresh token cookie
        resp.set_cookie(
            key=REFRESH_COOKIE,
            value=str(refresh),
            httponly=True,
            secure=False if settings.DEBUG else True,     # True in production (HTTPS)
            samesite="Lax" if settings.DEBUG else "None",  # "None" in production
            max_age=60 * 60 * 24 * 7,
        )

        return resp


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    def post(self, request):
        resp = Response({"message": "Logged out"}, status=status.HTTP_200_OK)
        resp.delete_cookie(ACCESS_COOKIE)
        resp.delete_cookie(REFRESH_COOKIE)
        return resp
    
class RefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.COOKIES.get("refresh_token")
        if not token:
            return Response({"detail": "No refresh token"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            refresh = RefreshToken(token)
            access = str(refresh.access_token)
        except Exception:
            return Response({"detail": "Invalid refresh token"}, status=status.HTTP_401_UNAUTHORIZED)

        resp = Response({"message": "refreshed"}, status=status.HTTP_200_OK)
        resp.set_cookie(
            key=ACCESS_COOKIE,
            value=access,
            httponly=True,
            secure=False if settings.DEBUG else True,     # True in production (HTTPS)
            samesite="Lax" if settings.DEBUG else "None",  # "None" in production
            max_age=60 * 30,
        )
        return resp
