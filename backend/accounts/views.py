from django.contrib.auth import authenticate
from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from .serializers import RegisterSerializer, MeSerializer

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
COOKIE_SECURE = False if settings.DEBUG else True
COOKIE_SAMESITE = "Lax" if settings.DEBUG else "None"
COOKIE_PATH = "/"
COOKIE_DOMAIN = None   # set this only if you actually need a shared domain cookie

def set_token_cookie(response, key, value, max_age):
    response.set_cookie(
        key=key,
        value=value,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path=COOKIE_PATH,
        domain=COOKIE_DOMAIN,
        max_age=max_age,
    )


def clear_token_cookie(response, key):
    response.delete_cookie(
        key=key,
        path=COOKIE_PATH,
        domain=COOKIE_DOMAIN,
        samesite=COOKIE_SAMESITE,
    )

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

        set_token_cookie(resp, ACCESS_COOKIE, access, 60 * 30)
        set_token_cookie(resp, REFRESH_COOKIE, str(refresh), 60 * 60 * 24 * 7)

        return resp

class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    def post(self, request):
        token = request.COOKIES.get(REFRESH_COOKIE)

        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass
            except Exception:
                pass

        resp = Response({"message": "Logged out"}, status=status.HTTP_200_OK)
        clear_token_cookie(resp, ACCESS_COOKIE)
        clear_token_cookie(resp, REFRESH_COOKIE)
        return resp
    
class RefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get(REFRESH_COOKIE)
        if not refresh_token:
            return Response({"detail": "No refresh token"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            old_refresh = RefreshToken(refresh_token)

            user_id = old_refresh["user_id"]
            User = get_user_model()
            user = User.objects.get(id=user_id)

            new_refresh = RefreshToken.for_user(user)
            new_access = str(new_refresh.access_token)

            try:
                old_refresh.blacklist()
            except Exception:
                pass

            resp = Response({"message": "Token refreshed"}, status=status.HTTP_200_OK)
            set_token_cookie(resp, ACCESS_COOKIE, new_access, 60 * 30)
            set_token_cookie(resp, REFRESH_COOKIE, str(new_refresh), 60 * 60 * 24 * 7)
            return resp

        except TokenError:
            return Response({"detail": "Invalid refresh token"}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception:
            return Response({"detail": "Error refreshing token"}, status=status.HTTP_401_UNAUTHORIZED)
