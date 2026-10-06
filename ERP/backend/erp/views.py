from django.db import models
from django.shortcuts import render
from django.db import transaction
from decimal import Decimal
from django.db.models import Sum
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import (
    PurchaseOrder,
    PurchaseOrderItem,
    DummyPurchaseOrderItem,
    ConsumableIssue,
    BOMPOIntegration,
    MaterialGRN,
    MaterialGRNNumberSettings,
)
from .serializers import JobWorkReceiveSerializer, MaterialGRNSerializer, ProductionIssueSerializer
from .permissions import IsMaterialPlanning
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import (
    BOMPOIntegration,
    ConsumableIssue,
    ConsumableReturn,
    PurchaseOrder,
    PurchaseOrderItem,
    ConsumableGRN,
)
from django.db import transaction
from django.db.models import F
from .serializers import (
    ConsumableGRNSerializer,
    ConsumableIssueSerializer,
    ConsumableReturnSerializer,
    CustomerSerializer,
    DeliveryChallanSerializer,
    ProformaInvoiceSerializer,
    PurchaseOrderSerializer,
    QuotationSerializer,
    TaxInvoiceSerializer,
)
from .models import (
    Customer,
    DeliveryChallan,
    DeliveryChallanNumberSettings,
    EmployeeCodeSettings,
    ProformaInvoice,
    ProformaInvoiceNumberSettings,
    PurchaseOrder,
    PurchaseOrderNumberSettings,
    Quotation,
    QuotationNumberSettings,
    TaxInvoice,
    TaxInvoiceNumberSettings,
    User,
)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Quotation, QuotationNumberSettings

from .permissions import IsAccounts, IsAccountsOrMaterialPlanning
from rest_framework import generics
from rest_framework.response import Response
from rest_framework import status

from .models import PurchaseOrder, PurchaseOrderNumberSettings
from .serializers import PurchaseOrderSerializer, QuotationSerializer
from .permissions import IsAccounts
from django.db import transaction
from django.db import transaction

from rest_framework import generics, status
from rest_framework.response import Response

from .models import (
    PurchaseOrder,
    PurchaseOrderNumberSettings,
    Customer,
)
from .serializers import PurchaseOrderSerializer
from .permissions import IsAccounts
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.middleware.csrf import get_token

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from decimal import Decimal, InvalidOperation
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from .models import User
from .serializers import ChangePasswordSerializer, LoginSerializer, ProfileSerializer
from .permissions import IsERPAdmin, IsMaterialPlanning

from .serializers import LoginSerializer


class LoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": "Login failed.",
                    "errors": serializer.errors,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user = serializer.validated_data["user"]

        refresh = RefreshToken.for_user(user)
        access = refresh.access_token

        response = Response(
            {
                "success": True,
                "message": "Login successful.",
                "access": str(access),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "user_type": user.user_type,
                },
            },
            status=status.HTTP_200_OK,
        )

        # Refresh token goes ONLY into HttpOnly cookie
        response.set_cookie(
            key=settings.REFRESH_COOKIE_NAME,
            value=str(refresh),
            max_age=7 * 24 * 60 * 60,
            httponly=settings.REFRESH_COOKIE_HTTPONLY,
            secure=settings.REFRESH_COOKIE_SECURE,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
            path=settings.REFRESH_COOKIE_PATH,
        )

        # Creates Django CSRF cookie
        get_token(request)

        return response
    
class RefreshTokenAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get(
            settings.REFRESH_COOKIE_NAME
        )

        if not refresh_token:
            return Response(
                {
                    "success": False,
                    "message": "Refresh token not found.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = TokenRefreshSerializer(
            data={
                "refresh": refresh_token
            }
        )

        try:
            serializer.is_valid(raise_exception=True)

        except Exception:
            response = Response(
                {
                    "success": False,
                    "message": "Refresh token is invalid or expired.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

            response.delete_cookie(
                settings.REFRESH_COOKIE_NAME,
                path=settings.REFRESH_COOKIE_PATH,
            )

            return response

        data = serializer.validated_data

        new_access = data["access"]

        response_data = {
            "success": True,
            "access": new_access,
        }

        response = Response(
            response_data,
            status=status.HTTP_200_OK,
        )

        
        new_refresh = data.get("refresh")

        if new_refresh:
            response.set_cookie(
                key=settings.REFRESH_COOKIE_NAME,
                value=new_refresh,
                max_age=7 * 24 * 60 * 60,
                httponly=settings.REFRESH_COOKIE_HTTPONLY,
                secure=settings.REFRESH_COOKIE_SECURE,
                samesite=settings.REFRESH_COOKIE_SAMESITE,
                path=settings.REFRESH_COOKIE_PATH,
            )

        return response

class LogoutAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get(
            settings.REFRESH_COOKIE_NAME
        )

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

        response = Response(
            {
                "success": True,
                "message": "Logged out successfully.",
            },
            status=status.HTTP_200_OK,
        )

        response.delete_cookie(
            key=settings.REFRESH_COOKIE_NAME,
            path=settings.REFRESH_COOKIE_PATH,
        )

        return response

# for only development purpose, remove this in production
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import UserProfile
from .serializers import UserProfileSerializer


class UserProfileListCreateAPIView(generics.ListCreateAPIView):
   
    queryset = UserProfile.objects.select_related("user").all()
    serializer_class = UserProfileSerializer
    permission_classes = [AllowAny]


class UserProfileDetailAPIView(generics.RetrieveUpdateAPIView):
    queryset = UserProfile.objects.select_related("user").all()
    serializer_class = UserProfileSerializer
    permission_classes = [AllowAny]

    lookup_field = "id"
   
#FOR PROFILE VIEW API

from rest_framework.parsers import MultiPartParser, FormParser, JSONParser


class ProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    # ==================================================
    # GET
    # ==================================================
    def get(self, request):
        serializer = ProfileSerializer(
            request.user,
            context={"request": request},
        )
        return Response(
            {
                "success": True,
                "message": "Profile retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    # ==================================================
    # PATCH — photo only, saved on the Employee row
    # ==================================================
    def patch(self, request):
        photo = request.FILES.get("profile_photo")

        if not photo:
            return Response(
                {"success": False, "message": "No image was uploaded."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content_type = getattr(photo, "content_type", "") or ""
        if not content_type.startswith("image/"):
            return Response(
                {"success": False, "message": "Only image files are allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if photo.size > 5 * 1024 * 1024:
            return Response(
                {"success": False, "message": "Image must be 5 MB or smaller."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------------------------------
        # Resolve the Employee row for this user
        # (same match order as the serializer helper)
        # --------------------------------------------------
        employee = (
            Employee.objects.filter(user=request.user).first()
        )

        if employee is None:
            employee = (
                Employee.objects
                .filter(created_by=request.user)
                .order_by("-created_at")
                .first()
            )

        if employee is None and request.user.email:
            employee = (
                Employee.objects
                .filter(email__iexact=request.user.email)
                .order_by("-created_at")
                .first()
            )

        if employee is None and request.user.username:
            employee = (
                Employee.objects
                .filter(first_name__iexact=request.user.username)
                .order_by("-created_at")
                .first()
            )

        if employee is None:
            return Response(
                {
                    "success": False,
                    "message": "No employee record found for this account.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------------------------------
        # Replace the old file
        # --------------------------------------------------
        if employee.photo:
            try:
                employee.photo.delete(save=False)
            except Exception:
                pass

        employee.photo = photo

        # Save photo and keep the link to this user
        if employee.user_id is None:
            employee.user = request.user
            employee.save(update_fields=["photo", "user", "updated_at"])
        else:
            employee.save(update_fields=["photo", "updated_at"])

        serializer = ProfileSerializer(
            request.user,
            context={"request": request},
        )

        return Response(
            {
                "success": True,
                "message": "Profile photo updated successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Attendance
from .serializers import MyAttendanceSerializer

from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Attendance
from .serializers import MyAttendanceSerializer


class MyAttendanceAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        # --------------------------------------------
        # Get logged-in employee
        # --------------------------------------------
        try:
            employee = request.user.employee
        except Exception:
            employee = None

        if employee is None:
            return Response(
                {
                    "success": False,
                    "message": "No employee record is linked to this account.",
                    "data": [],
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # --------------------------------------------
        # Get year/month from query parameters
        # --------------------------------------------
        current_date = timezone.localdate()

        year_param = request.query_params.get("year")
        month_param = request.query_params.get("month")

        try:
            year = int(year_param) if year_param else current_date.year
            month = int(month_param) if month_param else current_date.month

            if month < 1 or month > 12:
                raise ValueError

        except (TypeError, ValueError):
            return Response(
                {
                    "success": False,
                    "message": "Invalid year or month. Example: ?year=2026&month=10",
                    "data": [],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------------------------
        # Filter attendance for selected month
        # --------------------------------------------
        attendance_records = (
            Attendance.objects
            .filter(
                employee=employee,
                date__year=year,
                date__month=month,
            )
            .order_by("date")
        )

        serializer = MyAttendanceSerializer(
            attendance_records,
            many=True,
        )

        return Response(
            {
                "success": True,
                "message": "Attendance records retrieved successfully.",
                "data": {
                    "employee": {
                        "employee_id": employee.employee_id,
                        "name": employee.full_name,
                    },
                    "year": year,
                    "month": month,
                    "records": serializer.data,
                },
            },
            status=status.HTTP_200_OK,
        )

    

    
class ProfilePhotoDeleteAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        # --------------------------------------------------
        # Resolve the Employee row for this user
        # (same fallback chain used everywhere else)
        # --------------------------------------------------
        employee = Employee.objects.filter(user=request.user).first()

        if employee is None:
            employee = (
                Employee.objects
                .filter(created_by=request.user)
                .order_by("-created_at")
                .first()
            )

        if employee is None and request.user.email:
            employee = (
                Employee.objects
                .filter(email__iexact=request.user.email)
                .order_by("-created_at")
                .first()
            )

        if employee is None and request.user.username:
            employee = (
                Employee.objects
                .filter(first_name__iexact=request.user.username)
                .order_by("-created_at")
                .first()
            )

        if employee is None:
            return Response(
                {
                    "success": False,
                    "message": "No employee record found for this account.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not employee.photo:
            return Response(
                {
                    "success": False,
                    "message": "No photo to remove.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------------------------------
        # Delete the file from disk and clear the field
        # --------------------------------------------------
        try:
            employee.photo.delete(save=False)
        except Exception:
            pass

        employee.photo = None
        employee.save(update_fields=["photo", "updated_at"])

        # --------------------------------------------------
        # Echo back the fresh profile
        # --------------------------------------------------
        serializer = ProfileSerializer(
            request.user,
            context={"request": request},
        )

        return Response(
            {
                "success": True,
                "message": "Profile photo removed successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

class ChangePasswordAPIView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={
                "request": request,
            },
        )

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": "Password change failed.",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user

        user.set_password(
            serializer.validated_data["newPassword"]
        )

        user.save(
            update_fields=["password"]
        )

        return Response(
            {
                "success": True,
                "message": "Password changed successfully.",
            },
            status=status.HTTP_200_OK,
        )





#accounts module starts here

from .permissions import IsAccounts

class AccountsModulesAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAccounts]

    def get(self, request):
        return Response({
            "modules": [
                {
                    "title": "Purchase Order",
                    "short": "PO",
                    "description": "Create and manage Purchase Orders.",
                    "path": "/accounts/PO",
                    "color": "#0f766e",
                    "icon": "purchase-order",
                },
                {
                    "title": "Quotation",
                    "short": "QO",
                    "description": "Create and manage Quotations.",
                    "path": "/accounts/QO",
                    "color": "#1d4ed8",
                    "icon": "quotation",
                },
                {
                    "title": "Tax Invoice",
                    "short": "TI",
                    "description": "Create and manage Tax Invoices.",
                    "path": "/accounts/TaxInvoice",
                    "color": "#b45309",
                    "icon": "tax-invoice",
                },
                {
                    "title": "Delivery Challan",
                    "short": "DC",
                    "description": "Create and manage Delivery Challans.",
                    "path": "/accounts/DeliveryChallan",
                    "color": "#7c3aed",
                    "icon": "delivery-challan",
                },
                {
                    "title": "Proforma Invoice",
                    "short": "PI",
                    "description": "Create and manage Proforma Invoices.",
                    "path": "/accounts/ProformaInvoice",
                    "color": "#dc2626",
                    "icon": "proforma-invoice",
                },
                {
                    "title": "Report",
                    "short": "RP",
                    "description": "View and manage all accounting reports.",
                    "path": "/accounts/Report",
                    "color": "#374151",
                    "icon": "report",
                },
                {
                    "title": "Journal",
                    "short": "JR",
                    "description": "Record and manage financial transactions.",
                    "path": "/accounts/ExpenseProfit",
                    "color": "#475569",
                    "icon": "journal",
                },
            ]
        })



class PurchaseOrderListCreateAPIView(
    generics.ListCreateAPIView
):

    queryset = PurchaseOrder.objects.select_related(
        "created_by"
    ).all()

    serializer_class = PurchaseOrderSerializer

    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):

        with transaction.atomic():

            # ==================================================
            # 1. COPY REQUEST DATA
            # ==================================================

            data = request.data.copy()

            # ==================================================
            # 2. CREATE-OR-PATCH DECISION
            # --------------------------------------------------
            # If the client sent a po_number that already exists,
            # we PATCH that PO instead of creating a duplicate.
            # Otherwise we fall through to normal CREATE.
            # ==================================================

            incoming_po_number = (
                str(data.get("po_number", "")).strip()
            )

            existing_po = None

            if incoming_po_number:

                existing_po = (
                    PurchaseOrder.objects
                    .select_for_update()
                    .filter(po_number=incoming_po_number)
                    .first()
                )

            if existing_po is not None:

                # ==============================================
                # 3A. PATCH PATH
                # ==============================================

                # PO number is server-owned; never overwrite it.
                data.pop("po_number", None)

                # ----------------------------------------------
                # Customer upsert (same rules as create path)
                # ----------------------------------------------

                vendor_data = data.get("vendor", {})

                if vendor_data and not isinstance(
                    vendor_data, dict
                ):

                    return Response(
                        {
                            "success": False,
                            "message": (
                                "Invalid customer/vendor data."
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                customer = None

                if isinstance(vendor_data, dict) and vendor_data:

                    company_name = (
                        vendor_data.get(
                            "companyName", ""
                        ).strip()
                    )

                    if not company_name:

                        return Response(
                            {
                                "success": False,
                                "message": (
                                    "Customer company name "
                                    "is required."
                                ),
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    customer = (
                        Customer.objects
                        .filter(
                            company_name__iexact=company_name
                        )
                        .first()
                    )

                    if customer:

                        customer.address = (
                            vendor_data.get(
                                "address1", customer.address
                            )
                            or customer.address
                        )

                        customer.contact_person = (
                            vendor_data.get(
                                "contactPerson",
                                customer.contact_person,
                            )
                            or customer.contact_person
                        )

                        customer.phone = (
                            vendor_data.get(
                                "phone", customer.phone
                            )
                            or customer.phone
                        )

                        customer.email = (
                            vendor_data.get(
                                "email", customer.email
                            )
                            or customer.email
                        )

                        customer.gst_number = (
                            vendor_data.get(
                                "gst", customer.gst_number
                            )
                            or customer.gst_number
                        )

                        customer.source = (
                            Customer.Source.PURCHASE_ORDER
                        )

                        customer.save()

                    else:

                        customer = Customer.objects.create(

                            company_name=company_name,

                            address=vendor_data.get(
                                "address1", ""
                            ),

                            contact_person=vendor_data.get(
                                "contactPerson", ""
                            ),

                            phone=vendor_data.get("phone", ""),

                            email=vendor_data.get("email", ""),

                            gst_number=vendor_data.get("gst", ""),

                            source=(
                                Customer.Source.PURCHASE_ORDER
                            ),
                        )

                # ----------------------------------------------
                # Validate as PARTIAL update against existing PO
                # ----------------------------------------------

                serializer = self.get_serializer(
                    existing_po,
                    data=data,
                    partial=True,
                )

                serializer.is_valid(raise_exception=True)

                # ----------------------------------------------
                # Save (po_number preserved from instance)
                # ----------------------------------------------

                purchase_order = serializer.save()

                # ----------------------------------------------
                # Response (same shape as CREATE)
                # ----------------------------------------------

                response_serializer = self.get_serializer(
                    purchase_order
                )

                response_data = {
                    "success": True,
                    "message": (
                        "Purchase Order updated successfully."
                    ),
                    "data": response_serializer.data,
                }

                if customer is not None:

                    response_data["customer"] = {
                        "id": customer.id,
                        "company_name": customer.company_name,
                        "address": customer.address,
                        "contact_person": (
                            customer.contact_person
                        ),
                        "phone": customer.phone,
                        "email": customer.email,
                        "gst_number": customer.gst_number,
                        "source": customer.source,
                    }

                return Response(
                    response_data,
                    status=status.HTTP_200_OK,
                )

            # ==================================================
            # 3B. CREATE PATH (no existing PO with this number)
            # ==================================================

            # ----------------------------------------------
            # Lock PO number settings
            # ----------------------------------------------

            settings_obj = (
                PurchaseOrderNumberSettings.objects
                .select_for_update()
                .filter(is_active=True)
                .first()
            )

            if not settings_obj:

                return Response(
                    {
                        "success": False,
                        "message": (
                            "Purchase Order number settings "
                            "have not been configured."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ----------------------------------------------
            # Generate PO number
            # ----------------------------------------------

            po_number = (
                f"{settings_obj.prefix}"
                f"{settings_obj.next_number:0{settings_obj.number_padding}d}"
            )

            # Always server-generated on CREATE.
            data.pop("po_number", None)

            # ----------------------------------------------
            # Customer data
            # ----------------------------------------------

            vendor_data = data.get("vendor", {})

            if not isinstance(vendor_data, dict):

                return Response(
                    {
                        "success": False,
                        "message": (
                            "Invalid customer/vendor data."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            company_name = (
                vendor_data.get("companyName", "").strip()
            )

            if not company_name:

                return Response(
                    {
                        "success": False,
                        "message": (
                            "Customer company name is required."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            customer = (
                Customer.objects
                .filter(company_name__iexact=company_name)
                .first()
            )

            if customer:

                customer.address = (
                    vendor_data.get(
                        "address1", customer.address
                    )
                    or customer.address
                )

                customer.contact_person = (
                    vendor_data.get(
                        "contactPerson",
                        customer.contact_person,
                    )
                    or customer.contact_person
                )

                customer.phone = (
                    vendor_data.get("phone", customer.phone)
                    or customer.phone
                )

                customer.email = (
                    vendor_data.get("email", customer.email)
                    or customer.email
                )

                customer.gst_number = (
                    vendor_data.get(
                        "gst", customer.gst_number
                    )
                    or customer.gst_number
                )

                customer.source = (
                    Customer.Source.PURCHASE_ORDER
                )

                customer.save()

            else:

                customer = Customer.objects.create(

                    company_name=company_name,

                    address=vendor_data.get("address1", ""),

                    contact_person=vendor_data.get(
                        "contactPerson", ""
                    ),

                    phone=vendor_data.get("phone", ""),

                    email=vendor_data.get("email", ""),

                    gst_number=vendor_data.get("gst", ""),

                    source=Customer.Source.PURCHASE_ORDER,
                )

            # ----------------------------------------------
            # Validate
            # ----------------------------------------------

            serializer = self.get_serializer(data=data)

            serializer.is_valid(raise_exception=True)

            # ----------------------------------------------
            # Save (next_number is NOT incremented here;
            #       it advances only on terminal status)
            # ----------------------------------------------

            purchase_order = serializer.save(

                po_number=po_number,

                created_by=request.user,
            )

        # ======================================================
        # 4. CREATE RESPONSE
        # ======================================================

        response_serializer = self.get_serializer(purchase_order)

        return Response(
            {
                "success": True,

                "message": (
                    "Purchase Order created successfully."
                ),

                "data": response_serializer.data,

                "customer": {
                    "id": customer.id,
                    "company_name": customer.company_name,
                    "address": customer.address,
                    "contact_person": customer.contact_person,
                    "phone": customer.phone,
                    "email": customer.email,
                    "gst_number": customer.gst_number,
                    "source": customer.source,
                },
            },
            status=status.HTTP_201_CREATED,
        )


#FOR GET PO NUMBER 

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

class NextPurchaseOrderNumberAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings_obj = (
            PurchaseOrderNumberSettings.objects
            .filter(is_active=True)
            .first()
        )

        if not settings_obj:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Purchase Order number settings "
                        "have not been configured."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # -----------------------------------------
        # 1. Generate current PO number
        # -----------------------------------------

        po_number = (
            f"{settings_obj.prefix}"
            f"{settings_obj.next_number:0{settings_obj.number_padding}d}"
        )

        # -----------------------------------------
        # 2. Check current PO
        # -----------------------------------------

        existing_po = (
            PurchaseOrder.objects
            .select_related("created_by")
            .filter(po_number=po_number)
            .first()
        )

        # -----------------------------------------
        # 3. Current PO EXISTS
        # -----------------------------------------

        if existing_po is not None:

            serializer = PurchaseOrderSerializer(existing_po)

            return Response(
                {
                    "success": True,
                    "is_new": False,
                    "po_number": po_number,
                    "data": serializer.data,
                },
                status=status.HTTP_200_OK
            )

        # -----------------------------------------
        # 4. Current PO DOES NOT EXIST
        #    Get previous PO
        # -----------------------------------------

        previous_po = (
            PurchaseOrder.objects
            .select_related("created_by")
            .order_by("-id")
            .first()
        )

        # -----------------------------------------
        # 5. No previous PO exists
        # -----------------------------------------

        if previous_po is None:
            return Response(
                {
                    "success": True,
                    "is_new": True,
                    "po_number": po_number,
                    "data": None,
                },
                status=status.HTTP_200_OK
            )

        # -----------------------------------------
        # 6. Copy previous PO data
        #    but use NEW PO number
        # -----------------------------------------

        serializer = PurchaseOrderSerializer(previous_po)

        previous_data = serializer.data.copy()

        previous_data["po_number"] = po_number

        return Response(
            {
                "success": True,
                "is_new": True,
                "po_number": po_number,
                "previous_po_number": previous_po.po_number,
                "data": previous_data,
            },
            status=status.HTTP_200_OK
        )
#for customer in all form


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Customer
from .serializers import CustomerSerializer
from .permissions import IsAccounts


class CustomerAPIView(APIView):

    permission_classes = [IsAccounts]

    # =========================
    # GET
    # =========================

    def get(self, request, pk=None):

        # GET /customers/
        if pk is None:
            customers = Customer.objects.all()

            serializer = CustomerSerializer(
                customers,
                many=True,
            )

            return Response(
                {
                    "success": True,
                    "message": "Customers retrieved successfully.",
                    "data": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        # GET /customers/<id>/
        try:
            customer = Customer.objects.get(pk=pk)

        except Customer.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "message": "Customer not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CustomerSerializer(customer)

        return Response(
            {
                "success": True,
                "message": "Customer retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    # =========================
    # POST
    # =========================

    def post(self, request):

        serializer = CustomerSerializer(
            data=request.data
        )

        if serializer.is_valid():

            customer = serializer.save(
                source=Customer.Source.PURCHASE_ORDER
            )

            return Response(
                {
                    "success": True,
                    "message": "Customer created successfully.",
                    "data": CustomerSerializer(
                        customer
                    ).data,
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {
                "success": False,
                "message": "Customer validation failed.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # =========================
    # PATCH
    # =========================

    def patch(self, request, pk=None):

        if pk is None:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Customer ID is required "
                        "for PATCH."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            customer = Customer.objects.get(pk=pk)

        except Customer.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "message": "Customer not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CustomerSerializer(
            customer,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():

            customer = serializer.save()

            return Response(
                {
                    "success": True,
                    "message": "Customer updated successfully.",
                    "data": CustomerSerializer(
                        customer
                    ).data,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "success": False,
                "message": "Customer validation failed.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

#FOR PO STATUS CHANGE AND PO NUMBER ALSO CHANGE 
from django.core.files.base import ContentFile
from rest_framework.parsers import MultiPartParser, FormParser
from django.views.decorators.csrf import csrf_protect
from django.utils.decorators import method_decorator
from rest_framework.permissions import AllowAny



@method_decorator(csrf_protect, name="dispatch")
class PurchaseOrderConfirmAPIView(APIView):

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, po_number):

        with transaction.atomic():

            # ============================================================
            # 1. Session check (HttpOnly refresh cookie)
            # ============================================================

            refresh_token = request.COOKIES.get(
                settings.REFRESH_COOKIE_NAME
            )

            if not refresh_token:
                return Response(
                    {
                        "success": False,
                        "message": "Session not found. Please login again.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            try:
                token = RefreshToken(refresh_token)
                user_id = token.get("user_id")
            except Exception:
                return Response(
                    {
                        "success": False,
                        "message": "Session is invalid or expired.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {
                        "success": False,
                        "message": "Session user no longer exists.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # ============================================================
            # 2. Accounts-department check (same rule as IsAccounts)
            # ============================================================

            if user.user_type != User.UserType.ACCOUNTS:
                return Response(
                    {
                        "success": False,
                        "message": "Accounts access required.",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            # ============================================================
            # 3. Locate the Purchase Order (locked)
            # ============================================================

            try:
                purchase_order = (
                    PurchaseOrder.objects
                    .select_for_update()
                    .get(po_number=po_number)
                )
            except PurchaseOrder.DoesNotExist:
                return Response(
                    {
                        "success": False,
                        "message": "Purchase Order not found.",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # ============================================================
            # 4. Read the uploaded PDF
            # ============================================================

            pdf_file = request.FILES.get("pdf")

            if not pdf_file:
                return Response(
                    {
                        "success": False,
                        "message": "No PDF file was uploaded.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ============================================================
            # 5. Save PDF under MEDIA/PO/PDF/
            # ============================================================

            safe_po = (
                str(po_number)
                .replace("/", "-")
                .replace("\\", "-")
            )
            filename = f"{safe_po}.pdf"

            # Overwrite any previous file so re-printing stays clean.
            if purchase_order.pdf_file:
                try:
                    purchase_order.pdf_file.delete(save=False)
                except Exception:
                    pass

            purchase_order.pdf_file.save(
                filename,
                ContentFile(pdf_file.read()),
                save=False,
            )

            # ============================================================
            # 6. Flip status to confirmed
            # ============================================================

            was_already_confirmed = (
                purchase_order.status
                == PurchaseOrder.Status.CONFIRMED
            )

            purchase_order.status = PurchaseOrder.Status.CONFIRMED

            purchase_order.save(
                update_fields=[
                    "pdf_file",
                    "status",
                    "updated_at",
                ]
            )

            # ============================================================
            # 7. Advance the PO number counter
            # ------------------------------------------------------------
            # Only on the first confirmation. Re-printing an
            # already-confirmed PO must NOT consume another number.
            # ============================================================

            if not was_already_confirmed:

                settings_obj = (
                    PurchaseOrderNumberSettings.objects
                    .select_for_update()
                    .filter(is_active=True)
                    .first()
                )

                if settings_obj:

                    settings_obj.next_number += 1

                    settings_obj.save(
                        update_fields=[
                            "next_number",
                            "updated_at",
                        ]
                    )

            # ============================================================
            # 8. Response
            # ============================================================

            serializer = PurchaseOrderSerializer(purchase_order)

            return Response(
                {
                    "success": True,
                    "message": "Purchase Order confirmed and PDF saved.",
                    "data": serializer.data,
                    "pdf_url": (
                        request.build_absolute_uri(
                            purchase_order.pdf_file.url
                        )
                        if purchase_order.pdf_file
                        else None
                    ),
                },
                status=status.HTTP_200_OK,
            )


# for quotation module
class QuotationNextNumberAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAccounts]

    def get(self, request):

        settings = (
            QuotationNumberSettings.objects
            .filter(is_active=True)
            .first()
        )

        if not settings:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Quotation number settings "
                        "have not been configured."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ==================================================
        # 1. Generate current quotation number
        # ==================================================

        quotation_number = (
            f"{settings.prefix}"
            f"{settings.next_number:0{settings.number_padding}d}"
        )

        # ==================================================
        # 2. Check whether current quotation already exists
        # ==================================================

        existing_quotation = (
            Quotation.objects
            .select_related("customer")
            .filter(
                quotation_number=quotation_number
            )
            .first()
        )

        # ==================================================
        # 3. CURRENT QUOTATION EXISTS
        # ==================================================

        if existing_quotation is not None:

            serializer = QuotationSerializer(
                existing_quotation
            )

            return Response(
                {
                    "success": True,
                    "is_new": False,
                    "quotation_number": quotation_number,
                    "data": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        # ==================================================
        # 4. CURRENT QUOTATION DOES NOT EXIST
        #    GET PREVIOUS QUOTATION
        # ==================================================

        previous_quotation = (
            Quotation.objects
            .select_related("customer")
            .order_by("-id")
            .first()
        )

        # ==================================================
        # 5. NO PREVIOUS QUOTATION
        # ==================================================

        if previous_quotation is None:

            return Response(
                {
                    "success": True,
                    "is_new": True,
                    "quotation_number": quotation_number,
                    "data": None,
                },
                status=status.HTTP_200_OK,
            )

        

        serializer = QuotationSerializer(
            previous_quotation
        )

        previous_data = serializer.data.copy()

        previous_data["quotation_number"] = (
            quotation_number
        )

        return Response(
            {
                "success": True,
                "is_new": True,
                "quotation_number": quotation_number,
                "previous_quotation_number": (
                    previous_quotation.quotation_number
                ),
                "data": previous_data,
            },
            status=status.HTTP_200_OK,
        )

    
class QuotationCustomerAPIView(APIView):

    permission_classes = [IsAccounts]

    # =========================
    # GET
    # =========================

    def get(self, request, pk=None):

        # GET /quotation-customers/
        if pk is None:

            customers = Customer.objects.filter(
                source=Customer.Source.QUOTATION
            )

            serializer = CustomerSerializer(
                customers,
                many=True,
            )

            return Response(
                {
                    "success": True,
                    "message": "Quotation customers retrieved successfully.",
                    "data": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        # GET /quotation-customers/<id>/
        try:
            customer = Customer.objects.get(
                pk=pk,
                source=Customer.Source.QUOTATION,
            )

        except Customer.DoesNotExist:

            return Response(
                {
                    "success": False,
                    "message": "Quotation customer not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CustomerSerializer(customer)

        return Response(
            {
                "success": True,
                "message": "Quotation customer retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    # =========================
    # POST
    # =========================

    def post(self, request):

        serializer = CustomerSerializer(
            data=request.data
        )

        if serializer.is_valid():

            customer = serializer.save(
                source=Customer.Source.QUOTATION
            )

            return Response(
                {
                    "success": True,
                    "message": "Quotation customer created successfully.",
                    "data": CustomerSerializer(
                        customer
                    ).data,
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {
                "success": False,
                "message": "Customer validation failed.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # =========================
    # PATCH
    # =========================

    def patch(self, request, pk=None):

        if pk is None:

            return Response(
                {
                    "success": False,
                    "message": (
                        "Customer ID is required "
                        "for PATCH."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            customer = Customer.objects.get(
                pk=pk,
                source=Customer.Source.QUOTATION,
            )

        except Customer.DoesNotExist:

            return Response(
                {
                    "success": False,
                    "message": "Quotation customer not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CustomerSerializer(
            customer,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():

            customer = serializer.save(
                source=Customer.Source.QUOTATION
            )

            return Response(
                {
                    "success": True,
                    "message": "Quotation customer updated successfully.",
                    "data": CustomerSerializer(
                        customer
                    ).data,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "success": False,
                "message": "Customer validation failed.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )



class QuotationCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAccounts]

    def post(self, request):

        with transaction.atomic():

            data = request.data.copy()

            # ==================================================
            # 1. CHECK EXISTING QUOTATION
            # ==================================================

            incoming_quotation_number = str(
                data.get("quotation_number", "")
            ).strip()

            existing_quotation = None

            if incoming_quotation_number:

                existing_quotation = (
                    Quotation.objects
                    .select_for_update()
                    .filter(
                        quotation_number=incoming_quotation_number
                    )
                    .first()
                )

            # ==================================================
            # 2. GET CUSTOMER NAME
            # ==================================================
            #
            # Frontend sends:
            #
            # "customer": "ABC Industries"
            #
            # We only find the existing customer.
            # We DO NOT create or update customer here.
            #
            # ==================================================

            customer_name = str(
                data.get("customer", "")
            ).strip()

            if not customer_name:

                return Response(
                    {
                        "success": False,
                        "message": "Customer company name is required.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ==================================================
            # 3. FIND EXISTING QUOTATION CUSTOMER
            # ==================================================

            customer = (
                Customer.objects
                .filter(
                    company_name__iexact=customer_name,
                    source=Customer.Source.QUOTATION,
                )
                .first()
            )

            if customer is None:

                return Response(
                    {
                        "success": False,
                        "message": "Quotation customer not found.",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # ==================================================
            # 4. CONVERT CUSTOMER NAME TO CUSTOMER ID
            # ==================================================

            data["customer_id"] = customer.id

            # Remove customer name because
            # QuotationSerializer uses customer/customer_id
            data.pop("customer", None)

            # ==================================================
            # 5. UPDATE EXISTING QUOTATION
            # ==================================================

            if existing_quotation is not None:

                # Quotation number is only used
                # to find the quotation.
                #
                # It must not be changed.

                data.pop("quotation_number", None)

                serializer = QuotationSerializer(
                    existing_quotation,
                    data=data,
                    partial=True,
                )

                serializer.is_valid(
                    raise_exception=True
                )

                quotation = serializer.save()

                # ----------------------------------------------
                # UPDATE RESPONSE
                # ----------------------------------------------

                response_serializer = QuotationSerializer(
                    quotation
                )

                return Response(
                    {
                        "success": True,
                        "message": "Quotation updated successfully.",
                        "data": response_serializer.data,
                    },
                    status=status.HTTP_200_OK,
                )

            # ==================================================
            # 6. CREATE NEW QUOTATION
            # ==================================================
            #
            # IMPORTANT:
            #
            # No quotation number generation here.
            # No quotation number increment here.
            #
            # Another API will handle quotation number.
            #
            # ==================================================

            # data.pop("quotation_number", None)

            # ==================================================
            # 7. VALIDATE QUOTATION
            # ==================================================

            serializer = QuotationSerializer(
                data=data
            )

            serializer.is_valid(
                raise_exception=True
            )

            # ==================================================
            # 8. CREATE QUOTATION
            # ==================================================

            quotation = serializer.save(
                customer=customer
            )

        # ==================================================
        # 9. RESPONSE
        # ==================================================

        response_serializer = QuotationSerializer(
            quotation
        )

        return Response(
            {
                "success": True,
                "message": "Quotation created successfully.",
                "data": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_protect, name="dispatch")
class QuotationConfirmAPIView(APIView):

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, quotation_number):

        with transaction.atomic():

            # ============================================================
            # 1. Session check (HttpOnly refresh cookie)
            # ============================================================

            refresh_token = request.COOKIES.get(
                settings.REFRESH_COOKIE_NAME
            )

            if not refresh_token:
                return Response(
                    {
                        "success": False,
                        "message": "Session not found. Please login again.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            try:
                token = RefreshToken(refresh_token)
                user_id = token.get("user_id")
            except Exception:
                return Response(
                    {
                        "success": False,
                        "message": "Session is invalid or expired.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {
                        "success": False,
                        "message": "Session user no longer exists.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # ============================================================
            # 2. Accounts-department check (same rule as IsAccounts)
            # ============================================================

            if user.user_type != User.UserType.ACCOUNTS:
                return Response(
                    {
                        "success": False,
                        "message": "Accounts access required.",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            # ============================================================
            # 3. Locate the Quotation (locked)
            # ============================================================

            try:
                quotation = (
                    Quotation.objects
                    .select_for_update()
                    .get(quotation_number=quotation_number)
                )
            except Quotation.DoesNotExist:
                return Response(
                    {
                        "success": False,
                        "message": "Quotation not found.",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # ============================================================
            # 4. Read the uploaded PDF
            # ============================================================

            pdf_file = request.FILES.get("pdf")

            if not pdf_file:
                return Response(
                    {
                        "success": False,
                        "message": "No PDF file was uploaded.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ============================================================
            # 5. Save PDF under MEDIA/quotations/
            # ============================================================

            safe_qtn = (
                str(quotation_number)
                .replace("/", "-")
                .replace("\\", "-")
            )
            filename = f"{safe_qtn}.pdf"

            # Overwrite any previous file so re-printing stays clean.
            if quotation.pdf_file:
                try:
                    quotation.pdf_file.delete(save=False)
                except Exception:
                    pass

            quotation.pdf_file.save(
                filename,
                ContentFile(pdf_file.read()),
                save=False,
            )

            # ============================================================
            # 6. Flip status to confirmed
            # ============================================================

            was_already_confirmed = (
                quotation.status
                == Quotation.Status.CONFIRMED
            )

            quotation.status = Quotation.Status.CONFIRMED

            quotation.save(
                update_fields=[
                    "pdf_file",
                    "status",
                    "updated_at",
                ]
            )

            # ============================================================
            # 7. Advance the quotation number counter
            # ------------------------------------------------------------
            # Only on the first confirmation. Re-printing an
            # already-confirmed quotation must NOT consume another number.
            # ============================================================

            if not was_already_confirmed:

                settings_obj = (
                    QuotationNumberSettings.objects
                    .select_for_update()
                    .filter(is_active=True)
                    .first()
                )

                if settings_obj:

                    settings_obj.next_number += 1

                    settings_obj.save(
                        update_fields=[
                            "next_number",
                            "updated_at",
                        ]
                    )

            # ============================================================
            # 8. Response
            # ============================================================

            serializer = QuotationSerializer(quotation)

            return Response(
                {
                    "success": True,
                    "message": "Quotation confirmed and PDF saved.",
                    "data": serializer.data,
                    "pdf_url": (
                        request.build_absolute_uri(
                            quotation.pdf_file.url
                        )
                        if quotation.pdf_file
                        else None
                    ),
                },
                status=status.HTTP_200_OK,
            )

#for dc


from .models import (
    Customer,
    DeliveryChallan,
    DeliveryChallanNumberSettings,
)
from .permissions import IsAccounts
from .serializers import (
    CustomerSerializer,
    DeliveryChallanSerializer,
)


# ==================================================================
# NEXT DC NUMBER
# ==================================================================
class DeliveryChallanNextNumberAPIView(APIView):
    permission_classes = [IsAuthenticated,IsAccountsOrMaterialPlanning ]

    def get(self, request):

        settings = (
            DeliveryChallanNumberSettings.objects
            .filter(is_active=True)
            .first()
        )

        if not settings:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Delivery challan number settings "
                        "have not been configured."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ==================================================
        # 1. Generate current DC number
        # ==================================================

        dc_number = (
            f"{settings.prefix}"
            f"{settings.next_number:0{settings.number_padding}d}"
        )

        # ==================================================
        # 2. Check whether current DC already exists
        # ==================================================

        existing_dc = (
            DeliveryChallan.objects
            .select_related("customer")
            .filter(dc_number=dc_number)
            .first()
        )

        # ==================================================
        # 3. CURRENT DC EXISTS
        # ==================================================

        if existing_dc is not None:

            serializer = DeliveryChallanSerializer(
                existing_dc
            )

            return Response(
                {
                    "success": True,
                    "is_new": False,
                    "dc_number": dc_number,
                    "data": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        # ==================================================
        # 4. CURRENT DC DOES NOT EXIST
        #    GET PREVIOUS DC
        # ==================================================

        previous_dc = (
            DeliveryChallan.objects
            .select_related("customer")
            .order_by("-id")
            .first()
        )

        # ==================================================
        # 5. NO PREVIOUS DC
        # ==================================================

        if previous_dc is None:

            return Response(
                {
                    "success": True,
                    "is_new": True,
                    "dc_number": dc_number,
                    "data": None,
                },
                status=status.HTTP_200_OK,
            )

        # ==================================================
        # 6. CLONE PREVIOUS DC
        # ==================================================

        serializer = DeliveryChallanSerializer(
            previous_dc
        )

        previous_data = serializer.data.copy()

        previous_data["dc_number"] = dc_number

        return Response(
            {
                "success": True,
                "is_new": True,
                "dc_number": dc_number,
                "previous_dc_number": (
                    previous_dc.dc_number
                ),
                "data": previous_data,
            },
            status=status.HTTP_200_OK,
        )


# ==================================================================
# DC CUSTOMERS (GET / POST / PATCH)
# ==================================================================
class DeliveryChallanCustomerAPIView(APIView):

    permission_classes = [IsAuthenticated, IsAccountsOrMaterialPlanning]

    # =========================
    # GET
    # =========================

    def get(self, request, pk=None):

        # GET /delivery-challan-customers/
        if pk is None:

            customers = Customer.objects.filter(
                source=Customer.Source.DELIVERY_CHALLAN
            )

            serializer = CustomerSerializer(
                customers,
                many=True,
            )

            return Response(
                {
                    "success": True,
                    "message": "Delivery challan customers retrieved successfully.",
                    "data": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        # GET /delivery-challan-customers/<id>/
        try:
            customer = Customer.objects.get(
                pk=pk,
                source=Customer.Source.DELIVERY_CHALLAN,
            )

        except Customer.DoesNotExist:

            return Response(
                {
                    "success": False,
                    "message": "Delivery challan customer not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CustomerSerializer(customer)

        return Response(
            {
                "success": True,
                "message": "Delivery challan customer retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    # =========================
    # POST
    # =========================

    def post(self, request):

        serializer = CustomerSerializer(
            data=request.data
        )

        if serializer.is_valid():

            customer = serializer.save(
                source=Customer.Source.DELIVERY_CHALLAN
            )

            return Response(
                {
                    "success": True,
                    "message": "Delivery challan customer created successfully.",
                    "data": CustomerSerializer(
                        customer
                    ).data,
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {
                "success": False,
                "message": "Customer validation failed.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # =========================
    # PATCH
    # =========================

    def patch(self, request, pk=None):

        if pk is None:

            return Response(
                {
                    "success": False,
                    "message": (
                        "Customer ID is required "
                        "for PATCH."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            customer = Customer.objects.get(
                pk=pk,
                source=Customer.Source.DELIVERY_CHALLAN,
            )

        except Customer.DoesNotExist:

            return Response(
                {
                    "success": False,
                    "message": "Delivery challan customer not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CustomerSerializer(
            customer,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():

            customer = serializer.save(
                source=Customer.Source.DELIVERY_CHALLAN
            )

            return Response(
                {
                    "success": True,
                    "message": "Delivery challan customer updated successfully.",
                    "data": CustomerSerializer(
                        customer
                    ).data,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "success": False,
                "message": "Customer validation failed.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


# ==================================================================
# CREATE / UPDATE DC
# ==================================================================
class DeliveryChallanCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAccountsOrMaterialPlanning]

    def post(self, request):

        with transaction.atomic():

            data = request.data.copy()

          

            incoming_dc_number = str(
                data.get("dc_number", "")
            ).strip()

            existing_dc = None

            if incoming_dc_number:

                existing_dc = (
                    DeliveryChallan.objects
                    .select_for_update()
                    .filter(
                        dc_number=incoming_dc_number
                    )
                    .first()
                )

           

            customer_name = str(
                data.get("customer", "")
            ).strip()

            if not customer_name:

                return Response(
                    {
                        "success": False,
                        "message": "Customer company name is required.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )


            customer = (
                Customer.objects
                .filter(
                    company_name__iexact=customer_name,
                    source=Customer.Source.DELIVERY_CHALLAN,
                )
                .first()
            )

            if customer is None:

                return Response(
                    {
                        "success": False,
                        "message": "Delivery challan customer not found.",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # ==================================================
            # 4. CONVERT CUSTOMER NAME TO CUSTOMER ID
            # ==================================================

            data["customer_id"] = customer.id

            # Remove customer name because
            # DeliveryChallanSerializer uses customer/customer_id
            data.pop("customer", None)

            

            if existing_dc is not None:

              

                data.pop("dc_number", None)

                serializer = DeliveryChallanSerializer(
                    existing_dc,
                    data=data,
                    partial=True,
                )

                serializer.is_valid(
                    raise_exception=True
                )

                dc = serializer.save()

                # ----------------------------------------------
                # UPDATE RESPONSE
                # ----------------------------------------------

                response_serializer = DeliveryChallanSerializer(
                    dc
                )

                return Response(
                    {
                        "success": True,
                        "message": "Delivery challan updated successfully.",
                        "data": response_serializer.data,
                    },
                    status=status.HTTP_200_OK,
                )

            

            # ==================================================
            # 7. VALIDATE DC
            # ==================================================

            serializer = DeliveryChallanSerializer(
                data=data
            )

            serializer.is_valid(
                raise_exception=True
            )

            # ==================================================
            # 8. CREATE DC
            # ==================================================

            dc = serializer.save(
                customer=customer
            )

        # ==================================================
        # 9. RESPONSE
        # ==================================================

        response_serializer = DeliveryChallanSerializer(
            dc
        )

        return Response(
            {
                "success": True,
                "message": "Delivery challan created successfully.",
                "data": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )



@method_decorator(csrf_protect, name="dispatch")
class DeliveryChallanConfirmAPIView(APIView):

    permission_classes = [IsAccountsOrMaterialPlanning,IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, dc_number):

        with transaction.atomic():

            # ============================================================
            # 1. Session check (HttpOnly refresh cookie)
            # ============================================================

            refresh_token = request.COOKIES.get(
                settings.REFRESH_COOKIE_NAME
            )

            if not refresh_token:
                return Response(
                    {
                        "success": False,
                        "message": "Session not found. Please login again.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            try:
                token = RefreshToken(refresh_token)
                user_id = token.get("user_id")
            except Exception:
                return Response(
                    {
                        "success": False,
                        "message": "Session is invalid or expired.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {
                        "success": False,
                        "message": "Session user no longer exists.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # ============================================================
            # 2. Accounts-department check (same rule as IsAccounts)
            # ============================================================

            if user.user_type != User.UserType.ACCOUNTS:
                return Response(
                    {
                        "success": False,
                        "message": "Accounts access required.",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            # ============================================================
            # 3. Locate the Delivery Challan (locked)
            # ============================================================

            try:
                dc = (
                    DeliveryChallan.objects
                    .select_for_update()
                    .get(dc_number=dc_number)
                )
            except DeliveryChallan.DoesNotExist:
                return Response(
                    {
                        "success": False,
                        "message": "Delivery Challan not found.",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # ============================================================
            # 4. Read the uploaded PDF
            # ============================================================

            pdf_file = request.FILES.get("pdf")

            if not pdf_file:
                return Response(
                    {
                        "success": False,
                        "message": "No PDF file was uploaded.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ============================================================
            # 5. Save PDF under MEDIA/delivery_challans/
            # ============================================================

            safe_dc = (
                str(dc_number)
                .replace("/", "-")
                .replace("\\", "-")
            )
            filename = f"{safe_dc}.pdf"

            # Overwrite any previous file so re-printing stays clean.
            if dc.pdf_file:
                try:
                    dc.pdf_file.delete(save=False)
                except Exception:
                    pass

            dc.pdf_file.save(
                filename,
                ContentFile(pdf_file.read()),
                save=False,
            )

            # ============================================================
            # 6. Flip status to confirmed
            # ============================================================

            was_already_confirmed = (
                dc.status
                == DeliveryChallan.Status.CONFIRMED
            )

            dc.status = DeliveryChallan.Status.CONFIRMED

            dc.save(
                update_fields=[
                    "pdf_file",
                    "status",
                    "updated_at",
                ]
            )

            # ============================================================
            # 7. Advance the DC number counter
            # ------------------------------------------------------------
            # Only on the first confirmation. Re-printing an
            # already-confirmed DC must NOT consume another number.
            # ============================================================

            if not was_already_confirmed:

                settings_obj = (
                    DeliveryChallanNumberSettings.objects
                    .select_for_update()
                    .filter(is_active=True)
                    .first()
                )

                if settings_obj:

                    settings_obj.next_number += 1

                    settings_obj.save(
                        update_fields=[
                            "next_number",
                            "updated_at",
                        ]
                    )

            # ============================================================
            # 8. Response
            # ============================================================

            serializer = DeliveryChallanSerializer(dc)

            return Response(
                {
                    "success": True,
                    "message": "Delivery Challan confirmed and PDF saved.",
                    "data": serializer.data,
                    "pdf_url": (
                        request.build_absolute_uri(
                            dc.pdf_file.url
                        )
                        if dc.pdf_file
                        else None
                    ),
                },
                status=status.HTTP_200_OK,
            )



#for tax invoice
# ==================================================================
# NEXT TAX INVOICE NUMBER
# ==================================================================
class TaxInvoiceNextNumberAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAccounts]

    def get(self, request):

        settings = (
            TaxInvoiceNumberSettings.objects
            .filter(is_active=True)
            .first()
        )

        if not settings:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Tax invoice number settings "
                        "have not been configured."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ==================================================
        # 1. Generate current invoice number
        # ==================================================

        invoice_number = (
            f"{settings.prefix}"
            f"{settings.next_number:0{settings.number_padding}d}"
        )

        # ==================================================
        # 2. Check whether current invoice already exists
        # ==================================================

        existing_invoice = (
            TaxInvoice.objects
            .filter(invoice_number=invoice_number)
            .first()
        )

        # ==================================================
        # 3. CURRENT INVOICE EXISTS
        # ==================================================

        if existing_invoice is not None:

            serializer = TaxInvoiceSerializer(
                existing_invoice
            )

            return Response(
                {
                    "success": True,
                    "is_new": False,
                    "invoice_number": invoice_number,
                    "data": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        # ==================================================
        # 4. CURRENT INVOICE DOES NOT EXIST
        #    GET PREVIOUS INVOICE
        # ==================================================

        previous_invoice = (
            TaxInvoice.objects
            .order_by("-id")
            .first()
        )

        # ==================================================
        # 5. NO PREVIOUS INVOICE
        # ==================================================

        if previous_invoice is None:

            return Response(
                {
                    "success": True,
                    "is_new": True,
                    "invoice_number": invoice_number,
                    "data": None,
                },
                status=status.HTTP_200_OK,
            )

        # ==================================================
        # 6. CLONE PREVIOUS INVOICE
        # ==================================================

        serializer = TaxInvoiceSerializer(
            previous_invoice
        )

        previous_data = serializer.data.copy()

        previous_data["invoice_number"] = invoice_number

        return Response(
            {
                "success": True,
                "is_new": True,
                "invoice_number": invoice_number,
                "previous_invoice_number": (
                    previous_invoice.invoice_number
                ),
                "data": previous_data,
            },
            status=status.HTTP_200_OK,
        )


# ==================================================================
# TAX INVOICE CUSTOMERS (GET / POST / PATCH)
# ==================================================================
class TaxInvoiceCustomerAPIView(APIView):

    permission_classes = [IsAuthenticated, IsAccounts]

    # =========================
    # GET
    # =========================

    def get(self, request, pk=None):

        # GET /tax-invoice-customers/
        if pk is None:

            customers = Customer.objects.filter(
                source=Customer.Source.TAX_INVOICE
            )

            serializer = CustomerSerializer(
                customers,
                many=True,
            )

            return Response(
                {
                    "success": True,
                    "message": "Tax invoice customers retrieved successfully.",
                    "data": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        # GET /tax-invoice-customers/<id>/
        try:
            customer = Customer.objects.get(
                pk=pk,
                source=Customer.Source.TAX_INVOICE,
            )

        except Customer.DoesNotExist:

            return Response(
                {
                    "success": False,
                    "message": "Tax invoice customer not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CustomerSerializer(customer)

        return Response(
            {
                "success": True,
                "message": "Tax invoice customer retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    # =========================
    # POST
    # =========================

    def post(self, request):

        serializer = CustomerSerializer(
            data=request.data
        )

        if serializer.is_valid():

            customer = serializer.save(
                source=Customer.Source.TAX_INVOICE
            )

            return Response(
                {
                    "success": True,
                    "message": "Tax invoice customer created successfully.",
                    "data": CustomerSerializer(
                        customer
                    ).data,
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {
                "success": False,
                "message": "Customer validation failed.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # =========================
    # PATCH
    # =========================

    def patch(self, request, pk=None):

        if pk is None:

            return Response(
                {
                    "success": False,
                    "message": (
                        "Customer ID is required "
                        "for PATCH."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            customer = Customer.objects.get(
                pk=pk,
                source=Customer.Source.TAX_INVOICE,
            )

        except Customer.DoesNotExist:

            return Response(
                {
                    "success": False,
                    "message": "Tax invoice customer not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CustomerSerializer(
            customer,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():

            customer = serializer.save(
                source=Customer.Source.TAX_INVOICE
            )

            return Response(
                {
                    "success": True,
                    "message": "Tax invoice customer updated successfully.",
                    "data": CustomerSerializer(
                        customer
                    ).data,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "success": False,
                "message": "Customer validation failed.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


# ==================================================================
# CREATE / UPDATE TAX INVOICE
# ==================================================================
@method_decorator(csrf_protect, name="dispatch")
class TaxInvoiceCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAccounts]

    def post(self, request):

        with transaction.atomic():

            data = request.data.copy()

            # ==================================================
            # 1. CHECK EXISTING INVOICE
            # ==================================================

            incoming_invoice_number = str(
                data.get("invoice_number", "")
            ).strip()

            existing_invoice = None

            if incoming_invoice_number:

                existing_invoice = (
                    TaxInvoice.objects
                    .select_for_update()
                    .filter(
                        invoice_number=incoming_invoice_number
                    )
                    .first()
                )

            # ==================================================
            # 2. CUSTOMER NAME (from receiver_details)
            # ==================================================
            #
            # Frontend sends receiver_details.companyName inside
            # the JSON payload. We look up the matching Tax Invoice
            # customer and stamp its id on the invoice for future
            # reporting / joins. Not required — the invoice still
            # saves if the customer master is missing.
            #
            # ==================================================

            receiver_details = (
                data.get("receiver_details") or {}
            )

            if not isinstance(receiver_details, dict):
                receiver_details = {}

            customer_name = str(
                receiver_details.get("companyName", "")
            ).strip()

            customer = None

            if customer_name:

                customer = (
                    Customer.objects
                    .filter(
                        company_name__iexact=customer_name,
                        source=Customer.Source.TAX_INVOICE,
                    )
                    .first()
                )

            # ==================================================
            # 3. UPDATE EXISTING INVOICE
            # ==================================================

            if existing_invoice is not None:

                # Invoice number is only used to find the invoice.
                # It must not be changed by an update.
                data.pop("invoice_number", None)

                serializer = TaxInvoiceSerializer(
                    existing_invoice,
                    data=data,
                    partial=True,
                )

                serializer.is_valid(
                    raise_exception=True
                )

                invoice = serializer.save()

                response_serializer = TaxInvoiceSerializer(invoice)

                return Response(
                    {
                        "success": True,
                        "message": "Tax invoice updated successfully.",
                        "data": response_serializer.data,
                    },
                    status=status.HTTP_200_OK,
                )

            # ==================================================
            # 4. CREATE NEW INVOICE
            # ==================================================

            serializer = TaxInvoiceSerializer(
                data=data
            )

            serializer.is_valid(
                raise_exception=True
            )

            invoice = serializer.save()

        response_serializer = TaxInvoiceSerializer(invoice)

        return Response(
            {
                "success": True,
                "message": "Tax invoice created successfully.",
                "data": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


# ==================================================================
# CONFIRM TAX INVOICE (PDF SAVE + STATUS FLIP)
# ==================================================================
@method_decorator(csrf_protect, name="dispatch")
class TaxInvoiceConfirmAPIView(APIView):

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, invoice_number):

        with transaction.atomic():

            # ============================================================
            # 1. Session check (HttpOnly refresh cookie)
            # ============================================================

            refresh_token = request.COOKIES.get(
                settings.REFRESH_COOKIE_NAME
            )

            if not refresh_token:
                return Response(
                    {
                        "success": False,
                        "message": "Session not found. Please login again.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            try:
                token = RefreshToken(refresh_token)
                user_id = token.get("user_id")
            except Exception:
                return Response(
                    {
                        "success": False,
                        "message": "Session is invalid or expired.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {
                        "success": False,
                        "message": "Session user no longer exists.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # ============================================================
            # 2. Accounts-department check
            # ============================================================

            if user.user_type != User.UserType.ACCOUNTS:
                return Response(
                    {
                        "success": False,
                        "message": "Accounts access required.",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            # ============================================================
            # 3. Locate the Tax Invoice (locked)
            # ============================================================

            try:
                invoice = (
                    TaxInvoice.objects
                    .select_for_update()
                    .get(invoice_number=invoice_number)
                )
            except TaxInvoice.DoesNotExist:
                return Response(
                    {
                        "success": False,
                        "message": "Tax invoice not found.",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # ============================================================
            # 4. Read the uploaded PDF
            # ============================================================

            pdf_file = request.FILES.get("pdf")

            if not pdf_file:
                return Response(
                    {
                        "success": False,
                        "message": "No PDF file was uploaded.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ============================================================
            # 5. Save PDF under MEDIA/tax_invoices/pdf/
            # ============================================================

            safe_inv = (
                str(invoice_number)
                .replace("/", "-")
                .replace("\\", "-")
            )
            filename = f"{safe_inv}.pdf"

            if invoice.pdf_file:
                try:
                    invoice.pdf_file.delete(save=False)
                except Exception:
                    pass

            invoice.pdf_file.save(
                filename,
                ContentFile(pdf_file.read()),
                save=False,
            )

            # ============================================================
            # 6. Flip status to confirmed
            # ============================================================

            was_already_confirmed = (
                invoice.status
                == TaxInvoice.Status.CONFIRMED
            )

            invoice.status = TaxInvoice.Status.CONFIRMED

            invoice.save(
                update_fields=[
                    "pdf_file",
                    "status",
                    "updated_at",
                ]
            )

            # ============================================================
            # 7. Advance the invoice number counter
            # ------------------------------------------------------------
            # Only on the first confirmation. Re-printing an
            # already-confirmed invoice must NOT consume another number.
            # ============================================================

            if not was_already_confirmed:

                settings_obj = (
                    TaxInvoiceNumberSettings.objects
                    .select_for_update()
                    .filter(is_active=True)
                    .first()
                )

                if settings_obj:

                    settings_obj.next_number += 1

                    settings_obj.save(
                        update_fields=[
                            "next_number",
                            "updated_at",
                        ]
                    )

            # ============================================================
            # 8. Response
            # ============================================================

            serializer = TaxInvoiceSerializer(invoice)

            return Response(
                {
                    "success": True,
                    "message": "Tax invoice confirmed and PDF saved.",
                    "data": serializer.data,
                    "pdf_url": (
                        request.build_absolute_uri(
                            invoice.pdf_file.url
                        )
                        if invoice.pdf_file
                        else None
                    ),
                },
                status=status.HTTP_200_OK,
            )


#for perfoma


class ProformaInvoiceNextNumberAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAccounts]

    def get(self, request):

        settings = (
            ProformaInvoiceNumberSettings.objects
            .filter(is_active=True)
            .first()
        )

        if not settings:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Proforma invoice number settings "
                        "have not been configured."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ==================================================
        # 1. Generate current proforma number
        # ==================================================

        proforma_no = (
            f"{settings.prefix}"
            f"{settings.next_number:0{settings.number_padding}d}"
        )

        # ==================================================
        # 2. Check whether current proforma already exists
        # ==================================================

        existing_proforma = (
            ProformaInvoice.objects
            .filter(proforma_no=proforma_no)
            .first()
        )

        # ==================================================
        # 3. CURRENT PROFORMA EXISTS
        # ==================================================

        if existing_proforma is not None:

            serializer = ProformaInvoiceSerializer(
                existing_proforma
            )

            return Response(
                {
                    "success": True,
                    "is_new": False,
                    "proforma_no": proforma_no,
                    "data": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        # ==================================================
        # 4. CURRENT PROFORMA DOES NOT EXIST
        #    GET PREVIOUS PROFORMA
        # ==================================================

        previous_proforma = (
            ProformaInvoice.objects
            .order_by("-id")
            .first()
        )

        # ==================================================
        # 5. NO PREVIOUS PROFORMA
        # ==================================================

        if previous_proforma is None:

            return Response(
                {
                    "success": True,
                    "is_new": True,
                    "proforma_no": proforma_no,
                    "data": None,
                },
                status=status.HTTP_200_OK,
            )

        # ==================================================
        # 6. CLONE PREVIOUS PROFORMA
        # ==================================================

        serializer = ProformaInvoiceSerializer(
            previous_proforma
        )

        previous_data = serializer.data.copy()

        previous_data["proforma_no"] = proforma_no

        return Response(
            {
                "success": True,
                "is_new": True,
                "proforma_no": proforma_no,
                "previous_proforma_no": (
                    previous_proforma.proforma_no
                ),
                "data": previous_data,
            },
            status=status.HTTP_200_OK,
        )


# ==================================================================
# PROFORMA INVOICE CUSTOMERS (GET / POST / PATCH)
# ------------------------------------------------------------------
# Shares the same Customer pool as Tax Invoice (source=TAX_INVOICE)
# so both modules see one consistent customer master. Change the
# source constant if you want a separate pool.
# ==================================================================
class ProformaInvoiceCustomerAPIView(APIView):

    permission_classes = [IsAuthenticated, IsAccounts]

    # =========================
    # GET
    # =========================

    def get(self, request, pk=None):

        # GET /proforma-invoice-customers/
        if pk is None:

            customers = Customer.objects.filter(
                source=Customer.Source.TAX_INVOICE
            )

            serializer = CustomerSerializer(
                customers,
                many=True,
            )

            return Response(
                {
                    "success": True,
                    "message": "Proforma invoice customers retrieved successfully.",
                    "data": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        # GET /proforma-invoice-customers/<id>/
        try:
            customer = Customer.objects.get(
                pk=pk,
                source=Customer.Source.TAX_INVOICE,
            )

        except Customer.DoesNotExist:

            return Response(
                {
                    "success": False,
                    "message": "Proforma invoice customer not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CustomerSerializer(customer)

        return Response(
            {
                "success": True,
                "message": "Proforma invoice customer retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    # =========================
    # POST
    # =========================

    def post(self, request):

        serializer = CustomerSerializer(
            data=request.data
        )

        if serializer.is_valid():

            customer = serializer.save(
                source=Customer.Source.TAX_INVOICE
            )

            return Response(
                {
                    "success": True,
                    "message": "Proforma invoice customer created successfully.",
                    "data": CustomerSerializer(
                        customer
                    ).data,
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {
                "success": False,
                "message": "Customer validation failed.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # =========================
    # PATCH
    # =========================

    def patch(self, request, pk=None):

        if pk is None:

            return Response(
                {
                    "success": False,
                    "message": (
                        "Customer ID is required "
                        "for PATCH."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            customer = Customer.objects.get(
                pk=pk,
                source=Customer.Source.TAX_INVOICE,
            )

        except Customer.DoesNotExist:

            return Response(
                {
                    "success": False,
                    "message": "Proforma invoice customer not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CustomerSerializer(
            customer,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():

            customer = serializer.save(
                source=Customer.Source.TAX_INVOICE
            )

            return Response(
                {
                    "success": True,
                    "message": "Proforma invoice customer updated successfully.",
                    "data": CustomerSerializer(
                        customer
                    ).data,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "success": False,
                "message": "Customer validation failed.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


# ==================================================================
# CREATE / UPDATE PROFORMA INVOICE
# ==================================================================
class ProformaInvoiceCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAccounts]

    def post(self, request):

        with transaction.atomic():

            data = request.data.copy()

            # ==================================================
            # 1. CHECK EXISTING PROFORMA
            # ==================================================

            incoming_proforma_no = str(
                data.get("proforma_no", "")
            ).strip()

            existing_proforma = None

            if incoming_proforma_no:

                existing_proforma = (
                    ProformaInvoice.objects
                    .select_for_update()
                    .filter(
                        proforma_no=incoming_proforma_no
                    )
                    .first()
                )

            # ==================================================
            # 2. UPDATE EXISTING PROFORMA
            # ==================================================

            if existing_proforma is not None:

                # Proforma number is only used to find the proforma.
                # It must not be changed by an update.
                data.pop("proforma_no", None)

                serializer = ProformaInvoiceSerializer(
                    existing_proforma,
                    data=data,
                    partial=True,
                )

                serializer.is_valid(
                    raise_exception=True
                )

                proforma = serializer.save()

                response_serializer = ProformaInvoiceSerializer(
                    proforma
                )

                return Response(
                    {
                        "success": True,
                        "message": "Proforma invoice updated successfully.",
                        "data": response_serializer.data,
                    },
                    status=status.HTTP_200_OK,
                )

            # ==================================================
            # 3. CREATE NEW PROFORMA
            # ==================================================

            serializer = ProformaInvoiceSerializer(
                data=data
            )

            serializer.is_valid(
                raise_exception=True
            )

            proforma = serializer.save()

        response_serializer = ProformaInvoiceSerializer(proforma)

        return Response(
            {
                "success": True,
                "message": "Proforma invoice created successfully.",
                "data": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


# ==================================================================
# CONFIRM PROFORMA INVOICE (PDF SAVE + STATUS FLIP)
# ==================================================================
@method_decorator(csrf_protect, name="dispatch")
class ProformaInvoiceConfirmAPIView(APIView):

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, proforma_no):

        with transaction.atomic():

            # ============================================================
            # 1. Session check (HttpOnly refresh cookie)
            # ============================================================

            refresh_token = request.COOKIES.get(
                settings.REFRESH_COOKIE_NAME
            )

            if not refresh_token:
                return Response(
                    {
                        "success": False,
                        "message": "Session not found. Please login again.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            try:
                token = RefreshToken(refresh_token)
                user_id = token.get("user_id")
            except Exception:
                return Response(
                    {
                        "success": False,
                        "message": "Session is invalid or expired.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {
                        "success": False,
                        "message": "Session user no longer exists.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # ============================================================
            # 2. Accounts-department check
            # ============================================================

            if user.user_type != User.UserType.ACCOUNTS:
                return Response(
                    {
                        "success": False,
                        "message": "Accounts access required.",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            # ============================================================
            # 3. Locate the Proforma Invoice (locked)
            # ============================================================

            try:
                proforma = (
                    ProformaInvoice.objects
                    .select_for_update()
                    .get(proforma_no=proforma_no)
                )
            except ProformaInvoice.DoesNotExist:
                return Response(
                    {
                        "success": False,
                        "message": "Proforma invoice not found.",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # ============================================================
            # 4. Read the uploaded PDF
            # ============================================================

            pdf_file = request.FILES.get("pdf")

            if not pdf_file:
                return Response(
                    {
                        "success": False,
                        "message": "No PDF file was uploaded.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ============================================================
            # 5. Save PDF under MEDIA/proforma_invoices/pdf/
            # ============================================================

            safe_pf = (
                str(proforma_no)
                .replace("/", "-")
                .replace("\\", "-")
            )
            filename = f"{safe_pf}.pdf"

            if proforma.pdf_file:
                try:
                    proforma.pdf_file.delete(save=False)
                except Exception:
                    pass

            proforma.pdf_file.save(
                filename,
                ContentFile(pdf_file.read()),
                save=False,
            )

            # ============================================================
            # 6. Flip status to confirmed
            # ============================================================

            was_already_confirmed = (
                proforma.status
                == ProformaInvoice.Status.CONFIRMED
            )

            proforma.status = ProformaInvoice.Status.CONFIRMED

            proforma.save(
                update_fields=[
                    "pdf_file",
                    "status",
                    "updated_at",
                ]
            )

            # ============================================================
            # 7. Advance the proforma number counter
            # ------------------------------------------------------------
            # Only on the first confirmation.
            # ============================================================

            if not was_already_confirmed:

                settings_obj = (
                    ProformaInvoiceNumberSettings.objects
                    .select_for_update()
                    .filter(is_active=True)
                    .first()
                )

                if settings_obj:

                    settings_obj.next_number += 1

                    settings_obj.save(
                        update_fields=[
                            "next_number",
                            "updated_at",
                        ]
                    )

            # ============================================================
            # 8. Response
            # ============================================================

            serializer = ProformaInvoiceSerializer(proforma)

            return Response(
                {
                    "success": True,
                    "message": "Proforma invoice confirmed and PDF saved.",
                    "data": serializer.data,
                    "pdf_url": (
                        request.build_absolute_uri(
                            proforma.pdf_file.url
                        )
                        if proforma.pdf_file
                        else None
                    ),
                },
                status=status.HTTP_200_OK,
            )

#for reports
from .serializers import AccountsReportRowSerializer

User = get_user_model()
# ============================================================
# ACCOUNTS REPORT
# ------------------------------------------------------------
# Unified list of every accounting document (PO, QO, DC, TI, PI)
# for the Reports page.
#
# Everything is inline in the view — no service layer.
# ============================================================

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    PurchaseOrder,
    Quotation,
    DeliveryChallan,
    TaxInvoice,
    ProformaInvoice,
)
from .serializers import AccountsReportRowSerializer

User = get_user_model()


# ============================================================
# SMALL HELPERS (used only by the report view)
# ============================================================

def _iso(d):
    """Date → ISO string, or "" if None."""
    return d.isoformat() if d else ""


def _customer_block(customer):
    """Flatten a Customer FK into a plain dict for document_data."""
    if not customer:
        return {}
    return {
        "companyName": customer.company_name or "",
        "address": customer.address or "",
        "contactPerson": customer.contact_person or "",
        "phone": customer.phone or "",
        "email": customer.email or "",
        "gst": customer.gst_number or "",
        "state": customer.state or "",
        "stateCode": customer.state_code or "",
    }


@method_decorator(csrf_protect, name="dispatch")
class AccountsReportAPIView(APIView):
    """
    GET /erp/accounts-report/
    GET /erp/accounts-report/?type=PO   (optional filter)
    """

    permission_classes = [AllowAny]   # session cookie is the real gate

    def get(self, request, document_type=None):

        # ============================================================
        # 1. Session check (HttpOnly refresh cookie)
        # ============================================================
        refresh_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)

        if not refresh_token:
            return Response(
                {
                    "success": False,
                    "message": "Session not found. Please login again.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            token = RefreshToken(refresh_token)
            user_id = token.get("user_id")
        except Exception:
            return Response(
                {
                    "success": False,
                    "message": "Session is invalid or expired.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "message": "Session user no longer exists.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # ============================================================
        # 2. Accounts-department check
        # ============================================================
        if user.user_type != User.UserType.ACCOUNTS:
            return Response(
                {
                    "success": False,
                    "message": "Accounts access required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # ============================================================
        # 3. Optional filter by document type
        # ============================================================
        type_filter = (document_type or request.query_params.get("type") or "ALL").upper()

        def want(short):
            return type_filter == "ALL" or type_filter == short

        rows = []

        # ============================================================
        # 4. PURCHASE ORDERS
        # ============================================================
        if want("PO"):
            for po in PurchaseOrder.objects.all().order_by("-created_at"):
                doc_data = po.document_data or {
                    "poNumber": po.po_number,
                    "poDate": _iso(po.po_date),
                    "refQuoteNumber": po.ref_quote_number,
                    "refDate": _iso(po.ref_date),
                    "subject": po.subject,
                    "preparedBy": po.prepared_by,
                    "vendor": po.vendor,
                    "introText": po.intro_text,
                    "items": po.items,
                    "columns": po.columns,
                    "includeAmountDetails": po.include_amount_details,
                    "subtotal": float(po.subtotal),
                    "gstPercent": float(po.gst_percent),
                    "gstAmount": float(po.gst_amount),
                    "grandTotal": float(po.grand_total),
                    "delivery": po.delivery,
                    "payment": po.payment,
                    "terms": po.terms,
                    "notes": po.notes,
                    "signatures": po.signatures,
                }

                rows.append({
                    "id": f"PO-{po.id}",
                    "type": "Purchase Order",
                    "short": "PO",
                    "document_number": po.po_number,
                    "payment_status": po.payment_status or "Pending",
                    "delivery_status": po.delivery_status or "Pending",
                    "path": "/accounts/po",
                    "document_data": doc_data,
                })

        # ============================================================
        # 5. QUOTATIONS
        # ============================================================
        if want("QO"):
            qs = (
                Quotation.objects
                .select_related("customer")
                .all()
                .order_by("-created_at")
            )
            for qo in qs:
                doc_data = {
                    "quotationNumber": qo.quotation_number,
                    "quotationDate": _iso(qo.quotation_date),
                    "customer": _customer_block(qo.customer),
                    "subject": qo.subject,
                    "intro": qo.intro,
                    "items": qo.items,
                    "technicalDetails": qo.technical_details,
                    "terms": qo.terms,
                    "signatures": qo.signatures,
                    "companyName": qo.company_name,
                    "designation": qo.designation,
                    "subtotal": float(qo.subtotal),
                    "gstPercent": float(qo.gst_percent),
                    "gstAmount": float(qo.gst_amount),
                    "grandTotal": float(qo.grand_total),
                }

                rows.append({
                    "id": f"QO-{qo.id}",
                    "type": "Quotation",
                    "short": "QO",
                    "document_number": qo.quotation_number,
                    "payment_status": qo.payment_status or "Pending",
                    "delivery_status": qo.delivery_status or "Pending",
                    "path": "/accounts/qo",
                    "document_data": doc_data,
                })

        # ============================================================
        # 6. DELIVERY CHALLANS
        # ============================================================
        if want("DC"):
            qs = (
                DeliveryChallan.objects
                .select_related("customer")
                .all()
                .order_by("-created_at")
            )
            for dc in qs:
                doc_data = {
                    "dcNumber": dc.dc_number,
                    "dcDate": _iso(dc.dc_date),
                    "customer": _customer_block(dc.customer),
                    "poNumber": dc.po_number,
                    "poDate": _iso(dc.po_date),
                    "billNumber": dc.bill_number,
                    "billDate": _iso(dc.bill_date),
                    "deliveryAt": dc.delivery_at,
                    "companyAddressId": dc.company_address_id,
                    "returnable": dc.returnable,
                    "items": dc.items,
                    "amountInWords": dc.amount_in_words,
                    "preparedBy": dc.prepared_by,
                }

                rows.append({
                    "id": f"DC-{dc.id}",
                    "type": "Delivery Challan",
                    "short": "DC",
                    "document_number": dc.dc_number,
                    "payment_status": dc.payment_status or "N/A",
                    "delivery_status": dc.delivery_status or "Delivered",
                    "path": "/accounts/DeliveryChallan",
                    "document_data": doc_data,
                })

        # ============================================================
        # 7. TAX INVOICES
        # ============================================================
        if want("TI"):
            for ti in TaxInvoice.objects.all().order_by("-created_at"):
                doc_data = ti.document_data or {
                    "invoiceNumber": ti.invoice_number,
                    "invoiceDate": _iso(ti.invoice_date),
                    "dateOfSupply": _iso(ti.date_of_supply),
                    "receiverDetails": ti.receiver_details,
                    "consigneeDetails": ti.consignee_details,
                    "items": ti.items,
                    "subtotal": float(ti.subtotal),
                    "grandTotal": float(ti.grand_total),
                    "amountInWords": ti.amount_in_words,
                }

                rows.append({
                    "id": f"TI-{ti.id}",
                    "type": "Tax Invoice",
                    "short": "TI",
                    "document_number": ti.invoice_number,
                    "payment_status": ti.payment_status or "Pending",
                    "delivery_status": ti.delivery_status or "Pending",
                    "path": "/accounts/TaxInvoice",
                    "document_data": doc_data,
                })

        # ============================================================
        # 8. PROFORMA INVOICES
        # ============================================================
        if want("PI"):
            for pi in ProformaInvoice.objects.all().order_by("-created_at"):
                doc_data = pi.document_data or {
                    "proformaNo": pi.proforma_no,
                    "date": _iso(pi.date),
                    "validUntil": _iso(pi.valid_until),
                    "receiverDetails": pi.receiver_details,
                    "consigneeDetails": pi.consignee_details,
                    "items": pi.items,
                    "subtotal": float(pi.subtotal),
                    "grandTotal": float(pi.grand_total),
                    "amountInWords": pi.amount_in_words,
                }

                rows.append({
                    "id": f"PI-{pi.id}",
                    "type": "Proforma Invoice",
                    "short": "PI",
                    "document_number": pi.proforma_no,
                    "payment_status": pi.payment_status or "Pending",
                    "delivery_status": pi.delivery_status or "Pending",
                    "path": "/accounts/ProformaInvoice",
                    "document_data": doc_data,
                })

        # ============================================================
        # 9. Global newest-first ordering
        # ============================================================
        rows.sort(key=lambda r: r["document_number"], reverse=True)

        # ============================================================
        # 10. Serialize + return
        # ============================================================
        serializer = AccountsReportRowSerializer(rows, many=True)

        return Response(
            {
                "success": True,
                "count": len(rows),
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


# Map short codes to models — keep this in sync with the
# DOCUMENT_TYPES list on the frontend.
_STATUS_MODEL_MAP = {
    "PO": PurchaseOrder,
    "QO": Quotation,
    "DC": DeliveryChallan,
    "TI": TaxInvoice,
    "PI": ProformaInvoice,
}
from .serializers import (
    AccountsReportRowSerializer,
    StatusUpdateSerializer,
)

@method_decorator(csrf_protect, name="dispatch")
class AccountsReportStatusAPIView(APIView):
    """
    PATCH /erp/accounts-report/<short>/<id>/status/
    """

    permission_classes = [AllowAny]

    def patch(self, request, short, pk):

        # ============================================================
        # 1. Session check (same as report view)
        # ============================================================
        refresh_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)

        if not refresh_token:
            return Response(
                {"success": False, "message": "Session not found. Please login again."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            token = RefreshToken(refresh_token)
            user_id = token.get("user_id")
        except Exception:
            return Response(
                {"success": False, "message": "Session is invalid or expired."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"success": False, "message": "Session user no longer exists."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # ============================================================
        # 2. Accounts-department check
        # ============================================================
        if user.user_type != User.UserType.ACCOUNTS:
            return Response(
                {"success": False, "message": "Accounts access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ============================================================
        # 3. Resolve model from short code
        # ============================================================
        short_upper = (short or "").upper()
        model = _STATUS_MODEL_MAP.get(short_upper)

        if not model:
            return Response(
                {
                    "success": False,
                    "message": f"Unknown document type: {short}",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ============================================================
        # 4. Locate the document
        # ============================================================
        try:
            obj = model.objects.get(pk=pk)
        except model.DoesNotExist:
            return Response(
                {"success": False, "message": "Document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ============================================================
        # 5. Validate payload
        # ============================================================
        serializer = StatusUpdateSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": "Invalid status update.",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ============================================================
        # 6. Apply changes
        # ============================================================
        updated_fields = []

        if "payment_status" in serializer.validated_data:
            obj.payment_status = serializer.validated_data["payment_status"]
            updated_fields.append("payment_status")

        if "delivery_status" in serializer.validated_data:
            obj.delivery_status = serializer.validated_data["delivery_status"]
            updated_fields.append("delivery_status")

        obj.save(update_fields=updated_fields + ["updated_at"])

        # ============================================================
        # 7. Respond
        # ============================================================
        return Response(
            {
                "success": True,
                "message": "Status updated.",
                "data": {
                    "id": f"{short_upper}-{obj.id}",
                    "payment_status": obj.payment_status,
                    "delivery_status": obj.delivery_status,
                },
            },
            status=status.HTTP_200_OK,
        )


#for expense

from decimal import Decimal

from .models import JournalEntry
from .serializers import JournalEntrySerializer


def _generate_journal_number(entry_type):
    """
    EXP1001, EXP1002, ...
    INC1001, INC1002, ...
    """
    prefix = "EXP" if entry_type == JournalEntry.EntryType.EXPENSE else "INC"

    # Find the highest existing suffix for this prefix
    last = (
        JournalEntry.objects
        .filter(record_number__startswith=prefix)
        .order_by("-record_number")
        .values_list("record_number", flat=True)
        .first()
    )

    if not last:
        return f"{prefix}1001"

    # last looks like "EXP1001"
    try:
        suffix = int(last[len(prefix):])
    except (ValueError, TypeError):
        suffix = 1000

    return f"{prefix}{suffix + 1}"


@method_decorator(csrf_protect, name="dispatch")
class JournalAPIView(APIView):
    """
    GET  /erp/journal/  → list entries + totals
    POST /erp/journal/  → create one entry
    """

    permission_classes = [AllowAny]

    # ========================================================
    # AUTH HELPERS (same pattern as the rest of the app)
    # ========================================================
    def _get_user(self, request):
        refresh_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not refresh_token:
            return None, Response(
                {"success": False, "message": "Session not found. Please login again."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            token = RefreshToken(refresh_token)
            user_id = token.get("user_id")
        except Exception:
            return None, Response(
                {"success": False, "message": "Session is invalid or expired."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None, Response(
                {"success": False, "message": "Session user no longer exists."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if user.user_type != User.UserType.ACCOUNTS:
            return None, Response(
                {"success": False, "message": "Accounts access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return user, None

    # ========================================================
    # GET — list + totals
    # ========================================================
    def get(self, request):
        user, err = self._get_user(request)
        if err:
            return err

        # Optional filters
        entry_type = request.query_params.get("type")  # "Expense" | "Income"
        qs = JournalEntry.objects.all().order_by("-date", "-created_at")

        if entry_type in ("Expense", "Income"):
            qs = qs.filter(type=entry_type)

        serializer = JournalEntrySerializer(qs, many=True)

        # Compute totals over the *unfiltered* set so the page
        # always shows overall income/expense/profit.
        total_expense = (
            JournalEntry.objects
            .filter(type=JournalEntry.EntryType.EXPENSE)
            .aggregate(total=models.Sum("amount"))["total"]
            or Decimal("0")
        )

        total_income = (
            JournalEntry.objects
            .filter(type=JournalEntry.EntryType.INCOME)
            .aggregate(total=models.Sum("amount"))["total"]
            or Decimal("0")
        )

        net_profit = total_income - total_expense

        return Response(
            {
                "success": True,
                "count": len(serializer.data),
                "data": serializer.data,
                "totals": {
                    "total_income": float(total_income),
                    "total_expense": float(total_expense),
                    "net_profit": float(net_profit),
                },
            },
            status=status.HTTP_200_OK,
        )

    # ========================================================
    # POST — create
    # ========================================================
    def post(self, request):
        user, err = self._get_user(request)
        if err:
            return err

        serializer = JournalEntrySerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": "Invalid journal entry.",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        validated = serializer.validated_data
        entry_type = validated.get("type", JournalEntry.EntryType.EXPENSE)

        record_number = _generate_journal_number(entry_type)

        entry = JournalEntry.objects.create(
            record_number=record_number,
            **validated,
        )

        out = JournalEntrySerializer(entry)

        return Response(
            {
                "success": True,
                "message": "Journal entry created.",
                "data": out.data,
            },
            status=status.HTTP_201_CREATED,
        )

# ============================================================
# DELETE A JOURNAL ENTRY
# ------------------------------------------------------------
# DELETE /erp/journal/<id>/
# ============================================================

@method_decorator(csrf_protect, name="dispatch")
class JournalDetailAPIView(APIView):
    permission_classes = [AllowAny]

    def _get_user(self, request):
        # same helper as JournalAPIView — copy it inline or
        # extract to a mixin if you prefer.
        refresh_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not refresh_token:
            return None, Response(
                {"success": False, "message": "Session not found. Please login again."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            token = RefreshToken(refresh_token)
            user_id = token.get("user_id")
        except Exception:
            return None, Response(
                {"success": False, "message": "Session is invalid or expired."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None, Response(
                {"success": False, "message": "Session user no longer exists."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if user.user_type != User.UserType.ACCOUNTS:
            return None, Response(
                {"success": False, "message": "Accounts access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return user, None

    # --------------------------------------------------------
    # DELETE
    # --------------------------------------------------------
    def delete(self, request, pk):
        user, err = self._get_user(request)
        if err:
            return err

        try:
            entry = JournalEntry.objects.get(pk=pk)
        except JournalEntry.DoesNotExist:
            return Response(
                {"success": False, "message": "Journal entry not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        entry.delete()

        return Response(
            {"success": True, "message": "Journal entry deleted."},
            status=status.HTTP_200_OK,
        )


#hr module
# hr/views.py
from django.db import transaction
from django.db.models import Q

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Employee
from .permissions import IsHR
from .serializers import (
    EmployeeArchiveSerializer,
    EmployeeSerializer,
)


# ============================================================
# EMPLOYEE LIST + CREATE
# ============================================================
class EmployeeListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsHR]

    # --------------------------------------------------------
    # GET /erp/hr/employees/
    # --------------------------------------------------------
    def get(self, request):
        qs = Employee.objects.all()

        # ?archived=true|false
        archived = request.query_params.get("archived")
        if archived is not None:
            qs = qs.filter(
                archived=archived.lower() in ("1", "true", "yes")
            )

        # ?q=search
        q = request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
                | Q(employee_id__icontains=q)
                | Q(employee_code__icontains=q)
                | Q(email__icontains=q)
                | Q(mobile__icontains=q)
                | Q(department__icontains=q)
                | Q(designation__icontains=q)
                | Q(city__icontains=q)
            )

        # Multi-select filters — comma-separated values
        def _multi(param):
            raw = request.query_params.get(param)
            if not raw:
                return None
            return [v for v in raw.split(",") if v]

        dept = _multi("department")
        if dept:
            qs = qs.filter(department__in=dept)

        city = _multi("city")
        if city:
            qs = qs.filter(city__in=city)

        desig = _multi("designation")
        if desig:
            qs = qs.filter(designation__in=desig)

        status_q = _multi("employment_status")
        if status_q:
            qs = qs.filter(employment_status__in=status_q)

        etype = _multi("employment_type")
        if etype:
            qs = qs.filter(employment_type__in=etype)

        # Skills check in Python (JSON contains)
        skills = _multi("skills")
        qs = list(qs)
        if skills:
            qs = [e for e in qs if any(s in (e.skills or []) for s in skills)]

        serializer = EmployeeSerializer(qs, many=True)

        return Response(
            {
                "success": True,
                "count": len(serializer.data),
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    # --------------------------------------------------------
    # POST /erp/hr/employees/
    # --------------------------------------------------------
    def post(self, request):
        serializer = EmployeeSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": "Employee validation failed.",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # ---------------------------------------------------------
            # Auto-generate employee_code from settings
            # ---------------------------------------------------------
            settings_obj = (
                EmployeeCodeSettings.objects
                .select_for_update()
                .filter(is_active=True)
                .first()
            )

            if not settings_obj:
                return Response(
                    {
                        "success": False,
                        "message": (
                            "Employee code settings have not been "
                            "configured."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            code = (
                f"{settings_obj.prefix}"
                f"{settings_obj.next_number:0{settings_obj.number_padding}d}"
            )

            settings_obj.next_number += 1
            settings_obj.save(
                update_fields=["next_number", "updated_at"]
            )

            employee = serializer.save(
                created_by=request.user,
                employee_code=code,
            )


        return Response(
            {
                "success": True,
                "message": "Employee created successfully.",
                "data": EmployeeSerializer(employee).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ============================================================
# EMPLOYEE DETAIL / UPDATE / DELETE
# ============================================================
class EmployeeDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsHR]

    def _get(self, pk):
        try:
            return Employee.objects.get(pk=pk)
        except Employee.DoesNotExist:
            return None

    # --------------------------------------------------------
    # GET /erp/hr/employees/<pk>/
    # --------------------------------------------------------
    def get(self, request, pk):
        emp = self._get(pk)
        if not emp:
            return Response(
                {"success": False, "message": "Employee not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "success": True,
                "data": EmployeeSerializer(emp).data,
            },
            status=status.HTTP_200_OK,
        )

    # --------------------------------------------------------
    # PATCH /erp/hr/employees/<pk>/
    # --------------------------------------------------------
    def patch(self, request, pk):
        emp = self._get(pk)
        if not emp:
            return Response(
                {"success": False, "message": "Employee not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = EmployeeSerializer(
            emp, data=request.data, partial=True
        )

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": "Employee validation failed.",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated = serializer.save()

        return Response(
            {
                "success": True,
                "message": "Employee updated successfully.",
                "data": EmployeeSerializer(updated).data,
            },
            status=status.HTTP_200_OK,
        )

    # --------------------------------------------------------
    # DELETE /erp/hr/employees/<pk>/
    # --------------------------------------------------------
    def delete(self, request, pk):
        emp = self._get(pk)
        if not emp:
            return Response(
                {"success": False, "message": "Employee not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        
        if emp.photo:
            try:
                emp.photo.delete(save=False)
            except Exception:
                pass

        emp.delete()

        return Response(
            {"success": True, "message": "Employee deleted."},
            status=status.HTTP_200_OK,
        )
from rest_framework.parsers import MultiPartParser, FormParser


class EmployeePhotoAPIView(APIView):
    """
    PATCH  /erp/hr/employees/<pk>/photo/   → upload / replace employee photo
    DELETE /erp/hr/employees/<pk>/photo/   → remove employee photo
    """
    permission_classes = [IsAuthenticated, IsHR]
    parser_classes = [MultiPartParser, FormParser]

    def _get(self, pk):
        try:
            return Employee.objects.get(pk=pk)
        except Employee.DoesNotExist:
            return None

    # --------------------------------------------------------
    # PATCH — upload
    # --------------------------------------------------------
    def patch(self, request, pk):
        emp = self._get(pk)
        if not emp:
            return Response(
                {"success": False, "message": "Employee not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        photo = request.FILES.get("photo")
        if not photo:
            return Response(
                {"success": False, "message": "No image was uploaded."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content_type = getattr(photo, "content_type", "") or ""
        if not content_type.startswith("image/"):
            return Response(
                {"success": False, "message": "Only image files are allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if photo.size > 5 * 1024 * 1024:
            return Response(
                {"success": False, "message": "Image must be 5 MB or smaller."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Remove the previous file from disk before saving the new one
        if emp.photo:
            try:
                emp.photo.delete(save=False)
            except Exception:
                pass

        emp.photo = photo
        emp.save(update_fields=["photo", "updated_at"])

        return Response(
            {
                "success": True,
                "message": "Employee photo updated.",
                "data": EmployeeSerializer(emp).data,
            },
            status=status.HTTP_200_OK,
        )

    # --------------------------------------------------------
    # DELETE — remove
    # --------------------------------------------------------
    def delete(self, request, pk):
        emp = self._get(pk)
        if not emp:
            return Response(
                {"success": False, "message": "Employee not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not emp.photo:
            return Response(
                {"success": False, "message": "This employee has no photo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            emp.photo.delete(save=False)
        except Exception:
            pass

        emp.photo = None
        emp.save(update_fields=["photo", "updated_at"])

        return Response(
            {
                "success": True,
                "message": "Employee photo removed.",
                "data": EmployeeSerializer(emp).data,
            },
            status=status.HTTP_200_OK,
        )
# ============================================================
# ARCHIVE / UNARCHIVE
# ============================================================
class EmployeeArchiveAPIView(APIView):
    permission_classes = [IsAuthenticated, IsHR]

    def post(self, request, pk):
        try:
            emp = Employee.objects.get(pk=pk)
        except Employee.DoesNotExist:
            return Response(
                {"success": False, "message": "Employee not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = EmployeeArchiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        emp.archived = serializer.validated_data["archived"]
        if emp.archived:
            emp.employment_status = "Inactive"
        emp.save(
            update_fields=["archived", "employment_status", "updated_at"]
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Employee archived."
                    if emp.archived
                    else "Employee restored."
                ),
                "data": EmployeeSerializer(emp).data,
            },
            status=status.HTTP_200_OK,
        )



#salary
from datetime import datetime

from django.db.models import Q
from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .models import (
    Employee,
    SalaryPayment,
    Advance,
)

from .serializers import (
    SalaryEmployeeSerializer,
    SalaryPaymentSerializer,
    AdvanceSerializer,
)


# =========================================================
# COMMON EMPLOYEE FILTER
# =========================================================

def filter_employees(request):
    search = request.query_params.get(
        "search", ""
    ).strip()

    department = request.query_params.get(
        "department", ""
    ).strip()

    branch = request.query_params.get(
        "branch", ""
    ).strip()

    employment_type = request.query_params.get(
        "employment_type", ""
    ).strip()

    work_location = request.query_params.get(
        "work_location", ""
    ).strip()

    employees = Employee.objects.filter(
    archived=False,
    employment_status="Active",
)

    if search:
        employees = employees.filter(
            Q(employee_id__icontains=search)
            | Q(employee_code__icontains=search)
            | Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(mobile__icontains=search)
            | Q(email__icontains=search)
        )

    if department:
        employees = employees.filter(
            department__iexact=department
        )

    if branch:
        employees = employees.filter(
            branch__icontains=branch
        )

    if employment_type:
        employees = employees.filter(
            employment_type__iexact=employment_type
        )

    if work_location:
        employees = employees.filter(
            work_location__icontains=work_location
        )

    return employees.order_by("employee_id")


# =========================================================
# EMPLOYEE SEARCH FOR SALARY ADD
# =========================================================

class SalaryEmployeeListAPIView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        employees = filter_employees(request)

        page = max(
            int(request.query_params.get("page", 1)),
            1
        )

        page_size = min(
            int(
                request.query_params.get(
                    "page_size",
                    25
                )
            ),
            100
        )

        total = employees.count()

        start = (page - 1) * page_size
        end = start + page_size

        employees = employees[start:end]

        serializer = SalaryEmployeeSerializer(
            employees,
            many=True
        )

        return Response({
            "count": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (
                total + page_size - 1
            ) // page_size,
            "results": serializer.data,
        })


# =========================================================
# SALARY LIST + CREATE
# =========================================================

class SalaryPaymentListCreateAPIView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        month = request.query_params.get(
            "month"
        )

        payment_status = request.query_params.get(
            "payment_status",
            ""
        ).strip()

        employees = filter_employees(request)

        salary_qs = SalaryPayment.objects.select_related(
            "employee"
        )

        # -------------------------------------------------
        # MONTH
        # -------------------------------------------------

        if month:

            try:
                salary_month = datetime.strptime(
                    month,
                    "%Y-%m"
                ).date()

                salary_month = salary_month.replace(
                    day=1
                )

                salary_qs = salary_qs.filter(
                    salary_month=salary_month
                )

            except ValueError:
                return Response(
                    {
                        "detail": (
                            "month must be in "
                            "YYYY-MM format."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # -------------------------------------------------
        # PAYMENT STATUS
        # -------------------------------------------------

        if payment_status:
            salary_qs = salary_qs.filter(
                payment_status=payment_status
            )

        # -------------------------------------------------
        # EMPLOYEE FILTERS
        # -------------------------------------------------

        salary_qs = salary_qs.filter(
            employee__in=employees
        )

        salary_qs = salary_qs.order_by(
            "employee__employee_id"
        )

        # -------------------------------------------------
        # MISSING SALARY
        # -------------------------------------------------

        if month:

            saved_employee_ids = set(
                salary_qs.values_list(
                    "employee_id",
                    flat=True
                )
            )

            filtered_employees = employees

            missing_employees = (
                filtered_employees
                .exclude(
                    id__in=saved_employee_ids
                )
                .order_by("employee_id")
            )

        else:

            saved_employee_ids = set(
                salary_qs.values_list(
                    "employee_id",
                    flat=True
                )
            )

            missing_employees = (
                employees
                .exclude(
                    id__in=saved_employee_ids
                )
                .order_by("employee_id")
            )

        salary_serializer = SalaryPaymentSerializer(
            salary_qs,
            many=True
        )

        missing_serializer = SalaryEmployeeSerializer(
            missing_employees,
            many=True
        )

        return Response({
            "month": month,

            "total_employees": employees.count(),

            "saved_entries": salary_qs.count(),

            "missing_entries": missing_employees.count(),

            "missing_employees": (
                missing_serializer.data
            ),

            "salary_records": (
                salary_serializer.data
            ),
        })

    def post(self, request):

        serializer = SalaryPaymentSerializer(
            data=request.data
        )

        if serializer.is_valid():

            salary = serializer.save()

            return Response(
                SalaryPaymentSerializer(
                    salary
                ).data,
                status=status.HTTP_201_CREATED,
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )


# =========================================================
# SALARY DETAIL
# =========================================================

class SalaryPaymentDetailAPIView(APIView):

    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        return get_object_or_404(
            SalaryPayment.objects.select_related(
                "employee"
            ),
            pk=pk,
        )

    def get(self, request, pk):

        salary = self.get_object(pk)

        serializer = SalaryPaymentSerializer(
            salary
        )

        return Response(
            serializer.data
        )

    def put(self, request, pk):

        salary = self.get_object(pk)

        serializer = SalaryPaymentSerializer(
            salary,
            data=request.data
        )

        if serializer.is_valid():

            salary = serializer.save()

            return Response(
                SalaryPaymentSerializer(
                    salary
                ).data
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    def patch(self, request, pk):

        salary = self.get_object(pk)

        serializer = SalaryPaymentSerializer(
            salary,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():

            salary = serializer.save()

            return Response(
                SalaryPaymentSerializer(
                    salary
                ).data
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    def delete(self, request, pk):

        salary = self.get_object(pk)

        salary.delete()

        return Response(
            {
                "message": "Salary deleted successfully."
            },
            status=status.HTTP_204_NO_CONTENT,
        )


# =========================================================
# ADVANCE LIST + CREATE
# =========================================================

class AdvanceListCreateAPIView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        employees = filter_employees(request)

        status_filter = request.query_params.get(
            "status",
            ""
        ).strip()

        date_from = request.query_params.get(
            "date_from",
            ""
        ).strip()

        date_to = request.query_params.get(
            "date_to",
            ""
        ).strip()

        advances = Advance.objects.select_related(
            "employee"
        ).filter(
            employee__in=employees
        )

        # -------------------------------------------------
        # STATUS
        # -------------------------------------------------

        if status_filter:
            advances = advances.filter(
                status=status_filter
            )

        # -------------------------------------------------
        # DATE FROM
        # -------------------------------------------------

        if date_from:
            advances = advances.filter(
                advance_date__gte=date_from
            )

        # -------------------------------------------------
        # DATE TO
        # -------------------------------------------------

        if date_to:
            advances = advances.filter(
                advance_date__lte=date_to
            )

        advances = advances.order_by(
            "-advance_date",
            "employee__employee_id"
        )

        serializer = AdvanceSerializer(
            advances,
            many=True
        )

        return Response({
            "count": advances.count(),
            "results": serializer.data,
        })

    def post(self, request):

        serializer = AdvanceSerializer(
            data=request.data
        )

        if serializer.is_valid():

            advance = serializer.save()

            return Response(
                AdvanceSerializer(
                    advance
                ).data,
                status=status.HTTP_201_CREATED,
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )


# =========================================================
# ADVANCE DETAIL
# =========================================================

class AdvanceDetailAPIView(APIView):

    permission_classes = [IsAuthenticated]

    def get_object(self, pk):

        return get_object_or_404(
            Advance.objects.select_related(
                "employee"
            ),
            pk=pk,
        )

    def get(self, request, pk):

        advance = self.get_object(pk)

        serializer = AdvanceSerializer(
            advance
        )

        return Response(
            serializer.data
        )

    def patch(self, request, pk):

        advance = self.get_object(pk)

        serializer = AdvanceSerializer(
            advance,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():

            advance = serializer.save()

            return Response(
                AdvanceSerializer(
                    advance
                ).data
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    def delete(self, request, pk):

        advance = self.get_object(pk)

        advance.delete()

        return Response(
            {
                "message": "Advance deleted successfully."
            },
            status=status.HTTP_204_NO_CONTENT,
        )


from datetime import datetime, date, timedelta
from decimal import Decimal

from django.db.models import Q, Sum

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import ValidationError

from .models import (
    Employee,
    WageConfig,
    Attendance,
    Advance,
)

from .serializers import (
    AttendanceEmployeeSerializer,
    WageConfigSerializer,
    AttendanceSerializer,
)


# ============================================================
# PAGINATION
# ============================================================

class EmployeePagination(PageNumberPagination):

    page_size = 25

    page_size_query_param = "page_size"

    max_page_size = 100


class AttendancePagination(PageNumberPagination):

    page_size = 50

    page_size_query_param = "page_size"

    max_page_size = 200


# ============================================================
# EMPLOYEE SEARCH
# ============================================================

class AttendanceEmployeeView(APIView):

    def get(self, request):

        queryset = Employee.objects.filter(
            archived=False,
            employment_status="Active",
        )

        search = request.GET.get(
            "search",
            "",
        ).strip()

        department = request.GET.get(
            "department",
            "",
        ).strip()

        branch = request.GET.get(
            "branch",
            "",
        ).strip()

        employment_type = request.GET.get(
            "employment_type",
            "",
        ).strip()

        work_location = request.GET.get(
            "work_location",
            "",
        ).strip()

        # ----------------------------------------------------
        # SEARCH
        # ----------------------------------------------------

        if search:

            queryset = queryset.filter(
                Q(employee_id__icontains=search)
                |
                Q(employee_code__icontains=search)
                |
                Q(first_name__icontains=search)
                |
                Q(last_name__icontains=search)
                |
                Q(mobile__icontains=search)
                |
                Q(email__icontains=search)
            )

        # ----------------------------------------------------
        # FILTERS
        # ----------------------------------------------------

        if department:

            queryset = queryset.filter(
                department=department
            )

        if branch:

            queryset = queryset.filter(
                branch=branch
            )

        if employment_type:

            queryset = queryset.filter(
                employment_type=employment_type
            )

        if work_location:

            queryset = queryset.filter(
                work_location=work_location
            )

        queryset = queryset.order_by(
            "employee_id"
        )

        paginator = EmployeePagination()

        page = paginator.paginate_queryset(
            queryset,
            request,
        )

        serializer = AttendanceEmployeeSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data
        )


# ============================================================
# WAGE CONFIG VIEWSET
# ============================================================

class WageConfigViewSet(ModelViewSet):

    serializer_class = WageConfigSerializer

    def get_queryset(self):

        queryset = (
            WageConfig.objects
            .select_related("employee")
            .filter(
                employee__archived=False,
                employee__employment_status="Active",
            )
        )

        search = self.request.GET.get(
            "search",
            "",
        ).strip()

        employee_id = self.request.GET.get(
            "employee_id",
            "",
        ).strip()

        department = self.request.GET.get(
            "department",
            "",
        ).strip()

        branch = self.request.GET.get(
            "branch",
            "",
        ).strip()

        employment_type = self.request.GET.get(
            "employment_type",
            "",
        ).strip()

        work_location = self.request.GET.get(
            "work_location",
            "",
        ).strip()

        if employee_id:

            queryset = queryset.filter(
                employee__employee_id=employee_id
            )

        if search:

            queryset = queryset.filter(
                Q(
                    employee__employee_id__icontains=search
                )
                |
                Q(
                    employee__employee_code__icontains=search
                )
                |
                Q(
                    employee__first_name__icontains=search
                )
                |
                Q(
                    employee__last_name__icontains=search
                )
            )

        if department:

            queryset = queryset.filter(
                employee__department=department
            )

        if branch:

            queryset = queryset.filter(
                employee__branch=branch
            )

        if employment_type:

            queryset = queryset.filter(
                employee__employment_type=employment_type
            )

        if work_location:

            queryset = queryset.filter(
                employee__work_location=work_location
            )

        return queryset.order_by(
            "employee__employee_id"
        )

    def create(
        self,
        request,
        *args,
        **kwargs,
    ):

        employee_id = request.data.get(
            "employee"
        )

        if not employee_id:

            return Response(
                {
                    "detail":
                        "employee is required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            employee = Employee.objects.get(
                pk=employee_id,
                archived=False,
                employment_status="Active",
            )

        except Employee.DoesNotExist:

            return Response(
                {
                    "detail":
                        "Employee not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        wage_config, created = (
            WageConfig.objects.get_or_create(
                employee=employee
            )
        )

        serializer = self.get_serializer(
            wage_config,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save(
            employee=employee
        )

        return Response(
            serializer.data,
            status=(
                status.HTTP_201_CREATED
                if created
                else status.HTTP_200_OK
            ),
        )


# ============================================================
# ATTENDANCE VIEWSET
# ============================================================

class AttendanceViewSet(ModelViewSet):

    serializer_class = AttendanceSerializer

    pagination_class = AttendancePagination

    def get_queryset(self):

        queryset = (
            Attendance.objects
            .select_related("employee")
            .filter(
                employee__archived=False,
                employee__employment_status="Active",
            )
        )

        # ----------------------------------------------------
        # FILTER PARAMETERS
        # ----------------------------------------------------

        attendance_date = self.request.GET.get(
            "date",
            "",
        ).strip()

        date_from = self.request.GET.get(
            "date_from",
            "",
        ).strip()

        date_to = self.request.GET.get(
            "date_to",
            "",
        ).strip()

        employee = self.request.GET.get(
            "employee",
            "",
        ).strip()

        employee_id = self.request.GET.get(
            "employee_id",
            "",
        ).strip()

        search = self.request.GET.get(
            "search",
            "",
        ).strip()

        department = self.request.GET.get(
            "department",
            "",
        ).strip()

        branch = self.request.GET.get(
            "branch",
            "",
        ).strip()

        employment_type = self.request.GET.get(
            "employment_type",
            "",
        ).strip()

        work_location = self.request.GET.get(
            "work_location",
            "",
        ).strip()

        attendance_status = self.request.GET.get(
            "status",
            "",
        ).strip()

        # ----------------------------------------------------
        # DATE
        # ----------------------------------------------------

        if attendance_date:

            queryset = queryset.filter(
                date=attendance_date
            )

        if date_from:

            queryset = queryset.filter(
                date__gte=date_from
            )

        if date_to:

            queryset = queryset.filter(
                date__lte=date_to
            )

        # ----------------------------------------------------
        # EMPLOYEE
        # ----------------------------------------------------

        if employee:

            queryset = queryset.filter(
                employee_id=employee
            )

        if employee_id:

            queryset = queryset.filter(
                employee__employee_id=employee_id
            )

        # ----------------------------------------------------
        # SEARCH
        # ----------------------------------------------------

        if search:

            queryset = queryset.filter(
                Q(
                    employee__employee_id__icontains=search
                )
                |
                Q(
                    employee__employee_code__icontains=search
                )
                |
                Q(
                    employee__first_name__icontains=search
                )
                |
                Q(
                    employee__last_name__icontains=search
                )
                |
                Q(
                    employee__mobile__icontains=search
                )
            )

        # ----------------------------------------------------
        # FILTERS
        # ----------------------------------------------------

        if department:

            queryset = queryset.filter(
                employee__department=department
            )

        if branch:

            queryset = queryset.filter(
                employee__branch=branch
            )

        if employment_type:

            queryset = queryset.filter(
                employee__employment_type=employment_type
            )

        if work_location:

            queryset = queryset.filter(
                employee__work_location=work_location
            )

        if attendance_status:

            queryset = queryset.filter(
                status=attendance_status
            )

        return queryset.order_by(
            "-date",
            "employee__employee_id",
        )

    # ========================================================
    # CREATE
    # ========================================================

    def create(
        self,
        request,
        *args,
        **kwargs,
    ):

        employee_id = request.data.get(
            "employee"
        )

        attendance_date = request.data.get(
            "date"
        )

        if not employee_id:

            return Response(
                {
                    "detail":
                        "employee is required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not attendance_date:

            return Response(
                {
                    "detail":
                        "date is required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            employee = Employee.objects.get(
                pk=employee_id,
                archived=False,
                employment_status="Active",
            )

        except Employee.DoesNotExist:

            return Response(
                {
                    "detail":
                        "Employee not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        duplicate = Attendance.objects.filter(
            employee=employee,
            date=attendance_date,
        ).first()

        if duplicate:

            return Response(
                {
                    "detail":
                        "Attendance already exists for this employee and date.",

                    "id":
                        duplicate.id,
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save(
            employee=employee
        )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )

    # ========================================================
    # UPDATE
    # ========================================================

    def update(
        self,
        request,
        *args,
        **kwargs,
    ):

        instance = self.get_object()

        employee_id = request.data.get(
            "employee",
            instance.employee_id,
        )

        attendance_date = request.data.get(
            "date",
            instance.date,
        )

        duplicate = Attendance.objects.filter(
            employee_id=employee_id,
            date=attendance_date,
        ).exclude(
            pk=instance.pk
        ).exists()

        if duplicate:

            return Response(
                {
                    "detail":
                        "Attendance already exists for this employee and date."
                },
                status=status.HTTP_409_CONFLICT,
            )

        return super().update(
            request,
            *args,
            **kwargs,
        )

    # ========================================================
    # DAILY SUMMARY
    # ========================================================

    @action(
        detail=False,
        methods=["get"],
        url_path="daily-summary",
    )
    def daily_summary(
        self,
        request,
    ):

        attendance_date = request.GET.get(
            "date"
        )

        if not attendance_date:

            return Response(
                {
                    "detail":
                        "date is required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = self.get_queryset().filter(
            date=attendance_date
        )

        total_employees = Employee.objects.filter(
            archived=False,
            employment_status="Active",
        ).count()

        present_count = queryset.filter(
            status__in=[
                "PRESENT",
                "HALF_DAY",
                "WFH",
            ]
        ).count()

        absent_count = queryset.filter(
            status="ABSENT"
        ).count()

        serializer = self.get_serializer(
            queryset,
            many=True,
        )

        return Response({

            "date":
                attendance_date,

            "total_employees":
                total_employees,

            "recorded":
                queryset.count(),

            "present":
                present_count,

            "absent":
                absent_count,

            "records":
                serializer.data,
        })

    # ========================================================
    # RANGE SUMMARY
    # ========================================================

    def build_range_summary(
        self,
        start_date,
        end_date,
        employee_id=None,
    ):

        employees = Employee.objects.filter(
            archived=False,
            employment_status="Active",
        )

        if employee_id:

            employees = employees.filter(
                pk=employee_id
            )

        employees = list(
            employees.order_by(
                "employee_id"
            )
        )

        # ----------------------------------------------------
        # ATTENDANCE RECORDS
        # ----------------------------------------------------

        records = (
            Attendance.objects
            .filter(
                employee__in=employees,
                date__gte=start_date,
                date__lte=end_date,
            )
            .select_related("employee")
            .order_by(
                "employee__employee_id",
                "date",
            )
        )

        # ----------------------------------------------------
        # OUTSTANDING ADVANCES
        # ----------------------------------------------------

        advance_rows = (
            Advance.objects
            .filter(
                employee__in=employees,
                outstanding_amount__gt=0,
            )
            .values(
                "employee_id"
            )
            .annotate(
                total_outstanding=Sum(
                    "outstanding_amount"
                )
            )
        )

        advance_map = {
            row["employee_id"]:
                row["total_outstanding"]
                or Decimal("0.00")
            for row in advance_rows
        }

        # ----------------------------------------------------
        # INITIALIZE EVERY EMPLOYEE
        # ----------------------------------------------------

        buckets = {}

        for employee in employees:

            buckets[employee.id] = {

                "employee_id":
                    employee.employee_id,

                "employee_name":
                    employee.full_name,

                "days_worked":
                    0,

                "total_hours":
                    Decimal("0.00"),

                "last_rate":
                    Decimal("0.00"),

                "total_wage":
                    Decimal("0.00"),

                "outstanding_advance":
                    advance_map.get(
                        employee.id,
                        Decimal("0.00"),
                    ),

                "status_counts":
                    {},

                "missing_count":
                    0,
            }

        # ----------------------------------------------------
        # ADD ATTENDANCE
        # ----------------------------------------------------

        for record in records:

            bucket = buckets[
                record.employee_id
            ]

            # Hours

            bucket["total_hours"] += (
                record.working_hours
                or Decimal("0.00")
            )

            # Wage

            bucket["total_wage"] += (
                record.daily_wage
                or Decimal("0.00")
            )

            # Hourly rate

            if record.hourly_rate is not None:

                bucket["last_rate"] = (
                    record.hourly_rate
                )

            # Days worked

            if record.status in {
                "PRESENT",
                "HALF_DAY",
                "WFH",
            }:

                bucket["days_worked"] += 1

            # Status breakdown

            bucket["status_counts"][
                record.status
            ] = (
                bucket["status_counts"].get(
                    record.status,
                    0,
                )
                + 1
            )

        # ----------------------------------------------------
        # MISSING ATTENDANCE
        # ----------------------------------------------------

        today = date.today()

        effective_end = min(
            end_date,
            today,
        )

        if effective_end >= start_date:

            existing_records = (
                Attendance.objects
                .filter(
                    employee__in=employees,
                    date__gte=start_date,
                    date__lte=effective_end,
                )
                .values(
                    "employee_id",
                    "date",
                )
            )

            existing_map = {}

            for item in existing_records:

                existing_map.setdefault(
                    item["employee_id"],
                    set(),
                ).add(
                    item["date"]
                )

            current_date = start_date

            while current_date <= effective_end:

                for employee in employees:

                    # Before joining date
                    if (
                        employee.joining_date
                        and current_date
                        < employee.joining_date
                    ):
                        continue

                    employee_records = (
                        existing_map.get(
                            employee.id,
                            set(),
                        )
                    )

                    if current_date not in employee_records:

                        buckets[
                            employee.id
                        ]["missing_count"] += 1

                current_date += timedelta(
                    days=1
                )

        return list(
            buckets.values()
        )

    # ========================================================
    # WEEKLY SUMMARY
    # ========================================================

    @action(
        detail=False,
        methods=["get"],
        url_path="weekly-summary",
    )
    def weekly_summary(
        self,
        request,
    ):

        selected_date = request.GET.get(
            "date"
        )

        if not selected_date:

            return Response(
                {
                    "detail":
                        "date is required. Use YYYY-MM-DD."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            selected_date = datetime.strptime(
                selected_date,
                "%Y-%m-%d",
            ).date()

        except ValueError:

            return Response(
                {
                    "detail":
                        "Invalid date. Use YYYY-MM-DD."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Monday
        week_start = (
            selected_date
            - timedelta(
                days=selected_date.weekday()
            )
        )

        # Sunday
        week_end = (
            week_start
            + timedelta(days=6)
        )

        employee_id = request.GET.get(
            "employee"
        )

        data = self.build_range_summary(
            week_start,
            week_end,
            employee_id,
        )

        total_hours = sum(
            (
                row["total_hours"]
                for row in data
            ),
            Decimal("0.00"),
        )

        total_wage = sum(
            (
                row["total_wage"]
                for row in data
            ),
            Decimal("0.00"),
        )

        return Response({

            "start_date":
                week_start,

            "end_date":
                week_end,

            "total_hours":
                total_hours,

            "total_wage":
                total_wage,

            "employees":
                len(data),

            "results":
                data,
        })

    # ========================================================
    # MONTHLY SUMMARY
    # ========================================================

    @action(
        detail=False,
        methods=["get"],
        url_path="monthly-summary",
    )
    def monthly_summary(
        self,
        request,
    ):

        month = request.GET.get(
            "month"
        )

        if not month:

            return Response(
                {
                    "detail":
                        "month is required. Use YYYY-MM."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            month_start = datetime.strptime(
                month,
                "%Y-%m",
            ).date()

        except ValueError:

            return Response(
                {
                    "detail":
                        "Invalid month. Use YYYY-MM."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ----------------------------------------------------
        # FIRST DAY OF NEXT MONTH
        # ----------------------------------------------------

        if month_start.month == 12:

            next_month = date(
                month_start.year + 1,
                1,
                1,
            )

        else:

            next_month = date(
                month_start.year,
                month_start.month + 1,
                1,
            )

        month_end = (
            next_month
            - timedelta(days=1)
        )

        employee_id = request.GET.get(
            "employee"
        )

        data = self.build_range_summary(
            month_start,
            month_end,
            employee_id,
        )

        # ----------------------------------------------------
        # TOP CARDS
        # ----------------------------------------------------

        total_working_days = sum(
            (
                row["days_worked"]
                for row in data
            ),
            0,
        )

        total_working_hours = sum(
            (
                row["total_hours"]
                for row in data
            ),
            Decimal("0.00"),
        )

        total_wage = sum(
            (
                row["total_wage"]
                for row in data
            ),
            Decimal("0.00"),
        )

        total_missing = sum(
            (
                row["missing_count"]
                for row in data
            ),
            0,
        )

        total_employees = (
            Employee.objects
            .filter(
                archived=False,
                employment_status="Active",
            )
            .count()
        )

        if employee_id:

            total_employees = (
                Employee.objects
                .filter(
                    pk=employee_id,
                    archived=False,
                    employment_status="Active",
                )
                .count()
            )

        return Response({

            "month":
                month,

            "start_date":
                month_start,

            "end_date":
                month_end,

            "total_employees":
                total_employees,

            "total_working_days":
                total_working_days,

            "total_working_hours":
                total_working_hours,

            "total_wage":
                total_wage,

            "missing_attendance_count":
                total_missing,

            "results":
                data,
        })

    # ========================================================
    # EMPLOYEE SUMMARY
    # ========================================================

    @action(
        detail=False,
        methods=["get"],
        url_path="employee-summary",
    )
    def employee_summary(
        self,
        request,
    ):

        employee_id = request.GET.get(
            "employee"
        )

        if not employee_id:

            return Response(
                {
                    "detail":
                        "employee is required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            employee = Employee.objects.get(
                pk=employee_id,
                archived=False,
                employment_status="Active",
            )

        except Employee.DoesNotExist:

            return Response(
                {
                    "detail":
                        "Employee not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        today = date.today()

        # ----------------------------------------------------
        # CURRENT WEEK
        # ----------------------------------------------------

        week_start = (
            today
            - timedelta(
                days=today.weekday()
            )
        )

        week_end = (
            week_start
            + timedelta(days=6)
        )

        # ----------------------------------------------------
        # CURRENT MONTH
        # ----------------------------------------------------

        month_start = date(
            today.year,
            today.month,
            1,
        )

        if today.month == 12:

            next_month = date(
                today.year + 1,
                1,
                1,
            )

        else:

            next_month = date(
                today.year,
                today.month + 1,
                1,
            )

        month_end = (
            next_month
            - timedelta(days=1)
        )

        # ----------------------------------------------------
        # DATA
        # ----------------------------------------------------

        week_data = self.build_range_summary(
            week_start,
            week_end,
            employee.id,
        )

        month_data = self.build_range_summary(
            month_start,
            month_end,
            employee.id,
        )

        # ----------------------------------------------------
        # WAGE CONFIG
        # ----------------------------------------------------

        wage_config = (
            WageConfig.objects
            .filter(
                employee=employee
            )
            .first()
        )

        wage_data = None

        if wage_config:

            wage_data = {

                "salary_type":
                    wage_config.salary_type,

                "hourly_rate":
                    wage_config.hourly_rate,

                "monthly_salary":
                    wage_config.monthly_salary,

                "standard_hours_per_day":
                    wage_config.standard_hours_per_day,

                "paid_leave_policy":
                    wage_config.paid_leave_policy,

                "holiday_policy":
                    wage_config.holiday_policy,

                "weekly_off_policy":
                    wage_config.weekly_off_policy,
            }

        return Response({

            "employee": {

                "id":
                    employee.id,

                "employee_id":
                    employee.employee_id,

                "employee_name":
                    employee.full_name,

                "department":
                    employee.department,

                "designation":
                    employee.designation,

                "branch":
                    employee.branch,

                "employment_type":
                    employee.employment_type,

                "work_location":
                    employee.work_location,
            },

            "week": {

                "start_date":
                    week_start,

                "end_date":
                    week_end,

                "summary":
                    (
                        week_data[0]
                        if week_data
                        else None
                    ),
            },

            "month": {

                "start_date":
                    month_start,

                "end_date":
                    month_end,

                "summary":
                    (
                        month_data[0]
                        if month_data
                        else None
                    ),
            },

            "wage_config":
                wage_data,
        })

#

# for material planning module starts here 


class InventoryAPIView(APIView):

    permission_classes = [IsMaterialPlanning]

    def get(self, request):

        modules = [
            {
                "id": "material",
                "code": "MOD-01 / MAT",
                "title": "Materials",
                "description": (
                    "Manage all raw materials used in manufacturing "
                    "— from structural steel to finished sheet stock."
                ),
                "icon": "layers",
                "accent": "steel",
                "path": "/inventory/material",
                "examples": [
                    "Plates",
                    "Pipes",
                    "Channels",
                    "Angles",
                    "Flats",
                    "Beams",
                    "Sheets",
                    "Rods",
                    "Structural Steel",
                ],
            },
            {
                "id": "consumable",
                "code": "MOD-02 / CON",
                "title": "Consumables",
                "description": (
                    "Manage consumables used during production "
                    "— welding, grinding, fastening, and safety supplies."
                ),
                "icon": "wrench",
                "accent": "amber",
                "path": "/inventory/consumable",
                "examples": [
                    "Welding Rods",
                    "Welding Wire",
                    "Grinding Wheels",
                    "Cutting Discs",
                    "Paint",
                    "Primer",
                    "Gas Cylinders",
                    "Bolts",
                    "Nuts",
                    "Washers",
                    "Safety Items",
                ],
            },
        ]

        return Response({
            "success": True,
            "data": {
                "modules": modules,
                "total_modules": len(modules),
                "total_items": 0,
                "operational": "24/7",
            }
        })



class MaterialMenuAPIView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsMaterialPlanning,
    ]

    def get(self, request):
        menu_cards = [
            {
                "code": "DB",
                "title": "DWG & BOM",
                "description": "Manage projects, drawings and bill of materials.",
                "icon": "ruler",
                "path": "/inventory/material/dwg-bom",
            },
            {
                "code": "PO",
                "title": "PO Integration",
                "description": "Integrate project BOM materials with purchase order descriptions.",
                "icon": "clipboard-list",
                "path": "/inventory/material/po-integration",
            },
            {
                "code": "GRN",
                "title": "GRN / Receive Material",
                "description": "Receive and track materials against actual and dummy purchase orders.",
                "icon": "truck",
                "path": "/inventory/material/grn",
            },
            {
                "code": "STK",
                "title": "Material Stock",
                "description": "Track available material by unit, source and specification.",
                "icon": "boxes",
                "path": "/inventory/material/material-stock",
            },
            {
                "code": "IJW",
                "title": "Issue to Job Work",
                "description": "Issue available material for in-house or outsourced job work processes.",
                "icon": "briefcase",
                "path": "/inventory/material/issue-to-jobwork",
            },
            {
                "code": "RJW",
                "title": "Receive from Job Work",
                "description": "Receive completed job work, record output pieces and manage remaining material.",
                "icon": "briefcase",
                "path": "/inventory/material/receive-from-jobwork",
            },
            {
                "code": "IPR",
                "title": "Issue to Production",
                "description": "Issue available material from stock to production for manufacturing.",
                "icon": "factory",
                "path": "/inventory/material/issue-to-production",
            },
            {
                "code": "PAI",
                "title": "Production Assembly Integration",
                "description": "Combine production materials and prior assemblies into a planned assembly.",
                "icon": "combine",
                "path": "/inventory/material/production-assembly-integration",
            },
            {
                "code": "OPR",
                "title": "Production Operation",
                "description": "Manage and track production operations, workflows, and manufacturing processes.",
                "icon": "settings",
                "path": "/inventory/material/production-operation",
            },
            {
                "code": "RWK",
                "title": "Rework",
                "description": "Track QC-rejected quantities through rework until they are cleared and released.",
                "icon": "wrench",
                "path": "/inventory/material/rework",
            },
            {
                "code": "SCR",
                "title": "Scrap",
                "description": "Create and track scrap directly from a Purchase Order.",
                "icon": "recycle",
                "path": "/inventory/material/scrap",
            },
            {
                "code": "DSP",
                "title": "Dispatch",
                "description": "Prepare and record outgoing dispatch of finished and processed material.",
                "icon": "send",
                "path": "/inventory/material/dispatch",
            },
            {
                "code": "RPT",
                "title": "Reports",
                "description": "Read-only reports covering the full material journey.",
                "icon": "bar-chart",
                "path": "/inventory/material/reports",
            },
        ]

        return Response({
            "success": True,
            "data": {
                "menu_cards": menu_cards,
                "total_modules": len(menu_cards),
            },
        })
class ConsumableDashboardView(APIView):
    """
    Consumable module dashboard.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):

        return Response({
            "success": True,
            "module": "consumable",
            "title": "Consumable Inventory",

            "actions": [
                {
                    "code": "GRN",
                    "title": "GRN (Goods Receipt Note)",
                    "description": "Receive consumables from suppliers.",
                    "path": "/inventory/consumable/grn",
                },
                {
                    "code": "STK",
                    "title": "Consumable Stock",
                    "description": "Display current consumable stock levels.",
                    "path": "/inventory/consumable/stock",
                },
                {
                    "code": "ISS",
                    "title": "Issue Consumables",
                    "description": "Issue consumables to departments or production.",
                    "path": "/inventory/consumable/issue",
                },
                {
                    "code": "RET",
                    "title": "Return Consumables",
                    "description": "Return unused consumables back to inventory.",
                    "path": "/inventory/consumable/return",
                },
                {
                    "code": "RPT",
                    "title": "Reports",
                    "description": "GRN, stock, issue, and consumption reports.",
                    "path": "/inventory/consumable/reports",
                },
            ]
        })

    
    
class ConsumableGRNPOItemListAPIView(APIView):
    """
    GET /erp/consumable-grn/po-items/

    List every receivable PO item for the Consumable GRN flow.

    Rule:
      Skip any PO item whose (po_number, description) already
      appears in MaterialGRN. Once a PO line has been received
      via the Material GRN page, it must not appear here.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):

        # ---------------------------------------------------------
        # 1. Collect every (po_number, description) pair that has
        #    already been received through a Material GRN.
        # ---------------------------------------------------------
        material_grn_pairs = set(
            MaterialGRN.objects
            .exclude(po_number="")
            .exclude(description="")
            .values_list("po_number", "description")
            .distinct()
        )

        # ---------------------------------------------------------
        # 2. Pull confirmed PO items
        # ---------------------------------------------------------
        items = (
            PurchaseOrderItem.objects
            .filter(
                purchase_order__status=PurchaseOrder.Status.CONFIRMED,
            )
            .select_related("purchase_order")
            .order_by("purchase_order__po_number", "id")
        )

        data = []

        for item in items:

            # -----------------------------------------------------
            # 3. Skip if Material GRN already covers this (po, desc)
            # -----------------------------------------------------
            pair = (
                str(item.po_number or ""),
                str(item.description or ""),
            )

            if pair in material_grn_pairs:
                continue

            # -----------------------------------------------------
            # 4. Aggregate Consumable receipts for this PO item
            # -----------------------------------------------------
            received = (
                ConsumableGRN.objects
                .filter(purchase_order_item=item)
                .aggregate(total=Sum("received_quantity"))["total"]
                or 0
            )

            ordered = item.quantity or 0
            pending = max(ordered - received, 0)

            if received <= 0:
                status = "Pending"
            elif received >= ordered:
                status = "Fully Received"
            else:
                status = "Partially Received"

            # -----------------------------------------------------
            # 5. Build row
            # -----------------------------------------------------
            data.append({
                "id": item.id,
                "poNumber": item.po_number,
                "itemCode": item.item_code,
                "description": item.description,
                "orderedQty": ordered,
                "receivedQty": received,
                "pendingQty": pending,
                "unit": item.unit,
                "status": status,
                "supplier": item.purchase_order.vendor,
                "consumableName": item.description,
                "category": "",
                "warehouse": "",
            })

        return Response(data)



def generate_grn_number():
    last_grn = (
        ConsumableGRN.objects
        .order_by("-id")
        .first()
    )

    if last_grn is None:
        next_number = 1
    else:
        next_number = last_grn.id + 1

    return f"CGRN-{next_number:05d}"





def clean_supplier(raw):
    """
    PurchaseOrder.vendor is a JSONField, so it may be stored as
    a stringified dict (e.g. "{'companyName': 'ABC', ...}").
    Return a readable supplier name.
    """
    if not raw:
        return ""

    if isinstance(raw, dict):
        candidate = (
            raw.get("companyName")
            or raw.get("company_name")
            or raw.get("name")
            or raw.get("supplier")
            or ""
        )
        return str(candidate).strip()

    text = str(raw).strip()

    # Salvage stringified dicts
    if text.startswith("{") and text.endswith("}"):
        try:
            import ast
            parsed = ast.literal_eval(text)
            if isinstance(parsed, dict):
                candidate = (
                    parsed.get("companyName")
                    or parsed.get("company_name")
                    or parsed.get("name")
                    or parsed.get("supplier")
                    or ""
                )
                if candidate:
                    return str(candidate).strip()
        except (ValueError, SyntaxError):
            pass

    return text

class ConsumableGRNReceiveAPIView(APIView):

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, item_id):

        try:
            po_item = (
                PurchaseOrderItem.objects
                .select_for_update()
                .select_related("purchase_order")
                .get(
                    id=item_id,
                    purchase_order__status=PurchaseOrder.Status.CONFIRMED,
                )
            )

        except PurchaseOrderItem.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "detail": "Purchase Order item not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        quantity_received = Decimal(
            str(request.data.get("quantityReceived", 0))
        )

        received_by = str(
            request.data.get("receivedBy", "")
        ).strip()

        remarks = str(
            request.data.get("remarks", "")
        ).strip()

        warehouse = str(
            request.data.get("warehouse", "")
        ).strip()

        # -----------------------------
        # VALIDATION
        # -----------------------------

        if quantity_received <= 0:
            return Response(
                {
                    "success": False,
                    "detail": "Quantity received must be greater than zero.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not received_by:
            return Response(
                {
                    "success": False,
                    "detail": "Received by is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_warehouses = {
            "Unit One",
            "Unit Two",
        }

        if warehouse not in allowed_warehouses:
            return Response(
                {
                    "success": False,
                    "detail": "Invalid warehouse. Select Unit One or Unit Two.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # -----------------------------
        # PREVIOUS RECEIVED
        # -----------------------------

        previous_received = (
            ConsumableGRN.objects
            .filter(
                purchase_order_item=po_item
            )
            .aggregate(
                total=Sum("received_quantity")
            )["total"]
            or Decimal("0")
        )

        ordered_quantity = (
            po_item.quantity or Decimal("0")
        )

        pending_quantity = (
            ordered_quantity - previous_received
        )

        if pending_quantity <= 0:
            return Response(
                {
                    "success": False,
                    "detail": "This PO item is already fully received.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if quantity_received > pending_quantity:
            return Response(
                {
                    "success": False,
                    "detail": (
                        f"Only {pending_quantity} "
                        f"{po_item.unit} is pending."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # -----------------------------
        # CALCULATE
        # -----------------------------

        total_received = (
            previous_received + quantity_received
        )

        remaining = (
            ordered_quantity - total_received
        )

        if remaining <= 0:
            grn_status = (
                ConsumableGRN.Status.FULLY_RECEIVED
            )
        else:
            grn_status = (
                ConsumableGRN.Status.PARTIALLY_RECEIVED
            )

        # -----------------------------
        # CREATE GRN
        # -----------------------------

        grn = ConsumableGRN.objects.create(

            grn_number=generate_grn_number(),

            grn_type=ConsumableGRN.GRNType.PO,

            purchase_order_item=po_item,

            po_number=po_item.po_number,

            po_description=po_item.description,

            supplier=(clean_supplier(po_item.purchase_order.vendor)),

            consumable_name=po_item.description,

            unit=po_item.unit,

            ordered_quantity=ordered_quantity,

            received_quantity=quantity_received,

            pending_quantity=remaining,

            warehouse=warehouse,

            status=grn_status,

            received_by=received_by,

            remarks=remarks,
        )

        return Response(
            {
                "success": True,
                "message": "Consumable received successfully.",
                "data": ConsumableGRNSerializer(grn).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ConsumableGRNDirectCreateAPIView(APIView):

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):

        supplier = str(
            request.data.get("supplier", "")
        ).strip()

        consumable_name = str(
            request.data.get("consumableName", "")
        ).strip()

        category = str(
            request.data.get("category", "")
        ).strip()

        unit = str(
            request.data.get("unit", "")
        ).strip()

        warehouse = str(
            request.data.get("warehouse", "")
        ).strip()

        received_by = str(
            request.data.get("receivedBy", "")
        ).strip()

        remarks = str(
            request.data.get("remarks", "")
        ).strip()

        try:
            quantity = Decimal(
                str(request.data.get("quantity", 0))
            )
        except (ValueError, TypeError, InvalidOperation):
            return Response(
                {
                    "success": False,
                    "detail": "Invalid quantity.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # -----------------------------
        # REQUIRED VALIDATION
        # -----------------------------

        required_fields = {
            "supplier": supplier,
            "consumableName": consumable_name,
            "category": category,
            "unit": unit,
            "warehouse": warehouse,
            "receivedBy": received_by,
        }

        missing = [
            field
            for field, value in required_fields.items()
            if not value
        ]

        if missing:
            return Response(
                {
                    "success": False,
                    "detail": (
                        "Required fields missing: "
                        + ", ".join(missing)
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if quantity <= 0:
            return Response(
                {
                    "success": False,
                    "detail": "Quantity must be greater than zero.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # -----------------------------
        # WAREHOUSE VALIDATION
        # -----------------------------

        if warehouse not in {
            "Unit One",
            "Unit Two",
        }:
            return Response(
                {
                    "success": False,
                    "detail": "Invalid warehouse. Select Unit One or Unit Two.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # -----------------------------
        # CREATE DIRECT GRN
        # -----------------------------

        grn = ConsumableGRN.objects.create(

            grn_number=generate_grn_number(),

            grn_type=ConsumableGRN.GRNType.DIRECT,

            po_number="",

            po_description="Direct Purchase",

            supplier=supplier,

            consumable_name=consumable_name,

            category=category,

            unit=unit,

            ordered_quantity=quantity,

            received_quantity=quantity,

            pending_quantity=Decimal("0"),

            warehouse=warehouse,

            status=ConsumableGRN.Status.FULLY_RECEIVED,

            received_by=received_by,

            remarks=remarks,
        )

        return Response(
            {
                "success": True,
                "message": "Direct GRN created successfully.",
                "data": ConsumableGRNSerializer(grn).data,
            },
            status=status.HTTP_201_CREATED,
        )
    



# =====================================================================
# CONSUMABLE STOCK + ISSUE
# =====================================================================

LOW_STOCK_THRESHOLD = 10



def clean_supplier(raw):
    """
    PurchaseOrder.vendor is a JSONField, so it may be stored as a
    stringified dict (e.g. "{'companyName': 'ABC', ...}").
    Return a readable supplier name.
    """
    if not raw:
        return ""

    if isinstance(raw, dict):
        candidate = (
            raw.get("companyName")
            or raw.get("company_name")
            or raw.get("name")
            or raw.get("supplier")
            or ""
        )
        return str(candidate).strip()

    text = str(raw).strip()

    # Salvage stringified dicts
    if text.startswith("{") and text.endswith("}"):
        try:
            import ast
            parsed = ast.literal_eval(text)
            if isinstance(parsed, dict):
                candidate = (
                    parsed.get("companyName")
                    or parsed.get("company_name")
                    or parsed.get("name")
                    or parsed.get("supplier")
                    or ""
                )
                if candidate:
                    return str(candidate).strip()
        except (ValueError, SyntaxError):
            pass

    return text





def _available_qty_for_grn(grn):
    """
    Available stock for a single GRN line.

    available = received − issued + returned

    Returns must be added back so that stock reappears in the
    Consumable Stock page and in the Issue Consumable page after
    a return.
    """
    received = grn.received_quantity or Decimal("0")

    issued = (
        ConsumableIssue.objects
        .filter(grn=grn)
        .aggregate(total=Sum("quantity_issued"))["total"]
        or Decimal("0")
    )

    returned = (
        ConsumableReturn.objects
        .filter(issue__grn=grn)
        .aggregate(total=Sum("quantity_returned"))["total"]
        or Decimal("0")
    )

    return received - issued + returned


def generate_issue_number():
    last = ConsumableIssue.objects.order_by("-id").first()
    next_number = 1 if last is None else last.id + 1
    return f"CISS-{next_number:05d}"


# ---------------------------------------------------------------------
# GET /erp/consumable-grn/stock/
# ---------------------------------------------------------------------

class ConsumableStockAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        grns = (
            ConsumableGRN.objects
            .all()
            .order_by("-created_at")
        )

        data = []

        for grn in grns:
            available = _available_qty_for_grn(grn)

            # Hide depleted rows
            if available <= 0:
                continue

            if available <= LOW_STOCK_THRESHOLD:
                status_value = "Low Stock"
            else:
                status_value = "In Stock"

            data.append({
                "id": grn.id,
                "referenceNumber": grn.grn_number,
                "consumableName": (
                    grn.consumable_name
                    or grn.po_description
                    or "—"
                ),
                "category": grn.category or "—",
                "unit": grn.unit or "—",
                "availableQty": float(available),
                "warehouse": grn.warehouse or "—",
                "supplier": clean_supplier(grn.supplier) or "—",
                "lastReceivedDate": (
                    grn.created_at.strftime("%Y-%m-%d")
                    if grn.created_at
                    else "—"
                ),
                "status": status_value,
                "poNumber": grn.po_number,
                "grnType": grn.grn_type,
            })

        return Response(data)


# ---------------------------------------------------------------------
# GET /erp/consumable-grn/issue-stock/   (for IssueConsumable page)
# ---------------------------------------------------------------------
# Same shape as ConsumableStockAPIView, but keeps the extra fields
# the IssueConsumable table needs.
# ---------------------------------------------------------------------

class ConsumableIssueStockAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        grns = (
            ConsumableGRN.objects
            .all()
            .order_by("-created_at")
        )

        data = []

        for grn in grns:
            available = _available_qty_for_grn(grn)

            if available <= 0:
                continue

            data.append({
                "id": grn.id,
                "poNumber": grn.po_number or "—",
                "description": grn.po_description or "—",
                "referenceNumber": grn.grn_number,
                "consumableName": (
                    grn.consumable_name
                    or grn.po_description
                    or "—"
                ),
                "category": grn.category or "—",
                "warehouse": grn.warehouse or "—",
                "availableQty": float(available),
                "unit": grn.unit or "—",
            })

        return Response(data)


# ---------------------------------------------------------------------
# POST /erp/consumable-grn/issue/<grn_id>/
# ---------------------------------------------------------------------

class ConsumableIssueCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, grn_id):
        # Lock the GRN row so two concurrent issues can't oversell
        try:
            grn = (
                ConsumableGRN.objects
                .select_for_update()
                .get(id=grn_id)
            )
        except ConsumableGRN.DoesNotExist:
            return Response(
                {"success": False, "detail": "Stock line not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ---------------- INPUT ----------------
        department = str(request.data.get("department", "")).strip()
        employee_name = str(request.data.get("employeeName", "")).strip()
        job_card = str(request.data.get("jobCard", "")).strip()
        remarks = str(request.data.get("remarks", "")).strip()

        try:
            quantity = Decimal(str(request.data.get("quantity", 0)))
        except (ValueError, TypeError, InvalidOperation):
            return Response(
                {"success": False, "detail": "Invalid quantity."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---------------- VALIDATION ----------------
        if not department:
            return Response(
                {"success": False, "detail": "Department is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not employee_name:
            return Response(
                {"success": False, "detail": "Employee name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if quantity <= 0:
            return Response(
                {
                    "success": False,
                    "detail": "Quantity must be greater than zero.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---------------- STOCK CHECK ----------------
        available = _available_qty_for_grn(grn)

        if available <= 0:
            return Response(
                {
                    "success": False,
                    "detail": "This stock line is fully issued.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if quantity > available:
            return Response(
                {
                    "success": False,
                    "detail": (
                        f"Only {available} {grn.unit or ''} available "
                        f"to issue."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---------------- CREATE ----------------
        issue = ConsumableIssue.objects.create(
            issue_number=generate_issue_number(),
            grn=grn,
            po_number=grn.po_number,
            po_description=grn.po_description,
            consumable_name=(
                grn.consumable_name or grn.po_description
            ),
            category=grn.category,
            unit=grn.unit,
            warehouse=grn.warehouse,
            quantity_issued=quantity,
            status=ConsumableIssue.Status.ISSUED,
            department=department,
            employee_name=employee_name,
            job_card=job_card,
            remarks=remarks,
        )

        return Response(
            {
                "success": True,
                "message": "Consumable issued successfully.",
                "data": ConsumableIssueSerializer(issue).data,
            },
            status=status.HTTP_201_CREATED,
        )

# for returning consumables after issue
def generate_return_number():
    last = ConsumableReturn.objects.order_by("-id").first()
    next_number = 1 if last is None else last.id + 1
    return f"CRET-{next_number:05d}"

class ConsumableReturnableIssueListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        issues = (
            ConsumableIssue.objects
            .all()
            .order_by("-created_at")
        )

        data = []

        for issue in issues:
            issued_qty = issue.quantity_issued or Decimal("0")

            returned_qty = (
                ConsumableReturn.objects
                .filter(issue=issue)
                .aggregate(total=Sum("quantity_returned"))["total"]
                or Decimal("0")
            )

            balance_qty = issued_qty - returned_qty

            # Self-heal status if it drifted
            expected_status = (
                ConsumableIssue.Status.ISSUED
                if returned_qty <= 0
                else (
                    ConsumableIssue.Status.FULLY_RETURNED
                    if balance_qty <= 0
                    else ConsumableIssue.Status.PARTIALLY_RETURNED
                )
            )

            if issue.status != expected_status:
                issue.status = expected_status
                issue.save(update_fields=["status", "updated_at"])

            data.append({
                "id": issue.id,
                "issueNumber": issue.issue_number,
                "consumableName": (
                    issue.consumable_name
                    or issue.po_description
                    or "—"
                ),
                "department": issue.department or "—",
                "employeeName": issue.employee_name or "—",
                "jobCard": issue.job_card or "",
                "issuedQty": float(issued_qty),
                "returnedQty": float(returned_qty),
                "balanceQty": float(max(balance_qty, 0)),
                "unit": issue.unit or "—",
                "warehouse": issue.warehouse or "—",
                "status": expected_status,
            })

        return Response(data)

class ConsumableReturnCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, issue_id):
        try:
            issue = (
                ConsumableIssue.objects
                .select_for_update()
                .get(id=issue_id)
            )
        except ConsumableIssue.DoesNotExist:
            return Response(
                {"success": False, "detail": "Issue not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ---------------- INPUT ----------------
        returned_by = str(request.data.get("returnedBy", "")).strip()
        remarks = str(request.data.get("remarks", "")).strip()

        try:
            qty = Decimal(str(request.data.get("returnQty", 0)))
        except (ValueError, TypeError, InvalidOperation):
            return Response(
                {"success": False, "detail": "Invalid quantity."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if qty <= 0:
            return Response(
                {
                    "success": False,
                    "detail": "Return quantity must be greater than zero.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---------------- BALANCE CHECK ----------------
        issued_qty = issue.quantity_issued or Decimal("0")

        returned_so_far = (
            ConsumableReturn.objects
            .filter(issue=issue)
            .aggregate(total=Sum("quantity_returned"))["total"]
            or Decimal("0")
        )

        balance = issued_qty - returned_so_far

        if balance <= 0:
            return Response(
                {
                    "success": False,
                    "detail": "This issue is already fully returned.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if qty > balance:
            return Response(
                {
                    "success": False,
                    "detail": (
                        f"Only {balance} {issue.unit or ''} balance "
                        f"to return."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---------------- CREATE RETURN ----------------
        ret = ConsumableReturn.objects.create(
            return_number=generate_return_number(),
            issue=issue,
            issue_number=issue.issue_number,
            consumable_name=(
                issue.consumable_name or issue.po_description
            ),
            unit=issue.unit,
            warehouse=issue.warehouse,
            quantity_returned=qty,
            returned_by=returned_by or issue.employee_name,
            remarks=remarks,
        )

        # ---------------- REFRESH ISSUE STATUS ----------------
        total_returned = returned_so_far + qty

        if total_returned <= 0:
            new_status = ConsumableIssue.Status.ISSUED
        elif total_returned < issued_qty:
            new_status = ConsumableIssue.Status.PARTIALLY_RETURNED
        else:
            new_status = ConsumableIssue.Status.FULLY_RETURNED

        if issue.status != new_status:
            issue.status = new_status
            issue.save(update_fields=["status", "updated_at"])

        return Response(
            {
                "success": True,
                "message": "Consumable returned successfully.",
                "data": ConsumableReturnSerializer(ret).data,
            },
            status=status.HTTP_201_CREATED,
        )



# =====================================================================
# MOVEMENT HISTORY — MASTER LIST
# -----------------------------------------------------------------
# One row per (PO number + description). Aggregates every GRN that
# touched that line, plus every issue and return that came from it.
# =====================================================================

class ConsumableMovementGroupListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        grns = (
            ConsumableGRN.objects
            .all()
            .order_by("po_number", "po_description", "id")
        )

        # Group key: (po_number, po_description)
        groups = {}

        for grn in grns:
            key = (
                grn.po_number or "",
                grn.po_description or grn.consumable_name or "",
            )

            if key not in groups:
                groups[key] = {
                    "poNumber": grn.po_number or "—",
                    "poDescription": (
                        grn.po_description
                        or grn.consumable_name
                        or "—"
                    ),
                    "consumableName": (
                        grn.consumable_name
                        or grn.po_description
                        or "—"
                    ),
                    "category": grn.category or "—",
                    "unit": grn.unit or "—",
                    "supplier": clean_supplier(grn.supplier) or "—",
                    "grnIds": [],
                    "grnNumbers": [],
                    "warehouses": set(),
                    "receivedQty": Decimal("0"),
                    "issuedQty": Decimal("0"),
                    "returnedQty": Decimal("0"),
                    "lastReceivedAt": None,
                }

            g = groups[key]

            g["grnIds"].append(grn.id)
            g["grnNumbers"].append(grn.grn_number)

            if grn.warehouse:
                g["warehouses"].add(grn.warehouse)

            g["receivedQty"] += grn.received_quantity or Decimal("0")

            g["issuedQty"] += (
                ConsumableIssue.objects
                .filter(grn=grn)
                .aggregate(total=Sum("quantity_issued"))["total"]
                or Decimal("0")
            )

            g["returnedQty"] += (
                ConsumableReturn.objects
                .filter(issue__grn=grn)
                .aggregate(total=Sum("quantity_returned"))["total"]
                or Decimal("0")
            )

            if grn.created_at and (
                g["lastReceivedAt"] is None
                or grn.created_at > g["lastReceivedAt"]
            ):
                g["lastReceivedAt"] = grn.created_at

        data = []
        for idx, (key, g) in enumerate(groups.items()):
            available = (
                g["receivedQty"] - g["issuedQty"] + g["returnedQty"]
            )

            data.append({
                "id": f"{g['poNumber']}::{g['poDescription']}::{idx}",
                "poNumber": g["poNumber"],
                "poDescription": g["poDescription"],
                "consumableName": g["consumableName"],
                "category": g["category"],
                "unit": g["unit"],
                "supplier": g["supplier"],
                "warehouses": sorted(g["warehouses"]),
                "grnIds": g["grnIds"],
                "grnNumbers": g["grnNumbers"],
                "receivedQty": float(g["receivedQty"]),
                "issuedQty": float(g["issuedQty"]),
                "returnedQty": float(g["returnedQty"]),
                "availableQty": float(available),
                "lastReceivedAt": (
                    g["lastReceivedAt"].strftime("%Y-%m-%d %H:%M")
                    if g["lastReceivedAt"]
                    else "—"
                ),
            })

        data.sort(
            key=lambda row: row["lastReceivedAt"],
            reverse=True,
        )

        return Response(data)


# =====================================================================
# MOVEMENT HISTORY — DETAIL (timeline for one PO line)
# =====================================================================

class ConsumableMovementDetailAPIView(APIView):
    """
    GET /erp/consumable-grn/movements/detail/
        ?po_number=PO-2026-001&description=Mild Steel Plate
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        po_number = request.query_params.get("po_number", "").strip()
        description = request.query_params.get("description", "").strip()

        if not po_number and not description:
            return Response(
                {
                    "success": False,
                    "detail": "po_number or description is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        grns_qs = ConsumableGRN.objects.all()

        if po_number:
            grns_qs = grns_qs.filter(po_number=po_number)

        if description:
            grns_qs = grns_qs.filter(
                models.Q(po_description=description)
                | models.Q(consumable_name=description)
            )

        grns = list(grns_qs.order_by("id"))

        if not grns:
            return Response(
                {
                    "success": False,
                    "detail": "No GRN lines found for this PO line.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # -------- AGGREGATE --------
        total_received = sum(
            (g.received_quantity or Decimal("0")) for g in grns
        )

        issues = list(
            ConsumableIssue.objects
            .filter(grn__in=grns)
            .order_by("-created_at")
        )

        total_issued = sum(
            (i.quantity_issued or Decimal("0")) for i in issues
        )

        returns = list(
            ConsumableReturn.objects
            .filter(issue__grn__in=grns)
            .select_related("issue")
            .order_by("-created_at")
        )

        total_returned = sum(
            (r.quantity_returned or Decimal("0")) for r in returns
        )

        total_available = total_received - total_issued + total_returned

        first = grns[0]
        warehouses = sorted({
            g.warehouse for g in grns if g.warehouse
        })

        summary = {
            "poNumber": first.po_number or "—",
            "poDescription": (
                first.po_description
                or first.consumable_name
                or "—"
            ),
            "consumableName": (
                first.consumable_name
                or first.po_description
                or "—"
            ),
            "category": first.category or "—",
            "unit": first.unit or "—",
            "supplier": clean_supplier(first.supplier) or "—",
            "warehouses": warehouses,
            "grnNumbers": [g.grn_number for g in grns],
            "receivedQty": float(total_received),
            "issuedQty": float(total_issued),
            "returnedQty": float(total_returned),
            "availableQty": float(total_available),
        }

        # -------- TIMELINE --------
        timeline = []

        for grn in grns:
            timeline.append({
                "type": "GRN",
                "date": (
                    grn.created_at.strftime("%Y-%m-%d")
                    if grn.created_at else ""
                ),
                "time": (
                    grn.created_at.strftime("%H:%M:%S")
                    if grn.created_at else ""
                ),
                "referenceNumber": grn.grn_number,
                "quantity": float(grn.received_quantity or 0),
                "unit": grn.unit or "",
                "user": grn.received_by or "",
                "department": "",
                "jobCard": "",
                "warehouse": grn.warehouse or "",
                "remarks": grn.remarks or "",
            })

        for issue in issues:
            timeline.append({
                "type": "Issue",
                "date": (
                    issue.created_at.strftime("%Y-%m-%d")
                    if issue.created_at else ""
                ),
                "time": (
                    issue.created_at.strftime("%H:%M:%S")
                    if issue.created_at else ""
                ),
                "referenceNumber": issue.issue_number,
                "quantity": float(issue.quantity_issued or 0),
                "unit": issue.unit or "",
                "user": issue.employee_name or "",
                "department": issue.department or "",
                "jobCard": issue.job_card or "",
                "warehouse": issue.warehouse or "",
                "remarks": issue.remarks or "",
            })

        for ret in returns:
            timeline.append({
                "type": "Return",
                "date": (
                    ret.created_at.strftime("%Y-%m-%d")
                    if ret.created_at else ""
                ),
                "time": (
                    ret.created_at.strftime("%H:%M:%S")
                    if ret.created_at else ""
                ),
                "referenceNumber": ret.return_number,
                "quantity": float(ret.quantity_returned or 0),
                "unit": ret.unit or "",
                "user": ret.returned_by or "",
                "department": (
                    ret.issue.department if ret.issue else ""
                ),
                "jobCard": (
                    ret.issue.job_card if ret.issue else ""
                ),
                "warehouse": ret.warehouse or "",
                "remarks": ret.remarks or "",
            })

        timeline.sort(
            key=lambda t: (t["date"], t["time"]),
            reverse=True,
        )

        return Response({
            "summary": summary,
            "timeline": timeline,
        })


# for material drwbom
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from .models import Project, Drawing, BOMItem
from .serializers import ProjectSerializer, DrawingSerializer, BOMItemSerializer
from .permissions import IsMaterialPlanning


# =====================================================================
# PROJECT VIEWS
# =====================================================================

class ProjectListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        projects = Project.objects.all().order_by("-created_at")
        serializer = ProjectSerializer(projects, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ProjectSerializer(data=request.data)
        if serializer.is_valid():
            project = serializer.save(created_by=request.user)
            return Response({
                "success": True,
                "message": "Project created successfully.",
                "data": ProjectSerializer(project).data,
            }, status=status.HTTP_201_CREATED)
        return Response({
            "success": False,
            "errors": serializer.errors,
        }, status=status.HTTP_400_BAD_REQUEST)


class ProjectDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get_object(self, pk):
        try:
            return Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return None

    def get(self, request, pk):
        project = self.get_object(pk)
        if not project:
            return Response({"success": False, "message": "Project not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProjectSerializer(project)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        project = self.get_object(pk)
        if not project:
            return Response({"success": False, "message": "Project not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProjectSerializer(project, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)
        return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        project = self.get_object(pk)
        if not project:
            return Response({"success": False, "message": "Project not found."}, status=status.HTTP_404_NOT_FOUND)
        project.delete()
        return Response({"success": True, "message": "Project deleted successfully."}, status=status.HTTP_200_OK)


# =====================================================================
# DRAWING VIEWS
# =====================================================================

class DrawingListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        qs = Drawing.objects.select_related("project").all().order_by("-created_at")
        project_id = request.query_params.get("projectId") or request.query_params.get("project_id")
        if project_id:
            qs = qs.filter(project_id=project_id)
        serializer = DrawingSerializer(qs, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = DrawingSerializer(data=request.data)
        if serializer.is_valid():
            drawing = serializer.save()
            return Response({
                "success": True,
                "message": "Drawing created successfully.",
                "data": DrawingSerializer(drawing).data,
            }, status=status.HTTP_201_CREATED)
        return Response({
            "success": False,
            "errors": serializer.errors,
        }, status=status.HTTP_400_BAD_REQUEST)


class DrawingDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get_object(self, pk):
        try:
            return Drawing.objects.get(pk=pk)
        except Drawing.DoesNotExist:
            return None

    def get(self, request, pk):
        drawing = self.get_object(pk)
        if not drawing:
            return Response({"success": False, "message": "Drawing not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = DrawingSerializer(drawing)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        drawing = self.get_object(pk)
        if not drawing:
            return Response({"success": False, "message": "Drawing not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = DrawingSerializer(drawing, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)
        return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        drawing = self.get_object(pk)
        if not drawing:
            return Response({"success": False, "message": "Drawing not found."}, status=status.HTTP_404_NOT_FOUND)
        drawing.delete()
        return Response({"success": True, "message": "Drawing deleted successfully."}, status=status.HTTP_200_OK)


# =====================================================================
# BOM ITEM VIEWS
# =====================================================================

class BOMItemListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        qs = BOMItem.objects.select_related("drawing").all().order_by("id")
        drawing_id = request.query_params.get("drawingId") or request.query_params.get("drawing_id")
        if drawing_id:
            qs = qs.filter(drawing_id=drawing_id)
        serializer = BOMItemSerializer(qs, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = BOMItemSerializer(data=request.data)
        if serializer.is_valid():
            bom_item = serializer.save()
            return Response({
                "success": True,
                "message": "BOM item added successfully.",
                "data": BOMItemSerializer(bom_item).data,
            }, status=status.HTTP_201_CREATED)
        return Response({
            "success": False,
            "errors": serializer.errors,
        }, status=status.HTTP_400_BAD_REQUEST)


class BOMItemDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get_object(self, pk):
        try:
            return BOMItem.objects.get(pk=pk)
        except BOMItem.DoesNotExist:
            return None

    def get(self, request, pk):
        item = self.get_object(pk)
        if not item:
            return Response({"success": False, "message": "BOM item not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = BOMItemSerializer(item)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        item = self.get_object(pk)
        if not item:
            return Response({"success": False, "message": "BOM item not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = BOMItemSerializer(item, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)
        return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        item = self.get_object(pk)
        if not item:
            return Response({"success": False, "message": "BOM item not found."}, status=status.HTTP_404_NOT_FOUND)
        item.delete()
        return Response({"success": True, "message": "BOM item deleted successfully."}, status=status.HTTP_200_OK)


# =====================================================================
# BOM BATCH SAVE VIEW (For the 'Save BOM' frontend button)
# =====================================================================

class BOMBatchSaveAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request):
        drawing_id = request.data.get("drawingId")
        items = request.data.get("items", [])

        if not drawing_id:
            return Response(
                {"success": False, "message": "drawingId is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            drawing = Drawing.objects.get(id=drawing_id)
        except Drawing.DoesNotExist:
            return Response(
                {"success": False, "message": "Drawing not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        saved_items = []
        for raw_item in items:
            raw_item["drawingId"] = drawing.id
            item_id = raw_item.get("id")

            instance = None
            if item_id and not str(item_id).startswith("bom-"):
                instance = BOMItem.objects.filter(id=item_id, drawing=drawing).first()

            serializer = BOMItemSerializer(instance=instance, data=raw_item, partial=True)
            serializer.is_valid(raise_exception=True)
            saved_instance = serializer.save(drawing=drawing)
            saved_items.append(BOMItemSerializer(saved_instance).data)

        return Response({
            "success": True,
            "message": f"Successfully saved {len(saved_items)} BOM items.",
            "data": saved_items,
        }, status=status.HTTP_200_OK)

from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum, Exists, OuterRef

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import (
    BOMItem,
    PurchaseOrderItem,
  
    ConsumableIssue,
    PurchaseOrder,
)



# =========================================================
# PO ITEM CONSUMABLE ISSUE CHECK
# =========================================================

def po_item_has_consumable_issue(po_item_id):
    """
    Returns True if this exact PurchaseOrderItem has already
    been issued to Consumable.

    Relationship:

        PurchaseOrderItem
              ↓
        ConsumableGRN
              ↓
        ConsumableIssue
    """

    return ConsumableIssue.objects.filter(
        grn__purchase_order_item_id=po_item_id
    ).exists()


# =========================================================
# DUMMY PURCHASE ORDER
# =========================================================
from .serializers import (
    DummyPurchaseOrderSerializer,
    DummyPurchaseOrderItemSerializer,
)
from .models import DummyPurchaseOrder, DummyPurchaseOrderItem


class DummyPurchaseOrderCreateAPIView(APIView):
    """
    POST /erp/material/dummy-purchase-orders/

    Body:
        {
          "poNumber": "DUMMY-001",
          "itemCode": "",
          "description": "MS Plate",
          "material": "Plate",
          "length": "500",
          "width": "500",
          "thickness": "6",
          "quantity": 10,
          "unit": "Nos",
          "remarks": ""
        }

    Creates a DummyPurchaseOrder + one DummyPurchaseOrderItem.
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request):
        po_number = str(request.data.get("poNumber", "")).strip()
        description = str(request.data.get("description", "")).strip()
        unit = str(request.data.get("unit", "")).strip()

        if not po_number:
            return Response(
                {"success": False, "message": "Dummy PO number is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not description:
            return Response(
                {"success": False, "message": "Description is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not unit:
            return Response(
                {"success": False, "message": "Unit is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            quantity = Decimal(str(request.data.get("quantity", "0")))
        except (InvalidOperation, TypeError, ValueError):
            return Response(
                {"success": False, "message": "Invalid quantity."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if quantity <= 0:
            return Response(
                {"success": False, "message": "Quantity must be greater than zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if DummyPurchaseOrder.objects.filter(po_number=po_number).exists():
            return Response(
                {
                    "success": False,
                    "message": f"Dummy PO '{po_number}' already exists.",
                },
                status=status.HTTP_409_CONFLICT,
            )

        dummy_po = DummyPurchaseOrder.objects.create(
            po_number=po_number,
            remarks=str(request.data.get("remarks", "")).strip(),
            created_by=request.user,
        )

        item = DummyPurchaseOrderItem.objects.create(
            dummy_po=dummy_po,
            item_code=str(request.data.get("itemCode", "")).strip(),
            description=description,
            material=str(request.data.get("material", "")).strip(),
            length=str(request.data.get("length", "")).strip(),
            width=str(request.data.get("width", "")).strip(),
            thickness=str(request.data.get("thickness", "")).strip(),
            quantity=quantity,
            unit=unit,
            remarks=str(request.data.get("remarks", "")).strip(),
        )

        return Response(
            {
                "success": True,
                "message": "Dummy Purchase Order created.",
                "data": {
                    "poId": dummy_po.id,
                    "poNumber": dummy_po.po_number,
                    "poItemId": item.id,
                    "isDummy": True,
                },
            },
            status=status.HTTP_201_CREATED,
        )

# =====================================================================
# PROJECT-LEVEL BOM ↔ PO INTEGRATION

# =====================================================================

from django.db.models import Sum

from .serializers import (
    ProjectIntegrationRowSerializer,
    ProjectIntegrationSaveSerializer,
)


def _get_issued_po_item_ids():
    """
    PO items that have at least one ConsumableIssue.
    Those PO items are excluded from Material Planning entirely.
    """
    return set(
        ConsumableIssue.objects
        .exclude(grn__purchase_order_item__isnull=True)
        .values_list("grn__purchase_order_item_id", flat=True)
        .distinct()
    )


class ProjectIntegrationListAPIView(APIView):
    """
    GET /erp/material/project-integration/?projectId=<id>

    Returns a flat list of (BOM × PO Item) rows for the given project.

    Rules:
      - BOM quantities are informational only. Fully-allocated BOMs
        still appear so the user can see them.
      - The only ceiling on the input is the PO item's remaining qty.
      - PO items issued to Consumable are completely excluded.
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        project_id = request.query_params.get("projectId")

        if not project_id:
            return Response(
                {"success": False, "message": "projectId is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # -------------------------------------------------------------
        # 1. BOM items for this project
        # -------------------------------------------------------------
        bom_items = (
            BOMItem.objects
            .select_related("drawing")
            .filter(drawing__project_id=project_id)
            .order_by("drawing_id", "id")
        )

        if not bom_items.exists():
            return Response(
                {"success": True, "data": []},
                status=status.HTTP_200_OK,
            )

        # -------------------------------------------------------------
        # 2. PO items — confirmed POs only, exclude consumable-issued
        # -------------------------------------------------------------
        blocked_po_item_ids = _get_issued_po_item_ids()

        po_items = list(
            PurchaseOrderItem.objects
            .select_related("purchase_order")
            .filter(purchase_order__status=PurchaseOrder.Status.CONFIRMED)
            .exclude(id__in=blocked_po_item_ids)
            .order_by("purchase_order__po_number", "id")
        )

        if not po_items:
            return Response(
                {"success": True, "data": []},
                status=status.HTTP_200_OK,
            )

        # -------------------------------------------------------------
        # 3. Already-integrated quantities (aggregated once)
        # -------------------------------------------------------------
        bom_integrated_map = {
            row["bom_item_id"]: row["total"]
            for row in (
                BOMPOIntegration.objects
                .filter(bom_item__in=bom_items)
                .values("bom_item_id")
                .annotate(total=Sum("quantity"))
            )
        }

        po_integrated_map = {
            row["purchase_order_item_id"]: row["total"]
            for row in (
                BOMPOIntegration.objects
                .filter(purchase_order_item__in=po_items)
                .values("purchase_order_item_id")
                .annotate(total=Sum("quantity"))
            )
        }

        # -------------------------------------------------------------
        # 4. Build the flat cross-product
        #
        # Rule: BOM remaining is informational. The input's ceiling
        # is PO remaining only.
        # -------------------------------------------------------------
        rows = []

        for bom in bom_items:
            bom_qty = bom.quantity or Decimal("0")
            bom_integrated = bom_integrated_map.get(bom.id, Decimal("0"))
            bom_remaining = bom_qty - bom_integrated

            # Normalise BOM description (JSON object) into a display label
            bom_description = bom.description or {}
            if isinstance(bom_description, str):
                bom_label = bom_description
            else:
                material_type = (
                    bom_description.get("materialType")
                    or bom_description.get("material_type")
                    or ""
                )
                dims = [
                    bom_description.get("thickness"),
                    bom_description.get("length"),
                    bom_description.get("width"),
                ]
                dims_str = " × ".join(
                    str(d) for d in dims if d not in (None, "")
                )
                bom_label = " ".join(
                    p for p in [material_type, dims_str] if p
                ) or "—"

            for po_item in po_items:
                po_qty = po_item.quantity or Decimal("0")
                po_integrated = po_integrated_map.get(
                    po_item.id, Decimal("0"),
                )
                po_remaining = po_qty - po_integrated

                # No PO left — nothing to integrate on this row
                if po_remaining <= 0:
                    continue

                # PO remaining is the only ceiling
                maximum = po_remaining

                rows.append({
                    "bomItemId": bom.id,
                    "bomItemNumber": bom.item_number or "",
                    "bomDescription": bom_label,
                    "bomUnit": bom.unit or "",
                    "bomQuantity": bom_qty,
                    "bomIntegrated": bom_integrated,
                    "bomRemaining": bom_remaining,

                    "drawingId": bom.drawing_id,
                    "drawingNumber": bom.drawing.dwg_number or "",

                    "poItemId": po_item.id,
                    "poNumber": po_item.po_number or "",
                    "poItemCode": po_item.item_code or "",
                    "poDescription": po_item.description or "",
                    "poUnit": po_item.unit or "",
                    "poQuantity": po_qty,
                    "poIntegrated": po_integrated,
                    "poRemaining": po_remaining,

                    "maximumIntegratable": maximum,
                })

        serializer = ProjectIntegrationRowSerializer(rows, many=True)

        return Response(
            {"success": True, "data": serializer.data},
            status=status.HTTP_200_OK,
        )


class ProjectIntegrationSaveAPIView(APIView):
    """
    POST /erp/material/project-integration/save/

    Body:
        {
          "projectId": 1,
          "rows": [
            {"bomItemId": 12, "poItemId": 42, "quantity": 5},
            ...
          ]
        }

    Rules:
      - Only PO-side validation applies (qty > 0 and qty <= PO remaining).
      - BOM quantity is not a constraint — a BOM can be over-allocated.
      - Consumable-issued PO items are rejected.
      - The whole request is atomic: any failing row aborts everything.
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request):
        serializer = ProjectIntegrationSaveSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": "Invalid payload.",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        project_id = serializer.validated_data["projectId"]
        rows = serializer.validated_data["rows"]

        # ---------------------------------------------------------
        # Resolve BOM items — must belong to this project
        # ---------------------------------------------------------
        bom_ids = {r["bomItemId"] for r in rows}
        po_ids = {r["poItemId"] for r in rows}

        bom_map = {
            b.id: b for b in BOMItem.objects.filter(
                id__in=bom_ids,
                drawing__project_id=project_id,
            )
        }

        if len(bom_map) != len(bom_ids):
            return Response(
                {
                    "success": False,
                    "message": (
                        "One or more BOM items do not belong to this "
                        "project or do not exist."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---------------------------------------------------------
        # Resolve PO items + reject consumable-issued ones
        # ---------------------------------------------------------
        blocked_po_item_ids = _get_issued_po_item_ids()

        po_map = {
            p.id: p for p in PurchaseOrderItem.objects.filter(
                id__in=po_ids,
            ).select_related("purchase_order")
        }

        if len(po_map) != len(po_ids):
            return Response(
                {
                    "success": False,
                    "message": "One or more PO items do not exist.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---------------------------------------------------------
        # Validate each row (PO-side only)
        # ---------------------------------------------------------
        errors = []
        prepared = []

        # Current integrated qty per PO item
        po_integrated_map = {
            row["purchase_order_item_id"]: row["total"]
            for row in (
                BOMPOIntegration.objects
                .filter(purchase_order_item_id__in=po_ids)
                .values("purchase_order_item_id")
                .annotate(total=Sum("quantity"))
            )
        }

        # Running total so two rows in the same request can't oversell
        # the same PO item.
        running_po = dict(po_integrated_map)

        for idx, row in enumerate(rows, start=1):
            bom = bom_map[row["bomItemId"]]
            po_item = po_map[row["poItemId"]]
            qty = row["quantity"]

            if po_item.id in blocked_po_item_ids:
                errors.append({
                    "row": idx,
                    "bomItemId": bom.id,
                    "poItemId": po_item.id,
                    "error": (
                        "This PO item has already been issued to "
                        "Consumable and cannot be integrated."
                    ),
                })
                continue

            po_remaining = (
                po_item.quantity - running_po.get(po_item.id, Decimal("0"))
            )

            if qty <= 0:
                errors.append({
                    "row": idx,
                    "error": "Quantity must be greater than 0.",
                })
                continue

            if qty > po_remaining:
                errors.append({
                    "row": idx,
                    "error": (
                        f"Quantity exceeds remaining PO quantity "
                        f"({po_remaining})."
                    ),
                })
                continue

            running_po[po_item.id] = (
                running_po.get(po_item.id, Decimal("0")) + qty
            )

            prepared.append({
                "bom_item": bom,
                "purchase_order_item": po_item,
                "quantity": qty,
            })

        if errors:
            transaction.set_rollback(True)
            return Response(
                {
                    "success": False,
                    "message": "One or more rows failed validation.",
                    "errors": errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---------------------------------------------------------
        # Create the integrations
        # ---------------------------------------------------------
        created = []
        for entry in prepared:
            integration = BOMPOIntegration.objects.create(
                bom_item=entry["bom_item"],
                purchase_order_item=entry["purchase_order_item"],
                quantity=entry["quantity"],
                is_dummy=(
                    entry["purchase_order_item"]
                    .purchase_order
                    .po_number
                    .upper()
                    .startswith("DUMMY")
                ),
            )
            created.append(integration.id)

        return Response(
            {
                "success": True,
                "message": f"Saved {len(created)} integration rows.",
                "integrationIds": created,
            },
            status=status.HTTP_201_CREATED,
        )
    


# =====================================================================
# PROJECT PO ITEMS + PROJECT INTEGRATION (no BOM required)
# =====================================================================
class ProjectPOItemListAPIView(APIView):
    """
    GET /erp/material/project-po-items/?projectId=<id>

    Returns:
      history   — integrations already saved for this project
      poItems   — real + dummy PO items with remaining quantity
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        project_id = request.query_params.get("projectId")

        if not project_id:
            return Response(
                {"success": False, "message": "projectId is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # -------- Blocked real PO items (issued to Consumable) --------
        blocked_ids = set(
            ConsumableIssue.objects
            .exclude(grn__purchase_order_item__isnull=True)
            .values_list("grn__purchase_order_item_id", flat=True)
            .distinct()
        )

        # -------- Real PO items --------
        real_items = list(
            PurchaseOrderItem.objects
            .select_related("purchase_order")
            .filter(purchase_order__status=PurchaseOrder.Status.CONFIRMED)
            .exclude(id__in=blocked_ids)
            .order_by("purchase_order__po_number", "id")
        )

        real_integrated_map = {
            row["purchase_order_item_id"]: row["total"]
            for row in (
                BOMPOIntegration.objects
                .filter(purchase_order_item__in=real_items)
                .values("purchase_order_item_id")
                .annotate(total=Sum("quantity"))
            )
        }

        # -------- Dummy PO items --------
        dummy_items = list(
            DummyPurchaseOrderItem.objects
            .select_related("dummy_po")
            .order_by("dummy_po__po_number", "id")
        )

        dummy_integrated_map = {
            row["dummy_purchase_order_item_id"]: row["total"]
            for row in (
                BOMPOIntegration.objects
                .filter(dummy_purchase_order_item__in=dummy_items)
                .values("dummy_purchase_order_item_id")
                .annotate(total=Sum("quantity"))
            )
        }

        # -------- Merge into one list --------
        po_items_out = []

        for pi in real_items:
            integrated = real_integrated_map.get(pi.id, Decimal("0"))
            remaining = (pi.quantity or Decimal("0")) - integrated
            if remaining <= 0:
                continue
            po_items_out.append({
                "poItemId": pi.id,
                "sourceType": "real",
                "poNumber": pi.po_number or "",
                "poItemCode": pi.item_code or "",
                "description": pi.description or "",
                "material": "",
                "length": "",
                "width": "",
                "thickness": "",
                "unit": pi.unit or "",
                "poQuantity": pi.quantity or Decimal("0"),
                "poIntegrated": integrated,
                "poRemaining": remaining,
                "isDummy": False,
            })

        for di in dummy_items:
            integrated = dummy_integrated_map.get(di.id, Decimal("0"))
            remaining = (di.quantity or Decimal("0")) - integrated
            if remaining <= 0:
                continue
            po_items_out.append({
                "poItemId": di.id,
                "sourceType": "dummy",
                "poNumber": di.dummy_po.po_number or "",
                "poItemCode": di.item_code or "",
                "description": di.description or "",
                "material": di.material or "",
                "length": di.length or "",
                "width": di.width or "",
                "thickness": di.thickness or "",
                "unit": di.unit or "",
                "poQuantity": di.quantity or Decimal("0"),
                "poIntegrated": integrated,
                "poRemaining": remaining,
                "isDummy": True,
            })

        # -------- History --------
        history_qs = (
            BOMPOIntegration.objects
            .filter(project_id=project_id)
            .select_related(
                "purchase_order_item",
                "dummy_purchase_order_item",
                "dummy_purchase_order_item__dummy_po",
            )
            .order_by("-created_at")
        )

        history_out = []
        for row in history_qs:
            if row.dummy_purchase_order_item_id:
                di = row.dummy_purchase_order_item
                history_out.append({
                    "id": row.id,
                    "quantity": row.quantity,
                    "isDummy": True,
                    "createdAt": row.created_at,
                    "poItemId": di.id,
                    "poNumber": di.dummy_po.po_number,
                    "poDescription": di.description,
                    "poUnit": di.unit,
                })
            elif row.purchase_order_item_id:
                pi = row.purchase_order_item
                history_out.append({
                    "id": row.id,
                    "quantity": row.quantity,
                    "isDummy": False,
                    "createdAt": row.created_at,
                    "poItemId": pi.id,
                    "poNumber": pi.po_number,
                    "poDescription": pi.description,
                    "poUnit": pi.unit,
                })

        return Response(
            {
                "success": True,
                "data": {
                    "history": history_out,
                    "poItems": po_items_out,
                },
            },
            status=status.HTTP_200_OK,
        )

class ProjectIntegrationCreateAPIView(APIView):
    """
    POST /erp/material/project-po-integration/create/

    Body:
        {
          "projectId": 1,
          "rows": [
            {"poItemId": 42, "sourceType": "real",  "quantity": 5},
            {"poItemId": 7,  "sourceType": "dummy", "quantity": 3},
            ...
          ]
        }
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request):
        project_id = request.data.get("projectId")
        rows = request.data.get("rows") or []

        if not project_id:
            return Response(
                {"success": False, "message": "projectId is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {"success": False, "message": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not rows:
            return Response(
                {"success": False, "message": "No rows provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- Fetch items up-front ---
        real_ids = {r["poItemId"] for r in rows if r.get("sourceType") == "real"}
        dummy_ids = {r["poItemId"] for r in rows if r.get("sourceType") == "dummy"}

        real_map = {
            p.id: p for p in (
                PurchaseOrderItem.objects
                .filter(id__in=real_ids)
                .select_related("purchase_order")
            )
        }
        dummy_map = {
            d.id: d for d in (
                DummyPurchaseOrderItem.objects
                .filter(id__in=dummy_ids)
                .select_related("dummy_po")
            )
        }

        # --- Current integrated totals ---
        real_integrated = {
            row["purchase_order_item_id"]: row["total"]
            for row in (
                BOMPOIntegration.objects
                .filter(purchase_order_item_id__in=real_ids)
                .values("purchase_order_item_id")
                .annotate(total=Sum("quantity"))
            )
        }
        dummy_integrated = {
            row["dummy_purchase_order_item_id"]: row["total"]
            for row in (
                BOMPOIntegration.objects
                .filter(dummy_purchase_order_item_id__in=dummy_ids)
                .values("dummy_purchase_order_item_id")
                .annotate(total=Sum("quantity"))
            )
        }

        errors = []
        prepared = []

        running_real = dict(real_integrated)
        running_dummy = dict(dummy_integrated)

        for idx, r in enumerate(rows, start=1):
            source = r.get("sourceType")
            po_item_id = r.get("poItemId")
            raw_qty = r.get("quantity")

            try:
                qty = Decimal(str(raw_qty))
            except (InvalidOperation, TypeError, ValueError):
                errors.append({"row": idx, "error": "Invalid quantity."})
                continue

            if qty <= 0:
                errors.append({
                    "row": idx,
                    "error": "Quantity must be greater than 0.",
                })
                continue

            if source == "real":
                po_item = real_map.get(po_item_id)
                if not po_item:
                    errors.append({"row": idx, "error": "PO item not found."})
                    continue

                po_remaining = (
                    (po_item.quantity or Decimal("0"))
                    - running_real.get(po_item.id, Decimal("0"))
                )
                if qty > po_remaining:
                    errors.append({
                        "row": idx,
                        "error": f"Quantity exceeds PO remaining ({po_remaining}).",
                    })
                    continue

                running_real[po_item.id] = (
                    running_real.get(po_item.id, Decimal("0")) + qty
                )
                prepared.append({
                    "purchase_order_item": po_item,
                    "dummy_purchase_order_item": None,
                    "quantity": qty,
                })

            elif source == "dummy":
                di = dummy_map.get(po_item_id)
                if not di:
                    errors.append({"row": idx, "error": "Dummy PO item not found."})
                    continue

                po_remaining = (
                    (di.quantity or Decimal("0"))
                    - running_dummy.get(di.id, Decimal("0"))
                )
                if qty > po_remaining:
                    errors.append({
                        "row": idx,
                        "error": f"Quantity exceeds dummy PO remaining ({po_remaining}).",
                    })
                    continue

                running_dummy[di.id] = (
                    running_dummy.get(di.id, Decimal("0")) + qty
                )
                prepared.append({
                    "purchase_order_item": None,
                    "dummy_purchase_order_item": di,
                    "quantity": qty,
                })

            else:
                errors.append({
                    "row": idx,
                    "error": f"Unknown sourceType: {source!r}.",
                })

        if errors:
            transaction.set_rollback(True)
            return Response(
                {
                    "success": False,
                    "message": "One or more rows failed validation.",
                    "errors": errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_ids = []
        for entry in prepared:
            intg = BOMPOIntegration.objects.create(
                project=project,
                bom_item=None,
                purchase_order_item=entry["purchase_order_item"],
                dummy_purchase_order_item=entry["dummy_purchase_order_item"],
                quantity=entry["quantity"],
                is_dummy=entry["dummy_purchase_order_item"] is not None,
            )
            created_ids.append(intg.id)

        return Response(
            {
                "success": True,
                "message": f"Saved {len(created_ids)} integrations.",
                "integrationIds": created_ids,
            },
            status=status.HTTP_201_CREATED,
        )


# =====================================================================
# MATERIAL GRN
# -----------------------------------------------------------------
# Receive material against real + dummy PO items.
#
#   GET    /erp/material/receive/list/           → receivable rows
#   POST   /erp/material/receive/                → record a GRN
#   GET    /erp/material/receive/history/        → list all GRNs
#   PATCH  /erp/material/receive/history/<id>/   → edit a GRN
#   DELETE /erp/material/receive/history/<id>/   → delete a GRN
#
# Row shape now includes:
#   - length, width, thickness   (from PO item)
#   - project                    (resolved via BOMPOIntegration)
#   - NO material, NO materialSpec
# =====================================================================

from django.db import transaction, IntegrityError

from .models import (
    MaterialGRN,
    MaterialGRNNumberSettings,
    DummyPurchaseOrderItem,
    BOMPOIntegration,
    Project,
)
from .serializers import MaterialGRNSerializer


# ---------------------------------------------------------------------
# GRN NUMBER GENERATOR — concurrency-safe, auto-seeds on first call
# ---------------------------------------------------------------------
def generate_material_grn_number():
    """
    Concurrency-safe GRN number generator.

    - Locks the settings row and increments the counter.
    - Auto-creates the row on first use → GRN-0001.
    - Must be called inside a transaction (select_for_update).
    """
    settings_obj = (
        MaterialGRNNumberSettings.objects
        .select_for_update()
        .filter(is_active=True)
        .first()
    )

    if settings_obj is None:
        try:
            settings_obj = MaterialGRNNumberSettings.objects.create(
                prefix="GRN",
                next_number=1,
                number_padding=4,
                is_active=True,
            )
        except IntegrityError:
            # Another request created it first — re-read with lock.
            settings_obj = (
                MaterialGRNNumberSettings.objects
                .select_for_update()
                .filter(is_active=True)
                .first()
            )

    number = (
        f"{settings_obj.prefix}"
        f"{settings_obj.next_number:0{settings_obj.number_padding}d}"
    )

    settings_obj.next_number += 1
    settings_obj.save(
        update_fields=["next_number", "updated_at"]
    )

    return number


# ---------------------------------------------------------------------
# SUPPLIER NAME RESOLVER
# ---------------------------------------------------------------------
def _material_grn_supplier(vendor):
    """
    PurchaseOrder.vendor is a JSONField, so it may hold a dict or
    a stringified dict. Return a readable supplier name.
    """
    if not vendor:
        return "—"

    if isinstance(vendor, dict):
        return vendor.get("companyName") or "—"

    text = str(vendor).strip()
    if text.startswith("{") and text.endswith("}"):
        try:
            import ast
            parsed = ast.literal_eval(text)
            if isinstance(parsed, dict):
                return parsed.get("companyName") or "—"
        except (ValueError, SyntaxError):
            pass

    return text or "—"


# ---------------------------------------------------------------------
# PROJECT RESOLVERS
# ---------------------------------------------------------------------
def _project_for_po_item(po_item_id):
    """
    Return the project name this real PO item is integrated into,
    or "—" if not integrated yet.

    Uses the most recent integration so the row reflects the latest
    project the user linked.
    """
    integration = (
        BOMPOIntegration.objects
        .filter(purchase_order_item_id=po_item_id)
        .select_related("project")
        .order_by("-created_at")
        .first()
    )
    if integration and integration.project:
        return integration.project.name
    return "—"


def _project_for_dummy_item(dummy_item_id):
    """Same idea, for dummy PO items."""
    integration = (
        BOMPOIntegration.objects
        .filter(dummy_purchase_order_item_id=dummy_item_id)
        .select_related("project")
        .order_by("-created_at")
        .first()
    )
    if integration and integration.project:
        return integration.project.name
    return "—"


# =====================================================================
# LIST — RECEIVABLE MATERIALS
# =====================================================================
class MaterialReceiveListAPIView(APIView):
    """
    GET /erp/material/receive/list/

    One row per receivable line, sourced from:
      - PurchaseOrderItem (confirmed POs, not consumable-issued)
      - DummyPurchaseOrderItem

    For every row:
        poQty    = item.quantity
        received = SUM(MaterialGRN.received_qty for that item)
        balance  = poQty - received

    Dimensions (length, width, thickness) come from the PO item.
    Project comes from BOMPOIntegration (first linked project).
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):

        # ---- Blocked real PO items (already issued to Consumable) ----
        blocked_ids = set(
            ConsumableIssue.objects
            .exclude(grn__purchase_order_item__isnull=True)
            .values_list("grn__purchase_order_item_id", flat=True)
            .distinct()
        )

        # ---- Real PO items ----
        real_items = list(
            PurchaseOrderItem.objects
            .select_related("purchase_order")
            .filter(
                purchase_order__status=PurchaseOrder.Status.CONFIRMED,
            )
            .exclude(id__in=blocked_ids)
            .order_by("purchase_order__po_number", "id")
        )

        real_received_map = {
            row["purchase_order_item_id"]: row["total"]
            for row in (
                MaterialGRN.objects
                .filter(purchase_order_item__in=real_items)
                .values("purchase_order_item_id")
                .annotate(total=Sum("received_qty"))
            )
        }

        real_integration_map = {
            row["purchase_order_item_id"]: row["total"]
            for row in (
                BOMPOIntegration.objects
                .filter(purchase_order_item__in=real_items)
                .values("purchase_order_item_id")
                .annotate(total=Sum("quantity"))
            )
        }

        # ---- Dummy PO items ----
        dummy_items = list(
            DummyPurchaseOrderItem.objects
            .select_related("dummy_po")
            .order_by("dummy_po__po_number", "id")
        )

        dummy_received_map = {
            row["dummy_purchase_order_item_id"]: row["total"]
            for row in (
                MaterialGRN.objects
                .filter(dummy_purchase_order_item__in=dummy_items)
                .values("dummy_purchase_order_item_id")
                .annotate(total=Sum("received_qty"))
            )
        }

        dummy_integration_map = {
            row["dummy_purchase_order_item_id"]: row["total"]
            for row in (
                BOMPOIntegration.objects
                .filter(dummy_purchase_order_item__in=dummy_items)
                .values("dummy_purchase_order_item_id")
                .annotate(total=Sum("quantity"))
            )
        }

        rows = []

        # =========================================================
        # REAL ROWS
        # =========================================================
        for pi in real_items:
            po_qty = pi.quantity or Decimal("0")
            received = real_received_map.get(pi.id, Decimal("0"))
            balance = po_qty - received

            integrated_qty = real_integration_map.get(pi.id, Decimal("0"))
            if integrated_qty <= 0:
                integration_status = "Not Integrated"
            elif integrated_qty >= po_qty:
                integration_status = "Integrated"
            else:
                integration_status = "Partially Integrated"

            rows.append({
                "id": f"real-{pi.id}",
                "poItemId": pi.id,
                "sourceType": "real",
                "poType": "Actual PO",
                "poNumber": pi.po_number or "",
                "supplier": _material_grn_supplier(
                    pi.purchase_order.vendor
                ),
                "description": pi.description or "",

                # ---- Dimensions from PurchaseOrderItem ----
                "length": pi.length or "",
                "width": pi.width or "",
                "thickness": pi.thickness or "",

                # ---- Project resolved via integration ----
                "project": _project_for_po_item(pi.id),

                "unit": pi.unit or "",
                "poQty": float(po_qty),
                "received": float(received),
                "balance": float(balance),
                "integrationStatus": integration_status,
                "deliveryDate": (
                    pi.created_at.date().isoformat()
                    if pi.created_at else ""
                ),
                "receivingUnit": None,
            })

        # =========================================================
        # DUMMY ROWS
        # =========================================================
        for di in dummy_items:
            po_qty = di.quantity or Decimal("0")
            received = dummy_received_map.get(di.id, Decimal("0"))
            balance = po_qty - received

            integrated_qty = dummy_integration_map.get(di.id, Decimal("0"))
            if integrated_qty <= 0:
                integration_status = "Not Integrated"
            elif integrated_qty >= po_qty:
                integration_status = "Integrated"
            else:
                integration_status = "Partially Integrated"

            rows.append({
                "id": f"dummy-{di.id}",
                "poItemId": di.id,
                "sourceType": "dummy",
                "poType": "Dummy PO",
                "poNumber": di.dummy_po.po_number or "",
                "supplier": "Dummy / Internal",
                "description": di.description or "",

                # ---- Dimensions (dummy already has them) ----
                "length": di.length or "",
                "width": di.width or "",
                "thickness": di.thickness or "",

                # ---- Project ----
                "project": _project_for_dummy_item(di.id),

                "unit": di.unit or "",
                "poQty": float(po_qty),
                "received": float(received),
                "balance": float(balance),
                "integrationStatus": integration_status,
                "deliveryDate": (
                    di.created_at.date().isoformat()
                    if di.created_at else ""
                ),
                "receivingUnit": None,
            })

        return Response(rows, status=status.HTTP_200_OK)

from django.db import transaction
from django.db.models import Sum
from decimal import Decimal, InvalidOperation

from .models import (
    MaterialGRN,
    MaterialGRNNumberSettings,
    MaterialStock,
    MaterialStockMovement,
    DummyPurchaseOrderItem,
    BOMPOIntegration,
    Project,
)
# =====================================================================
# CREATE — RECORD ONE GRN
# =====================================================================
class MaterialGRNCreateAPIView(APIView):
    """
    POST /erp/material/receive/

    Body:
        {
          "sourceType": "real" | "dummy",
          "poItemId": 42,
          "receivingUnit": "Unit 1",
          "receivedQty": 2,
          "receivedBy": "Kumar",
          "remarks": ""
        }

    Creates:
      1. MaterialGRN          (the receipt)
      2. MaterialStock        (the physical lot)
      3. MaterialStockMovement (the IN event that grows available_qty)

    All inside one transaction — either everything commits or nothing does.
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request):

        source_type = request.data.get("sourceType")
        po_item_id = request.data.get("poItemId")
        receiving_unit = str(
            request.data.get("receivingUnit", "")
        ).strip()
        received_by = str(
            request.data.get("receivedBy", "")
        ).strip()
        remarks = str(
            request.data.get("remarks", "")
        ).strip()

        # ---------------- VALIDATION ----------------
        if source_type not in ("real", "dummy"):
            return Response(
                {"success": False, "message": "Invalid sourceType."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not po_item_id:
            return Response(
                {"success": False, "message": "poItemId is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            received_qty = Decimal(
                str(request.data.get("receivedQty", "0"))
            )
        except (InvalidOperation, TypeError, ValueError):
            return Response(
                {"success": False, "message": "Invalid quantity."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if received_qty <= 0:
            return Response(
                {
                    "success": False,
                    "message": "Quantity must be greater than 0.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if receiving_unit not in ("Unit 1", "Unit 2"):
            return Response(
                {
                    "success": False,
                    "message": "Receiving Unit must be Unit 1 or Unit 2.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not received_by:
            return Response(
                {"success": False, "message": "Received By is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---------------- RESOLVE PO ITEM ----------------
        po_item = None
        dummy_item = None
        po_qty = Decimal("0")
        prev_received = Decimal("0")

        if source_type == "real":
            try:
                po_item = (
                    PurchaseOrderItem.objects
                    .select_for_update()
                    .select_related("purchase_order")
                    .get(id=po_item_id)
                )
            except PurchaseOrderItem.DoesNotExist:
                return Response(
                    {"success": False, "message": "PO item not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if (
                po_item.purchase_order.status
                != PurchaseOrder.Status.CONFIRMED
            ):
                return Response(
                    {
                        "success": False,
                        "message": "PO is not confirmed.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            po_qty = po_item.quantity or Decimal("0")
            prev_received = (
                MaterialGRN.objects
                .filter(purchase_order_item=po_item)
                .aggregate(total=Sum("received_qty"))["total"]
                or Decimal("0")
            )

        else:
            try:
                dummy_item = (
                    DummyPurchaseOrderItem.objects
                    .select_for_update()
                    .select_related("dummy_po")
                    .get(id=po_item_id)
                )
            except DummyPurchaseOrderItem.DoesNotExist:
                return Response(
                    {
                        "success": False,
                        "message": "Dummy PO item not found.",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            po_qty = dummy_item.quantity or Decimal("0")
            prev_received = (
                MaterialGRN.objects
                .filter(dummy_purchase_order_item=dummy_item)
                .aggregate(total=Sum("received_qty"))["total"]
                or Decimal("0")
            )

        # ---------------- BALANCE CHECK ----------------
        balance = po_qty - prev_received

        if balance <= 0:
            return Response(
                {
                    "success": False,
                    "message": "This PO item is already fully received.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if received_qty > balance:
            unit = po_item.unit if po_item else dummy_item.unit
            return Response(
                {
                    "success": False,
                    "message": (
                        f"Only {balance} {unit} can be received."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---------------- GENERATE GRN NUMBER ----------------
        grn_number = generate_material_grn_number()

        # ---------------- CREATE GRN ----------------
        grn = MaterialGRN.objects.create(
            grn_number=grn_number,
            purchase_order_item=po_item,
            dummy_purchase_order_item=dummy_item,
            po_number=(
                po_item.po_number
                if po_item
                else dummy_item.dummy_po.po_number
            ),
            description=(
                po_item.description
                if po_item
                else dummy_item.description
            ),
            material=(dummy_item.material if dummy_item else ""),
            receiving_unit=receiving_unit,
            received_qty=received_qty,
            received_by=received_by,
            remarks=remarks,
            created_by=request.user,
        )

        # ============================================================
        # AUTO-CREATE MATERIAL STOCK LOT + IN MOVEMENT
        # ------------------------------------------------------------
        # Every GRN receipt lands in the warehouse as a physical lot.
        # The lot is created with original_qty = 0, and an IN
        # movement carries the received quantity. This keeps
        # available_qty = SUM(IN) − SUM(OUT), computed live.
        # ============================================================

        # Resolve the project via integration (if any)
        resolved_project = None

        if po_item:
            integration = (
                BOMPOIntegration.objects
                .filter(purchase_order_item_id=po_item.id)
                .select_related("project")
                .order_by("-created_at")
                .first()
            )
            if integration:
                resolved_project = integration.project

        elif dummy_item:
            integration = (
                BOMPOIntegration.objects
                .filter(dummy_purchase_order_item_id=dummy_item.id)
                .select_related("project")
                .order_by("-created_at")
                .first()
            )
            if integration:
                resolved_project = integration.project

        # Snapshot the dimensions from the source PO item
        thickness = ""
        length = ""
        width = ""
        uom = "Nos"

        if po_item:
            thickness = po_item.thickness or ""
            length = po_item.length or ""
            width = po_item.width or ""
            uom = po_item.unit or "Nos"
        elif dummy_item:
            thickness = dummy_item.thickness or ""
            length = dummy_item.length or ""
            width = dummy_item.width or ""
            uom = dummy_item.unit or "Nos"

        stock = MaterialStock.objects.create(
            stock_id=generate_stock_id(),
            unit=receiving_unit,
            source_type=(
                MaterialStock.SourceType.PO
                if po_item
                else MaterialStock.SourceType.DUMMY_PO
            ),
            material_grn=grn,
            purchase_order_item=po_item,
            dummy_purchase_order_item=dummy_item,
            po_number=grn.po_number,
            description=grn.description,
            material=grn.material or "",
            material_code="",
            material_spec="",
            thickness=thickness,
            length=length,
            width=width,
            heat_number="",
            plate_number="",
            original_qty=Decimal("0"),
            uom=uom,
            project=resolved_project,
            dwg_description="",
            revision="",
            stock_status=MaterialStock.StockStatus.AVAILABLE,
            rework_required=False,
            remarks="",
            created_by=request.user,
        )

        MaterialStockMovement.objects.create(
            stock=stock,
            direction=MaterialStockMovement.Direction.IN,
            movement_type=MaterialStockMovement.MovementType.GRN,
            quantity=received_qty,
            reference_type="MaterialGRN",
            reference_id=grn.id,
            remarks="",
            created_by=request.user,
        )

        # ---------------- RESPONSE ----------------
        return Response(
            {
                "success": True,
                "message": f"{grn.grn_number} recorded.",
                "data": {
                    **MaterialGRNSerializer(grn).data,
                    "stockId": stock.stock_id,
                    "availableQty": float(stock.available_qty),
                },
            },
            status=status.HTTP_201_CREATED,
        )
# =====================================================================
# HISTORY — LIST / EDIT / DELETE
# =====================================================================
class MaterialGRNDetailAPIView(APIView):
    """
    GET    /erp/material/receive/history/
    PATCH  /erp/material/receive/history/<id>/
    DELETE /erp/material/receive/history/<id>/
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    # ---------------- GET ----------------
    def get(self, request):
        grns = (
            MaterialGRN.objects
            .all()
            .order_by("-created_at")
        )
        return Response(
            MaterialGRNSerializer(grns, many=True).data,
            status=status.HTTP_200_OK,
        )

    # ---------------- PATCH ----------------
    @transaction.atomic
    def patch(self, request, pk):
        try:
            grn = (
                MaterialGRN.objects
                .select_for_update()
                .select_related(
                    "purchase_order_item",
                    "dummy_purchase_order_item",
                )
                .get(id=pk)
            )
        except MaterialGRN.DoesNotExist:
            return Response(
                {"success": False, "message": "GRN not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ---- Simple string fields ----
        if "unit" in request.data:
            value = str(request.data["unit"]).strip()
            if value not in ("Unit 1", "Unit 2"):
                return Response(
                    {
                        "success": False,
                        "message": "Unit must be Unit 1 or Unit 2.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            grn.receiving_unit = value

        if "receivedBy" in request.data:
            grn.received_by = str(
                request.data["receivedBy"]
            ).strip()

        if "remarks" in request.data:
            grn.remarks = str(
                request.data["remarks"]
            ).strip()

        # ---- Quantity (with re-validation) ----
        if "receivedQty" in request.data:
            try:
                new_qty = Decimal(
                    str(request.data["receivedQty"])
                )
            except (InvalidOperation, TypeError, ValueError):
                return Response(
                    {"success": False, "message": "Invalid quantity."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if new_qty <= 0:
                return Response(
                    {
                        "success": False,
                        "message": "Quantity must be greater than 0.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            po_qty = Decimal("0")
            prev_other = Decimal("0")

            if grn.purchase_order_item:
                po_qty = (
                    grn.purchase_order_item.quantity
                    or Decimal("0")
                )
                prev_other = (
                    MaterialGRN.objects
                    .filter(
                        purchase_order_item=grn.purchase_order_item
                    )
                    .exclude(pk=grn.pk)
                    .aggregate(total=Sum("received_qty"))["total"]
                    or Decimal("0")
                )
            elif grn.dummy_purchase_order_item:
                po_qty = (
                    grn.dummy_purchase_order_item.quantity
                    or Decimal("0")
                )
                prev_other = (
                    MaterialGRN.objects
                    .filter(
                        dummy_purchase_order_item=grn.dummy_purchase_order_item
                    )
                    .exclude(pk=grn.pk)
                    .aggregate(total=Sum("received_qty"))["total"]
                    or Decimal("0")
                )

            available = po_qty - prev_other

            if new_qty > available:
                return Response(
                    {
                        "success": False,
                        "message": (
                            f"Quantity exceeds PO balance ({available})."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            grn.received_qty = new_qty

        grn.save()

        return Response(
            {
                "success": True,
                "message": "GRN updated.",
                "data": MaterialGRNSerializer(grn).data,
            },
            status=status.HTTP_200_OK,
        )

    # ---------------- DELETE ----------------
    @transaction.atomic
    def delete(self, request, pk):
        try:
            grn = (
                MaterialGRN.objects
                .select_for_update()
                .get(id=pk)
            )
        except MaterialGRN.DoesNotExist:
            return Response(
                {"success": False, "message": "GRN not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        grn.delete()

        return Response(
            {"success": True, "message": "GRN deleted."},
            status=status.HTTP_200_OK,
        )



#FOR ALL PAGES FLITER
# =====================================================================
# GENERIC FILTER OPTIONS
# -----------------------------------------------------------------
# Every page that shows filter dropdowns can hit one endpoint:
#
#     GET /erp/filter-options/?source=<key>
#
# The view dispatches to a per-source resolver that returns
# { "field": [distinct values...] }.
#
# Empty keys are omitted from the response — so a dropdown with
# no data falls back to just "All" on the frontend.
# =====================================================================

from django.db import models as django_models


def _sort_numeric(values):
    """
    Sort "6", "8", "10", "12" numerically.
    Non-numeric values fall back to alphabetical.
    """
    def key(v):
        try:
            return (0, float(v))
        except (TypeError, ValueError):
            return (1, str(v).lower())
    return sorted(values, key=key)


def _non_empty(values):
    """Trim, drop empty, de-dupe."""
    return {
        str(v).strip()
        for v in values
        if v is not None and str(v).strip() != ""
    }

# ---------------------------------------------------------------------
# SOURCE RESOLVER — MATERIAL STOCK
# ---------------------------------------------------------------------
def _resolve_filter_options__material_stock(request):
    """
    Dropdown values for the Material Stock page.

    Sources:
      - MaterialStock (only lots with available_qty > 0)
      - Project (via MaterialStock.project FK)
    """
    qs = MaterialStock.objects.all()

    # Only non-depleted lots contribute to the dropdown
    live_rows = [
        s for s in qs
        if s.available_qty > Decimal("0")
    ]

    thickness_set = _non_empty(
        s.thickness for s in live_rows
    )
    length_set = _non_empty(
        s.length for s in live_rows
    )
    width_set = _non_empty(
        s.width for s in live_rows
    )
    material_set = _non_empty(
        s.material for s in live_rows
    )
    po_number_set = _non_empty(
        s.po_number for s in live_rows
    )
    project_set = _non_empty(
        s.project.name for s in live_rows if s.project
    )

    payload = {}

    if thickness_set:
        payload["thickness"] = _sort_numeric(thickness_set)

    if length_set:
        payload["length"] = _sort_numeric(length_set)

    if width_set:
        payload["width"] = _sort_numeric(width_set)

    if material_set:
        payload["material"] = sorted(material_set)

    if po_number_set:
        payload["poNumber"] = sorted(po_number_set)

    if project_set:
        payload["project"] = sorted(project_set)

    return payload
# ---------------------------------------------------------------------
# SOURCE RESOLVER — MATERIAL RECEIVE
# ---------------------------------------------------------------------
def _resolve_filter_options__material_receive(request):
    """
    Thickness, Length, Width, Project, Supplier for the Receive GRN page.

    Sources:
      - PurchaseOrderItem (confirmed POs, excluding Consumable-issued)
      - DummyPurchaseOrderItem
      - Project (via BOMPOIntegration)
      - PurchaseOrder.vendor.companyName
    """
    blocked_ids = set(
        ConsumableIssue.objects
        .exclude(grn__purchase_order_item__isnull=True)
        .values_list("grn__purchase_order_item_id", flat=True)
        .distinct()
    )

    real_items = (
        PurchaseOrderItem.objects
        .select_related("purchase_order")
        .filter(
            purchase_order__status=PurchaseOrder.Status.CONFIRMED,
        )
        .exclude(id__in=blocked_ids)
        .values(
            "thickness",
            "length",
            "width",
            "purchase_order__vendor",
        )
    )

    dummy_items = (
        DummyPurchaseOrderItem.objects
        .values("thickness", "length", "width")
    )

    thickness_set = set()
    length_set = set()
    width_set = set()
    supplier_set = set()

    for row in real_items:
        thickness_set |= _non_empty([row.get("thickness")])
        length_set |= _non_empty([row.get("length")])
        width_set |= _non_empty([row.get("width")])

        supplier = _material_grn_supplier(
            row.get("purchase_order__vendor")
        )
        if supplier and supplier != "—":
            supplier_set.add(supplier)

    for row in dummy_items:
        thickness_set |= _non_empty([row.get("thickness")])
        length_set |= _non_empty([row.get("length")])
        width_set |= _non_empty([row.get("width")])

        supplier_set.add("Dummy / Internal")

    project_set = _non_empty(
        Project.objects
        .filter(
            django_models.Q(
                po_integrations__purchase_order_item__isnull=False
            )
            | django_models.Q(
                po_integrations__dummy_purchase_order_item__isnull=False
            )
        )
        .values_list("name", flat=True)
        .distinct()
    )

    payload = {}

    if thickness_set:
        payload["thickness"] = _sort_numeric(thickness_set)

    if length_set:
        payload["length"] = _sort_numeric(length_set)

    if width_set:
        payload["width"] = _sort_numeric(width_set)

    if project_set:
        payload["project"] = sorted(project_set)

    if supplier_set:
        payload["supplier"] = sorted(supplier_set)

    return payload
def _resolve_filter_options__material_job_work(request):
    """
    Dropdown values for the Issue to Job Work page.
    Only lots with available_qty > 0 contribute.
    """
    qs = MaterialStock.objects.select_related("project").all()

    live_rows = [
        s for s in qs
        if s.available_qty > Decimal("0")
    ]

    payload = {}

    thickness_set = _non_empty(s.thickness for s in live_rows)
    if thickness_set:
        payload["thickness"] = _sort_numeric(thickness_set)

    length_set = _non_empty(s.length for s in live_rows)
    if length_set:
        payload["length"] = _sort_numeric(length_set)

    width_set = _non_empty(s.width for s in live_rows)
    if width_set:
        payload["width"] = _sort_numeric(width_set)

    material_set = _non_empty(s.material for s in live_rows)
    if material_set:
        payload["material"] = sorted(material_set)

    po_number_set = _non_empty(s.po_number for s in live_rows)
    if po_number_set:
        payload["poNumber"] = sorted(po_number_set)

    project_set = _non_empty(
        s.project.name for s in live_rows if s.project
    )
    if project_set:
        payload["project"] = sorted(project_set)

    return payload


def _resolve_filter_options__job_work_receive(request):
    """
    Dropdown values for the Receive From Job Work page.

    Only issues with balance_to_receive > 0 contribute.
    """
    issues = (
        JobWorkIssue.objects
        .select_related("stock", "project")
        .exclude(status=JobWorkIssue.Status.FULLY_RETURNED)
        .all()
    )

    thickness_set = set()
    material_set = set()
    size_set = set()
    po_number_set = set()
    project_set = set()
    dwg_set = set()
    unit_set = set()
    job_work_type_set = set()
    process_set = set()

    for issue in issues:
        issued = issue.quantity_issued or Decimal("0")
        returned = issue.quantity_returned or Decimal("0")

        if issued - returned <= 0:
            continue

        thickness_set |= _non_empty([issue.thickness])
        material_set |= _non_empty([issue.material])

        if issue.length and issue.width:
            size_set.add(f"{issue.length} x {issue.width}")

        po_number_set |= _non_empty([issue.po_number])

        if issue.project:
            project_set.add(issue.project.name)

        dwg_set |= _non_empty([issue.dwg_description])

        unit_set |= _non_empty([issue.job_work_unit])

        job_work_type_set |= _non_empty([issue.job_work_type])

        process_set |= _non_empty([issue.process_name])

    payload = {}

    if thickness_set:
        payload["thickness"] = _sort_numeric(thickness_set)

    if material_set:
        payload["material"] = sorted(material_set)

    if size_set:
        payload["size"] = sorted(size_set)

    if po_number_set:
        payload["poNumber"] = sorted(po_number_set)

    if project_set:
        payload["project"] = sorted(project_set)

    if dwg_set:
        payload["dwg"] = sorted(dwg_set)

    if unit_set:
        payload["unit"] = sorted(unit_set)

    if job_work_type_set:
        payload["jobWorkType"] = sorted(job_work_type_set)

    if process_set:
        payload["process"] = sorted(process_set)

    return payload

def _resolve_filter_options__production_issue(request):
    """
    Dropdown values for the Issue to Production page.
    Only pieces with available_qty > 0 contribute.
    """
    issued_map = {
        row["job_work_piece_id"]: row["total"]
        for row in (
            ProductionIssue.objects
            .exclude(job_work_piece__isnull=True)
            .values("job_work_piece_id")
            .annotate(total=Sum("issued_qty"))
        )
    }

    pieces = (
        JobWorkReceivePiece.objects
        .select_related("receive", "receive__project", "receive__issue")
        .all()
    )

    thickness_set = set()
    material_set = set()
    size_set = set()
    po_number_set = set()
    project_set = set()
    dwg_set = set()
    unit_set = set()
    job_work_type_set = set()
    process_set = set()
    status_set = set()

    for piece in pieces:
        receive = piece.receive
        issue = receive.issue

        received = piece.qty or Decimal("0")
        previously = issued_map.get(piece.id, Decimal("0"))
        available = received - previously

        if available <= 0:
            continue

        thickness_set |= _non_empty(
            [piece.thickness or receive.thickness]
        )
        material_set |= _non_empty([receive.material])

        if piece.length and piece.width:
            size_set.add(f"{piece.length} × {piece.width}")

        po_number_set |= _non_empty([receive.po_number])

        if receive.project:
            project_set.add(receive.project.name)

        dwg_set |= _non_empty([receive.dwg_description])
        unit_set |= _non_empty(
            [issue.job_work_unit if issue else ""]
        )
        job_work_type_set |= _non_empty(
            [issue.job_work_type if issue else ""]
        )
        process_set |= _non_empty([receive.process_name])

        if previously <= 0:
            status_set.add("Available")
        elif previously >= received:
            status_set.add("Fully Issued")
        else:
            status_set.add("Partially Issued")

    payload = {}

    if thickness_set:
        payload["thickness"] = _sort_numeric(thickness_set)
    if material_set:
        payload["material"] = sorted(material_set)
    if size_set:
        payload["size"] = sorted(size_set)
    if po_number_set:
        payload["poNumber"] = sorted(po_number_set)
    if project_set:
        payload["project"] = sorted(project_set)
    if dwg_set:
        payload["dwg"] = sorted(dwg_set)
    if unit_set:
        payload["unit"] = sorted(unit_set)
    if job_work_type_set:
        payload["jobWorkType"] = sorted(job_work_type_set)
    if process_set:
        payload["process"] = sorted(process_set)
    if status_set:
        payload["status"] = sorted(status_set)

    return payload


# ---------------------------------------------------------------------
# SOURCE REGISTRY — add new pages here
# ---------------------------------------------------------------------
FILTER_OPTION_SOURCES = {
    "material-receive": _resolve_filter_options__material_receive,
     "material-stock":    _resolve_filter_options__material_stock,
      "material-job-work": _resolve_filter_options__material_job_work,
       "job-work-receive": _resolve_filter_options__job_work_receive,
       "production-issue": _resolve_filter_options__production_issue,
    # "material-issue":    _resolve_filter_options__material_issue,
    # "consumable-stock":  _resolve_filter_options__consumable_stock,
    # ...
}


# ---------------------------------------------------------------------
# THE VIEW
# ---------------------------------------------------------------------
class FilterOptionsAPIView(APIView):
    

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        source = (request.query_params.get("source") or "").strip()

        if not source:
            return Response(
                {
                    "success": False,
                    "message": "Query parameter 'source' is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        resolver = FILTER_OPTION_SOURCES.get(source)

        if resolver is None:
            return Response(
                {
                    "success": False,
                    "message": f"Unknown filter-options source: '{source}'.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            payload = resolver(request)
        except Exception as exc:
            return Response(
                {
                    "success": False,
                    "message": f"Failed to build filter options: {exc}",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "success": True,
                "source": source,
                "data": payload,
            },
            status=status.HTTP_200_OK,
        )


# =====================================================================
# MATERIAL STOCK
# -----------------------------------------------------------------
#   GET    /erp/material/stock/              → list all lots
#   GET    /erp/material/stock/<id>/         → one lot
#   GET    /erp/material/stock/<id>/movements/ → movement history
#   POST   /erp/material/stock/from-grn/     → create lot from GRN
# =====================================================================

from .models import MaterialStock, MaterialStockMovement
from .serializers import (
    MaterialStockSerializer,
    MaterialStockMovementSerializer,
)


def generate_stock_id():
    last = (
        MaterialStock.objects
        .order_by("-id")
        .values_list("stock_id", flat=True)
        .first()
    )
    if not last:
        n = 1
    else:
        try:
            n = int(last.replace("STK-", "")) + 1
        except (ValueError, TypeError):
            n = MaterialStock.objects.count() + 1
    return f"STK-{n:04d}"


class MaterialStockListAPIView(APIView):
    """
    GET /erp/material/stock/

    Returns every lot whose available_qty > 0.
    Optional query params:
      unit, sourceType, poNumber, projectId, stockStatus,
      material, thickness, length, width, search
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):

        qs = (
            MaterialStock.objects
            .select_related("project")
            .all()
            .order_by("-created_at")
        )

        params = request.query_params

        if params.get("unit"):
            qs = qs.filter(unit=params["unit"])

        if params.get("sourceType"):
            qs = qs.filter(source_type=params["sourceType"])

        if params.get("poNumber"):
            qs = qs.filter(po_number__icontains=params["poNumber"])

        if params.get("projectId"):
            qs = qs.filter(project_id=params["projectId"])

        if params.get("stockStatus"):
            qs = qs.filter(stock_status=params["stockStatus"])

        if params.get("material"):
            qs = qs.filter(material=params["material"])

        if params.get("thickness"):
            qs = qs.filter(thickness=params["thickness"])

        if params.get("length"):
            qs = qs.filter(length=params["length"])

        if params.get("width"):
            qs = qs.filter(width=params["width"])

        search = (params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                models.Q(po_number__icontains=search)
                | models.Q(description__icontains=search)
                | models.Q(material__icontains=search)
                | models.Q(material_code__icontains=search)
                | models.Q(material_spec__icontains=search)
                | models.Q(heat_number__icontains=search)
                | models.Q(plate_number__icontains=search)
                | models.Q(dwg_description__icontains=search)
            )

        # Hide depleted lots
        rows = [
            s for s in qs
            if s.available_qty > Decimal("0")
        ]

        serializer = MaterialStockSerializer(rows, many=True)

        return Response(
            {"success": True, "data": serializer.data},
            status=status.HTTP_200_OK,
        )


class MaterialStockDetailAPIView(APIView):

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request, pk):
        try:
            stock = MaterialStock.objects.get(id=pk)
        except MaterialStock.DoesNotExist:
            return Response(
                {"success": False, "message": "Stock lot not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {"success": True, "data": MaterialStockSerializer(stock).data},
            status=status.HTTP_200_OK,
        )


class MaterialStockMovementListAPIView(APIView):

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request, pk):
        try:
            stock = MaterialStock.objects.get(id=pk)
        except MaterialStock.DoesNotExist:
            return Response(
                {"success": False, "message": "Stock lot not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        movements = (
            stock.movements
            .select_related("created_by")
            .order_by("-created_at")
        )

        return Response(
            {
                "success": True,
                "data": MaterialStockMovementSerializer(
                    movements, many=True
                ).data,
            },
            status=status.HTTP_200_OK,
        )


class MaterialStockFromGRNAPIView(APIView):
    

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request):

        grn_id = request.data.get("materialGrnId")
        unit = str(request.data.get("unit", "")).strip()

        if not grn_id:
            return Response(
                {"success": False, "message": "materialGrnId is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if unit not in ("Unit 1", "Unit 2"):
            return Response(
                {"success": False, "message": "Invalid unit."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            grn = MaterialGRN.objects.get(id=grn_id)
        except MaterialGRN.DoesNotExist:
            return Response(
                {"success": False, "message": "Material GRN not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ---------------------------------------------------------
        # Resolve project from BOMPOIntegration (if any)
        # ---------------------------------------------------------
        project = None
        if grn.purchase_order_item_id:
            integration = (
                BOMPOIntegration.objects
                .filter(purchase_order_item_id=grn.purchase_order_item_id)
                .select_related("project")
                .first()
            )
            if integration:
                project = integration.project

        stock = MaterialStock.objects.create(
            stock_id=generate_stock_id(),
            unit=unit,
            source_type=MaterialStock.SourceType.PO,
            material_grn=grn,
            purchase_order_item=grn.purchase_order_item,
            dummy_purchase_order_item=grn.dummy_purchase_order_item,
            po_number=grn.po_number,
            description=grn.description,
            material=grn.material or "",
            material_code=str(request.data.get("materialCode", "")).strip(),
            material_spec=str(request.data.get("materialSpec", "")).strip(),
            thickness=str(request.data.get("thickness", "")).strip(),
            length=str(request.data.get("length", "")).strip(),
            width=str(request.data.get("width", "")).strip(),
            heat_number=str(request.data.get("heatNumber", "")).strip(),
            plate_number=str(request.data.get("plateNumber", "")).strip(),
            original_qty=Decimal("0"),   # grows via movements
            uom=str(request.data.get("uom", "Nos")).strip() or "Nos",
            project=project,
            remarks=str(request.data.get("remarks", "")).strip(),
            created_by=request.user,
        )

        MaterialStockMovement.objects.create(
            stock=stock,
            direction=MaterialStockMovement.Direction.IN,
            movement_type=MaterialStockMovement.MovementType.GRN,
            quantity=grn.received_qty,
            reference_type="MaterialGRN",
            reference_id=grn.id,
            created_by=request.user,
        )

        return Response(
            {
                "success": True,
                "message": f"{stock.stock_id} created.",
                "data": MaterialStockSerializer(stock).data,
            },
            status=status.HTTP_201_CREATED,
        )



# =====================================================================
# ISSUE TO JOB WORK
# -----------------------------------------------------------------
#   GET    /erp/material/job-work/stock/        → available stock lots
#   GET    /erp/material/job-work/processes/    → process master list
#   POST   /erp/material/job-work/processes/    → create a process
#   GET    /erp/material/job-work/issues/       → issue history
#   POST   /erp/material/job-work/issue/        → issue material
#   POST   /erp/material/job-work/receive/      → return from job work
#   GET    /erp/material/job-work/filter-options/ → dropdown values
# =====================================================================

from django.db import transaction, IntegrityError
from .models import (
    MaterialStock,
    MaterialStockMovement,
    JobWorkIssue,
    JobWorkProcess,
    JobWorkIssueNumberSettings,
    BOMPOIntegration,
)
from .serializers import (
    MaterialStockSerializer,
    JobWorkIssueSerializer,
    JobWorkProcessSerializer,
)


# ---------------------------------------------------------------------
# ISSUE NUMBER GENERATOR
# ---------------------------------------------------------------------
def generate_job_work_issue_number():
    settings_obj = (
        JobWorkIssueNumberSettings.objects
        .select_for_update()
        .filter(is_active=True)
        .first()
    )

    if settings_obj is None:
        try:
            settings_obj = JobWorkIssueNumberSettings.objects.create(
                prefix="ISS",
                next_number=1,
                number_padding=3,
                is_active=True,
            )
        except IntegrityError:
            settings_obj = (
                JobWorkIssueNumberSettings.objects
                .select_for_update()
                .filter(is_active=True)
                .first()
            )

    number = (
        f"{settings_obj.prefix}"
        f"{settings_obj.next_number:0{settings_obj.number_padding}d}"
    )

    settings_obj.next_number += 1
    settings_obj.save(
        update_fields=["next_number", "updated_at"]
    )

    return number


# ---------------------------------------------------------------------
# LIST AVAILABLE STOCK FOR JOB WORK
# ---------------------------------------------------------------------
class JobWorkStockListAPIView(APIView):
    """
    GET /erp/material/job-work/stock/

    Returns every MaterialStock lot with available_qty > 0.
    Same shape as MaterialStockListAPIView so the frontend can
    reuse the same rendering logic.
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        qs = (
            MaterialStock.objects
            .select_related("project")
            .all()
            .order_by("-created_at")
        )

        rows = [
            s for s in qs
            if s.available_qty > Decimal("0")
        ]

        serializer = MaterialStockSerializer(rows, many=True)

        return Response(
            {"success": True, "data": serializer.data},
            status=status.HTTP_200_OK,
        )

DEFAULT_JOB_WORK_PROCESSES = [
    ("Cutting",     "CUT01"),
    ("Rolling",     "ROLL01"),
    ("Bending",     "BEND01"),
    ("Drilling",    "DRL01"),
    ("Machining",   "MACH01"),
    ("Welding",     "WELD01"),
    ("Fabrication", "FAB01"),
]


def ensure_default_job_work_processes():
    """
    Idempotent. Fires on every visit to the process endpoint.
    Seeds the 7 defaults only if the master is empty.
    """
    if JobWorkProcess.objects.exists():
        return

    for name, pid in DEFAULT_JOB_WORK_PROCESSES:
        try:
            JobWorkProcess.objects.create(
                name=name,
                process_id=pid,
                is_active=True,
            )
        except IntegrityError:
            pass
# ---------------------------------------------------------------------
# PROCESS MASTER — LIST / CREATE
# ---------------------------------------------------------------------
class JobWorkProcessListCreateAPIView(APIView):

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):

        # ---- Seed defaults on first visit ----
        ensure_default_job_work_processes()

        qs = (
            JobWorkProcess.objects
            .filter(is_active=True)
            .order_by("name")
        )

        return Response(
            {
                "success": True,
                "data": JobWorkProcessSerializer(qs, many=True).data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = JobWorkProcessSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": "Process validation failed.",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        process = serializer.save()

        return Response(
            {
                "success": True,
                "message": "Process created.",
                "data": JobWorkProcessSerializer(process).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------
# ISSUE HISTORY
# ---------------------------------------------------------------------
class JobWorkIssueListAPIView(APIView):
    """
    GET /erp/material/job-work/issues/

    Full history of job work issues.
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        qs = (
            JobWorkIssue.objects
            .select_related("stock", "project")
            .all()
            .order_by("-created_at")
        )

        return Response(
            {
                "success": True,
                "data": JobWorkIssueSerializer(qs, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------
# CREATE ISSUE
# ---------------------------------------------------------------------
class JobWorkIssueCreateAPIView(APIView):
    """
    POST /erp/material/job-work/issue/

    Body:
        {
          "stockId": 12,
          "jobWorkType": "In-House" | "Outsourcing",
          "processId": "CUT01",
          "quantityIssued": 3,
          "issuedBy": "Arun",
          "remarks": "",
          # In-House only:
          "jobWorkUnit": "Unit 1",
          # Outsourcing only:
          "vendor": "Shree Fabricators",
          "vendorContact": "+91-...",
          "jobWorkLocation": "Pune",
          "expectedReturnDate": "2026-10-20"
        }
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request):

        stock_id = request.data.get("stockId")
        job_work_type = str(request.data.get("jobWorkType", "")).strip()
        process_id = str(request.data.get("processId", "")).strip()
        issued_by = str(request.data.get("issuedBy", "")).strip()
        remarks = str(request.data.get("remarks", "")).strip()

        if not stock_id:
            return Response(
                {"success": False, "message": "stockId is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if job_work_type not in ("In-House", "Outsourcing"):
            return Response(
                {"success": False, "message": "Invalid jobWorkType."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---- Process ----
        process = (
            JobWorkProcess.objects
            .filter(process_id__iexact=process_id, is_active=True)
            .first()
        )
        if process is None:
            return Response(
                {"success": False, "message": "Process not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ---- Quantity ----
        try:
            quantity = Decimal(str(request.data.get("quantityIssued", "0")))
        except (InvalidOperation, TypeError, ValueError):
            return Response(
                {"success": False, "message": "Invalid quantity."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if quantity <= 0:
            return Response(
                {"success": False, "message": "Quantity must be greater than 0."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not issued_by:
            return Response(
                {"success": False, "message": "Issued By is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---- Lock the stock lot ----
        try:
            stock = (
                MaterialStock.objects
                .select_for_update()
                .select_related("project")
                .get(id=stock_id)
            )
        except MaterialStock.DoesNotExist:
            return Response(
                {"success": False, "message": "Stock lot not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ---- Available check ----
        available = stock.available_qty
        if quantity > available:
            return Response(
                {
                    "success": False,
                    "message": (
                        f"Only {available} {stock.uom} available to issue."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---- Validate integration exists (project resolved via integration) ----
        integration = None
        if stock.purchase_order_item_id:
            integration = (
                BOMPOIntegration.objects
                .filter(purchase_order_item_id=stock.purchase_order_item_id)
                .select_related("project")
                .order_by("-created_at")
                .first()
            )
        elif stock.dummy_purchase_order_item_id:
            integration = (
                BOMPOIntegration.objects
                .filter(dummy_purchase_order_item_id=stock.dummy_purchase_order_item_id)
                .select_related("project")
                .order_by("-created_at")
                .first()
            )

        if integration is None:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Complete DWG/BOM integration before issuing "
                        "this material."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        resolved_project = integration.project if integration else stock.project

        # ---- Job-work-type-specific fields ----
        job_work_unit = ""
        vendor = ""
        vendor_contact = ""
        job_work_location = ""
        expected_return_date = None

        if job_work_type == "In-House":
            job_work_unit = str(
                request.data.get("jobWorkUnit", "")
            ).strip()
            if job_work_unit not in ("Unit 1", "Unit 2"):
                return Response(
                    {
                        "success": False,
                        "message": "Job work unit must be Unit 1 or Unit 2.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        else:
            vendor = str(request.data.get("vendor", "")).strip()
            vendor_contact = str(request.data.get("vendorContact", "")).strip()
            job_work_location = str(request.data.get("jobWorkLocation", "")).strip()
            erd_raw = request.data.get("expectedReturnDate")
            if not vendor:
                return Response(
                    {"success": False, "message": "Vendor is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not job_work_location:
                return Response(
                    {"success": False, "message": "Job work location is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not erd_raw:
                return Response(
                    {"success": False, "message": "Expected return date is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                expected_return_date = date.fromisoformat(str(erd_raw))
            except (TypeError, ValueError):
                return Response(
                    {"success": False, "message": "Invalid expected return date."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # ---- Create the issue ----
        issue = JobWorkIssue.objects.create(
            issue_number=generate_job_work_issue_number(),
            stock=stock,
            po_number=stock.po_number,
            description=stock.description,
            material=stock.material or "",
            material_code=stock.material_code or "",
            material_spec=stock.material_spec or "",
            thickness=stock.thickness or "",
            length=stock.length or "",
            width=stock.width or "",
            uom=stock.uom or "Nos",
            project=resolved_project,
            dwg_description=stock.dwg_description or "",
            revision=stock.revision or "",
            job_work_type=job_work_type,
            process_name=process.name,
            process_id=process.process_id,
            job_work_unit=job_work_unit,
            vendor=vendor,
            vendor_contact=vendor_contact,
            job_work_location=job_work_location,
            expected_return_date=expected_return_date,
            quantity_issued=quantity,
            quantity_returned=Decimal("0"),
            issued_by=issued_by,
            remarks=remarks,
            status=JobWorkIssue.Status.ISSUED,
            created_by=request.user,
        )

        # ---- Stock OUT movement ----
        MaterialStockMovement.objects.create(
            stock=stock,
            direction=MaterialStockMovement.Direction.OUT,
            movement_type=MaterialStockMovement.MovementType.ISSUE_JOB_WORK,
            quantity=quantity,
            reference_type="JobWorkIssue",
            reference_id=issue.id,
            remarks=remarks,
            created_by=request.user,
        )

        return Response(
            {
                "success": True,
                "message": (
                    f"{issue.issue_number} — "
                    f"{quantity} {issue.uom} issued for {process.name}."
                ),
                "data": JobWorkIssueSerializer(issue).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------
# RECEIVE FROM JOB WORK (RETURN + NEW LOT)
# ---------------------------------------------------------------------
class JobWorkReceiveAPIView(APIView):
    """
    POST /erp/material/job-work/receive/<issue_id>/

    Body:
        {
          "returnedQty": 2,
          "sourceType": "Job Remaining",  # optional, defaults to Job Remaining
          "unit": "Unit 1",
          "receivedBy": "Arun",
          "remarks": ""
        }

    - Records returnedQty as an IN movement on the original lot.
    - If sourceType != "" creates a NEW lot with the given sourceType
      so the returned material is tracked separately.
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request, issue_id):

        try:
            issue = (
                JobWorkIssue.objects
                .select_for_update()
                .select_related("stock", "project")
                .get(id=issue_id)
            )
        except JobWorkIssue.DoesNotExist:
            return Response(
                {"success": False, "message": "Issue not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            returned_qty = Decimal(str(request.data.get("returnedQty", "0")))
        except (InvalidOperation, TypeError, ValueError):
            return Response(
                {"success": False, "message": "Invalid quantity."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if returned_qty <= 0:
            return Response(
                {"success": False, "message": "Return quantity must be > 0."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        balance = (issue.quantity_issued or 0) - (issue.quantity_returned or 0)

        if returned_qty > balance:
            return Response(
                {
                    "success": False,
                    "message": f"Only {balance} {issue.uom} balance to return.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---- Return to original lot (IN) ----
        MaterialStockMovement.objects.create(
            stock=issue.stock,
            direction=MaterialStockMovement.Direction.IN,
            movement_type=MaterialStockMovement.MovementType.RETURN_JOB_WORK,
            quantity=returned_qty,
            reference_type="JobWorkIssue",
            reference_id=issue.id,
            remarks=str(request.data.get("remarks", "")).strip(),
            created_by=request.user,
        )

        # ---- Update issue status ----
        issue.quantity_returned = (issue.quantity_returned or 0) + returned_qty

        if issue.quantity_returned >= issue.quantity_issued:
            issue.status = JobWorkIssue.Status.FULLY_RETURNED
        else:
            issue.status = JobWorkIssue.Status.PARTIALLY_RETURNED

        issue.save(
            update_fields=["quantity_returned", "status", "updated_at"]
        )

        return Response(
            {
                "success": True,
                "message": (
                    f"{returned_qty} {issue.uom} returned to stock."
                ),
                "data": JobWorkIssueSerializer(issue).data,
            },
            status=status.HTTP_200_OK,
        )


# =====================================================================
# RECEIVE FROM JOB WORK
# -----------------------------------------------------------------
#   GET    /erp/material/job-work/receive/         → list open JI issues
#   GET    /erp/material/job-work/receive/history/ → list received rows
#   POST   /erp/material/job-work/receive/         → record a receipt
# =====================================================================

from .models import (
    JobWorkReceive,
    JobWorkReceivePiece,
    JobWorkReceiveRemaining,
    JobWorkReceiveNumberSettings,
)


def generate_job_work_receive_number():
    settings_obj = (
        JobWorkReceiveNumberSettings.objects
        .select_for_update()
        .filter(is_active=True)
        .first()
    )

    if settings_obj is None:
        try:
            settings_obj = JobWorkReceiveNumberSettings.objects.create(
                prefix="JWR",
                next_number=1,
                number_padding=4,
                is_active=True,
            )
        except IntegrityError:
            settings_obj = (
                JobWorkReceiveNumberSettings.objects
                .select_for_update()
                .filter(is_active=True)
                .first()
            )

    number = (
        f"{settings_obj.prefix}"
        f"{settings_obj.next_number:0{settings_obj.number_padding}d}"
    )

    settings_obj.next_number += 1
    settings_obj.save(
        update_fields=["next_number", "updated_at"]
    )

    return number


# ---------------------------------------------------------------------
# LIST OPEN ISSUES FOR RECEIVING
# ---------------------------------------------------------------------
class JobWorkReceiveListAPIView(APIView):
    """
    GET /erp/material/job-work/receive/

    Returns every JobWorkIssue with outstanding quantity
    (quantity_issued − quantity_returned > 0).
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):

        issues = (
            JobWorkIssue.objects
            .select_related("stock", "project")
            .exclude(status=JobWorkIssue.Status.FULLY_RETURNED)
            .order_by("-created_at")
        )

        rows = []

        for issue in issues:
            received_so_far = issue.quantity_returned or Decimal("0")
            issued = issue.quantity_issued or Decimal("0")
            balance = issued - received_so_far

            if balance <= 0:
                continue

            rows.append({
                "id": issue.id,
                "issueNumber": issue.issue_number,
                "issueDate": issue.issue_date.isoformat(),
                "stockId": issue.stock_id,
                "stockCode": issue.stock.stock_id,
                "poNumber": issue.po_number,
                "poType": (
                    "Dummy PO"
                    if issue.stock.source_type == MaterialStock.SourceType.DUMMY_PO
                    else "PO"
                ),
                "supplier": issue.vendor or "—",
                "description": issue.description,
                "project": issue.project.name if issue.project else "—",
                "dwgDescription": issue.dwg_description or "—",
                "revision": issue.revision or "—",
                "material": issue.material or "—",
                "materialCode": issue.material_code or "—",
                "materialSpec": issue.material_spec or "—",
                "thickness": issue.thickness or "—",
                "length": issue.length or "—",
                "width": issue.width or "—",
                "size": (
                    f"{issue.length} x {issue.width}"
                    if issue.length and issue.width
                    else "—"
                ),
                "requiredQty": float(issued),
                "issuedQty": float(issued),
                "previouslyReceived": float(received_so_far),
                "outputQty": float(issue.quantity_returned or 0),  # informational
                "unit": issue.job_work_unit or "—",
                "jobWorkType": issue.job_work_type,
                "jobWorkUnit": issue.job_work_unit or "—",
                "process": issue.process_name or "—",
                "processId": issue.process_id or "—",
                "uom": issue.uom or "Nos",
                "reworkPending": False,
            })

        return Response(
            {"success": True, "data": rows},
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------
# LIST PAST RECEIVES
# ---------------------------------------------------------------------
class JobWorkReceiveHistoryAPIView(APIView):
    """
    GET /erp/material/job-work/receive/history/
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        qs = (
            JobWorkReceive.objects
            .select_related("issue", "project")
            .prefetch_related("output_pieces", "remaining_pieces")
            .order_by("-created_at")
        )

        return Response(
            {
                "success": True,
                "data": JobWorkReceiveSerializer(qs, many=True).data,
            },
            status=status.HTTP_200_OK,
        )
class JobWorkReceiveCreateAPIView(APIView):
    """
    POST /erp/material/job-work/receive/<issue_id>/

    Body:
        {
          "completedInputQty": 4,
          "receivedBy": "Kumar",
          "remarks": "",

          "outputPieces": [
            {
              "pieceNo": "PL001",
              "length": "1500",
              "width": "3000",
              "qty": 2,
              "weight": 40,
              "remarks": ""
            }
          ],

          "remainingPieces": [
            {
              "plateNo": "PL001RT",
              "length": "500",
              "width": "300",
              "weight": 15,
              "reworkRequired": "No",
              "remarks": ""
            }
          ]
        }

    Safety against double-click:
      - select_for_update() locks the issue row
      - Re-checks balance INSIDE the transaction after the lock
      - Returns 400 if the previous click already consumed the balance
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request, issue_id):

        # ============================================================
        # 1. LOCK THE ISSUE ROW
        # ------------------------------------------------------------
        # If two requests arrive simultaneously, the second one blocks
        # here until the first commits. Then it re-reads the freshly
        # updated quantity_returned and sees the true balance.
        # ============================================================
        try:
            issue = (
                JobWorkIssue.objects
                .select_for_update()
                .select_related("stock", "project")
                .get(id=issue_id)
            )
        except JobWorkIssue.DoesNotExist:
            return Response(
                {"success": False, "message": "Issue not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ============================================================
        # 2. PARSE BODY
        # ============================================================
        completed_input_qty = self._decimal(
            request.data.get("completedInputQty")
        )
        received_by = str(request.data.get("receivedBy", "")).strip()
        remarks = str(request.data.get("remarks", "")).strip()

        output_pieces = request.data.get("outputPieces") or []
        remaining_pieces = request.data.get("remainingPieces") or []

        if completed_input_qty is None or completed_input_qty <= 0:
            return Response(
                {
                    "success": False,
                    "message": "completedInputQty must be > 0.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not received_by:
            return Response(
                {"success": False, "message": "receivedBy is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ============================================================
        # 3. BALANCE CHECK — under the lock
        # ------------------------------------------------------------
        # By the time we reach this line, we hold the row lock. If a
        # previous click already committed, `quantity_returned` is
        # up-to-date and balance reflects the new state.
        # ============================================================
        issued = issue.quantity_issued or Decimal("0")
        already_returned = issue.quantity_returned or Decimal("0")
        balance = issued - already_returned

        if balance <= 0:
            return Response(
                {
                    "success": False,
                    "message": (
                        "This issue has already been fully received."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if completed_input_qty > balance:
            return Response(
                {
                    "success": False,
                    "message": (
                        f"Completed input qty exceeds balance to receive "
                        f"({balance})."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ============================================================
        # 4. OUTPUT PIECES
        # ------------------------------------------------------------
        # Dict keys use MODEL field names (snake_case). bulk_create
        # bypasses the serializer, so we translate here.
        # ============================================================
        cleaned_output = []
        total_output_qty = Decimal("0")
        total_output_weight = Decimal("0")

        for idx, p in enumerate(output_pieces, start=1):

            if not isinstance(p, dict):
                continue

            piece_no = str(p.get("pieceNo", "")).strip()
            qty = self._decimal(p.get("qty"))

            if not piece_no or qty is None or qty <= 0:
                return Response(
                    {
                        "success": False,
                        "message": (
                            f"Output piece #{idx}: pieceNo and qty (>0) "
                            f"are required."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            weight = self._decimal(p.get("weight")) or Decimal("0")

            cleaned_output.append({
                "piece_no": piece_no,
                "length": str(p.get("length", "")).strip(),
                "width": str(p.get("width", "")).strip(),
                "thickness": issue.thickness or "",
                "qty": qty,
                "weight": weight,
                "remarks": str(p.get("remarks", "")).strip(),
            })

            total_output_qty += qty
            total_output_weight += weight

        if not cleaned_output:
            return Response(
                {
                    "success": False,
                    "message": "At least one output piece is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ============================================================
        # 5. REMAINING PIECES
        # ------------------------------------------------------------
        # User-controlled count. Each row needs a plate_no. Rows that
        # have rework_required == Yes will spawn a new MaterialStock
        # lot flagged for rework.
        # ============================================================
        remaining_input_qty = balance - completed_input_qty
        cleaned_remaining = []
        total_remaining_weight = Decimal("0")

        for idx, p in enumerate(remaining_pieces, start=1):

            if not isinstance(p, dict):
                continue

            plate_no = str(p.get("plateNo", "")).strip()

            if not plate_no:
                return Response(
                    {
                        "success": False,
                        "message": (
                            f"Remaining piece #{idx}: plateNo is "
                            f"required."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            weight = self._decimal(p.get("weight")) or Decimal("0")

            cleaned_remaining.append({
                "plate_no": plate_no,
                "length": str(p.get("length", "")).strip(),
                "width": str(p.get("width", "")).strip(),
                "thickness": issue.thickness or "",
                "weight": weight,
                "remarks": str(p.get("remarks", "")).strip(),
                "rework_required": (
                    "Yes"
                    if str(
                        p.get("reworkRequired", "No")
                    ).strip() == "Yes"
                    else "No"
                ),
            })

            total_remaining_weight += weight

        # ============================================================
        # 6. CREATE THE RECEIVE
        # ============================================================
        receive = JobWorkReceive.objects.create(
            receive_number=generate_job_work_receive_number(),
            issue=issue,
            job_work_id=issue.issue_number,
            po_number=issue.po_number,
            description=issue.description,
            material=issue.material or "",
            material_code=issue.material_code or "",
            material_spec=issue.material_spec or "",
            thickness=issue.thickness or "",
            length=issue.length or "",
            width=issue.width or "",
            uom=issue.uom or "Nos",
            project=issue.project,
            dwg_description=issue.dwg_description or "",
            revision=issue.revision or "",
            process_name=issue.process_name or "",
            process_id=issue.process_id or "",
            completed_input_qty=completed_input_qty,
            remaining_input_qty=remaining_input_qty,
            total_output_qty=total_output_qty,
            total_output_weight=total_output_weight,
            total_remaining_weight=total_remaining_weight,
            received_by=received_by,
            remarks=remarks,
            created_by=request.user,
        )

        # ============================================================
        # 7. BULK INSERT — output pieces and remaining rows
        # ============================================================
        if cleaned_output:
            JobWorkReceivePiece.objects.bulk_create([
                JobWorkReceivePiece(receive=receive, **p)
                for p in cleaned_output
            ])

        if cleaned_remaining:
            JobWorkReceiveRemaining.objects.bulk_create([
                JobWorkReceiveRemaining(receive=receive, **p)
                for p in cleaned_remaining
            ])

        # ============================================================
        # 8. STOCK IN — completed input returns to the original lot
        # ============================================================
        MaterialStockMovement.objects.create(
            stock=issue.stock,
            direction=MaterialStockMovement.Direction.IN,
            movement_type=MaterialStockMovement.MovementType.RETURN_JOB_WORK,
            quantity=completed_input_qty,
            reference_type="JobWorkReceive",
            reference_id=receive.id,
            remarks=remarks,
            created_by=request.user,
        )

        # ============================================================
        # 9. REMAINING PIECES → NEW MaterialStock LOTS
        # ------------------------------------------------------------
        # Each remaining piece becomes its own stock lot. If
        # rework_required == "Yes", the lot is flagged so it shows up
        # on the Rework page.
        # ============================================================
        for p in cleaned_remaining:

            lot = MaterialStock.objects.create(
                stock_id=generate_stock_id(),
                unit=(
                    issue.job_work_unit
                    if issue.job_work_unit
                    and issue.job_work_unit != "—"
                    else "Unit 1"
                ),
                source_type=MaterialStock.SourceType.JOB_REMAINING,
                material_grn=None,
                purchase_order_item=None,
                dummy_purchase_order_item=None,
                po_number=issue.po_number or "",
                description=(
                    f"{issue.description} — Remaining {p['plate_no']}"
                ),
                material=issue.material or "",
                material_code=issue.material_code or "",
                material_spec=issue.material_spec or "",
                thickness=issue.thickness or "",
                length=p.get("length", ""),
                width=p.get("width", ""),
                heat_number="",
                plate_number=p["plate_no"],
                original_qty=Decimal("0"),
                uom=issue.uom or "Nos",
                project=issue.project,
                dwg_description=issue.dwg_description or "",
                revision=issue.revision or "",
                stock_status=MaterialStock.StockStatus.REMAINING,
                rework_required=(p["rework_required"] == "Yes"),
                remarks=(
                    f"Received as remaining from {issue.issue_number} "
                    f"({receive.receive_number})"
                ),
                created_by=request.user,
            )

            MaterialStockMovement.objects.create(
                stock=lot,
                direction=MaterialStockMovement.Direction.IN,
                movement_type=(
                    MaterialStockMovement.MovementType.RETURN_JOB_WORK
                ),
                quantity=p.get("weight") or Decimal("0"),
                reference_type="JobWorkReceive",
                reference_id=receive.id,
                remarks=p.get("remarks", ""),
                created_by=request.user,
            )

        # ============================================================
        # 10. UPDATE THE ISSUE
        # ============================================================
        issue.quantity_returned = (
            (issue.quantity_returned or Decimal("0")) + completed_input_qty
        )

        if issue.quantity_returned >= issue.quantity_issued:
            issue.status = JobWorkIssue.Status.FULLY_RETURNED
        else:
            issue.status = JobWorkIssue.Status.PARTIALLY_RETURNED

        issue.save(
            update_fields=["quantity_returned", "status", "updated_at"]
        )

        return Response(
            {
                "success": True,
                "message": f"{receive.receive_number} recorded.",
                "data": JobWorkReceiveSerializer(receive).data,
            },
            status=status.HTTP_201_CREATED,
        )

    # ============================================================
    # HELPERS
    # ============================================================
    @staticmethod
    def _decimal(value):
        if value in (None, ""):
            return None
        try:
            return Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            return None
        

# =====================================================================
# ISSUE TO PRODUCTION
# -----------------------------------------------------------------
#   GET    /erp/material/production/available/      → list of pieces with qty > 0
#   GET    /erp/material/production/history/        → list of past issues
#   POST   /erp/material/production/issue/          → record one issue
#   GET    /erp/material/production/filter-options/ → dropdown values
# =====================================================================

from .models import (
    ProductionIssue,
    ProductionIssueNumberSettings,
    JobWorkReceive,
    JobWorkReceivePiece,
)


def generate_production_issue_number():
    settings_obj = (
        ProductionIssueNumberSettings.objects
        .select_for_update()
        .filter(is_active=True)
        .first()
    )

    if settings_obj is None:
        try:
            settings_obj = ProductionIssueNumberSettings.objects.create(
                prefix="IP",
                next_number=1,
                number_padding=4,
                is_active=True,
            )
        except IntegrityError:
            settings_obj = (
                ProductionIssueNumberSettings.objects
                .select_for_update()
                .filter(is_active=True)
                .first()
            )

    number = (
        f"{settings_obj.prefix}"
        f"{settings_obj.next_number:0{settings_obj.number_padding}d}"
    )

    settings_obj.next_number += 1
    settings_obj.save(
        update_fields=["next_number", "updated_at"]
    )

    return number


# ---------------------------------------------------------------------
# AVAILABLE MATERIAL (pieces received from job work with balance)
# ---------------------------------------------------------------------
class ProductionAvailableListAPIView(APIView):
    """
    GET /erp/material/production/available/

    Returns one row per received job work piece that still has
    available_qty > 0.
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):

        # ---- Piece-level issued totals ----
        issued_map = {
            row["job_work_piece_id"]: row["total"]
            for row in (
                ProductionIssue.objects
                .exclude(job_work_piece__isnull=True)
                .values("job_work_piece_id")
                .annotate(total=Sum("issued_qty"))
            )
        }

        pieces = (
            JobWorkReceivePiece.objects
            .select_related(
                "receive",
                "receive__issue",
                "receive__project",
            )
            .all()
            .order_by("-receive__created_at", "id")
        )

        rows = []

        for piece in pieces:
            receive = piece.receive
            issue = receive.issue

            received = piece.qty or Decimal("0")
            previously = issued_map.get(piece.id, Decimal("0"))
            available = received - previously

            if available <= 0:
                continue

            # ⚠️ Renamed from `status` to `row_status`
            if previously <= 0:
                row_status = "Available"
            elif previously >= received:
                row_status = "Fully Issued"
            else:
                row_status = "Partially Issued"

            rows.append({
                "id": piece.id,
                "key": f"{receive.job_work_id}-{piece.piece_no}",
                "jobWorkReceiveId": receive.id,
                "jobWorkPieceId": piece.id,
                "jobWorkId": receive.job_work_id or (
                    issue.issue_number if issue else ""
                ),
                "poNumber": receive.po_number or "",
                "poType": (
                    "Dummy PO"
                    if "DUMMY" in (receive.po_number or "").upper()
                    else "PO"
                ),
                "supplier": (
                    issue.vendor if issue and issue.vendor else "—"
                ),
                "description": receive.description or "",
                "material": receive.material or "",
                "materialCode": receive.material_code or "",
                "materialSpec": receive.material_spec or "",
                "thickness": piece.thickness or receive.thickness or "",
                "length": piece.length or "",
                "width": piece.width or "",
                "size": (
                    f"{piece.length} × {piece.width}"
                    if piece.length and piece.width
                    else ""
                ),
                "unit": (
                    receive.issue.job_work_unit
                    if receive.issue
                    else ""
                ),
                "jobWorkType": (
                    receive.issue.job_work_type
                    if receive.issue
                    else ""
                ),
                "jobWorkUnit": receive.uom or "Nos",
                "process": receive.process_name or "",
                "processId": receive.process_id or "",
                "project": (
                    receive.project.name if receive.project else "—"
                ),
                "projectId": receive.project_id,
                "dwgDescription": receive.dwg_description or "",
                "revision": receive.revision or "",
                "pieceNo": piece.piece_no or "",
                "receivedQty": float(received),
                "previouslyIssuedQty": float(previously),
                "availableQty": float(available),
                "uom": receive.uom or "Nos",
                "status": row_status,             
            })

        return Response(
            {"success": True, "data": rows},
            status=status.HTTP_200_OK,            
        )

# ---------------------------------------------------------------------
# ISSUE HISTORY
# ---------------------------------------------------------------------
class ProductionIssueListAPIView(APIView):
    """
    GET /erp/material/production/history/
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        qs = (
            ProductionIssue.objects
            .select_related("project", "job_work_receive", "job_work_piece")
            .all()
            .order_by("-created_at")
        )

        return Response(
            {
                "success": True,
                "data": ProductionIssueSerializer(qs, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------
# CREATE ISSUE
# ---------------------------------------------------------------------
class ProductionIssueCreateAPIView(APIView):
    """
    POST /erp/material/production/issue/

    Body:
        {
          "jobWorkPieceId": 12,
          "issuedQty": 4,
          "issuedBy": "R. Kumar",
          "remarks": ""
        }
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request):

        piece_id = request.data.get("jobWorkPieceId")
        issued_by = str(request.data.get("issuedBy", "")).strip()
        remarks = str(request.data.get("remarks", "")).strip()

        if not piece_id:
            return Response(
                {
                    "success": False,
                    "message": "jobWorkPieceId is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---- Parse quantity ----
        try:
            issued_qty = Decimal(
                str(request.data.get("issuedQty", "0"))
            )
        except (InvalidOperation, TypeError, ValueError):
            return Response(
                {"success": False, "message": "Invalid quantity."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if issued_qty <= 0:
            return Response(
                {
                    "success": False,
                    "message": "Issued quantity must be > 0.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not issued_by:
            return Response(
                {"success": False, "message": "issuedBy is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---- Lock the piece ----
        try:
            piece = (
                JobWorkReceivePiece.objects
                .select_for_update()
                .select_related(
                    "receive",
                    "receive__issue",
                    "receive__project",
                )
                .get(id=piece_id)
            )
        except JobWorkReceivePiece.DoesNotExist:
            return Response(
                {"success": False, "message": "Piece not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        receive = piece.receive
        issue = receive.issue

        # ---- Available check ----
        previously_issued = (
            ProductionIssue.objects
            .filter(job_work_piece=piece)
            .aggregate(total=Sum("issued_qty"))["total"]
            or Decimal("0")
        )

        received = piece.qty or Decimal("0")
        available = received - previously_issued

        if available <= 0:
            return Response(
                {
                    "success": False,
                    "message": (
                        "This piece has already been fully issued."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if issued_qty > available:
            return Response(
                {
                    "success": False,
                    "message": (
                        f"Issue quantity exceeds available quantity "
                        f"({available})."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---- Find the stock lot for this piece, if any ----
        stock_lot = (
            MaterialStock.objects
            .filter(plate_number=piece.piece_no)
            .order_by("-created_at")
            .first()
        )

        # ---- Create the issue ----
        prod_issue = ProductionIssue.objects.create(
            issue_number=generate_production_issue_number(),
            job_work_receive=receive,
            job_work_piece=piece,
            material_stock=stock_lot,
            job_work_id=receive.job_work_id,
            po_number=receive.po_number,
            po_type=(
                "Dummy PO"
                if "DUMMY" in (receive.po_number or "").upper()
                else "PO"
            ),
            supplier=(issue.vendor if issue and issue.vendor else ""),
            description=receive.description,
            material=receive.material,
            material_code=receive.material_code,
            material_spec=receive.material_spec,
            thickness=piece.thickness or receive.thickness,
            length=piece.length or "",
            width=piece.width or "",
            unit=(
                issue.job_work_unit if issue else ""
            ),
            job_work_type=(
                issue.job_work_type if issue else ""
            ),
            job_work_unit=receive.uom or "Nos",
            process_name=receive.process_name,
            process_id=receive.process_id,
            project=receive.project,
            dwg_description=receive.dwg_description,
            revision=receive.revision,
            piece_no=piece.piece_no,
            uom=receive.uom or "Nos",
            original_received_qty=received,
            previously_issued_qty=previously_issued,
            issued_qty=issued_qty,
            remaining_available_qty=available - issued_qty,
            issued_by=issued_by,
            remarks=remarks,
            status=ProductionIssue.Status.ISSUED,
            created_by=request.user,
        )

        # ---- OUT movement on the stock lot (if we found one) ----
        if stock_lot is not None:
            MaterialStockMovement.objects.create(
                stock=stock_lot,
                direction=MaterialStockMovement.Direction.OUT,
                movement_type=(
                    MaterialStockMovement.MovementType.ISSUE_PRODUCTION
                ),
                quantity=issued_qty,
                reference_type="ProductionIssue",
                reference_id=prod_issue.id,
                remarks=remarks,
                created_by=request.user,
            )

        return Response(
            {
                "success": True,
                "message": (
                    f"{prod_issue.issue_number} recorded."
                ),
                "data": ProductionIssueSerializer(prod_issue).data,
            },
            status=status.HTTP_201_CREATED,
        )