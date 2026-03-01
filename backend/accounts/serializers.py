from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

# Get the custom User model (allows flexibility if User model is changed)
User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    
    # Password field - accepts input but doesn't return it in responses
    password = serializers.CharField(write_only=True)
    # Confirmation password field - used to verify password matches
    password2 = serializers.CharField(write_only=True)

    class Meta:
        # Use the User model for this serializer
        model = User
        # Fields that can be provided during registration
        fields = ["email", "first_name", "last_name", "password", "password2"]

    def validate(self, attrs):

        # Check if password and password2 match
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        
        # Validate password strength using Django's built-in validator
        # (checks length, complexity, common words, etc.)
        validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):

        # Remove password2 since we only need one password to create the user
        validated_data.pop("password2")
        
        # Extract password before passing to create_user
        password = validated_data.pop("password")
        
        # Create user using our custom create_user() method from UserManager
        # This automatically hashes the password
        user = User.objects.create_user(password=password, **validated_data)
        return user
