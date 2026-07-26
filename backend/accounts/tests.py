"""API tests for the accounts app: sign-up, sign-in, session (me/refresh/
sign-out), password change, and the OTP password-reset flow.

These lock the auth contract so it can be refactored (or touched by an
automated agent) with a real safety net. Django's test runner swaps the email
backend for an in-memory one, so the OTP/confirmation emails land in
`mail.outbox` instead of being sent.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.settings import api_settings
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import PasswordResetOTP

User = get_user_model()

# A password that clears every configured Django validator (length, not common,
# not all-numeric, not similar to the user's email/name).
STRONG_PASSWORD = "Str0ngP@ssw0rd!"


def make_user(email="alice@example.com", password=STRONG_PASSWORD, **extra):
    extra.setdefault("first_name", "Alice")
    extra.setdefault("last_name", "Quantum")
    return User.objects.create_user(email=email, password=password, **extra)


class SignUpTests(APITestCase):
    url = "/accounts/api/auth/signup/"

    def test_signup_success_creates_user(self):
        resp = self.client.post(
            self.url,
            {
                "email": "new@example.com",
                "first_name": "New",
                "last_name": "User",
                "password": STRONG_PASSWORD,
                "password2": STRONG_PASSWORD,
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["email"], "new@example.com")
        user = User.objects.get(email="new@example.com")
        # Password must be stored hashed, never in clear text.
        self.assertNotEqual(user.password, STRONG_PASSWORD)
        self.assertTrue(user.check_password(STRONG_PASSWORD))

    def test_signup_password_mismatch_rejected(self):
        resp = self.client.post(
            self.url,
            {
                "email": "mismatch@example.com",
                "first_name": "A",
                "last_name": "B",
                "password": STRONG_PASSWORD,
                "password2": STRONG_PASSWORD + "x",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="mismatch@example.com").exists())

    def test_signup_weak_password_rejected(self):
        resp = self.client.post(
            self.url,
            {
                "email": "weak@example.com",
                "first_name": "A",
                "last_name": "B",
                "password": "123",
                "password2": "123",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_signup_duplicate_email_rejected(self):
        make_user(email="dupe@example.com")
        resp = self.client.post(
            self.url,
            {
                "email": "dupe@example.com",
                "first_name": "A",
                "last_name": "B",
                "password": STRONG_PASSWORD,
                "password2": STRONG_PASSWORD,
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_signup_blank_name_rejected(self):
        resp = self.client.post(
            self.url,
            {
                "email": "noname@example.com",
                "first_name": "",
                "last_name": "",
                "password": STRONG_PASSWORD,
                "password2": STRONG_PASSWORD,
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class SignInTests(APITestCase):
    url = "/accounts/api/auth/signin/"

    def setUp(self):
        self.user = make_user()

    def test_signin_success_sets_cookies(self):
        resp = self.client.post(
            self.url, {"email": self.user.email, "password": STRONG_PASSWORD}
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", resp.cookies)
        self.assertIn("refresh_token", resp.cookies)
        # Access cookie must be HttpOnly so JS can't read it.
        self.assertTrue(resp.cookies["access_token"]["httponly"])

    def test_signin_wrong_password_401(self):
        resp = self.client.post(
            self.url, {"email": self.user.email, "password": "wrong-password"}
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn("access_token", resp.cookies)

    def test_signin_unknown_email_401(self):
        resp = self.client.post(
            self.url, {"email": "ghost@example.com", "password": STRONG_PASSWORD}
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class SessionTests(APITestCase):
    me_url = "/accounts/api/auth/me/"
    refresh_url = "/accounts/api/auth/refresh/"
    signout_url = "/accounts/api/auth/signout/"

    def setUp(self):
        self.user = make_user()

    def _login(self):
        access = str(RefreshToken.for_user(self.user).access_token)
        self.client.cookies["access_token"] = access

    def test_me_requires_authentication(self):
        resp = self.client.get(self.me_url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_current_user(self):
        self._login()
        resp = self.client.get(self.me_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["email"], self.user.email)

    def test_refresh_without_cookie_401(self):
        resp = self.client.post(self.refresh_url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_issues_new_cookies(self):
        refresh = str(RefreshToken.for_user(self.user))
        self.client.cookies["refresh_token"] = refresh
        resp = self.client.post(self.refresh_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", resp.cookies)
        self.assertIn("refresh_token", resp.cookies)

    def test_signout_clears_cookies(self):
        refresh = str(RefreshToken.for_user(self.user))
        self.client.cookies["refresh_token"] = refresh
        resp = self.client.post(self.signout_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # delete_cookie sets the value to empty with an expiry in the past.
        self.assertEqual(resp.cookies["access_token"].value, "")
        self.assertEqual(resp.cookies["refresh_token"].value, "")


class ChangePasswordTests(APITestCase):
    url = "/accounts/api/auth/change-password/"

    def setUp(self):
        self.user = make_user()
        access = str(RefreshToken.for_user(self.user).access_token)
        self.client.cookies["access_token"] = access

    def test_change_password_success(self):
        new_password = "N3wStr0ng!pass"
        resp = self.client.post(
            self.url,
            {
                "current_password": STRONG_PASSWORD,
                "password": new_password,
                "password2": new_password,
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_password))
        self.assertEqual(len(mail.outbox), 1)  # change-notification email

    def test_change_password_wrong_current_rejected(self):
        resp = self.client.post(
            self.url,
            {
                "current_password": "not-my-password",
                "password": "N3wStr0ng!pass",
                "password2": "N3wStr0ng!pass",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(STRONG_PASSWORD))


class PasswordResetFlowTests(APITestCase):
    request_url = "/accounts/api/auth/password-reset/"
    verify_url = "/accounts/api/auth/password-reset/verify-otp/"
    confirm_url = "/accounts/api/auth/password-reset/confirm/"

    def setUp(self):
        # The reset endpoints are rate-limited (password_reset scope, 5/hour)
        # and DRF's throttle counters persist in a cache across test methods.
        # These tests exercise the reset *logic*, not the throttle, so null the
        # rate in place (DRF binds THROTTLE_RATES to this dict at import, so
        # mutating it is what actually reaches the live throttle) and restore it
        # in tearDown. The lockout test also needs >5 requests to run at all.
        cache.clear()
        self._orig_rates = dict(api_settings.DEFAULT_THROTTLE_RATES)
        api_settings.DEFAULT_THROTTLE_RATES["password_reset"] = None
        self.user = make_user()

    def tearDown(self):
        api_settings.DEFAULT_THROTTLE_RATES.clear()
        api_settings.DEFAULT_THROTTLE_RATES.update(self._orig_rates)
        cache.clear()

    def _request_otp(self):
        """Trigger a reset request and return the freshly created OTP object."""
        self.client.post(self.request_url, {"email": self.user.email})
        return PasswordResetOTP.objects.filter(user=self.user, is_used=False).latest(
            "created_at"
        )

    def test_request_creates_otp_and_sends_email(self):
        resp = self.client.post(self.request_url, {"email": self.user.email})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(
            PasswordResetOTP.objects.filter(user=self.user, is_used=False).exists()
        )
        self.assertEqual(len(mail.outbox), 1)

    def test_request_for_unknown_email_is_indistinguishable(self):
        resp = self.client.post(self.request_url, {"email": "ghost@example.com"})
        # Same 200 + generic message, but no OTP and no email — anti-enumeration.
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(PasswordResetOTP.objects.count(), 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_verify_wrong_otp_rejected(self):
        self._request_otp()
        resp = self.client.post(
            self.verify_url, {"email": self.user.email, "otp": "000000"}
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn("reset_token", resp.data)

    def test_verify_correct_otp_returns_reset_token(self):
        otp = self._request_otp()
        resp = self.client.post(
            self.verify_url, {"email": self.user.email, "otp": otp.otp}
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["reset_token"])

    def test_verify_expired_otp_rejected(self):
        otp = self._request_otp()
        otp.expires_at = timezone.now() - timedelta(minutes=1)
        otp.save(update_fields=["expires_at"])
        resp = self.client.post(
            self.verify_url, {"email": self.user.email, "otp": otp.otp}
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_locks_out_after_five_wrong_attempts(self):
        self._request_otp()
        for _ in range(5):
            self.client.post(
                self.verify_url, {"email": self.user.email, "otp": "999999"}
            )
        otp = PasswordResetOTP.objects.get(user=self.user)
        self.assertTrue(otp.is_used)  # burned after the attempt cap

    def test_full_reset_flow_changes_password(self):
        otp = self._request_otp()
        verify = self.client.post(
            self.verify_url, {"email": self.user.email, "otp": otp.otp}
        )
        reset_token = verify.data["reset_token"]

        new_password = "R3setStr0ng!pass"
        confirm = self.client.post(
            self.confirm_url,
            {
                "reset_token": reset_token,
                "password": new_password,
                "password2": new_password,
            },
        )
        self.assertEqual(confirm.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_password))
        # Signing in with the new password now works.
        signin = self.client.post(
            "/accounts/api/auth/signin/",
            {"email": self.user.email, "password": new_password},
        )
        self.assertEqual(signin.status_code, status.HTTP_200_OK)

    def test_confirm_with_invalid_token_rejected(self):
        resp = self.client.post(
            self.confirm_url,
            {
                "reset_token": "not-a-real-token",
                "password": "R3setStr0ng!pass",
                "password2": "R3setStr0ng!pass",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
