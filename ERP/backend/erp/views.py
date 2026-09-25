from django.db import models
from django.shortcuts import render
from django.db import transaction
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from .serializers import (
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

from .permissions import IsAccounts
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
    permission_classes = [IsAuthenticated, IsAccounts]

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

    permission_classes = [IsAuthenticated, IsAccounts]

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
    permission_classes = [IsAuthenticated, IsAccounts]

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

    permission_classes = [AllowAny]
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