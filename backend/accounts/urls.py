from django.urls import path
from .views import (
    PasswordResetConfirmView,
    PasswordResetOTPVerifyView,
    PasswordResetRequestView,
    SignOutView,
    MeView,
    SignUpView,
    SignInView,
    RefreshView,
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("api/auth/signup/", SignUpView.as_view()),
    path("api/auth/signin/", SignInView.as_view()),
    path("api/auth/me/", MeView.as_view()),
    path("api/auth/refresh/", RefreshView.as_view()),
    path("api/auth/signout/", SignOutView.as_view()),
    path("api/auth/password-reset/", PasswordResetRequestView.as_view()),
    path("api/auth/password-reset/verify-otp/", PasswordResetOTPVerifyView.as_view()),
    path("api/auth/password-reset/confirm/", PasswordResetConfirmView.as_view()),
]

urlpatterns += [
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]
