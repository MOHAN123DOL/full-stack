from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import BOMPOIntegration, ConsumableIssue, ConsumableReturn, PurchaseOrder, User

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


from rest_framework import serializers

from .models import PurchaseOrderItem

class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrderItem
        fields = [
            "id",
            "item_code",
            "description",
            "quantity",
            "unit",
        ]
        read_only_fields = fields
class PurchaseOrderSerializer(serializers.ModelSerializer):

    created_by_name = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )

    created_by_type = serializers.CharField(
        source="created_by.user_type",
        read_only=True,
    )
    po_items = PurchaseOrderItemSerializer(
        many=True,
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
            "po_items",

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
from rest_framework import serializers
from .models import JournalEntry, PurchaseOrder


class JournalEntrySerializer(serializers.ModelSerializer):
    """
    One row on the Journal / Expense & Profit page.
    """

    purchase_order_id = serializers.IntegerField(
        write_only=True,
        required=False,
        allow_null=True,
    )

    purchase_order_display = serializers.SerializerMethodField(
        read_only=True,
    )

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

            # ----- NEW -----
            "purchase_order",
            "purchase_order_id",
            "purchase_order_display",
            "po_number",

            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "record_number",
            "purchase_order",
            "purchase_order_display",
            "po_number",
            "created_at",
            "updated_at",
        ]

    def get_purchase_order_display(self, obj):
        if not obj.purchase_order:
            return None
        return {
            "id": obj.purchase_order.id,
            "po_number": obj.purchase_order.po_number,
            "po_date": obj.purchase_order.po_date,
            "grand_total": str(obj.purchase_order.grand_total or 0),
            "vendor": obj.purchase_order.vendor or {},
        }

    def create(self, validated_data):
        po_id = validated_data.pop("purchase_order_id", None)
        po = None
        if po_id:
            try:
                po = PurchaseOrder.objects.get(id=po_id)
            except PurchaseOrder.DoesNotExist:
                raise serializers.ValidationError(
                    {"purchase_order_id": "Purchase Order not found."}
                )

        validated_data["purchase_order"] = po
        validated_data["po_number"] = po.po_number if po else ""

        return super().create(validated_data)

    def update(self, instance, validated_data):
        po_id = validated_data.pop("purchase_order_id", None)

        if po_id is not None:
            if po_id == 0:
                # Explicit "clear the link" call
                instance.purchase_order = None
                instance.po_number = ""
            else:
                try:
                    po = PurchaseOrder.objects.get(id=po_id)
                except PurchaseOrder.DoesNotExist:
                    raise serializers.ValidationError(
                        {"purchase_order_id": "Purchase Order not found."}
                    )
                instance.purchase_order = po
                instance.po_number = po.po_number

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance


class JournalPOOptionSerializer(serializers.ModelSerializer):
    """
    Compact PO rows for the "Related PO" search dropdown on the
    Add Transaction modal.
    """

    vendor_name = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "po_number",
            "po_date",
            "grand_total",
            "payment_status",
            "delivery_status",
            "vendor_name",
        ]

    def get_vendor_name(self, obj):
        vendor = obj.vendor or {}
        if isinstance(vendor, dict):
            return vendor.get("companyName") or ""
        return str(vendor)

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


class ConsumableReturnSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsumableReturn
        fields = "__all__"
        read_only_fields = [
            "return_number",
            "issue",
            "issue_number",
            "consumable_name",
            "unit",
            "warehouse",
            "created_at",
            "updated_at",
        ]

#for material dwgbom
from rest_framework import serializers
from .models import Project, Drawing, BOMItem

from decimal import Decimal, InvalidOperation

from rest_framework import serializers

from .models import Project, Drawing, BOMItem


# ---------------------------------------------------------------------
# Canonical keys inside BOMItem.description
# ---------------------------------------------------------------------
_DESCRIPTION_STRING_KEYS = ("materialType", "grade", "remarks")
_DESCRIPTION_NUMERIC_KEYS = ("thickness", "length", "width")
_DESCRIPTION_ALL_KEYS = _DESCRIPTION_STRING_KEYS + _DESCRIPTION_NUMERIC_KEYS

# snake_case -> camelCase aliases (tolerant to older clients)
_KEY_ALIASES = {
    "material_type": "materialType",
    "materialtype": "materialType",
}


def _empty_description():
    return {
        "materialType": "",
        "thickness": None,
        "length": None,
        "width": None,
        "grade": "",
        "remarks": "",
    }


def _normalize_description(raw):
    """
    Accepts:
      - None / "" / {}                        → empty object
      - dict with camelCase OR snake_case     → canonical dict
      - plain string (legacy)                 → dumped into "remarks"

    Always returns a dict with exactly the canonical keys.
    Raises serializers.ValidationError on bad input.
    """
    if raw in (None, ""):
        return _empty_description()

    # Legacy plain string
    if isinstance(raw, str):
        stripped = raw.strip()
        if not stripped:
            return _empty_description()
        out = _empty_description()
        out["remarks"] = stripped
        return out

    if not isinstance(raw, dict):
        raise serializers.ValidationError(
            "Description must be an object like "
            '{"materialType": "Plate", "thickness": 6, "length": 530, "width": 530}.'
        )

    # Fold snake_case keys into camelCase
    folded = {}
    for k, v in raw.items():
        folded[_KEY_ALIASES.get(k, k)] = v

    out = _empty_description()

    # Strings
    for key in _DESCRIPTION_STRING_KEYS:
        v = folded.get(key)
        out[key] = ("" if v is None else str(v)).strip()

    # Numbers
    for key in _DESCRIPTION_NUMERIC_KEYS:
        v = folded.get(key)
        if v in (None, "", "null"):
            out[key] = None
            continue
        try:
            d = Decimal(str(v))
        except (InvalidOperation, TypeError, ValueError):
            raise serializers.ValidationError(
                f"{key} must be a number, got {v!r}."
            )
        if d < 0:
            raise serializers.ValidationError(f"{key} cannot be negative.")
        out[key] = float(d)

    # Reject unknown keys so typos surface immediately
    unknown = set(folded.keys()) - set(_DESCRIPTION_ALL_KEYS)
    if unknown:
        raise serializers.ValidationError(
            f"Unknown description keys: {', '.join(sorted(unknown))}."
        )

    return out


class DescriptionField(serializers.Field):
    """
    Normalizes BOMItem.description on read AND write.
    Always emits the canonical camelCase shape.
    """

    def to_representation(self, value):
        return _normalize_description(value)

    def to_internal_value(self, data):
        try:
            return _normalize_description(data)
        except serializers.ValidationError:
            raise
        except Exception as exc:
            raise serializers.ValidationError(str(exc))


class BOMItemSerializer(serializers.ModelSerializer):
    drawingId = serializers.PrimaryKeyRelatedField(
        source="drawing",
        queryset=Drawing.objects.all(),
    )
    variantNumber = serializers.CharField(
        source="variant_number", required=False, allow_blank=True
    )
    itemNumber = serializers.CharField(
        source="item_number", required=False, allow_blank=True
    )
    drawingNumber = serializers.CharField(
        source="drawing_number", required=False, allow_blank=True
    )
    itemNo = serializers.CharField(
        source="item_no", required=False, allow_blank=True
    )
    varNo = serializers.CharField(
        source="var_no", required=False, allow_blank=True
    )
    materialCode = serializers.CharField(source="material_code")
    materialSpecn = serializers.CharField(
        source="material_specn", required=False, allow_blank=True
    )
    unitWeight = serializers.FloatField(source="unit_weight", required=False)
    quantity = serializers.FloatField()

    # Normalized JSON object — DescriptionField handles both directions
    description = DescriptionField(required=False)

    class Meta:
        model = BOMItem
        fields = [
            "id",
            "drawingId",
            "variantNumber",
            "itemNumber",
            "description",
            "std",
            "drawingNumber",
            "itemNo",
            "varNo",
            "materialCode",
            "materialSpecn",
            "acp",
            "di",
            "unit",
            "unitWeight",
            "quantity",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    # -----------------------------------------------------------------
    # Validation
    # -----------------------------------------------------------------
    def validate_description(self, value):
        # Field is optional on PATCH — fall back to model default when absent
        if value is None:
            return _empty_description()

        # Reject a totally empty description on CREATE/PATCH
        has_content = any(
            (
                value.get("materialType"),
                value.get("thickness"),
                value.get("length"),
                value.get("width"),
                value.get("grade"),
                value.get("remarks"),
            )
        )
        if not has_content:
            raise serializers.ValidationError(
                "Enter at least one of: materialType, thickness, length, "
                "width, grade, or remarks."
            )
        return value

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0.")
        return value

    def validate_unit_weight(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Unit weight cannot be negative.")
        return value

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0.")
        return value


class DrawingSerializer(serializers.ModelSerializer):
    projectId = serializers.PrimaryKeyRelatedField(
        source="project",
        queryset=Project.objects.all(),
    )
    dwgNumber = serializers.CharField(source="dwg_number")

    class Meta:
        model = Drawing
        fields = [
            "id",
            "projectId",
            "dwgNumber",
            "name",
            "revision",
            "date",
            "file",
            "remarks",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ProjectSerializer(serializers.ModelSerializer):
    startDate = serializers.DateField(source="start_date", required=False, allow_null=True)
    endDate = serializers.DateField(source="end_date", required=False, allow_null=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "code",
            "description",
            "status",
            "startDate",
            "endDate",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({
                "endDate": "Expected End Date cannot be earlier than Start Date."
            })
        return attrs



#for project integration
# =====================================================================
# PROJECT-LEVEL BOM ↔ PO INTEGRATION
# =====================================================================

class ProjectIntegrationRowSerializer(serializers.Serializer):
    
    # --- BOM side ---
    bomItemId = serializers.IntegerField()
    bomItemNumber = serializers.CharField(allow_blank=True)
    bomDescription = serializers.CharField(allow_blank=True)
    bomUnit = serializers.CharField(allow_blank=True)
    bomQuantity = serializers.DecimalField(
        max_digits=15, decimal_places=3,
    )
    bomIntegrated = serializers.DecimalField(
        max_digits=15, decimal_places=3,
    )
    bomRemaining = serializers.DecimalField(
        max_digits=15, decimal_places=3,
    )

    # --- Drawing info (read-only context) ---
    drawingId = serializers.IntegerField()
    drawingNumber = serializers.CharField(allow_blank=True)

    # --- PO side ---
    poItemId = serializers.IntegerField()
    poNumber = serializers.CharField(allow_blank=True)
    poItemCode = serializers.CharField(allow_blank=True)
    poDescription = serializers.CharField(allow_blank=True)
    poUnit = serializers.CharField(allow_blank=True)
    poQuantity = serializers.DecimalField(
        max_digits=15, decimal_places=3,
    )
    poIntegrated = serializers.DecimalField(
        max_digits=15, decimal_places=3,
    )
    poRemaining = serializers.DecimalField(
        max_digits=15, decimal_places=3,
    )

    # How much can still be integrated on this exact row
    maximumIntegratable = serializers.DecimalField(
        max_digits=15, decimal_places=3,
    )


class ProjectIntegrationSaveRowSerializer(serializers.Serializer):
    """
    One row payload when saving.
    """

    bomItemId = serializers.IntegerField()
    poItemId = serializers.IntegerField()
    quantity = serializers.DecimalField(
        max_digits=15,
        decimal_places=3,
        min_value=Decimal("0.001"),
    )


class ProjectIntegrationSaveSerializer(serializers.Serializer):


    projectId = serializers.IntegerField()
    rows = ProjectIntegrationSaveRowSerializer(many=True)

    def validate_rows(self, value):
        if not value:
            raise serializers.ValidationError(
                "At least one row is required."
            )
        return value

from .models import DummyPurchaseOrder, DummyPurchaseOrderItem


class DummyPurchaseOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DummyPurchaseOrderItem
        fields = [
            "id",
            "item_code",
            "description",
            "material",
            "length",
            "width",
            "thickness",
            "quantity",
            "unit",
            "remarks",
        ]
        read_only_fields = fields


class DummyPurchaseOrderSerializer(serializers.ModelSerializer):
    items = DummyPurchaseOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = DummyPurchaseOrder
        fields = [
            "id",
            "po_number",
            "remarks",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields



#MATERIAL GRN SERIALIZER


from .models import MaterialGRN


class MaterialGRNSerializer(serializers.ModelSerializer):
    """
    Read serializer — emits the exact camelCase shape the frontend
    expects for a GRN history row.
    """

    id = serializers.SerializerMethodField()
    grnNumber = serializers.CharField(
        source="grn_number",
        read_only=True,
    )
    grnDate = serializers.DateField(
        source="grn_date",
        read_only=True,
    )
    poNumber = serializers.CharField(
        source="po_number",
        read_only=True,
    )
    description = serializers.CharField(
        read_only=True,
    )
    material = serializers.CharField(
        read_only=True,
    )
    receivedQty = serializers.DecimalField(
        source="received_qty",
        max_digits=15,
        decimal_places=3,
        read_only=True,
    )
    unit = serializers.CharField(
        source="receiving_unit",
        read_only=True,
    )
    receivedBy = serializers.SerializerMethodField()
    remarks = serializers.CharField(
        read_only=True,
    )

    class Meta:
        model = MaterialGRN
        fields = [
            "id",
            "grnNumber",
            "grnDate",
            "poNumber",
            "description",
            "material",
            "receivedQty",
            "unit",
            "receivedBy",
            "remarks",
        ]
        read_only_fields = fields

    def get_id(self, obj):
        return f"grn-{obj.id}"

    def get_receivedBy(self, obj):
        return obj.received_by or "—"



# =====================================================================
# MATERIAL STOCK SERIALIZERS
# =====================================================================

from .models import MaterialStock, MaterialStockMovement


class MaterialStockMovementSerializer(serializers.ModelSerializer):

    direction = serializers.CharField(read_only=True)
    movementType = serializers.CharField(
        source="movement_type",
        read_only=True,
    )
    quantity = serializers.DecimalField(
        max_digits=15,
        decimal_places=3,
        read_only=True,
    )
    referenceType = serializers.CharField(
        source="reference_type",
        read_only=True,
    )
    referenceId = serializers.IntegerField(
        source="reference_id",
        read_only=True,
    )
    remarks = serializers.CharField(read_only=True)
    createdAt = serializers.DateTimeField(
        source="created_at",
        read_only=True,
    )

    class Meta:
        model = MaterialStockMovement
        fields = [
            "id",
            "direction",
            "movementType",
            "quantity",
            "referenceType",
            "referenceId",
            "remarks",
            "createdAt",
        ]
        read_only_fields = fields


class MaterialStockSerializer(serializers.ModelSerializer):

    id = serializers.IntegerField(read_only=True)
    stockId = serializers.CharField(source="stock_id", read_only=True)
    sourceType = serializers.CharField(source="source_type", read_only=True)
    poNumber = serializers.CharField(source="po_number", read_only=True)
    description = serializers.CharField(read_only=True)
    material = serializers.CharField(read_only=True)
    materialCode = serializers.CharField(source="material_code", read_only=True)
    materialSpec = serializers.CharField(source="material_spec", read_only=True)
    thickness = serializers.CharField(read_only=True)
    length = serializers.CharField(read_only=True)
    width = serializers.CharField(read_only=True)
    weight = serializers.DecimalField(
    max_digits=15,
    decimal_places=3,
    read_only=True,
)
    heatNumber = serializers.CharField(source="heat_number", read_only=True)
    plateNumber = serializers.CharField(source="plate_number", read_only=True)
    originalQty = serializers.DecimalField(
        source="original_qty",
        max_digits=15,
        decimal_places=3,
        read_only=True,
    )
    availableQty = serializers.SerializerMethodField()
    uom = serializers.CharField(read_only=True)
    project = serializers.SerializerMethodField()
    projectId = serializers.IntegerField(source="project_id", read_only=True)
    dwgDescription = serializers.CharField(
        source="dwg_description",
        read_only=True,
    )
    revision = serializers.CharField(read_only=True)
    stockStatus = serializers.CharField(source="stock_status", read_only=True)
    reworkRequired = serializers.SerializerMethodField()
    remarks = serializers.CharField(read_only=True)
    unit = serializers.CharField(read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = MaterialStock
        fields = [
            "id",
            "stockId",
            "unit",
            "sourceType",
            "poNumber",
            "description",
            "material",
            "materialCode",
            "materialSpec",
            "thickness",
            "length",
            "width",
            "weight",
            "heatNumber",
            "plateNumber",
            "originalQty",
            "availableQty",
            "uom",
            "project",
            "projectId",
            "dwgDescription",
            "revision",
            "stockStatus",
            "reworkRequired",
            "remarks",
            "createdAt",
            "updatedAt",
        ]
        read_only_fields = fields

    def get_availableQty(self, obj):
        # Uses the model @property — always computed from movements.
        value = obj.available_qty
        return float(value) if value is not None else 0.0

    def get_project(self, obj):
        return obj.project.name if obj.project else "—"

    def get_reworkRequired(self, obj):
        return "Yes" if obj.rework_required else "No"



# =====================================================================
# JOB WORK SERIALIZERS
# =====================================================================

from .models import JobWorkIssue, JobWorkProcess


class JobWorkProcessSerializer(serializers.ModelSerializer):

    processId = serializers.CharField(source="process_id")

    class Meta:
        model = JobWorkProcess
        fields = [
            "id",
            "name",
            "processId",
            "is_active",
        ]
        read_only_fields = ["id"]

    def validate_processId(self, value):
        value = (value or "").strip().upper()
        if not value:
            raise serializers.ValidationError(
                "Process ID is required."
            )
        qs = JobWorkProcess.objects.filter(process_id__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "This Process ID already exists."
            )
        return value


class JobWorkIssueSerializer(serializers.ModelSerializer):

    id = serializers.SerializerMethodField()
    issueNumber = serializers.CharField(source="issue_number", read_only=True)
    issueDate = serializers.DateField(source="issue_date", read_only=True)
    stockId = serializers.IntegerField(source="stock_id", read_only=True)
    stockCode = serializers.CharField(source="stock.stock_id", read_only=True)
    poNumber = serializers.CharField(source="po_number", read_only=True)
    description = serializers.CharField(read_only=True)
    material = serializers.CharField(read_only=True)
    materialCode = serializers.CharField(source="material_code", read_only=True)
    materialSpec = serializers.CharField(source="material_spec", read_only=True)
    thickness = serializers.CharField(read_only=True)
    length = serializers.CharField(read_only=True)
    width = serializers.CharField(read_only=True)
    uom = serializers.CharField(read_only=True)
    project = serializers.SerializerMethodField()
    projectId = serializers.IntegerField(source="project_id", read_only=True)
    dwgDescription = serializers.CharField(source="dwg_description", read_only=True)
    revision = serializers.CharField(read_only=True)
    jobWorkType = serializers.CharField(source="job_work_type", read_only=True)
    processName = serializers.CharField(source="process_name", read_only=True)
    processId = serializers.CharField(source="process_id", read_only=True)
    jobWorkUnit = serializers.CharField(source="job_work_unit", read_only=True)
    vendor = serializers.CharField(read_only=True)
    vendorContact = serializers.CharField(source="vendor_contact", read_only=True)
    jobWorkLocation = serializers.CharField(source="job_work_location", read_only=True)
    expectedReturnDate = serializers.DateField(
        source="expected_return_date", read_only=True
    )
    quantityIssued = serializers.DecimalField(
        source="quantity_issued", max_digits=15, decimal_places=3, read_only=True
    )
    quantityReturned = serializers.DecimalField(
        source="quantity_returned", max_digits=15, decimal_places=3, read_only=True
    )
    balanceQty = serializers.SerializerMethodField()
    issuedBy = serializers.CharField(source="issued_by", read_only=True)
    remarks = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = JobWorkIssue
        fields = [
            "id",
            "issueNumber",
            "issueDate",
            "stockId",
            "stockCode",
            "poNumber",
            "description",
            "material",
            "materialCode",
            "materialSpec",
            "thickness",
            "length",
            "width",
            "uom",
            "project",
            "projectId",
            "dwgDescription",
            "revision",
            "jobWorkType",
            "processName",
            "processId",
            "jobWorkUnit",
            "vendor",
            "vendorContact",
            "jobWorkLocation",
            "expectedReturnDate",
            "quantityIssued",
            "quantityReturned",
            "balanceQty",
            "issuedBy",
            "remarks",
            "status",
            "createdAt",
        ]
        read_only_fields = fields

    def get_id(self, obj):
        return f"ISS-{obj.id}"

    def get_project(self, obj):
        return obj.project.name if obj.project else "—"

    def get_balanceQty(self, obj):
        balance = (obj.quantity_issued or 0) - (obj.quantity_returned or 0)
        return float(max(balance, 0))


# =====================================================================
# JOB WORK RECEIVE SERIALIZERS
# =====================================================================

from .models import (
    JobWorkReceive,
    JobWorkReceivePiece,
    JobWorkReceiveRemaining,
)


class JobWorkReceivePieceSerializer(serializers.ModelSerializer):

    pieceNo = serializers.CharField(source="piece_no")
    length = serializers.CharField()
    width = serializers.CharField()
    thickness = serializers.CharField()
    qty = serializers.DecimalField(
        max_digits=15, decimal_places=3, read_only=True
    )
    weight = serializers.DecimalField(
        max_digits=15, decimal_places=3, read_only=True
    )
    remarks = serializers.CharField()

    class Meta:
        model = JobWorkReceivePiece
        fields = [
            "id",
            "pieceNo",
            "length",
            "width",
            "thickness",
            "qty",
            "weight",
            "remarks",
        ]
        read_only_fields = ["id"]


class JobWorkReceiveRemainingSerializer(serializers.ModelSerializer):

    plateNo = serializers.CharField(source="plate_no")
    length = serializers.CharField()
    width = serializers.CharField()
    thickness = serializers.CharField()
    weight = serializers.DecimalField(
        max_digits=15, decimal_places=3, read_only=True
    )
    remarks = serializers.CharField()
    reworkRequired = serializers.CharField(
        source="rework_required", read_only=True
    )

    class Meta:
        model = JobWorkReceiveRemaining
        fields = [
            "id",
            "plateNo",
            "length",
            "width",
            "thickness",
            "weight",
            "remarks",
            "reworkRequired",
        ]
        read_only_fields = ["id"]


class JobWorkReceiveSerializer(serializers.ModelSerializer):

    id = serializers.SerializerMethodField()
    receiveNumber = serializers.CharField(
        source="receive_number", read_only=True
    )
    receiveDate = serializers.DateField(source="receive_date", read_only=True)
    issueId = serializers.IntegerField(source="issue_id", read_only=True)
    jobWorkId = serializers.CharField(source="job_work_id", read_only=True)
    poNumber = serializers.CharField(source="po_number", read_only=True)
    description = serializers.CharField(read_only=True)
    material = serializers.CharField(read_only=True)
    materialCode = serializers.CharField(
        source="material_code", read_only=True
    )
    materialSpec = serializers.CharField(
        source="material_spec", read_only=True
    )
    thickness = serializers.CharField(read_only=True)
    length = serializers.CharField(read_only=True)
    width = serializers.CharField(read_only=True)
    uom = serializers.CharField(read_only=True)
    project = serializers.SerializerMethodField()
    projectId = serializers.IntegerField(source="project_id", read_only=True)
    dwgDescription = serializers.CharField(
        source="dwg_description", read_only=True
    )
    revision = serializers.CharField(read_only=True)
    processName = serializers.CharField(
        source="process_name", read_only=True
    )
    processId = serializers.CharField(source="process_id", read_only=True)
    completedInputQty = serializers.DecimalField(
        source="completed_input_qty",
        max_digits=15,
        decimal_places=3,
        read_only=True,
    )
    remainingInputQty = serializers.DecimalField(
        source="remaining_input_qty",
        max_digits=15,
        decimal_places=3,
        read_only=True,
    )
    totalOutputQty = serializers.DecimalField(
        source="total_output_qty",
        max_digits=15,
        decimal_places=3,
        read_only=True,
    )
    totalOutputWeight = serializers.DecimalField(
        source="total_output_weight",
        max_digits=15,
        decimal_places=3,
        read_only=True,
    )
    totalRemainingWeight = serializers.DecimalField(
        source="total_remaining_weight",
        max_digits=15,
        decimal_places=3,
        read_only=True,
    )
    receivedBy = serializers.CharField(source="received_by", read_only=True)
    remarks = serializers.CharField(read_only=True)
    outputPieces = JobWorkReceivePieceSerializer(
        source="output_pieces", many=True, read_only=True
    )
    remainingPieces = JobWorkReceiveRemainingSerializer(
        source="remaining_pieces", many=True, read_only=True
    )
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = JobWorkReceive
        fields = [
            "id",
            "receiveNumber",
            "receiveDate",
            "issueId",
            "jobWorkId",
            "poNumber",
            "description",
            "material",
            "materialCode",
            "materialSpec",
            "thickness",
            "length",
            "width",
            "uom",
            "project",
            "projectId",
            "dwgDescription",
            "revision",
            "processName",
            "processId",
            "completedInputQty",
            "remainingInputQty",
            "totalOutputQty",
            "totalOutputWeight",
            "totalRemainingWeight",
            "receivedBy",
            "remarks",
            "outputPieces",
            "remainingPieces",
            "createdAt",
        ]
        read_only_fields = fields

    def get_id(self, obj):
        return f"JWR-{obj.id}"

    def get_project(self, obj):
        return obj.project.name if obj.project else "—"





# =====================================================================
# PRODUCTION ISSUE SERIALIZERS
# =====================================================================

from .models import ProductionIssue


class ProductionIssueSerializer(serializers.ModelSerializer):

    id = serializers.SerializerMethodField()
    issueId = serializers.CharField(source="issue_number", read_only=True)
    issueDate = serializers.DateField(source="issue_date", read_only=True)

    jobWorkReceiveId = serializers.IntegerField(
        source="job_work_receive_id", read_only=True
    )
    jobWorkPieceId = serializers.IntegerField(
        source="job_work_piece_id", read_only=True
    )
    materialStockId = serializers.IntegerField(
        source="material_stock_id", read_only=True
    )

    jobWorkId = serializers.CharField(source="job_work_id", read_only=True)
    poNumber = serializers.CharField(source="po_number", read_only=True)
    poType = serializers.CharField(source="po_type", read_only=True)
    supplier = serializers.CharField(read_only=True)
    description = serializers.CharField(read_only=True)
    material = serializers.CharField(read_only=True)
    materialCode = serializers.CharField(source="material_code", read_only=True)
    materialSpec = serializers.CharField(source="material_spec", read_only=True)
    thickness = serializers.CharField(read_only=True)
    length = serializers.CharField(read_only=True)
    width = serializers.CharField(read_only=True)
    size = serializers.SerializerMethodField()
    unit = serializers.CharField(read_only=True)
    jobWorkType = serializers.CharField(source="job_work_type", read_only=True)
    jobWorkUnit = serializers.CharField(source="job_work_unit", read_only=True)
    process = serializers.CharField(source="process_name", read_only=True)
    processId = serializers.CharField(source="process_id", read_only=True)
    project = serializers.SerializerMethodField()
    projectId = serializers.IntegerField(source="project_id", read_only=True)
    dwgDescription = serializers.CharField(
        source="dwg_description", read_only=True
    )
    revision = serializers.CharField(read_only=True)

    pieceNo = serializers.CharField(source="piece_no", read_only=True)
    uom = serializers.CharField(read_only=True)

    originalReceivedQty = serializers.DecimalField(
        source="original_received_qty",
        max_digits=15,
        decimal_places=3,
        read_only=True,
    )
    previouslyIssuedQty = serializers.DecimalField(
        source="previously_issued_qty",
        max_digits=15,
        decimal_places=3,
        read_only=True,
    )
    issuedNow = serializers.DecimalField(
        source="issued_qty",
        max_digits=15,
        decimal_places=3,
        read_only=True,
    )
    remainingAvailableQty = serializers.DecimalField(
        source="remaining_available_qty",
        max_digits=15,
        decimal_places=3,
        read_only=True,
    )

    issuedBy = serializers.CharField(source="issued_by", read_only=True)
    remarks = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = ProductionIssue
        fields = [
            "id",
            "issueId",
            "issueDate",
            "jobWorkReceiveId",
            "jobWorkPieceId",
            "materialStockId",
            "jobWorkId",
            "poNumber",
            "poType",
            "supplier",
            "description",
            "material",
            "materialCode",
            "materialSpec",
            "thickness",
            "length",
            "width",
            "size",
            "unit",
            "jobWorkType",
            "jobWorkUnit",
            "process",
            "processId",
            "project",
            "projectId",
            "dwgDescription",
            "revision",
            "pieceNo",
            "uom",
            "originalReceivedQty",
            "previouslyIssuedQty",
            "issuedNow",
            "remainingAvailableQty",
            "issuedBy",
            "remarks",
            "status",
            "createdAt",
        ]
        read_only_fields = fields

    def get_id(self, obj):
        return f"IP-{obj.id}"

    def get_project(self, obj):
        return obj.project.name if obj.project else "—"

    def get_size(self, obj):
        if obj.length and obj.width:
            return f"{obj.length} × {obj.width}"
        return ""







# =====================================================================
# ASSEMBLY SERIALIZERS
# =====================================================================

from .models import Assembly, AssemblyInput, AssemblyProcess


class AssemblyInputSerializer(serializers.ModelSerializer):

    id = serializers.IntegerField(read_only=True)
    sourceType = serializers.CharField(source="source_type", read_only=True)

    jobWorkPieceId = serializers.IntegerField(
        source="job_work_piece_id", read_only=True
    )
    sourceAssemblyId = serializers.IntegerField(
        source="source_assembly_id", read_only=True
    )
    sourceAssemblyCode = serializers.SerializerMethodField()

    useQty = serializers.DecimalField(
        source="use_qty", max_digits=15, decimal_places=3, read_only=True
    )

    materialName = serializers.CharField(
        source="material_name", read_only=True
    )
    materialCode = serializers.CharField(
        source="material_code", read_only=True
    )
    unit = serializers.CharField(read_only=True)
    thickness = serializers.CharField(read_only=True)
    length = serializers.CharField(read_only=True)
    width = serializers.CharField(read_only=True)
    drawingNumber = serializers.CharField(
        source="drawing_number", read_only=True
    )

    class Meta:
        model = AssemblyInput
        fields = [
            "id",
            "sourceType",
            "jobWorkPieceId",
            "sourceAssemblyId",
            "sourceAssemblyCode",
            "useQty",
            "materialName",
            "materialCode",
            "unit",
            "thickness",
            "length",
            "width",
            "drawingNumber",
        ]
        read_only_fields = fields

    def get_sourceAssemblyCode(self, obj):
        return (
            obj.source_assembly.assembly_id
            if obj.source_assembly
            else None
        )


class AssemblyProcessSerializer(serializers.ModelSerializer):

    id = serializers.IntegerField(read_only=True)
    sequence = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    processId = serializers.CharField(source="process_id", read_only=True)
    qcRequired = serializers.BooleanField(
        source="qc_required", read_only=True
    )
    executionType = serializers.CharField(
        source="execution_type", read_only=True
    )
    executionUnit = serializers.CharField(
        source="execution_unit", read_only=True
    )
    vendor = serializers.CharField(read_only=True)
    vendorContact = serializers.CharField(
        source="vendor_contact", read_only=True
    )
    vendorLocation = serializers.CharField(
        source="vendor_location", read_only=True
    )
    expectedReturnDate = serializers.DateField(
        source="expected_return_date", read_only=True
    )
    outsourcingRemarks = serializers.CharField(
        source="outsourcing_remarks", read_only=True
    )

    class Meta:
        model = AssemblyProcess
        fields = [
            "id",
            "sequence",
            "name",
            "processId",
            "qcRequired",
            "executionType",
            "executionUnit",
            "vendor",
            "vendorContact",
            "vendorLocation",
            "expectedReturnDate",
            "outsourcingRemarks",
        ]
        read_only_fields = fields


class AssemblySerializer(serializers.ModelSerializer):

    id = serializers.IntegerField(read_only=True)
    assemblyId = serializers.CharField(
        source="assembly_id", read_only=True
    )
    project = serializers.SerializerMethodField()
    projectId = serializers.IntegerField(source="project_id", read_only=True)
    status = serializers.CharField(read_only=True)

    inputs = AssemblyInputSerializer(many=True, read_only=True)
    processes = AssemblyProcessSerializer(many=True, read_only=True)

    createdDate = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(
        source="created_at", read_only=True
    )

    class Meta:
        model = Assembly
        fields = [
            "id",
            "assemblyId",
            "project",
            "projectId",
            "status",
            "inputs",
            "processes",
            "createdDate",
            "createdAt",
        ]
        read_only_fields = fields

    def get_project(self, obj):
        return obj.project.code if obj.project else ""

    def get_createdDate(self, obj):
        return obj.created_at.date().isoformat()



# =====================================================================
# REWORK SERIALIZERS
# =====================================================================
from .models import (
    ReworkRecord,
    ReworkCompletion,
    ReworkHistory,
)


# ---------------------------------------------------------------------
# Helper: minutes → "1 h 45 min"
# ---------------------------------------------------------------------
def _fmt_minutes(m):
    if m is None:
        return "—"
    if m < 60:
        return f"{m} min"
    h, rem = divmod(int(m), 60)
    if rem == 0:
        return f"{h} h"
    return f"{h} h {rem} min"


class ReworkCompletionSerializer(serializers.ModelSerializer):

    completedBy = serializers.CharField(
        source="completed_by", read_only=True,
    )
    createdAt = serializers.DateTimeField(
        source="created_at", read_only=True,
    )
    date = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()

    # Minutes between this completion and the previous one
    # (or the record's started_at if this is the first).
    minutesSincePrevious = serializers.SerializerMethodField()
    minutesSincePreviousLabel = serializers.SerializerMethodField()

    class Meta:
        model = ReworkCompletion
        fields = [
            "id", "qty", "completedBy", "remarks",
            "date", "time", "createdAt",
            "minutesSincePrevious", "minutesSincePreviousLabel",
        ]
        read_only_fields = fields

    def get_date(self, obj):
        return obj.created_at.date().isoformat()

    def get_time(self, obj):
        return obj.created_at.strftime("%H:%M")

    def _prev_anchor(self, obj):
        prev = (
            ReworkCompletion.objects
            .filter(rework=obj.rework, created_at__lt=obj.created_at)
            .order_by("-created_at")
            .first()
        )
        if prev:
            return prev.created_at
        return obj.rework.started_at

    def get_minutesSincePrevious(self, obj):
        anchor = self._prev_anchor(obj)
        if not anchor:
            return None
        delta = obj.created_at - anchor
        return int(delta.total_seconds() // 60)

    def get_minutesSincePreviousLabel(self, obj):
        return _fmt_minutes(self.get_minutesSincePrevious(obj))


class ReworkHistorySerializer(serializers.ModelSerializer):

    performedBy = serializers.CharField(
        source="performed_by", read_only=True,
    )
    event = serializers.CharField(source="event_text", read_only=True)
    date = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()
    at = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = ReworkHistory
        fields = ["id", "date", "time", "at", "event", "performedBy"]
        read_only_fields = fields

    def get_date(self, obj):
        return obj.created_at.date().isoformat()

    def get_time(self, obj):
        return obj.created_at.strftime("%H:%M")


class ReworkRecordSerializer(serializers.ModelSerializer):

    id = serializers.IntegerField(read_only=True)
    reworkId = serializers.CharField(
        source="rework_number", read_only=True,
    )
    sourceType = serializers.CharField(
        source="source_type", read_only=True,
    )
    sourceLabel = serializers.SerializerMethodField()

    projectId = serializers.IntegerField(
        source="project_id", read_only=True,
    )
    project = serializers.CharField(
        source="project_code", read_only=True,
    )

    poNumber = serializers.CharField(source="po_number", read_only=True)
    poDescription = serializers.CharField(
        source="po_description", read_only=True,
    )
    dwgDescription = serializers.CharField(
        source="dwg_description", read_only=True,
    )
    revision = serializers.CharField(read_only=True)

    material = serializers.CharField(read_only=True)
    materialCode = serializers.CharField(
        source="material_code", read_only=True,
    )
    materialSpec = serializers.CharField(
        source="material_spec", read_only=True,
    )

    thickness = serializers.CharField(read_only=True)
    length = serializers.CharField(read_only=True)
    width = serializers.CharField(read_only=True)
    size = serializers.CharField(read_only=True)
    unit = serializers.CharField(read_only=True)

    jobWorkPieceNo = serializers.CharField(
        source="job_work_piece_no", read_only=True,
    )
    assemblyCode = serializers.CharField(
        source="assembly_code", read_only=True,
    )
    process = serializers.CharField(
        source="process_name", read_only=True,
    )
    processId = serializers.CharField(
        source="process_id", read_only=True,
    )

    requiredQty = serializers.DecimalField(
        source="required_qty",
        max_digits=15, decimal_places=3, read_only=True,
    )
    completedQty = serializers.DecimalField(
        source="completed_qty",
        max_digits=15, decimal_places=3, read_only=True,
    )
    balanceQty = serializers.SerializerMethodField()

    reason = serializers.CharField(read_only=True)
    flaggedBy = serializers.CharField(
        source="flagged_by", read_only=True,
    )

    reworkBy = serializers.CharField(
        source="rework_by", read_only=True,
    )
    supervisor = serializers.CharField(read_only=True)
    startRemarks = serializers.CharField(
        source="start_remarks", read_only=True,
    )

    startedAt = serializers.DateTimeField(
        source="started_at", read_only=True,
    )
    completedAt = serializers.DateTimeField(
        source="completed_at", read_only=True,
    )
    durationMinutes = serializers.IntegerField(
        source="duration_minutes", read_only=True,
    )
    durationLabel = serializers.SerializerMethodField()

    createdDate = serializers.SerializerMethodField()
    createdTime = serializers.SerializerMethodField()

    qcRequired = serializers.BooleanField(
        source="qc_required", read_only=True,
    )
    qcVerifiedBy = serializers.CharField(
        source="qc_verified_by", read_only=True,
    )
    qcResult = serializers.CharField(
        source="qc_result", read_only=True,
    )
    qcRemarks = serializers.CharField(
        source="qc_remarks", read_only=True,
    )
    qcAt = serializers.DateTimeField(source="qc_at", read_only=True)

    status = serializers.CharField(read_only=True)

    completions = ReworkCompletionSerializer(
        many=True, read_only=True,
    )
    history = ReworkHistorySerializer(
        many=True, read_only=True,
    )

    class Meta:
        model = ReworkRecord
        fields = [
            "id", "reworkId",
            "sourceType", "sourceLabel",
            "projectId", "project",
            "poNumber", "poDescription",
            "dwgDescription", "revision",
            "material", "materialCode", "materialSpec",
            "thickness", "length", "width", "size", "unit",
            "jobWorkPieceNo",
            "assemblyCode", "process", "processId",
            "requiredQty", "completedQty", "balanceQty",
            "reason", "flaggedBy",
            "reworkBy", "supervisor", "startRemarks",
            "startedAt", "completedAt",
            "durationMinutes", "durationLabel",
            "createdDate", "createdTime",
            "qcRequired", "qcVerifiedBy", "qcResult", "qcRemarks", "qcAt",
            "status",
            "completions", "history",
        ]
        read_only_fields = fields

    def get_sourceLabel(self, obj):
        return obj.get_source_type_display()

    def get_balanceQty(self, obj):
        return float(obj.balance_qty or 0)

    def get_durationLabel(self, obj):
        return _fmt_minutes(obj.duration_minutes)

    def get_createdDate(self, obj):
        return obj.created_at.date().isoformat()

    def get_createdTime(self, obj):
        return obj.created_at.strftime("%H:%M")



# =====================================================================
# PRODUCTION OPERATION SERIALIZERS
# =====================================================================

from .models import (
    AssemblyExecution,
    AssemblyStageExecution,
    AssemblyStageMovement,
    AssemblyExecutionEvent,
)


# ---------------------------------------------------------------------
# Movement — used in the stage detail history (Eye view)
# ---------------------------------------------------------------------
class AssemblyStageMovementSerializer(serializers.ModelSerializer):

    movement = serializers.CharField(read_only=True)
    quantity = serializers.DecimalField(
        max_digits=15, decimal_places=3, read_only=True
    )
    performedBy = serializers.CharField(
        source="performed_by", read_only=True
    )
    supervisedBy = serializers.CharField(
        source="supervised_by", read_only=True
    )
    remarks = serializers.CharField(read_only=True)
    dcRef = serializers.CharField(source="dc_ref", read_only=True)
    expectedReturnDate = serializers.DateField(
        source="expected_return_date", read_only=True
    )
    createdAt = serializers.DateTimeField(
        source="created_at", read_only=True
    )

    class Meta:
        model = AssemblyStageMovement
        fields = [
            "id",
            "movement",
            "quantity",
            "performedBy",
            "supervisedBy",
            "remarks",
            "dcRef",
            "expectedReturnDate",
            "createdAt",
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------
# Stage execution
# ---------------------------------------------------------------------
class AssemblyStageExecutionSerializer(serializers.ModelSerializer):

    id = serializers.IntegerField(read_only=True)
    sequence = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)

    processId = serializers.CharField(
        source="process_id", read_only=True
    )
    qcRequired = serializers.BooleanField(
        source="qc_required", read_only=True
    )

    executionType = serializers.CharField(
        source="execution_type", read_only=True
    )
    executionUnit = serializers.CharField(
        source="execution_unit", read_only=True
    )
    reworkRecords = serializers.SerializerMethodField(
    method_name="get_reworkRecords"
)
    vendor = serializers.CharField(read_only=True)
    vendorContact = serializers.CharField(
        source="vendor_contact", read_only=True
    )
    vendorLocation = serializers.CharField(
        source="vendor_location", read_only=True
    )
    expectedReturnDate = serializers.DateField(
        source="expected_return_date", read_only=True
    )

    # Quantity counters (floats so the frontend can do math directly)
    availableQty = serializers.FloatField(
        source="available_qty", read_only=True
    )
    pendingOperationQty = serializers.FloatField(
        source="pending_operation_qty", read_only=True
    )
    sentQty = serializers.FloatField(source="sent_qty", read_only=True)
    receivedQty = serializers.FloatField(
        source="received_qty", read_only=True
    )
    awaitingQcQty = serializers.FloatField(
        source="awaiting_qc_qty", read_only=True
    )
    reworkQty = serializers.FloatField(source="rework_qty", read_only=True)
    releasedQty = serializers.FloatField(
        source="released_qty", read_only=True
    )

    started = serializers.BooleanField(read_only=True)

    # Derived — pending from vendor (outsourcing)
    pendingFromVendor = serializers.SerializerMethodField()

    # Last-event snapshots for the row's action buttons
    lastOperation = serializers.SerializerMethodField()
    lastQc = serializers.SerializerMethodField()
    lastRework = serializers.SerializerMethodField()
    lastOutsourcing = serializers.SerializerMethodField()

    class Meta:
        model = AssemblyStageExecution
        fields = [
            "id",
            "sequence",
            "name",
            "processId",
            "qcRequired",
            "executionType",
            "executionUnit",
            "vendor",
            "reworkRecords",
            "vendorContact",
            "vendorLocation",
            "expectedReturnDate",
            "availableQty",
            "pendingOperationQty",
            "sentQty",
            "receivedQty",
            "pendingFromVendor",
            "awaitingQcQty",
            "reworkQty",
            "releasedQty",
            "started",
            "lastOperation",
            "lastQc",
            "lastRework",
            "lastOutsourcing",
        ]
        read_only_fields = fields

    # ---- derived helpers -------------------------------------------------

    def get_pendingFromVendor(self, obj):
        return float((obj.sent_qty or 0) - (obj.received_qty or 0))

    def _last_movement(self, obj, movement_type):
        mv = (
            obj.movements
            .filter(movement=movement_type)
            .order_by("-created_at")
            .first()
        )
        if not mv:
            return None
        return {
            "performedBy": mv.performed_by,
            "supervisedBy": mv.supervised_by,
            "date": mv.created_at.date().isoformat(),
            "time": mv.created_at.strftime("%H:%M"),
            "remarks": mv.remarks,
            "quantity": float(mv.quantity or 0),
            "dcRef": mv.dc_ref,
            "expectedReturnDate": (
                mv.expected_return_date.isoformat()
                if mv.expected_return_date else ""
            ),
        }

    def get_lastOperation(self, obj):
        # Prefer Complete, fall back to Start
        return (
            self._last_movement(obj, "Complete")
            or self._last_movement(obj, "Start")
        )

    def get_lastQc(self, obj):
        accept = self._last_movement(obj, "QC Accept")
        reject = self._last_movement(obj, "QC Reject")
        if not accept and not reject:
            return None
        chosen = accept or reject
        return {
            "verifiedBy": chosen["performedBy"],
            "remarks": chosen["remarks"],
            "date": chosen["date"],
            "acceptedQty": float(accept["quantity"]) if accept else 0.0,
            "rejectedQty": float(reject["quantity"]) if reject else 0.0,
        }
    def get_reworkRecords(self, obj):
        from .models import ReworkRecord
        rows = obj.rework_records.all().order_by("-created_at")
        return [
            {
                "id": r.id,
                "reworkId": r.rework_number,
                "status": r.status,
                "requiredQty": float(r.required_qty or 0),
                "completedQty": float(r.completed_qty or 0),
                "balanceQty": float(r.balance_qty or 0),
                "reason": r.reason,
                "qcRequired": r.qc_required,
                "createdAt": r.created_at,
            }
            for r in rows
        ]

    def get_lastRework(self, obj):
        mv = self._last_movement(obj, "Rework Done")
        if not mv:
            return None
        return {
            "by": mv["performedBy"],
            "date": mv["date"],
            "remarks": mv["remarks"],
            "reworkedQty": mv["quantity"],
            "reworkRef": mv["dcRef"],
        }

    def get_lastOutsourcing(self, obj):
        sent = self._last_movement(obj, "Send Out")
        recv = self._last_movement(obj, "Receive In")

        latest = None
        if sent and recv:
            latest = "received" if recv["date"] >= sent["date"] else "sent"
        elif recv:
            latest = "received"
        elif sent:
            latest = "sent"

        if latest is None:
            return None

        chosen = recv if latest == "received" else sent
        return {
            "action": latest,
            "qty": chosen["quantity"],
            "vendor": obj.vendor,
            "dcRef": chosen["dcRef"],
            "date": chosen["date"],
            "remarks": chosen["remarks"],
            "expectedReturnDate": chosen["expectedReturnDate"],
        }


# ---------------------------------------------------------------------
# Event (Production History)
# ---------------------------------------------------------------------
class AssemblyExecutionEventSerializer(serializers.ModelSerializer):

    eventDate = serializers.DateField(
        source="event_date", read_only=True
    )
    event = serializers.CharField(
        source="event_text", read_only=True
    )

    class Meta:
        model = AssemblyExecutionEvent
        fields = ["id", "eventDate", "event"]
        read_only_fields = fields


# ---------------------------------------------------------------------
# Execution header — the full assembly the frontend renders
# ---------------------------------------------------------------------
class AssemblyExecutionSerializer(serializers.ModelSerializer):

    assemblyId = serializers.CharField(
        source="assembly.assembly_id", read_only=True
    )
    project = serializers.SerializerMethodField()
    projectId = serializers.IntegerField(
        source="assembly.project_id", read_only=True
    )
    plannedQty = serializers.SerializerMethodField()
    createdDate = serializers.SerializerMethodField()

    stages = AssemblyStageExecutionSerializer(
        many=True, read_only=True
    )
    events = AssemblyExecutionEventSerializer(
        many=True, read_only=True
    )

    status = serializers.CharField(read_only=True)

    class Meta:
        model = AssemblyExecution
        fields = [
            "id",
            "assemblyId",
            "project",
            "projectId",
            "plannedQty",
            "createdDate",
            "status",
            "started_at",
            "completed_at",
            "stages",
            "events",
        ]
        read_only_fields = fields

    def get_project(self, obj):
        return obj.assembly.project.code if obj.assembly.project else ""

    def get_plannedQty(self, obj):
        """
        An Assembly is ONE buildable unit.

        Its `inputs` describe the recipe — "these materials go INTO
        this one assembly" — they do NOT multiply the planned qty.
        Every Assembly produces exactly 1 unit.
        """
        return 1.0

    def get_createdDate(self, obj):
        return obj.created_at.date().isoformat()







# =====================================================================
# DISPATCH SERIALIZERS
# =====================================================================

from .models import (
    DispatchTransaction,
    DispatchNumberSettings,
    AssemblyExecution,
)


class DispatchTransactionSerializer(serializers.ModelSerializer):
    """
    Read shape for one dispatch shipment row.
    """

    id = serializers.IntegerField(read_only=True)

    dispatchId = serializers.CharField(
        source="dispatch_number", read_only=True
    )

    date = serializers.DateField(
        source="dispatch_date", read_only=True
    )

    time = serializers.CharField(
        source="dispatch_time", read_only=True
    )

    assemblyId = serializers.CharField(
        source="assembly_code", read_only=True
    )

    project = serializers.CharField(
        source="project_code", read_only=True
    )

    dwgDescription = serializers.CharField(
        source="dwg_description", read_only=True
    )

    revision = serializers.CharField(read_only=True)

    dispatchTo = serializers.CharField(
        source="dispatch_to", read_only=True
    )

    location = serializers.CharField(read_only=True)

    vehicleNumber = serializers.CharField(
        source="vehicle_number", read_only=True
    )

    transporter = serializers.CharField(read_only=True)

    driverName = serializers.CharField(
        source="driver_name", read_only=True
    )

    driverContact = serializers.CharField(
        source="driver_contact", read_only=True
    )

    qty = serializers.FloatField(source="quantity", read_only=True)

    remarks = serializers.CharField(read_only=True)

    dcChallanNumber = serializers.CharField(
        source="dc_challan_number", read_only=True
    )

    deliveryChallanId = serializers.IntegerField(
        source="delivery_challan_id", read_only=True
    )

    createdAt = serializers.DateTimeField(
        source="created_at", read_only=True
    )

    class Meta:
        model = DispatchTransaction
        fields = [
            "id",
            "dispatchId",
            "date",
            "time",
            "assemblyId",
            "project",
            "dwgDescription",
            "revision",
            "dispatchTo",
            "location",
            "vehicleNumber",
            "transporter",
            "driverName",
            "driverContact",
            "qty",
            "remarks",
            "dcChallanNumber",
            "deliveryChallanId",
            "createdAt",
        ]
        read_only_fields = fields


class DispatchCreateSerializer(serializers.Serializer):
    """
    Write shape for creating a dispatch.
    """

    date = serializers.DateField()

    time = serializers.CharField(
        required=False, allow_blank=True, max_length=10
    )

    dispatchTo = serializers.CharField(max_length=255)

    location = serializers.CharField(
        required=False, allow_blank=True, max_length=255
    )

    vehicleNumber = serializers.CharField(
        required=False, allow_blank=True, max_length=50
    )

    transporter = serializers.CharField(
        required=False, allow_blank=True, max_length=255
    )

    driverName = serializers.CharField(
        required=False, allow_blank=True, max_length=150
    )

    driverContact = serializers.CharField(
        required=False, allow_blank=True, max_length=50
    )

    qty = serializers.DecimalField(
        max_digits=15,
        decimal_places=3,
        min_value=Decimal("0.001"),
    )

    remarks = serializers.CharField(
        required=False, allow_blank=True
    )

    dcChallanNumber = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=100,
    )

    deliveryChallanId = serializers.IntegerField(
        required=False,
        allow_null=True,
    )

    def validate_dcChallanNumber(self, value):
        return (value or "").strip()
class DispatchReadyAssemblySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    assemblyId = serializers.CharField()
    project = serializers.CharField(allow_blank=True)
    projectId = serializers.IntegerField(allow_null=True)

    dwgs = serializers.ListField(child=serializers.CharField())
    dwgText = serializers.CharField(allow_blank=True)
    revision = serializers.CharField(allow_blank=True)
    description = serializers.CharField(allow_blank=True)

    plannedQty = serializers.FloatField()
    dispatchedQty = serializers.FloatField()
    balanceQty = serializers.FloatField()
    dispatchStatus = serializers.CharField()

    productionStartDate = serializers.DateField(allow_null=True)
    productionEndDate = serializers.DateField(allow_null=True)
    duration = serializers.CharField(allow_blank=True)

    # ---- Completion comparison ----
    plannedEndDate = serializers.DateField(allow_null=True)
    actualEndDate = serializers.DateField(allow_null=True)
    completionStatus = serializers.CharField(allow_blank=True)
    completionDaysVariance = serializers.IntegerField(allow_null=True)

    # ---- Dispatch rollup ----
    firstDispatchDate = serializers.DateField(allow_null=True)
    lastDispatchDate = serializers.DateField(allow_null=True)

    processChain = serializers.ListField()
    reworkPendingQty = serializers.FloatField()

    dcReferences = serializers.ListField(child=serializers.CharField())
    dispatches = serializers.ListField()



"""
Serializers for the Material Reports module.

Every report row is a plain dict built by reports_services.py.
These serializers exist for shape documentation, OpenAPI
introspection, and to give the row-list endpoints a consistent
`many=True` render path.
"""

from rest_framework import serializers


# =====================================================================
# KPI CARD
# =====================================================================

class KpiCardSerializer(serializers.Serializer):
    label = serializers.CharField()
    value = serializers.IntegerField()
    cls   = serializers.CharField()


# =====================================================================
# GENERIC REPORT ROW
# ---------------------------------------------------------------------
# Free-form. Every report has its own column set, and the frontend's
# `fmt()` renders whatever's here. Using DictField lets the row
# builder stay the single source of truth.
# =====================================================================

class ReportRowSerializer(serializers.DictField):
    """
    Any JSON-safe dict. Used with many=True to serialize a whole
    list of rows in one call.
    """
    child = serializers.JSONField()


# =====================================================================
# MOVEMENT EVENT
# =====================================================================

class MovementEventSerializer(serializers.Serializer):
    movementId    = serializers.CharField()
    date          = serializers.CharField()
    time          = serializers.CharField()
    movementType  = serializers.CharField()
    source        = serializers.CharField()
    destination   = serializers.CharField()

    projectId     = serializers.IntegerField(allow_null=True, required=False)
    projectCode   = serializers.CharField()
    projectName   = serializers.CharField()

    po            = serializers.CharField()
    poDescription = serializers.CharField()
    poItemCode    = serializers.CharField()

    dwg           = serializers.CharField()
    assembly      = serializers.CharField()

    material      = serializers.CharField()
    thickness     = serializers.CharField()
    size          = serializers.CharField()
    pieceNumber   = serializers.CharField()

    quantity      = serializers.CharField()
    unit          = serializers.CharField()
    referenceId   = serializers.CharField()
    status        = serializers.CharField()
    process       = serializers.CharField()


# =====================================================================
# MOVEMENT GROUP
# =====================================================================

class MovementGroupSerializer(serializers.Serializer):
    groupKey         = serializers.CharField()

    projectId        = serializers.IntegerField(allow_null=True, required=False)
    projectCode      = serializers.CharField()
    projectName      = serializers.CharField()

    poNumber         = serializers.CharField()
    poDescription    = serializers.CharField()
    poItemCodes      = serializers.ListField(child=serializers.CharField())

    dwg              = serializers.CharField()
    assembly         = serializers.CharField()

    material         = serializers.CharField()
    thickness        = serializers.CharField()
    size             = serializers.CharField()
    unit             = serializers.CharField()
    process          = serializers.CharField()

    pieceLabel       = serializers.CharField()
    qtyLabel         = serializers.CharField()

    currentStage     = serializers.CharField()
    currentStatus    = serializers.CharField()
    currentLocation  = serializers.CharField()
    lastMovementDate = serializers.CharField()
    eventCount       = serializers.IntegerField()
    events           = MovementEventSerializer(many=True)


# =====================================================================
# PROJECT INDEX (for the picker)
# =====================================================================

class MovementProjectEntrySerializer(serializers.Serializer):
    projectId        = serializers.IntegerField()
    code             = serializers.CharField()
    name             = serializers.CharField()
    poCount          = serializers.IntegerField()
    movementCount    = serializers.IntegerField()
    lastMovementDate = serializers.CharField()


# =====================================================================
# PO INDEX (for the picker)
# =====================================================================

class MovementPOEntrySerializer(serializers.Serializer):
    poNumber   = serializers.CharField()
    poType     = serializers.CharField()
    supplier   = serializers.CharField()
    projectIds = serializers.ListField(child=serializers.IntegerField())


