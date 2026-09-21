from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=128)
    password = serializers.CharField(write_only=True)
    user_type = serializers.ChoiceField(
        choices=User.UserType.choices
    )

    def validate(self, attrs):
        username = attrs["username"].strip()
        password = attrs["password"]
        user_type = attrs["user_type"]

        user = authenticate(
            username=username,
            password=password,
        )

        if user is None:
            raise serializers.ValidationError(
                "Invalid username or password."
            )

        if not user.is_active:
            raise serializers.ValidationError(
                "Your account is inactive."
            )

        if user.user_type != user_type:
            raise serializers.ValidationError(
                "You are not authorized for this department."
            )

        attrs["user"] = user

        return attrs