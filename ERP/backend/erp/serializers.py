from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import ConsumableIssue, User

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
# PROFILE SERIALIZER — pulls from Employee, falls back to UserProfile
# ============================================================
from erp.models import Employee  
from rest_framework import serializers
from .models import Attendance


class MyAttendanceSerializer(serializers.ModelSerializer):
    employee_id = serializers.CharField(
        source="employee.employee_id",
        read_only=True,
    )

    employee_name = serializers.CharField(
        source="employee.full_name",
        read_only=True,
    )

    class Meta:
        model = Attendance
        fields = [
            "id",
            "employee_id",
            "employee_name",
            "date",
            "status",
            "login_time",
            "logout_time",
            "break_hours",
            "working_hours",
            "hourly_rate",
            "daily_wage",
            "remarks",
        ]

class ProfileSerializer(serializers.ModelSerializer):

    accountId = serializers.IntegerField(
        source="id",
        read_only=True,
    )

    username = serializers.CharField(
        read_only=True,
    )

    email = serializers.CharField(
        read_only=True,
    )

    department = serializers.SerializerMethodField()
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

    # ---------------------------------------------------------
    # HELPERS — resolve the Employee row for this User
    # ---------------------------------------------------------
    def _get_employee(self, obj):
        
        
        if not hasattr(self, "_employee_cache"):
            self._employee_cache = {}

        if obj.id in self._employee_cache:
            return self._employee_cache[obj.id]

        emp = None

        # 1. Already linked
        emp = (
            Employee.objects
            .filter(user=obj)
            .order_by("-created_at")
            .first()
        )

        # 2. Seeded via created_by
        if emp is None:
            emp = (
                Employee.objects
                .filter(created_by=obj)
                .order_by("-created_at")
                .first()
            )

        # 3. Match by email
        if emp is None and obj.email:
            emp = (
                Employee.objects
                .filter(email__iexact=obj.email)
                .order_by("-created_at")
                .first()
            )

        # 4. Match by first name
        if emp is None and obj.username:
            emp = (
                Employee.objects
                .filter(first_name__iexact=obj.username)
                .order_by("-created_at")
                .first()
            )

        # 5. Persist the link the first time we find a match
        if emp is not None and emp.user_id is None:
            emp.user = obj
            emp.save(update_fields=["user"])

        self._employee_cache[obj.id] = emp
        return emp
    def get_profilePhoto(self, obj):
        emp = self._get_employee(obj)

        if emp and emp.photo:
            request = self.context.get("request")
            url = emp.photo.url
            return request.build_absolute_uri(url) if request else url

        return None

    # ---------------------------------------------------------
    # FIELD RESOLVERS
    # ---------------------------------------------------------
    def get_phone(self, obj):
        emp = self._get_employee(obj)
        if emp and emp.mobile:
            return emp.mobile

        try:
            return obj.profile.phone
        except UserProfile.DoesNotExist:
            return None

    def get_role(self, obj):
        emp = self._get_employee(obj)
        if emp and emp.designation:
            return emp.designation

        try:
            return obj.profile.role
        except UserProfile.DoesNotExist:
            return None

    def get_employeeId(self, obj):
        emp = self._get_employee(obj)
        if emp and emp.employee_id:
            return emp.employee_id

        try:
            return obj.profile.employee_id
        except UserProfile.DoesNotExist:
            return None

    def get_joiningDate(self, obj):
        emp = self._get_employee(obj)
        if emp and emp.joining_date:
            return emp.joining_date

        try:
            return obj.profile.joining_date
        except UserProfile.DoesNotExist:
            return None

    

    def get_department(self, obj):
        emp = self._get_employee(obj)
        if emp and emp.department:
            return emp.department
        # fall back to user_type (the old behaviour)
        return obj.user_type
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
            "state",          # ← ADDED
            "state_code",     # ← ADDED
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
    

# for tax invoice
from rest_framework import serializers

from .models import TaxInvoice


class TaxInvoiceSerializer(serializers.ModelSerializer):

    class Meta:
        model = TaxInvoice

        fields = [
            "id",
            "invoice_number",
            "invoice_date",
            "date_of_supply",
            "reverse_charge",

            "vehicle_number",
            "mode_of_transport",

            "receiver_details",
            "receiver_gst",
            "receiver_address_option_id",

            "consignee_details",
            "consignee_gst",
            "consignee_address_option_id",

            "place_of_supply_state",
            "place_of_supply_state_code",
            "state_name_code",

            "company_address_id",

            "items",

            "subtotal",
            "cgst_percent",
            "cgst_amount",
            "sgst_percent",
            "sgst_amount",
            "igst_percent",
            "igst_amount",
            "rounded_off",
            "grand_total",
            "amount_in_words",

            "bank_name",
            "account_number",
            "branch",
            "ifsc",
            "pan",

            "declaration",
            "enclosures",

            "document_data",

            "status",
            "pdf_file",

            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "pdf_file",
            "created_at",
            "updated_at",
        ]

    # ==========================================================
    # FIELD VALIDATION
    # ==========================================================

    def validate_invoice_number(self, value):

        value = str(value or "").strip()

        if not value:
            raise serializers.ValidationError(
                "Invoice number is required."
            )

        return value

    def validate_items(self, value):

        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Items must be a list."
            )

        if not value:
            raise serializers.ValidationError(
                "At least one invoice item is required."
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

    def validate_receiver_details(self, value):

        if value is None:
            return {}

        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Receiver details must be an object."
            )

        return value

    def validate_consignee_details(self, value):

        if value is None:
            return {}

        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Consignee details must be an object."
            )

        return value

    def validate_enclosures(self, value):

        if value is None:
            return {}

        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Enclosures must be an object."
            )

        return value

    def validate_cgst_percent(self, value):

        if value is not None and value < 0:
            raise serializers.ValidationError(
                "CGST percentage cannot be negative."
            )

        return value

    def validate_sgst_percent(self, value):

        if value is not None and value < 0:
            raise serializers.ValidationError(
                "SGST percentage cannot be negative."
            )

        return value

    def validate_igst_percent(self, value):

        if value is not None and value < 0:
            raise serializers.ValidationError(
                "IGST percentage cannot be negative."
            )

        return value



#for perfoma

from .models import ProformaInvoice


class ProformaInvoiceSerializer(serializers.ModelSerializer):

    class Meta:
        model = ProformaInvoice

        fields = [
            "id",
            "proforma_no",
            "date",
            "valid_until",
            "payment_terms",

            "reference_no",
            "customer_po_no",
            "po_date",
            "place_of_supply",

            "receiver_details",
            "receiver_gst",
            "receiver_address_option_id",

            "consignee_details",
            "consignee_gst",
            "consignee_address_option_id",

            "company_address_id",

            "items",

            "subtotal",
            "cgst_percent",
            "cgst_amount",
            "sgst_percent",
            "sgst_amount",
            "igst_percent",
            "igst_amount",
            "rounded_off",
            "grand_total",
            "amount_in_words",

            "bank_name",
            "account_number",
            "branch",
            "ifsc",
            "pan",

            "declaration",
            "enclosure_text",

            "document_data",

            "status",
            "pdf_file",

            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "pdf_file",
            "created_at",
            "updated_at",
        ]

    # ==========================================================
    # FIELD VALIDATION
    # ==========================================================

    def validate_proforma_no(self, value):

        value = str(value or "").strip()

        if not value:
            raise serializers.ValidationError(
                "Proforma number is required."
            )

        return value

    def validate_items(self, value):

        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Items must be a list."
            )

        if not value:
            raise serializers.ValidationError(
                "At least one proforma item is required."
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

    def validate_receiver_details(self, value):

        if value is None:
            return {}

        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Receiver details must be an object."
            )

        return value

    def validate_consignee_details(self, value):

        if value is None:
            return {}

        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Consignee details must be an object."
            )

        return value

    def validate_cgst_percent(self, value):

        if value is not None and value < 0:
            raise serializers.ValidationError(
                "CGST percentage cannot be negative."
            )

        return value

    def validate_sgst_percent(self, value):

        if value is not None and value < 0:
            raise serializers.ValidationError(
                "SGST percentage cannot be negative."
            )

        return value

    def validate_igst_percent(self, value):

        if value is not None and value < 0:
            raise serializers.ValidationError(
                "IGST percentage cannot be negative."
            )

        return value


# for reports
from rest_framework import serializers


# ============================================================
# ACCOUNTS REPORT
# ------------------------------------------------------------
# Unified row shape used by the Reports page. A row can come
# from any of the 5 document models (PO, QO, DC, TI, PI).
#
# This is a plain Serializer — NOT a ModelSerializer — because
# rows are hand-built by services/accounts_report.py and don't
# map 1-to-1 to any single model.
# ============================================================


class AccountsReportRowSerializer(serializers.Serializer):
    """
    One row on the Reports table.

    Field contract (must match services.accounts_report._build_row):

        id               "PO-12"  (unique across all document types)
        type             "Purchase Order"
        short            "PO"
        document_number  "PO1001"
        payment_status   "Paid" | "Pending" | "N/A"
        delivery_status  "Delivered" | "Pending" | "N/A"
        path             "/accounts/po"
        document_data    { ... }  full blob for View / Print
    """

    id = serializers.CharField()

    type = serializers.CharField()

    short = serializers.CharField()

    document_number = serializers.CharField(
        allow_blank=True,
    )

    payment_status = serializers.CharField()

    delivery_status = serializers.CharField()

    path = serializers.CharField()

    document_data = serializers.DictField(
        child=serializers.JSONField(),
        allow_empty=True,
    )

class StatusUpdateSerializer(serializers.Serializer):
    """
    Payload for PATCH /erp/accounts-report/<short>/<id>/status/

    Both fields optional — send only the one you want to change.
    """

    payment_status = serializers.ChoiceField(
        choices=["Paid", "Pending", "N/A"],
        required=False,
    )

    delivery_status = serializers.ChoiceField(
        choices=["Delivered", "Pending", "N/A"],
        required=False,
    )

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError(
                "Provide at least one of payment_status or delivery_status."
            )
        return attrs

#for expense

from .models import JournalEntry


class JournalEntrySerializer(serializers.ModelSerializer):
    """
    One row on the Journal / Expense & Profit page.
    """

    class Meta:
        model = JournalEntry
        fields = [
            "id",
            "record_number",
            "date",
            "type",
            "category",
            "description",
            "amount",
            "payment_mode",
            "document_number",
            "document",
            "notes",
            "source_type",
            "source_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "record_number",
            "created_at",
            "updated_at",
        ]



#hr module
# hr/serializers.py
from rest_framework import serializers

from .models import Employee


class EmployeeSerializer(serializers.ModelSerializer):
    """
    Maps every camelCase field the React frontend uses to the
    snake_case model fields.

    NOTE: `id` in the response is the *DB primary key* used by
    the API URLs. The user-entered employee ID is exposed as
    `employeeId` so the frontend keeps its existing shape.
    """

    fullName = serializers.SerializerMethodField()

    # Frontend aliases
    employeeId = serializers.CharField(source="employee_id")
    employeeCode = serializers.CharField(
        source="employee_code", required=False, allow_blank=True
    )
    firstName = serializers.CharField(source="first_name")
    lastName = serializers.CharField(
        source="last_name", required=False, allow_blank=True
    )
    bloodGroup = serializers.CharField(
        source="blood_group", required=False, allow_blank=True
    )
    maritalStatus = serializers.CharField(
        source="marital_status", required=False, allow_blank=True
    )
    emergencyContactName = serializers.CharField(
        source="emergency_contact_name", required=False, allow_blank=True
    )
    emergencyContactNumber = serializers.CharField(
        source="emergency_contact_number", required=False, allow_blank=True
    )
    employmentType = serializers.CharField(
        source="employment_type", required=False, allow_blank=True
    )
    employmentStatus = serializers.CharField(
        source="employment_status", required=False
    )
    reportingManager = serializers.CharField(
        source="reporting_manager", required=False, allow_blank=True
    )
    workLocation = serializers.CharField(
        source="work_location", required=False, allow_blank=True
    )
    joiningDate = serializers.DateField(
        source="joining_date", required=False, allow_null=True
    )
    addressLine1 = serializers.CharField(
        source="address_line1", required=False, allow_blank=True
    )
    addressLine2 = serializers.CharField(
        source="address_line2", required=False, allow_blank=True
    )
    drivingLicense = serializers.CharField(
        source="driving_license", required=False, allow_blank=True
    )
    bankDetails = serializers.JSONField(
        source="bank_details", required=False
    )
    employmentHistory = serializers.JSONField(
        source="employment_history", required=False
    )
    employeeCode = serializers.CharField(
        source="employee_code",
        read_only=True,
    )

    class Meta:
        model = Employee
        fields = [
            "id",              # DB PK (used in URLs)
            "employeeId",      # user-entered, e.g. EMP001
            "employeeCode",
            "firstName",
            "lastName",
            "fullName",
            "photo",
            "gender",
            "dob",
            "bloodGroup",
            "maritalStatus",
            "mobile",
            "email",
            "emergencyContactName",
            "emergencyContactNumber",
            "department",
            "designation",
            "branch",
            "employmentType",
            "employmentStatus",
            "reportingManager",
            "workLocation",
            "joiningDate",
            "addressLine1",
            "addressLine2",
            "country",
            "state",
            "city",
            "district",
            "pincode",
            "aadhaar",
            "pan",
            "uan",
            "pf",
            "esi",
            "passport",
            "drivingLicense",
            "skills",
            "education",
            "experience",
            "bankDetails",
            "documents",
            "employmentHistory",
            "archived",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_fullName(self, obj):
        return obj.full_name

    # -----------------------------------------------------
    # VALIDATION
    # -----------------------------------------------------
    def validate_employeeId(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError(
                "Employee ID is required."
            )

        qs = Employee.objects.filter(employee_id__iexact=value)
        instance = getattr(self, "instance", None)
        if instance:
            qs = qs.exclude(pk=instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                "This Employee ID is already in use."
            )
        return value

    def validate_firstName(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("First name is required.")
        return value.strip()

    def validate_email(self, value):
        if value:
            qs = Employee.objects.filter(email__iexact=value)
            instance = getattr(self, "instance", None)
            if instance:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "An employee with this email already exists."
                )
        return value


class EmployeeArchiveSerializer(serializers.Serializer):
    archived = serializers.BooleanField()


#for salary advance 
from datetime import date

from rest_framework import serializers

from .models import (
    Employee,
    SalaryPayment,
    Advance,
)


class SalaryEmployeeSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        source="full_name",
        read_only=True,
    )

    class Meta:
        model = Employee
        fields = [
            "id",
            "employee_id",
            "employee_code",
            "name",
            "first_name",
            "last_name",
            "mobile",
            "email",
            "department",
            "designation",
            "branch",
            "employment_type",
            "employment_status",
            "work_location",
        ]


class SalaryPaymentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source="employee.full_name",
        read_only=True,
    )

    employee_code = serializers.CharField(
        source="employee.employee_id",
        read_only=True,
    )

    class Meta:
        model = SalaryPayment

        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_code",

            "salary_month",
            "salary_year",

            "base_salary",
            "attendance_wage",
            "allowances",
            "overtime",
            "gross_earnings",

            "pf",
            "esi",
            "tax",
            "other_deductions",
            "advance_deduction",
            "total_deductions",

            "net_salary",

            "payment_status",
            "paid_date",
            "remarks",

            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "salary_year",
            "gross_earnings",
            "total_deductions",
            "net_salary",
            "created_at",
            "updated_at",
        ]

    def validate_salary_month(self, value):
        """
        Always normalize salary month to the first day.

        2026-09-01
        """

        return value.replace(day=1)

    def validate(self, attrs):
        employee = attrs.get(
            "employee",
            getattr(self.instance, "employee", None)
        )

        salary_month = attrs.get(
            "salary_month",
            getattr(self.instance, "salary_month", None)
        )

        if not employee:
            raise serializers.ValidationError({
                "employee": "Employee is required."
            })

        if not salary_month:
            raise serializers.ValidationError({
                "salary_month": "Salary month is required."
            })

        salary_month = salary_month.replace(day=1)

        qs = SalaryPayment.objects.filter(
            employee=employee,
            salary_month=salary_month,
        )

        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError({
                "salary_month": (
                    "Salary already exists for this employee "
                    "for this month."
                )
            })

        return attrs

    def create(self, validated_data):
        salary_month = validated_data["salary_month"].replace(day=1)

        validated_data["salary_month"] = salary_month
        validated_data["salary_year"] = salary_month.year

        base_salary = validated_data.get(
            "base_salary", 0
        )

        attendance_wage = validated_data.get(
            "attendance_wage", 0
        )

        allowances = validated_data.get(
            "allowances", 0
        )

        overtime = validated_data.get(
            "overtime", 0
        )

        pf = validated_data.get("pf", 0)
        esi = validated_data.get("esi", 0)
        tax = validated_data.get("tax", 0)
        other_deductions = validated_data.get(
            "other_deductions", 0
        )
        advance_deduction = validated_data.get(
            "advance_deduction", 0
        )

        gross = (
            base_salary
            + attendance_wage
            + allowances
            + overtime
        )

        total_deductions = (
            pf
            + esi
            + tax
            + other_deductions
            + advance_deduction
        )

        net_salary = gross - total_deductions

        validated_data["gross_earnings"] = gross
        validated_data["total_deductions"] = total_deductions
        validated_data["net_salary"] = net_salary

        return SalaryPayment.objects.create(
            **validated_data
        )

    def update(self, instance, validated_data):
        if "salary_month" in validated_data:
            salary_month = validated_data[
                "salary_month"
            ].replace(day=1)

            validated_data["salary_month"] = salary_month
            validated_data["salary_year"] = salary_month.year

        for field, value in validated_data.items():
            setattr(instance, field, value)

        base_salary = instance.base_salary
        attendance_wage = instance.attendance_wage
        allowances = instance.allowances
        overtime = instance.overtime

        pf = instance.pf
        esi = instance.esi
        tax = instance.tax
        other_deductions = instance.other_deductions
        advance_deduction = instance.advance_deduction

        instance.gross_earnings = (
            base_salary
            + attendance_wage
            + allowances
            + overtime
        )

        instance.total_deductions = (
            pf
            + esi
            + tax
            + other_deductions
            + advance_deduction
        )

        instance.net_salary = (
            instance.gross_earnings
            - instance.total_deductions
        )

        instance.save()

        return instance


class AdvanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source="employee.full_name",
        read_only=True,
    )

    employee_code = serializers.CharField(
        source="employee.employee_id",
        read_only=True,
    )

    class Meta:
        model = Advance

        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_code",

            "advance_date",
            "amount",
            "total_repaid",
            "outstanding_amount",

            "reason",
            "remarks",
            "status",

            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "total_repaid",
            "outstanding_amount",
            "status",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        amount = validated_data["amount"]

        validated_data["total_repaid"] = 0
        validated_data["outstanding_amount"] = amount
        validated_data["status"] = "OUTSTANDING"

        return Advance.objects.create(
            **validated_data
        )


# attendance

from decimal import Decimal
from datetime import datetime, date, timedelta

from rest_framework import serializers

from .models import (
    Employee,
    WageConfig,
    Attendance,
)


# ============================================================
# EMPLOYEE SERIALIZER
# ============================================================

class AttendanceEmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Employee

        fields = [
            "id",
            "employee_id",
            "employee_code",
            "first_name",
            "last_name",
            "full_name",
            "mobile",
            "email",
            "department",
            "designation",
            "branch",
            "employment_type",
            "employment_status",
            "work_location",
            "joining_date",
        ]

    def get_full_name(self, obj):
        return obj.full_name


# ============================================================
# WAGE CONFIG SERIALIZER
# ============================================================

class WageConfigSerializer(serializers.ModelSerializer):

    employee_name = serializers.SerializerMethodField()

    employee_code = serializers.CharField(
        source="employee.employee_id",
        read_only=True,
    )

    class Meta:
        model = WageConfig

        fields = [
            "id",

            "employee",
            "employee_code",
            "employee_name",

            "salary_type",
            "hourly_rate",
            "monthly_salary",
            "standard_hours_per_day",

            "paid_leave_policy",
            "holiday_policy",
            "weekly_off_policy",

            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "employee_code",
            "employee_name",
            "created_at",
            "updated_at",
        ]

    def get_employee_name(self, obj):
        return obj.employee.full_name


# ============================================================
# ATTENDANCE SERIALIZER
# ============================================================

class AttendanceSerializer(serializers.ModelSerializer):

    employee_name = serializers.SerializerMethodField()

    employee_code = serializers.CharField(
        source="employee.employee_id",
        read_only=True,
    )

    department = serializers.CharField(
        source="employee.department",
        read_only=True,
    )

    branch = serializers.CharField(
        source="employee.branch",
        read_only=True,
    )

    employment_type = serializers.CharField(
        source="employee.employment_type",
        read_only=True,
    )

    work_location = serializers.CharField(
        source="employee.work_location",
        read_only=True,
    )

    class Meta:
        model = Attendance

        fields = [
            "id",

            "employee",
            "employee_code",
            "employee_name",

            "department",
            "branch",
            "employment_type",
            "work_location",

            "date",
            "status",

            "login_time",
            "logout_time",
            "break_hours",

            "working_hours",
            "hourly_rate",
            "daily_wage",

            "remarks",

            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",

            "employee_code",
            "employee_name",

            "department",
            "branch",
            "employment_type",
            "work_location",

            "working_hours",
            "daily_wage",

            "created_at",
            "updated_at",
        ]

    # --------------------------------------------------------
    # VALIDATION
    # --------------------------------------------------------

    def validate(self, attrs):

        instance = self.instance

        attendance_status = attrs.get(
            "status",
            getattr(
                instance,
                "status",
                None,
            ),
        )

        login_time = attrs.get(
            "login_time",
            getattr(
                instance,
                "login_time",
                None,
            ),
        )

        logout_time = attrs.get(
            "logout_time",
            getattr(
                instance,
                "logout_time",
                None,
            ),
        )

        break_hours = attrs.get(
            "break_hours",
            getattr(
                instance,
                "break_hours",
                Decimal("0"),
            ),
        )

        if break_hours is None:
            break_hours = Decimal("0")

        if break_hours < Decimal("0"):
            raise serializers.ValidationError({
                "break_hours": "Break hours cannot be negative."
            })

        time_based_statuses = {
            "PRESENT",
            "HALF_DAY",
            "WFH",
        }

        if attendance_status in time_based_statuses:

            if not login_time:
                raise serializers.ValidationError({
                    "login_time":
                        "Login time is required for this status."
                })

            if not logout_time:
                raise serializers.ValidationError({
                    "logout_time":
                        "Logout time is required for this status."
                })

            if login_time == logout_time:
                raise serializers.ValidationError({
                    "logout_time":
                        "Logout time cannot be equal to login time."
                })

        return attrs

    # --------------------------------------------------------
    # CALCULATE WORKING HOURS
    # --------------------------------------------------------
    def get_employee_name(self, obj):
        return obj.employee.full_name
    def calculate_working_hours(
        self,
        login_time,
        logout_time,
        break_hours,
    ):

        if not login_time or not logout_time:
            return Decimal("0.00")

        start = datetime.combine(
            date.today(),
            login_time,
        )

        end = datetime.combine(
            date.today(),
            logout_time,
        )

        # Overnight shift
        if end < start:
            end += timedelta(days=1)

        total_seconds = (
            end - start
        ).total_seconds()

        hours = (
            Decimal(str(total_seconds / 3600))
            - Decimal(str(break_hours or 0))
        )

        if hours < Decimal("0"):
            hours = Decimal("0")

        return hours.quantize(
            Decimal("0.01")
        )

    # --------------------------------------------------------
    # CALCULATE DAILY WAGE
    # --------------------------------------------------------

    def calculate_daily_wage(
        self,
        attendance_status,
        working_hours,
        hourly_rate,
        wage_config,
    ):

        time_based_statuses = {
            "PRESENT",
            "HALF_DAY",
            "WFH",
        }

        if attendance_status in time_based_statuses:

            return (
                working_hours * hourly_rate
            ).quantize(
                Decimal("0.01")
            )

        # Paid leave
        if attendance_status == "PAID_LEAVE":

            if wage_config.paid_leave_policy == "FULL_DAY":

                return (
                    wage_config.standard_hours_per_day
                    * hourly_rate
                ).quantize(
                    Decimal("0.01")
                )

            return Decimal("0.00")

        # Holiday
        if attendance_status == "HOLIDAY":

            if wage_config.holiday_policy == "FULL_DAY":

                return (
                    wage_config.standard_hours_per_day
                    * hourly_rate
                ).quantize(
                    Decimal("0.01")
                )

            return Decimal("0.00")

        # Weekly off
        if attendance_status == "WEEKLY_OFF":

            if wage_config.weekly_off_policy == "FULL_DAY":

                return (
                    wage_config.standard_hours_per_day
                    * hourly_rate
                ).quantize(
                    Decimal("0.01")
                )

            return Decimal("0.00")

        # ABSENT / UNPAID_LEAVE
        return Decimal("0.00")

    # --------------------------------------------------------
    # CREATE
    # --------------------------------------------------------

    def create(self, validated_data):

        employee = validated_data["employee"]

        wage_config, _ = WageConfig.objects.get_or_create(
            employee=employee
        )

        attendance_status = validated_data.get(
            "status",
            "PRESENT",
        )

        login_time = validated_data.get(
            "login_time"
        )

        logout_time = validated_data.get(
            "logout_time"
        )

        break_hours = validated_data.get(
            "break_hours",
            Decimal("0"),
        )

        hourly_rate = validated_data.get(
            "hourly_rate"
        )

        if hourly_rate is None:
            hourly_rate = wage_config.hourly_rate

        working_hours = self.calculate_working_hours(
            login_time,
            logout_time,
            break_hours,
        )

        daily_wage = self.calculate_daily_wage(
            attendance_status,
            working_hours,
            hourly_rate,
            wage_config,
        )

        # Non-time attendance
        if attendance_status not in {
            "PRESENT",
            "HALF_DAY",
            "WFH",
        }:

            login_time = None
            logout_time = None
            break_hours = Decimal("0")
            working_hours = Decimal("0.00")

        validated_data["login_time"] = login_time
        validated_data["logout_time"] = logout_time
        validated_data["break_hours"] = break_hours
        validated_data["working_hours"] = working_hours
        validated_data["hourly_rate"] = hourly_rate
        validated_data["daily_wage"] = daily_wage

        return super().create(
            validated_data
        )

    # --------------------------------------------------------
    # UPDATE
    # --------------------------------------------------------

    def update(
        self,
        instance,
        validated_data,
    ):

        employee = validated_data.get(
            "employee",
            instance.employee,
        )

        wage_config, _ = WageConfig.objects.get_or_create(
            employee=employee
        )

        attendance_status = validated_data.get(
            "status",
            instance.status,
        )

        login_time = validated_data.get(
            "login_time",
            instance.login_time,
        )

        logout_time = validated_data.get(
            "logout_time",
            instance.logout_time,
        )

        break_hours = validated_data.get(
            "break_hours",
            instance.break_hours,
        )

        hourly_rate = validated_data.get(
            "hourly_rate",
            instance.hourly_rate,
        )

        if hourly_rate is None:
            hourly_rate = wage_config.hourly_rate

        working_hours = self.calculate_working_hours(
            login_time,
            logout_time,
            break_hours,
        )

        daily_wage = self.calculate_daily_wage(
            attendance_status,
            working_hours,
            hourly_rate,
            wage_config,
        )

        if attendance_status not in {
            "PRESENT",
            "HALF_DAY",
            "WFH",
        }:

            login_time = None
            logout_time = None
            break_hours = Decimal("0")
            working_hours = Decimal("0.00")

        validated_data["login_time"] = login_time
        validated_data["logout_time"] = logout_time
        validated_data["break_hours"] = break_hours
        validated_data["working_hours"] = working_hours
        validated_data["hourly_rate"] = hourly_rate
        validated_data["daily_wage"] = daily_wage

        return super().update(
            instance,
            validated_data,
        )



#for consumable
from rest_framework import serializers

from .models import (
    ConsumableGRN,
    PurchaseOrderItem,
)


class ConsumableGRNSerializer(serializers.ModelSerializer):

    class Meta:
        model = ConsumableGRN
        fields = "__all__"
        read_only_fields = [
            "grn_number",
            "received_quantity",
            "pending_quantity",
            "status",
            "created_at",
            "updated_at",
        ]



class ConsumableIssueSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsumableIssue
        fields = "__all__"
        read_only_fields = [
            "issue_number",
            "grn",
            "po_number",
            "po_description",
            "consumable_name",
            "category",
            "unit",
            "warehouse",
            "created_at",
            "updated_at",
        ]