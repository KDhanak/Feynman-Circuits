from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from datetime import timedelta
from django.utils import timezone
import secrets


class UserManager(BaseUserManager):
    """Our own manager for creating users."""

    def create_user(self, email: str, password: str | None = None, **extra_fields):

        if not email:
            raise ValueError("Email is required")
        # Clean up the email so it is always stored the same way (domain in lowercase)
        email = self.normalize_email(email)

        # Create user instance with email and any additional fields
        user = self.model(email=email, **extra_fields)
        # Hash the password securely
        user.set_password(password)
        # Save to database
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str | None = None, **extra_fields):

        # Set default values for admin flags
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        # Make sure the needed admin flags are set
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        # Let create_user do the rest, with the admin flags already set
        return self.create_user(email=email, password=password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):

    # Email field. Every user has a different email, and it is used to log in
    email = models.EmailField(unique=True)
    # Optional user name fields
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)

    # Account status fields
    is_active = models.BooleanField(default=True)  # Can user log in?
    is_staff = models.BooleanField(default=False)  # Can user access admin panel?

    # Timestamp fields for tracking
    created_at = models.DateTimeField(auto_now_add=True)  # Set once at creation
    updated_at = models.DateTimeField(auto_now=True)  # Auto-updates on every save

    # Use our own UserManager to create users
    objects = UserManager()

    # Use email field instead of username for authentication
    USERNAME_FIELD = "email"
    # Fields asked for when creating a superuser with manage.py
    REQUIRED_FIELDS: list[str] = []

    def __str__(self):
        """Return email as the string representation of the user."""
        return self.email


class PasswordResetOTP(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="password_reset_otps"
    )
    otp = models.CharField(max_length=6)
    reset_token = models.CharField(max_length=128, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveIntegerField(default=0)

    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    @staticmethod
    def get_expiry_time():
        return timezone.now() + timedelta(minutes=10)

    @staticmethod
    def generate_reset_token():
        return secrets.token_urlsafe(32)

    def __str__(self):
        return f"Password reset OTP for {self.user.email}"
