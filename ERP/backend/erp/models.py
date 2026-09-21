from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):

    class UserType(models.TextChoices):
        PRODUCTION = "production", "Production"
        ADMIN = "admin", "Admin"
        HR = "hr", "HR"
        MATERIAL_PLANNING = "material-planning", "Material Planning"
        SUPERVISOR = "supervisor", "Supervisor"
        ACCOUNTS = "accounts", "Accounts"

    user_type = models.CharField(
        max_length=30,
        choices=UserType.choices,
        default=UserType.PRODUCTION,
    )

    def __str__(self):
        return f"{self.username} - {self.get_user_type_display()}"


class UserProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )

    profile_photo = models.ImageField(
        upload_to="profile_photos/",
        blank=True,
        null=True,
    )

    employee_id = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True,
    )

    phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
    )

    joining_date = models.DateField(
        blank=True,
        null=True,
    )

    role = models.CharField(
        max_length=100,
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.user.username} Profile"