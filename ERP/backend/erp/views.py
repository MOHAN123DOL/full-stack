from django.shortcuts import render
from django.db import transaction

from rest_framework import generics
from rest_framework.response import Response
from rest_framework import status

from .models import PurchaseOrder, PurchaseOrderNumberSettings
from .serializers import PurchaseOrderSerializer
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
from django.contrib.auth import authenticate
from django.middleware.csrf import get_token

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated

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

class ProfileAPIView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    def get(self, request):
        serializer = ProfileSerializer(
            request.user,
            context={
                "request": request,
            },
        )

        return Response(
            {
                "success": True,
                "message": "Profile retrieved successfully.",
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

    permission_classes = [IsAccounts]

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
                    "message": "Purchase Order number settings have not been configured."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        po_number = (
            f"{settings_obj.prefix}"
            f"{settings_obj.next_number:0{settings_obj.number_padding}d}"
        )

        return Response(
            {
                "success": True,
                "po_number": po_number
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