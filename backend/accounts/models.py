from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    """Custom manager for creating and managing User instances."""
    
    def create_user(self, email: str, password: str | None = None, **extra_fields):
        
        if not email:
            raise ValueError("Email is required")
        # Normalize email to ensure consistency (lowercase domain)
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

        # Validate that required admin flags are set
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        # Delegate to create_user with admin flags already set
        return self.create_user(email=email, password=password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    
    # Email field - unique identifier for login
    email = models.EmailField(unique=True)
    # Optional user name fields
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)

    # Account status fields
    is_active = models.BooleanField(default=True)  # Can user log in?
    is_staff = models.BooleanField(default=False)  # Can user access admin panel?

    # Timestamp fields for tracking
    created_at = models.DateTimeField(auto_now_add=True)  # Set once at creation
    updated_at = models.DateTimeField(auto_now=True)     # Auto-updates on every save

    # Use custom UserManager for user creation
    objects = UserManager()

    # Use email field instead of username for authentication
    USERNAME_FIELD = "email"
    # Fields required when creating a superuser via manage.py
    REQUIRED_FIELDS: list[str] = []

    def __str__(self):
        """Return email as the string representation of the user."""
        return self.email
