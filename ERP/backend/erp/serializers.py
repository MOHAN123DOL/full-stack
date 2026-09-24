from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User

#for login 
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


#for developtment only

from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import UserProfile

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all()
    )

    class Meta:
        model = UserProfile
        fields = [
            "id",
            "user",
            "profile_photo",
            "employee_id",
            "phone",
            "joining_date",
            "role",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]



# ============================================================
# PROFILE SERIALIZER
# ============================================================
class ProfileSerializer(serializers.ModelSerializer):

    accountId = serializers.IntegerField(
        source="id",
        read_only=True,
    )

    username = serializers.CharField(
        read_only=True,
    )

    email = serializers.EmailField(
        read_only=True,
    )

    department = serializers.CharField(
        source="user_type",
        read_only=True,
    )

    lastLogin = serializers.DateTimeField(
        source="last_login",
        read_only=True,
    )

    phone = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    employeeId = serializers.SerializerMethodField()
    joiningDate = serializers.SerializerMethodField()
    profilePhoto = serializers.SerializerMethodField()

    class Meta:
        model = User

        fields = [
            "accountId",
            "username",
            "email",
            "profilePhoto",
            "phone",
            "role",
            "department",
            "employeeId",
            "joiningDate",
            "lastLogin",
        ]

    def get_phone(self, obj):
        try:
            return obj.profile.phone
        except UserProfile.DoesNotExist:
            return None

    def get_role(self, obj):
        try:
            return obj.profile.role
        except UserProfile.DoesNotExist:
            return None

    def get_employeeId(self, obj):
        try:
            return obj.profile.employee_id
        except UserProfile.DoesNotExist:
            return None

    def get_joiningDate(self, obj):
        try:
            return obj.profile.joining_date
        except UserProfile.DoesNotExist:
            return None

    def get_profilePhoto(self, obj):
        try:
            profile = obj.profile

            if not profile.profile_photo:
                return None

            request = self.context.get("request")

            if request:
                return request.build_absolute_uri(
                    profile.profile_photo.url
                )

            return profile.profile_photo.url

        except UserProfile.DoesNotExist:
            return None
# ============================================================
# CHANGE PASSWORD SERIALIZER
# ============================================================

import re

from rest_framework import serializers


class ChangePasswordSerializer(serializers.Serializer):
    oldPassword = serializers.CharField(
        write_only=True,
        required=True,
    )

    newPassword = serializers.CharField(
        write_only=True,
        required=True,
        min_length=8,
        max_length=32,
    )

    confirmPassword = serializers.CharField(
        write_only=True,
        required=True,
        min_length=8,
        max_length=32,
    )

    def validate(self, attrs):
        user = self.context["request"].user

        old_password = attrs["oldPassword"]
        new_password = attrs["newPassword"]
        confirm_password = attrs["confirmPassword"]

        # Check current password
        if not user.check_password(old_password):
            raise serializers.ValidationError({
                "oldPassword": "Current password is incorrect."
            })

        # Confirm password
        if new_password != confirm_password:
            raise serializers.ValidationError({
                "confirmPassword": (
                    "New password and confirm password do not match."
                )
            })

        # Prevent same password
        if old_password == new_password:
            raise serializers.ValidationError({
                "newPassword": (
                    "New password must be different "
                    "from the current password."
                )
            })

        # At least one uppercase
        if not re.search(r"[A-Z]", new_password):
            raise serializers.ValidationError({
                "newPassword": (
                    "Password must contain at least "
                    "one uppercase letter."
                )
            })

        # At least one lowercase
        if not re.search(r"[a-z]", new_password):
            raise serializers.ValidationError({
                "newPassword": (
                    "Password must contain at least "
                    "one lowercase letter."
                )
            })

        # At least one number
        if not re.search(r"[0-9]", new_password):
            raise serializers.ValidationError({
                "newPassword": (
                    "Password must contain at least "
                    "one number."
                )
            })

        # At least one special character
        if not re.search(r"[^A-Za-z0-9]", new_password):
            raise serializers.ValidationError({
                "newPassword": (
                    "Password must contain at least "
                    "one special character."
                )
            })

        return attrs


#accounts

from rest_framework import serializers

from .models import PurchaseOrder
from rest_framework import serializers

from .models import PurchaseOrder


class PurchaseOrderSerializer(serializers.ModelSerializer):

    created_by_name = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )

    created_by_type = serializers.CharField(
        source="created_by.user_type",
        read_only=True,
    )

    class Meta:
        model = PurchaseOrder

        fields = [
            "id",

            "po_number",
            "po_date",
            "ref_quote_number",
            "ref_date",
            "subject",
            "prepared_by",

            "vendor",

            "intro_text",

            "items",
            "columns",

            "include_amount_details",
            "subtotal",
            "gst_percent",
            "gst_amount",
            "grand_total",

            "delivery",
            "payment",
            "terms",
            "notes",
            "signatures",

            "document_data",

            "status",
             "pdf_file",

            "created_by",
            "created_by_name",
            "created_by_type",

            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "po_number",
            "created_by",
            "created_by_name",
            "created_by_type",
            "created_at",
            "updated_at",
             "pdf_file",
        ]

#customer detial for all form
from rest_framework import serializers
from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):

    class Meta:
        model = Customer

        fields = [
            "id",
            "company_name",
            "address",
            "contact_person",
            "phone",
            "email",
            "gst_number",
            "source",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "source",
            "created_at",
            "updated_at",
        ]

from rest_framework import serializers

from .models import Quotation, Customer
class QuotationSerializer(serializers.ModelSerializer):

    customer_id = serializers.PrimaryKeyRelatedField(
        source="customer",
        queryset=Customer.objects.all(),
        write_only=True,
    )

    customer = serializers.SerializerMethodField(
        read_only=True,
    )

    class Meta:
        model = Quotation

        fields = [
            "id",
            "quotation_number",
            "quotation_date",

            "customer_id",
            "customer",

            "subject",
            "intro",

            "items",
            "technical_details",
            "terms",
            "signatures",

            "company_name",
            "designation",

            "subtotal",
            "gst_percent",
            "gst_amount",
            "grand_total",

            "status",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "customer",
            "subtotal",
            "gst_amount",
            "grand_total",
            "created_at",
            "updated_at",
        ]

    def get_customer(self, obj):

        customer = obj.customer

        return {
            "id": customer.id,
            "company_name": customer.company_name,
            "address": customer.address,
            "contact_person": customer.contact_person,
            "phone": customer.phone,
            "email": customer.email,
            "gst_number": customer.gst_number,
        }

    def validate_items(self, value):

        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Items must be a list."
            )

        if not value:
            raise serializers.ValidationError(
                "At least one quotation item is required."
            )

        return value

    def validate_gst_percent(self, value):

        if value < 0:
            raise serializers.ValidationError(
                "GST percentage cannot be negative."
            )

        return value

    def validate(self, attrs):

        items = attrs.get("items", [])

        subtotal = 0

        for item in items:

            qty = float(
                item.get("qty", 0) or 0
            )

            rate = float(
                item.get("rate", 0) or 0
            )

            if qty < 0:
                raise serializers.ValidationError({
                    "items": "Quantity cannot be negative."
                })

            if rate < 0:
                raise serializers.ValidationError({
                    "items": "Rate cannot be negative."
                })

            subtotal += qty * rate

        gst_percent = float(
            attrs.get("gst_percent", 0) or 0
        )

        gst_amount = (
            subtotal * gst_percent / 100
        )

        grand_total = (
            subtotal + gst_amount
        )

        # Store calculated values temporarily
        self._calculated_amounts = {
            "subtotal": round(subtotal, 2),
            "gst_amount": round(gst_amount, 2),
            "grand_total": round(grand_total, 2),
        }

        return attrs

    def create(self, validated_data):

        amounts = getattr(
            self,
            "_calculated_amounts",
            {
                "subtotal": 0,
                "gst_amount": 0,
                "grand_total": 0,
            },
        )

        return Quotation.objects.create(
            **validated_data,
            **amounts,
        )

    def update(self, instance, validated_data):

        amounts = getattr(
            self,
            "_calculated_amounts",
            None,
        )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if amounts:
            instance.subtotal = amounts["subtotal"]
            instance.gst_amount = amounts["gst_amount"]
            instance.grand_total = amounts["grand_total"]

        instance.save()

        return instance


#for dc


from .models import DeliveryChallan, Customer


class DeliveryChallanSerializer(serializers.ModelSerializer):

    customer_id = serializers.PrimaryKeyRelatedField(
        source="customer",
        queryset=Customer.objects.all(),
        write_only=True,
    )

    customer = serializers.SerializerMethodField(
        read_only=True,
    )

    class Meta:
        model = DeliveryChallan

        fields = [
            "id",
            "dc_number",
            "dc_date",

            "customer_id",
            "customer",

            "po_number",
            "po_date",

            "bill_number",
            "bill_date",

            "delivery_at",
            "company_address_id",
            "returnable",

            "items",

            "amount_in_words",
            "prepared_by",

            "status",
            "pdf_file",

            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "customer",
            "pdf_file",
            "created_at",
            "updated_at",
        ]

    def get_customer(self, obj):

        customer = obj.customer

        return {
            "id": customer.id,
            "company_name": customer.company_name,
            "address": customer.address,
            "contact_person": customer.contact_person,
            "phone": customer.phone,
            "email": customer.email,
            "gst_number": customer.gst_number,
        }

    # ==========================================================
    # FIELD VALIDATION
    # ==========================================================

    def validate_items(self, value):

        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Items must be a list."
            )

        if not value:
            raise serializers.ValidationError(
                "At least one delivery challan item is required."
            )

        for index, item in enumerate(value, start=1):

            if not isinstance(item, dict):
                raise serializers.ValidationError(
                    f"Item {index} must be an object."
                )

            description = str(
                item.get("description", "") or ""
            ).strip()

            if not description:
                raise serializers.ValidationError(
                    f"Item {index}: description is required."
                )

            quantity = item.get("quantity", "")

            if quantity not in ("", None):

                try:
                    qty_value = float(quantity)
                except (TypeError, ValueError):
                    raise serializers.ValidationError(
                        f"Item {index}: quantity must be a number."
                    )

                if qty_value < 0:
                    raise serializers.ValidationError(
                        f"Item {index}: quantity cannot be negative."
                    )

            rate = item.get("rate", "")

            if rate not in ("", None):

                try:
                    rate_value = float(rate)
                except (TypeError, ValueError):
                    raise serializers.ValidationError(
                        f"Item {index}: rate must be a number."
                    )

                if rate_value < 0:
                    raise serializers.ValidationError(
                        f"Item {index}: rate cannot be negative."
                    )

        return value

    def validate_dc_date(self, value):

        if value is None:
            raise serializers.ValidationError(
                "Delivery challan date is required."
            )

        return value