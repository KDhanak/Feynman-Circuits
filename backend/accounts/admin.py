from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    
    # Sort users by email in the admin list view
    ordering = ("email",)
    
    # Display these columns in the user list view
    list_display = ("email", "first_name", "last_name", "is_staff", "is_active")
    
    # Allow admins to search users by these fields
    search_fields = ("email", "first_name", "last_name")

    # Organize fields into sections when viewing/editing an existing user
    fieldsets = (
        # Basic authentication section
        (None, {"fields": ("email", "password")}),
        # User's personal information section
        ("Personal info", {"fields": ("first_name", "last_name")}),
        # User roles and permissions section
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        # Track when user last logged in
        ("Important dates", {"fields": ("last_login",)}),
    )

    # Organize fields into sections when creating a new user
    add_fieldsets = (
        (None, {
            # Use wider form layout for better usability when adding users
            "classes": ("wide",),
            # Fields shown on the "Add User" form
            # Note: password1 and password2 are for password confirmation
            "fields": ("email", "first_name", "last_name", "password1", "password2", "is_staff", "is_active"),
        }),
    )

    # Use a side-by-side selection widget for many-to-many fields (groups and permissions)
    # instead of a standard dropdown, making it easier to manage multiple selections
    filter_horizontal = ("groups", "user_permissions")
