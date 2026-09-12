from django.contrib.auth import authenticate, get_user_model
from django.conf import settings
from .models import PasswordResetOTP
from rest_framework import permissions, status
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from .serializers import (
    SignUpSerializer,
    SignInSerializer,
    MeSerializer,
    UpdateProfileSerializer,
    ChangePasswordSerializer,
    PasswordResetRequestSerializer,
    PasswordResetOTPVerifySerializer,
    PasswordResetConfirmSerializer,
)
import secrets
from .services import send_password_reset_otp_email, send_password_reset_confirmation_email, send_password_change_notification_email, send_feedback_email

User = get_user_model()

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
COOKIE_SECURE = False if settings.DEBUG else True
COOKIE_SAMESITE = "Lax" if settings.DEBUG else "None"
COOKIE_PATH = "/"
COOKIE_DOMAIN = None  # only set this if you really need one cookie shared across several domains


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


class SignUpView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        s = SignUpSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = s.save()
        return Response(
            {"id": user.id, "email": user.email}, status=status.HTTP_201_CREATED
        )


class SignInView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SignInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]

        user = authenticate(request, email=email, password=password)
        if user is None:
            return Response(
                {"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
            )

        refresh = RefreshToken.for_user(user)
        access = str(refresh.access_token)

        resp = Response({"message": "Sign in successful"}, status=status.HTTP_200_OK)

        set_token_cookie(resp, ACCESS_COOKIE, access, 60 * 30)
        set_token_cookie(resp, REFRESH_COOKIE, str(refresh), 60 * 60 * 24 * 7)

        return resp


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data, status=status.HTTP_200_OK)


class SignOutView(APIView):
    def post(self, request):
        token = request.COOKIES.get(REFRESH_COOKIE)

        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass
            except Exception:
                pass

        resp = Response({"message": "Signed out"}, status=status.HTTP_200_OK)
        clear_token_cookie(resp, ACCESS_COOKIE)
        clear_token_cookie(resp, REFRESH_COOKIE)
        return resp


class RefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get(REFRESH_COOKIE)
        if not refresh_token:
            return Response(
                {"detail": "No refresh token"}, status=status.HTTP_401_UNAUTHORIZED
            )

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
            return Response(
                {"detail": "Invalid refresh token"}, status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception:
            return Response(
                {"detail": "Error refreshing token"},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class UpdateProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        serializer = UpdateProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MeSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not request.user.check_password(serializer.validated_data['current_password']):
            return Response(
                {'current_password': 'Current password is incorrect.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(serializer.validated_data['password'])
        request.user.save(update_fields=['password'])
        send_password_change_notification_email(request.user.email)
        return Response({'detail': 'Password changed successfully.'})


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        user = User.objects.filter(email=email, is_active=True).first()

        # Always return the same response, whether user exists or not
        success_response = {
            "detail": "If an account exists for this email, an OTP has been sent."
        }

        if not user:
            return Response(success_response, status=status.HTTP_200_OK)

        # Cancel any older OTPs for this user that were never used
        PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)

        otp = f"{secrets.randbelow(1_000_000):06d}"

        PasswordResetOTP.objects.create(
            user=user, otp=otp, expires_at=PasswordResetOTP.get_expiry_time()
        )

        send_password_reset_otp_email(email, otp, expiry_minutes=10)

        return Response(success_response, status=status.HTTP_200_OK)


class PasswordResetOTPVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetOTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        otp = serializer.validated_data["otp"]

        user = User.objects.filter(email=email, is_active=True).first()
        if not user:
            return Response(
                {"detail": "Invalid email or OTP."}, status=status.HTTP_400_BAD_REQUEST
            )

        otp_record = (
            PasswordResetOTP.objects.filter(user=user, is_used=False)
            .order_by("-created_at")
            .first()
        )

        if not otp_record:
            return Response(
                {"detail": "Invalid email or OTP."}, status=status.HTTP_400_BAD_REQUEST
            )

        if otp_record.is_expired():
            otp_record.is_used = True
            otp_record.save(update_fields=["is_used"])
            return Response(
                {"detail": "OTP has expired."}, status=status.HTTP_400_BAD_REQUEST
            )

        if otp_record.otp != otp:
            otp_record.attempts += 1

            if otp_record.attempts >= 5:
                otp_record.is_used = True
                otp_record.save(update_fields=["attempts", "is_used"])
                return Response(
                    {"detail": "OTP has expired or is no longer valid."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            otp_record.save(update_fields=["attempts"])
            return Response(
                {"detail": "Invalid email or OTP."}, status=status.HTTP_400_BAD_REQUEST
            )

        otp_record.reset_token = PasswordResetOTP.generate_reset_token()
        otp_record.expires_at = PasswordResetOTP.get_expiry_time()
        otp_record.save(update_fields=["reset_token", "expires_at"])

        return Response(
            {
                "detail": "OTP verified successfully.",
                "reset_token": otp_record.reset_token,
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reset_token = serializer.validated_data["reset_token"]
        password = serializer.validated_data["password"]

        otp_record = (
            PasswordResetOTP.objects.filter(reset_token=reset_token, is_used=False)
            .order_by("-created_at")
            .first()
        )

        if not otp_record:
            return Response(
                {"detail": "Invalid or expired reset token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp_record.is_expired():
            otp_record.is_used = True
            otp_record.save(update_fields=["is_used"])
            return Response(
                {"detail": "Reset token has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = otp_record.user
        user.set_password(password)
        user.save(update_fields=["password"])

        otp_record.is_used = True
        otp_record.reset_token = None
        otp_record.save(update_fields=["is_used", "reset_token"])
        
        send_password_reset_confirmation_email(user.email)

        return Response(
            {"detail": "Password reset successful."}, status=status.HTTP_200_OK
        )


class FeedbackView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "feedback"

    def post(self, request):
        feedback_type = request.data.get("type", "").strip()
        if feedback_type not in ("bug", "feature"):
            return Response({"detail": "Invalid feedback type."}, status=status.HTTP_400_BAD_REQUEST)

        area = request.data.get("area", "").strip()
        description = request.data.get("description", "").strip()

        if not area or not description:
            return Response({"detail": "Area and description are required."}, status=status.HTTP_400_BAD_REQUEST)

        if len(description) > 2000 or len(area) > 100:
            return Response({"detail": "Input too long."}, status=status.HTTP_400_BAD_REQUEST)

        context = {
            "type": feedback_type,
            "area": area,
            "description": description,
            "expected": request.data.get("expected", "").strip()[:2000],
            "actual": request.data.get("actual", "").strip()[:2000],
            "impact": request.data.get("impact", "").strip()[:2000],
            "extra": request.data.get("extra", "").strip()[:2000],
            "name": request.data.get("name", "").strip()[:100],
            "email": request.data.get("email", "").strip()[:254],
        }

        send_feedback_email(context)
        return Response({"detail": "Feedback received. Thank you!"}, status=status.HTTP_200_OK)
