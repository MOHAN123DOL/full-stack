from xml.dom.minidom import DocumentType
from .services import (
    calculate_salary,
    save_salary_draft,
    confirm_salary,
    standard_hours,
    month_bounds,
    money,
)
from datetime import datetime
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Employee, Advance, AdvanceRepayment, SalaryPayment, WageConfig
from .serializers import (
    SalaryEmployeeSerializer,
    AdvanceSerializer,
    AdvanceRepaymentSerializer,
    SalaryPaymentSerializer,
    WageConfigSerializer,
    SalaryCalculationInputSerializer,
)
from .services import calculate_salary, save_salary_draft, confirm_salary, month_bounds, money

from .services import max_normal_hours

from django.db import models
from django.shortcuts import render
from django.db import transaction
from decimal import Decimal
from django.db.models import Sum
from decimal import Decimal, InvalidOperation
from .services import mark_rework_done, _freeze_duration , create_rework_from_job_work , create_rework_from_production
from django.db import transaction
from django.db.models import Sum

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import (
    AssemblyExecution,
    AssemblyExecutionEvent,
    AssemblyStageExecution,
    AssemblyStageMovement,
    DispatchNumberSettings,
    DispatchTransaction,
    PaymentRecord,
    PurchaseOrder,
    PurchaseOrderItem,
    DummyPurchaseOrderItem,
    ConsumableIssue,
    BOMPOIntegration,
    MaterialGRN,
    MaterialGRNNumberSettings,
)
from .serializers import AdminSecuritySettingsSerializer, AdvanceRepaymentSerializer, AssemblyExecutionSerializer, AssemblySerializer, AssemblyStageExecutionSerializer, DispatchCreateSerializer, DispatchReadyAssemblySerializer, DispatchTransactionSerializer, JobWorkReceiveSerializer, MaterialGRNSerializer, ProductionIssueSerializer
from .permissions import IsMaterialPlanning , IsHRorAdmin
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
    UserProfile,
)
from .serializers import PurchaseOrderSerializer
from .permissions import IsAccounts
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
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
from .permissions import IsERPAdmin, IsMaterialPlanning , IsAccounts

from .serializers import LoginSerializer
from django.conf import settings
from django.utils import timezone
from django.middleware.csrf import get_token

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from .models import UserProfile


def get_refresh_cookie_name(user_type):
    """
    Return the refresh-cookie name for a supported department.
    """
    cookie_names = getattr(settings, "REFRESH_COOKIE_NAMES", {})

    return cookie_names.get(user_type)


from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings

from .models import User, UserProfile, AdminSecuritySettings, EmailOTP
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
        user_type = user.user_type

        # ==================================================
        # CHECK FOR ADMIN LOGIN OTP
        # ==================================================
        if user_type == "admin":
            security, _ = AdminSecuritySettings.objects.get_or_create(user=user)
            
            if security.login_otp_enabled:
                # 1. Ensure we have an email to send to
                email = security.verification_email or user.email
                if not email:
                    return Response(
                        {"success": False, "message": "No email configured for OTP."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # 2. Rate-limit (30s)
                now = timezone.now()
                if (
                    security.last_otp_sent_at
                    and (now - security.last_otp_sent_at).total_seconds() < 30
                ):
                    remaining = 30 - int((now - security.last_otp_sent_at).total_seconds())
                    return Response(
                        {
                            "success": False,
                            "message": f"Please wait {remaining}s before requesting another OTP.",
                            "retry_after": remaining,
                        },
                        status=status.HTTP_429_TOO_MANY_REQUESTS,
                    )

                # 3. Issue and Send OTP
                try:
                    otp = EmailOTP.issue(user, purpose="login")
                    send_mail(
                        subject="Mugil ERP - Login Verification Code",
                        message=(
                            f"Your login verification code is: {otp.code}\n\n"
                            "It expires in 10 minutes.\n\n"
                            "If you did not attempt to log in, please change your password immediately."
                        ),
                        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
                        recipient_list=[email],
                        fail_silently=False,
                    )
                except Exception as exc:
                    print("Login OTP email failed:", exc)
                    return Response(
                        {"success": False, "message": "Unable to send OTP email. Try again later."},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

                # 4. Save timestamp
                security.last_otp_sent_at = now
                security.save(update_fields=["last_otp_sent_at", "updated_at"])

                # 5. Return a special response telling the frontend to ask for the OTP
                return Response(
                    {
                        "success": True,
                        "otp_required": True,
                        "username": user.username,
                        "message": f"OTP sent to {email}.",
                    },
                    status=status.HTTP_200_OK,
                )

        # ==================================================
        # NORMAL LOGIN FLOW (If OTP not enabled or not admin)
        # ==================================================
        cookie_name = get_refresh_cookie_name(user_type)

        if not cookie_name:
            return Response(
                {"success": False, "message": "Unsupported user department."},
                status=status.HTTP_403_FORBIDDEN,
            )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.last_login = timezone.now()
        profile.save(update_fields=["last_login", "updated_at"])

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
                    "user_type": user_type,
                },
            },
            status=status.HTTP_200_OK,
        )

        response.set_cookie(
            key=cookie_name,
            value=str(refresh),
            max_age=settings.REFRESH_COOKIE_MAX_AGE,
            httponly=settings.REFRESH_COOKIE_HTTPONLY,
            secure=settings.REFRESH_COOKIE_SECURE,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
            path=settings.REFRESH_COOKIE_PATH,
        )

        get_token(request)

        return response

class LoginVerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = str(request.data.get("username", "")).strip()
        code = str(request.data.get("otp", "")).strip()

        if not username or not code:
            return Response(
                {"success": False, "message": "Username and OTP are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Find the user
        user = User.objects.filter(username=username, user_type="admin").first()
        if not user:
            return Response(
                {"success": False, "message": "Invalid login attempt."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # 2. Verify OTP
        otp = EmailOTP.verify(user, purpose="login", code=code)
        if not otp:
            return Response(
                {"success": False, "message": "Invalid or expired OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Success! Proceed with normal login
        user_type = user.user_type
        cookie_name = get_refresh_cookie_name(user_type)

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.last_login = timezone.now()
        profile.save(update_fields=["last_login", "updated_at"])

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
                    "user_type": user_type,
                },
            },
            status=status.HTTP_200_OK,
        )

        response.set_cookie(
            key=cookie_name,
            value=str(refresh),
            max_age=settings.REFRESH_COOKIE_MAX_AGE,
            httponly=settings.REFRESH_COOKIE_HTTPONLY,
            secure=settings.REFRESH_COOKIE_SECURE,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
            path=settings.REFRESH_COOKIE_PATH,
        )

        get_token(request)

        return response


from django.utils import timezone
from django.middleware.csrf import get_token
from rest_framework_simplejwt.tokens import RefreshToken

class LoginVerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = str(request.data.get("username", "")).strip()
        code = str(request.data.get("otp", "")).strip()

        if not username or not code:
            return Response(
                {"success": False, "message": "Username and OTP are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Find the user (only allow admin for OTP login)
        user = User.objects.filter(username=username, user_type="admin").first()
        if not user:
            return Response(
                {"success": False, "message": "Invalid login attempt."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # 2. Verify OTP against the database
        otp = EmailOTP.verify(user, purpose="login", code=code)
        if not otp:
            return Response(
                {"success": False, "message": "Invalid or expired OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Success! Generate tokens and log the user in
        user_type = user.user_type
        cookie_name = get_refresh_cookie_name(user_type)

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.last_login = timezone.now()
        profile.save(update_fields=["last_login", "updated_at"])

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
                    "user_type": user_type,
                },
            },
            status=status.HTTP_200_OK,
        )

        # Set the refresh cookie
        response.set_cookie(
            key=cookie_name,
            value=str(refresh),
            max_age=settings.REFRESH_COOKIE_MAX_AGE,
            httponly=settings.REFRESH_COOKIE_HTTPONLY,
            secure=settings.REFRESH_COOKIE_SECURE,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
            path=settings.REFRESH_COOKIE_PATH,
        )

        get_token(request)

        return response

from django.conf import settings
from django.contrib.auth import get_user_model

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.exceptions import (
    InvalidToken,
    TokenError,
)
from rest_framework_simplejwt.tokens import (
    RefreshToken,
)

User = get_user_model()



class RefreshTokenAPIView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request, user_type):
        valid_user_types = {
            "admin",
            "accounts",
            "hr",
            "material-planning",
            "production",
            "supervisor",
        }

        if user_type not in valid_user_types:
            return Response(
                {
                    "success": False,
                    "message": "Invalid department.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        cookie_names = getattr(
            settings,
            "REFRESH_COOKIE_NAMES",
            {},
        )

        cookie_name = cookie_names.get(user_type)

        if not cookie_name:
            return Response(
                {
                    "success": False,
                    "message": "Refresh cookie is not configured.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        refresh_token = request.COOKIES.get(cookie_name)

        if not refresh_token:
            return Response(
                {
                    "success": False,
                    "message": "Refresh token is missing. Please log in again.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            refresh = RefreshToken(refresh_token)

            user_id_claim = settings.SIMPLE_JWT.get(
                "USER_ID_CLAIM",
                "user_id",
            )

            user_id_field = settings.SIMPLE_JWT.get(
                "USER_ID_FIELD",
                "id",
            )

            user_id = refresh.get(user_id_claim)

            if user_id is None:
                raise InvalidToken("User ID is missing from token.")

            user = User.objects.get(
                **{user_id_field: user_id}
            )

            if not user.is_active:
                return Response(
                    {
                        "success": False,
                        "message": "This account is inactive.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            if user.user_type != user_type:
                return Response(
                    {
                        "success": False,
                        "message": "Department mismatch.",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            serializer = TokenRefreshSerializer(
                data={"refresh": refresh_token}
            )

            serializer.is_valid(raise_exception=True)

            token_data = serializer.validated_data
            access_token = token_data["access"]

            response = Response(
                {
                    "success": True,
                    "access": access_token,
                    "user": {
                        "id": user.pk,
                        "username": user.get_username(),
                        "user_type": user.user_type,
                    },
                },
                status=status.HTTP_200_OK,
            )

            # Save the rotated refresh token when rotation is enabled.
            rotated_refresh = token_data.get("refresh")

            if rotated_refresh:
                response.set_cookie(
                    key=cookie_name,
                    value=rotated_refresh,
                    max_age=settings.REFRESH_COOKIE_MAX_AGE,
                    httponly=settings.REFRESH_COOKIE_HTTPONLY,
                    secure=settings.REFRESH_COOKIE_SECURE,
                    samesite=settings.REFRESH_COOKIE_SAMESITE,
                    path=settings.REFRESH_COOKIE_PATH,
                )

            return response

        except User.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "message": "User not found.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        except (TokenError, InvalidToken):
            return Response(
                {
                    "success": False,
                    "message": "Refresh token is invalid or expired.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )


            
class LogoutAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, user_type):
        cookie_name = get_refresh_cookie_name(user_type)

        if not cookie_name:
            return Response(
                {
                    "success": False,
                    "message": "Unsupported user department.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        refresh_token = request.COOKIES.get(cookie_name)

        # Revoke the refresh token when possible.
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                # Continue clearing the cookie even if the
                # token is invalid or already expired.
                pass

        # Update logout time only for an authenticated request.
        if request.user and request.user.is_authenticated:
            profile, _ = UserProfile.objects.get_or_create(
                user=request.user
            )
            profile.last_logout = timezone.now()
            profile.save(update_fields=["last_logout", "updated_at"])

        response = Response(
            {
                "success": True,
                "message": "Logged out successfully.",
            },
            status=status.HTTP_200_OK,
        )

        # Clear only this department's refresh cookie.
        response.delete_cookie(
            key=cookie_name,
            path=settings.REFRESH_COOKIE_PATH,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
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
    permission_classes = [IsAuthenticated, IsERPAdmin]


class UserProfileDetailAPIView(generics.RetrieveUpdateAPIView):
    queryset = UserProfile.objects.select_related("user").all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated, IsERPAdmin]

    lookup_field = "id"
   
#FOR PROFILE VIEW API

from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

# accounts/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from django.core.mail import send_mail
from django.conf import settings as django_settings

from .models import Employee, AdminSecuritySettings, EmailOTP
from .serializers import ProfileSerializer


def _is_admin(user):
    usertype = getattr(user, "usertype", None) or getattr(user, "user_type", None)
    return str(usertype or "").strip().lower() == "admin"


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
    # PATCH — photo upload  OR  security settings
    # ==================================================
    def patch(self, request):
        # Route: if a file is present → photo upload.
        # Otherwise, treat as security-settings update (admin only).
        if request.FILES.get("profile_photo"):
            return self._handle_photo_upload(request)

        return self._handle_security_update(request)

    # --------------------------------------------------
    # PHOTO UPLOAD (unchanged from your code)
    # --------------------------------------------------
    def _handle_photo_upload(self, request):
        photo = request.FILES.get("profile_photo")

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

        employee = Employee.objects.filter(user=request.user).first()

        if employee is None:
            employee = (
                Employee.objects.filter(created_by=request.user)
                .order_by("-created_at")
                .first()
            )
        if employee is None and request.user.email:
            employee = (
                Employee.objects.filter(email__iexact=request.user.email)
                .order_by("-created_at")
                .first()
            )
        if employee is None and request.user.username:
            employee = (
                Employee.objects.filter(first_name__iexact=request.user.username)
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

        if employee.photo:
            try:
                employee.photo.delete(save=False)
            except Exception:
                pass

        employee.photo = photo

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

    # --------------------------------------------------
    # SECURITY UPDATE (admin only)
    # --------------------------------------------------
    def _handle_security_update(self, request):
        if not _is_admin(request.user):
            return Response(
                {"success": False, "message": "Admin access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        settings_obj, _ = AdminSecuritySettings.objects.get_or_create(
            user=request.user
        )

        data = request.data
        updated_fields = []

        # --- password_otp_enabled / login_otp_enabled ---
        for field in ("password_otp_enabled", "login_otp_enabled"):
            if field in data:
                new_value = bool(data.get(field))
                setattr(settings_obj, field, new_value)
                updated_fields.append(field)

        # --- two_step_enabled: turning OFF is allowed directly;
        #     turning ON must go through the OTP flow
        #     (POST /security/two-step/send-otp + verify-otp).
        if "two_step_enabled" in data and not bool(data["two_step_enabled"]):
            settings_obj.two_step_enabled = False
            settings_obj.password_otp_enabled = False
            settings_obj.login_otp_enabled = False
            updated_fields.extend(
                [
                    "two_step_enabled",
                    "password_otp_enabled",
                    "login_otp_enabled",
                ]
            )

        if updated_fields:
            updated_fields.append("updated_at")
            settings_obj.save(update_fields=list(set(updated_fields)))

        return Response(
            {
                "success": True,
                "message": "Security settings updated.",
                "data": {
                    "security": AdminSecuritySettingsSerializer(
                        settings_obj
                    ).data,
                },
            },
            status=status.HTTP_200_OK,
        )


# accounts/views.py  (append)
# accounts/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from django.core.mail import send_mail
from django.conf import settings as django_settings
from django.utils import timezone

from .models import AdminSecuritySettings, EmailOTP

class TwoStepSendOTPView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _is_admin(request.user):
            return Response(
                {"success": False, "message": "Admin access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        email = str(request.data.get("email", "")).strip()

        if not email:
            return Response(
                {"success": False, "message": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "@" not in email or "." not in email.split("@")[-1]:
            return Response(
                {"success": False, "message": "Enter a valid email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = email.lower()

        settings_obj, _ = AdminSecuritySettings.objects.get_or_create(
            user=request.user
        )
        now = timezone.now()

        if (
            settings_obj.last_otp_sent_at
            and (now - settings_obj.last_otp_sent_at).total_seconds() < 30
        ):
            remaining = 30 - int(
                (now - settings_obj.last_otp_sent_at).total_seconds()
            )
            return Response(
                {
                    "success": False,
                    "message": f"Please wait {remaining}s before requesting another OTP.",
                    "retry_after": remaining,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        try:
            otp = EmailOTP.issue(request.user, purpose="two_step_setup")

            send_mail(
                subject="Your Mugil ERP verification code",
                message=(
                    f"Your OTP is {otp.code}.\n"
                    "It expires in 10 minutes.\n\n"
                    "If you did not request this, you can safely ignore this email."
                ),
                from_email=getattr(django_settings, "DEFAULT_FROM_EMAIL", None),
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as exc:
            print("Two-step OTP email failed:", exc)
            return Response(
                {
                    "success": False,
                    "message": "Unable to send the OTP email right now. Please try again shortly.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # --- SAVE THE EMAIL HERE ---
        settings_obj.last_otp_sent_at = now
        settings_obj.verification_email = email  # <-- Save the email
        
        # Update the fields in the database
        settings_obj.save(update_fields=["last_otp_sent_at", "verification_email", "updated_at"])

        return Response(
            {
                "success": True,
                "message": f"OTP sent to {email}.",
                "data": {
                    "email": email,
                    "expires_in": 600,
                    "retry_after": 30,
                },
            },
            status=status.HTTP_200_OK,
        )
    
class TwoStepVerifyOTPView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _is_admin(request.user):
            return Response(
                {"success": False, "message": "Admin access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        code = str(request.data.get("otp", "")).strip()
        if not code.isdigit() or len(code) != 6:
            return Response(
                {"success": False, "message": "Enter a valid 6-digit OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp = EmailOTP.verify(
            request.user, purpose="two_step_setup", code=code
        )
        if otp is None:
            return Response(
                {"success": False, "message": "Invalid or expired OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        settings_obj, _ = AdminSecuritySettings.objects.get_or_create(
            user=request.user
        )
        settings_obj.mark_email_verified()

        return Response(
            {
                "success": True,
                "message": "Two-step authentication enabled.",
                "data": {
                    "security": AdminSecuritySettingsSerializer(
                        settings_obj
                    ).data,
                },
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


from .models import AdminSecuritySettings, EmailOTP
class SendPasswordChangeOTPView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _is_admin(request.user):
            return Response(
                {"success": False, "message": "Admin access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        settings_obj, _ = AdminSecuritySettings.objects.get_or_create(
            user=request.user
        )

        # Check if they actually have this feature turned on
        if not settings_obj.password_otp_enabled:
            return Response(
                {
                    "success": False,
                    "message": "OTP is not enabled for password changes.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get the email (fallback to user.email if verification_email is blank)
        email = settings_obj.verification_email or request.user.email

        if not email:
            return Response(
                {
                    "success": False,
                    "message": "No email address found on your account.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Rate-limit: 1 OTP per 30 seconds
        now = timezone.now()
        if (
            settings_obj.last_otp_sent_at
            and (now - settings_obj.last_otp_sent_at).total_seconds() < 30
        ):
            remaining = 30 - int(
                (now - settings_obj.last_otp_sent_at).total_seconds()
            )
            return Response(
                {
                    "success": False,
                    "message": f"Please wait {remaining}s before requesting another OTP.",
                    "retry_after": remaining,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Issue the OTP
        try:
            otp = EmailOTP.issue(request.user, purpose="password_change")

            send_mail(
                subject="Mugil ERP - Password Change Code",
                message=(
                    f"Your verification code to change your password is: {otp.code}\n\n"
                    "It expires in 10 minutes.\n\n"
                    "If you did not request this, you can safely ignore this email."
                ),
                from_email=getattr(django_settings, "DEFAULT_FROM_EMAIL", None),
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as exc:
            print("Password change OTP email failed:", exc)
            return Response(
                {
                    "success": False,
                    "message": "Unable to send the OTP email right now. Please try again shortly.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Update the last sent timestamp
        settings_obj.last_otp_sent_at = now
        settings_obj.save(update_fields=["last_otp_sent_at", "updated_at"])

        return Response(
            {
                "success": True,
                "message": f"OTP sent to {email}.",
                "data": {
                    "email": email,
                    "expires_in": 600,
                    "retry_after": 30,
                },
            },
            status=status.HTTP_200_OK,
        )


class ChangePasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # --------------------------------------------------
        # 1. Validate basic password data first
        # --------------------------------------------------
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={"request": request},
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

        # --------------------------------------------------
        # 2. Enforce OTP for Admin (if enabled)
        # --------------------------------------------------
        is_admin = str(getattr(user, "user_type", "")).strip().lower() == "admin"

        if is_admin:
            security_settings, _ = AdminSecuritySettings.objects.get_or_create(user=user)
            
            # If the admin has turned on "Change Password with OTP"
            if security_settings.password_otp_enabled:
                otp_code = str(request.data.get("otp", "")).strip()

                if not otp_code:
                    return Response(
                        {
                            "success": False,
                            "message": "A verification code (OTP) is required to change your password.",
                            "otp_required": True, # Frontend can use this flag to show the OTP input
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Verify the OTP against the database
                valid_otp = EmailOTP.verify(user, purpose="password_change", code=otp_code)
                
                if not valid_otp:
                    return Response(
                        {
                            "success": False,
                            "message": "Invalid or expired OTP. Please request a new one.",
                            "otp_required": True,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        # --------------------------------------------------
        # 3. Save the new password
        # --------------------------------------------------
        user.set_password(serializer.validated_data["newPassword"])
        user.save(update_fields=["password"])

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

            # Use the PO number received from NextPurchaseOrderNumberAPIView

            po_number = str(data.get("po_number", "")).strip()

            if not po_number:
                return Response(
                    {
                        "success": False,
                        "message": "PO number is required."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if PO number already exists
            if PurchaseOrder.objects.filter(
                po_number=po_number
            ).exists():
                return Response(
                    {
                        "success": False,
                        "message": (
                            f"PO number {po_number} already exists. "
                            "Please refresh and get the next PO number."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

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
    permission_classes = [IsAuthenticated, IsAccounts]

    def get(self, request):

        # 1. Get the PO number settings from the database
        settings_obj = (
            PurchaseOrderNumberSettings.objects
            .filter(is_active=True)
            .first()
        )

        if not settings_obj:
            return Response(
                {
                    "success": False,
                    "message": "Purchase Order number settings have not been configured.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Get the latest PO from the database
        last_po = (
            PurchaseOrder.objects
            .order_by("-id")
            .first()
        )

        # 3. Reuse the latest PO if it is not confirmed
        if last_po and last_po.status != PurchaseOrder.Status.CONFIRMED:
            return Response(
                {
                    "success": True,
                    "is_new": False,
                    "po_number": last_po.po_number,
                    "data": PurchaseOrderSerializer(last_po).data,
                },
                status=status.HTTP_200_OK,
            )

        # 4. Read next_number directly from the database settings
        next_number = settings_obj.next_number

        # 5. Find the next unused PO number
        while True:
            po_number = (
                f"{settings_obj.prefix}"
                f"{next_number:0{settings_obj.number_padding}d}"
            )

            if not PurchaseOrder.objects.filter(
                po_number=po_number
            ).exists():
                break

            next_number += 1

        # 6. If no previous PO exists, return the new number
        if last_po is None:
            return Response(
                {
                    "success": True,
                    "is_new": True,
                    "po_number": po_number,
                    "data": None,
                },
                status=status.HTTP_200_OK,
            )

        # 7. Copy previous PO data as a template
        previous_data = PurchaseOrderSerializer(last_po).data.copy()
        previous_data["po_number"] = po_number

        return Response(
            {
                "success": True,
                "is_new": True,
                "po_number": po_number,
                "previous_po_number": last_po.po_number,
                "data": previous_data,
            },
            status=status.HTTP_200_OK,
        )


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
from PIL import Image, UnidentifiedImageError
from rest_framework.parsers import MultiPartParser, FormParser
from django.views.decorators.csrf import csrf_protect
from django.utils.decorators import method_decorator
from rest_framework.permissions import AllowAny


MAX_PDF_UPLOAD_SIZE = 10 * 1024 * 1024
MAX_IMAGE_UPLOAD_SIZE = 5 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}


def validate_pdf_upload(upload):
    """Return a client-safe validation error, or ``None`` for a PDF upload."""
    if upload.size > MAX_PDF_UPLOAD_SIZE:
        return "PDF files must be 10 MB or smaller."

    try:
        header = upload.read(1024)
        upload.seek(0)
    except (AttributeError, OSError):
        return "The uploaded PDF could not be read."

    if b"%PDF-" not in header:
        return "Only valid PDF files are allowed."

    return None


def validate_image_upload(upload):
    """Return a client-safe validation error, or ``None`` for an image."""
    if upload.size > MAX_IMAGE_UPLOAD_SIZE:
        return "Image must be 5 MB or smaller."

    try:
        image = Image.open(upload)
        image.verify()
        image_format = image.format
        upload.seek(0)
    except (OSError, UnidentifiedImageError):
        return "Only valid image files are allowed."

    if image_format not in ALLOWED_IMAGE_FORMATS:
        return "Only JPEG, PNG, WebP, and GIF images are allowed."

    return None


from .services import sync_purchase_order_items



from django.db import transaction
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from django.utils.decorators import method_decorator

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, FormParser

from .models import PurchaseOrder, PurchaseOrderNumberSettings
from .serializers import PurchaseOrderSerializer
from .services import sync_purchase_order_items


@method_decorator(csrf_protect, name="dispatch")
class PurchaseOrderConfirmAPIView(APIView):

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request, po_number):

        try:
            po = PurchaseOrder.objects.select_for_update().get(
                po_number=po_number
            )
        except PurchaseOrder.DoesNotExist:
            return Response(
                {"detail": "Purchase Order not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check whether the PO was already confirmed
        was_already_confirmed = (
            po.status == PurchaseOrder.Status.CONFIRMED
        )

        if not was_already_confirmed:

            # Confirm the PO
            po.status = PurchaseOrder.Status.CONFIRMED
            po.save(update_fields=["status", "updated_at"])

            # Increment the PO number counter only once
            settings_obj = (
                PurchaseOrderNumberSettings.objects
                .select_for_update()
                .get(is_active=True)
            )

            settings_obj.next_number += 1
            settings_obj.save(
                update_fields=["next_number", "updated_at"]
            )

            # Run confirmation side effects
            sync_purchase_order_items(po)

        return Response(
            PurchaseOrderSerializer(po).data,
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

        # GET /quotation-customers/<id>/
        try:

            customer = Customer.objects.get(
                pk=pk,
            )

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
            )

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

            # Update existing customer without changing
            # the original source.
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
                    company_name__iexact=customer_name.strip(),
                )
                .first()
            )

            if customer is None:
                return Response(
                    {
                        "success": False,
                        "message": "Customer not found.",
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
            # 1. Session check (Admin / Accounts refresh cookie)
            # ============================================================

            refresh_token = None

            for department in ("admin", "accounts"):

                cookie_name = get_refresh_cookie_name(department)

                if not cookie_name:
                    continue

                token_value = request.COOKIES.get(cookie_name)

                if token_value:
                    refresh_token = token_value
                    break

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

                if not user_id:
                    return Response(
                        {
                            "success": False,
                            "message": "Invalid session. Please login again.",
                        },
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

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
            # 2. Admin / Accounts permission check
            # ============================================================

            allowed_user_types = {
                User.UserType.ADMIN,
                User.UserType.ACCOUNTS,
            }

            if user.user_type not in allowed_user_types:
                return Response(
                    {
                        "success": False,
                        "message": "Admin or Accounts access required.",
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

            pdf_error = validate_pdf_upload(pdf_file)

            if pdf_error:
                return Response(
                    {
                        "success": False,
                        "message": pdf_error,
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

            # Overwrite previous PDF
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
                quotation.status == Quotation.Status.CONFIRMED
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
            # 7. Advance quotation number counter
            # ============================================================

            # Only increment on first confirmation.
            # Re-confirming must not consume another number.

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

    permission_classes = [
        IsAuthenticated,
        IsAccountsOrMaterialPlanning,
    ]

    # =========================
    # GET
    # =========================

    def get(self, request, pk=None):

        # GET /delivery-challan-customers/
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

        # GET /delivery-challan-customers/<id>/
        try:

            customer = Customer.objects.get(
                pk=pk,
            )

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
            )

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

            # Preserve the customer's original source.
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
                    )
                    .first()
                )

            if customer is None:

                return Response(
                    {
                        "success": False,
                        "message": (
                            f"Customer '{customer_name}' not found. "
                            "Please create the customer first."
                        ),
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            
            data["customer_id"] = customer.id

            
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


# ==================================================================
# GET DELIVERY CHALLAN DETAILS BY DC NUMBER
# ==================================================================
class DeliveryChallanDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAccountsOrMaterialPlanning]

    def get(self, request, dc_number):
        try:
            dc = (
                DeliveryChallan.objects
                .select_related("customer")
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

        serializer = DeliveryChallanSerializer(dc)

        return Response(
            {
                "success": True,
                "message": "Delivery Challan retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_protect, name="dispatch")
class DeliveryChallanConfirmAPIView(APIView):

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, dc_number):

        with transaction.atomic():

            # ============================================================
            # 1. Session check (Admin / Accounts refresh cookie)
            # ============================================================

            refresh_token = None

            for department in ("admin", "accounts"):

                cookie_name = get_refresh_cookie_name(department)

                if not cookie_name:
                    continue

                token_value = request.COOKIES.get(cookie_name)

                if token_value:
                    refresh_token = token_value
                    break

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

                if not user_id:
                    return Response(
                        {
                            "success": False,
                            "message": "Invalid session. Please login again.",
                        },
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

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
            # 2. Admin / Accounts permission check
            # ============================================================

            allowed_user_types = {
                User.UserType.ADMIN,
                User.UserType.ACCOUNTS,
            }

            if user.user_type not in allowed_user_types:
                return Response(
                    {
                        "success": False,
                        "message": "Admin or Accounts access required.",
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

            pdf_error = validate_pdf_upload(pdf_file)

            if pdf_error:
                return Response(
                    {
                        "success": False,
                        "message": pdf_error,
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

            # Overwrite previous PDF
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
                dc.status == DeliveryChallan.Status.CONFIRMED
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
            # 7. Advance DC number counter
            # ============================================================

            # Increment only on first confirmation.
            # Re-confirming must not consume another number.

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

    permission_classes = [
        IsAuthenticated,
        IsAccounts,
    ]

    # =========================
    # GET
    # =========================

    def get(self, request, pk=None):

        # GET /tax-invoice-customers/
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

        # GET /tax-invoice-customers/<id>/
        try:

            customer = Customer.objects.get(
                pk=pk,
            )

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
            )

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

            # Preserve the customer's original source.
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


# ==========================================================
# GET TAX INVOICE BY INVOICE NUMBER
# ==========================================================

class TaxInvoiceDetailAPIView(APIView):

    permission_classes = [IsAuthenticated, IsAccounts]

    def get(self, request, invoice_number):

        try:
            invoice = TaxInvoice.objects.get(
                invoice_number=invoice_number
            )

        except TaxInvoice.DoesNotExist:

            return Response(
                {
                    "success": False,
                    "message": "Tax invoice not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = TaxInvoiceSerializer(invoice)

        return Response(
            {
                "success": True,
                "message": "Tax invoice retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
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
            # 1. Session check (Admin / Accounts refresh cookie)
            # ============================================================

            refresh_token = None

            for department in ("admin", "accounts"):

                cookie_name = get_refresh_cookie_name(department)

                if not cookie_name:
                    continue

                token_value = request.COOKIES.get(cookie_name)

                if token_value:
                    refresh_token = token_value
                    break

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

                if not user_id:
                    return Response(
                        {
                            "success": False,
                            "message": "Invalid session. Please login again.",
                        },
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

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
            # 2. Admin / Accounts permission check
            # ============================================================

            allowed_user_types = {
                User.UserType.ADMIN,
                User.UserType.ACCOUNTS,
            }

            if user.user_type not in allowed_user_types:
                return Response(
                    {
                        "success": False,
                        "message": "Admin or Accounts access required.",
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

            pdf_error = validate_pdf_upload(pdf_file)

            if pdf_error:
                return Response(
                    {
                        "success": False,
                        "message": pdf_error,
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

            # Overwrite previous PDF
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
                invoice.status == TaxInvoice.Status.CONFIRMED
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
            # 7. Advance invoice number counter
            # ============================================================

            # Increment only on first confirmation.
            # Re-confirming must not consume another number.

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

#==========================================================
# PROFORMA INVOICE CUSTOMERS (GET / POST / PATCH)
# Shares the existing Customer master
# ==================================================================

class ProformaInvoiceCustomerAPIView(APIView):

    permission_classes = [
        IsAuthenticated,
        IsAccounts,
    ]

    # =========================
    # GET
    # =========================

    def get(self, request, pk=None):

        # GET /proforma-invoice-customers/
        if pk is None:

            customers = Customer.objects.all()

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
            )

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
            )

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

            # Preserve the customer's original source.
            customer = serializer.save()

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
# GET PROFORMA INVOICE DETAILS BY PROFORMA NUMBER
# ==================================================================

class ProformaInvoiceDetailAPIView(APIView):

    permission_classes = [IsAuthenticated, IsAccounts]

    def get(self, request, proforma_no):

        try:
            proforma = ProformaInvoice.objects.get(
                proforma_no=proforma_no
            )

        except ProformaInvoice.DoesNotExist:

            return Response(
                {
                    "success": False,
                    "message": "Proforma invoice not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ProformaInvoiceSerializer(proforma)

        return Response(
            {
                "success": True,
                "message": "Proforma invoice retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
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
            # 1. Session check (Admin / Accounts refresh cookie)
            # ============================================================

            refresh_token = None

            for department in ("admin", "accounts"):

                cookie_name = get_refresh_cookie_name(department)

                if not cookie_name:
                    continue

                token_value = request.COOKIES.get(cookie_name)

                if token_value:
                    refresh_token = token_value
                    break

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

                if not user_id:
                    return Response(
                        {
                            "success": False,
                            "message": "Invalid session. Please login again.",
                        },
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

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
            # 2. Admin / Accounts permission check
            # ============================================================

            allowed_user_types = {
                User.UserType.ADMIN,
                User.UserType.ACCOUNTS,
            }

            if user.user_type not in allowed_user_types:
                return Response(
                    {
                        "success": False,
                        "message": "Admin or Accounts access required.",
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

            pdf_error = validate_pdf_upload(pdf_file)

            if pdf_error:
                return Response(
                    {
                        "success": False,
                        "message": pdf_error,
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

            # Overwrite previous PDF
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
                proforma.status == ProformaInvoice.Status.CONFIRMED
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
            # 7. Advance proforma number counter
            # ============================================================

            # Increment only on first confirmation.
            # Re-confirming must not consume another number.

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

from decimal import Decimal

from django.db.models import Sum, Prefetch
from django.db.models.functions import Coalesce

@method_decorator(csrf_protect, name="dispatch")
class AccountsReportAPIView(APIView):
    """
    GET /erp/accounts-report/
    GET /erp/accounts-report/?type=PO

    PO received status is calculated from MaterialGRN.
    PO payment status remains separate.
    """

    permission_classes = [AllowAny]

    def get(self, request, document_type=None):

        # ============================================================
        # 1. SESSION CHECK - ADMIN OR ACCOUNTS
        # ============================================================

        refresh_token = None

        for department in ("admin", "accounts"):

            cookie_name = get_refresh_cookie_name(department)

            if cookie_name:
                token_value = request.COOKIES.get(cookie_name)

                if token_value:
                    refresh_token = token_value
                    break

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

            if not user_id:
                return Response(
                    {
                        "success": False,
                        "message": "Invalid authentication token.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

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
        # 2. ADMIN OR ACCOUNTS DEPARTMENT CHECK
        # ============================================================

        allowed_user_types = {
            User.UserType.ADMIN,
            User.UserType.ACCOUNTS,
        }

        if user.user_type not in allowed_user_types:
            return Response(
                {
                    "success": False,
                    "message": "Admin or Accounts access required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # ============================================================
        # 3. DOCUMENT TYPE FILTER
        # ============================================================

        type_filter = (
            document_type
            or request.query_params.get("type")
            or "ALL"
        ).upper()

        def want(short):
            return type_filter == "ALL" or type_filter == short

        rows = []

        # ============================================================
        # 4. PURCHASE ORDERS + MATERIAL GRN STATUS
        # ============================================================

        if want("PO"):

            purchase_orders = list(
                PurchaseOrder.objects.all().order_by("-created_at")
            )

            po_ids = [po.id for po in purchase_orders]

            po_items = (
                PurchaseOrderItem.objects
                .filter(purchase_order_id__in=po_ids)
                .prefetch_related(
                    Prefetch(
                        "material_grns",
                        queryset=MaterialGRN.objects.order_by("created_at"),
                    )
                )
            )

            items_by_po = {}

            for item in po_items:

                items_by_po.setdefault(
                    item.purchase_order_id,
                    [],
                ).append(item)

            for po in purchase_orders:

                ordered_total = Decimal("0.000")
                received_total = Decimal("0.000")

                grn_details = []

                po_line_items = items_by_po.get(po.id, [])

                # ====================================================
                # 4.1 GRN DETAILS
                # ====================================================

                for item in po_line_items:

                    ordered_qty = Decimal(str(item.quantity or 0))

                    grn_records = list(item.material_grns.all())

                    received_qty = sum(
                        (
                            Decimal(str(grn.received_qty or 0))
                            for grn in grn_records
                        ),
                        Decimal("0.000"),
                    )

                    remaining_qty = max(
                        ordered_qty - received_qty,
                        Decimal("0.000"),
                    )

                    ordered_total += ordered_qty
                    received_total += received_qty

                    item_status = self.get_received_status(
                        ordered_qty,
                        received_qty,
                    )

                    grn_details.append(
                        {
                            "purchase_order_item_id": item.id,

                            "material": (
                                grn_records[0].material
                                if grn_records
                                else item.material
                            ),

                            "description": (
                                grn_records[0].description
                                if grn_records
                                else item.description
                            ),

                            "ordered_qty": float(ordered_qty),
                            "received_qty": float(received_qty),
                            "remaining_qty": float(remaining_qty),

                            "status": item_status,

                            "grn_numbers": [
                                grn.grn_number
                                for grn in grn_records
                            ],

                            "grn_records": [
                                {
                                    "grn_number": grn.grn_number,
                                    "grn_date": _iso(grn.grn_date),

                                    "received_qty": float(
                                        grn.received_qty or 0
                                    ),

                                    "receiving_unit": grn.receiving_unit,
                                    "received_by": grn.received_by,
                                    "remarks": grn.remarks,
                                }
                                for grn in grn_records
                            ],
                        }
                    )

                # ====================================================
                # 4.2 OVERALL GRN STATUS
                # ====================================================

                received_status = self.get_received_status(
                    ordered_total,
                    received_total,
                )

                remaining_total = max(
                    ordered_total - received_total,
                    Decimal("0.000"),
                )

                # ====================================================
                # 4.3 PURCHASE ORDER DOCUMENT DATA
                # ====================================================

                saved_document_data = (
                    po.document_data
                    if isinstance(po.document_data, dict)
                    else {}
                )

                # Start with document_data to preserve custom fields.
                doc_data = {
                    **saved_document_data,
                }

                # Actual PurchaseOrder database fields override
                # potentially stale document_data values.
                model_document_data = {
                    "poNumber": po.po_number,
                    "poDate": _iso(po.po_date),

                    "refQuoteNumber": po.ref_quote_number,
                    "refDate": _iso(po.ref_date),

                    "subject": po.subject,
                    "preparedBy": po.prepared_by,

                    "vendor": po.vendor or {},
                    "introText": po.intro_text,

                    "items": po.items or [],
                    "columns": po.columns or [],

                    "includeAmountDetails": po.include_amount_details,

                    "subtotal": float(po.subtotal or 0),
                    "gstPercent": float(po.gst_percent or 0),
                    "gstAmount": float(po.gst_amount or 0),
                    "grandTotal": float(po.grand_total or 0),

                    "delivery": po.delivery or {},
                    "payment": po.payment or {},

                    "terms": po.terms or [],
                    "notes": po.notes or "",

                    "signatures": po.signatures or {},
                }

                # IMPORTANT:
                # Model values have priority over saved document_data.
                doc_data.update(model_document_data)

                # Always use the actual database PO number.
                doc_data["poNumber"] = po.po_number

                # ====================================================
                # 4.4 SNAKE_CASE COMPATIBILITY
                # ====================================================

                aliases = {
                    "po_number": "poNumber",
                    "po_date": "poDate",

                    "ref_quote_number": "refQuoteNumber",
                    "ref_date": "refDate",

                    "prepared_by": "preparedBy",
                    "intro_text": "introText",

                    "gst_percent": "gstPercent",
                    "gst_amount": "gstAmount",
                    "grand_total": "grandTotal",

                    "include_amount_details": "includeAmountDetails",
                }

                for snake_key, camel_key in aliases.items():

                    if camel_key in doc_data:
                        doc_data[snake_key] = doc_data[camel_key]

                # ====================================================
                # 4.5 APPEND PO REPORT ROW
                # ====================================================

                rows.append(
                    {
                        "id": f"PO-{po.id}",

                        "type": "Purchase Order",
                        "short": "PO",

                        "document_number": po.po_number,

                        "payment_status": po.payment_status or "Pending",
                        "delivery_status": po.delivery_status or "Pending",

                        "received_status": received_status,

                        "grn_summary": {
                            "ordered_qty": float(ordered_total),
                            "received_qty": float(received_total),
                            "remaining_qty": float(remaining_total),
                        },

                        "grn_details": grn_details,

                        "path": "/accounts/po",

                        "document_data": doc_data,
                    }
                )

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

                rows.append(
                    {
                        "id": f"QO-{qo.id}",

                        "type": "Quotation",
                        "short": "QO",

                        "document_number": qo.quotation_number,

                        "payment_status": qo.payment_status or "Pending",
                        "delivery_status": qo.delivery_status or "Pending",

                        "path": "/accounts/qo",

                        "document_data": doc_data,
                    }
                )

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

                rows.append(
                    {
                        "id": f"DC-{dc.id}",

                        "type": "Delivery Challan",
                        "short": "DC",

                        "document_number": dc.dc_number,

                        "payment_status": dc.payment_status or "N/A",
                        "delivery_status": dc.delivery_status or "Delivered",

                        "path": "/accounts/DeliveryChallan",

                        "document_data": doc_data,
                    }
                )

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

                rows.append(
                    {
                        "id": f"TI-{ti.id}",

                        "type": "Tax Invoice",
                        "short": "TI",

                        "document_number": ti.invoice_number,

                        "payment_status": ti.payment_status or "Pending",
                        "delivery_status": ti.delivery_status or "Pending",

                        "path": "/accounts/TaxInvoice",

                        "document_data": doc_data,
                    }
                )

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

                rows.append(
                    {
                        "id": f"PI-{pi.id}",

                        "type": "Proforma Invoice",
                        "short": "PI",

                        "document_number": pi.proforma_no,

                        "payment_status": pi.payment_status or "Pending",
                        "delivery_status": pi.delivery_status or "Pending",

                        "path": "/accounts/ProformaInvoice",

                        "document_data": doc_data,
                    }
                )

        # ============================================================
        # 9. GLOBAL NEWEST-FIRST ORDERING
        # ============================================================

        rows.sort(
            key=lambda r: r["document_number"],
            reverse=True,
        )

        # ============================================================
        # 10. SERIALIZE + RETURN
        # ============================================================

        serializer = AccountsReportRowSerializer(
            rows,
            many=True,
        )

        return Response(
            {
                "success": True,
                "count": len(rows),
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    # ================================================================
    # GRN RECEIVED STATUS CALCULATION
    # ================================================================

    @staticmethod
    def get_received_status(ordered_qty, received_qty):

        ordered_qty = Decimal(str(ordered_qty or 0))
        received_qty = Decimal(str(received_qty or 0))

        if received_qty <= 0:
            return "Pending"

        if ordered_qty > 0 and received_qty < ordered_qty:
            return "Partially Received"

        if ordered_qty > 0 and received_qty >= ordered_qty:
            return "Fully Received"

        return "Pending"





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
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

class AccountsReportStatusAPIView(APIView):

    def patch(self, request, short, pk):
        # --------------------------------------------------
        # 1. AUTHENTICATION
        # --------------------------------------------------
        refresh_cookie_name = get_refresh_cookie_name("accounts")
        refresh_token = request.COOKIES.get(refresh_cookie_name)

        if not refresh_token:
            return Response(
                {"detail": "Authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            token = RefreshToken(refresh_token)
            user_id = token.get("user_id")

            if not user_id:
                return Response(
                    {"detail": "Invalid authentication token."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            user = User.objects.get(id=user_id)

            if getattr(user, "user_type", None) != "accounts":
                return Response(
                    {
                        "detail": (
                            "You do not have permission to update "
                            "accounts reports."
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        except (User.DoesNotExist, TokenError, InvalidToken):
            return Response(
                {"detail": "Invalid or expired authentication token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # --------------------------------------------------
        # 2. VALIDATE DOCUMENT TYPE
        # --------------------------------------------------
        short_type = str(short).upper()

        model_map = {
            "PO": PurchaseOrder,
            "QO": Quotation,
            "DC": DeliveryChallan,
            "TI": TaxInvoice,
            "PI": ProformaInvoice,
        }

        if short_type not in model_map:
            return Response(
                {"detail": "Invalid document type."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # IMPORTANT: Use Model consistently throughout this method.
        Model = model_map[short_type]

        # --------------------------------------------------
        # 3. DOCUMENT NUMBER FIELDS
        # --------------------------------------------------
        document_number_fields = {
            "PO": "po_number",
            "QO": "quotation_number",
            "DC": "dc_number",
            "TI": "invoice_number",
            "PI": "proforma_no",
        }

        # --------------------------------------------------
        # 4. PAYMENT CONFIGURATION
        # --------------------------------------------------
        payment_direction_map = {
            "PO": PaymentRecord.PaymentDirection.OUTGOING,
            "PI": PaymentRecord.PaymentDirection.INCOMING,
            "TI": PaymentRecord.PaymentDirection.INCOMING,
        }

        # --------------------------------------------------
        # 5. VALIDATE REQUEST DATA
        # --------------------------------------------------
        serializer = StatusUpdateSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_payment_status = serializer.validated_data.get(
            "payment_status"
        )

        new_delivery_status = serializer.validated_data.get(
            "delivery_status"
        )

        # --------------------------------------------------
        # 6. UPDATE DOCUMENT AND CREATE PAYMENT RECORD
        # --------------------------------------------------
        with transaction.atomic():

            try:
                # FIX: Use Model, not model.
                obj = Model.objects.select_for_update().get(pk=pk)

            except Model.DoesNotExist:
                return Response(
                    {"detail": "Document not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # --------------------------------------------------
            # 7. GET CURRENT STATUS VALUES
            # --------------------------------------------------
            old_payment_status = str(
                getattr(obj, "payment_status", "")
            ).strip().upper()

            old_delivery_status = str(
                getattr(obj, "delivery_status", "")
            ).strip().upper()

            requested_payment_status = (
                str(new_payment_status).strip().upper()
                if new_payment_status is not None
                else old_payment_status
            )

            requested_delivery_status = (
                str(new_delivery_status).strip().upper()
                if new_delivery_status is not None
                else old_delivery_status
            )

            # --------------------------------------------------
            # 8. PREVENT UPDATES TO COMPLETED DOCUMENTS
            # --------------------------------------------------
            if (
                old_payment_status == "PAID"
                and old_delivery_status == "DELIVERED"
            ):
                return Response(
                    {
                        "detail": (
                            "This document is locked because payment "
                            "is Paid and delivery is Delivered."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payment_record_data = None

            # --------------------------------------------------
            # 9. CREATE PAYMENT RECORD ON FIRST PAID TRANSITION
            # --------------------------------------------------
            if (
                old_payment_status != "PAID"
                and requested_payment_status == "PAID"
                and short_type in payment_direction_map
            ):

                number_field = document_number_fields[short_type]

                document_number = getattr(
                    obj,
                    number_field,
                    None,
                )

                if not document_number:
                    return Response(
                        {
                            "detail": (
                                f"Document number is missing for "
                                f"{short_type}."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                raw_amount = getattr(
                    obj,
                    "grand_total",
                    None,
                )

                if raw_amount is None:
                    return Response(
                        {
                            "detail": (
                                f"Grand total is missing for "
                                f"{short_type}."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Validate payment amount.
                try:
                    paid_amount = Decimal(str(raw_amount))

                except (InvalidOperation, TypeError, ValueError):
                    return Response(
                        {"detail": "Invalid document grand total."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if not paid_amount.is_finite() or paid_amount <= 0:
                    return Response(
                        {
                            "detail": (
                                "Payment amount must be greater than zero."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Create payment record.
                payment_record = PaymentRecord.objects.create(
                    document_type=short_type,
                    document_number=str(document_number),
                    payment_direction=payment_direction_map[short_type],
                    paid_amount=paid_amount,
                    paid_date=timezone.localdate(),
                )

                payment_record_data = {
                    "id": payment_record.pk,
                    "document_type": payment_record.document_type,
                    "document_number": payment_record.document_number,
                    "payment_direction": payment_record.payment_direction,
                    "paid_amount": str(payment_record.paid_amount),
                    "paid_date": str(payment_record.paid_date),
                }

            # --------------------------------------------------
            # 10. UPDATE DOCUMENT STATUSES
            # --------------------------------------------------
            if new_payment_status is not None:
                obj.payment_status = new_payment_status

            if new_delivery_status is not None:
                obj.delivery_status = new_delivery_status

            obj.save()

            # --------------------------------------------------
            # 11. SUCCESS RESPONSE
            # --------------------------------------------------
            return Response(
                    {
                        "success": True,
                        "data": {
                            "detail": "Document status updated successfully.",
                            "document_type": short_type,
                            "document_id": obj.pk,
                            "payment_status": getattr(
                                obj,
                                "payment_status",
                                None,
                            ),
                            "delivery_status": getattr(
                                obj,
                                "delivery_status",
                                None,
                            ),
                            "payment_record": payment_record_data,
                        },
                    },
                    status=status.HTTP_200_OK,
                )

#for expense

from decimal import Decimal

from .models import JournalEntry
from .serializers import JournalEntrySerializer


def _generate_journal_number(entry_type):
   
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
from decimal import Decimal

from django.db import models
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated


@method_decorator(csrf_protect, name="dispatch")
class JournalAPIView(APIView):

    permission_classes = [IsAuthenticated, IsAccounts]

    # ======================================================
    # GET — JOURNAL ENTRIES
    # ======================================================
    def get(self, request):

        today = timezone.localdate()

        # --------------------------------------------------
        # 1. VALIDATE MONTH AND YEAR
        # --------------------------------------------------
        try:
            month = int(
                request.query_params.get("month", today.month)
            )

            year = int(
                request.query_params.get("year", today.year)
            )

            if not 1 <= month <= 12 or year < 1:
                raise ValueError

        except (TypeError, ValueError):

            return Response(
                {
                    "success": False,
                    "message": "Invalid month or year.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        entry_type = request.query_params.get("type")
        payment_mode = request.query_params.get("payment_mode")

        if entry_type and entry_type not in ("Expense", "Income"):

            return Response(
                {
                    "success": False,
                    "message": "Type must be Expense or Income.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        month_name = timezone.datetime(
            year, month, 1
        ).strftime("%B")

        # --------------------------------------------------
        # 2. JOURNAL ENTRIES FOR SELECTED MONTH
        # --------------------------------------------------
        journal_qs = JournalEntry.objects.filter(
            date__year=year,
            date__month=month,
        )

        if entry_type:
            journal_qs = journal_qs.filter(
                type=entry_type
            )

        if payment_mode:
            journal_qs = journal_qs.filter(
                payment_mode=payment_mode
            )

        journal_qs = journal_qs.order_by(
            "-date",
            "-created_at",
        )

        journal_data = list(
            JournalEntrySerializer(
                journal_qs,
                many=True,
            ).data
        )

        for row in journal_data:
            row.setdefault(
                "source_type",
                "JournalEntry",
            )

        # --------------------------------------------------
        # 3. ADVANCES — GROUP BY DATE
        # --------------------------------------------------
        advance_qs = Advance.objects.filter(
            advance_date__year=year,
            advance_date__month=month,
        )

        # Advances are expenses.
        if entry_type == "Income":
            advance_qs = advance_qs.none()

        # Advance does not have a payment_mode field.
        if payment_mode:
            advance_qs = advance_qs.none()

        # Group all advances occurring on the same date.
        advance_groups = (
            advance_qs
            .values("advance_date")
            .annotate(
                total_amount=models.Sum("amount"),
                transaction_count=models.Count("id"),
            )
            .order_by("-advance_date")
        )

        advance_data = []

        for group in advance_groups:

            advance_date = group["advance_date"]

            amount = (
                group["total_amount"]
                or Decimal("0.00")
            )

            advance_data.append(
                {
                    "id": f"advance-{advance_date}",
                    "record_number": f"ADV-{advance_date}",
                    "date": advance_date.isoformat(),
                    "type": "Expense",
                    "category": "Advance",
                    "description": "Total Employee Advance",
                    "amount": float(amount),
                    "payment_mode": "Advance",
                    "source_type": "AdvanceGroup",
                    "source_id": None,
                    "transaction_count": group[
                        "transaction_count"
                    ],
                }
            )

        # --------------------------------------------------
        # 4. PAYMENT RECORDS
        # --------------------------------------------------
        payment_qs = PaymentRecord.objects.filter(
            paid_date__year=year,
            paid_date__month=month,
        )

        if entry_type == "Expense":

            payment_qs = payment_qs.filter(
                payment_direction=(
                    PaymentRecord.PaymentDirection.OUTGOING
                )
            )

        elif entry_type == "Income":

            payment_qs = payment_qs.filter(
                payment_direction=(
                    PaymentRecord.PaymentDirection.INCOMING
                )
            )

        if payment_mode:
            payment_qs = payment_qs.filter(
                payment_mode=payment_mode
            )

        # --------------------------------------------------
        # 5. GROUP PAYMENT RECORDS
        # --------------------------------------------------
        payment_groups = (
            payment_qs
            .values(
                "document_type",
                "payment_direction",
            )
            .annotate(
                total_amount=models.Sum("paid_amount"),
                transaction_count=models.Count("id"),
            )
            .order_by(
                "document_type",
                "payment_direction",
            )
        )

        payment_data = []

        for group in payment_groups:

            document_type = group["document_type"]
            direction = group["payment_direction"]

            is_expense = (
                direction
                == PaymentRecord.PaymentDirection.OUTGOING
            )

            amount = (
                group["total_amount"]
                or Decimal("0.00")
            )

            payment_data.append(
                {
                    "id": f"{document_type}-{direction}",
                    "record_number": f"{document_type}-TOTAL",
                    "date": f"{year}-{month:02d}-01",
                    "type": (
                        "Expense" if is_expense else "Income"
                    ),
                    "category": document_type,
                    "description": (
                        f"Total {document_type} "
                        f"{'Outgoing' if is_expense else 'Incoming'} "
                        f"Payments for {month_name} {year}"
                    ),
                    "amount": float(amount),
                    "payment_mode": "Grouped Payments",
                    "document_type": document_type,
                    "payment_direction": direction,
                    "transaction_count": group[
                        "transaction_count"
                    ],
                    "source_type": "PaymentRecordGroup",
                    "source_id": None,
                    "purchase_order": None,
                    "po_number": "",
                }
            )

        # --------------------------------------------------
        # 6. COMBINE ALL DATA
        # --------------------------------------------------
        combined_data = (
            journal_data
            + advance_data
            + payment_data
        )

        combined_data.sort(
            key=lambda row: row.get("date", ""),
            reverse=True,
        )

        # --------------------------------------------------
        # 7. JOURNAL INCOME — SELECTED MONTH
        # --------------------------------------------------
        journal_income = (
            JournalEntry.objects.filter(
                type=JournalEntry.EntryType.INCOME,
                date__year=year,
                date__month=month,
            ).aggregate(
                total=models.Sum("amount")
            )["total"]
            or Decimal("0.00")
        )

        # --------------------------------------------------
        # 8. JOURNAL EXPENSE — SELECTED MONTH
        # --------------------------------------------------
        total_journal_expense = (
            JournalEntry.objects.filter(
                type=JournalEntry.EntryType.EXPENSE,
                date__year=year,
                date__month=month,
            ).aggregate(
                total=models.Sum("amount")
            )["total"]
            or Decimal("0.00")
        )

        # --------------------------------------------------
        # 9. SALARY — SELECTED MONTH
        # --------------------------------------------------
        total_salary = (
            SalaryPayment.objects.filter(
                salary_month__year=year,
                salary_month__month=month,
            ).aggregate(
                total=models.Sum("net_salary")
            )["total"]
            or Decimal("0.00")
        )

        # --------------------------------------------------
        # 10. ADVANCE — SELECTED MONTH
        # Used for monthly expense calculation.
        # --------------------------------------------------
        monthly_advance = (
            Advance.objects.filter(
                advance_date__year=year,
                advance_date__month=month,
            ).aggregate(
                total=models.Sum("amount")
            )["total"]
            or Decimal("0.00")
        )

        # --------------------------------------------------
        # 11. CUMULATIVE ADVANCE — ALL PREVIOUS DATES
        # Used for the cumulative advance summary card.
        # --------------------------------------------------
        total_advance = (
            Advance.objects.filter(
                advance_date__lte=today,
            ).aggregate(
                total=models.Sum("amount")
            )["total"]
            or Decimal("0.00")
        )

        # --------------------------------------------------
        # 12. INCOMING PAYMENTS — SELECTED MONTH
        # --------------------------------------------------
        total_incoming_payments = (
            PaymentRecord.objects.filter(
                paid_date__year=year,
                paid_date__month=month,
                payment_direction=(
                    PaymentRecord.PaymentDirection.INCOMING
                ),
            ).aggregate(
                total=models.Sum("paid_amount")
            )["total"]
            or Decimal("0.00")
        )

        # --------------------------------------------------
        # 13. OUTGOING PAYMENTS — SELECTED MONTH
        # --------------------------------------------------
        total_outgoing_payments = (
            PaymentRecord.objects.filter(
                paid_date__year=year,
                paid_date__month=month,
                payment_direction=(
                    PaymentRecord.PaymentDirection.OUTGOING
                ),
            ).aggregate(
                total=models.Sum("paid_amount")
            )["total"]
            or Decimal("0.00")
        )

        # --------------------------------------------------
        # 14. TOTAL INCOME
        # --------------------------------------------------
        total_income = (
            journal_income
            + total_incoming_payments
        )

        # --------------------------------------------------
        # 15. TOTAL EXPENSE — SELECTED MONTH
        # --------------------------------------------------
        total_expense = (
            total_journal_expense
            + total_salary
            + monthly_advance
            + total_outgoing_payments
        )

        # --------------------------------------------------
        # 16. PROFIT / LOSS
        # --------------------------------------------------
        net_profit = (
            total_income - total_expense
        )

        # --------------------------------------------------
        # 17. RESPONSE
        # --------------------------------------------------
        return Response(
            {
                "success": True,

                "count": len(combined_data),

                "data": combined_data,

                "payment_groups": payment_data,

                "totals": {
                    "total_income": float(total_income),

                    "total_expense": float(total_expense),

                    "net_profit": float(net_profit),

                    "total_salary": float(total_salary),

                    # Cumulative advance for summary card
                    "total_advance": float(total_advance),

                    # Selected-month advance for expense calculation
                    "monthly_advance": float(monthly_advance),

                    "total_journal_income": float(
                        journal_income
                    ),

                    "total_journal_expense": float(
                        total_journal_expense
                    ),

                    "total_incoming_payments": float(
                        total_incoming_payments
                    ),

                    "total_outgoing_payments": float(
                        total_outgoing_payments
                    ),
                },

                "current_month": {
                    "month": month,
                    "year": year,
                    "month_name": month_name,
                },
            },
            status=status.HTTP_200_OK,
        )

    # ======================================================
    # POST — CREATE JOURNAL ENTRY
    # ======================================================
    def post(self, request):

        serializer = JournalEntrySerializer(
            data=request.data
        )

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

        entry_type = validated.get(
            "type",
            JournalEntry.EntryType.EXPENSE,
        )

        record_number = _generate_journal_number(
            entry_type
        )

        entry = JournalEntry.objects.create(
            record_number=record_number,
            **validated,
        )

        return Response(
            {
                "success": True,
                "message": "Journal entry created successfully.",
                "data": JournalEntrySerializer(entry).data,
            },
            status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_protect, name="dispatch")
class JournalDetailAPIView(APIView):
    """
    PATCH  /erp/journal/<pk>/  → Update a journal entry.
    DELETE /erp/journal/<pk>/  → Delete a journal entry.
    """

    permission_classes = [IsAuthenticated, IsAccounts]

    # ======================================================
    # PATCH — UPDATE JOURNAL ENTRY
    # ======================================================
    def patch(self, request, pk):
        try:
            entry = JournalEntry.objects.get(pk=pk)

        except JournalEntry.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "message": "Journal entry not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = JournalEntrySerializer(
            entry,
            data=request.data,
            partial=True,
        )

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": "Invalid journal entry.",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated_entry = serializer.save()

        return Response(
            {
                "success": True,
                "message": "Journal entry updated successfully.",
                "data": JournalEntrySerializer(
                    updated_entry
                ).data,
            },
            status=status.HTTP_200_OK,
        )

    # ======================================================
    # DELETE — DELETE JOURNAL ENTRY
    # ======================================================
    def delete(self, request, pk):
        try:
            entry = JournalEntry.objects.get(pk=pk)

        except JournalEntry.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "message": "Journal entry not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        entry.delete()

        return Response(
            {
                "success": True,
                "message": "Journal entry deleted successfully.",
            },
            status=status.HTTP_200_OK,
        )
# ============================================================
# JOURNAL — PURCHASE ORDER SEARCH (for the "Related PO" dropdown)
# ------------------------------------------------------------
# GET /erp/journal/po-options/?search=<text>&limit=50
# ============================================================

from django.db.models import Q
from .models import PurchaseOrder
from .serializers import JournalPOOptionSerializer


class JournalPOOptionsAPIView(APIView):
    """
    Returns a compact list of confirmed Purchase Orders for the
    'Related PO' search dropdown on the Add Transaction modal.

    Query params:
        search  — matches po_number or vendor.companyName (contains)
        limit   — max rows (default 50, hard cap 200)

    Only confirmed POs are returned — draft/previewed/cancelled
    POs should not be selectable for financial linkage.
    """

    permission_classes = [IsAuthenticated, IsAccounts]

    def _get_user(self, request):
        cookie_name = get_refresh_cookie_name("accounts")

        if not cookie_name:
            return Response(
                {
                    "success": False,
                    "message": "Accounts refresh-cookie configuration is missing.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        refresh_token = request.COOKIES.get(cookie_name)

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

    def get(self, request):
        user, err = self._get_user(request)
        if err:
            return err

        search = (request.query_params.get("search") or "").strip()

        try:
            limit = int(request.query_params.get("limit", 50))
        except (TypeError, ValueError):
            limit = 50
        limit = max(1, min(limit, 200))

        qs = (
            PurchaseOrder.objects
            .filter(status=PurchaseOrder.Status.CONFIRMED)
            .order_by("-created_at")
        )

        if search:
            # po_number OR vendor.companyName (vendor is a JSONField,
            # so we filter on the stringified representation).
            qs = qs.filter(
                Q(po_number__icontains=search)
                | Q(vendor__icontains=search)
            )

        qs = qs[:limit]

        serializer = JournalPOOptionSerializer(qs, many=True)

        return Response(
            {
                "success": True,
                "count": len(serializer.data),
                "data": serializer.data,
            },
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

from .models import Employee, EmployeeCodeSettings
from .permissions import IsHR, IsHROrMaterialPlanning
from .serializers import (
    EmployeeArchiveSerializer,
    EmployeeSerializer,
)


# ============================================================
# EMPLOYEE LIST + CREATE

class EmployeeListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsHR]

    # --------------------------------------------------------
    # GET /erp/hr/employees/
    # --------------------------------------------------------
    def get(self, request):
        qs = Employee.objects.all()

        archived = request.query_params.get("archived")
        if archived is not None:
            qs = qs.filter(
                archived=archived.lower() in ("1", "true", "yes")
            )

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

        skills = _multi("skills")
        qs = list(qs)

        if skills:
            qs = [
                e for e in qs
                if any(s in (e.skills or []) for s in skills)
            ]

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

        # Never accept employee IDs from frontend.
        payload = request.data.copy()

        payload.pop("employee_id", None)
        payload.pop("employee_code", None)
        payload.pop("employeeId", None)
        payload.pop("employeeCode", None)

        serializer = EmployeeSerializer(data=payload)

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

            config = (
                EmployeeCodeSettings.objects
                .select_for_update()
                .filter(is_active=True)
                .order_by("pk")
                .first()
            )

            if config is None:
                config = EmployeeCodeSettings.objects.create(
                    prefix="MEI",
                    next_number=1,
                    number_padding=3,
                    is_active=True,
                )

            number = config.next_number

            # Avoid duplicate employee IDs.
            while True:

                code = (
                    f"{config.prefix}"
                    f"{number:0{config.number_padding}d}"
                )

                if not Employee.objects.filter(
                    Q(employee_id__iexact=code)
                    | Q(employee_code__iexact=code)
                ).exists():
                    break

                number += 1

            # Save SAME generated code in both columns.
            employee = serializer.save(
                employee_id=code,
                employee_code=code,
                created_by=request.user,
            )

            config.next_number = number + 1

            config.save(
                update_fields=[
                    "next_number",
                    "updated_at",
                ]
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

        payload = request.data.copy()
        payload.pop("employee_id", None)
        payload.pop("employee_code", None)
        payload.pop("employeeId", None)
        serializer = EmployeeSerializer(
            emp, data=payload, partial=True
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

    
    def delete(self, request, pk):
        emp = self._get(pk)

        if not emp:
            return Response(
                {
                    "success": False,
                    "message": "Employee not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if emp.archived:
            return Response(
                {
                    "success": False,
                    "message": "Employee is already archived.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        emp.archived = True
        emp.save(update_fields=["archived"])

        return Response(
            {
                "success": True,
                "message": "Employee archived successfully.",
                "data": EmployeeSerializer(emp).data,
            },
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


# ============================================================
# EMPLOYEE ID PREVIEW (does not reserve the ID)
# GET /erp/hr/employees/next-code/
# ============================================================
class EmployeeCodePreviewAPIView(APIView):
    permission_classes = [IsAuthenticated, IsHR]

    def get(self, request):
        config = (EmployeeCodeSettings.objects.filter(is_active=True)
                  .order_by("pk").first())
        if config is None:
            with transaction.atomic():
                config = (EmployeeCodeSettings.objects.select_for_update()
                          .filter(is_active=True).order_by("pk").first())
                if config is None:
                    config = EmployeeCodeSettings.objects.create(
                        prefix="EMP", next_number=1,
                        number_padding=3, is_active=True,
                    )
        number = config.next_number
        while Employee.objects.filter(
            employee_id=f"{config.prefix}{number:0{config.number_padding}d}"
        ).exists():
            number += 1
        return Response({
            "success": True,
            "data": {
                "employee_id": f"{config.prefix}{number:0{config.number_padding}d}",
                "prefix": config.prefix,
                "next_number": number,
                "number_padding": config.number_padding,
            },
        })


# ============================================================
# EMPLOYEE ID SETTINGS
# GET /erp/hr/employees/code-settings/
# PATCH /erp/hr/employees/code-settings/
# ============================================================
class EmployeeCodeSettingsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsHR]

    def get(self, request):
        config = (EmployeeCodeSettings.objects.filter(is_active=True)
                  .order_by("pk").first())
        if config is None:
            with transaction.atomic():
                config = (EmployeeCodeSettings.objects.select_for_update()
                          .filter(is_active=True).order_by("pk").first())
                if config is None:
                    config = EmployeeCodeSettings.objects.create(
                        prefix="EMP", next_number=1,
                        number_padding=3, is_active=True,
                    )
        return Response({
            "success": True,
            "data": {
                "prefix": config.prefix,
                "next_number": config.next_number,
                "number_padding": config.number_padding,
                "is_active": config.is_active,
            },
        })

    def patch(self, request):
        prefix = request.data.get("prefix", "MEI")
        padding = request.data.get("number_padding", 3)
        next_number = request.data.get("next_number", 1)
        if not isinstance(prefix, str) or not prefix.strip() or len(prefix.strip()) > 20:
            return Response({"success": False, "message": "Prefix must be 1–20 characters."},
                            status=status.HTTP_400_BAD_REQUEST)
        prefix = prefix.strip().upper()
        try:
            padding = int(padding)
            next_number = int(next_number)
        except (ValueError, TypeError):
            return Response({"success": False, "message": "Digits and start number must be integers."},
                            status=status.HTTP_400_BAD_REQUEST)
        if not 1 <= padding <= 12 or next_number < 1:
            return Response({"success": False,
                             "message": "Digits must be 1–12 and start number at least 1."},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Lock the active settings row before changing its sequence.
            config = (EmployeeCodeSettings.objects.select_for_update()
                      .filter(is_active=True).order_by("pk").first())
            if config is None:
                config = EmployeeCodeSettings.objects.create(
                    prefix=prefix, number_padding=padding,
                    next_number=next_number, is_active=True,
                )
            else:
                config.prefix = prefix
                config.number_padding = padding
                config.next_number = next_number
                config.save(update_fields=["prefix", "number_padding",
                                           "next_number", "updated_at"])
        return Response({
            "success": True,
            "message": "Employee ID settings saved.",
            "data": {
                "prefix": config.prefix,
                "next_number": config.next_number,
                "number_padding": config.number_padding,
            },
        })



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

from django.db.models import Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination

from .models import Employee
from .serializers import AttendanceEmployeeSerializer


class AttendanceEmployeeView(APIView):
    permission_classes = [IsAuthenticated, IsHR]

    def get(self, request):
        queryset = Employee.objects.filter(
            archived=False,
            employment_status="Active",
        )

        search = request.query_params.get("search", "").strip()
        department = request.query_params.get("department", "").strip()
        branch = request.query_params.get("branch", "").strip()
        employment_type = request.query_params.get(
            "employment_type", ""
        ).strip()
        work_location = request.query_params.get(
            "work_location", ""
        ).strip()

        if search:
            queryset = queryset.filter(
                Q(employee_id__icontains=search)
                | Q(employee_code__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(mobile__icontains=search)
                | Q(email__icontains=search)
            )

        if department:
            queryset = queryset.filter(
                department__iexact=department
            )

        if branch:
            queryset = queryset.filter(
                branch__icontains=branch
            )

        if employment_type:
            queryset = queryset.filter(
                employment_type__iexact=employment_type
            )

        if work_location:
            queryset = queryset.filter(
                work_location__icontains=work_location
            )

        queryset = queryset.order_by("employee_id")

        paginator = EmployeePagination()
        page = paginator.paginate_queryset(
            queryset, request, view=self
        )

        serializer = AttendanceEmployeeSerializer(
            page,
            many=True,
            context={"request": request},
        )

        return paginator.get_paginated_response(
            serializer.data
        )


# ============================================================
# ATTENDANCE VIEWSET
# ============================================================

# ============================================================
# ATTENDANCE VIEWSET
# ============================================================

from datetime import date, datetime, timedelta
from decimal import Decimal

from django.core.paginator import Paginator
from django.db import IntegrityError, transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
import uuid

from .serializers import (
    AttendanceSerializer,
    OvernightAttendanceSerializer,
    payroll_snapshot,
)

from .services import WORKED_STATUSES
from .models import Attendance, Employee
from .serializers import AttendanceSerializer
# from .permissions import IsHR                 <- keep your existing import
# from .pagination import AttendancePagination  <- keep your existing import


DUPLICATE_MESSAGE = "Attendance already exists for this employee and date."
ZERO = Decimal("0.00")


# ============================================================
# MODULE HELPERS
# ============================================================

def parse_iso_date(value, field="date"):
    value = (value or "").strip()
    if not value:
        raise ValidationError({"detail": f"{field} is required. Use YYYY-MM-DD."})
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise ValidationError({"detail": f"Invalid {field}. Use YYYY-MM-DD."})


def positive_int(value, default, maximum=None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    if number < 1:
        return default
    return min(number, maximum) if maximum else number


def resolve_period(params):
    """
    Returns (period, start_date, end_date, label) for
      period=weekly  &date=YYYY-MM-DD   (Monday-Sunday containing the date)
      period=monthly &month=YYYY-MM
      period=yearly  &year=YYYY
    Defaults to the current week / month / year when the value is omitted.
    """
    period = (params.get("period") or "monthly").strip().lower()
    today = timezone.localdate()

    if period == "weekly":
        raw = (params.get("date") or "").strip()
        selected = parse_iso_date(raw) if raw else today
        start = selected - timedelta(days=selected.weekday())      # Monday
        end = start + timedelta(days=6)                            # Sunday
        label = f"{start:%d/%m/%Y} – {end:%d/%m/%Y}"

    elif period == "monthly":
        raw = (params.get("month") or "").strip() or today.strftime("%Y-%m")
        try:
            first = datetime.strptime(raw, "%Y-%m").date()
        except ValueError:
            raise ValidationError({"detail": "Invalid month. Use YYYY-MM."})
        next_first = (
            date(first.year + 1, 1, 1)
            if first.month == 12
            else date(first.year, first.month + 1, 1)
        )
        start = first
        end = next_first - timedelta(days=1)
        label = first.strftime("%B %Y")

    elif period == "yearly":
        raw = (params.get("year") or "").strip() or str(today.year)
        if not raw.isdigit() or not (1900 <= int(raw) <= 2200):
            raise ValidationError({"detail": "Invalid year. Use YYYY."})
        year = int(raw)
        start = date(year, 1, 1)
        end = date(year, 12, 31)
        label = str(year)

    else:
        raise ValidationError(
            {"detail": "Invalid period. Use weekly, monthly or yearly."}
        )

    return period, start, end, label


def active_employees():
    return Employee.objects.filter(archived=False, employment_status="Active")


def filter_employees(queryset, params):
    """Employee ID / name search (every word must match) + optional filters."""
    search = (params.get("search") or "").strip()
    for token in search.split():
        queryset = queryset.filter(
            Q(employee_id__icontains=token)
            | Q(first_name__icontains=token)
            | Q(last_name__icontains=token)
        )

    for field in ("department", "branch", "employment_type", "work_location"):
        value = (params.get(field) or "").strip()
        if value:
            queryset = queryset.filter(**{field: value})

    return queryset


def fmt_time(value):
    return value.strftime("%H:%M") if value else None


def to_float(value):
    return float(value or 0)





# ============================================================
# VIEWSET
# ============================================================

class AttendanceViewSet(ModelViewSet):

    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated, IsHR]
    pagination_class = AttendancePagination

    # --------------------------------------------------------
    # LIST / RETRIEVE QUERYSET
    # --------------------------------------------------------
    def get_queryset(self):
        queryset = (
            Attendance.objects
            .select_related("employee")
            .filter(
                employee__archived=False,
                employee__employment_status="Active",
            )
        )

        params = self.request.GET
        attendance_date = params.get("date", "").strip()
        date_from = params.get("date_from", "").strip()
        date_to = params.get("date_to", "").strip()
        employee = params.get("employee", "").strip()
        employee_code = params.get("employee_id", "").strip()
        attendance_status = params.get("status", "").strip()

        if attendance_date:
            queryset = queryset.filter(date=attendance_date)
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        if employee:
            queryset = queryset.filter(employee_id=employee)
        if employee_code:
            queryset = queryset.filter(employee__employee_id=employee_code)
        if attendance_status:
            queryset = queryset.filter(status=attendance_status)

        search = params.get("search", "").strip()
        for token in search.split():
            queryset = queryset.filter(
                Q(employee__employee_id__icontains=token)
                
                | Q(employee__first_name__icontains=token)
                | Q(employee__last_name__icontains=token)
            )

        for field in ("department", "branch", "employment_type", "work_location"):
            value = params.get(field, "").strip()
            if value:
                queryset = queryset.filter(**{f"employee__{field}": value})

        return queryset.order_by("-date", "employee__employee_id")

    # --------------------------------------------------------
    # CREATE  (409 on duplicate employee + date)
    # --------------------------------------------------------
    def create(self, request, *args, **kwargs):

        attendance_mode = request.data.get(
            "attendance_mode",
            "SINGLE_DATE",
        )

        # ========================================================
        # SINGLE DATE — EXISTING BEHAVIOR
        # ========================================================

        if attendance_mode == "SINGLE_DATE":

            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            employee = serializer.validated_data["employee"]
            att_date = serializer.validated_data["date"]

            existing = Attendance.objects.filter(
                employee=employee,
                date=att_date,
            ).first()

            if existing:
                return Response(
                    {
                        "detail": DUPLICATE_MESSAGE,
                        "id": existing.id,
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            try:
                with transaction.atomic():
                    serializer.save(
                        attendance_mode="SINGLE_DATE",
                    )

            except IntegrityError:
                return Response(
                    {"detail": DUPLICATE_MESSAGE},
                    status=status.HTTP_409_CONFLICT,
                )

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED,
            )

        # ========================================================
        # DATE TO DATE — OVERNIGHT ATTENDANCE
        # ========================================================

        if attendance_mode == "DATE_TO_DATE":

            serializer = OvernightAttendanceSerializer(
                data=request.data
            )

            serializer.is_valid(raise_exception=True)

            data = serializer.validated_data
            calculation = serializer.get_calculation()

            employee = data["employee"]
            start_date = data["start_date"]
            end_date = data["end_date"]

            dates = [start_date, end_date]

            # Both dates must be available.
            existing = Attendance.objects.filter(
                employee=employee,
                date__in=dates,
            ).first()

            if existing:
                return Response(
                    {
                        "detail": (
                            "Attendance already exists for this "
                            "employee on one of the selected dates."
                        ),
                        "id": existing.id,
                        "date": existing.date.isoformat(),
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            session_id = uuid.uuid4()

            session_start = timezone.make_aware(
                datetime.combine(
                    start_date,
                    data["start_time"],
                ),
                timezone.get_current_timezone(),
            )

            session_end = timezone.make_aware(
                datetime.combine(
                    end_date,
                    data["end_time"],
                ),
                timezone.get_current_timezone(),
            )

            records = []

            try:
                with transaction.atomic():

                    # Lock the employee row to serialize attendance
                    # creation requests for this employee.
                    Employee.objects.select_for_update().get(
                        pk=employee.pk
                    )

                    # Recheck duplicates inside the transaction.
                    if Attendance.objects.filter(
                        employee=employee,
                        date__in=dates,
                    ).exists():
                        return Response(
                            {
                                "detail": (
                                    "Attendance already exists on "
                                    "one of the selected dates."
                                )
                            },
                            status=status.HTTP_409_CONFLICT,
                        )

                    for index, day in enumerate(
                        calculation["days"]
                    ):

                        day_date = date.fromisoformat(
                            day["date"]
                        )

                        normal_hours = day["normal_hours"]
                        approved_ot = day["approved_ot_hours"]

                        total_hours = day["total_hours"]

                        rate, wage = payroll_snapshot(
                            employee,
                            data["status"],
                            total_hours,
                        )

                        attendance = Attendance.objects.create(
                            employee=employee,
                            date=day_date,
                            status=data["status"],

                            attendance_mode="DATE_TO_DATE",
                            attendance_session_id=session_id,
                            is_session_start=(index == 0),

                            session_start=session_start,
                            session_end=session_end,

                            login_time=datetime.strptime(
                                day["login_time"],
                                "%H:%M",
                            ).time(),

                            logout_time=datetime.strptime(
                                day["logout_time"],
                                "%H:%M",
                            ).time(),

                            selected_slots=day["selected_slots"],

                            normal_hours=normal_hours,
                            suggested_ot_hours=day[
                                "suggested_ot_hours"
                            ],
                            approved_ot_hours=approved_ot,
                            total_hours=total_hours,

                            ot_manually_edited=day[
                                "ot_manually_edited"
                            ],

                            working_hours=total_hours,
                            break_hours=Decimal("0.00"),

                            hourly_rate=rate,
                            daily_wage=wage,

                            remarks=data.get("remarks", ""),
                        )

                        records.append(attendance)

            except IntegrityError:
                return Response(
                    {
                        "detail": (
                            "Attendance already exists for "
                            "one of the selected dates."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            return Response(
                {
                    "success": True,
                    "message": "Overnight attendance saved successfully.",
                    "attendance_mode": "DATE_TO_DATE",
                    "attendance_session_id": str(session_id),
                    "records": AttendanceSerializer(
                        records,
                        many=True,
                    ).data,
                    "session_totals": calculation[
                        "session_totals"
                    ],
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {
                "attendance_mode": (
                    "Choose SINGLE_DATE or DATE_TO_DATE."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # --------------    ------------------------------------------
    # UPDATE / PARTIAL UPDATE
    # --------------------------------------------------------
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        if instance.attendance_mode == "DATE_TO_DATE":
            return Response(
                {
                    "detail": (
                        "This attendance belongs to an overnight session. "
                        "Edit the complete session using the overnight "
                        "session update endpoint."
                    ),
                    "attendance_session_id": str(
                        instance.attendance_session_id
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        new_date = serializer.validated_data.get("date", instance.date)
        clash = (
            Attendance.objects
            .filter(employee_id=instance.employee_id, date=new_date)
            .exclude(pk=instance.pk)
            .exists()
        )
        if clash:
            return Response(
                {"detail": DUPLICATE_MESSAGE},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError:
            return Response(
                {"detail": DUPLICATE_MESSAGE},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(serializer.data)
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        if instance.attendance_mode == "DATE_TO_DATE":
            return Response(
                {
                    "detail": (
                        "Cannot delete one date of an overnight session. "
                        "Delete the complete session instead."
                    ),
                    "attendance_session_id": str(
                        instance.attendance_session_id
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        instance.delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )

    # ========================================================
    # DAILY ROSTER  (Add Attendance page)
    # GET /attendance/daily-roster/?date=2026-11-13&search=&department=&page=1&page_size=25
    #
    # Every active, non-archived employee appears — with or without a record
    # for the selected date. Employees without a record come back with
    # status = "NOT_MARKED" and attendance = null.
    # ========================================================
    @action(detail=False, methods=["get"], url_path="daily-roster")
    def daily_roster(self, request):
        selected_date = parse_iso_date(request.GET.get("date"))
        page_number = positive_int(request.GET.get("page"), 1)
        page_size = positive_int(request.GET.get("page_size"), 25, maximum=100)

        employees = (
            filter_employees(active_employees(), request.GET)
            .order_by("employee_id")
        )

        paginator = Paginator(employees, page_size)
        page_obj = paginator.get_page(page_number)
        page_employees = list(page_obj.object_list)

        records = (
            Attendance.objects
            .filter(
                date=selected_date,
                employee_id__in=[e.id for e in page_employees],
            )
            .select_related("employee")
        )
        record_map = {r.employee_id: self.get_serializer(r).data for r in records}

        marked_count = Attendance.objects.filter(
            date=selected_date,
            employee__in=employees.values("pk"),
        ).count()

        rows = []
        for emp in page_employees:
            record = record_map.get(emp.id)
            rows.append({
                "id": emp.id,                       # database primary key
                "employee_id": emp.employee_id,     # display code (EMP001)
                "employee_name": emp.full_name,
                "department": emp.department,
                "designation": emp.designation,
                "status": record["status"] if record else "NOT_MARKED",
                "is_marked": record is not None,
                "attendance": record,
            })

        return Response({
            "date": selected_date,
            "count": paginator.count,
            "page": page_obj.number,
            "page_size": page_size,
            "total_pages": paginator.num_pages,
            "marked_count": marked_count,
            "results": rows,
        })

    # ========================================================
    # EMPLOYEE HOURS SUMMARY  (Employee Summary page)
    # GET /attendance/employee-hours-summary/?period=monthly&month=2026-11
    # GET /attendance/employee-hours-summary/?period=weekly&date=2026-11-09
    # GET /attendance/employee-hours-summary/?period=yearly&year=2026
    #
    # Optional: search, department, page, page_size
    #
    # `totals` are company-wide for the period (all active employees, NOT
    # narrowed by search / department). Each row is aggregated independently
    # by the employee's database primary key.
    # ========================================================
    @action(detail=False, methods=["get"], url_path="employee-hours-summary")
    def employee_hours_summary(self, request):
        period, start, end, label = resolve_period(request.GET)
        today = timezone.localdate()
        page_number = positive_int(request.GET.get("page"), 1)
        page_size = positive_int(request.GET.get("page_size"), 50, maximum=200)

        # One grouped query for every active employee that has records in range.
        grouped = (
            Attendance.objects
            .filter(
                employee__archived=False,
                employee__employment_status="Active",
                date__gte=start,
                date__lte=end,
            )
            .values("employee_id")
            .annotate(
                normal=Sum("normal_hours"),
                ot=Sum("approved_ot_hours"),
                records=Count("id"),
                records_to_date=Count("id", filter=Q(date__lte=today)),
                days_worked=Count(
                    "date",
                    filter=Q(status__in=WORKED_STATUSES),
                    distinct=True,
                ),
            )
            .order_by()          # drop Meta.ordering so GROUP BY stays per employee
        )
        stats = {row["employee_id"]: row for row in grouped}

        total_normal = sum((s["normal"] or ZERO for s in stats.values()), ZERO)
        total_ot = sum((s["ot"] or ZERO for s in stats.values()), ZERO)

        totals = {
            "total_employees": active_employees().count(),
            "employees_marked": len(stats),
            "total_normal_hours": to_float(total_normal),
            "total_ot_hours": to_float(total_ot),
            "total_hours": to_float(total_normal + total_ot),
        }

        employees = (
            filter_employees(active_employees(), request.GET)
            .order_by("employee_id")
        )
        paginator = Paginator(employees, page_size)
        page_obj = paginator.get_page(page_number)

        rows = []
        for emp in page_obj.object_list:
            stat = stats.get(emp.id)
            normal = (stat["normal"] if stat else None) or ZERO
            ot = (stat["ot"] if stat else None) or ZERO
            records = stat["records"] if stat else 0
            records_to_date = stat["records_to_date"] if stat else 0

            effective_start = (
                max(start, emp.joining_date) if emp.joining_date else start
            )
            effective_end = min(end, today)
            expected_days = max(0, (effective_end - effective_start).days + 1)
            missing_days = max(0, expected_days - records_to_date)

            rows.append({
                "id": emp.id,
                "employee_id": emp.employee_id,
                "employee_name": emp.full_name,
                "department": emp.department,
                "designation": emp.designation,
                "days_worked": stat["days_worked"] if stat else 0,
                "normal_hours": to_float(normal),
                "ot_hours": to_float(ot),
                "total_hours": to_float(normal + ot),
                "records_count": records,
                "has_attendance": records > 0,
                "attendance_state": "MARKED" if records > 0 else "NOT_MARKED",
                "missing_days": missing_days,
            })

        return Response({
            "period": period,
            "start_date": start,
            "end_date": end,
            "label": label,
            "totals": totals,
            "count": paginator.count,
            "page": page_obj.number,
            "page_size": page_size,
            "total_pages": paginator.num_pages,
            "results": rows,
        })

    # ========================================================
    # EMPLOYEE HOURS DETAIL  (daily breakdown modal)
    # GET /attendance/employee-hours-detail/?employee=<pk>&period=monthly&month=2026-11
    #
    # `employee` is the database primary key (the `id` returned by the
    # summary / roster endpoints), never the display code.
    # ========================================================
    @action(detail=False, methods=["get"], url_path="employee-hours-detail")
    def employee_hours_detail(self, request):
        raw_employee = (request.GET.get("employee") or "").strip()
        if not raw_employee.isdigit():
            return Response(
                {"detail": "employee is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            employee = active_employees().get(pk=int(raw_employee))
        except Employee.DoesNotExist:
            return Response(
                {"detail": "Employee not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        period, start, end, label = resolve_period(request.GET)
        today = timezone.localdate()

        records = list(
            Attendance.objects
            .filter(employee=employee, date__gte=start, date__lte=end)
            .order_by("date")
        )
        by_date = {r.date: r for r in records}

        # Calendar dates from the later of (period start, joining date) up to
        # the earlier of (period end, today); future days are not "missing".
        # Any saved record is always included, even outside that window.
        range_start = max(start, employee.joining_date) if employee.joining_date else start
        range_end = min(end, today)
        dates = set(by_date.keys())
        cursor = range_start
        while cursor <= range_end:
            dates.add(cursor)
            cursor += timedelta(days=1)

        days = []
        for day in sorted(dates):
            record = by_date.get(day)
            if record:
                days.append({
                    "id": record.id,
                    "date": day,
                    "day_name": day.strftime("%a"),
                    "status": record.status,
                    "is_marked": True,
                    "login_time": fmt_time(record.login_time),
                    "logout_time": fmt_time(record.logout_time),
                    "normal_hours": to_float(record.normal_hours),
                    "ot_hours": to_float(record.approved_ot_hours),
                    "total_hours": to_float(record.normal_hours + record.approved_ot_hours),
                    "remarks": record.remarks,
                })
            else:
                days.append({
                    "id": None,
                    "date": day,
                    "day_name": day.strftime("%a"),
                    "status": "NOT_MARKED",
                    "is_marked": False,
                    "login_time": None,
                    "logout_time": None,
                    "normal_hours": None,
                    "ot_hours": None,
                    "total_hours": None,
                    "remarks": "",
                })

        normal = sum((r.normal_hours for r in records), ZERO)
        ot = sum((r.approved_ot_hours for r in records), ZERO)

        return Response({
            "period": period,
            "start_date": start,
            "end_date": end,
            "label": label,
            "employee": {
                "id": employee.id,
                "employee_id": employee.employee_id,
                "employee_name": employee.full_name,
                "department": employee.department,
                "designation": employee.designation,
            },
            "summary": {
                "days_worked": len({r.date for r in records if r.status in WORKED_STATUSES}),
                "normal_hours": to_float(normal),
                "ot_hours": to_float(ot),
                "total_hours": to_float(normal + ot),
                "marked_days": len(records),
                "missing_days": sum(1 for d in days if not d["is_marked"]),
                "has_attendance": len(records) > 0,
            },
            "days": days,
        })





#for advance salary



class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


def service_call(func, *args, **kwargs):
    """Translate Django service validation into DRF HTTP 400 responses."""
    try:
        return func(*args, **kwargs)
    except DjangoValidationError as exc:
        if hasattr(exc, "message_dict"):
            raise ValidationError(exc.message_dict) from exc
        raise ValidationError({"detail": exc.messages}) from exc


def filtered_employees(request, active_only=True):
    qs = Employee.objects.filter(archived=False)
    if active_only:
        qs = qs.filter(employment_status="Active")
    search = request.query_params.get("search", "").strip()
    if search:
        qs = qs.filter(
            Q(employee_id__icontains=search)
            | Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
        )
    for field in ("department", "employment_type"):
        value = request.query_params.get(field, "").strip()
        if value:
            qs = qs.filter(**{f"{field}__iexact": value})
    for field in ("branch", "work_location"):
        value = request.query_params.get(field, "").strip()
        if value:
            qs = qs.filter(**{f"{field}__icontains": value})
    return qs.order_by("employee_id")


def salary_inputs(validated):
    """Map serializer's `advance` objects to service's `advance_id` format."""
    return {
        "allowances": validated.get("allowances", Decimal("0.00")),
        "pf": validated.get("pf", Decimal("0.00")),
        "esi": validated.get("esi", Decimal("0.00")),
        "tax": validated.get("tax", Decimal("0.00")),
        "other_deductions": validated.get("other_deductions", Decimal("0.00")),
        "installments": [
            {"advance_id": item["advance"].pk, "amount": item["amount"]}
            for item in validated.get("installments", [])
        ],
    }


def json_ready(value):
    """DRF Response JSON-safe representation of nested Decimal/date values."""
    from datetime import date, datetime
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: json_ready(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_ready(item) for item in value]
    return value


# ------------------------------------------------------------
# EMPLOYEES — existing HR employee list compatibility
# ------------------------------------------------------------
class SalaryEmployeeListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsHRorAdmin]

    def get(self, request):
        paginator = StandardPagination()
        page = paginator.paginate_queryset(filtered_employees(request), request)
        return paginator.get_paginated_response(
            SalaryEmployeeSerializer(page, many=True).data
        )


# ------------------------------------------------------------
# HR ADVANCES — keep current HR workflows
# ------------------------------------------------------------
class AdvanceListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsHRorAdmin]

    def get(self, request):
        qs = Advance.objects.select_related("employee").all()
        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(employee__employee_id__icontains=search)
                | Q(employee__first_name__icontains=search)
                | Q(employee__last_name__icontains=search)
            )
        status_filter = request.query_params.get("status", "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        employee_id = request.query_params.get("employee", "").strip()
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        for param, lookup in (
            ("date_from", "advance_date__gte"),
            ("date_to", "advance_date__lte"),
        ):
            value = request.query_params.get(param, "").strip()
            if value:
                qs = qs.filter(**{lookup: value})
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AdvanceSerializer(page, many=True).data)

    def post(self, request):
        serializer = AdvanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AdvanceDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsHRorAdmin]

    def get(self, request, pk):
        advance = get_object_or_404(Advance, pk=pk)
        return Response(AdvanceSerializer(advance).data)

    @transaction.atomic
    def patch(self, request, pk):
        advance = get_object_or_404(Advance.objects.select_for_update(), pk=pk)
        if advance.repayments.exists() or advance.total_repaid > 0:
            return Response({"detail": "Cannot edit after first installment."}, status=409)
        serializer = AdvanceSerializer(advance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @transaction.atomic
    def delete(self, request, pk):
        advance = get_object_or_404(Advance.objects.select_for_update(), pk=pk)
        if advance.repayments.exists() or advance.total_repaid > 0:
            return Response({"detail": "Cannot delete after first installment."}, status=409)
        advance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OutstandingAdvanceAPIView(APIView):
    permission_classes = [IsAuthenticated, IsHRorAdmin]

    def get(self, request):
        qs = Advance.objects.filter(outstanding_amount__gt=0)
        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(employee__employee_id__icontains=search)
                | Q(employee__first_name__icontains=search)
                | Q(employee__last_name__icontains=search)
            )
        employee_id = request.query_params.get("employee", "").strip()
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        qs = (
            qs.values(
                "employee_id", "employee__employee_id",
                "employee__first_name", "employee__last_name"
            )
            .annotate(
                total_advance=Sum("amount"),
                total_repaid=Sum("total_repaid"),
                outstanding=Sum("outstanding_amount"),
            )
            .order_by("employee__employee_id")
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response([
            {
                "employee": row["employee_id"],
                "employee_code": row["employee__employee_id"],
                "employee_name": (
                    f'{row["employee__first_name"]} {row["employee__last_name"]}'
                ).strip(),
                "total_advance": row["total_advance"],
                "total_repaid": row["total_repaid"],
                "outstanding_amount": row["outstanding"],
            }
            for row in page
        ])


# ------------------------------------------------------------
# REPAYMENTS — Admin only
# Salary-linked installments must use confirm_salary().
# Standalone manual repayments remain possible, but cannot
# attach directly to salary_payment to bypass payroll confirmation.
# ------------------------------------------------------------
class AdvanceRepaymentListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated,IsHRorAdmin]

    def get(self, request):
        qs = AdvanceRepayment.objects.select_related(
            "advance", "employee", "salary_payment"
        )
        advance_id = request.query_params.get("advance")
        if advance_id:
            qs = qs.filter(advance_id=advance_id)
        employee_id = request.query_params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            AdvanceRepaymentSerializer(page, many=True).data
        )

    @transaction.atomic
    def post(self, request):
        # The repayment serializer is intentionally read-only.
        # Explicitly validate the standalone repayment request here.
        from rest_framework import serializers as drf_serializers

        class ManualRepaymentInput(drf_serializers.Serializer):
            advance = drf_serializers.PrimaryKeyRelatedField(
                queryset=Advance.objects.all()
            )
            amount = drf_serializers.DecimalField(
                max_digits=12, decimal_places=2,
                min_value=Decimal("0.01")
            )
            date = drf_serializers.DateField(required=False)

        if "salary_payment" in request.data:
            raise ValidationError({
                "salary_payment": "Salary-linked repayments must use payroll confirmation."
            })
        incoming = ManualRepaymentInput(data=request.data)
        incoming.is_valid(raise_exception=True)
        data = incoming.validated_data
        advance = get_object_or_404(
            Advance.objects.select_for_update(), pk=data["advance"].pk
        )
        amount = data["amount"]
        if amount > advance.outstanding_amount:
            raise ValidationError({"amount": "Repayment exceeds outstanding balance."})
        repayment = AdvanceRepayment.objects.create(
            advance=advance,
            employee=advance.employee,
            amount=amount,
            date=data.get("date", timezone.localdate()),
        )
        advance.total_repaid += amount
        advance.outstanding_amount = advance.amount - advance.total_repaid
        advance.status = (
            "FULLY_REPAID" if advance.outstanding_amount == 0
            else "PARTIALLY_REPAID"
        )
        advance.save(update_fields=[
            "total_repaid", "outstanding_amount", "status", "updated_at"
        ])
        return Response(
            AdvanceRepaymentSerializer(repayment).data,
            status=status.HTTP_201_CREATED,
        )


# ------------------------------------------------------------
# ADMIN SALARY — preview / draft / confirm / history
# ------------------------------------------------------------
class SalaryCalculateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def post(self, request):
        serializer = SalaryCalculationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        preview = service_call(
            calculate_salary, data["employee"], data["salary_month"],
            **salary_inputs(data),
        )
        return Response(json_ready(preview))


class SalaryPaymentListCreateAPIView(APIView):
    """GET history, POST save draft. Retains the existing class/URL mapping."""
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):
        qs = SalaryPayment.objects.select_related("employee").all()
        month = request.query_params.get("month", "").strip()
        if month:
            try:
                parsed = datetime.strptime(month, "%Y-%m")
            except ValueError as exc:
                raise ValidationError({"month": "Use YYYY-MM."}) from exc
            qs = qs.filter(
                salary_month__year=parsed.year,
                salary_month__month=parsed.month,
            )
        employee_id = request.query_params.get("employee", "").strip()
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        payroll_status = request.query_params.get("payroll_status", "").strip()
        if payroll_status:
            qs = qs.filter(payroll_status=payroll_status)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            SalaryPaymentSerializer(page, many=True).data
        )

    def post(self, request):
        serializer = SalaryCalculationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            salary = service_call(
                save_salary_draft,
                data["employee"], data["salary_month"],
                user=request.user,
                remarks=data.get("remarks", ""),
                **salary_inputs(data),
            )
        except IntegrityError as exc:
            raise ValidationError({"detail": "A payroll already exists for this month."}) from exc
        return Response(SalaryPaymentSerializer(salary).data, status=201)


class SalaryPaymentDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request, pk):
        salary = get_object_or_404(SalaryPayment.objects.select_related("employee"), pk=pk)
        return Response(SalaryPaymentSerializer(salary).data)

    def patch(self, request, pk):
        """Recalculate an existing draft. Employee/month cannot be changed."""
        salary = get_object_or_404(SalaryPayment.objects.select_related("employee"), pk=pk)
        if salary.payroll_status != "DRAFT":
            return Response({"detail": "Confirmed salary cannot be edited."}, status=409)
        incoming = request.data.copy()
        incoming["employee"] = salary.employee_id
        incoming["salary_month"] = salary.salary_month.isoformat()
        serializer = SalaryCalculationInputSerializer(data=incoming)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        updated = service_call(
            save_salary_draft,
            salary.employee, salary.salary_month,
            user=request.user,
            remarks=data.get("remarks", salary.remarks),
            **salary_inputs(data),
        )
        return Response(SalaryPaymentSerializer(updated).data)

    def put(self, request, pk):
        return self.patch(request, pk)

    @transaction.atomic
    def delete(self, request, pk):
        salary = get_object_or_404(SalaryPayment.objects.select_for_update(), pk=pk)
        if salary.payroll_status != "DRAFT":
            return Response({"detail": "Confirmed salary cannot be deleted."}, status=409)
        salary.delete()
        return Response(status=204)


class SalaryConfirmAPIView(APIView):
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def post(self, request, pk):
        salary = get_object_or_404(SalaryPayment, pk=pk)
        confirmed = service_call(confirm_salary, salary.pk, user=request.user)
        return Response(SalaryPaymentSerializer(confirmed).data)


class SalaryPaymentStatusAPIView(APIView):
    """Mark confirmed payroll paid. Partial payment needs a separate ledger."""
    permission_classes = [IsAuthenticated, IsERPAdmin]

    @transaction.atomic
    def post(self, request, pk):
        salary = get_object_or_404(SalaryPayment.objects.select_for_update(), pk=pk)
        if salary.payroll_status != "CONFIRMED":
            raise ValidationError({"detail": "Confirm payroll before marking paid."})
        if salary.payment_status == "PAID":
            return Response(SalaryPaymentSerializer(salary).data)
        salary.payment_status = "PAID"
        salary.paid_date = timezone.localdate()
        salary.save(update_fields=["payment_status", "paid_date", "updated_at"])
        return Response(SalaryPaymentSerializer(salary).data)


# ------------------------------------------------------------
# WAGE CONFIGURATION — Admin only
# ------------------------------------------------------------
class WageConfigListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):
        qs = WageConfig.objects.select_related("employee").all()
        employee_id = request.query_params.get("employee", "").strip()
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            WageConfigSerializer(page, many=True).data
        )

    def post(self, request):
        serializer = WageConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save()
        except IntegrityError as exc:
            raise ValidationError({"employee": "Wage configuration already exists."}) from exc
        return Response(serializer.data, status=201)


class WageConfigDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request, pk):
        return Response(WageConfigSerializer(get_object_or_404(WageConfig, pk=pk)).data)

    def patch(self, request, pk):
        instance = get_object_or_404(WageConfig, pk=pk)
        serializer = WageConfigSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def put(self, request, pk):
        instance = get_object_or_404(WageConfig, pk=pk)
        serializer = WageConfigSerializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        instance = get_object_or_404(WageConfig, pk=pk)
        if SalaryPayment.objects.filter(employee_id=instance.employee_id).exists():
            return Response({"detail": "Cannot remove wage configuration with payroll history."}, status=409)
        instance.delete()
        return Response(status=204)




"""Admin-only, read-only attendance wage report.

DAILY wage calculations mirror payroll_services.calculate_salary. Other salary
configurations retain their saved Attendance.daily_wage (no guessed rates).
This report uses CURRENT WageConfig rates, so historical results can change.
"""
import csv
import re
from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Attendance, WageConfig
# IMPORTANT: use your project's existing IsERPAdmin import here.
# Example (adjust to your project): from .permissions import IsERPAdmin

WORKED = {'PRESENT', 'HALF_DAY', 'WFH'}
POLICY_FIELDS = {
    'PAID_LEAVE': 'paid_leave_policy',
    'HOLIDAY': 'holiday_policy',
    'WEEKLY_OFF': 'weekly_off_policy',
}
ZERO = Decimal('0.00')
CENT = Decimal('0.01')


class ReportPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


def money(value):
    return Decimal(str(value if value is not None else 0)).quantize(
        CENT, rounding=ROUND_HALF_UP
    )


def report_filters(request):
    params = request.query_params
    today = timezone.localdate()
    period = params.get('period', 'today').strip().lower()
    if period == 'today':
        start = end = today
    elif period == 'week':
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
    elif period == 'month':
        start = today.replace(day=1)
        end = today.replace(day=monthrange(today.year, today.month)[1])
    elif period == 'year':
        start, end = today.replace(month=1, day=1), today.replace(month=12, day=31)
    elif period == 'selected_date':
        try:
            start = end = date.fromisoformat(params['date'])
        except (KeyError, ValueError):
            raise ValidationError({'date': 'Select a valid date (YYYY-MM-DD).'})
    elif period == 'custom':
        try:
            start = date.fromisoformat(params['date_from'])
            end = date.fromisoformat(params['date_to'])
        except (KeyError, ValueError):
            raise ValidationError({'detail': 'Custom period requires date_from and date_to (YYYY-MM-DD).'})
    else:
        raise ValidationError({'period': 'Use today, week, month, year, selected_date, or custom.'})

    if period == 'year' and params.get('year'):
        try:
            year = int(params['year'])
            if year < 2000 or year > today.year:
                raise ValueError
        except ValueError:
            raise ValidationError({'year': 'Choose a valid year not later than this year.'})
        start, end = date(year, 1, 1), min(date(year, 12, 31), today)
    elif period != 'custom':
        end = min(end, today)
    if start > end:
        raise ValidationError({'date_to': 'End date must be on or after start date.'})
    if end > today:
        raise ValidationError({'date_to': 'Future dates are not allowed.'})
    if (end - start).days > 3660:
        raise ValidationError({'date_to': 'Maximum custom range is 10 years.'})

    def boolean(name, default=True):
        value = params.get(name)
        if value is None:
            return default
        if value.lower() in ('true', '1', 'yes'):
            return True
        if value.lower() in ('false', '0', 'no'):
            return False
        raise ValidationError({name: 'Use true or false.'})

    employee_pk = params.get('employee_pk', '').strip()
    if employee_pk and not employee_pk.isdigit():
        raise ValidationError({'employee_pk': 'Invalid employee identifier.'})
    return {
        'period': period, 'date_from': start, 'date_to': end,
        'search': params.get('search', '').strip(),
        'department': params.get('department', '').strip(),
        'employee_id': params.get('employee_id', '').strip(),
        'employee_pk': employee_pk,
        'status': params.get('status', '').strip().upper(),
        'require_attendance': boolean('require_attendance'),
        'require_wage': boolean('require_wage'),
    }


def report_queryset(filters):
    qs = Attendance.objects.select_related('employee').filter(
        date__range=(filters['date_from'], filters['date_to']),
        employee__archived=False,
    )
    if filters['search']:
        term = filters['search']
        qs = qs.filter(
            Q(employee__employee_id__icontains=term) |
            Q(employee__first_name__icontains=term) |
            Q(employee__last_name__icontains=term) |
            Q(employee__department__icontains=term)
        )
    if filters['department']:
        qs = qs.filter(employee__department__iexact=filters['department'])
    if filters['employee_pk']:
        qs = qs.filter(employee_id=int(filters['employee_pk']))
    if filters['employee_id']:
        qs = qs.filter(employee__employee_id__iexact=filters['employee_id'])
    if filters['status']:
        if filters['status'] not in dict(Attendance.STATUS_CHOICES):
            raise ValidationError({'status': 'Unknown attendance status.'})
        qs = qs.filter(status=filters['status'])
    if filters['require_attendance']:
        qs = qs.filter(status__in=WORKED)
    # require_wage is evaluated AFTER wage calculation, not on stored daily_wage.
    return qs


def calculate_day_wage(att, config):
    """
    Calculate daily wages for normal and overnight attendance.

    DAILY salary:
        Normal Wage = Normal Hours × Daily Rate / Standard Hours
        OT Wage = Approved OT Hours × Daily Rate / Standard Hours

    Sunday: 6 standard hours.
    Monday–Saturday: 8 standard hours.
    """

    if config is None or config.salary_type != "DAILY":
        return money(att.daily_wage)

    daily_rate = money(config.daily_rate)

    if daily_rate <= Decimal("0.00"):
        return Decimal("0.00")

    standard = (
        Decimal("6")
        if att.date.weekday() == 6
        else Decimal("8")
    )

    if att.status in WORKED:
        normal = Decimal(str(att.normal_hours or 0))
        ot = Decimal(str(att.approved_ot_hours or 0))

        if (
            normal < Decimal("0.00")
            or ot < Decimal("0.00")
            or normal > standard
        ):
            raise ValidationError({
                "attendance": (
                    f"Invalid attendance hours on {att.date}."
                )
            })

        normal_wage = (
            normal * daily_rate / standard
        ).quantize(
            CENT,
            rounding=ROUND_HALF_UP
        )

        ot_wage = (
            ot * daily_rate / standard
        ).quantize(
            CENT,
            rounding=ROUND_HALF_UP
        )

        return normal_wage + ot_wage

    policy_field = POLICY_FIELDS.get(att.status)

    if (
        policy_field
        and getattr(config, policy_field, None) == "FULL_DAY"
    ):
        return daily_rate

    return Decimal("0.00")


def serialize_row(att, config):
    employee = att.employee
    wage = calculate_day_wage(att, config)
    return {
        'id': att.pk,
        'employee': employee.pk,
        'employee_code': employee.employee_id,
        'employee_name': f'{employee.first_name} {employee.last_name}'.strip(),
        'department': employee.department or '',
        'designation': employee.designation or '',
        'date': att.date.isoformat(),
        'status': att.status,
        'login_time': att.login_time.isoformat(timespec='minutes') if att.login_time else None,
        'logout_time': att.logout_time.isoformat(timespec='minutes') if att.logout_time else None,
        'working_hours': str(att.working_hours or ZERO),
        'daily_wage': str(wage),
    }


def report_rows(filters):
    attendance = list(report_queryset(filters).order_by('date', 'employee__employee_id', 'pk'))
    employee_ids = {att.employee_id for att in attendance}
    configs = {cfg.employee_id: cfg for cfg in WageConfig.objects.filter(employee_id__in=employee_ids)}
    rows = [serialize_row(att, configs.get(att.employee_id)) for att in attendance]
    if filters['require_wage']:
        rows = [row for row in rows if Decimal(row['daily_wage']) > ZERO]
    return rows


def totals(rows):
    return {
        'records': len(rows),
        'employees': len({r['employee'] for r in rows}),
        'total_working_hours': str(sum((Decimal(r['working_hours']) for r in rows), ZERO)),
        'total_wage': str(sum((Decimal(r['daily_wage']) for r in rows), ZERO)),
    }


COLUMNS = [
    ('employee_code', 'Employee ID'), ('employee_name', 'Employee Name'),
    ('department', 'Department'), ('designation', 'Designation'),
    ('date', 'Attendance Date'), ('status', 'Attendance Status'),
    ('login_time', 'Login Time'), ('logout_time', 'Logout Time'),
    ('working_hours', 'Working Hours'), ('daily_wage', 'Daily Wage (INR)'),
]


def safe_excel_text(value):
    value = '' if value is None else str(value)
    return "'" + value if value.lstrip().startswith(('=', '+', '-', '@', '\t', '\r')) else value


def export_report(rows, filters, file_format):
    filename = f"NXT_GENZ_Custom_Salary_{filters['date_from']}_{filters['date_to']}"
    if file_format == 'csv':
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}.csv"'
        response.write('\ufeff')
        writer = csv.writer(response)
        writer.writerow([title for _, title in COLUMNS])
        for row in sorted(rows, key=lambda r: (r['date'], r['employee_code'], r['id'])):
            writer.writerow([safe_excel_text(row[key]) for key, _ in COLUMNS])
        return response

    try:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Font, PatternFill
    except ImportError as exc:
        raise ValidationError({'detail': 'XLSX export needs openpyxl: pip install openpyxl'}) from exc

    employee_data = defaultdict(list)
    for row in sorted(rows, key=lambda r: (r['employee_code'], r['date'], r['id'])):
        employee_data[(row['employee'], row['employee_code'], row['employee_name'])].append(row)

    wb = Workbook()
    overview = wb.active
    overview.title = 'Salary Summary'
    overview.append(['NXT GENZ - Custom Salary Report'])
    overview.append(['From', filters['date_from'].isoformat(), 'To', filters['date_to'].isoformat()])
    overview.append(['Employees', len(employee_data)])
    overview.append([])
    overview.append(['Employee ID', 'Employee Name', 'Department', 'Worked Days', 'Working Hours', 'Total Wages (INR)', 'Worksheet'])
    used_names = {'salary summary'}

    def header_style(ws, row_num):
        for cell in ws[row_num]:
            cell.font = Font(bold=True, color='FFFFFF')
            cell.fill = PatternFill('solid', fgColor='163B66')
            cell.alignment = Alignment(wrap_text=True)

    grand_days = 0
    grand_hours = ZERO
    grand_wages = ZERO
    for (_, code, name), person_rows in employee_data.items():
        if len(person_rows) > 1048500:
            raise ValidationError({'detail': f'Too many records for employee {code}.'})
        base = re.sub(r'[\\/*?:\[\]]', '', (name or code or 'Employee')).strip().strip("'") or 'Employee'
        base = base[:31]
        sheet_name = base
        number = 2
        while sheet_name.casefold() in used_names:
            suffix = f' ({number})'
            sheet_name = base[:31-len(suffix)] + suffix
            number += 1
        used_names.add(sheet_name.casefold())
        ws = wb.create_sheet(sheet_name)
        hours = sum((Decimal(r['working_hours']) for r in person_rows), ZERO)
        wages = sum((Decimal(r['daily_wage']) for r in person_rows), ZERO)
        grand_days += len(person_rows)
        grand_hours += hours
        grand_wages += wages
        overview.append([safe_excel_text(code), safe_excel_text(name), safe_excel_text(person_rows[0]['department']), len(person_rows), float(hours), float(wages), sheet_name])
        ws.append(['Employee Salary Details'])
        ws.append(['Employee', safe_excel_text(name), 'Employee ID', safe_excel_text(code)])
        ws.append(['Period', filters['date_from'].isoformat(), 'To', filters['date_to'].isoformat()])
        ws.append(['Worked Days', len(person_rows), 'Working Hours', float(hours), 'Total Wages (INR)', float(wages)])
        ws.append([])
        ws.append(['MONTHLY TOTALS'])
        ws.append(['Month', 'Worked Days', 'Working Hours', 'Total Wages (INR)'])
        header_style(ws, 7)
        months = defaultdict(list)
        for row in person_rows:
            months[row['date'][:7]].append(row)
        for month, entries in sorted(months.items()):
            ws.append([month, len(entries), float(sum((Decimal(r['working_hours']) for r in entries), ZERO)), float(sum((Decimal(r['daily_wage']) for r in entries), ZERO))])
        ws.append([])
        ws.append(['DAY-WISE ATTENDANCE AND WAGES'])
        ws.append([title for _, title in COLUMNS])
        header_style(ws, ws.max_row)
        first_data_row = ws.max_row + 1
        for row in person_rows:
            ws.append([float(row[key]) if key in ('working_hours', 'daily_wage') else safe_excel_text(row[key]) for key, _ in COLUMNS])
        ws.freeze_panes = 'A8'
        ws.auto_filter.ref = f'A{first_data_row-1}:J{ws.max_row}'
        for col, width in {'A':19, 'B':25, 'C':19, 'D':21, 'E':18, 'F':20, 'G':18, 'H':18, 'I':18, 'J':22}.items():
            ws.column_dimensions[col].width = width
        for cells in ws.iter_rows():
            for cell in cells:
                if cell.column in (9, 10) and isinstance(cell.value, (float, int)):
                    cell.number_format = '#,##0.00'

    overview.append([])
    overview.append(['GRAND TOTAL', '', '', grand_days, float(grand_hours), float(grand_wages)])
    header_style(overview, 5)
    overview.freeze_panes = 'A6'
    for col, width in {'A':22, 'B':30, 'C':22, 'D':17, 'E':20, 'F':23, 'G':30}.items():
        overview.column_dimensions[col].width = width
    if not employee_data:
        overview.append(['No saved worked-attendance wages matched these filters.'])
    output = BytesIO()
    wb.save(output)
    response = HttpResponse(output.getvalue(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = f'attachment; filename="{filename}.xlsx"'
    return response


class AdminCustomSalaryReportAPIView(APIView):
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):
        filters = report_filters(request)
        rows = report_rows(filters)
        file_format = request.query_params.get('export', '').strip().lower()
        if file_format:
            if file_format not in ('csv', 'xlsx'):
                raise ValidationError({'export': 'Use csv or xlsx.'})
            return export_report(rows, filters, file_format)

        view = request.query_params.get('view', 'days').strip().lower()
        if view not in ('days', 'employees', 'months'):
            raise ValidationError({'view': 'Use employees, months, or days.'})
        if view == 'months' and not filters['employee_pk']:
            raise ValidationError({'employee_pk': 'Select an employee before opening monthly details.'})

        if view == 'employees':
            grouped = defaultdict(list)
            for row in rows:
                grouped[row['employee']].append(row)
            result = []
            for employee_rows in grouped.values():
                first = employee_rows[0]
                result.append({
                    'employee_pk': first['employee'],
                    'employee_code': first['employee_code'],
                    'employee_name': first['employee_name'],
                    'department': first['department'],
                    'days': len(employee_rows),
                    'hours': str(sum((Decimal(r['working_hours']) for r in employee_rows), ZERO)),
                    'total_wage': str(sum((Decimal(r['daily_wage']) for r in employee_rows), ZERO)),
                })
            result.sort(key=lambda r: (r['employee_name'].lower(), r['employee_pk']))
            paginator = ReportPagination()
            page = paginator.paginate_queryset(result, request)
            response = paginator.get_paginated_response(page)
        elif view == 'months':
            grouped = defaultdict(list)
            for row in rows:
                grouped[row['date'][:7]].append(row)
            result = [{
                'month': month, 'days': len(entries),
                'hours': str(sum((Decimal(r['working_hours']) for r in entries), ZERO)),
                'total_wage': str(sum((Decimal(r['daily_wage']) for r in entries), ZERO)),
            } for month, entries in sorted(grouped.items())]
            response = Response({'results': result, 'count': len(result)})
        else:
            result = sorted(rows, key=lambda r: (r['date'], r['employee_code'], r['id']), reverse=True)
            paginator = ReportPagination()
            page = paginator.paginate_queryset(result, request)
            response = paginator.get_paginated_response(page)

        summary = totals(rows)
        response.data['filters'] = {
            'period': filters['period'],
            'date_from': filters['date_from'].isoformat(),
            'date_to': filters['date_to'].isoformat(),
            'require_attendance': filters['require_attendance'],
            'require_wage': filters['require_wage'],
        }
        response.data['summary'] = summary
        return response


#FOR ADVANCE REPORT 

import csv
from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Advance, AdvanceRepayment


from decimal import Decimal, ROUND_HALF_UP

ZERO = Decimal("0.00")
CENT = Decimal("0.01")

def money(value):
    if value is None or value == "":
        value = 0

    return Decimal(str(value)).quantize(
        CENT,
        rounding=ROUND_HALF_UP
    )


def employee_name(employee):
    return (getattr(employee, "full_name", None) or
            " ".join(filter(None, [getattr(employee, "first_name", ""), getattr(employee, "last_name", "")])) or
            str(employee))


def employee_code(employee):
    return getattr(employee, "employee_id", "") or getattr(employee, "employee_code", "")


def period_bounds(params):
    period = params.get("period", "month").lower()
    today = timezone.localdate()
    if period in ("all", "all_history"):
        return "all", None, None
    if period in ("today", "day"):
        return "today", today, today
    if period == "week":
        start = today - timedelta(days=today.weekday())
        return period, start, start + timedelta(days=6)
    if period == "month":
        return period, today.replace(day=1), (today.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    if period == "year":
        return period, date(today.year, 1, 1), date(today.year, 12, 31)
    if period == "custom":
        try:
            start = date.fromisoformat(params["date_from"])
            end = date.fromisoformat(params["date_to"])
        except (KeyError, ValueError, TypeError):
            raise ValueError("Custom period requires date_from and date_to in YYYY-MM-DD format.")
        if start > end:
            raise ValueError("date_from must not be later than date_to.")
        return period, start, end
    raise ValueError("period must be today, week, month, year, custom, or all.")


def filters(request):
    period, start, end = period_bounds(request.query_params)
    employee = request.query_params.get("employee")
    if employee and (not employee.isdecimal() or int(employee) < 1):
        raise ValueError("employee must be a positive numeric ID.")
    return period, start, end, int(employee) if employee else None


def response_or_export(request, rows, columns, filename, payload):
    fmt = request.query_params.get("export", "").lower()
    if not fmt:
        return Response(payload)
    if fmt not in ("csv", "xlsx"):
        return Response({"detail": "export must be csv or xlsx."}, status=400)
    if fmt == "csv":
        resp = HttpResponse(content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="{filename}.csv"'
        resp.write("\ufeff")
        writer = csv.writer(resp)
        writer.writerow([label for _, label in columns])
        for row in rows:
            writer.writerow([csv_safe(row.get(key, "")) for key, _ in columns])
        return resp
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    from openpyxl.utils import get_column_letter
    wb = Workbook()
    ws = wb.active
    ws.title = "Advance Report"
    ws.append([label for _, label in columns])
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="17365D")
    for row in rows:
        ws.append([excel_safe(row.get(key, "")) for key, _ in columns])
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    for index, (_, label) in enumerate(columns, 1):
        ws.column_dimensions[get_column_letter(index)].width = min(max(len(label) + 4, 16), 35)
    stream = BytesIO()
    wb.save(stream)
    resp = HttpResponse(stream.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    resp["Content-Disposition"] = f'attachment; filename="{filename}.xlsx"'
    return resp


def csv_safe(value):
    text = "" if value is None else str(value)
    if text.lstrip().startswith(("=", "+", "-", "@", "\t", "\r", "\n")):
        return "'" + text
    return text


def excel_safe(value):
    return csv_safe(value)


def advance_dict(a):
    return {
        "id": a.id, "employee": a.employee_id,
        "employee_code": employee_code(a.employee),
        "employee_name": employee_name(a.employee),
        "department": getattr(a.employee, "department", ""),
        "advance_date": a.advance_date.isoformat(),
        "amount": money(a.amount),
        "total_repaid": money(a.total_repaid),
        "outstanding_amount": money(a.outstanding_amount),
        "installment_count": a.installment_count,
        "installment_amount": money(a.installment_amount) if a.installment_amount is not None else None,
        "status": a.status,
        "reason": a.reason,
        "remarks": a.remarks,
    }


ADVANCE_COLUMNS = [
    ("employee_code", "Employee ID"), ("employee_name", "Employee Name"),
    ("department", "Department"), ("id", "Advance ID"),
    ("advance_date", "Advance Date"), ("amount", "Advance Amount INR"),
    ("total_repaid", "Repaid INR"), ("outstanding_amount", "Outstanding INR"),
    ("installment_count", "Planned Installments"), ("installment_amount", "Planned Amount INR"),
    ("completed_installments", "Completed Salary Installments"),
    ("status", "Status"), ("reason", "Reason"),
]

REPAYMENT_COLUMNS = [
    ("employee_code", "Employee ID"), ("employee_name", "Employee Name"),
    ("advance_id", "Advance ID"), ("advance_date", "Advance Issued"),
    ("date", "Repayment Date"), ("repayment_id", "Repayment ID"),
    ("type", "Repayment Type"), ("installment_number", "Salary Installment Number"),
    ("salary_month", "Salary Month"), ("amount", "Repaid INR"),
    ("balance_after", "Balance After INR"),
]


def paginate(request, rows):
    try:
        page = int(request.query_params.get("page", 1))
        size = int(request.query_params.get("page_size", 25))
    except ValueError:
        raise ValueError("page and page_size must be integers.")
    if page < 1 or not 1 <= size <= 100:
        raise ValueError("page must be >= 1 and page_size must be 1 to 100.")
    return rows[(page - 1) * size:page * size], page, size


class AdminAdvanceReportAPIView(APIView):
    """Filter advances by *issue date*. all includes fully repaid historical advances."""
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):
        try:
            period, start, end, employee = filters(request)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        qs = Advance.objects.select_related("employee").order_by("-advance_date", "-id")
        if start is not None:
            qs = qs.filter(advance_date__range=(start, end))
        if employee is not None:
            qs = qs.filter(employee_id=employee)
        status_filter = request.query_params.get("status", "all").upper()
        if status_filter not in ("ALL", "OUTSTANDING", "PARTIALLY_REPAID", "FULLY_REPAID"):
            return Response({"detail": "Invalid advance status."}, status=400)
        if status_filter != "ALL":
            qs = qs.filter(status=status_filter)
        rows = [advance_dict(a) for a in qs]
        # Count actual salary-linked repayment records; manual payments are separate.
        from django.db.models import Count
        counts = dict(AdvanceRepayment.objects.filter(
            advance_id__in=[r["id"] for r in rows], salary_payment__isnull=False
        ).values("advance_id").annotate(n=Count("id")).values_list("advance_id", "n"))
        for r in rows:
            r["completed_installments"] = counts.get(r["id"], 0)
        summary = {
            "advance_count": len(rows),
            "total_advanced": money(sum((Decimal(r["amount"]) for r in rows), Decimal("0"))),
            "total_repaid_to_date": money(sum((Decimal(r["total_repaid"]) for r in rows), Decimal("0"))),
            "total_outstanding": money(sum((Decimal(r["outstanding_amount"]) for r in rows), Decimal("0"))),
        }
        payload = {"success": True, "period": period,
                   "date_from": start.isoformat() if start else None,
                   "date_to": end.isoformat() if end else None,
                   "summary": summary, "count": len(rows)}
        if not request.query_params.get("export"):
            try:
                selected, page, size = paginate(request, rows)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)
            payload.update({"page": page, "page_size": size, "results": selected})
        return response_or_export(request, rows, ADVANCE_COLUMNS, "NXT_GENZ_Advance_Report", payload)


def repayment_history(advances, start=None, end=None):
    """Return chronological repayments with running balance based on ALL repayments."""
    output = []
    for a in advances:
        balance = a.amount
        installment_number = 0
        repayments = sorted(a.repayments.all(), key=lambda r: (r.date, r.created_at, r.pk))
        for r in repayments:
            salary_linked = r.salary_payment_id is not None
            if salary_linked:
                installment_number += 1
            balance -= r.amount
            # Do not reset running balance when the report date window starts.
            if start is not None and not start <= r.date <= end:
                continue
            output.append({
                "repayment_id": r.id, "advance_id": a.id,
                "employee": a.employee_id,
                "employee_code": employee_code(a.employee),
                "employee_name": employee_name(a.employee),
                "advance_date": a.advance_date.isoformat(),
                "date": r.date.isoformat(),
                "amount": money(r.amount),
                "type": "SALARY_INSTALLMENT" if salary_linked else "MANUAL",
                "installment_number": installment_number if salary_linked else None,
                "salary_payment_id": r.salary_payment_id,
                "salary_month": r.salary_payment.salary_month.isoformat()[:7] if salary_linked else None,
                "balance_after": money(balance),
            })
    return sorted(output, key=lambda x: (x["date"], x["repayment_id"]), reverse=True)


class AdminAdvanceRepaymentHistoryAPIView(APIView):
    """All repayments or repayments in date window (filter on repayment date)."""
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):
        try:
            period, start, end, employee = filters(request)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        qs = Advance.objects.select_related("employee").prefetch_related("repayments__salary_payment")
        if employee is not None:
            qs = qs.filter(employee_id=employee)
        advance_id = request.query_params.get("advance")
        if advance_id:
            if not advance_id.isdecimal() or int(advance_id) < 1:
                return Response({"detail": "advance must be a positive numeric ID."}, status=400)
            qs = qs.filter(pk=int(advance_id))
        rows = repayment_history(qs, start, end)
        payload = {"success": True, "period": period,
                   "date_from": start.isoformat() if start else None,
                   "date_to": end.isoformat() if end else None,
                   "count": len(rows),
                   "total_repaid_in_period": money(sum((Decimal(r["amount"]) for r in rows), Decimal("0")))}
        if not request.query_params.get("export"):
            try:
                selected, page, size = paginate(request, rows)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)
            payload.update({"page": page, "page_size": size, "results": selected})
        return response_or_export(request, rows, REPAYMENT_COLUMNS, "NXT_GENZ_Advance_Repayment_History", payload)


class AdminEmployeeAdvanceHistoryAPIView(APIView):
    """Eye-button endpoint: full advances and installment timelines for one employee."""
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request, employee_id):
        advances = list(Advance.objects.filter(employee_id=employee_id)
                        .select_related("employee")
                        .prefetch_related("repayments__salary_payment")
                        .order_by("-advance_date", "-id"))
        if not advances:
            from .models import Employee
            employee = Employee.objects.filter(pk=employee_id).first()
            if employee is None:
                return Response({"detail": "Employee not found."}, status=404)
        else:
            employee = advances[0].employee
        result = []
        for a in advances:
            record = advance_dict(a)
            timeline = repayment_history([a])
            completed = sum(r["type"] == "SALARY_INSTALLMENT" for r in timeline)
            record.update({
                "completed_installments": completed,
                "remaining_planned_installments": max(a.installment_count - completed, 0) if a.installment_count else None,
                "repayment_history": sorted(timeline, key=lambda x: (x["date"], x["repayment_id"])),
                "first_installment_completed_on": min(
                    (r["date"] for r in timeline if r["type"] == "SALARY_INSTALLMENT"), default=None
                ),
                "last_repayment_on": max((r["date"] for r in timeline), default=None),
            })
            result.append(record)
        return Response({
            "success": True,
            "employee": {"id": employee.id, "employee_code": employee_code(employee),
                         "employee_name": employee_name(employee),
                         "department": getattr(employee, "department", "")},
            "summary": {
                "total_advances": len(result),
                "total_advanced": money(sum((a.amount for a in advances), Decimal("0"))),
                "total_repaid": money(sum((a.total_repaid for a in advances), Decimal("0"))),
                "total_outstanding": money(sum((a.outstanding_amount for a in advances), Decimal("0"))),
            },
            "advances": result,
        })









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

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

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

    
"""Consumable inventory views (drop-in section for your ERP views.py).

Paste into the existing views.py, replacing ONLY the old Consumable views/helpers.
Requires the models and serializers discussed in Steps 1-2.
"""
"""Consumable inventory views (drop-in section for your ERP views.py).

Paste into the existing views.py, replacing ONLY the old Consumable views/helpers.
Requires the models and serializers discussed in Steps 1-2.
"""
"""Consumable inventory views (drop-in section for your ERP views.py).

Paste into the existing views.py, replacing ONLY the old Consumable views/helpers.
Requires the models and serializers discussed in Steps 1-2.
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal
from uuid import uuid4

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    ConsumableCategory, ConsumableMaster, ConsumableVariety,
    ConsumableGRN, ConsumableIssue, ConsumableReturn, ConsumableIssueAllocation,
)
from .serializers import (
    ConsumableCategorySerializer, ConsumableMasterSerializer,
    ConsumableVarietySerializer, ConsumableGRNSerializer,
    ConsumableGRNCreateSerializer, ConsumableIssueSerializer,
    ConsumableReturnSerializer, normalize_consumable_text,
    generate_variety_code,
)
from .tasks import check_consumable_buffer_stock
# Keep your project's existing import of IsMaterialPlanning.
# e.g. from .permissions import IsMaterialPlanning

ZERO = Decimal('0')


def _error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'success': False, 'detail': message}, status=code)


def _number(prefix):
    # Collision-resistant, non-sequential; avoids concurrent MAX(id)+1 races.
    return f'{prefix}-{uuid4().hex[:12].upper()}'


def _text(value):
    return normalize_consumable_text(value)


def _decimal(value, label='Quantity', allow_zero=False):
    try:
        n = Decimal(str(value))
    except (TypeError, ValueError, ArithmeticError):
        raise serializers.ValidationError({label: 'Enter a valid number.'})
    if not n.is_finite() or (n < 0 if allow_zero else n <= 0):
        raise serializers.ValidationError({label: 'Enter a non-negative number.' if allow_zero else 'Must be greater than zero.'})
    if n.as_tuple().exponent < -3 or n >= Decimal('1000000000000'):
        raise serializers.ValidationError({label: 'Maximum 3 decimal places and 12 integer digits.'})
    return n


def _variety_info(variety):
    if not variety:
        return {'varietyId': None, 'varietyCode': '', 'size': '', 'varietyDescription': ''}
    return {
        'varietyId': variety.id, 'varietyCode': variety.variety_code,
        'size': variety.size, 'varietyDescription': variety.description,
    }


def _grn_stock(grn):
    issued = ConsumableIssue.objects.filter(grn=grn).aggregate(v=Sum('quantity_issued'))['v'] or ZERO
    returned = ConsumableReturn.objects.filter(issue__grn=grn).aggregate(v=Sum('quantity_returned'))['v'] or ZERO
    return (grn.received_quantity or ZERO) - issued + returned


def _source_balances(grn):
    """Original receipt and each return are independently tracked sources."""
    original_used = ConsumableIssueAllocation.objects.filter(
        grn=grn, source_return__isnull=True
    ).aggregate(v=Sum('quantity'))['v'] or ZERO
    sources = [(None, (grn.received_quantity or ZERO) - original_used)]
    for ret in ConsumableReturn.objects.filter(issue__grn=grn).order_by('created_at', 'pk'):
        used = ret.reissue_allocations.aggregate(v=Sum('quantity'))['v'] or ZERO
        sources.append((ret, (ret.quantity_returned or ZERO) - used))
    return sources


def _return_is_reissued(ret):
    return ret.reissue_allocations.exists()


def _sync_issue_status(issue):
    returned = ConsumableReturn.objects.filter(issue=issue).aggregate(v=Sum('quantity_returned'))['v'] or ZERO
    issue.status = (ConsumableIssue.Status.ISSUED if returned == ZERO else
                    ConsumableIssue.Status.FULLY_RETURNED if returned == issue.quantity_issued else
                    ConsumableIssue.Status.PARTIALLY_RETURNED)
    issue.save(update_fields=['status', 'updated_at'])


def _alert_after_commit(grn_id, issue_id=None):
    transaction.on_commit(lambda gid=grn_id, iid=issue_id: check_consumable_buffer_stock.delay(gid, iid) if iid else check_consumable_buffer_stock.delay(gid))


def _available_qty_for_grn(grn):
    return _grn_stock(grn)


def _grouped_inventory(include_zero=False):
    """Group NEW stock by variety+warehouse; legacy GRNs remain separate."""
    rows = {}
    qs = (ConsumableGRN.objects.select_related(
        'consumable_variety__consumable__category'
    ).prefetch_related('issues__returns').order_by('created_at', 'pk'))
    for grn in qs:
        v = grn.consumable_variety
        key = ('variety', v.id, grn.warehouse) if v else ('legacy', grn.id, grn.warehouse)
        if key not in rows:
            rows[key] = {
                'id': f'variety:{v.id}:{grn.warehouse}' if v else f'legacy:{grn.id}',
                'varietyId': v.id if v else None,
                'consumableName': v.consumable.name if v else grn.consumable_name,
                'category': v.consumable.category.name if v else grn.category,
                'unit': v.consumable.unit if v else grn.unit,
                'warehouse': grn.warehouse,
                'varietyCode': v.variety_code if v else '',
                'size': v.size if v else '',
                'varietyDescription': v.description if v else '',
                'receivedQty': ZERO, 'issuedQty': ZERO, 'returnedQty': ZERO,
                'availableQty': ZERO, 'grnIds': [], 'grnNumbers': [],
                'supplier': grn.supplier, 'lastReceivedDate': '',
                'bufferStockLimit': None, 'grnType': grn.grn_type,
                'poNumber': grn.po_number,
            }
        row = rows[key]
        issued = ZERO
        returned = ZERO
        for issue in grn.issues.all():
            issued += issue.quantity_issued or ZERO
            returned += sum((r.quantity_returned or ZERO for r in issue.returns.all()), ZERO)
        row['receivedQty'] += grn.received_quantity or ZERO
        row['issuedQty'] += issued
        row['returnedQty'] += returned
        row['availableQty'] += (grn.received_quantity or ZERO) - issued + returned
        row['grnIds'].append(grn.id)
        row['grnNumbers'].append(grn.grn_number)
        row['supplier'] = grn.supplier
        row['lastReceivedDate'] = (grn.received_date or grn.created_at.date()).isoformat()
        if grn.buffer_stock_limit is not None:
            row['bufferStockLimit'] = grn.buffer_stock_limit
    result = []
    for row in rows.values():
        if not include_zero and row['availableQty'] <= ZERO:
            continue
        threshold = row['bufferStockLimit'] if row['bufferStockLimit'] is not None else Decimal('10')
        row['status'] = 'Low Stock' if row['availableQty'] <= threshold else 'In Stock'
        for field in ('receivedQty', 'issuedQty', 'returnedQty', 'availableQty', 'bufferStockLimit'):
            if row[field] is not None:
                row[field] = float(row[field])
        row['referenceNumber'] = row['grnNumbers'][-1]
        row['description'] = row['varietyDescription'] or row['consumableName']
        result.append(row)
    return sorted(result, key=lambda r: r['lastReceivedDate'], reverse=True)


class ConsumableDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        return Response({
            'grn': '/erp/consumable-grn/direct/',
            'stock': '/erp/consumable-grn/stock/',
            'issue': '/erp/consumable-grn/issue-stock/',
            'return': '/erp/consumable-grn/returnable-issues/',
            'movements': '/erp/consumable-grn/movement-groups/',
        })


class ConsumableCategoryAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        qs = ConsumableCategory.objects.all()
        return Response(ConsumableCategorySerializer(qs, many=True).data)

    def post(self, request):
        s = ConsumableCategorySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            obj = s.save()
        return Response(ConsumableCategorySerializer(obj).data, status=201)


class ConsumableMasterAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        qs = ConsumableMaster.objects.select_related('category')
        if request.query_params.get('category'):
            qs = qs.filter(category_id=request.query_params['category'])
        return Response(ConsumableMasterSerializer(qs, many=True).data)

    def post(self, request):
        s = ConsumableMasterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            obj = s.save()
        return Response(ConsumableMasterSerializer(obj).data, status=201)


class ConsumableVarietyAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        qs = ConsumableVariety.objects.select_related('consumable__category')
        if request.query_params.get('consumable'):
            qs = qs.filter(consumable_id=request.query_params['consumable'])
        return Response(ConsumableVarietySerializer(qs, many=True).data)

    def post(self, request):
        s = ConsumableVarietySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        obj = s.save()  # serializer locks parent consumable and assigns code
        return Response(ConsumableVarietySerializer(obj).data, status=201)


def _get_or_create_variety(data):
    """Call inside transaction.atomic; normalize and reuse existing masters."""
    variety_id = data.get('consumable_variety') or data.get('consumableVariety')
    if variety_id:
        try:
            variety = ConsumableVariety.objects.select_related('consumable__category').get(pk=variety_id)
        except (ConsumableVariety.DoesNotExist, ValueError, TypeError):
            raise serializers.ValidationError({'consumable_variety': 'Invalid variety.'})
        if not (variety.is_active and variety.consumable.is_active and variety.consumable.category.is_active):
            raise serializers.ValidationError({'consumable_variety': 'Selected variety/category/consumable is inactive.'})
        return variety

    category_id = data.get('category_id') or data.get('categoryId')
    category_name = _text(data.get('category'))
    consumable_id = data.get('consumable_id') or data.get('consumableId')
    consumable_name = _text(data.get('consumable_name') or data.get('consumableName'))
    unit = _text(data.get('unit'))
    size = _text(data.get('size'))
    description = _text(data.get('description') or data.get('variety_description') or data.get('varietyDescription'))
    if not size or not description:
        raise serializers.ValidationError({'variety': 'Size and description are required.'})

    if category_id:
        try:
            category = ConsumableCategory.objects.get(pk=category_id, is_active=True)
        except (ConsumableCategory.DoesNotExist, ValueError, TypeError):
            raise serializers.ValidationError({'category_id': 'Invalid category.'})
    else:
        if not category_name:
            raise serializers.ValidationError({'category': 'Category is required.'})
        category = ConsumableCategory.objects.filter(name__iexact=category_name).first()
        if not category:
            try:
                with transaction.atomic():
                    category = ConsumableCategory.objects.create(name=category_name)
            except IntegrityError:
                category = ConsumableCategory.objects.get(name__iexact=category_name)
        if not category.is_active:
            raise serializers.ValidationError({'category': 'Category is inactive.'})

    if consumable_id:
        try:
            consumable = ConsumableMaster.objects.get(pk=consumable_id, category=category, is_active=True)
        except (ConsumableMaster.DoesNotExist, ValueError, TypeError):
            raise serializers.ValidationError({'consumable_id': 'Invalid consumable for category.'})
    else:
        if not consumable_name:
            raise serializers.ValidationError({'consumable_name': 'Consumable name is required.'})
        consumable = ConsumableMaster.objects.filter(category=category, name__iexact=consumable_name).first()
        if not consumable:
            if not unit:
                raise serializers.ValidationError({'unit': 'Unit is required for a new consumable.'})
            try:
                with transaction.atomic():
                    consumable = ConsumableMaster.objects.create(category=category, name=consumable_name, unit=unit)
            except IntegrityError:
                consumable = ConsumableMaster.objects.get(category=category, name__iexact=consumable_name)
        if not consumable.is_active:
            raise serializers.ValidationError({'consumable_name': 'Consumable is inactive.'})
    if unit and unit.casefold() != consumable.unit.casefold():
        raise serializers.ValidationError({'unit': f'This consumable uses {consumable.unit}.'})

    # Serialize variety-code assignment by locking its parent row.
    ConsumableMaster.objects.select_for_update().get(pk=consumable.pk)
    existing = ConsumableVariety.objects.filter(consumable=consumable)
    variety = existing.filter(size__iexact=size, description__iexact=description).first()
    if variety:
        if not variety.is_active:
            raise serializers.ValidationError({'variety': 'Matching variety is inactive.'})
        return variety
    used = set(existing.values_list('variety_code', flat=True))
    idx = 1
    while generate_variety_code(idx) in used:
        idx += 1
    return ConsumableVariety.objects.create(
        consumable=consumable, variety_code=generate_variety_code(idx),
        size=size, description=description,
    )


class ConsumableGRNDirectCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        """List individual GRN receipts for the Consumable GRN screen."""
        qs = ConsumableGRN.objects.select_related(
            'consumable_variety__consumable__category'
        ).order_by('-received_date', '-id')
        return Response(ConsumableGRNSerializer(qs, many=True).data)

    @transaction.atomic
    def post(self, request):
        data = request.data
        supplier = _text(data.get('supplier'))
        received_by = _text(data.get('received_by') or data.get('receivedBy'))
        warehouse = _text(data.get('warehouse'))
        if not supplier or not received_by:
            return _error('Supplier and receivedBy are required.')
        if warehouse not in dict(ConsumableGRN.WAREHOUSE_CHOICES):
            return _error('Warehouse must be Unit One or Unit Two.')
        qty = _decimal(data.get('quantity'), 'quantity')
        limit_raw = data.get('buffer_stock_limit', data.get('bufferStockLimit'))
        limit = None if limit_raw in ('', None) else _decimal(limit_raw, 'buffer_stock_limit', allow_zero=True)
        date_raw = data.get('received_date') or data.get('receivedDate')
        if date_raw:
            parsed_date = serializers.DateField().run_validation(date_raw)
        else:
            parsed_date = timezone.localdate()
        variety = _get_or_create_variety(data)
        master = variety.consumable
        grn = ConsumableGRN.objects.create(
            grn_number=_number('CGRN'), grn_type=ConsumableGRN.GRNType.DIRECT,
            purchase_order_item=None, po_number='', po_description='Direct Purchase',
            consumable_variety=variety, supplier=supplier,
            supplier_invoice_number=_text(data.get('supplier_invoice_number') or data.get('supplierInvoiceNumber')),
            consumable_name=master.name, category=master.category.name, unit=master.unit,
            ordered_quantity=qty, received_quantity=qty, pending_quantity=ZERO,
            warehouse=warehouse, status=ConsumableGRN.Status.FULLY_RECEIVED,
            buffer_stock_limit=limit, received_by=received_by,
            received_date=parsed_date, remarks=_text(data.get('remarks')),
        )
        return Response({'success': True, 'message': 'Direct GRN created.',
                         'data': ConsumableGRNSerializer(grn).data}, status=201)


class ConsumableStockAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        return Response(_grouped_inventory(include_zero=True))


class ConsumableIssueStockAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        return Response(_grouped_inventory(include_zero=False))


class ConsumableIssueCreateAPIView(APIView):
    """POST /issue/<grn_id>/ legacy-compatible; or /issue/ with varietyId + warehouse.

    One issue row per source GRN. A multi-GRN issue returns a list of issue rows.
    Returns must reference an individual issue ID.
    """
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request, grn_id=None):
        data = request.data
        department = _text(data.get('department'))
        employee = _text(data.get('employeeName') or data.get('employee_name'))
        if not department or not employee:
            return _error('Department and employeeName are required.')
        qty = _decimal(data.get('quantity'), 'quantity')
        warehouse = _text(data.get('warehouse'))
        variety_id = data.get('varietyId') or data.get('variety_id') or data.get('consumable_variety')
        if grn_id is not None:
            try:
                anchor = ConsumableGRN.objects.get(pk=grn_id)
            except ConsumableGRN.DoesNotExist:
                return _error('GRN not found.', 404)
            if anchor.consumable_variety_id:
                variety_id = anchor.consumable_variety_id
                warehouse = anchor.warehouse
                grns = ConsumableGRN.objects.filter(consumable_variety_id=variety_id, warehouse=warehouse)
            else:
                grns = ConsumableGRN.objects.filter(pk=anchor.pk)
        else:
            if not variety_id or not warehouse:
                return _error('varietyId and warehouse are required.')
            if warehouse not in dict(ConsumableGRN.WAREHOUSE_CHOICES):
                return _error('Invalid warehouse.')
            grns = ConsumableGRN.objects.filter(consumable_variety_id=variety_id, warehouse=warehouse)
        # Lock every receipt in stable order; protects concurrent issue operations.
        grns = list(grns.select_for_update().order_by('created_at', 'pk'))
        if not grns:
            return _error('No GRNs for this variety and warehouse.', 404)
        # Source-aware FIFO: consume original GRN balance first, then individual returns.
        # This is essential for locking only returns whose quantities were reissued.
        source_rows = [(g, src, balance) for g in grns for src, balance in _source_balances(g)]
        total = sum((max(b, ZERO) for _, _, b in source_rows), ZERO)
        if qty > total:
            return _error(f'Only {total} {grns[0].unit} available to issue.')
        remaining = qty
        created = []
        for grn, source_return, balance in source_rows:
            take = min(max(balance, ZERO), remaining)
            if take <= ZERO:
                continue
            issue = ConsumableIssue.objects.create(
                issue_number=_number('CISS'), grn=grn,
                po_number=grn.po_number, po_description=grn.po_description,
                consumable_name=grn.consumable_name, category=grn.category,
                unit=grn.unit, warehouse=grn.warehouse,
                quantity_issued=take, status=ConsumableIssue.Status.ISSUED,
                department=department, employee_name=employee,
                job_card=_text(data.get('jobCard') or data.get('job_card')),
                remarks=_text(data.get('remarks')),
            )
            ConsumableIssueAllocation.objects.create(
                issue=issue, grn=grn, source_return=source_return, quantity=take,
            )
            created.append(issue)
            remaining -= take
            if remaining == ZERO:
                break
        # Existing task takes (grn_id, issue_id); it MUST be upgraded to
        # aggregate by variety+warehouse for accurate new-style alerts.
        for issue in created:
            transaction.on_commit(
                lambda gid=issue.grn_id, iid=issue.id: check_consumable_buffer_stock.delay(gid, iid)
            )
        return Response({
            'success': True, 'message': 'Consumable issued successfully.',
            'quantityIssued': float(qty),
            'data': ConsumableIssueSerializer(created, many=True).data,
        }, status=201)

from decimal import Decimal

from django.db.models import Sum
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated


class ConsumableIssueHistoryAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):

        issues = (
            ConsumableIssue.objects
            .select_related(
                "grn",
                "grn__consumable_variety",
                "grn__consumable_variety__consumable",
                "grn__consumable_variety__consumable__category",
            )
            .order_by("-created_at", "-id")
        )

        results = []

        for issue in issues:

            grn = issue.grn

            variety = (
                grn.consumable_variety
                if grn and grn.consumable_variety_id
                else None
            )

            # Get returns without assuming a related_name
            returns = ConsumableReturn.objects.filter(
                issue_id=issue.id
            )

            has_returns = returns.exists()

            returned_quantity = (
                returns.aggregate(
                    total=Sum("quantity_returned")
                )["total"]
                or Decimal("0")
            )

            results.append({
                "id": issue.id,

                "issueNumber": issue.issue_number,

                "date": issue.created_at,

                "category": issue.category,

                "consumableName": issue.consumable_name,

                "varietyId": variety.id if variety else None,

                "varietyName": (
                    getattr(variety, "name", "")
                    if variety
                    else ""
                ),

                "warehouse": issue.warehouse,

                "unit": issue.unit,

                "department": issue.department,

                "employeeName": issue.employee_name,

                "jobCard": issue.job_card,

                "quantity": float(issue.quantity_issued),

                "returnedQuantity": float(returned_quantity),

                "remarks": issue.remarks,

                "can_edit": not has_returns,
            })

        return Response(results)


class ConsumableReturnableIssueListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        result = []
        issues = ConsumableIssue.objects.select_related('grn__consumable_variety').prefetch_related('returns')
        for issue in issues:
            returned = sum((r.quantity_returned or ZERO for r in issue.returns.all()), ZERO)
            issued = issue.quantity_issued or ZERO
            balance = issued - returned
            expected = (ConsumableIssue.Status.ISSUED if returned <= ZERO else
                        ConsumableIssue.Status.FULLY_RETURNED if balance <= ZERO else
                        ConsumableIssue.Status.PARTIALLY_RETURNED)
            result.append({
                'id': issue.id, 'issueNumber': issue.issue_number,
                'consumableName': issue.consumable_name,
                **_variety_info(issue.grn.consumable_variety),
                'department': issue.department, 'employeeName': issue.employee_name,
                'jobCard': issue.job_card, 'issuedQty': float(issued),
                'returnedQty': float(returned), 'balanceQty': float(max(balance, ZERO)),
                'unit': issue.unit, 'warehouse': issue.warehouse, 'status': expected,
            })
        return Response(result)


class ConsumableReturnCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request, issue_id):
        try:
            issue = ConsumableIssue.objects.select_for_update().select_related('grn').get(pk=issue_id)
        except ConsumableIssue.DoesNotExist:
            return _error('Issue not found.', 404)
        ConsumableGRN.objects.select_for_update().get(pk=issue.grn_id)
        qty = _decimal(request.data.get('returnQty', request.data.get('quantity')), 'returnQty')
        returned = ConsumableReturn.objects.filter(issue=issue).aggregate(v=Sum('quantity_returned'))['v'] or ZERO
        balance = (issue.quantity_issued or ZERO) - returned
        if qty > balance:
            return _error(f'Only {max(balance, ZERO)} {issue.unit} can be returned.')
        ret = ConsumableReturn.objects.create(
            return_number=_number('CRET'), issue=issue, issue_number=issue.issue_number,
            consumable_name=issue.consumable_name, unit=issue.unit, warehouse=issue.warehouse,
            quantity_returned=qty,
            returned_by=_text(request.data.get('returnedBy') or request.data.get('returned_by')) or issue.employee_name,
            remarks=_text(request.data.get('remarks')),
        )
        total_returned = returned + qty
        issue.status = (ConsumableIssue.Status.FULLY_RETURNED if total_returned == issue.quantity_issued
                        else ConsumableIssue.Status.PARTIALLY_RETURNED)
        issue.save(update_fields=['status', 'updated_at'])
        transaction.on_commit(lambda gid=issue.grn_id: check_consumable_buffer_stock.delay(gid))
        return Response({'success': True, 'message': 'Consumable returned successfully.',
                         'data': ConsumableReturnSerializer(ret).data}, status=201)


class ConsumableReturnHistoryAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        returns = (
            ConsumableReturn.objects
            .select_related(
                "issue",
                "issue__grn",
                "issue__grn__consumable_variety",
            )
            .order_by("-created_at", "-id")
        )

        results = []

        for ret in returns:
            issue = ret.issue
            grn = issue.grn

            # Check whether this specific return has been reissued.
            reissued = (
                ConsumableIssueAllocation.objects
                .filter(source_return=ret)
                .aggregate(total=Sum("quantity"))["total"]
                or ZERO
            )

            can_edit = reissued <= ZERO

            variety = (
                grn.consumable_variety
                if grn and grn.consumable_variety_id
                else None
            )

            results.append({
                "id": ret.id,
                "returnNumber": ret.return_number,
                "issueId": issue.id,
                "issueNumber": ret.issue_number,
                "date": ret.created_at,
                "consumableName": ret.consumable_name,
                **_variety_info(variety),
                "department": issue.department,
                "employeeName": issue.employee_name,
                "returnedBy": ret.returned_by,
                "warehouse": ret.warehouse,
                "unit": ret.unit,
                "quantity": float(ret.quantity_returned),
                "returnQty": float(ret.quantity_returned),
                "remarks": ret.remarks,
                "reissuedQty": float(reissued),
                "can_edit": can_edit,
            })

        return Response(results)


class ConsumableMovementGroupListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        return Response(_grouped_inventory(include_zero=True))


class ConsumableMovementDetailAPIView(APIView):
    """GET ?variety_id=1&warehouse=Unit%20One, or ?grn_id=123 for legacy."""
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        variety_id = request.query_params.get('variety_id') or request.query_params.get('varietyId')
        warehouse = request.query_params.get('warehouse')
        grn_id = request.query_params.get('grn_id')
        if grn_id:
            grns = ConsumableGRN.objects.filter(pk=grn_id)
        elif variety_id and warehouse:
            grns = ConsumableGRN.objects.filter(consumable_variety_id=variety_id, warehouse=warehouse)
        else:
            return _error('Provide variety_id and warehouse, or grn_id.')
        grns = list(grns.select_related('consumable_variety__consumable__category').order_by('created_at', 'pk'))
        if not grns:
            return _error('No matching GRN records.', 404)
        issues = list(ConsumableIssue.objects.filter(grn__in=grns).order_by('created_at', 'pk'))
        returns = list(ConsumableReturn.objects.filter(issue__grn__in=grns).select_related('issue').order_by('created_at', 'pk'))
        received = sum((g.received_quantity or ZERO for g in grns), ZERO)
        issued = sum((i.quantity_issued or ZERO for i in issues), ZERO)
        returned = sum((r.quantity_returned or ZERO for r in returns), ZERO)
        first = grns[0]
        v = first.consumable_variety
        summary = {
            'consumableName': v.consumable.name if v else first.consumable_name,
            'category': v.consumable.category.name if v else first.category,
            'unit': v.consumable.unit if v else first.unit,
            **_variety_info(v), 'warehouse': first.warehouse,
            'warehouses': sorted({g.warehouse for g in grns}),
            'grnNumbers': [g.grn_number for g in grns],
            'receivedQty': float(received), 'issuedQty': float(issued),
            'returnedQty': float(returned), 'availableQty': float(received - issued + returned),
        }
        events = []
        for g in grns:
            events.append({
                'type': 'GRN', 'timestamp': g.created_at,
                'referenceNumber': g.grn_number, 'quantity': float(g.received_quantity or ZERO),
                'unit': g.unit, 'user': g.received_by, 'department': '', 'jobCard': '',
                'warehouse': g.warehouse, 'remarks': g.remarks,
                'supplier': g.supplier, 'receivedDate': (g.received_date or g.created_at.date()).isoformat(),
            })
        for i in issues:
            events.append({
                'type': 'Issue', 'timestamp': i.created_at,
                'referenceNumber': i.issue_number, 'quantity': float(i.quantity_issued or ZERO),
                'unit': i.unit, 'user': i.employee_name, 'department': i.department,
                'jobCard': i.job_card, 'warehouse': i.warehouse, 'remarks': i.remarks,
            })
        for r in returns:
            events.append({
                'type': 'Return', 'timestamp': r.created_at,
                'referenceNumber': r.return_number, 'quantity': float(r.quantity_returned or ZERO),
                'unit': r.unit, 'user': r.returned_by, 'department': r.issue.department,
                'jobCard': r.issue.job_card, 'warehouse': r.warehouse, 'remarks': r.remarks,
            })
        events.sort(key=lambda x: x['timestamp'], reverse=True)
        for e in events:
            stamp = timezone.localtime(e.pop('timestamp'))
            e['date'] = stamp.strftime('%Y-%m-%d')
            e['time'] = stamp.strftime('%H:%M:%S')
        return Response({'summary': summary, 'timeline': events})


# =====================================================================
# EDIT ENDPOINTS — PATCH only; no transaction is deleted or recreated.
# Source-aware issue/return edits require the allocation model above.
# =====================================================================

class ConsumableCategoryDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def patch(self, request, pk):
        obj = ConsumableCategory.objects.filter(pk=pk).first()
        if not obj:
            return _error('Category not found.', 404)
        ser = ConsumableCategorySerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class ConsumableMasterDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def patch(self, request, pk):
        obj = ConsumableMaster.objects.filter(pk=pk).first()
        if not obj:
            return _error('Consumable not found.', 404)
        ser = ConsumableMasterSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class ConsumableVarietyDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def patch(self, request, pk):
        obj = ConsumableVariety.objects.filter(pk=pk).first()
        if not obj:
            return _error('Variety not found.', 404)
        ser = ConsumableVarietySerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class ConsumableGRNDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def patch(self, request, pk):
        grn = ConsumableGRN.objects.select_for_update().filter(pk=pk).first()
        if not grn:
            return _error('GRN not found.', 404)
        forbidden = {'consumable_variety', 'consumableVariety', 'warehouse', 'grn_type',
                     'purchase_order_item', 'po_number', 'po_description', 'grn_number'}
        if forbidden.intersection(request.data):
            return _error('Cannot change GRN identity, variety or warehouse. Correct metadata or quantity only.')
        changes = {}
        if 'quantity' in request.data or 'received_quantity' in request.data:
            qty = _decimal(request.data.get('quantity', request.data.get('received_quantity')), 'quantity')
            original_used = ConsumableIssueAllocation.objects.filter(
                grn=grn, source_return__isnull=True
            ).aggregate(v=Sum('quantity'))['v'] or ZERO
            # Protect original units already allocated to issues (including returned ones).
            if qty < original_used:
                return _error(f'Cannot reduce GRN below {original_used}; this quantity has been issued.')
            changes.update(received_quantity=qty, ordered_quantity=qty)
        for key in ('supplier', 'supplier_invoice_number', 'received_by', 'remarks'):
            if key in request.data:
                changes[key] = _text(request.data[key])
        if 'received_date' in request.data:
            changes['received_date'] = serializers.DateField().run_validation(request.data['received_date'])
        if 'buffer_stock_limit' in request.data:
            raw = request.data['buffer_stock_limit']
            changes['buffer_stock_limit'] = None if raw in (None, '') else _decimal(raw, 'buffer_stock_limit', allow_zero=True)
        for key, val in changes.items():
            setattr(grn, key, val)
        if changes:
            grn.save(update_fields=[*changes, 'updated_at'])
        _alert_after_commit(grn.id)
        return Response({'success': True, 'data': ConsumableGRNSerializer(grn).data})


class ConsumableIssueDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def patch(self, request, pk):

        issue = (
            ConsumableIssue.objects
            .select_for_update()
            .select_related("grn")
            .filter(pk=pk)
            .first()
        )

        if not issue:
            return _error("Issue not found.", 404)

        grn = (
            ConsumableGRN.objects
            .select_for_update()
            .get(pk=issue.grn_id)
        )

        # --------------------------------------------------
        # LOCK EDITING IF ANY RETURN EXISTS
        # --------------------------------------------------
        has_returns = ConsumableReturn.objects.filter(
            issue=issue
        ).exists()

        if has_returns:
            return _error(
                "This issue cannot be edited because a return "
                "has already been recorded.",
                400
            )

        # --------------------------------------------------
        # UPDATE QUANTITY
        # --------------------------------------------------
        if (
            "quantity" in request.data
            or "quantity_issued" in request.data
        ):

            qty = _decimal(
                request.data.get(
                    "quantity",
                    request.data.get("quantity_issued")
                ),
                "quantity"
            )

            allocations = list(
                ConsumableIssueAllocation.objects
                .select_for_update()
                .filter(issue=issue)
            )

            if len(allocations) != 1:
                return _error(
                    "Issue allocation is missing or ambiguous. "
                    "Reconcile legacy records before editing."
                )

            allocation = allocations[0]

            old_qty = allocation.quantity

            # --------------------------------------------------
            # VALIDATE ADDITIONAL STOCK
            # --------------------------------------------------
            if qty > old_qty:

                source_balance = dict(
                    _source_balances(grn)
                )

                additional_qty = qty - old_qty

                available_from_source = source_balance.get(
                    allocation.source_return,
                    ZERO
                )

                if additional_qty > available_from_source:
                    return _error(
                        "Not enough unused stock in the "
                        "original issue source."
                    )

            allocation.quantity = qty
            allocation.save(
                update_fields=["quantity"]
            )

            issue.quantity_issued = qty

        # --------------------------------------------------
        # UPDATE OTHER DETAILS
        # --------------------------------------------------
        field_mapping = {
            "department": "department",
            "employeeName": "employee_name",
            "employee_name": "employee_name",
            "jobCard": "job_card",
            "job_card": "job_card",
            "remarks": "remarks",
        }

        for frontend_field, model_field in field_mapping.items():

            if frontend_field in request.data:

                setattr(
                    issue,
                    model_field,
                    _text(request.data[frontend_field])
                )

        issue.save()

        # --------------------------------------------------
        # BUFFER STOCK ALERT
        # --------------------------------------------------
        _alert_after_commit(
            grn.id,
            issue.id
        )

        return Response({
            "success": True,
            "message": "Issue updated successfully.",
            "data": ConsumableIssueSerializer(issue).data
        })



class ConsumableReturnDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def patch(self, request, pk):

        # --------------------------------------------------
        # 1. FIND RETURN
        # --------------------------------------------------
        ret = (
            ConsumableReturn.objects
            .select_related("issue__grn")
            .filter(pk=pk)
            .first()
        )

        if not ret:
            return _error("Return not found.", 404)

        # --------------------------------------------------
        # 2. LOCK GRN, ISSUE AND RETURN
        # --------------------------------------------------
        grn = (
            ConsumableGRN.objects
            .select_for_update()
            .get(pk=ret.issue.grn_id)
        )

        issue = (
            ConsumableIssue.objects
            .select_for_update()
            .get(pk=ret.issue_id)
        )

        ret = (
            ConsumableReturn.objects
            .select_for_update()
            .get(pk=pk)
        )

        # --------------------------------------------------
        # 3. CHECK WHETHER RETURN WAS REISSUED
        # --------------------------------------------------
        if _return_is_reissued(ret):
            return _error(
                "This return cannot be edited because "
                "some of its stock has already been reissued."
            )

        # --------------------------------------------------
        # 4. VALIDATE RETURN QUANTITY
        # --------------------------------------------------
        qty = ret.quantity_returned

        if any(
            key in request.data
            for key in (
                "quantity",
                "quantity_returned",
                "returnQty",
            )
        ):
            qty = _decimal(
                request.data.get(
                    "returnQty",
                    request.data.get(
                        "quantity",
                        request.data.get("quantity_returned")
                    )
                ),
                "returnQty"
            )

            if qty <= ZERO:
                return _error(
                    "Return quantity must be greater than zero."
                )

            # Other returns against the same issue
            others = (
                ConsumableReturn.objects
                .filter(issue=issue)
                .exclude(pk=ret.pk)
                .aggregate(total=Sum("quantity_returned"))["total"]
                or ZERO
            )

            if qty + others > issue.quantity_issued:
                available = max(
                    issue.quantity_issued - others,
                    ZERO
                )

                return _error(
                    f"Return quantity cannot exceed "
                    f"{available} {issue.unit}."
                )

            ret.quantity_returned = qty

        # --------------------------------------------------
        # 5. UPDATE RETURNED BY
        # --------------------------------------------------
        if "returnedBy" in request.data:
            ret.returned_by = _text(
                request.data["returnedBy"]
            )

        elif "returned_by" in request.data:
            ret.returned_by = _text(
                request.data["returned_by"]
            )

        # --------------------------------------------------
        # 6. UPDATE REMARKS
        # --------------------------------------------------
        if "remarks" in request.data:
            ret.remarks = _text(
                request.data["remarks"]
            )

        # --------------------------------------------------
        # 7. SAVE RETURN
        # --------------------------------------------------
        ret.save()

        # Update parent issue status
        _sync_issue_status(issue)

        # Recalculate stock alert after commit
        _alert_after_commit(grn.id)

        return Response({
            "success": True,
            "message": "Consumable return updated successfully.",
            "data": ConsumableReturnSerializer(ret).data,
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


from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status


class CompanyBankDetailsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        bank_details = settings.COMPANY_BANK_DETAILS

        return Response(
            {
                "success": True,
                "message": "Company bank details retrieved successfully",
                "data": bank_details,
            },
            status=status.HTTP_200_OK,
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
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum, Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated


class ProjectIntegrationCreateAPIView(APIView):
    """
    POST /erp/material/project-po-integration/create/

    Request:
    {
        "projectId": 1,
        "rows": [
            {
                "poItemId": 42,
                "sourceType": "real",
                "quantity": 5
            },
            {
                "poItemId": 7,
                "sourceType": "dummy",
                "quantity": 3
            }
        ]
    }

    Features:
    1. Validates project and PO items.
    2. Validates integration quantities.
    3. Creates BOMPOIntegration records.
    4. Updates existing MaterialStock records when the GRN
       was created before project integration.
    5. Supports real and dummy PO items.
    6. Executes all changes inside one transaction.
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request):

        # =========================================================
        # 1. VALIDATE PROJECT
        # =========================================================

        project_id = request.data.get("projectId")
        rows = request.data.get("rows") or []

        if not project_id:
            return Response(
                {
                    "success": False,
                    "message": "projectId is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            project = Project.objects.get(id=project_id)

        except (Project.DoesNotExist, ValueError, TypeError):
            return Response(
                {
                    "success": False,
                    "message": "Project not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if not isinstance(rows, list) or not rows:
            return Response(
                {
                    "success": False,
                    "message": "No valid rows provided.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # =========================================================
        # 2. VALIDATE REQUEST ROWS
        # =========================================================

        errors = []

        for idx, row in enumerate(rows, start=1):

            if not isinstance(row, dict):
                errors.append(
                    {
                        "row": idx,
                        "error": "Each row must be an object.",
                    }
                )
                continue

            if row.get("sourceType") not in ("real", "dummy"):
                errors.append(
                    {
                        "row": idx,
                        "error": "sourceType must be real or dummy.",
                    }
                )

            if row.get("poItemId") in (None, ""):
                errors.append(
                    {
                        "row": idx,
                        "error": "poItemId is required.",
                    }
                )

        if errors:
            return Response(
                {
                    "success": False,
                    "message": "One or more rows failed validation.",
                    "errors": errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # =========================================================
        # 3. FETCH REAL AND DUMMY PO ITEMS
        # =========================================================

        real_ids = {
            row["poItemId"]
            for row in rows
            if row.get("sourceType") == "real"
        }

        dummy_ids = {
            row["poItemId"]
            for row in rows
            if row.get("sourceType") == "dummy"
        }

        real_map = {
            item.id: item
            for item in (
                PurchaseOrderItem.objects
                .filter(id__in=real_ids)
                .select_related("purchase_order")
                .order_by("id")
            )
        }

        dummy_map = {
            item.id: item
            for item in (
                DummyPurchaseOrderItem.objects
                .filter(id__in=dummy_ids)
                .select_related("dummy_po")
                .order_by("id")
            )
        }

        # =========================================================
        # 4. FETCH EXISTING INTEGRATED QUANTITIES
        # =========================================================

        real_integrated = {
            item["purchase_order_item_id"]: item["total"]
            for item in (
                BOMPOIntegration.objects
                .filter(
                    purchase_order_item_id__in=real_ids
                )
                .values("purchase_order_item_id")
                .annotate(total=Sum("quantity"))
            )
        }

        dummy_integrated = {
            item["dummy_purchase_order_item_id"]: item["total"]
            for item in (
                BOMPOIntegration.objects
                .filter(
                    dummy_purchase_order_item_id__in=dummy_ids
                )
                .values("dummy_purchase_order_item_id")
                .annotate(total=Sum("quantity"))
            )
        }

        running_real = dict(real_integrated)
        running_dummy = dict(dummy_integrated)

        prepared = []

        # =========================================================
        # 5. VALIDATE INTEGRATION QUANTITIES
        # =========================================================

        for idx, row in enumerate(rows, start=1):

            source = row.get("sourceType")
            po_item_id = row.get("poItemId")
            raw_qty = row.get("quantity")

            try:
                qty = Decimal(str(raw_qty))

            except (InvalidOperation, TypeError, ValueError):
                errors.append(
                    {
                        "row": idx,
                        "error": "Invalid quantity.",
                    }
                )
                continue

            if not qty.is_finite() or qty <= 0:
                errors.append(
                    {
                        "row": idx,
                        "error": "Quantity must be greater than 0.",
                    }
                )
                continue

            if source == "real":

                po_item = real_map.get(po_item_id)

                if not po_item:
                    errors.append(
                        {
                            "row": idx,
                            "error": "PO item not found.",
                        }
                    )
                    continue

                # Preserve the existing confirmed-PO requirement.
                if (
                    po_item.purchase_order.status
                    != PurchaseOrder.Status.CONFIRMED
                ):
                    errors.append(
                        {
                            "row": idx,
                            "error": "PO is not confirmed.",
                        }
                    )
                    continue

                po_qty = po_item.quantity or Decimal("0")

                already_integrated = running_real.get(
                    po_item.id,
                    Decimal("0"),
                )

                po_remaining = po_qty - already_integrated

                if qty > po_remaining:
                    errors.append(
                        {
                            "row": idx,
                            "error": (
                                "Quantity exceeds PO remaining "
                                f"({po_remaining})."
                            ),
                        }
                    )
                    continue

                running_real[po_item.id] = (
                    already_integrated + qty
                )

                prepared.append(
                    {
                        "purchase_order_item": po_item,
                        "dummy_purchase_order_item": None,
                        "quantity": qty,
                    }
                )

            elif source == "dummy":

                dummy_item = dummy_map.get(po_item_id)

                if not dummy_item:
                    errors.append(
                        {
                            "row": idx,
                            "error": "Dummy PO item not found.",
                        }
                    )
                    continue

                dummy_qty = dummy_item.quantity or Decimal("0")

                already_integrated = running_dummy.get(
                    dummy_item.id,
                    Decimal("0"),
                )

                po_remaining = dummy_qty - already_integrated

                if qty > po_remaining:
                    errors.append(
                        {
                            "row": idx,
                            "error": (
                                "Quantity exceeds dummy PO remaining "
                                f"({po_remaining})."
                            ),
                        }
                    )
                    continue

                running_dummy[dummy_item.id] = (
                    already_integrated + qty
                )

                prepared.append(
                    {
                        "purchase_order_item": None,
                        "dummy_purchase_order_item": dummy_item,
                        "quantity": qty,
                    }
                )

        # =========================================================
        # 6. STOP IF ANY VALIDATION FAILED
        # =========================================================

        if errors:
            return Response(
                {
                    "success": False,
                    "message": "One or more rows failed validation.",
                    "errors": errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # =========================================================
        # 7. CREATE PROJECT INTEGRATIONS
        # =========================================================

        created_ids = []

        for entry in prepared:

            integration = BOMPOIntegration.objects.create(
                project=project,
                bom_item=None,
                purchase_order_item=entry[
                    "purchase_order_item"
                ],
                dummy_purchase_order_item=entry[
                    "dummy_purchase_order_item"
                ],
                quantity=entry["quantity"],
                is_dummy=(
                    entry["dummy_purchase_order_item"] is not None
                ),
            )

            created_ids.append(integration.id)

        # =========================================================
        # 8. BACKFILL PROJECT ID TO EXISTING MATERIAL STOCK
        # =========================================================
        #
        # If GRN was created before integration:
        #
        # MaterialStock.project_id = NULL
        #
        # After integration:
        #
        # MaterialStock.project_id = project.id
        #
        # Do not modify quantities, movements, or GRN records.
        # =========================================================

        real_item_ids = {
            entry["purchase_order_item"].id
            for entry in prepared
            if entry["purchase_order_item"] is not None
        }

        dummy_item_ids = {
            entry["dummy_purchase_order_item"].id
            for entry in prepared
            if entry["dummy_purchase_order_item"] is not None
        }

        stock_filter = Q()

        if real_item_ids:
            stock_filter |= Q(
                purchase_order_item_id__in=real_item_ids
            )

        if dummy_item_ids:
            stock_filter |= Q(
                dummy_purchase_order_item_id__in=dummy_item_ids
            )

        updated_stocks = 0

        if real_item_ids or dummy_item_ids:

            updated_stocks = (
                MaterialStock.objects
                .filter(
                    stock_filter,
                    project__isnull=True,
                )
                .update(
                    project=project,
                )
            )

        # =========================================================
        # 9. RESPONSE
        # =========================================================

        return Response(
            {
                "success": True,
                "message": (
                    f"Saved {len(created_ids)} integrations "
                    f"for project {project.id}."
                ),
                "projectId": project.id,
                "integrationIds": created_ids,
                "updatedStockRecords": updated_stocks,
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

    permission_classes = [AllowAny]

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
# FILTER-OPTIONS RESOLVER — Production Assembly Integration
# ---------------------------------------------------------------------
def _resolve_filter_options__assembly(request):
    """
    Dropdown values for the Production Assembly Integration page.

    Query params:
        ?search=<text>   optional — case-insensitive, matches
                         project code, project name, drawing number,
                         material name, or material code.

    When `search` is supplied, every dropdown returned is narrowed
    to values that exist in assemblies matching the search term.
    This is what makes a 2M-project picker usable: the client sends
    what the user typed, the server answers with only the matching
    options.
    """

    search = (request.query_params.get("search") or "").strip()

    # ---- Base queryset ----
    assemblies = (
        Assembly.objects
        .select_related("project")
        .prefetch_related("inputs")
        .all()
    )

    # ---- Apply search at the Assembly level ----
    if search:
        assemblies = assemblies.filter(
            models.Q(project__code__icontains=search)
            | models.Q(project__name__icontains=search)
            | models.Q(assembly_id__icontains=search)
            | models.Q(inputs__drawing_number__icontains=search)
            | models.Q(inputs__material_name__icontains=search)
            | models.Q(inputs__material_code__icontains=search)
        ).distinct()

    project_set   = set()
    thickness_set = set()
    size_set      = set()
    unit_set      = set()
    status_set    = set()

    # Cap what we scan. With 2M assemblies, iterating every row to
    # build the option sets is wasteful — the options only need to
    # reflect what the user is currently looking at. 2,000 is plenty
    # to cover a realistic filtered view.
    MAX_SCAN = 2000
    scanned = 0

    for asm in assemblies.iterator(chunk_size=500):

        scanned += 1
        if scanned > MAX_SCAN:
            break

        if asm.project:
            project_set.add(asm.project.code)

        status_set.add(asm.status)

        for inp in asm.inputs.all():

            if inp.source_type != "material":
                continue

            thickness_set |= _non_empty([inp.thickness])

            if inp.length and inp.width:
                size_set.add(f"{inp.length} × {inp.width}")

            unit_set |= _non_empty([inp.unit])

    payload = {}

    if project_set:
        # Sort project codes so the dropdown is deterministic.
        payload["project"] = sorted(project_set)

    if thickness_set:
        payload["thickness"] = _sort_numeric(thickness_set)

    if size_set:
        payload["size"] = sorted(size_set)

    if unit_set:
        payload["unit"] = sorted(unit_set)

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
       "assembly":          _resolve_filter_options__assembly, 
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

    Single rule:
      - If the stock lot has a project → allowed.
      - If not → rejected with a project error.
    No DWG/BOM check. No BOMPOIntegration lookup.
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
                {
                    "success": False,
                    "message": "Quantity must be greater than 0.",
                },
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
                .select_for_update(of=("self",))
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

        # ============================================================
        # PROJECT CHECK — the only gate
        # ============================================================
        if stock.project is None:
            return Response(
                {
                    "success": False,
                    "message": (
                        "This material is not linked to any project. "
                        "Please integrate it with a project before issuing."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        resolved_project = stock.project

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
            vendor_contact = str(
                request.data.get("vendorContact", "")
            ).strip()
            job_work_location = str(
                request.data.get("jobWorkLocation", "")
            ).strip()
            erd_raw = request.data.get("expectedReturnDate")

            if not vendor:
                return Response(
                    {"success": False, "message": "Vendor is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not job_work_location:
                return Response(
                    {
                        "success": False,
                        "message": "Job work location is required.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not erd_raw:
                return Response(
                    {
                        "success": False,
                        "message": "Expected return date is required.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                expected_return_date = date.fromisoformat(str(erd_raw))
            except (TypeError, ValueError):
                return Response(
                    {
                        "success": False,
                        "message": "Invalid expected return date.",
                    },
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
                .select_for_update(of=("self",))
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

    Side effects:
      - Completed input returns to the source lot as an IN movement
      - Each remaining piece becomes its own MaterialStock lot
      - When reworkRequired == "Yes" the lot is flagged AND a
        ReworkRecord is created in the Rework module
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request, issue_id):

        # ============================================================
        # 1. LOCK THE ISSUE ROW
        # ============================================================
        try:
            issue = (
                JobWorkIssue.objects
                .select_for_update(of=("self",))
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
        # rework_required == "Yes", the lot is flagged AND a
        # ReworkRecord is created in the Rework module.
        # ============================================================
        for p in cleaned_remaining:

            is_rework = (p["rework_required"] == "Yes")

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
                weight=p.get("weight") or Decimal("0"),
                heat_number="",
                plate_number=p["plate_no"],
                original_qty=Decimal("0"),
                uom= "Nos",
                project=issue.project,
                dwg_description=issue.dwg_description or "",
                revision=issue.revision or "",
                stock_status=MaterialStock.StockStatus.REMAINING,
                rework_required=is_rework,
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

                    # One remaining piece = one unit of stock.
                    quantity=Decimal("1"),

                    reference_type="JobWorkReceive",
                    reference_id=receive.id,
                    remarks=p.get("remarks", ""),
                    created_by=request.user,
                )

            # --------------------------------------------------------
            # 9b. Flag for Rework → create ReworkRecord
            # --------------------------------------------------------
            if is_rework:
                remaining_row = (
                    JobWorkReceiveRemaining.objects
                    .filter(receive=receive, plate_no=p["plate_no"])
                    .first()
                )

                if remaining_row is not None:
                    create_rework_from_job_work(
                        job_work_receive=receive,
                        job_work_remaining=remaining_row,
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
                .select_for_update(of=("self",))
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



# =====================================================================
# PRODUCTION ASSEMBLY INTEGRATION
# =====================================================================

from .models import (
    Assembly,
    AssemblyInput,
    AssemblyProcess,
    AssemblyNumberSettings,
    JobWorkReceivePiece,
    ProductionIssue,
)


# ---------------------------------------------------------------------
# ASSEMBLY ID GENERATOR — auto-seeds counter on first call
# ---------------------------------------------------------------------
def generate_assembly_id():
    """
    Returns the next Assembly ID.

    - Locks the active settings row and increments the counter.
    - Auto-creates the settings row on first use → ASM001.
    - Padding is a MINIMUM: ASM999 → ASM1000 works.
    - Must be called inside a transaction (select_for_update).
    """
    settings_obj = (
        AssemblyNumberSettings.objects
        .select_for_update()
        .filter(is_active=True)
        .first()
    )

    if settings_obj is None:
        try:
            settings_obj = AssemblyNumberSettings.objects.create(
                prefix="ASM",
                next_number=1,
                number_padding=3,
                is_active=True,
            )
        except IntegrityError:
            settings_obj = (
                AssemblyNumberSettings.objects
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
# AVAILABILITY HELPERS
# ---------------------------------------------------------------------
ASSEMBLY_PRODUCED_QTY = Decimal("1")


def _material_used_in_other_assemblies(piece_id, exclude_assembly_id=None):
    qs = AssemblyInput.objects.filter(
        source_type="material",
        job_work_piece_id=piece_id,
    )
    if exclude_assembly_id:
        qs = qs.exclude(assembly_id=exclude_assembly_id)
    return qs.aggregate(total=Sum("use_qty"))["total"] or Decimal("0")


def _piece_received_qty(piece_id):
    try:
        piece = JobWorkReceivePiece.objects.get(id=piece_id)
    except JobWorkReceivePiece.DoesNotExist:
        return Decimal("0")
    return piece.qty or Decimal("0")


def _assembly_used_in_other_assemblies(assembly_id, exclude_assembly_id=None):
    qs = AssemblyInput.objects.filter(
        source_type="assembly",
        source_assembly_id=assembly_id,
    )
    if exclude_assembly_id:
        qs = qs.exclude(assembly_id=exclude_assembly_id)
    return qs.aggregate(total=Sum("use_qty"))["total"] or Decimal("0")

def _material_availability(piece_id, exclude_assembly_id=None):
    
    received = _piece_received_qty(piece_id)

    used_in_asm = _material_used_in_other_assemblies(
        piece_id, exclude_assembly_id
    )

    return max(received - used_in_asm, Decimal("0"))

def _assembly_availability(assembly_id, exclude_assembly_id=None):
    used = _assembly_used_in_other_assemblies(
        assembly_id, exclude_assembly_id
    )
    return max(ASSEMBLY_PRODUCED_QTY - used, Decimal("0"))


# ---------------------------------------------------------------------
# LIST + CREATE
# ---------------------------------------------------------------------
class AssemblyListCreateAPIView(APIView):
    """
    GET  /erp/material/assembly/
    POST /erp/material/assembly/
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    # ---------------- GET ----------------
    def get(self, request):
        qs = (
            Assembly.objects
            .select_related("project")
            .prefetch_related("inputs", "processes")
            .all()
            .order_by("-created_at")
        )

        return Response(
            {
                "success": True,
                "data": AssemblySerializer(qs, many=True).data,
            },
            status=status.HTTP_200_OK,
        )

    # ---------------- POST ----------------
    @transaction.atomic
    def post(self, request):

        project_id = request.data.get("projectId")
        inputs = request.data.get("inputs") or []
        processes = request.data.get("processes") or []

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

        if not inputs:
            return Response(
                {
                    "success": False,
                    "message": "At least one input is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not processes:
            return Response(
                {
                    "success": False,
                    "message": "At least one process is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---- Collect referenced IDs ----
        material_ids = [
            r.get("jobWorkPieceId")
            for r in inputs
            if r.get("sourceType") == "material"
        ]
        assembly_ids = [
            r.get("sourceAssemblyId")
            for r in inputs
            if r.get("sourceType") == "assembly"
        ]

        material_map = {
            p.id: p for p in (
                JobWorkReceivePiece.objects
                .filter(id__in=material_ids)
                .select_related("receive")
            )
        }

        assembly_map = {
            a.id: a for a in Assembly.objects.filter(id__in=assembly_ids)
        }

        # ---- Validate every input ----
        for idx, r in enumerate(inputs, start=1):

            src_type = r.get("sourceType")

            try:
                qty = Decimal(str(r.get("useQty", "0")))
            except (InvalidOperation, TypeError, ValueError):
                return Response(
                    {
                        "success": False,
                        "message": f"Input #{idx}: invalid quantity.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if qty <= 0:
                return Response(
                    {
                        "success": False,
                        "message": f"Input #{idx}: quantity must be > 0.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if src_type == "material":
                piece = material_map.get(r.get("jobWorkPieceId"))
                if not piece:
                    return Response(
                        {
                            "success": False,
                            "message": (
                                f"Input #{idx}: material not found."
                            ),
                        },
                        status=status.HTTP_404_NOT_FOUND,
                    )

                available = _material_availability(piece.id)
                if qty > available:
                    return Response(
                        {
                            "success": False,
                            "message": (
                                f"Input #{idx}: quantity exceeds "
                                f"available ({available})."
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            elif src_type == "assembly":
                sub = assembly_map.get(r.get("sourceAssemblyId"))
                if not sub:
                    return Response(
                        {
                            "success": False,
                            "message": (
                                f"Input #{idx}: assembly not found."
                            ),
                        },
                        status=status.HTTP_404_NOT_FOUND,
                    )

                available = _assembly_availability(sub.id)
                if qty > available:
                    return Response(
                        {
                            "success": False,
                            "message": (
                                f"Input #{idx}: quantity exceeds "
                                f"available ({available})."
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            else:
                return Response(
                    {
                        "success": False,
                        "message": f"Input #{idx}: unknown sourceType.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # ---- Generate Assembly ID ----
        assembly_id = generate_assembly_id()

        # ---- Create the Assembly header ----
        assembly = Assembly.objects.create(
            assembly_id=assembly_id,
            project=project,
            status=Assembly.Status.PLANNED,
            created_by=request.user,
        )

        # ---- Create inputs ----
        for r in inputs:
            src_type = r.get("sourceType")
            qty = Decimal(str(r.get("useQty")))

            if src_type == "material":
                piece = material_map[r.get("jobWorkPieceId")]
                receive = piece.receive

                AssemblyInput.objects.create(
                    assembly=assembly,
                    source_type="material",
                    job_work_piece=piece,
                    use_qty=qty,
                    material_name=receive.material or "",
                    material_code=receive.material_code or "",
                    unit=receive.uom or "Nos",
                    thickness=piece.thickness or receive.thickness or "",
                    length=piece.length or "",
                    width=piece.width or "",
                    drawing_number=receive.dwg_description or "",
                )

            else:
                sub = assembly_map[r.get("sourceAssemblyId")]

                AssemblyInput.objects.create(
                    assembly=assembly,
                    source_type="assembly",
                    source_assembly=sub,
                    use_qty=qty,
                    material_name=sub.assembly_id,
                    material_code="—",
                    unit="No.",
                )

        # ---- Create processes ----
        for idx, p in enumerate(processes, start=1):

            name = str(p.get("name", "")).strip()
            pid = str(p.get("processId", "")).strip()

            if not name or not pid:
                continue

            exec_type = str(
                p.get("executionType", "In-House")
            ).strip()
            exec_unit = str(p.get("executionUnit", "")).strip()

            AssemblyProcess.objects.create(
                assembly=assembly,
                sequence=idx,
                name=name,
                process_id=pid,
                qc_required=bool(p.get("qcRequired", False)),
                execution_type=(
                    "Outsourcing"
                    if exec_type == "Outsourcing"
                    else "In-House"
                ),
                execution_unit=(
                    exec_unit if exec_type != "Outsourcing" else ""
                ),
                vendor=str(p.get("vendor", "")).strip(),
                vendor_contact=str(
                    p.get("vendorContact", "")
                ).strip(),
                vendor_location=str(
                    p.get("vendorLocation", "")
                ).strip(),
                expected_return_date=(
                    p.get("expectedReturnDate") or None
                ),
                outsourcing_remarks=str(
                    p.get("outsourcingRemarks", "")
                ).strip(),
            )

        return Response(
            {
                "success": True,
                "message": f"{assembly.assembly_id} created.",
                "data": AssemblySerializer(assembly).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------
# DETAIL — GET / PATCH / DELETE
# ---------------------------------------------------------------------
class AssemblyDetailAPIView(APIView):

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def _get(self, assembly_id):
        try:
            return (
                Assembly.objects
                .select_related("project")
                .prefetch_related("inputs", "processes")
                .get(assembly_id=assembly_id)
            )
        except Assembly.DoesNotExist:
            return None

    # ---------------- GET ----------------
    def get(self, request, assembly_id):
        asm = self._get(assembly_id)
        if not asm:
            return Response(
                {"success": False, "message": "Assembly not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {"success": True, "data": AssemblySerializer(asm).data},
            status=status.HTTP_200_OK,
        )

    # ---------------- PATCH ----------------
    @transaction.atomic
    def patch(self, request, assembly_id):

        asm = (
            Assembly.objects
            .select_for_update()
            .filter(assembly_id=assembly_id)
            .first()
        )

        if not asm:
            return Response(
                {"success": False, "message": "Assembly not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if asm.status != Assembly.Status.PLANNED:
            return Response(
                {
                    "success": False,
                    "message": (
                        "This assembly can only be edited while it is "
                        "Planned."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        inputs = request.data.get("inputs")
        processes = request.data.get("processes")

        # ---- Replace inputs ----
        if isinstance(inputs, list):

            asm.inputs.all().delete()

            material_ids = [
                r.get("jobWorkPieceId")
                for r in inputs
                if r.get("sourceType") == "material"
            ]
            assembly_ids = [
                r.get("sourceAssemblyId")
                for r in inputs
                if r.get("sourceType") == "assembly"
            ]

            material_map = {
                p.id: p for p in (
                    JobWorkReceivePiece.objects
                    .filter(id__in=material_ids)
                    .select_related("receive")
                )
            }

            assembly_map = {
                a.id: a for a in Assembly.objects.filter(
                    id__in=assembly_ids
                )
            }

            for idx, r in enumerate(inputs, start=1):

                src_type = r.get("sourceType")

                try:
                    qty = Decimal(str(r.get("useQty", "0")))
                except (InvalidOperation, TypeError, ValueError):
                    return Response(
                        {
                            "success": False,
                            "message": (
                                f"Input #{idx}: invalid quantity."
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if qty <= 0:
                    continue

                if src_type == "material":

                    piece = material_map.get(r.get("jobWorkPieceId"))
                    if not piece:
                        continue

                    available = _material_availability(
                        piece.id, asm.id
                    )
                    if qty > available:
                        return Response(
                            {
                                "success": False,
                                "message": (
                                    f"Input #{idx}: quantity exceeds "
                                    f"available ({available})."
                                ),
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    receive = piece.receive

                    AssemblyInput.objects.create(
                        assembly=asm,
                        source_type="material",
                        job_work_piece=piece,
                        use_qty=qty,
                        material_name=receive.material or "",
                        material_code=receive.material_code or "",
                        unit=receive.uom or "Nos",
                        thickness=(
                            piece.thickness
                            or receive.thickness
                            or ""
                        ),
                        length=piece.length or "",
                        width=piece.width or "",
                        drawing_number=receive.dwg_description or "",
                    )

                elif src_type == "assembly":

                    sub = assembly_map.get(r.get("sourceAssemblyId"))
                    if not sub:
                        continue

                    available = _assembly_availability(sub.id, asm.id)
                    if qty > available:
                        return Response(
                            {
                                "success": False,
                                "message": (
                                    f"Input #{idx}: quantity exceeds "
                                    f"available ({available})."
                                ),
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    AssemblyInput.objects.create(
                        assembly=asm,
                        source_type="assembly",
                        source_assembly=sub,
                        use_qty=qty,
                        material_name=sub.assembly_id,
                        material_code="—",
                        unit="No.",
                    )

        # ---- Replace processes ----
        if isinstance(processes, list):

            asm.processes.all().delete()

            for idx, p in enumerate(processes, start=1):

                name = str(p.get("name", "")).strip()
                pid = str(p.get("processId", "")).strip()

                if not name or not pid:
                    continue

                exec_type = str(
                    p.get("executionType", "In-House")
                ).strip()

                AssemblyProcess.objects.create(
                    assembly=asm,
                    sequence=idx,
                    name=name,
                    process_id=pid,
                    qc_required=bool(p.get("qcRequired", False)),
                    execution_type=(
                        "Outsourcing"
                        if exec_type == "Outsourcing"
                        else "In-House"
                    ),
                    execution_unit=(
                        str(p.get("executionUnit", "")).strip()
                        if exec_type != "Outsourcing"
                        else ""
                    ),
                    vendor=str(p.get("vendor", "")).strip(),
                    vendor_contact=str(
                        p.get("vendorContact", "")
                    ).strip(),
                    vendor_location=str(
                        p.get("vendorLocation", "")
                    ).strip(),
                    expected_return_date=(
                        p.get("expectedReturnDate") or None
                    ),
                    outsourcing_remarks=str(
                        p.get("outsourcingRemarks", "")
                    ).strip(),
                )

        asm.save()

        asm = self._get(assembly_id)

        return Response(
            {
                "success": True,
                "message": f"{asm.assembly_id} updated.",
                "data": AssemblySerializer(asm).data,
            },
            status=status.HTTP_200_OK,
        )

    # ---------------- DELETE ----------------
    @transaction.atomic
    def delete(self, request, assembly_id):

        asm = (
            Assembly.objects
            .select_for_update()
            .filter(assembly_id=assembly_id)
            .first()
        )

        if not asm:
            return Response(
                {"success": False, "message": "Assembly not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if asm.status != Assembly.Status.PLANNED:
            return Response(
                {
                    "success": False,
                    "message": (
                        "This assembly can only be deleted while it is "
                        "Planned."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        dependent = (
            AssemblyInput.objects
            .filter(
                source_type="assembly",
                source_assembly=asm,
            )
            .select_related("assembly")
            .first()
        )

        if dependent:
            return Response(
                {
                    "success": False,
                    "message": (
                        f"This assembly can't be deleted because "
                        f"{dependent.assembly.assembly_id} uses it."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        asm.delete()

        return Response(
            {
                "success": True,
                "message": f"{assembly_id} deleted.",
            },
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------
# SOURCES — available inputs for the wizard
# ---------------------------------------------------------------------
class AssemblySourcesListAPIView(APIView):
    """
    GET /erp/material/assembly/sources/?projectId=<id>
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):

        project_id = request.query_params.get("projectId")
        exclude_assembly_id = request.query_params.get(
            "excludeAssemblyId"
        )

        if not project_id:
            return Response(
                {"success": False, "message": "projectId is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---- Materials ----
        pieces = (
            JobWorkReceivePiece.objects
            .select_related(
                "receive",
                "receive__project",
                "receive__issue",
            )
            .filter(receive__project_id=project_id)
            .all()
        )

        material_rows = []

        for piece in pieces:

            available = _material_availability(
                piece.id, exclude_assembly_id
            )
            if available <= 0:
                continue

            receive = piece.receive

            material_rows.append({
                "id": piece.id,
                "materialName": receive.material or "",
                "materialCode": receive.material_code or "",
                "unit": receive.uom or "Nos",
                "thickness": (
                    piece.thickness or receive.thickness or ""
                ),
                "length": piece.length or "",
                "width": piece.width or "",
                "drawingNumber": receive.dwg_description or "",
                "jobWorkId": receive.job_work_id or "",
                "poNumber": receive.po_number or "",
                "availableQty": float(available),
                "receivedQty": float(piece.qty or 0),
            })

        # ---- Assemblies ----
        assembly_qs = (
            Assembly.objects
            .select_related("project")
            .filter(project_id=project_id)
        )

        if exclude_assembly_id:
            assembly_qs = assembly_qs.exclude(
                id=exclude_assembly_id
            )

        assembly_rows = []

        for sub in assembly_qs:

            available = _assembly_availability(
                sub.id, exclude_assembly_id
            )
            if available <= 0:
                continue

            assembly_rows.append({
                "id": sub.id,
                "assemblyId": sub.assembly_id,
                "project": (
                    sub.project.code if sub.project else ""
                ),
                "status": sub.status,
                "availableQty": float(available),
            })

        return Response(
            {
                "success": True,
                "data": {
                    "materials": material_rows,
                    "assemblies": assembly_rows,
                },
            },
            status=status.HTTP_200_OK,
        )



# =====================================================================
# ASSEMBLY — PROJECT PICKER SOURCE
# ---------------------------------------------------------------
# Returns only projects that have at least one ProductionIssue.
# That's the definition of "ready to be assembled" — the project
# already has material sitting in production.
#
# GET /erp/material/assembly/projects/?search=bhel
# =====================================================================
# =====================================================================
# ASSEMBLY — PROJECT PICKER SOURCE
# -----------------------------------------------------------------
# Returns only projects that have at least one ProductionIssue
# (i.e. projects with physical material already sitting in
# production), along with the aggregated availability of that
# material for building new assemblies.
#
# Availability model (same as AssemblyListCreateAPIView):
#     available = received − used_in_assemblies − issued_to_production
#
#   received              → sum of JobWorkReceivePiece.qty for all
#                           pieces belonging to the project
#   used_in_assemblies    → sum of AssemblyInput.use_qty across all
#                           assemblies that already consume those pieces
#   issued_to_production  → sum of ProductionIssue.issued_qty for
#                           those pieces (movement out of the pool
#                           that is not tied to an assembly input)
#
# GET /erp/material/assembly/projects/?search=bhel
# =====================================================================
class AssemblyProjectListAPIView(APIView):
    """
    Searchable list of projects that have issued production material.

    Query params:
        ?search=<text>   optional — matches project code or name
                         (case-insensitive, contains).

    Availability model
    ------------------
    A project's material pool is:

        received              → sum of JobWorkReceivePiece.qty for
                                every piece belonging to the project
        used_in_assemblies    → sum of AssemblyInput.use_qty for
                                every material input in any assembly
                                already created from those pieces
        available             → received − used_in_assemblies

    Note: `ProductionIssue` rows are NOT subtracted. Issuing a
    received piece to production is the handoff that puts the piece
    where the assembly step can pick it up — it's not a consumption.
    Subtracting it here would double-count the same physical piece
    (once as "issued", once as "used in assembly") and zero out the
    pool for projects that follow the pipeline:

        Job Work Receive → Issue to Production → Assembly

    Response:
        {
          "success": true,
          "data": [
            {
              "id": 1,
              "code": "BHEL-032",
              "name": "BHEL Unit 32",
              "receivedQty": 30.0,
              "usedInAssembliesQty": 19.0,
              "issuedToProductionQty": 0.0,
              "availableQty": 11.0
            },
            ...
          ]
        }
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):

        search = (request.query_params.get("search") or "").strip()

        # ---------------------------------------------------------
        # 1. Projects that have at least one ProductionIssue
        # ---------------------------------------------------------
        projects_qs = (
            Project.objects
            .filter(production_issues__isnull=False)
            .distinct()
            .order_by("code")
        )

        if search:
            projects_qs = projects_qs.filter(
                models.Q(code__icontains=search)
                | models.Q(name__icontains=search)
            )

        # ---------------------------------------------------------
        # 2. Pre-aggregate what we need, project by project
        #
        # We do this in bulk to avoid N+1 queries: for each project
        # we want the ids of all its received pieces, then a single
        # aggregate over those pieces for "received" and "used".
        # ---------------------------------------------------------

        data = []

        for project in projects_qs:

            # ---- Pieces belonging to this project ----
            piece_ids = list(
                JobWorkReceivePiece.objects
                .filter(receive__project=project)
                .values_list("id", flat=True)
            )

            if not piece_ids:
                data.append({
                    "id": project.id,
                    "code": project.code,
                    "name": project.name,
                    "receivedQty": 0.0,
                    "usedInAssembliesQty": 0.0,
                    "issuedToProductionQty": 0.0,
                    "availableQty": 0.0,
                })
                continue

            # ---- Total received for this project's pieces ----
            received_agg = (
                JobWorkReceivePiece.objects
                .filter(id__in=piece_ids)
                .aggregate(total=Sum("qty"))
            )
            received = received_agg["total"] or Decimal("0")

            # ---- How much has already been allocated to assemblies ----
            used_agg = (
                AssemblyInput.objects
                .filter(
                    source_type="material",
                    job_work_piece_id__in=piece_ids,
                )
                .aggregate(total=Sum("use_qty"))
            )
            used_in_assemblies = used_agg["total"] or Decimal("0")

            # ---- Available = received − used in assemblies ----
            # ProductionIssue is intentionally NOT subtracted here.
            # See the docstring for why.
            available = received - used_in_assemblies

            if available < 0:
                available = Decimal("0")

            data.append({
                "id": project.id,
                "code": project.code,
                "name": project.name,
                "receivedQty": float(received),
                "usedInAssembliesQty": float(used_in_assemblies),
                "issuedToProductionQty": 0.0,
                "availableQty": float(available),
            })

        return Response(
            {"success": True, "data": data},
            status=status.HTTP_200_OK,
        )




# =====================================================================
# REWORK VIEWS
# =====================================================================
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import (
    ReworkRecord,
    ReworkHistory,
)
from .serializers import ReworkRecordSerializer

from .permissions import IsMaterialPlanning


# =====================================================================
# LIST
# =====================================================================
class ReworkListAPIView(APIView):
    """
    GET /erp/material/rework/

    Optional:
        ?source=job-work-receive | production
        ?status=<status>
        ?view=active | history
        ?projectId=<id>
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        qs = (
            ReworkRecord.objects
            .select_related("project")
            .prefetch_related("completions", "history")
            .all()
            .order_by("-created_at")
        )

        source = request.query_params.get("source")
        if source:
            qs = qs.filter(source_type=source)

        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        project_id = request.query_params.get("projectId")
        if project_id:
            qs = qs.filter(project_id=project_id)

        view = request.query_params.get("view")
        if view == "active":
            qs = qs.filter(status__in=[
                ReworkRecord.Status.REQUIRED,
                ReworkRecord.Status.IN_PROGRESS,
                ReworkRecord.Status.PARTIAL,
                ReworkRecord.Status.QC_PENDING,
            ])

        return Response(
            {
                "success": True,
                "data": ReworkRecordSerializer(qs, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


# =====================================================================
# DETAIL
# =====================================================================
class ReworkDetailAPIView(APIView):

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request, pk):
        try:
            rw = (
                ReworkRecord.objects
                .select_related("project")
                .prefetch_related("completions", "history")
                .get(id=pk)
            )
        except ReworkRecord.DoesNotExist:
            return Response(
                {"success": False, "message": "Rework not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            {"success": True, "data": ReworkRecordSerializer(rw).data},
            status=status.HTTP_200_OK,
        )


# =====================================================================
# START
# =====================================================================
class ReworkStartAPIView(APIView):
    """
    POST /erp/material/rework/<id>/start/

    Body:
        {
          "by": "Suresh",
          "supervisor": "Ravi",
          "remarks": "..."
        }
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request, pk):
        try:
            rw = ReworkRecord.objects.select_for_update().get(id=pk)
        except ReworkRecord.DoesNotExist:
            return Response(
                {"success": False, "message": "Rework not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if rw.status != ReworkRecord.Status.REQUIRED:
            return Response(
                {
                    "success": False,
                    "message": f"Cannot start a record that is {rw.status}.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        by = str(request.data.get("by", "")).strip()
        supervisor = str(request.data.get("supervisor", "")).strip()
        remarks = str(request.data.get("remarks", "")).strip()

        if not by:
            return Response(
                {"success": False, "message": "by is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not supervisor:
            return Response(
                {"success": False, "message": "supervisor is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rw.rework_by = by
        rw.supervisor = supervisor
        rw.start_remarks = remarks
        rw.started_at = timezone.now()
        rw.status = ReworkRecord.Status.IN_PROGRESS
        rw.save()

        ReworkHistory.objects.create(
            rework=rw,
            event_text=f"Rework started by {by} (Supervisor: {supervisor}).",
            performed_by=by,
        )

        return Response(
            {
                "success": True,
                "message": "Rework started.",
                "data": ReworkRecordSerializer(rw).data,
            },
            status=status.HTTP_200_OK,
        )


# =====================================================================
# COMPLETE
# =====================================================================
class ReworkCompleteAPIView(APIView):
    """
    POST /erp/material/rework/<id>/complete/

    Body:
        {
          "qty": 2,
          "by": "Suresh",
          "remarks": "..."
        }
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def post(self, request, pk):
        try:
            rw = ReworkRecord.objects.get(id=pk)
        except ReworkRecord.DoesNotExist:
            return Response(
                {"success": False, "message": "Rework not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        by = str(request.data.get("by", "")).strip()
        if not by:
            return Response(
                {"success": False, "message": "by is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            rw = mark_rework_done(
                rework=rw,
                done_qty=request.data.get("qty"),
                completed_by=by,
                remarks=str(request.data.get("remarks", "")).strip(),
            )
        except ValueError as exc:
            return Response(
                {"success": False, "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rw = (
            ReworkRecord.objects
            .prefetch_related("completions", "history")
            .get(id=rw.id)
        )

        return Response(
            {
                "success": True,
                "message": "Rework completion saved.",
                "data": ReworkRecordSerializer(rw).data,
            },
            status=status.HTTP_200_OK,
        )


# =====================================================================
# QC (source=production and qc_required only)
# =====================================================================
class ReworkQcAPIView(APIView):
    """
    POST /erp/material/rework/<id>/qc/

    Body:
        {
          "verifiedBy": "Ravi Shankar",
          "result": "Approved" | "Rejected",
          "remarks": "..."
        }

    Approved → record goes to READY_NEXT (already handed back in
                mark_rework_done for no-QC records; for QC-required
                records, the actual stage release happens here).
    Rejected → record goes back to REQUIRED with completed_qty reset
                and the hand-back is undone.
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request, pk):
        try:
            rw = ReworkRecord.objects.select_for_update().get(id=pk)
        except ReworkRecord.DoesNotExist:
            return Response(
                {"success": False, "message": "Rework not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if rw.status != ReworkRecord.Status.QC_PENDING:
            return Response(
                {
                    "success": False,
                    "message": (
                        f"QC verification only applies to records "
                        f"in QC Pending. This one is {rw.status}."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        verified_by = str(request.data.get("verifiedBy", "")).strip()
        result = str(request.data.get("result", "")).strip()
        remarks = str(request.data.get("remarks", "")).strip()

        if not verified_by:
            return Response(
                {"success": False, "message": "verifiedBy is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if result not in ("Approved", "Rejected"):
            return Response(
                {
                    "success": False,
                    "message": "result must be Approved or Rejected.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        rw.qc_verified_by = verified_by
        rw.qc_result = result
        rw.qc_remarks = remarks
        rw.qc_at = timezone.now()

        if result == "Approved":
            rw.status = ReworkRecord.Status.READY_NEXT
            rw.save()

            ReworkHistory.objects.create(
                rework=rw,
                event_text=(
                    f"QC Approved by {verified_by} — "
                    f"Ready for Next Process."
                ),
                performed_by=verified_by,
            )
        else:
            # QC rejected the rework itself. Send it back to Required.
            # NOTE: this assumes the hand-back in mark_rework_done
            # has NOT yet physically moved the quantity anywhere
            # (Production Operation's stage was only marked
            # awaiting_qc_qty, not released_qty). Adjust if that
            # invariant changes.
            rw.status = ReworkRecord.Status.REQUIRED
            rw.completed_qty = Decimal("0")
            rw.completed_at = None
            rw.duration_minutes = None
            rw.save()

            ReworkHistory.objects.create(
                rework=rw,
                event_text=(
                    f"QC Rejected by {verified_by} — Rework Required again."
                ),
                performed_by=verified_by,
            )

        return Response(
            {
                "success": True,
                "message": f"QC result saved ({result}).",
                "data": ReworkRecordSerializer(rw).data,
            },
            status=status.HTTP_200_OK,
        )


# =====================================================================
# CANCEL
# =====================================================================
class ReworkCancelAPIView(APIView):
    """
    POST /erp/material/rework/<id>/cancel/

    Body: { "remarks": "..." }

    Cancelling does NOT touch the source — the caller is
    responsible for cleaning up any counter that was bumped
    when the record was created. Use only when a record was
    created by mistake.
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request, pk):
        try:
            rw = ReworkRecord.objects.select_for_update().get(id=pk)
        except ReworkRecord.DoesNotExist:
            return Response(
                {"success": False, "message": "Rework not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if rw.status in (
            ReworkRecord.Status.AVAILABLE_STOCK,
            ReworkRecord.Status.READY_NEXT,
        ):
            return Response(
                {
                    "success": False,
                    "message": "A completed rework cannot be cancelled.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        remarks = str(request.data.get("remarks", "")).strip()

        rw.status = ReworkRecord.Status.CANCELLED
        rw.completed_at = rw.completed_at or timezone.now()
        if rw.started_at and rw.completed_at:
            _freeze_duration(rw)
        rw.save()

        ReworkHistory.objects.create(
            rework=rw,
            event_text=f"Rework cancelled. {remarks}".strip(),
        )

        return Response(
            {
                "success": True,
                "message": "Rework cancelled.",
                "data": ReworkRecordSerializer(rw).data,
            },
            status=status.HTTP_200_OK,
        )



# =====================================================================
# PRODUCTION OPERATION
# -----------------------------------------------------------------
# Execution layer on top of Assembly / AssemblyProcess.
#
# Lazy model:
#   - First call to GET /material/production/operation/ creates one
#     AssemblyExecution row per Assembly that has a processChain,
#     plus one AssemblyStageExecution per AssemblyProcess.
#   - Every action (start/complete/qc/rework/send/receive) writes an
#     AssemblyStageMovement and updates the stage counters in the
#     same transaction.
#
#   The route is NEVER redefined here. It is read from AssemblyProcess.
# =====================================================================


# ---------------------------------------------------------------------
# Lazily create the execution + stages for one Assembly.
# Called inside select_for_update() so two concurrent opens are safe.
# ---------------------------------------------------------------------
def _ensure_execution(assembly):
    """
    Returns (execution, created).

    Lazily materialises the AssemblyExecution + one
    AssemblyStageExecution per AssemblyProcess.

    If the execution already exists, stages are re-synced ONLY if
    the Assembly has processes that aren't yet represented.
    Never deletes or reorders existing stages.

    Quantity model
    --------------
    An Assembly is ONE buildable unit. Its `inputs` describe the
    recipe — "these materials go INTO this one assembly" — they
    do NOT multiply the planned quantity. Every Assembly produces
    exactly 1 unit.

    Therefore the first stage is seeded with qty = 1. Every later
    stage starts at 0 and only receives quantity when the previous
    stage releases it (via _release_to_next_stage).
    """
    execution, created = AssemblyExecution.objects.get_or_create(
        assembly=assembly,
        defaults={"status": AssemblyExecution.Status.PENDING},
    )

    existing_seq = set(
        execution.stages.values_list("sequence", flat=True)
    )

    processes = list(assembly.processes.order_by("sequence", "id"))

    if not processes:
        return execution, created

    first_sequence = processes[0].sequence

    for proc in processes:
        if proc.sequence in existing_seq:
            continue

        is_first_stage = (proc.sequence == first_sequence)

        AssemblyStageExecution.objects.create(
            execution=execution,
            assembly_process=proc,
            sequence=proc.sequence,
            name=proc.name,
            process_id=proc.process_id,
            qc_required=proc.qc_required,
            execution_type=proc.execution_type,
            execution_unit=proc.execution_unit or "",
            vendor=proc.vendor or "",
            vendor_contact=proc.vendor_contact or "",
            vendor_location=proc.vendor_location or "",
            expected_return_date=proc.expected_return_date,
            # An Assembly is 1 unit. The first stage owns that unit;
            # every later stage starts empty and is filled by the
            # previous stage's release.
            available_qty=Decimal("1") if is_first_stage else Decimal("0"),
            pending_operation_qty=Decimal("1") if is_first_stage else Decimal("0"),
        )

    return execution, created
# ---------------------------------------------------------------------
# Cascade helper — moves accepted qty to the next stage
# ---------------------------------------------------------------------
def _release_to_next_stage(execution, from_sequence, qty):
    if qty <= 0:
        return
    next_stage = (
        execution.stages
        .filter(sequence=from_sequence + 1)
        .first()
    )
    if next_stage is None:
        # Final stage — mark execution completed
        execution.status = AssemblyExecution.Status.COMPLETED
        execution.completed_at = timezone.now()
        execution.save(update_fields=["status", "completed_at", "updated_at"])
        AssemblyExecutionEvent.objects.create(
            execution=execution,
            event_text=(
                f"{execution.assembly.assembly_id} completed — "
                f"all quantity cleared every stage."
            ),
        )
        return

    next_stage.available_qty += qty
    next_stage.pending_operation_qty += qty
    next_stage.save(update_fields=[
        "available_qty", "pending_operation_qty", "updated_at"
    ])


def _log_event(execution, text):
    AssemblyExecutionEvent.objects.create(
        execution=execution,
        event_text=text,
    )


# ---------------------------------------------------------------------
# Helper — parse Decimal safely
# ---------------------------------------------------------------------
def _to_decimal(value, field_name="quantity"):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f"{field_name} is not a valid number.")


# =====================================================================
# LIST + LAZY MATERIALIZE
# -----------------------------------------------------------------
# GET /erp/material/production/operation/
#   ?projectId=<id>    (optional filter)
# =====================================================================
class ProductionOperationListAPIView(APIView):

    permission_classes = [IsAuthenticated, IsAccountsOrMaterialPlanning]

    @transaction.atomic
    def get(self, request):

        project_id = request.query_params.get("projectId")

        assemblies = (
            Assembly.objects
            .select_related("project")
            .prefetch_related("inputs", "processes")
            .all()
        )

        if project_id:
            assemblies = assemblies.filter(project_id=project_id)

        # Only assemblies that actually have a route
        assemblies = [
            a for a in assemblies if a.processes.exists()
        ]

        # Ensure execution and update assembly status
        for asm in assemblies:
            _ensure_execution(asm)

            if asm.status == Assembly.Status.PLANNED:
                asm.status = Assembly.Status.IN_PROGRESS
                asm.save(update_fields=["status", "updated_at"])

        executions = (
            AssemblyExecution.objects
            .select_related("assembly", "assembly__project")
            .prefetch_related(
                "stages",
                "stages__movements",
                "events",
            )
            .filter(assembly__in=assemblies)
            .order_by("-created_at")
        )

        return Response(
            {
                "success": True,
                "data": AssemblyExecutionSerializer(
                    executions, many=True
                ).data,
            },
            status=status.HTTP_200_OK,
        )
# =====================================================================
# DETAIL
# -----------------------------------------------------------------
# GET /erp/material/production/operation/<assembly_id>/
# =====================================================================
class ProductionOperationDetailAPIView(APIView):

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def get(self, request, assembly_id):
        try:
            asm = (
                Assembly.objects
                .select_related("project")
                .prefetch_related("inputs", "processes")
                .get(assembly_id=assembly_id)
            )
        except Assembly.DoesNotExist:
            return Response(
                {"success": False, "message": "Assembly not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        execution, _ = _ensure_execution(asm)

        execution = (
            AssemblyExecution.objects
            .select_related("assembly", "assembly__project")
            .prefetch_related(
                "stages",
                "stages__movements",
                "events",
            )
            .get(id=execution.id)
        )

        return Response(
            {
                "success": True,
                "data": AssemblyExecutionSerializer(execution).data,
            },
            status=status.HTTP_200_OK,
        )


# =====================================================================
# ACTION ENDPOINT — one URL, mode in the body
# -----------------------------------------------------------------
# POST /erp/material/production/operation/<assembly_id>/action/
#
# Body:
#   {
#     "sequence": 2,
#     "mode": "start" | "complete" | "qc" | "rework"
#            | "send-outsourcing" | "receive-outsourcing",
#     ...mode-specific fields
#   }
#
# Splitting into one endpoint keeps routing and auth in one place.
# =====================================================================
class ProductionOperationActionAPIView(APIView):
    """
    POST /erp/material/production/operation/<assembly_id>/action/

    Body:
        {
            "sequence": <int>,
            "mode": "start" | "complete" | "qc" | "rework"
                    | "send-outsourcing" | "receive-outsourcing",
            ...mode-specific fields
        }

    All quantity movement is transactional. Stage counters are
    updated in the same transaction as the AssemblyStageMovement
    row that justifies the change.

    Rework flow
    -----------
    - `_complete` with rejected > 0 → creates a ReworkRecord via
      services.create_rework_from_production. The rejected qty sits
      in stage.rework_qty and does NOT move forward.

    - `_rework` is a CONFIRMATION only. Actual hand-back happens
      inside the Rework module via services.mark_rework_done, which
      calls services._hand_back_to_production_qc / _next. This
      endpoint refuses while the Rework record is still open.
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    # =================================================================
    # ENTRY POINT
    # =================================================================
    @transaction.atomic
    def post(self, request, assembly_id):

        # ---- Resolve assembly ----
        try:
            asm = Assembly.objects.get(assembly_id=assembly_id)
        except Assembly.DoesNotExist:
            return Response(
                {"success": False, "message": "Assembly not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ---- Lazy materialise + lock execution ----
        execution, _ = _ensure_execution(asm)

        execution = (
            AssemblyExecution.objects
            .select_for_update()
            .get(id=execution.id)
        )

        sequence = request.data.get("sequence")
        mode = str(request.data.get("mode", "")).strip()

        if not sequence:
            return Response(
                {"success": False, "message": "sequence is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            stage = (
                execution.stages
                .select_for_update()
                .get(sequence=sequence)
            )
        except AssemblyStageExecution.DoesNotExist:
            return Response(
                {"success": False, "message": "Stage not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ---- Dispatch ----
        try:
            if mode == "start":
                return self._start(request, execution, stage)
            if mode == "complete":
                return self._complete(request, execution, stage)
            if mode == "qc":
                return self._qc(request, execution, stage)
            if mode == "rework":
                return self._rework(request, execution, stage)
            if mode == "send-outsourcing":
                return self._send_outsourcing(request, execution, stage)
            if mode == "receive-outsourcing":
                return self._receive_outsourcing(request, execution, stage)
        except ValueError as exc:
            return Response(
                {"success": False, "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"success": False, "message": f"Unknown mode: {mode}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # =================================================================
    # START
    # =================================================================
    def _start(self, request, execution, stage):
        """
        Records the operator / supervisor who started work on a
        stage. Flips `started = True` so the frontend swaps the
        button to "Complete Process".
        """

        by = str(request.data.get("startedBy", "")).strip()
        supervisor = str(request.data.get("supervisedBy", "")).strip()
        remarks = str(request.data.get("remarks", "")).strip()

        if not by:
            raise ValueError("startedBy is required.")
        if not supervisor:
            raise ValueError("supervisedBy is required.")

        if stage.started:
            raise ValueError("This stage is already started.")

        if stage.pending_operation_qty <= 0:
            raise ValueError("Nothing pending to start.")

        stage.started = True
        stage.save(update_fields=["started", "updated_at"])

        AssemblyStageMovement.objects.create(
            stage=stage,
            movement=AssemblyStageMovement.Movement.START,
            quantity=stage.pending_operation_qty,
            performed_by=by,
            supervised_by=supervisor,
            remarks=remarks,
            created_by=request.user,
        )

        _log_event(
            execution,
            f"{stage.name} started by {by} "
            f"(Supervisor: {supervisor})",
        )

        if execution.status == AssemblyExecution.Status.PENDING:
            execution.status = AssemblyExecution.Status.IN_PROGRESS
            execution.started_at = execution.started_at or timezone.now()
            execution.save(update_fields=[
                "status", "started_at", "updated_at"
            ])

        return Response(
            {
                "success": True,
                "message": f"{stage.name} started.",
                "data": AssemblyStageExecutionSerializer(stage).data,
            },
            status=status.HTTP_200_OK,
        )

    # =================================================================
    # COMPLETE
    # =================================================================
    def _complete(self, request, execution, stage):
        """
        Records completion of some or all pending qty at a stage.

        - Completed qty → QC bucket (if QC required) OR straight to
          the next stage (if not).
        - Rejected qty  → Rework bucket AND a new ReworkRecord in the
          Rework module via services.create_rework_from_production.

        The rejected portion does NOT flow forward. It only moves when
        the Rework module marks the record done and hands it back.
        """

        completed = _to_decimal(
            request.data.get("completedQty", "0"), "completedQty"
        )
        rejected = _to_decimal(
            request.data.get("rejectedQty", "0"), "rejectedQty"
        )
        remarks = str(request.data.get("remarks", "")).strip()
        by = str(request.data.get("by", "")).strip()

        # ---- Validation ----
        if completed < 0 or rejected < 0:
            raise ValueError("Quantities cannot be negative.")

        if completed + rejected <= 0:
            raise ValueError(
                "Enter Completed and/or Rejected quantity."
            )

        if completed + rejected > stage.pending_operation_qty:
            raise ValueError(
                f"Completed + Rejected cannot exceed pending "
                f"({stage.pending_operation_qty})."
            )

        if rejected > 0 and not by:
            raise ValueError(
                "`by` is required when flagging qty for rework."
            )

        # ---- Apply the change ----
        stage.pending_operation_qty -= (completed + rejected)

        if stage.qc_required:
            stage.awaiting_qc_qty += completed
        else:
            stage.released_qty += completed
            _release_to_next_stage(
                execution, stage.sequence, completed
            )

        stage.rework_qty += rejected
        stage.started = False
        stage.save()

        # ---- Movement log ----
        AssemblyStageMovement.objects.create(
            stage=stage,
            movement=AssemblyStageMovement.Movement.COMPLETE,
            quantity=completed,
            performed_by=by,
            remarks=remarks,
            created_by=request.user,
        )

        # ---- Rework record for rejected qty ----
        if rejected > 0:
            AssemblyStageMovement.objects.create(
                stage=stage,
                movement=AssemblyStageMovement.Movement.QC_REJECT,
                quantity=rejected,
                performed_by=by,
                remarks="Flagged for rework on completion.",
                created_by=request.user,
            )

            create_rework_from_production(
                assembly_stage_execution=stage,
                qty=rejected,
                reason=remarks or "Flagged for rework on completion.",
                flagged_by=by,
                qc_required=bool(stage.qc_required),
                created_by=request.user,
            )

        _log_event(
            execution,
            f"{stage.name} completed — {completed} Nos"
            + (
                f", {rejected} Nos sent to Rework module"
                if rejected > 0 else ""
            ),
        )

        return Response(
            {
                "success": True,
                "message": f"{stage.name} completion saved.",
                "data": AssemblyStageExecutionSerializer(stage).data,
            },
            status=status.HTTP_200_OK,
        )

    # =================================================================
    # QC VERIFY
    # =================================================================
    def _qc(self, request, execution, stage):
        """
        Records QC accept/reject against qty waiting in
        `awaiting_qc_qty`.

        - Accepted → released to next stage.
        - Rejected → Rework bucket AND a new ReworkRecord.
        """

        accepted = _to_decimal(
            request.data.get("acceptedQty", "0"), "acceptedQty"
        )
        rejected = _to_decimal(
            request.data.get("rejectedQty", "0"), "rejectedQty"
        )
        verified_by = str(request.data.get("verifiedBy", "")).strip()
        remarks = str(request.data.get("remarks", "")).strip()

        if not verified_by:
            raise ValueError("verifiedBy is required.")
        if accepted < 0 or rejected < 0:
            raise ValueError("Quantities cannot be negative.")
        if accepted + rejected <= 0:
            raise ValueError("Enter Accepted and/or Rejected quantity.")
        if accepted + rejected > stage.awaiting_qc_qty:
            raise ValueError(
                f"Accepted + Rejected cannot exceed awaiting QC "
                f"({stage.awaiting_qc_qty})."
            )

        stage.awaiting_qc_qty -= (accepted + rejected)
        stage.released_qty += accepted
        stage.rework_qty += rejected
        stage.save()

        if accepted > 0:
            AssemblyStageMovement.objects.create(
                stage=stage,
                movement=AssemblyStageMovement.Movement.QC_ACCEPT,
                quantity=accepted,
                performed_by=verified_by,
                remarks=remarks,
                created_by=request.user,
            )
            _release_to_next_stage(
                execution, stage.sequence, accepted
            )

        if rejected > 0:
            AssemblyStageMovement.objects.create(
                stage=stage,
                movement=AssemblyStageMovement.Movement.QC_REJECT,
                quantity=rejected,
                performed_by=verified_by,
                remarks=remarks,
                created_by=request.user,
            )

            create_rework_from_production(
                assembly_stage_execution=stage,
                qty=rejected,
                reason=remarks or "Rejected at QC.",
                flagged_by=verified_by,
                qc_required=bool(stage.qc_required),
                created_by=request.user,
            )

        _log_event(
            execution,
            f"{stage.name} QC: {accepted} Accepted, {rejected} Rejected "
            f"by {verified_by}"
            + (
                f" — {rejected} Nos sent to Rework module"
                if rejected > 0 else ""
            ),
        )

        return Response(
            {
                "success": True,
                "message": "QC verification saved.",
                "data": AssemblyStageExecutionSerializer(stage).data,
            },
            status=status.HTTP_200_OK,
        )

    # =================================================================
    # REWORK — CONFIRMATION ONLY
    # =================================================================
    def _rework(self, request, execution, stage):
        """
        Confirmation handler for the "Rework Done?" button.

        Production Operation does NOT move quantity itself. The
        actual hand-back happens inside the Rework module when
        services.mark_rework_done is called (via
        ReworkCompleteAPIView).

        This endpoint only:
            1. Refuses if there are still open Rework records for
               this stage — the user must finish them in the
               Rework module first.
            2. Returns the current stage state so the UI refreshes.
        """

        from .models import ReworkRecord

        # ---- Is there anything open? ----
        open_records = list(
            stage.rework_records.exclude(
                status__in=[
                    ReworkRecord.Status.READY_NEXT,
                    ReworkRecord.Status.AVAILABLE_STOCK,
                    ReworkRecord.Status.CANCELLED,
                ]
            )
        )

        if open_records:
            numbers = ", ".join(r.rework_number for r in open_records)
            raise ValueError(
                f"Rework is still open in the Rework module "
                f"({numbers}). Complete it there first — Production "
                f"Operation will advance automatically once it is "
                f"marked done."
            )

        # ---- Nothing held in rework? ----
        if stage.rework_qty <= 0:
            raise ValueError(
                "Nothing is currently sitting in the rework pool "
                "for this stage."
            )

        # ---- Reached here → records are done, but the stage
        #      counter still shows rework_qty > 0. This means
        #      _hand_back_to_production_* ran but couldn't move
        #      the qty (e.g. cancelled mid-flight). Log it.
        _log_event(
            execution,
            f"Rework confirmation received for {stage.name} — "
            f"stage state unchanged.",
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Rework confirmation received. Stage state will "
                    "refresh once the Rework module completes the "
                    "record."
                ),
                "data": AssemblyStageExecutionSerializer(stage).data,
            },
            status=status.HTTP_200_OK,
        )

    # =================================================================
    # SEND TO OUTSOURCING
    # =================================================================
    def _send_outsourcing(self, request, execution, stage):

        if stage.execution_type != "Outsourcing":
            raise ValueError("This stage is not outsourced.")

        qty = _to_decimal(request.data.get("qty", "0"), "qty")
        remarks = str(request.data.get("remarks", "")).strip()
        dc_ref = str(request.data.get("dcRef", "")).strip()
        erd_raw = request.data.get("expectedReturnDate")

        if qty <= 0:
            raise ValueError("Enter the quantity to send to the vendor.")
        if qty > stage.pending_operation_qty:
            raise ValueError(
                f"Quantity cannot exceed what is available to send "
                f"({stage.pending_operation_qty})."
            )
        if not dc_ref:
            raise ValueError("dcRef is required.")

        expected_return_date = None
        if erd_raw:
            try:
                expected_return_date = date.fromisoformat(str(erd_raw))
            except (TypeError, ValueError):
                raise ValueError("Invalid expectedReturnDate.")

        stage.pending_operation_qty -= qty
        stage.sent_qty += qty
        stage.save()

        AssemblyStageMovement.objects.create(
            stage=stage,
            movement=AssemblyStageMovement.Movement.SEND_OUT,
            quantity=qty,
            remarks=remarks,
            dc_ref=dc_ref,
            expected_return_date=expected_return_date,
            created_by=request.user,
        )

        _log_event(
            execution,
            f"{qty} Nos sent to {stage.vendor or 'vendor'} for "
            f"{stage.name} — Delivery Challan {dc_ref} generated",
        )

        return Response(
            {
                "success": True,
                "message": "Send saved. Open the Delivery Challan module.",
                "data": AssemblyStageExecutionSerializer(stage).data,
            },
            status=status.HTTP_200_OK,
        )

    # =================================================================
    # RECEIVE FROM OUTSOURCING
    # =================================================================
    def _receive_outsourcing(self, request, execution, stage):

        if stage.execution_type != "Outsourcing":
            raise ValueError("This stage is not outsourced.")

        qty = _to_decimal(
            request.data.get("receivedQty", "0"), "receivedQty"
        )
        remarks = str(request.data.get("remarks", "")).strip()

        pending_return = stage.sent_qty - stage.received_qty

        if qty <= 0:
            raise ValueError("Enter the quantity received from the vendor.")
        if qty > pending_return:
            raise ValueError(
                f"Received quantity cannot exceed pending from vendor "
                f"({pending_return})."
            )

        stage.received_qty += qty

        if stage.qc_required:
            stage.awaiting_qc_qty += qty
        else:
            stage.released_qty += qty
            _release_to_next_stage(
                execution, stage.sequence, qty
            )

        stage.save()

        AssemblyStageMovement.objects.create(
            stage=stage,
            movement=AssemblyStageMovement.Movement.RECEIVE_IN,
            quantity=qty,
            remarks=remarks,
            created_by=request.user,
        )

        remaining = pending_return - qty
        _log_event(
            execution,
            f"{qty} Nos received back from {stage.vendor or 'vendor'} "
            f"for {stage.name}"
            + (
                f" — {remaining} Nos still pending from vendor"
                if remaining > 0 else " — full quantity returned"
            ),
        )

        return Response(
            {
                "success": True,
                "message": "Receipt saved.",
                "data": AssemblyStageExecutionSerializer(stage).data,
            },
            status=status.HTTP_200_OK,
        )

    


# =====================================================================
# DISPATCH — HELPERS
# =====================================================================


def generate_dispatch_number():
    """
    Concurrency-safe dispatch number generator.
    Auto-seeds → DISP-001. Call inside a transaction.
    """
    settings_obj = (
        DispatchNumberSettings.objects
        .select_for_update()
        .filter(is_active=True)
        .first()
    )

    if settings_obj is None:
        try:
            settings_obj = DispatchNumberSettings.objects.create(
                prefix="DISP",
                next_number=1,
                number_padding=3,
                is_active=True,
            )
        except IntegrityError:
            settings_obj = (
                DispatchNumberSettings.objects
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


def _is_assembly_ready_for_dispatch(execution):
    """
    Completed production + no rework held anywhere.
    """
    if execution.status != AssemblyExecution.Status.COMPLETED:
        return False

    if execution.stages.filter(rework_qty__gt=0).exists():
        return False

    return True


def _production_dates(execution):
    """
    Earliest Start movement + latest QC Accept movement for the
    execution.
    """
    first_start = (
        AssemblyStageMovement.objects
        .filter(
            stage__execution=execution,
            movement=AssemblyStageMovement.Movement.START,
        )
        .order_by("created_at")
        .values_list("created_at", flat=True)
        .first()
    )
    last_accept = (
        AssemblyStageMovement.objects
        .filter(
            stage__execution=execution,
            movement=AssemblyStageMovement.Movement.QC_ACCEPT,
        )
        .order_by("-created_at")
        .values_list("created_at", flat=True)
        .first()
    )

    start_date = first_start.date() if first_start else None
    end_date = last_accept.date() if last_accept else None
    return start_date, end_date


def _assembly_dwgs(execution):
    dwgs = set()
    for inp in execution.assembly.inputs.all():
        if inp.source_type == "material" and inp.drawing_number:
            dwgs.add(inp.drawing_number)
    return sorted(dwgs)


def _serialize_dispatches_for_assembly(execution):
    rows = (
        execution.dispatches
        .all()
        .order_by("dispatch_date", "created_at")
    )
    return [
        {
            "id": d.id,
            "dispatchId": d.dispatch_number,
            "date": d.dispatch_date.isoformat(),
            "time": d.dispatch_time or "",
            "qty": float(d.quantity or 0),
            "dispatchTo": d.dispatch_to or "",
            "location": d.location or "",
            "vehicleNumber": d.vehicle_number or "",
            "transporter": d.transporter or "",
            "driverName": d.driver_name or "",
            "driverContact": d.driver_contact or "",
            "remarks": d.remarks or "",
            "dcChallanNumber": d.dc_challan_number or "",
            "deliveryChallanId": d.delivery_challan_id,
            "assemblyId": d.assembly_code,
            "project": d.project_code,
        }
        for d in rows
    ]
def _compute_completion_status(
    expected_date,
    actual_date,
    project_status,
):
    """
    Returns (label, days_variance_or_none).

    Rules:
      No expected date              → ("No Plan", None)
      No actual date + project done → ("Not Completed", None)
      No actual date + still open   → ("In Progress", None)
      Actual <= Expected            → ("On Time" | "Early", negative/0)
      Actual >  Expected            → ("Late", positive)
    """
    if expected_date is None:
        return "No Plan", None

    if actual_date is None:
        if project_status == "Completed":
            return "Not Completed", None
        return "In Progress", None

    variance = (actual_date - expected_date).days

    if variance > 0:
        return "Late", variance
    if variance < 0:
        return "Early", variance
    return "On Time", 0


def _build_dispatch_row(execution):
    planned_qty = 1.0

    dispatched_qty = float(
        execution.dispatches.aggregate(
            total=Sum("quantity")
        )["total"] or 0
    )

    balance_qty = max(planned_qty - dispatched_qty, 0.0)

    if dispatched_qty <= 0:
        dispatch_status = "Ready for Dispatch"
    elif balance_qty > 0:
        dispatch_status = "Partially Dispatched"
    else:
        dispatch_status = "Dispatched"

    # ---- Production dates (from movements) ----
    start_date, end_date = _production_dates(execution)

    duration = "—"
    if start_date and end_date:
        days = (end_date - start_date).days
        duration = f"{days} Day" + ("s" if days != 1 else "")

    # ---- Expected vs Actual completion ----
    project = execution.assembly.project
    expected_completion = project.end_date if project else None
    actual_completion = end_date  # last QC Accept

    project_status = project.status if project else ""

    completion_label, completion_variance = _compute_completion_status(
        expected_date=expected_completion,
        actual_date=actual_completion,
        project_status=project_status,
    )

    rework_pending_qty = float(
        execution.stages.aggregate(
            total=Sum("rework_qty")
        )["total"] or 0
    )

    dispatches = _serialize_dispatches_for_assembly(execution)

    dc_references = [
        d["dcChallanNumber"]
        for d in dispatches
        if d.get("dcChallanNumber")
    ]

    dispatch_dates = [d["date"] for d in dispatches if d.get("date")]
    first_dispatch_date = min(dispatch_dates) if dispatch_dates else None
    last_dispatch_date = max(dispatch_dates) if dispatch_dates else None

    return {
        "id": execution.id,
        "assemblyId": execution.assembly.assembly_id,
        "project": project.code if project else "",
        "projectId": project.id if project else None,
        "dwgs": _assembly_dwgs(execution),
        "dwgText": " + ".join(_assembly_dwgs(execution)),
        "revision": execution.assembly.dwg_description or "Rev-00",
        "description": execution.assembly.notes or "",
        "plannedQty": planned_qty,
        "dispatchedQty": dispatched_qty,
        "balanceQty": balance_qty,
        "dispatchStatus": dispatch_status,
        "productionStartDate": start_date,
        "productionEndDate": end_date,
        "duration": duration,

        # ---- renamed to match frontend ----
        "plannedEndDate": expected_completion,
        "actualEndDate": actual_completion,
        # -----------------------------------

        "completionStatus": completion_label,
        "completionDaysVariance": completion_variance,
        "firstDispatchDate": first_dispatch_date,
        "lastDispatchDate": last_dispatch_date,
        "processChain": [
            {"name": s.name, "qcRequired": s.qc_required}
            for s in execution.stages.order_by("sequence")
        ],
        "reworkPendingQty": rework_pending_qty,
        "dcReferences": dc_references,
        "dispatches": dispatches,
    }

def _apply_date_filters(qs, request, date_field):
    """
    Apply ?dateFrom / ?dateTo on a queryset's date field.
    """
    date_from = request.query_params.get("dateFrom")
    date_to = request.query_params.get("dateTo")

    if date_from:
        qs = qs.filter(**{f"{date_field}__gte": date_from})
    if date_to:
        qs = qs.filter(**{f"{date_field}__lte": date_to})

    return qs


def _matches_assembly_date_filters(row, request):
    """
    Return True if the row passes productionEndFrom/To AND
    dispatchDateFrom/To filters.
    """
    prod_from = request.query_params.get("productionEndFrom")
    prod_to = request.query_params.get("productionEndTo")

    if prod_from or prod_to:
        end = row.get("productionEndDate")
        if end is None:
            return False
        if prod_from and str(end) < prod_from:
            return False
        if prod_to and str(end) > prod_to:
            return False

    disp_from = request.query_params.get("dispatchDateFrom")
    disp_to = request.query_params.get("dispatchDateTo")

    if disp_from or disp_to:
        hit = False
        for d in row.get("dispatches", []):
            dd = d.get("date")
            if not dd:
                continue
            if disp_from and dd < disp_from:
                continue
            if disp_to and dd > disp_to:
                continue
            hit = True
            break
        if not hit:
            return False

    return True


# =====================================================================
# DISPATCH — READY LIST
# -----------------------------------------------------------------
# GET /erp/material/dispatch/ready/
#
# Optional filters:
#   ?search=<text>
#   ?project=<code>
#   ?assemblyId=<code>
#   ?dispatchStatus=Ready for Dispatch|Partially Dispatched|Dispatched
#   ?dcChallanNumber=<ref>
#   ?productionEndFrom=YYYY-MM-DD
#   ?productionEndTo=YYYY-MM-DD
#   ?dispatchDateFrom=YYYY-MM-DD
#   ?dispatchDateTo=YYYY-MM-DD
# =====================================================================

class DispatchReadyListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):

        search = (request.query_params.get("search") or "").strip()
        project_filter = request.query_params.get("project")
        assembly_filter = request.query_params.get("assemblyId")
        status_filter = request.query_params.get("dispatchStatus")
        dc_filter = (request.query_params.get("dcChallanNumber") or "").strip()

        executions = (
            AssemblyExecution.objects
            .select_related("assembly", "assembly__project")
            .prefetch_related(
                "stages",
                "assembly__inputs",
                "dispatches",
            )
            .filter(status=AssemblyExecution.Status.COMPLETED)
            .order_by("-completed_at", "-created_at")
        )

        rows = []

        for ex in executions:
            if not _is_assembly_ready_for_dispatch(ex):
                continue

            if assembly_filter:
                if ex.assembly.assembly_id.lower() != assembly_filter.lower():
                    continue

            if project_filter:
                pcode = (
                    ex.assembly.project.code
                    if ex.assembly.project else ""
                )
                if pcode.lower() != project_filter.lower():
                    continue

            row = _build_dispatch_row(ex)

            if status_filter:
                if row["dispatchStatus"].lower() != status_filter.lower():
                    continue

            if dc_filter:
                dcs = [d.lower() for d in row["dcReferences"]]
                if not any(dc_filter.lower() in d for d in dcs):
                    continue

            if not _matches_assembly_date_filters(row, request):
                continue

            if search:
                q = search.lower()
                haystack_parts = [
                    row.get("assemblyId") or "",
                    row.get("project") or "",
                    row.get("dwgText") or "",
                    row.get("description") or "",
                    row.get("dispatchStatus") or "",
                ]
                for d in row["dispatches"]:
                    haystack_parts.extend([
                        d.get("dispatchId") or "",
                        d.get("dcChallanNumber") or "",
                        d.get("vehicleNumber") or "",
                        d.get("transporter") or "",
                        d.get("driverName") or "",
                        d.get("driverContact") or "",
                        d.get("dispatchTo") or "",
                        d.get("location") or "",
                    ])
                haystack = " ".join(haystack_parts).lower()
                if q not in haystack:
                    continue

            rows.append(row)

        serializer = DispatchReadyAssemblySerializer(rows, many=True)

        return Response(
            {
                "success": True,
                "count": len(rows),
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )




# =====================================================================
# DISPATCH — SEARCH
# -----------------------------------------------------------------
# GET /erp/material/dispatch/search/?q=<term>
#
# Returns matching transactions AND matching assemblies.
# =====================================================================

class DispatchSearchAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):

        q = (request.query_params.get("q") or "").strip()

        if not q:
            return Response(
                {
                    "success": True,
                    "query": "",
                    "transactions": [],
                    "assemblies": [],
                },
                status=status.HTTP_200_OK,
            )

        tx_qs = (
            DispatchTransaction.objects
            .filter(
                Q(dispatch_number__icontains=q)
                | Q(dc_challan_number__icontains=q)
                | Q(assembly_code__icontains=q)
                | Q(project_code__icontains=q)
                | Q(vehicle_number__icontains=q)
                | Q(driver_name__icontains=q)
                | Q(dispatch_to__icontains=q)
                | Q(location__icontains=q)
            )
            .order_by("-dispatch_date", "-created_at")[:50]
        )

        executions = (
            AssemblyExecution.objects
            .select_related("assembly", "assembly__project")
            .prefetch_related(
                "stages",
                "assembly__inputs",
                "dispatches",
            )
            .filter(status=AssemblyExecution.Status.COMPLETED)
        )

        matching_assemblies = []
        q_lower = q.lower()

        for ex in executions:
            if not _is_assembly_ready_for_dispatch(ex):
                continue

            row = _build_dispatch_row(ex)

            if not _matches_assembly_date_filters(row, request):
                continue

            haystack_parts = [
                str(row.get("assemblyId") or ""),
                str(row.get("project") or ""),
                str(row.get("dwgText") or ""),
                str(row.get("description") or ""),
            ]
            for d in row.get("dispatches", []):
                haystack_parts.extend([
                    str(d.get("dcChallanNumber") or ""),
                    str(d.get("dispatchId") or ""),
                    str(d.get("vehicleNumber") or ""),
                    str(d.get("driverName") or ""),
                ])

            haystack = " ".join(haystack_parts).lower()

            if q_lower in haystack:
                matching_assemblies.append(row)

        return Response(
            {
                "success": True,
                "query": q,
                "transactions": DispatchTransactionSerializer(
                    tx_qs, many=True
                ).data,
                "assemblies": matching_assemblies[:50],
            },
            status=status.HTTP_200_OK,
        )


# =====================================================================
# DISPATCH — BY DC REFERENCE
# -----------------------------------------------------------------
# GET /erp/material/dispatch/by-dc/?ref=<dc number>
# =====================================================================

class DispatchByDCAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):

        ref = (request.query_params.get("ref") or "").strip()

        if not ref:
            return Response(
                {
                    "success": False,
                    "message": "Query parameter 'ref' is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = (
            DispatchTransaction.objects
            .filter(dc_challan_number__icontains=ref)
            .order_by("-dispatch_date", "-created_at")
        )

        return Response(
            {
                "success": True,
                "reference": ref,
                "count": qs.count(),
                "data": DispatchTransactionSerializer(qs, many=True).data,
            },
            status=status.HTTP_200_OK,
        )
    

# =====================================================================
# DISPATCH — DETAIL
# -----------------------------------------------------------------
# GET /erp/material/dispatch/<assembly_id>/
# =====================================================================

class DispatchDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request, assembly_id):

        try:
            execution = (
                AssemblyExecution.objects
                .select_related("assembly", "assembly__project")
                .prefetch_related(
                    "stages",
                    "assembly__inputs",
                    "dispatches",
                )
                .get(assembly__assembly_id=assembly_id)
            )
        except AssemblyExecution.DoesNotExist:
            return Response(
                {"success": False, "message": "Assembly not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        row = _build_dispatch_row(execution)

        transactions = (
            execution.dispatches
            .all()
            .order_by("-dispatch_date", "-created_at")
        )

        return Response(
            {
                "success": True,
                "data": {
                    "assembly": row,
                    "dispatches": DispatchTransactionSerializer(
                        transactions, many=True
                    ).data,
                },
            },
            status=status.HTTP_200_OK,
        )
    

# =====================================================================
# DISPATCH — CREATE
# -----------------------------------------------------------------
# POST /erp/material/dispatch/create/<assembly_id>/
# =====================================================================
class DispatchCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    @transaction.atomic
    def post(self, request, assembly_id):

        try:
            execution = (
                AssemblyExecution.objects
                .select_for_update(of=("self",))
                .select_related("assembly", "assembly__project")
                .get(assembly__assembly_id=assembly_id)
            )
        except AssemblyExecution.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "message": "Assembly not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check whether assembly is ready for dispatch
        if not _is_assembly_ready_for_dispatch(execution):
            return Response(
                {
                    "success": False,
                    "message": (
                        "This assembly is not ready for dispatch. "
                        "It must complete every production stage with "
                        "no rework pending."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate dispatch data
        serializer = DispatchCreateSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": "Invalid dispatch data.",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data

        # Planned quantity
        planned_qty = Decimal("1")

        # Calculate already dispatched quantity
        dispatched_so_far = (
            execution.dispatches.aggregate(
                total=Sum("quantity")
            )["total"] or Decimal("0")
        )

        balance = planned_qty - dispatched_so_far

        # Validate remaining quantity
        if data["qty"] > balance:
            return Response(
                {
                    "success": False,
                    "message": (
                        f"Dispatch quantity cannot exceed the "
                        f"remaining balance ({balance})."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate dispatch number
        dispatch_number = generate_dispatch_number()

        # Create dispatch transaction
        dispatch_tx = DispatchTransaction.objects.create(
            dispatch_number=dispatch_number,
            dispatch_date=data["date"],
            dispatch_time=(data.get("time") or "").strip(),

            assembly_execution=execution,
            assembly_code=execution.assembly.assembly_id,

            project_code=(
                execution.assembly.project.code
                if execution.assembly.project else ""
            ),

            dwg_description=execution.assembly.dwg_description or "",

            revision=(
                execution.assembly.dwg_description or "Rev-00"
            ),

            dispatch_to=(data.get("dispatchTo") or "").strip(),
            location=(data.get("location") or "").strip(),
            vehicle_number=(data.get("vehicleNumber") or "").strip(),
            transporter=(data.get("transporter") or "").strip(),
            driver_name=(data.get("driverName") or "").strip(),
            driver_contact=(data.get("driverContact") or "").strip(),

            quantity=data["qty"],

            remarks=(data.get("remarks") or "").strip(),

            dc_challan_number=(
                data.get("dcChallanNumber") or ""
            ).strip(),

            delivery_challan_id=(
                data.get("deliveryChallanId") or None
            ),

            created_by=request.user,
        )

        # Calculate total dispatched quantity
        total_dispatched = dispatched_so_far + data["qty"]

        # Update assembly status when fully dispatched
        if total_dispatched >= planned_qty:

            execution.assembly.status = Assembly.Status.COMPLETED

            execution.assembly.save(
                update_fields=["status", "updated_at"]
            )

        # Return response
        return Response(
            {
                "success": True,
                "message": f"{dispatch_number} recorded.",

                "data": DispatchTransactionSerializer(
                    dispatch_tx
                ).data,

                "assembly": _build_dispatch_row(execution),

            },
            status=status.HTTP_201_CREATED,
        )

# =====================================================================
# DISPATCH — HISTORY
# -----------------------------------------------------------------
# GET /erp/material/dispatch/history/
#
# Optional filters:
#   ?assemblyId=<code>
#   ?dcChallanNumber=<ref>
#   ?search=<text>
#   ?dateFrom=YYYY-MM-DD
#   ?dateTo=YYYY-MM-DD
# =====================================================================

class DispatchHistoryAPIView(APIView):
    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):

        qs = DispatchTransaction.objects.all().order_by(
            "-dispatch_date", "-created_at"
        )

        assembly_code = request.query_params.get("assemblyId")
        if assembly_code:
            qs = qs.filter(assembly_code=assembly_code)

        dc_ref = request.query_params.get("dcChallanNumber")
        if dc_ref:
            qs = qs.filter(dc_challan_number__icontains=dc_ref)

        qs = _apply_date_filters(qs, request, "dispatch_date")

        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(dispatch_number__icontains=search)
                | Q(dc_challan_number__icontains=search)
                | Q(assembly_code__icontains=search)
                | Q(project_code__icontains=search)
                | Q(dwg_description__icontains=search)
                | Q(dispatch_to__icontains=search)
                | Q(location__icontains=search)
                | Q(vehicle_number__icontains=search)
                | Q(transporter__icontains=search)
                | Q(driver_name__icontains=search)
                | Q(driver_contact__icontains=search)
            )

        return Response(
            {
                "success": True,
                "count": qs.count(),
                "data": DispatchTransactionSerializer(qs, many=True).data,
            },
            status=status.HTTP_200_OK,
        )








"""
Material Reports — API.

Endpoints:
    GET /erp/reports/kpis/
    GET /erp/reports/<report_key>/
    GET /erp/reports/<report_key>/filter-options/
    GET /erp/reports/material-movement/projects/
    GET /erp/reports/material-movement/pos/
    GET /erp/reports/material-movement/groups/
    GET /erp/reports/material-movement/timeline/

report_key values — must match REPORT_ORDER in Reports.jsx:
    poIntegration / grn / materialStock / issueToJobWork /
    receiveFromJobWork / cutting / issueToProduction /
    assemblyIntegration / productionOperation / rework /
    dispatch / movementHistory
"""
from . import services as svc
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsMaterialPlanning


DASH = "—"


# =====================================================================
# REGISTRY — report_key → builder + search keys + filter keys
# =====================================================================

REPORT_REGISTRY = {
    "poIntegration": {
        "builder": svc.build_po_integration_rows,
        "search": ["poNumber", "description", "material", "materialCode",
                   "project", "dwgNumber"],
        "filters": ["project", "poNumber", "material", "thickness",
                    "size", "unit", "integrationStatus", "poType"],
    },
    "grn": {
        "builder": svc.build_grn_rows,
        "search": ["poNumber", "description", "material",
                   "materialCode", "grnNumber"],
        "filters": ["material", "thickness", "size", "poType",
                    "inspectionStatus", "grnStatus"],
    },
    "materialStock": {
        "builder": svc.build_material_stock_rows,
        "search": ["material", "materialCode", "poNumber", "description",
                   "plateNumber", "thickness", "size", "project"],
        "filters": ["unit", "material", "thickness", "size",
                    "sourceType", "stockStatus", "reworkRequired"],
    },
    "issueToJobWork": {
        "builder": svc.build_issue_to_job_work_rows,
        "search": ["id", "poNumber", "description", "project",
                   "dwg", "material", "process"],
        "filters": ["project", "material", "process",
                    "jobWorkType", "status"],
    },
    "receiveFromJobWork": {
        "builder": svc.build_receive_from_job_work_rows,
        "search": ["id", "poNumber", "poDescription", "project",
                   "dwg", "material", "process"],
        "filters": ["project", "material", "process",
                    "jobWorkType", "status"],
    },
    "cutting": {
        "builder": svc.build_cutting_rows,
        "search": ["id", "poNumber", "project", "material",
                   "materialCode", "pieceNo"],
        "filters": ["project", "material", "thickness",
                    "rowType", "reworked", "status"],
    },
    "issueToProduction": {
        "builder": svc.build_issue_to_production_rows,
        "search": ["issueId", "poNumber", "poDescription",
                   "project", "dwg", "material", "materialCode"],
        "filters": ["project", "dwg", "material",
                    "jobWorkType", "status"],
    },
    "assemblyIntegration": {
        "builder": svc.build_assembly_integration_rows,
        "search": ["assemblyId", "project", "dwgText",
                   "materialText", "poText"],
        "filters": ["project", "status"],
    },
    "productionOperation": {
        "builder": svc.build_production_operation_rows,
        "search": ["assemblyId", "project", "process",
                   "processId", "dwg"],
        "filters": ["project", "dwg", "assemblyId",
                    "process", "qcStatus", "processStatus"],
    },
    "rework": {
        "builder": svc.build_rework_rows,
        "search": ["reworkId", "project", "dwg", "poNumber",
                   "assembly", "material", "pieceNo"],
        "filters": ["project", "dwg", "assembly",
                    "process", "source", "status"],
    },
    "dispatch": {
        "builder": svc.build_dispatch_rows,
        "search": ["dispatchId", "assemblyId", "project",
                   "dwgText", "location"],
        "filters": ["project", "assemblyId",
                    "dwgText", "dispatchStatus"],
    },
    # movementHistory is special — its own endpoints below
}


# =====================================================================
# KPI CARDS
# =====================================================================

class ReportsKpiAPIView(APIView):
    """GET /erp/reports/kpis/"""

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        return Response(
            {"success": True, "data": svc.compute_kpis()},
            status=status.HTTP_200_OK,
        )


# =====================================================================
# GENERIC LIST
# =====================================================================

class ReportsListAPIView(APIView):
    """
    GET /erp/reports/<report_key>/

    Query params:
        search         free text across registry search keys
        dateFrom       ISO date (matched against row["date"])
        dateTo         ISO date
        <filter_key>   exact match on any registry filter key
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request, report_key):
        cfg = REPORT_REGISTRY.get(report_key)
        if not cfg:
            return Response(
                {"success": False,
                 "message": f"Unknown report: {report_key}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        rows = cfg["builder"]()
        rows = self._search(rows, cfg["search"], request)
        rows = self._filter(rows, cfg["filters"], request)
        rows = self._dates(rows, request)

        return Response(
            {"success": True, "report": report_key,
             "count": len(rows), "data": rows},
            status=status.HTTP_200_OK,
        )

    @staticmethod
    def _search(rows, keys, request):
        q = (request.query_params.get("search") or "").strip().lower()
        if not q or not keys:
            return rows

        def hit(row):
            blob = " ".join(str(row.get(k, "")) for k in keys).lower()
            return q in blob
        return [r for r in rows if hit(r)]

    @staticmethod
    def _filter(rows, keys, request):
        active = {
            k: request.query_params.get(k)
            for k in keys if request.query_params.get(k)
        }
        if not active:
            return rows

        def hit(row):
            for k, v in active.items():
                if str(row.get(k, "")) != str(v):
                    return False
            return True
        return [r for r in rows if hit(r)]

    @staticmethod
    def _dates(rows, request):
        df = request.query_params.get("dateFrom")
        dt = request.query_params.get("dateTo")
        if not df and not dt:
            return rows

        def hit(row):
            d = (row.get("date") or row.get("issueDate")
                 or row.get("createdDate"))
            if not d or d == DASH:
                return False
            if df and d < df:
                return False
            if dt and d > dt:
                return False
            return True
        return [r for r in rows if hit(r)]


# =====================================================================
# FILTER OPTIONS
# =====================================================================

class ReportsFilterOptionsAPIView(APIView):
    """
    GET /erp/reports/<report_key>/filter-options/

    Returns { "fieldKey": [distinct values...] } for every filter
    key in the registry.
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request, report_key):
        cfg = REPORT_REGISTRY.get(report_key)
        if not cfg:
            return Response(
                {"success": False, "message": "Unknown report."},
                status=status.HTTP_404_NOT_FOUND,
            )

        rows = cfg["builder"]()
        payload = {}
        for key in cfg["filters"]:
            vals = {
                str(r.get(key)).strip()
                for r in rows
                if r.get(key) not in (None, "", DASH)
            }
            if vals:
                payload[key] = sorted(vals)

        return Response(
            {"success": True, "report": report_key, "data": payload},
            status=status.HTTP_200_OK,
        )


# =====================================================================
# MATERIAL MOVEMENT — PROJECT PICKER
# =====================================================================

class MovementProjectsAPIView(APIView):
    """
    GET /erp/reports/material-movement/projects/?search=bhel

    Searchable project index. Only projects with any movement
    activity are included.
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        data = svc.search_project_index(search)
        return Response(
            {"success": True, "count": len(data), "data": data},
            status=status.HTTP_200_OK,
        )


# =====================================================================
# MATERIAL MOVEMENT — PO PICKER
# =====================================================================

class MovementPOsAPIView(APIView):
    """
    GET /erp/reports/material-movement/pos/?search=PO-001&projectId=3
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        search = (request.query_params.get("search") or "").strip()
        pid_raw = request.query_params.get("projectId")
        project_id = None
        if pid_raw:
            try:
                project_id = int(pid_raw)
            except (TypeError, ValueError):
                return Response(
                    {"success": False,
                     "message": "projectId must be an integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        data = svc.search_po_index(search, project_id)
        return Response(
            {"success": True, "count": len(data), "data": data},
            status=status.HTTP_200_OK,
        )


# =====================================================================
# MATERIAL MOVEMENT — GROUPS
# =====================================================================

class MovementGroupsAPIView(APIView):
    """
    GET /erp/reports/material-movement/groups/

    Scope (pick one, or both for drilling down to a single PO):
        ?projectId=<int>    every PO belonging to that project
        ?poNumber=<str>     just that PO

    Optional filters:
        search
        movementType
        material, thickness, size, unit, status, process
        dateFrom, dateTo
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    FILTER_KEYS = [
        "material", "thickness", "size", "unit",
        "status", "process",
    ]

    def get(self, request):
        pid_raw = request.query_params.get("projectId")
        po_number = (request.query_params.get("poNumber") or "").strip()

        project_id = None
        if pid_raw:
            try:
                project_id = int(pid_raw)
            except (TypeError, ValueError):
                return Response(
                    {"success": False,
                     "message": "projectId must be an integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not project_id and not po_number:
            return Response(
                {"success": False,
                 "message": ("Provide projectId or poNumber to scope "
                             "the movement history.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        events = svc.build_movement_events(
            project_id=project_id,
            po_number=po_number or None,
        )
        groups = svc.build_movement_groups(events)

        groups = self._filters(groups, request)
        groups = self._search(groups, request)
        groups = self._dates(groups, request)

        return Response(
            {
                "success": True,
                "scope": {"projectId": project_id,
                          "poNumber": po_number or None},
                "count": len(groups),
                "data": groups,
            },
            status=status.HTTP_200_OK,
        )

    def _filters(self, groups, request):
        active = {
            k: request.query_params.get(k)
            for k in self.FILTER_KEYS if request.query_params.get(k)
        }
        movement_type = request.query_params.get("movementType")

        if not active and not movement_type:
            return groups

        def hit(g):
            for k, v in active.items():
                if str(g.get(k, "")) == str(v):
                    continue
                if any(str(e.get(k, "")) == str(v)
                       for e in g.get("events", [])):
                    continue
                return False
            if movement_type:
                if not any(e.get("movementType") == movement_type
                           for e in g.get("events", [])):
                    return False
            return True
        return [g for g in groups if hit(g)]

    def _search(self, groups, request):
        q = (request.query_params.get("search") or "").strip().lower()
        if not q:
            return groups

        def hit(g):
            parts = [
                g.get("projectCode"), g.get("projectName"),
                g.get("poNumber"), g.get("poDescription"),
                g.get("dwg"), g.get("material"),
                g.get("pieceLabel"), g.get("currentStatus"),
                g.get("currentLocation"), g.get("process"),
            ]
            for e in g.get("events", []):
                parts.extend([
                    e.get("source"), e.get("destination"),
                    e.get("status"), e.get("movementType"),
                    e.get("pieceNumber"), e.get("referenceId"),
                ])
            blob = " ".join(str(p or "") for p in parts).lower()
            return q in blob
        return [g for g in groups if hit(g)]

    def _dates(self, groups, request):
        df = request.query_params.get("dateFrom")
        dt = request.query_params.get("dateTo")
        if not df and not dt:
            return groups

        def hit(g):
            d = g.get("lastMovementDate")
            if not d or d == DASH:
                return False
            if df and d < df:
                return False
            if dt and d > dt:
                return False
            return True
        return [g for g in groups if hit(g)]


# =====================================================================
# MATERIAL MOVEMENT — TIMELINE (Eye modal)
# =====================================================================

class MovementTimelineAPIView(APIView):
    """
    GET /erp/reports/material-movement/timeline/?groupKey=PO::3::PO-001
    """

    permission_classes = [IsAuthenticated, IsMaterialPlanning]

    def get(self, request):
        group_key = (request.query_params.get("groupKey") or "").strip()
        if not group_key:
            return Response(
                {"success": False, "message": "groupKey is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project_id = None
        po_number = None

        parts = group_key.split("::")
        if len(parts) >= 3:
            kind = parts[0]
            try:
                if parts[1] not in ("None", "", "null"):
                    project_id = int(parts[1])
            except (TypeError, ValueError):
                project_id = None
            if kind == "PO":
                po_number = parts[2]

        events = svc.build_movement_events(
            project_id=project_id,
            po_number=po_number,
        )
        groups = svc.build_movement_groups(events)

        match = next(
            (g for g in groups if g["groupKey"] == group_key), None
        )
        if not match:
            return Response(
                {"success": False, "message": "Group not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {"success": True, "data": match},
            status=status.HTTP_200_OK,
        )






from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .models import (
    PurchaseOrderItem,
    PurchaseOrder,
    Project,
    Scrap,
    ScrapNumberSettings,
)


# ============================================================
# SCRAP NUMBER GENERATOR
# ============================================================

def generate_scrap_number():
    """
    Generates:
        SCR-001
        SCR-002
        SCR-003
        ...
    
    Uses database locking so two users cannot receive
    the same Scrap Number at the same time.
    """

    with transaction.atomic():

        settings = (
            ScrapNumberSettings.objects
            .select_for_update()
            .filter(is_active=True)
            .first()
        )

        # Create settings automatically if not available
        if not settings:
            settings = ScrapNumberSettings.objects.create(
                prefix="SCR",
                next_number=1,
                number_padding=3,
                is_active=True,
            )

            # Lock the newly created row
            settings = (
                ScrapNumberSettings.objects
                .select_for_update()
                .get(pk=settings.pk)
            )

        current_number = settings.next_number

        scrap_number = (
            f"{settings.prefix}-"
            f"{current_number:0{settings.number_padding}d}"
        )

        # Increment for next Scrap
        settings.next_number = current_number + 1

        settings.save(
            update_fields=[
                "next_number",
                "updated_at",
            ]
        )

        return scrap_number


# ============================================================
# GET CONFIRMED PO ITEMS FOR SCRAP
# ============================================================

class ScrapPOItemListAPIView(APIView):

    permission_classes = [IsAuthenticated , IsMaterialPlanning]

    def get(self, request):

        items = (
            PurchaseOrderItem.objects
            .select_related(
                "purchase_order",
            )
            .filter(
                purchase_order__status=PurchaseOrder.Status.CONFIRMED
            )
            .order_by(
                "-purchase_order__created_at",
                "id",
            )
        )

        data = []

        for item in items:

            vendor = item.purchase_order.vendor or {}

            if isinstance(vendor, dict):

                supplier = (
                    vendor.get("company_name")
                    or vendor.get("name")
                    or vendor.get("company")
                    or ""
                )

            else:
                supplier = str(vendor)

            data.append({

                "id": item.id,

                "po_number": (
                    item.po_number
                    or item.purchase_order.po_number
                ),

                "po_date": item.purchase_order.po_date,

                "supplier": supplier,

                "description": item.description,

                "material": item.material,

                "material_code": item.material_code,

                "material_spec": item.material_spec,

                "quantity": item.quantity,

                "unit": item.unit,

                "unit_weight": item.unit_weight,

                "length": item.length,

                "width": item.width,

                "thickness": item.thickness,

            })

        return Response(
            data,
            status=status.HTTP_200_OK
        )


# ============================================================
# CREATE + LIST SCRAP
# ============================================================

class ScrapListCreateAPIView(APIView):

    permission_classes = [IsAuthenticated , IsMaterialPlanning]

    # --------------------------------------------------------
    # GET - LIST SCRAP
    # --------------------------------------------------------

    def get(self, request):

        scraps = (
            Scrap.objects
            .select_related(
                "purchase_order_item",
                "purchase_order_item__purchase_order",
                "project",
                "created_by",
            )
            .order_by("-created_at")
        )

        data = []

        for scrap in scraps:

            item = scrap.purchase_order_item
            po = item.purchase_order if item else None

            vendor = po.vendor if po else {}

            if isinstance(vendor, dict):

                supplier = (
                    vendor.get("company_name")
                    or vendor.get("name")
                    or vendor.get("company")
                    or ""
                )

            else:
                supplier = str(vendor) if vendor else ""

            data.append({

                "id": scrap.id,

                "scrap_id": scrap.scrap_id,

                # ------------------------------------------
                # PO INFORMATION
                # ------------------------------------------

                "po_item_id": (
                    item.id
                    if item
                    else None
                ),

                "po_number": (
                    item.po_number
                    or po.po_number
                    if item and po
                    else ""
                ),

                "po_date": (
                    po.po_date
                    if po
                    else None
                ),

                "supplier": supplier,

                # ------------------------------------------
                # PO ITEM INFORMATION
                # ------------------------------------------

                "description": (
                    item.description
                    if item
                    else ""
                ),

                "material": (
                    item.material
                    if item
                    else ""
                ),

                "material_code": (
                    item.material_code
                    if item
                    else ""
                ),

                "material_spec": (
                    item.material_spec
                    if item
                    else ""
                ),

                "unit_weight": (
                    item.unit_weight
                    if item
                    else None
                ),

                "length": (
                    item.length
                    if item
                    else ""
                ),

                "width": (
                    item.width
                    if item
                    else ""
                ),

                "thickness": (
                    item.thickness
                    if item
                    else ""
                ),

                # ------------------------------------------
                # PROJECT
                # ------------------------------------------

                "project_id": (
                    scrap.project.id
                    if scrap.project
                    else None
                ),

                "project": (
                    scrap.project.name
                    if scrap.project
                    else ""
                ),

                "project_code": (
                    scrap.project.code
                    if scrap.project
                    else ""
                ),

                # ------------------------------------------
                # SCRAP
                # ------------------------------------------

                "process": scrap.process,

                "scrap_type": scrap.scrap_type,

                "quantity": scrap.quantity,

                "quantity_unit": scrap.quantity_unit,

                "weight": scrap.weight,

                "weight_unit": scrap.weight_unit,

                "reason": scrap.reason,

                "scrap_date": scrap.scrap_date,

                "location": scrap.location,

                "remarks": scrap.remarks,

                # ------------------------------------------
                # AUDIT
                # ------------------------------------------

                "created_by": (
                    scrap.created_by.username
                    if scrap.created_by
                    else None
                ),

                "created_at": scrap.created_at,

                "updated_at": scrap.updated_at,

            })

        return Response(
            data,
            status=status.HTTP_200_OK
        )

    # --------------------------------------------------------
    # POST - CREATE SCRAP
    # --------------------------------------------------------

    def post(self, request):

        data = request.data

        # ====================================================
        # REQUIRED FIELDS
        # ====================================================

        po_item_id = data.get("po_item_id")
        project_id = data.get("project_id")

        process = data.get("process")
        scrap_type = data.get("scrap_type")

        quantity = data.get("quantity")
        quantity_unit = data.get("quantity_unit")

        weight = data.get("weight")
        weight_unit = data.get("weight_unit")

        reason = data.get("reason")

        scrap_date = data.get("scrap_date")

        location = data.get("location")

        remarks = data.get("remarks", "")

        # ====================================================
        # BASIC VALIDATION
        # ====================================================

        if not po_item_id:

            return Response(
                {
                    "detail": "PO item is required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not project_id:

            return Response(
                {
                    "detail": "Project is required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not process:

            return Response(
                {
                    "detail": "Process is required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not scrap_type:

            return Response(
                {
                    "detail": "Scrap type is required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not reason:

            return Response(
                {
                    "detail": "Scrap reason is required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not scrap_date:

            return Response(
                {
                    "detail": "Scrap date is required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not location:

            return Response(
                {
                    "detail": "Scrap location is required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ====================================================
        # GET PO ITEM
        # ====================================================

        po_item = get_object_or_404(
            PurchaseOrderItem.objects.select_related(
                "purchase_order"
            ),
            pk=po_item_id,
        )

        # ====================================================
        # ONLY CONFIRMED PO
        # ====================================================

        if po_item.purchase_order.status != PurchaseOrder.Status.CONFIRMED:

            return Response(
                {
                    "detail": (
                        "Scrap can only be created "
                        "for a confirmed Purchase Order."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ====================================================
        # GET PROJECT
        # ====================================================

        project = get_object_or_404(
            Project,
            pk=project_id,
        )

        # ====================================================
        # QUANTITY / WEIGHT VALIDATION
        # ====================================================

        quantity_value = None
        weight_value = None

        if quantity not in [None, ""]:

            try:

                quantity_value = Decimal(str(quantity))

            except (InvalidOperation, ValueError):

                return Response(
                    {
                        "detail": "Invalid quantity."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if quantity_value <= 0:

                return Response(
                    {
                        "detail": "Quantity must be greater than zero."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        if weight not in [None, ""]:

            try:

                weight_value = Decimal(str(weight))

            except (InvalidOperation, ValueError):

                return Response(
                    {
                        "detail": "Invalid weight."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if weight_value <= 0:

                return Response(
                    {
                        "detail": "Weight must be greater than zero."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # At least quantity or weight
        if quantity_value is None and weight_value is None:

            return Response(
                {
                    "detail": (
                        "Either quantity or weight "
                        "must be provided."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ====================================================
        # UNIT VALIDATION
        # ====================================================

        if quantity_value is not None and not quantity_unit:

            return Response(
                {
                    "detail": "Quantity unit is required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if weight_value is not None and not weight_unit:

            return Response(
                {
                    "detail": "Weight unit is required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ====================================================
        # CREATE SCRAP
        # ====================================================

        try:

            with transaction.atomic():

                scrap_number = generate_scrap_number()

                scrap = Scrap.objects.create(

                    # ----------------------------------------
                    # AUTO NUMBER
                    # ----------------------------------------

                    scrap_id=scrap_number,

                    # ----------------------------------------
                    # RELATIONSHIPS
                    # ----------------------------------------

                    purchase_order_item=po_item,

                    project=project,

                    # ----------------------------------------
                    # SCRAP DETAILS
                    # ----------------------------------------

                    process=process,

                    scrap_type=scrap_type,

                    quantity=quantity_value,

                    quantity_unit=quantity_unit,

                    weight=weight_value,

                    weight_unit=weight_unit,

                    reason=reason,

                    scrap_date=scrap_date,

                    location=location,

                    remarks=remarks,

                    # ----------------------------------------
                    # AUDIT
                    # ----------------------------------------

                    created_by=request.user,

                )

        except Exception as e:

            return Response(
                {
                    "detail": (
                        "Failed to create scrap record."
                    ),
                    "error": str(e),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # ====================================================
        # RESPONSE
        # ====================================================

        return Response(
            {
                "message": "Scrap created successfully.",

                "data": {

                    "id": scrap.id,

                    "scrap_id": scrap.scrap_id,

                    "po_item_id": (
                        po_item.id
                    ),

                    "po_number": (
                        po_item.po_number
                        or po_item.purchase_order.po_number
                    ),

                    "project_id": project.id,

                    "project": project.name,

                    "process": scrap.process,

                    "scrap_type": scrap.scrap_type,

                    "quantity": scrap.quantity,

                    "quantity_unit": scrap.quantity_unit,

                    "weight": scrap.weight,

                    "weight_unit": scrap.weight_unit,

                    "reason": scrap.reason,

                    "scrap_date": scrap.scrap_date,

                    "location": scrap.location,

                    "remarks": scrap.remarks,

                    "created_by": (
                        request.user.username
                    ),

                    "created_at": scrap.created_at,

                }
            },
            status=status.HTTP_201_CREATED
        )


# ============================================================
# SCRAP DETAIL
# GET / PUT / PATCH / DELETE
# ============================================================

class ScrapDetailAPIView(APIView):

    permission_classes = [IsAuthenticated ,IsMaterialPlanning]

    # --------------------------------------------------------
    # GET
    # --------------------------------------------------------

    def get(self, request, pk):

        scrap = get_object_or_404(
            Scrap.objects.select_related(
                "purchase_order_item",
                "purchase_order_item__purchase_order",
                "project",
                "created_by",
            ),
            pk=pk,
        )

        item = scrap.purchase_order_item
        po = item.purchase_order if item else None

        return Response({

            "id": scrap.id,

            "scrap_id": scrap.scrap_id,

            "po_item_id": (
                item.id
                if item
                else None
            ),

            "po_number": (
                item.po_number or po.po_number
                if item and po
                else ""
            ),

            "description": (
                item.description
                if item
                else ""
            ),

            "material": (
                item.material
                if item
                else ""
            ),

            "material_code": (
                item.material_code
                if item
                else ""
            ),

            "material_spec": (
                item.material_spec
                if item
                else ""
            ),

            "project_id": (
                scrap.project.id
                if scrap.project
                else None
            ),

            "project": (
                scrap.project.name
                if scrap.project
                else ""
            ),

            "process": scrap.process,

            "scrap_type": scrap.scrap_type,

            "quantity": scrap.quantity,

            "quantity_unit": scrap.quantity_unit,

            "weight": scrap.weight,

            "weight_unit": scrap.weight_unit,

            "reason": scrap.reason,

            "scrap_date": scrap.scrap_date,

            "location": scrap.location,

            "remarks": scrap.remarks,

            "created_by": (
                scrap.created_by.username
                if scrap.created_by
                else None
            ),

            "created_at": scrap.created_at,

            "updated_at": scrap.updated_at,

        })

    # --------------------------------------------------------
    # PATCH / PUT
    # --------------------------------------------------------

    def patch(self, request, pk):

        scrap = get_object_or_404(
            Scrap,
            pk=pk,
        )

        data = request.data

        # --------------------------------------------
        # PO ITEM
        # --------------------------------------------

        if "po_item_id" in data:

            po_item = get_object_or_404(
                PurchaseOrderItem,
                pk=data["po_item_id"],
            )

            if (
                po_item.purchase_order.status
                != PurchaseOrder.Status.CONFIRMED
            ):

                return Response(
                    {
                        "detail": (
                            "Only confirmed Purchase Orders "
                            "can be used."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            scrap.purchase_order_item = po_item

        # --------------------------------------------
        # PROJECT
        # --------------------------------------------

        if "project_id" in data:

            project = get_object_or_404(
                Project,
                pk=data["project_id"],
            )

            scrap.project = project

        # --------------------------------------------
        # NORMAL FIELDS
        # --------------------------------------------

        fields = [
            "process",
            "scrap_type",
            "quantity_unit",
            "weight_unit",
            "reason",
            "scrap_date",
            "location",
            "remarks",
        ]

        for field in fields:

            if field in data:

                setattr(
                    scrap,
                    field,
                    data[field]
                )

        # --------------------------------------------
        # QUANTITY
        # --------------------------------------------

        if "quantity" in data:

            if data["quantity"] in [None, ""]:

                scrap.quantity = None

            else:

                try:

                    value = Decimal(
                        str(data["quantity"])
                    )

                    if value <= 0:
                        raise ValueError

                    scrap.quantity = value

                except (InvalidOperation, ValueError):

                    return Response(
                        {
                            "detail": (
                                "Invalid quantity."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

        # --------------------------------------------
        # WEIGHT
        # --------------------------------------------

        if "weight" in data:

            if data["weight"] in [None, ""]:

                scrap.weight = None

            else:

                try:

                    value = Decimal(
                        str(data["weight"])
                    )

                    if value <= 0:
                        raise ValueError

                    scrap.weight = value

                except (InvalidOperation, ValueError):

                    return Response(
                        {
                            "detail": (
                                "Invalid weight."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

        # --------------------------------------------
        # REQUIRE QUANTITY OR WEIGHT
        # --------------------------------------------

        if (
            scrap.quantity is None
            and scrap.weight is None
        ):

            return Response(
                {
                    "detail": (
                        "Either quantity or weight "
                        "must be provided."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # --------------------------------------------
        # SAVE
        # --------------------------------------------

        scrap.save()

        return Response({

            "message": (
                "Scrap updated successfully."
            ),

            "scrap_id": scrap.scrap_id,

            "id": scrap.id,

        })

    # --------------------------------------------------------
    # DELETE
    # --------------------------------------------------------

    def delete(self, request, pk):

        scrap = get_object_or_404(
            Scrap,
            pk=pk,
        )

        scrap.delete()

        return Response(
            {
                "message": (
                    "Scrap deleted successfully."
                )
            },
            status=status.HTTP_204_NO_CONTENT
        )


# ============================================================
# SCRAP DASHBOARD
# ============================================================

class ScrapDashboardAPIView(APIView):

    permission_classes = [IsAuthenticated , IsMaterialPlanning]

    def get(self, request):

        from django.db.models import (
            Sum,
            Count,
        )

        from django.utils import timezone

        from django.db.models.functions import (
            TruncMonth,
        )

        scraps = Scrap.objects.all()

        # ----------------------------------------------------
        # TOTAL RECORDS
        # ----------------------------------------------------

        total_scrap = scraps.count()

        # ----------------------------------------------------
        # TOTAL WEIGHT
        # ----------------------------------------------------

        total_weight = (
            scraps.aggregate(
                total=Sum("weight")
            )["total"]
            or Decimal("0")
        )

        # ----------------------------------------------------
        # TOTAL QUANTITY / PIECES
        # ----------------------------------------------------

        total_quantity = (
            scraps.aggregate(
                total=Sum("quantity")
            )["total"]
            or Decimal("0")
        )

        # ----------------------------------------------------
        # CURRENT MONTH
        # ----------------------------------------------------

        today = timezone.localdate()

        this_month = scraps.filter(
            scrap_date__year=today.year,
            scrap_date__month=today.month,
        ).count()

        # ----------------------------------------------------
        # SCRAP BY TYPE
        # ----------------------------------------------------

        by_type = list(
            scraps
            .values("scrap_type")
            .annotate(
                count=Count("id")
            )
            .order_by("-count")
        )

        # ----------------------------------------------------
        # SCRAP BY PROCESS
        # ----------------------------------------------------

        by_process = list(
            scraps
            .values("process")
            .annotate(
                count=Count("id")
            )
            .order_by("-count")
        )

        # ----------------------------------------------------
        # SCRAP BY REASON
        # ----------------------------------------------------

        by_reason = list(
            scraps
            .values("reason")
            .annotate(
                count=Count("id")
            )
            .order_by("-count")
        )

        return Response({

            "total_scrap": total_scrap,

            "total_weight": total_weight,

            "total_quantity": total_quantity,

            "this_month": this_month,

            "by_type": by_type,

            "by_process": by_process,

            "by_reason": by_reason,

        })
from datetime import datetime

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from .models import ContactRequest


PRIORITY_RESPONSE_WINDOW = {
    "HIGH":   "Within 24 hours",
    "MEDIUM": "Within 72 hours",
    "LOW":    "Within 1 week",
}


class ContactUsAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        employee_id  = (request.data.get("employeeId") or "").strip()
        subject      = (request.data.get("subject")    or "").strip()
        message      = (request.data.get("message")    or "").strip()
        priority     = (request.data.get("priority")   or "MEDIUM").strip().upper()
        inform_admin = bool(request.data.get("informAdmin", False))

        # -------- validation --------
        errors = {}
        if not employee_id:
            errors["employeeId"] = ["Employee ID is required."]
        if not subject:
            errors["subject"] = ["Subject is required."]
        if not message:
            errors["message"] = ["Message is required."]
        if priority not in PRIORITY_RESPONSE_WINDOW:
            errors["priority"] = ["Invalid priority."]

        # SQLite does not enforce VARCHAR lengths. Validate limits here so
        # overlong values cannot cause database or email-delivery failures.
        if len(employee_id) > 100:
            errors["employeeId"] = ["Employee ID must be 100 characters or fewer."]
        if len(subject) > 255:
            errors["subject"] = ["Subject must be 255 characters or fewer."]
        if len(message) > 10000:
            errors["message"] = ["Message must be 10,000 characters or fewer."]

        if errors:
            return Response(
                {"success": False, "message": "Validation failed.", "errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # -------- save the request --------
        contact = ContactRequest.objects.create(
            employee_id=employee_id,
            subject=subject,
            message=message,
            priority=priority,
            inform_admin=inform_admin,
            status="PENDING",
        )

        # -------- recipients (from env) --------
        support_email = getattr(settings, "CONTACT_SUPPORT_EMAIL", None)
        admin_email   = getattr(settings, "CONTACT_ADMIN_EMAIL", None)

        if not support_email:
            contact.status = "EMAIL_FAILED"
            contact.email_error = "CONTACT_SUPPORT_EMAIL is not configured."
            contact.save(update_fields=["status", "email_error", "updated_at"])

            return Response(
                {
                    "success": False,
                    "message": "Support email is not configured on the server.",
                    "requestId": contact.id,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # dedupe while preserving order
        recipients = []
        for addr in (support_email, admin_email if inform_admin else None):
            if addr and addr not in recipients:
                recipients.append(addr)

        # -------- build email body --------
        context = {
            "company_name":    getattr(settings, "COMPANY_NAME", "ERP"),
            "year":            datetime.now().year,
            "request_id":      contact.id,
            "submitted_at":    contact.created_at.strftime("%d %b %Y, %I:%M %p"),
            "employee_id":     employee_id,
            "subject":         subject,
            "message":         message,
            "priority":        priority,
            "response_window": PRIORITY_RESPONSE_WINDOW[priority],
            "inform_admin":    inform_admin,
        }

        html_body = render_to_string("emails/contact_request.html", context)
        text_body = render_to_string("emails/contact_request.txt",  context)

        email_subject = f"[Contact Us] [{priority}] {subject}"

        # -------- send --------
        try:
            email = EmailMultiAlternatives(
                subject=email_subject,
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=recipients,
            )
            email.attach_alternative(html_body, "text/html")
            email.send(fail_silently=False)

            contact.status = "EMAIL_SENT"
            contact.email_sent_at = timezone.now()
            contact.save(update_fields=["status", "email_sent_at", "updated_at"])

            return Response(
                {
                    "success": True,
                    "message": "Request submitted successfully.",
                    "requestId": contact.id,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as exc:
            contact.status = "EMAIL_FAILED"
            contact.email_error = str(exc)
            contact.save(update_fields=["status", "email_error", "updated_at"])

            return Response(
                {
                    "success": False,
                    "message": "Your request was saved but the notification email could not be sent.",
                    "requestId": contact.id,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )



from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated


class AdminModulesAPIView(APIView):
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):
        modules = [
            {
                "key": "dashboard",
                "title": "Dashboard",
                "description": "Overview of administrative activities.",
                "path": "/admin/dashboard",
            },
            {
                "key": "statistics",
                "title": "Statistics",
                "description": "View administrative statistics and reports.",
                "path": "/admin/statistics",
            },
            {
                "key": "attendance",
                "title": "Attendance",
                "description": "Monitor employee attendance records.",
                "path": "/admin/attendance",
            },
            {
                "key": "po-pending-grn",
                "title": "PO Pending GRN",
                "description": "Track purchase orders pending goods receipt.",
                "path": "/admin/po-pending-grn",
            },
            {
                "key": "pending-customer-payment",
                "title": "Pending Customer Payments",
                "description": "Monitor outstanding customer payments.",
                "path": "/admin/pending-customer-payment",
            },
            {
                "key": "project-status",
                "title": "Project Status",
                "description": "Track project progress and status.",
                "path": "/admin/project-status",
            },
            {
                "key": "document-number",
                "title": "Document Number",
                "description": "Manage document numbering information.",
                "path": "/admin/document-number",
            },
            {
                "key": "buffer-stock",
                "title": "Buffer Stock",
                "description": "Monitor buffer stock information.",
                "path": "/admin/buffer-stock",
            },
        ]

        return Response({
            "success": True,
            "count": len(modules),
            "results": modules,
        })




from django.db.models import Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .models import ContactRequest


class AdminContactRequestsAPIView(APIView):

    permission_classes = [IsAuthenticated , IsERPAdmin]

    def get(self, request):
        queryset = ContactRequest.objects.all()

        # Search
        search = request.query_params.get("search", "").strip()

        if search:
            search_query = (
                Q(employee_id__icontains=search)
                | Q(subject__icontains=search)
            )

            bug_id = search.upper()

            if bug_id.startswith("BUG-"):
                database_id = bug_id[4:]

                if database_id.isdigit():
                    search_query |= Q(id=int(database_id))

            queryset = queryset.filter(search_query)

        # Filter by issue status
        issue_status = request.query_params.get("issue_status")

        if issue_status:
            issue_status = issue_status.upper()

            if issue_status not in ["OPEN", "CLOSED"]:
                return Response(
                    {
                        "success": False,
                        "message": "issue_status must be OPEN or CLOSED.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            queryset = queryset.filter(issue_status=issue_status)

        # Filter by priority
        priority = request.query_params.get("priority")

        if priority:
            priority = priority.upper()

            if priority not in ["HIGH", "MEDIUM", "LOW"]:
                return Response(
                    {
                        "success": False,
                        "message": "Invalid priority.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            queryset = queryset.filter(priority=priority)

        total_count = queryset.count()
        open_count = queryset.filter(issue_status="OPEN").count()
        closed_count = queryset.filter(issue_status="CLOSED").count()

        results = [
            {
                "id": contact.id,
                "bug_id": f"BUG-{contact.id}",
                "employee_id": contact.employee_id,
                "subject": contact.subject,
                "message": contact.message,
                "priority": contact.priority,
                "inform_admin": contact.inform_admin,
                "email_status": contact.status,
                "is_open": contact.issue_status == "OPEN",
                "issue_status": contact.issue_status,
                "closed_by": contact.closed_by,
                "email_sent_at": contact.email_sent_at,
                "email_error": contact.email_error,
                "created_at": contact.created_at,
                "updated_at": contact.updated_at,
            }
            for contact in queryset
        ]

        return Response({
            "success": True,
            "request_count": total_count,
            "open_count": open_count,
            "closed_count": closed_count,
            "results": results,
        })

    def post(self, request):
        employee_id = request.data.get("employee_id")
        subject = request.data.get("subject")
        message = request.data.get("message")

        priority = request.data.get("priority", "MEDIUM").upper()
        inform_admin = request.data.get("inform_admin", False)

        # Validate required fields
        if not employee_id or not subject or not message:
            return Response(
                {
                    "success": False,
                    "message": (
                        "employee_id, subject, and message are required."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if priority not in ["HIGH", "MEDIUM", "LOW"]:
            return Response(
                {
                    "success": False,
                    "message": "Priority must be HIGH, MEDIUM, or LOW.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(inform_admin, bool):
            return Response(
                {
                    "success": False,
                    "message": "inform_admin must be a boolean.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create contact request
        contact = ContactRequest.objects.create(
            employee_id=employee_id,
            subject=subject,
            message=message,
            priority=priority,
            inform_admin=inform_admin,
            issue_status="OPEN",
            closed_by=None,
        )

        return Response(
            {
                "success": True,
                "message": "Contact request created successfully.",
                "data": {
                    "id": contact.id,
                    "bug_id": f"BUG-{contact.id}",
                    "employee_id": contact.employee_id,
                    "subject": contact.subject,
                    "message": contact.message,
                    "priority": contact.priority,
                    "inform_admin": contact.inform_admin,
                    "email_status": contact.status,
                    "is_open": contact.issue_status == "OPEN",
                    "issue_status": contact.issue_status,
                    "closed_by": contact.closed_by,
                    "created_at": contact.created_at,
                },
            },
            status=status.HTTP_201_CREATED,
        )
    def patch(self, request, pk):
        try:
            contact = ContactRequest.objects.get(pk=pk)
        except ContactRequest.DoesNotExist:
            return Response(
                {"success": False, "message": "Contact request not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        issue_status = str(request.data.get("issue_status", "")).upper()
        closed_by = str(request.data.get("closed_by", "")).strip()

        if issue_status != "CLOSED":
            return Response(
                {"success": False, "message": "issue_status must be CLOSED."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if closed_by not in ["ADMIN", "NXTGENZ"]:
            return Response(
                {"success": False, "message": "closed_by must be ADMIN or NXTGENZ."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        contact.issue_status = "CLOSED"
        contact.closed_by = closed_by
        contact.save(update_fields=["issue_status", "closed_by", "updated_at"])

        return Response({
            "success": True,
            "message": "Request closed successfully.",
            "data": {
                "id": contact.id,
                "bug_id": f"BUG-{contact.id}",
                "issue_status": contact.issue_status,
                "closed_by": contact.closed_by,
                "updated_at": contact.updated_at,
            },
        })




"""
Admin attendance API.

GET /erp/admin/attendance/

Query params
------------
period       day | week | month | quarter | year | custom        (default: day)
date         YYYY-MM-DD anchor date                              (default: today)
month, year  only for period=month → explicit month (1-12) / year
from, to     only for period=custom
department   exact department name ("all" / empty = no filter)
status       PRESENT | HALF_DAY | WFH | ON_LEAVE | PAID_LEAVE | UNPAID_LEAVE
employee_id  Employee PK → returns that employee's day-by-day calendar for
             the resolved window instead of the list payload

Optional business-rule settings (django settings.py) — nothing is assumed:
    ERP_ATTENDANCE_WEEKLY_OFF_WEEKDAYS = [6]                 # Monday=0 … Sunday=6
    ERP_ATTENDANCE_HOLIDAYS = {"2026-10-20": "Deepavali"}    # ISO date → name
    ERP_ATTENDANCE_AUTO_ABSENT = False                       # True → a past working
                                                             # day with no record = Absent

period=day additionally returns `daily_attendance[]`: one row for EVERY eligible
employee (Absent and Not Marked included), so the Daily Attendance screen needs
no second request.
"""
import calendar
from collections import defaultdict
from datetime import date as _date, timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Attendance, Employee



# ------------------------------------------------------------
# Attendance status groups (values stored in Attendance.status)
# ------------------------------------------------------------
ATTENDANCE_PRESENT_STATUSES = ["PRESENT", "HALF_DAY", "WFH"]
ATTENDANCE_LEAVE_STATUSES = ["PAID_LEAVE", "UNPAID_LEAVE"]
ATTENDANCE_OFF_STATUSES = ["ABSENT", "HOLIDAY", "WEEKLY_OFF"]

STATUS_LABELS = {
    "PRESENT": "Present",
    "HALF_DAY": "Half Day",
    "WFH": "Work From Home",
    "PAID_LEAVE": "Paid Leave",
    "UNPAID_LEAVE": "Unpaid Leave",
    "ON_LEAVE": "On Leave",
    "ABSENT": "Absent",
    "HOLIDAY": "Holiday",
    "WEEKLY_OFF": "Weekly Off",
    "NOT_MARKED": "Not Marked",
}

VALID_PERIODS = ("day", "week", "month", "quarter", "year", "custom")
WEEKDAY_NAMES = [
    "Monday", "Tuesday", "Wednesday", "Thursday",
    "Friday", "Saturday", "Sunday",
]

MAX_WINDOW_DAYS = 3700       # protects list/summary queries
MAX_DETAIL_DAYS = 400        # protects the day-by-day calendar

# The pasted code never referenced a logout field, so it is detected at
# import time instead of assumed. Add your real field name here if it differs.
_ATTENDANCE_FIELD_NAMES = {f.name for f in Attendance._meta.get_fields()}
LOGOUT_FIELD = next(
    (
        name
        for name in ("logout_time", "logout", "check_out_time", "check_out")
        if name in _ATTENDANCE_FIELD_NAMES
    ),
    None,
)

# Employee joining / relieving dates are not part of the models shown to us,
# so they are detected instead of assumed. If none exists, no employee is
# excluded by date (we never guess).
_EMPLOYEE_FIELD_NAMES = {f.name for f in Employee._meta.get_fields()}


def _first_field(candidates, available):
    return next((n for n in candidates if n in available), None)


JOINING_FIELD = _first_field(
    ("date_of_joining", "joining_date", "date_joined", "doj"),
    _EMPLOYEE_FIELD_NAMES,
)
RELIEVING_FIELD = _first_field(
    ("relieving_date", "date_of_leaving", "exit_date", "last_working_date"),
    _EMPLOYEE_FIELD_NAMES,
)

ATTENDANCE_VALUE_FIELDS = [
    "id", "employee_id", "date", "status",
    "login_time", "working_hours", "daily_wage",
    # Backend-calculated hour values (never recalculated here or in the UI)
    "normal_hours", "approved_ot_hours", "total_hours",
] + ([LOGOUT_FIELD] if LOGOUT_FIELD else [])


# ------------------------------------------------------------
# Small helpers
# ------------------------------------------------------------
def _parse_iso_date(value, default=None):
    if not value:
        return default
    try:
        return _date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return default


def _iter_days(start, end):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def _status_label(code):
    return STATUS_LABELS.get(code) or str(code or "").replace("_", " ").title()


def _format_time_12h(value):
    if not value or not hasattr(value, "strftime"):
        return ""
    return value.strftime("%I:%M %p").lstrip("0")


def _f(value):
    """Decimal / None → float (0.0 when empty)."""
    return float(value or 0)


def _employee_meta(employee):
    """Fields every row carries so the frontend needs no second lookup."""
    return {
        "employee_name": employee.full_name or employee.employee_id,
        "employee_code": employee.employee_id,
        "designation": employee.designation or "",
        "department": employee.department or "",
    }


def _hours_block(record):
    """normal / OT / total exactly as stored on the attendance row."""
    if not record:
        return {
            "normal_hours": 0,
            "approved_ot_hours": 0,
            "total_hours": 0,
        }
    return {
        "normal_hours": _f(record.get("normal_hours")),
        "approved_ot_hours": _f(record.get("approved_ot_hours")),
        "total_hours": _f(record.get("total_hours")),
    }


def _resolve_attendance_window(anchor, period, from_date, to_date):
    """Return (start, end) inclusive dates for the requested period."""
    period = (period or "day").lower()

    if period == "custom":
        start = from_date or anchor
        end = to_date or anchor
        if end < start:
            start, end = end, start
        return start, end

    if period == "day":
        return anchor, anchor

    if period == "week":  # Monday → Sunday
        start = anchor - timedelta(days=anchor.weekday())
        return start, start + timedelta(days=6)

    if period == "month":
        start = anchor.replace(day=1)
        last_day = calendar.monthrange(anchor.year, anchor.month)[1]
        return start, anchor.replace(day=last_day)

    if period == "quarter":
        q_start_month = ((anchor.month - 1) // 3) * 3 + 1
        q_end_month = q_start_month + 2
        last_day = calendar.monthrange(anchor.year, q_end_month)[1]
        return (
            _date(anchor.year, q_start_month, 1),
            _date(anchor.year, q_end_month, last_day),
        )

    if period == "year":
        return _date(anchor.year, 1, 1), _date(anchor.year, 12, 31)

    return anchor, anchor


def _resolve_request_window(params, today):
    """
    Validate query params and return (anchor, period, start, end).
    Raises ValueError with a user-safe message on bad input — invalid
    dates are rejected instead of silently falling back to today.
    """
    period = (params.get("period") or "day").lower()
    if period not in VALID_PERIODS:
        raise ValueError("Invalid period.")

    raw_date = params.get("date")
    anchor = _parse_iso_date(raw_date) if raw_date else today
    if anchor is None:
        raise ValueError("Invalid date. Use YYYY-MM-DD.")

    # Explicit month + year picker (period=month)
    if period == "month":
        month_raw, year_raw = params.get("month"), params.get("year")
        if month_raw or year_raw:
            try:
                month_i = int(month_raw) if month_raw else anchor.month
                year_i = int(year_raw) if year_raw else anchor.year
                if not 1900 <= year_i <= 2200:
                    raise ValueError
                anchor = _date(year_i, month_i, 1)
            except (TypeError, ValueError):
                raise ValueError("Invalid month or year.")

    from_date = to_date = None
    if period == "custom":
        if params.get("from"):
            from_date = _parse_iso_date(params.get("from"))
            if from_date is None:
                raise ValueError("Invalid 'from' date. Use YYYY-MM-DD.")
        if params.get("to"):
            to_date = _parse_iso_date(params.get("to"))
            if to_date is None:
                raise ValueError("Invalid 'to' date. Use YYYY-MM-DD.")

    start, end = _resolve_attendance_window(anchor, period, from_date, to_date)

    if (end - start).days + 1 > MAX_WINDOW_DAYS:
        raise ValueError("Date range is too large.")

    return anchor, period, start, end


# ------------------------------------------------------------
# Company calendar rules (settings-driven, nothing invented)
# ------------------------------------------------------------
def _weekly_off_weekdays():
    raw = getattr(settings, "ERP_ATTENDANCE_WEEKLY_OFF_WEEKDAYS", ()) or ()
    out = set()
    for item in raw:
        try:
            value = int(item)
        except (TypeError, ValueError):
            continue
        if 0 <= value <= 6:
            out.add(value)
    return out


def _configured_holidays(start, end):
    raw = getattr(settings, "ERP_ATTENDANCE_HOLIDAYS", {}) or {}
    out = {}
    for key, name in raw.items():
        day = key if isinstance(key, _date) else _parse_iso_date(key)
        if day and start <= day <= end:
            out[day] = str(name or "Holiday")
    return out


def _auto_absent_enabled():
    return bool(getattr(settings, "ERP_ATTENDANCE_AUTO_ABSENT", False))


def _build_day_rules(start, end):
    """{date: (status_code, note)} for configured holidays / weekly offs."""
    holidays = _configured_holidays(start, end)
    weekly_off = _weekly_off_weekdays()
    rules = {}
    for day in _iter_days(start, end):
        if day in holidays:
            rules[day] = ("HOLIDAY", holidays[day])
        elif day.weekday() in weekly_off:
            rules[day] = ("WEEKLY_OFF", "")
    return rules


def _rules_config():
    return {
        "weekly_off_weekdays": sorted(_weekly_off_weekdays()),
        "holidays_configured": bool(getattr(settings, "ERP_ATTENDANCE_HOLIDAYS", None)),
        "auto_absent": _auto_absent_enabled(),
        "rules_configured": bool(
            _weekly_off_weekdays()
            or getattr(settings, "ERP_ATTENDANCE_HOLIDAYS", None)
            or _auto_absent_enabled()
        ),
        "supports_logout": LOGOUT_FIELD is not None,
    }


def _classify_day(day, record, rules, auto_absent, today):
    """
    One place that decides what a calendar day is.
    Returns (status_code, source, note).

      1. A stored attendance record always wins.
      2. Configured holiday / weekly off.
      3. Auto-absent (only if enabled in settings, only for past days).
      4. Otherwise NOT_MARKED — a missing record is NOT an absence.
    """
    if record is not None:
        return record["status"], "record", ""
    rule = rules.get(day)
    if rule:
        return rule[0], "rule", rule[1]
    if auto_absent and day < today:
        return "ABSENT", "rule", ""
    return "NOT_MARKED", "none", ""


# ------------------------------------------------------------
# Eligibility (joining / relieving dates)
# ------------------------------------------------------------
def _as_date(value):
    if value is None:
        return None
    return value.date() if hasattr(value, "date") and callable(value.date) else value


def _employee_eligible_on(employee, day):
    """Not before the joining date, not after the relieving date (when known)."""
    joined = _as_date(getattr(employee, JOINING_FIELD, None)) if JOINING_FIELD else None
    relieved = _as_date(getattr(employee, RELIEVING_FIELD, None)) if RELIEVING_FIELD else None
    if joined and day < joined:
        return False
    if relieved and day > relieved:
        return False
    return True


# ------------------------------------------------------------
# Tallies — used by BOTH the monthly list and the daily modal,
# so totals can never disagree with the daily rows.
# ------------------------------------------------------------
def _empty_tally():
    return {
        "days_worked": 0,
        "present_days": 0,
        "half_days": 0,
        "wfh_days": 0,
        "leave_days": 0,
        "absent_days": 0,
        "holiday_days": 0,
        "weekly_off_days": 0,
        "not_marked_days": 0,   # elapsed days only
        "upcoming_days": 0,     # future days with nothing recorded
        "other_days": 0,
        "total_hours": 0.0,     # Σ working_hours (kept for existing consumers)
        "total_wage": 0.0,
        "normal_hours": 0.0,    # Σ stored normal_hours
        "approved_ot_hours": 0.0,
        "recorded_total_hours": 0.0,  # Σ stored total_hours
        "latest_working_status": "",
        "latest_leave_status": "",
    }


_WORKING_KEY = {
    "PRESENT": "present_days",
    "HALF_DAY": "half_days",
    "WFH": "wfh_days",
}


def _tally_day(tally, day, code, record, today):
    if code in ATTENDANCE_PRESENT_STATUSES:
        tally["days_worked"] += 1
        tally[_WORKING_KEY[code]] += 1
        tally["latest_working_status"] = code
        if record is not None:
            tally["total_hours"] += float(record.get("working_hours") or 0)
            tally["total_wage"] += float(record.get("daily_wage") or 0)
            tally["normal_hours"] += float(record.get("normal_hours") or 0)
            tally["approved_ot_hours"] += float(record.get("approved_ot_hours") or 0)
            tally["recorded_total_hours"] += float(record.get("total_hours") or 0)
    elif code in ATTENDANCE_LEAVE_STATUSES:
        tally["leave_days"] += 1
        tally["latest_leave_status"] = code
    elif code == "ABSENT":
        tally["absent_days"] += 1
    elif code == "HOLIDAY":
        tally["holiday_days"] += 1
    elif code == "WEEKLY_OFF":
        tally["weekly_off_days"] += 1
    elif code == "NOT_MARKED":
        if day > today:
            tally["upcoming_days"] += 1
        else:
            tally["not_marked_days"] += 1
    else:
        tally["other_days"] += 1


def _public_tally(tally):
    out = dict(tally)
    for key in (
        "total_hours", "total_wage", "normal_hours",
        "approved_ot_hours", "recorded_total_hours",
    ):
        out[key] = round(out[key], 2)
    out.pop("latest_working_status", None)
    out.pop("latest_leave_status", None)
    return out


def _headline_status(tally):
    """Single status shown in the monthly list for one employee."""
    if tally["latest_working_status"]:
        return tally["latest_working_status"]
    if tally["latest_leave_status"]:
        return tally["latest_leave_status"]
    if tally["absent_days"]:
        return "ABSENT"
    if tally["not_marked_days"]:
        return "NOT_MARKED"
    if tally["holiday_days"]:
        return "HOLIDAY"
    if tally["weekly_off_days"]:
        return "WEEKLY_OFF"
    return "NOT_MARKED"


def _record_matches_filter(record, status_filter):
    if status_filter in ("", "ALL"):
        return True
    if status_filter == "ON_LEAVE":
        return record["status"] in ATTENDANCE_LEAVE_STATUSES
    return record["status"] == status_filter


# ------------------------------------------------------------
# Daily list (period=day) — every ELIGIBLE employee, exactly once
# ------------------------------------------------------------
def _build_daily_list(employees, by_employee, day, rules, auto_absent, today):
    """
      - stored record wins (PRESENT / HALF_DAY / ABSENT / leave / ...)
      - else configured holiday / weekly off
      - else NOT_MARKED (never turned into ABSENT unless AUTO_ABSENT is on)
    Future days return no rows: they are not "Not Marked".
    """
    if day > today:
        return []

    rows = []
    for emp in employees:
        if not _employee_eligible_on(emp, day):
            continue

        record = by_employee.get(emp.id, {}).get(day)
        code, source, note = _classify_day(day, record, rules, auto_absent, today)

        rows.append({
            **_employee_meta(emp),
            "employee_pk": emp.id,
            "date": day.isoformat(),
            "day_name": WEEKDAY_NAMES[day.weekday()],
            "status": code,
            "status_label": _status_label(code),
            "source": source,                     # record | rule | none
            "note": note,
            "login_time": _format_time_12h(record["login_time"]) if record else "",
            "logout_time": (
                _format_time_12h(record.get(LOGOUT_FIELD))
                if record and LOGOUT_FIELD else ""
            ),
            **_hours_block(record),
            "working_hours": _f(record["working_hours"]) if record else 0,
            "daily_wage": _f(record["daily_wage"]) if record else 0,
        })
    return rows


class AdminAttendanceAPIView(APIView):
    """
    Single endpoint driving the Admin → Attendance page.

    The frontend sends period + date (or month/year, or from/to for custom)
    plus optional department / status filters. The window is resolved
    server-side and echoed back as from / to.
    """

    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):
        params = request.query_params
        today = timezone.localdate()

        # ======================================================
        # 1. RESOLVE + VALIDATE WINDOW
        # ======================================================
        try:
            anchor, period, start, end = _resolve_request_window(params, today)
        except ValueError as exc:
            return Response(
                {"success": False, "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        department = (params.get("department") or "").strip()
        status_filter = (params.get("status") or "").strip().upper()

        base_employees = Employee.objects.filter(
            archived=False,
            employment_status="Active",
        )

        rules = _build_day_rules(start, end)
        auto_absent = _auto_absent_enabled()
        config = _rules_config()

        # ======================================================
        # 2. EMPLOYEE DAILY DETAIL (Eye button)
        # ======================================================
        employee_pk_raw = params.get("employee_id")
        if employee_pk_raw:
            try:
                employee_pk = int(employee_pk_raw)
            except (TypeError, ValueError):
                return Response(
                    {"success": False, "message": "Invalid employee_id."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if (end - start).days + 1 > MAX_DETAIL_DAYS:
                return Response(
                    {"success": False, "message": "Date range is too large for daily view."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Department filter is intentionally NOT applied here.
            employee = base_employees.filter(id=employee_pk).first()
            if not employee:
                return Response(
                    {"success": False, "message": "Employee not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            record_map = {
                row["date"]: row
                for row in (
                    Attendance.objects
                    .filter(employee_id=employee.id, date__gte=start, date__lte=end)
                    .order_by("id")  # if duplicates exist, the newest row wins
                    .values(*ATTENDANCE_VALUE_FIELDS)
                )
            }

            tally = _empty_tally()
            daily = []
            for day in _iter_days(start, end):
                # Days outside the employee's joining / relieving window are
                # not applicable, so they are neither counted nor listed.
                if not _employee_eligible_on(employee, day):
                    continue

                record = record_map.get(day)
                code, source, note = _classify_day(
                    day, record, rules, auto_absent, today
                )
                _tally_day(tally, day, code, record, today)
                daily.append({
                    "date": day.isoformat(),
                    "day_name": WEEKDAY_NAMES[day.weekday()],
                    "status": code,
                    "status_label": _status_label(code),
                    "source": source,          # record | rule | none
                    "note": note,
                    "is_future": day > today,
                    "login_time": _format_time_12h(record["login_time"]) if record else "",
                    "logout_time": (
                        _format_time_12h(record.get(LOGOUT_FIELD))
                        if record and LOGOUT_FIELD else ""
                    ),
                    **_hours_block(record),
                    "working_hours": _f(record["working_hours"]) if record else 0,
                    "daily_wage": _f(record["daily_wage"]) if record else 0,
                })

            return Response(
                {
                    "success": True,
                    "date": anchor.isoformat(),
                    "period": period,
                    "from": start.isoformat(),
                    "to": end.isoformat(),
                    "employee": {"id": employee.id, **_employee_meta(employee)},
                    "supports_logout": LOGOUT_FIELD is not None,
                    "config": config,
                    "totals": _public_tally(tally),
                    "daily_attendance": daily,
                },
                status=status.HTTP_200_OK,
            )

        # ======================================================
        # 3. ACTIVE EMPLOYEES + ONE ATTENDANCE QUERY (no N+1)
        # ======================================================
        employees_qs = base_employees
        if department and department.lower() != "all":
            employees_qs = employees_qs.filter(department=department)

        employees = list(employees_qs.order_by("employee_id"))
        total_active = len(employees)

        by_employee = defaultdict(dict)   # {emp_pk: {date: record}}
        records = (
            Attendance.objects
            .filter(
                employee_id__in=employees_qs.order_by().values("id"),
                date__gte=start,
                date__lte=end,
            )
            .order_by("id")               # later rows overwrite duplicates
            .values(*ATTENDANCE_VALUE_FIELDS)
        )
        for row in records:
            by_employee[row["employee_id"]][row["date"]] = row

        # ======================================================
        # 4. PER-EMPLOYEE TALLY OVER EVERY CALENDAR DAY
        # ======================================================
        all_days = list(_iter_days(start, end))
        tallies = {}
        for emp in employees:
            emp_records = by_employee.get(emp.id, {})
            tally = _empty_tally()
            for day in all_days:
                if not _employee_eligible_on(emp, day):
                    continue          # before joining / after relieving
                record = emp_records.get(day)
                code, _source, _note = _classify_day(
                    day, record, rules, auto_absent, today
                )
                _tally_day(tally, day, code, record, today)
            tallies[emp.id] = tally

        # ======================================================
        # 5. SUMMARY (employee counts — match the table rows)
        # ======================================================
        summary = {
            "present": sum(1 for e in employees if tallies[e.id]["days_worked"] > 0),
            "on_leave": sum(1 for e in employees if tallies[e.id]["leave_days"] > 0),
            "not_marked": sum(
                1 for e in employees
                if not by_employee.get(e.id) and tallies[e.id]["not_marked_days"] > 0
            ),
            "total_active": total_active,
        }

        day_totals = {
            key: sum(tallies[e.id][key] for e in employees)
            for key in (
                "days_worked", "leave_days", "absent_days", "holiday_days",
                "weekly_off_days", "not_marked_days", "upcoming_days",
            )
        }

        # ======================================================
        # 6. PRESENT ROWS
        # ======================================================
        present_rows = []

        if status_filter in ("", "ALL", "PRESENT", "HALF_DAY", "WFH"):
            wanted = (
                [status_filter]
                if status_filter in ATTENDANCE_PRESENT_STATUSES
                else ATTENDANCE_PRESENT_STATUSES
            )

            for emp in employees:
                emp_records = sorted(
                    (
                        r for r in by_employee.get(emp.id, {}).values()
                        if r["status"] in wanted
                    ),
                    key=lambda r: r["date"],
                )
                if not emp_records:
                    continue

                meta = _employee_meta(emp)

                if period == "day":
                    rec = emp_records[0]
                    present_rows.append({
                        "id": rec["id"],
                        **meta,
                        "status": rec["status"],
                        "login_time": _format_time_12h(rec["login_time"]),
                        "logout_time": (
                            _format_time_12h(rec.get(LOGOUT_FIELD))
                            if LOGOUT_FIELD else ""
                        ),
                        **_hours_block(rec),
                        "working_hours": float(rec["working_hours"] or 0),
                        "daily_wage": float(rec["daily_wage"] or 0),
                        "days_worked": 1,
                        "from_date": rec["date"].isoformat(),
                        "to_date": rec["date"].isoformat(),
                        "date": rec["date"].isoformat(),
                    })
                else:
                    present_rows.append({
                        "id": emp.id,
                        **meta,
                        "status": emp_records[-1]["status"],   # most recent
                        "login_time": "",
                        "normal_hours": round(
                            sum(_f(r.get("normal_hours")) for r in emp_records), 2
                        ),
                        "approved_ot_hours": round(
                            sum(_f(r.get("approved_ot_hours")) for r in emp_records), 2
                        ),
                        "total_hours": round(
                            sum(_f(r.get("total_hours")) for r in emp_records), 2
                        ),
                        "working_hours": round(
                            sum(float(r["working_hours"] or 0) for r in emp_records), 2
                        ),
                        "daily_wage": round(
                            sum(float(r["daily_wage"] or 0) for r in emp_records), 2
                        ),
                        "days_worked": len(emp_records),
                        "from_date": emp_records[0]["date"].isoformat(),
                        "to_date": emp_records[-1]["date"].isoformat(),
                    })

        # ======================================================
        # 7. LEAVE ROWS
        # ======================================================
        leave_rows = []

        if status_filter in ("", "ALL", "ON_LEAVE", "PAID_LEAVE", "UNPAID_LEAVE"):
            wanted_leave = (
                [status_filter]
                if status_filter in ATTENDANCE_LEAVE_STATUSES
                else ATTENDANCE_LEAVE_STATUSES
            )

            for emp in employees:
                emp_records = sorted(
                    (
                        r for r in by_employee.get(emp.id, {}).values()
                        if r["status"] in wanted_leave
                    ),
                    key=lambda r: r["date"],
                )
                if not emp_records:
                    continue

                meta = _employee_meta(emp)

                if period == "day":
                    rec = emp_records[0]
                    leave_rows.append({
                        "id": rec["id"],
                        **meta,
                        "status": rec["status"],
                        "reason": _status_label(rec["status"]),
                        "leave_days": 1,
                        "from_date": rec["date"].isoformat(),
                        "to_date": rec["date"].isoformat(),
                    })
                else:
                    leave_rows.append({
                        "id": emp.id,
                        **meta,
                        "status": emp_records[-1]["status"],
                        "reason": _status_label(emp_records[-1]["status"]),
                        "leave_days": len(emp_records),
                        "from_date": emp_records[0]["date"].isoformat(),
                        "to_date": emp_records[-1]["date"].isoformat(),
                    })

        # ======================================================
        # 8. MONTHLY LIST — every active employee, exactly once
        # ======================================================
        employee_rows = []

        if period == "month":
            for emp in employees:
                emp_records = by_employee.get(emp.id, {})

                if status_filter not in ("", "ALL") and not any(
                    _record_matches_filter(r, status_filter)
                    for r in emp_records.values()
                ):
                    continue

                tally = tallies[emp.id]
                headline = _headline_status(tally)

                employee_rows.append({
                    "id": emp.id,                  # Employee PK → used by the Eye button
                    **_employee_meta(emp),
                    "status": headline,
                    "status_label": _status_label(headline),
                    "days_worked": tally["days_worked"],
                    "present_days": tally["present_days"],
                    "half_days": tally["half_days"],
                    "wfh_days": tally["wfh_days"],
                    "leave_days": tally["leave_days"],
                    "absent_days": tally["absent_days"],
                    "holiday_days": tally["holiday_days"],
                    "weekly_off_days": tally["weekly_off_days"],
                    "not_marked_days": tally["not_marked_days"],
                    "upcoming_days": tally["upcoming_days"],
                    "normal_hours": round(tally["normal_hours"], 2),
                    "approved_ot_hours": round(tally["approved_ot_hours"], 2),
                    "total_hours": round(tally["recorded_total_hours"], 2),
                    "working_hours": round(tally["total_hours"], 2),
                    "daily_wage": round(tally["total_wage"], 2),
                    "from_date": start.isoformat(),
                    "to_date": end.isoformat(),
                })

        # ======================================================
        # 9. RESPONSE
        # ======================================================
        payload = {
            "success": True,
            "date": anchor.isoformat(),
            "period": period,
            "from": start.isoformat(),
            "to": end.isoformat(),
            "summary": summary,
            "day_totals": day_totals,
            "config": config,
            "present": present_rows,
            "leave": leave_rows,
            "employees": employee_rows,
        }

        # Complete per-day list (Absent / Not Marked included) — period=day only.
        if period == "day":
            payload["daily_attendance"] = _build_daily_list(
                employees, by_employee, anchor, rules, auto_absent, today
            )

        return Response(payload, status=status.HTTP_200_OK)

# =====================================================================
# ADMIN — PO PENDING GRN
# -----------------------------------------------------------------
# GET /erp/admin/po-pending-grn/
#
# Returns every CONFIRMED real PO line that is not yet fully
# received — where "received" is the COMBINED total from both:
#
#     MaterialGRN.received_qty          (Material Planning)
#     ConsumableGRN.received_quantity   (Consumable module)
#
# Rules:
#   - Only CONFIRMED PurchaseOrders.
#   - Dummy POs are ALWAYS treated as received → never appear here.
#   - balance = poQty - (materialReceived + consumableReceived)
#   - Rows with balance <= 0 are dropped (fully received).
#
# Row shape:
#   id, poItemId, sourceType, poNumber, poType, supplier,
#   description, poQty,
#   materialReceived, consumableReceived, received,
#   balance, unit, grnStatus
# =====================================================================
# =====================================================================
# ADMIN — PO PENDING GRN
# -----------------------------------------------------------------
# GET /erp/admin/po-pending-grn/
#
# Every CONFIRMED real PO line that is not yet fully received.
#
# "received" = MaterialGRN.received_qty
#            + ConsumableGRN.received_quantity
#
# Rules:
#   - Only CONFIRMED PurchaseOrders.
#   - Dummy POs are ALWAYS treated as received → never appear here.
#   - balance = poQty - received
#   - Rows with balance <= 0 are dropped.
#
# Row carries the full PurchaseOrderItem snapshot so the frontend
# does not need any second lookup.
# =====================================================================


class AdminPoPendingGRnAPIView(APIView):
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):

        # ---- Real confirmed PO items ----
        real_items = list(
            PurchaseOrderItem.objects
            .select_related("purchase_order")
            .filter(
                purchase_order__status=PurchaseOrder.Status.CONFIRMED,
            )
            .order_by(
                "purchase_order__po_number",
                "id",
            )
        )

        if not real_items:
            return Response(
                {"success": True, "count": 0, "data": []},
                status=status.HTTP_200_OK,
            )

        # ---- MaterialGRN receipts per PO item ----
        material_map = {
            row["purchase_order_item_id"]: row["total"]
            for row in (
                MaterialGRN.objects
                .filter(purchase_order_item__in=real_items)
                .values("purchase_order_item_id")
                .annotate(total=Sum("received_qty"))
            )
        }

        # ---- ConsumableGRN receipts per PO item ----
        consumable_map = {
            row["purchase_order_item_id"]: row["total"]
            for row in (
                ConsumableGRN.objects
                .filter(purchase_order_item__in=real_items)
                .values("purchase_order_item_id")
                .annotate(total=Sum("received_quantity"))
            )
        }

        rows = []

        for pi in real_items:
            po_qty = pi.quantity or Decimal("0")

            material_received = material_map.get(pi.id, Decimal("0"))
            consumable_received = consumable_map.get(pi.id, Decimal("0"))

            received = material_received + consumable_received
            balance = po_qty - received

            # Fully received → skip
            if balance <= 0:
                continue

            grn_status = (
                "Not Received" if received <= 0
                else "Partially Received"
            )

            po = pi.purchase_order

            # PurchaseOrder.vendor is a JSONField → resolve a readable name
            supplier = _material_grn_supplier(po.vendor)

            rows.append({
                # ---- row identity ----
                "id": f"real-{pi.id}",
                "poItemId": pi.id,
                "sourceType": "real",
                "poType": "Regular PO",

                # ---- PO header ----
                "poNumber": pi.po_number or po.po_number,
                "poDate": (
                    po.po_date.isoformat()
                    if po.po_date else ""
                ),
                "supplier": supplier,

                # ---- PO item snapshot ----
                "itemCode": pi.item_code or "",
                "description": pi.description or "",
                "material": pi.material or "",
                "materialCode": pi.material_code or "",
                "materialSpec": pi.material_spec or "",
                "thickness": pi.thickness or "",
                "length": pi.length or "",
                "width": pi.width or "",

                # ---- quantities ----
                "unit": pi.unit or "",
                "poQty": float(po_qty),

                "materialReceived": float(material_received),
                "consumableReceived": float(consumable_received),
                "received": float(received),
                "balance": float(balance),

                # ---- status ----
                "grnStatus": grn_status,
            })

        return Response(
            {"success": True, "count": len(rows), "data": rows},
            status=status.HTTP_200_OK,
        )

# =====================================================================
# ADMIN — DOCUMENT NUMBER CONTROL
# -----------------------------------------------------------------
# GET   /erp/admin/document-numbers/            → 5 rows
# PATCH /erp/admin/document-numbers/<key>/      → update one
# GET   /erp/admin/document-numbers/<key>/used/ → list issued numbers
#
# Keys: po, quotation, dc, tax-invoice, proforma
#
# currentNumber = next_number - 1   (derived; nothing extra stored)
# =====================================================================

from .models import (
    PurchaseOrderNumberSettings,
    QuotationNumberSettings,
    DeliveryChallanNumberSettings,
    TaxInvoiceNumberSettings,
    ProformaInvoiceNumberSettings,
)


DOCUMENT_NUMBER_REGISTRY = {
    "po":          (PurchaseOrderNumberSettings,   "Purchase Order"),
    "quotation":   (QuotationNumberSettings,       "Quotation"),
    "dc":          (DeliveryChallanNumberSettings, "Delivery Challan"),
    "tax-invoice": (TaxInvoiceNumberSettings,      "Tax Invoice"),
    "proforma":    (ProformaInvoiceNumberSettings, "Proforma Invoice"),
}


def _format_number(prefix, value, padding):
    return f"{prefix}{value:0{padding}d}"


def _serialize_docnum(key, model, label):
    obj = (
        model.objects.filter(is_active=True).first()
        or model.objects.order_by("id").first()
    )

    if obj is None:
        return {
            "key": key,
            "label": label,
            "exists": False,
            "prefix": "",
            "nextNumber": 1,
            "numberPadding": 3,
            "isActive": False,
            "currentNumber": "—",
            "nextNumberFormatted": "—",
        }

    current_value = max(obj.next_number - 1, 0)

    return {
        "key": key,
        "label": label,
        "exists": True,
        "id": obj.id,
        "prefix": obj.prefix,
        "nextNumber": obj.next_number,
        "numberPadding": obj.number_padding,
        "isActive": obj.is_active,
        "currentNumber": (
            _format_number(obj.prefix, current_value, obj.number_padding)
            if current_value > 0
            else "—"
        ),
        "nextNumberFormatted": _format_number(
            obj.prefix, obj.next_number, obj.number_padding
        ),
    }


class AdminDocumentNumberListAPIView(APIView):
    """GET /erp/admin/document-numbers/"""

    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):
        rows = [
            _serialize_docnum(key, model, label)
            for key, (model, label) in DOCUMENT_NUMBER_REGISTRY.items()
        ]

        return Response(
            {"success": True, "count": len(rows), "data": rows},
            status=status.HTTP_200_OK,
        )


class AdminDocumentNumberDetailAPIView(APIView):
    """
    PATCH /erp/admin/document-numbers/<key>/

    Body (all optional):
        {
          "prefix": "PO",
          "nextNumber": 42,
          "numberPadding": 4,
          "isActive": true
        }
    """

    permission_classes = [IsAuthenticated, IsERPAdmin]

    @transaction.atomic
    def patch(self, request, key):

        entry = DOCUMENT_NUMBER_REGISTRY.get(key)

        if not entry:
            return Response(
                {"success": False, "message": f"Unknown document type: {key}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        model, label = entry

        obj = (
            model.objects
            .select_for_update()
            .filter(is_active=True)
            .first()
        )

        if obj is None:
            obj = (
                model.objects
                .select_for_update()
                .order_by("id")
                .first()
            )

        # ---- First-time create ----
        if obj is None:
            try:
                prefix = str(request.data.get("prefix", "DOC")).strip() or "DOC"
                next_number = int(request.data.get("nextNumber", 1))
                padding = int(request.data.get("numberPadding", 3))
            except (TypeError, ValueError):
                return Response(
                    {"success": False, "message": "Invalid numeric value."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            obj = model.objects.create(
                prefix=prefix,
                next_number=next_number,
                number_padding=padding,
                is_active=bool(request.data.get("isActive", True)),
            )

            return Response(
                {
                    "success": True,
                    "message": "Settings created.",
                    "data": _serialize_docnum(key, model, label),
                },
                status=status.HTTP_201_CREATED,
            )

        updated_fields = []

        # ---- Prefix ----
        if "prefix" in request.data:
            new_prefix = str(request.data["prefix"]).strip()
            if not new_prefix:
                return Response(
                    {"success": False, "message": "Prefix cannot be empty."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if len(new_prefix) > 20:
                return Response(
                    {"success": False, "message": "Prefix cannot exceed 20 characters."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            obj.prefix = new_prefix
            updated_fields.append("prefix")

        # ---- Next Number ----
        if "nextNumber" in request.data:
            try:
                new_number = int(request.data["nextNumber"])
            except (TypeError, ValueError):
                return Response(
                    {"success": False, "message": "nextNumber must be an integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if new_number < 1:
                return Response(
                    {"success": False, "message": "nextNumber must be at least 1."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            obj.next_number = new_number
            updated_fields.append("next_number")

        # ---- Padding ----
        if "numberPadding" in request.data:
            try:
                new_pad = int(request.data["numberPadding"])
            except (TypeError, ValueError):
                return Response(
                    {"success": False, "message": "numberPadding must be an integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not (1 <= new_pad <= 10):
                return Response(
                    {"success": False, "message": "numberPadding must be between 1 and 10."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            obj.number_padding = new_pad
            updated_fields.append("number_padding")

        # ---- Active ----
        if "isActive" in request.data:
            new_active = bool(request.data["isActive"])

            if new_active and not obj.is_active:
                model.objects.exclude(pk=obj.pk).update(is_active=False)
                obj.is_active = True
                updated_fields.append("is_active")

            elif not new_active and obj.is_active:
                return Response(
                    {
                        "success": False,
                        "message": (
                            "This document type must always have one "
                            "active settings row."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if updated_fields:
            updated_fields.append("updated_at")
            obj.save(update_fields=updated_fields)

        return Response(
            {
                "success": True,
                "message": "Document number updated.",
                "data": _serialize_docnum(key, model, label),
            },
            status=status.HTTP_200_OK,
        )


class AdminDocumentNumberUsedAPIView(APIView):
    """
    GET /erp/admin/document-numbers/<key>/used/

    Returns every document number actually issued for that type.
    """

    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request, key):

        if key not in DOCUMENT_NUMBER_REGISTRY:
            return Response(
                {"success": False, "message": f"Unknown document type: {key}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        rows = []

        if key == "po":
            rows = [
                {"number": p.po_number, "createdAt": p.created_at}
                for p in PurchaseOrder.objects.order_by("-created_at")
                if p.po_number
            ]

        elif key == "quotation":
            rows = [
                {"number": q.quotation_number, "createdAt": q.created_at}
                for q in Quotation.objects.order_by("-created_at")
                if q.quotation_number
            ]

        elif key == "dc":
            rows = [
                {"number": d.dc_number, "createdAt": d.created_at}
                for d in DeliveryChallan.objects.order_by("-created_at")
                if d.dc_number
            ]

        elif key == "tax-invoice":
            rows = [
                {"number": t.invoice_number, "createdAt": t.created_at}
                for t in TaxInvoice.objects.order_by("-created_at")
                if t.invoice_number
            ]

        elif key == "proforma":
            rows = [
                {"number": p.proforma_no, "createdAt": p.created_at}
                for p in ProformaInvoice.objects.order_by("-created_at")
                if p.proforma_no
            ]

        return Response(
            {
                "success": True,
                "key": key,
                "count": len(rows),
                "data": rows,
            },
            status=status.HTTP_200_OK,
        )



# =====================================================================
# ADMIN — PROJECT STATUS
# -----------------------------------------------------------------
# GET /erp/admin/project-status/
#
# Query params:
#   ?search=<text>          matches project name OR project code
#   ?status=Active|On Hold|Completed
#
# Returns one row per PROJECT, each with a nested `assemblies` list.
# For every assembly we compute:
#   - currentProcess     → live stage name from AssemblyStageExecution
#   - currentProcessId   → that stage's process_id
#   - currentStageLabel  → Not Started / Ready to Start / In Progress /
#                          Awaiting QC / In Rework / Outsourced /
#                          Completed / Pending
#   - currentSequence    → sequence number of that stage
#   - totalStages        → how many stages the planned route has
#
# The stage data comes from AssemblyExecution + AssemblyStageExecution,
# which Production Operation writes — no manual "current_process" field.
# =====================================================================

from .models import (
    Project,
    Assembly,
    AssemblyExecution,
)


def _resolve_current_stage(execution):
    """
    Return (stage, label) for the assembly's live stage.

    Rules (match how _release_to_next_stage in ProductionOperation works):

      - No execution yet               → (None, "Not Started")
      - Execution is COMPLETED         → (None, "Completed")
      - Execution CANCELLED            → (None, "Cancelled")

      Otherwise walk the stages in sequence order. The first stage
      that is still "busy" is the current one. Busy = any of:

          available_qty > 0
          pending_operation_qty > 0
          awaiting_qc_qty > 0
          rework_qty > 0
          sent_qty > received_qty   (sitting at an outsourcing vendor)

      Label is derived from which counter is non-zero, in that order.
    """
    if execution is None:
        return None, "Not Started"

    if execution.status == AssemblyExecution.Status.COMPLETED:
        return None, "Completed"

    if execution.status == AssemblyExecution.Status.CANCELLED:
        return None, "Cancelled"

    stages = list(execution.stages.order_by("sequence"))

    if not stages:
        return None, "Not Started"

    for stage in stages:
        available  = stage.available_qty or 0
        pending    = stage.pending_operation_qty or 0
        awaiting_qc = stage.awaiting_qc_qty or 0
        rework     = stage.rework_qty or 0
        sent       = stage.sent_qty or 0
        received   = stage.received_qty or 0

        outsourced_pending = sent - received

        busy = (
            available > 0
            or pending > 0
            or awaiting_qc > 0
            or rework > 0
            or outsourced_pending > 0
        )

        if not busy:
            continue

        if outsourced_pending > 0:
            label = "Outsourced"
        elif awaiting_qc > 0:
            label = "Awaiting QC"
        elif rework > 0:
            label = "In Rework"
        elif stage.started and pending > 0:
            label = "In Progress"
        elif pending > 0:
            label = "Ready to Start"
        else:
            label = "Pending"

        return stage, label

    # Every stage finished but execution.status not yet flipped
    return None, "Completed"


class AdminProjectStatusAPIView(APIView):
    """
    GET /erp/admin/project-status/
    """

    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):

        search        = (request.query_params.get("search") or "").strip()
        status_filter = (request.query_params.get("status") or "").strip()

        projects = (
            Project.objects
            .all()
            .order_by("-created_at")
        )

        if search:
            projects = projects.filter(
                Q(name__icontains=search)
                | Q(code__icontains=search)
            )

        if status_filter and status_filter.lower() != "all":
            projects = projects.filter(status=status_filter)

        rows = []

        for project in projects:

            # ---- Assemblies for this project ----
            assemblies_qs = (
                Assembly.objects
                .filter(project=project)
                .select_related("execution")
                .prefetch_related(
                    "execution__stages",
                    "processes",
                )
                .order_by("-created_at")
            )

            assembly_rows = []

            for asm in assemblies_qs:

                execution = getattr(asm, "execution", None)
                stage, stage_label = _resolve_current_stage(execution)

                # ---- Resolve what to display as "current process" ----
                if stage is not None:
                    current_process    = stage.name
                    current_process_id = stage.process_id
                    current_sequence   = stage.sequence

                elif stage_label == "Completed":
                    current_process    = "Completed"
                    current_process_id = ""
                    current_sequence   = None

                elif stage_label == "Cancelled":
                    current_process    = "Cancelled"
                    current_process_id = ""
                    current_sequence   = None

                else:
                    # Nothing started yet → show the FIRST planned process
                    first = asm.processes.order_by("sequence").first()
                    current_process    = first.name if first else "—"
                    current_process_id = first.process_id if first else ""
                    current_sequence   = first.sequence if first else None

                assembly_rows.append({
                    "id":                  asm.id,
                    "assemblyId":          asm.assembly_id,
                    "status":              asm.status,
                    "currentProcess":      current_process,
                    "currentProcessId":    current_process_id,
                    "currentStageLabel":   stage_label,
                    "currentSequence":     current_sequence,
                    "totalStages":         asm.processes.count(),
                    "dwgDescription":      asm.dwg_description or "",
                    "notes":               asm.notes or "",
                    "createdAt":           asm.created_at,
                })

            # ---- Project-level rollup ----
            total       = len(assembly_rows)
            completed   = sum(1 for a in assembly_rows
                              if a["status"] == Assembly.Status.COMPLETED)
            in_progress = sum(1 for a in assembly_rows
                              if a["status"] == Assembly.Status.IN_PROGRESS)
            planned     = sum(1 for a in assembly_rows
                              if a["status"] == Assembly.Status.PLANNED)
            cancelled   = sum(1 for a in assembly_rows
                              if a["status"] == Assembly.Status.CANCELLED)

            rows.append({
                "id":                    project.id,
                "name":                  project.name,
                "code":                  project.code,
                "status":                project.status,
                "startDate":             project.start_date,
                "endDate":               project.end_date,
                "totalAssemblies":       total,
                "completedAssemblies":   completed,
                "inProgressAssemblies":  in_progress,
                "plannedAssemblies":     planned,
                "cancelledAssemblies":   cancelled,
                "assemblies":            assembly_rows,
            })

        return Response(
            {
                "success": True,
                "count":   len(rows),
                "data":    rows,
            },
            status=status.HTTP_200_OK,
        )


# =====================================================================
# ADMIN — ASSEMBLY STAGE DETAIL (Eye button on Project Status page)
# -----------------------------------------------------------------
# GET /erp/admin/project-status/<assembly_id>/
#
# Returns the full stage-by-stage state of one assembly:
#   - every stage in sequence order
#   - its quantity counters
#   - its status label (Not Started / Ready to Start / In Progress /
#     Awaiting QC / In Rework / Outsourced / Completed)
#   - its movement log (who did what, when)
#   - the assembly-level events feed
#
# <assembly_id> is the Assembly.assembly_id string (e.g. "ASM007").
# =====================================================================

def _stage_status_label(stage):
    """
    Derive a single status label for one stage from its counters.
    Mirrors the logic in _resolve_current_stage.
    """
    sent = stage.sent_qty or 0
    received = stage.received_qty or 0
    outsourced_pending = sent - received

    if outsourced_pending > 0:
        return "Outsourced"

    if (stage.awaiting_qc_qty or 0) > 0:
        return "Awaiting QC"

    if (stage.rework_qty or 0) > 0:
        return "In Rework"

    if stage.started and (stage.pending_operation_qty or 0) > 0:
        return "In Progress"

    if (stage.pending_operation_qty or 0) > 0:
        return "Ready to Start"

    # Nothing left to do on this stage but the execution isn't completed
    # → it's fully released
    if (stage.released_qty or 0) > 0 or (stage.received_qty or 0) > 0:
        return "Completed"

    return "Not Started"


class AdminAssemblyStageDetailAPIView(APIView):
    """
    GET /erp/admin/project-status/<assembly_id>/
    """

    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request, assembly_id):

        try:
            asm = (
                Assembly.objects
                .select_related("project", "execution")
                .prefetch_related(
                    "execution__stages",
                    "execution__stages__movements",
                    "execution__events",
                    "processes",
                )
                .get(assembly_id=assembly_id)
            )
        except Assembly.DoesNotExist:
            return Response(
                {"success": False, "message": "Assembly not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        execution = getattr(asm, "execution", None)

        # ---------------------------------------------------------
        # Assembly header
        # ---------------------------------------------------------
        header = {
            "id": asm.id,
            "assemblyId": asm.assembly_id,
            "projectId": asm.project_id,
            "projectName": asm.project.name if asm.project else "",
            "projectCode": asm.project.code if asm.project else "",
            "status": asm.status,
            "dwgDescription": asm.dwg_description or "",
            "notes": asm.notes or "",
            "createdAt": asm.created_at,
            "executionStatus": execution.status if execution else "Pending",
            "startedAt": execution.started_at if execution else None,
            "completedAt": execution.completed_at if execution else None,
        }

        # ---------------------------------------------------------
        # Stages
        # ---------------------------------------------------------
        if execution is not None:
            stage_qs = execution.stages.order_by("sequence")
        else:
            # No execution yet — fall back to the planned route so the
            # modal still renders something useful.
            stage_qs = []

        stages_payload = []

        if execution is not None:

            for stage in stage_qs:

                label = _stage_status_label(stage)

                movements = list(
                    stage.movements.order_by("-created_at")[:50]
                )

                stages_payload.append({
                    "id": stage.id,
                    "sequence": stage.sequence,
                    "name": stage.name,
                    "processId": stage.process_id,
                    "status": label,
                    "qcRequired": stage.qc_required,
                    "executionType": stage.execution_type,
                    "executionUnit": stage.execution_unit or "",
                    "vendor": stage.vendor or "",
                    "vendorContact": stage.vendor_contact or "",
                    "vendorLocation": stage.vendor_location or "",
                    "expectedReturnDate": stage.expected_return_date,
                    "started": stage.started,

                    "availableQty": float(stage.available_qty or 0),
                    "pendingOperationQty": float(stage.pending_operation_qty or 0),
                    "sentQty": float(stage.sent_qty or 0),
                    "receivedQty": float(stage.received_qty or 0),
                    "awaitingQcQty": float(stage.awaiting_qc_qty or 0),
                    "reworkQty": float(stage.rework_qty or 0),
                    "releasedQty": float(stage.released_qty or 0),

                    "movements": [
                        {
                            "id": mv.id,
                            "movement": mv.movement,
                            "quantity": float(mv.quantity or 0),
                            "performedBy": mv.performed_by or "",
                            "supervisedBy": mv.supervised_by or "",
                            "remarks": mv.remarks or "",
                            "dcRef": mv.dc_ref or "",
                            "createdAt": mv.created_at,
                        }
                        for mv in movements
                    ],
                })

        else:
            # Planned-only fallback
            for proc in asm.processes.order_by("sequence"):
                stages_payload.append({
                    "id": None,
                    "sequence": proc.sequence,
                    "name": proc.name,
                    "processId": proc.process_id,
                    "status": "Not Started",
                    "qcRequired": proc.qc_required,
                    "executionType": proc.execution_type,
                    "executionUnit": proc.execution_unit or "",
                    "vendor": proc.vendor or "",
                    "vendorContact": proc.vendor_contact or "",
                    "vendorLocation": proc.vendor_location or "",
                    "expectedReturnDate": proc.expected_return_date,
                    "started": False,
                    "availableQty": 0,
                    "pendingOperationQty": 0,
                    "sentQty": 0,
                    "receivedQty": 0,
                    "awaitingQcQty": 0,
                    "reworkQty": 0,
                    "releasedQty": 0,
                    "movements": [],
                })

        # ---------------------------------------------------------
        # Events feed
        # ---------------------------------------------------------
        events_payload = []
        if execution is not None:
            events_payload = [
                {
                    "id": ev.id,
                    "date": ev.event_date,
                    "text": ev.event_text,
                    "createdAt": ev.created_at,
                }
                for ev in execution.events.order_by("created_at")
            ]

        # ---------------------------------------------------------
        # Current stage (for the header pill)
        # ---------------------------------------------------------
        stage, stage_label = _resolve_current_stage(execution)

        current_payload = None
        if stage is not None:
            current_payload = {
                "sequence": stage.sequence,
                "name": stage.name,
                "processId": stage.process_id,
                "label": stage_label,
            }
        elif stage_label:
            current_payload = {
                "sequence": None,
                "name": stage_label,
                "processId": "",
                "label": stage_label,
            }

        return Response(
            {
                "success": True,
                "data": {
                    "assembly": header,
                    "currentStage": current_payload,
                    "stages": stages_payload,
                    "events": events_payload,
                },
            },
            status=status.HTTP_200_OK,
        )

# =====================================================================
# ADMIN — STATISTICS DASHBOARD
# -----------------------------------------------------------------
# GET /erp/admin/statistics/
#
# Query params:
#   ?period=day|week|month|quarter|year|custom
#   ?from=YYYY-MM-DD  (only for period=custom)
#   ?to=YYYY-MM-DD    (only for period=custom)
#
# Month filter  -> last 12 calendar months (continuous, zero-filled)
# Other filters -> same ranges as before
# =====================================================================

from datetime import date, timedelta
from decimal import Decimal
import calendar

from django.db.models import Sum, Q, Case, When, Value, DecimalField
from django.db.models.functions import (
    Coalesce,
    TruncDay,
    TruncWeek,
    TruncMonth,
    TruncQuarter,
    TruncYear,
)

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import (
    JournalEntry,
    PaymentRecord,
    Project,
    PurchaseOrder,
    PurchaseOrderItem,
    TaxInvoice,
    ProformaInvoice,
    SalaryPayment,
    Advance,
    MaterialGRN,
    ConsumableGRN,
)

# NOTE: keep whatever import you already use for IsERPAdmin, e.g.
# from .permissions import IsERPAdmin


VALID_PERIODS = {"day", "week", "month", "quarter", "year", "custom"}

TRUNC_BY_GRANULARITY = {
    "day": TruncDay,
    "week": TruncWeek,
    "month": TruncMonth,
    "quarter": TruncQuarter,
    "year": TruncYear,
}

MAX_FILLED_BUCKETS = 36  # safety cap for zero-filling very long custom ranges


# ---------------------------------------------------------------------
# DATE HELPERS
# ---------------------------------------------------------------------
def _add_months(d, months):
    """Return the first day of the month `months` away from d's month."""
    total = d.year * 12 + (d.month - 1) + months
    year, month_index = divmod(total, 12)
    return date(year, month_index + 1, 1)


def _month_end(d):
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


def _get_statistics_date_range(period, from_date, to_date):
    """
    Resolves the requested period into a concrete (start_date, end_date).

    month   -> first day of the month 11 months ago  ..  last day of this month
               (12 calendar months including the current one)
    """
    today = date.today()

    if period == "day":
        return today, today

    if period == "week":
        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=6)

    if period == "month":
        start = _add_months(today.replace(day=1), -11)
        return start, _month_end(today)

    if period == "quarter":
        q_start_month = ((today.month - 1) // 3) * 3 + 1
        q_end_month = q_start_month + 2
        last_day = calendar.monthrange(today.year, q_end_month)[1]
        return date(today.year, q_start_month, 1), date(today.year, q_end_month, last_day)

    if period == "year":
        return date(today.year, 1, 1), date(today.year, 12, 31)

    if period == "custom":
        if from_date and to_date:
            try:
                start = date.fromisoformat(from_date)
                end = date.fromisoformat(to_date)
                if end < start:
                    start, end = end, start
                return start, end
            except ValueError:
                pass
        # Fallback if custom dates are missing / invalid: current month
        return today.replace(day=1), _month_end(today)

    # Unknown period -> same as month (12 months)
    start = _add_months(today.replace(day=1), -11)
    return start, _month_end(today)


def _bucket_start(granularity, d):
    """First day of the bucket that contains d."""
    if granularity == "day":
        return d
    if granularity == "week":
        return d - timedelta(days=d.weekday())
    if granularity == "month":
        return d.replace(day=1)
    if granularity == "quarter":
        return date(d.year, ((d.month - 1) // 3) * 3 + 1, 1)
    if granularity == "year":
        return date(d.year, 1, 1)
    return d.replace(day=1)


def _next_bucket(granularity, d):
    if granularity == "day":
        return d + timedelta(days=1)
    if granularity == "week":
        return d + timedelta(days=7)
    if granularity == "month":
        return _add_months(d, 1)
    if granularity == "quarter":
        return _add_months(d, 3)
    if granularity == "year":
        return date(d.year + 1, 1, 1)
    return _add_months(d, 1)


def _iter_buckets(granularity, start_date, end_date):
    current = _bucket_start(granularity, start_date)
    while current <= end_date:
        yield current
        current = _next_bucket(granularity, current)


def _normalize_date(value):
    """Trunc* on DateTimeField returns datetime; on DateField returns date."""
    if value is None:
        return None
    if hasattr(value, "date"):
        return value.date()
    return value


def _get_label(granularity, dt):
    if granularity == "day":
        return dt.strftime("%d %b")
    if granularity == "week":
        return f"Wk {dt.strftime('%d %b')}"
    if granularity == "quarter":
        return f"{dt.year}-Q{((dt.month - 1) // 3) + 1}"
    if granularity == "year":
        return str(dt.year)
    return dt.strftime("%b %y")  # month / custom -> "Nov 25"


class AdminStatisticsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):
        period = request.query_params.get("period", "month")
        if period not in VALID_PERIODS:
            period = "month"

        from_date = request.query_params.get("from")
        to_date = request.query_params.get("to")

        start_date, end_date = _get_statistics_date_range(
            period, from_date, to_date
        )

        # Custom ranges are grouped month-wise (same as before)
        granularity = "month" if period == "custom" else period
        trunc = TRUNC_BY_GRANULARITY[granularity]

        zero = Decimal("0.00")
        money_field = DecimalField(max_digits=24, decimal_places=2)

        def sum_if(value_field, **condition):
            """SUM(value_field) WHERE condition, 0 when nothing matches."""
            return Coalesce(
                Sum(
                    Case(
                        When(then=value_field, **condition),
                        default=Value(zero),
                        output_field=money_field,
                    )
                ),
                Value(zero),
                output_field=money_field,
            )

        # =====================================================
        # 1. TIMELINE BUCKETS (continuous, zero-filled)
        # =====================================================
        timeline_map = {}

        def ensure_bucket(value):
            value = _normalize_date(value)
            if value is None:
                return None
            key = value.isoformat()
            if key not in timeline_map:
                timeline_map[key] = {
                    "key": key,
                    "label": _get_label(granularity, value),
                    "revenue": zero,
                    "expenses": zero,
                }
            return key

        bucket_starts = list(_iter_buckets(granularity, start_date, end_date))
        if len(bucket_starts) <= MAX_FILLED_BUCKETS:
            for bucket_start in bucket_starts:
                ensure_bucket(bucket_start)

        # =====================================================
        # 2. JOURNAL ENTRIES  (grouped by `date`)
        #    One query: income + expenses per bucket
        # =====================================================
        journal_qs = JournalEntry.objects.filter(
            date__gte=start_date,
            date__lte=end_date,
        )

        journal_rows = (
            journal_qs
            .annotate(bucket=trunc("date"))
            .values("bucket")
            .annotate(
                income=sum_if("amount", type=JournalEntry.EntryType.INCOME),
                expenses=sum_if("amount", type=JournalEntry.EntryType.EXPENSE),
            )
            .order_by("bucket")
        )

        journal_income = zero
        journal_expenses = zero

        for row in journal_rows:
            key = ensure_bucket(row["bucket"])
            if key is None:
                continue
            timeline_map[key]["revenue"] += row["income"]
            timeline_map[key]["expenses"] += row["expenses"]
            journal_income += row["income"]
            journal_expenses += row["expenses"]

        # =====================================================
        # 3. PAYMENT RECORDS  (grouped by `paid_date`)
        #    incoming -> revenue, outgoing -> expenses
        # =====================================================
        payment_qs = PaymentRecord.objects.filter(
            paid_date__gte=start_date,
            paid_date__lte=end_date,
        )

        payment_rows = (
            payment_qs
            .annotate(bucket=trunc("paid_date"))
            .values("bucket")
            .annotate(
                incoming=sum_if(
                    "paid_amount",
                    payment_direction=PaymentRecord.PaymentDirection.INCOMING,
                ),
                outgoing=sum_if(
                    "paid_amount",
                    payment_direction=PaymentRecord.PaymentDirection.OUTGOING,
                ),
            )
            .order_by("bucket")
        )

        incoming_payments = zero
        outgoing_payments = zero

        for row in payment_rows:
            key = ensure_bucket(row["bucket"])
            if key is None:
                continue
            timeline_map[key]["revenue"] += row["incoming"]
            timeline_map[key]["expenses"] += row["outgoing"]
            incoming_payments += row["incoming"]
            outgoing_payments += row["outgoing"]

        # =====================================================
        # 4. SALARY PAYMENTS (grouped by `paid_date`)
        # =====================================================
        salary_rows = (
            SalaryPayment.objects.filter(
                payment_status="PAID",
                paid_date__gte=start_date,
                paid_date__lte=end_date,
            )
            .annotate(bucket=trunc("paid_date"))
            .values("bucket")
            .annotate(total=Sum("net_salary"))
            .order_by("bucket")
        )

        salary_paid = zero

        for row in salary_rows:
            key = ensure_bucket(row["bucket"])
            if key is None:
                continue
            amount = row["total"] or zero
            timeline_map[key]["expenses"] += amount
            salary_paid += amount

        # =====================================================
        # 5. ADVANCES (grouped by `advance_date`)
        # =====================================================
        advance_rows = (
            Advance.objects.filter(
                advance_date__gte=start_date,
                advance_date__lte=end_date,
            )
            .annotate(bucket=trunc("advance_date"))
            .values("bucket")
            .annotate(total=Sum("amount"))
            .order_by("bucket")
        )

        advances = zero

        for row in advance_rows:
            key = ensure_bucket(row["bucket"])
            if key is None:
                continue
            amount = row["total"] or zero
            timeline_map[key]["expenses"] += amount
            advances += amount

        # =====================================================
        # 6. REVENUE, EXPENSES AND PROFIT/LOSS (period totals)
        #    These equal the sum of the chart buckets.
        # =====================================================
        total_revenue = journal_income + incoming_payments
        total_expenses = (
            journal_expenses + outgoing_payments + salary_paid + advances
        )
        net_profit = total_revenue - total_expenses

        # =====================================================
        # 7. CHART DATA (oldest -> newest, per-bucket profit/loss)
        # =====================================================
        chart_data = [
            {
                "key": item["key"],
                "label": item["label"],
                "revenue": float(item["revenue"]),
                "expenses": float(item["expenses"]),
                "profit_loss": float(item["revenue"] - item["expenses"]),
            }
            for item in sorted(timeline_map.values(), key=lambda i: i["key"])
        ]

        # =====================================================
        # 8. OUTSTANDING (all dates, unpaid + non-cancelled)
        # =====================================================
        outstanding_tax_invoices = (
            TaxInvoice.objects.filter(
                payment_status=TaxInvoice.PaymentStatus.PENDING,
            )
            .exclude(status=TaxInvoice.Status.CANCELLED)
            .aggregate(total=Sum("grand_total"))["total"]
            or zero
        )

        outstanding_proforma_invoices = (
            ProformaInvoice.objects.filter(
                payment_status=ProformaInvoice.PaymentStatus.PENDING,
            )
            .exclude(status=ProformaInvoice.Status.CANCELLED)
            .aggregate(total=Sum("grand_total"))["total"]
            or zero
        )

        total_outstanding = (
            outstanding_tax_invoices + outstanding_proforma_invoices
        )

        # =====================================================
        # 9. EXPENSE BREAKDOWN
        # =====================================================
        category_rows = (
            journal_qs
            .filter(type=JournalEntry.EntryType.EXPENSE)
            .values("category")
            .annotate(total=Sum("amount"))
            .order_by()
        )

        breakdown_map = {}
        for row in category_rows:
            name = row["category"] or "Other"
            breakdown_map[name] = (
                breakdown_map.get(name, 0.0) + float(row["total"] or zero)
            )

        outgoing_by_document = (
            payment_qs
            .filter(payment_direction=PaymentRecord.PaymentDirection.OUTGOING)
            .values("document_type")
            .annotate(total=Sum("paid_amount"))
            .order_by()
        )

        for row in outgoing_by_document:
            category = f"Payment - {row['document_type'] or 'Other'}"
            breakdown_map[category] = (
                breakdown_map.get(category, 0.0) + float(row["total"] or zero)
            )

        breakdown_map["Salary"] = (
            breakdown_map.get("Salary", 0.0)
            + float(salary_paid)
            + float(advances)
        )

        expense_breakdown = [
            {"category": name, "amount": amount}
            for name, amount in breakdown_map.items()
        ]
        expense_breakdown.sort(key=lambda item: item["amount"], reverse=True)

        # =====================================================
        # 10. PURCHASE ORDER STATUS
        # =====================================================
        real_items = list(
            PurchaseOrderItem.objects
            .select_related("purchase_order")
            .filter(
                purchase_order__status=PurchaseOrder.Status.CONFIRMED,
                purchase_order__created_at__date__gte=start_date,
                purchase_order__created_at__date__lte=end_date,
            )
        )
        item_ids = [item.id for item in real_items]

        material_map = {
            row["purchase_order_item_id"]: row["total"] or zero
            for row in (
                MaterialGRN.objects
                .filter(purchase_order_item_id__in=item_ids)
                .values("purchase_order_item_id")
                .annotate(total=Sum("received_qty"))
            )
        }

        consumable_map = {
            row["purchase_order_item_id"]: row["total"] or zero
            for row in (
                ConsumableGRN.objects
                .filter(purchase_order_item_id__in=item_ids)
                .values("purchase_order_item_id")
                .annotate(total=Sum("received_quantity"))
            )
        }

        counts = {
            "Pending": 0,
            "Partially Received": 0,
            "Outstanding": 0,
            "Fully Received": 0,
        }

        for item in real_items:
            ordered = item.quantity or zero
            received = (
                material_map.get(item.id, zero)
                + consumable_map.get(item.id, zero)
            )
            balance = ordered - received

            if balance <= 0:
                counts["Fully Received"] += 1
            elif received <= 0:
                counts["Pending"] += 1
            else:
                counts["Partially Received"] += 1

        po_status_array = [
            {"status": name, "count": count} for name, count in counts.items()
        ]

        # =====================================================
        # 11. PROJECT COUNT
        # =====================================================
        total_projects = (
            Project.objects.filter(
                Q(start_date__gte=start_date, start_date__lte=end_date)
                | Q(
                    start_date__isnull=True,
                    created_at__date__gte=start_date,
                    created_at__date__lte=end_date,
                )
            )
            .distinct()
            .count()
        )

        # =====================================================
        # 12. RESPONSE (structure unchanged)
        # =====================================================
        return Response(
            {
                "success": True,
                "period": period,
                "range": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                },
                "data": {
                    "kpis": {
                        "revenue": float(total_revenue),
                        "expenses": float(total_expenses),
                        "profit_loss": float(net_profit),
                        "net_profit": float(net_profit),
                        "outstanding": float(total_outstanding),
                        "outstanding_tax_invoices": float(outstanding_tax_invoices),
                        "outstanding_proforma_invoices": float(outstanding_proforma_invoices),
                        "projects": total_projects,
                        "journal_income": float(journal_income),
                        "journal_expenses": float(journal_expenses),
                        "incoming_payments": float(incoming_payments),
                        "outgoing_payments": float(outgoing_payments),
                        "salary_paid": float(salary_paid),
                        "advances": float(advances),
                    },
                    "chart_data": chart_data,
                    "expense_breakdown": expense_breakdown,
                    "po_status": po_status_array,
                },
            },
            status=status.HTTP_200_OK,
        )# =====================================================================
# ADMIN — STATISTICS DASHBOARD
# -----------------------------------------------------------------
# GET /erp/admin/statistics/
#
# Query params:
#   ?period=day|week|month|quarter|year|custom
#   ?from=YYYY-MM-DD  (only for period=custom)
#   ?to=YYYY-MM-DD    (only for period=custom)
#
# Month filter  -> last 12 calendar months (continuous, zero-filled)
# Other filters -> same ranges as before
# =====================================================================

from datetime import date, timedelta
from decimal import Decimal
import calendar

from django.db.models import Sum, Q, Case, When, Value, DecimalField
from django.db.models.functions import (
    Coalesce,
    TruncDay,
    TruncWeek,
    TruncMonth,
    TruncQuarter,
    TruncYear,
)

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import (
    JournalEntry,
    PaymentRecord,
    Project,
    PurchaseOrder,
    PurchaseOrderItem,
    TaxInvoice,
    ProformaInvoice,
    SalaryPayment,
    Advance,
    MaterialGRN,
    ConsumableGRN,
)

# NOTE: keep whatever import you already use for IsERPAdmin, e.g.
# from .permissions import IsERPAdmin


VALID_PERIODS = {"day", "week", "month", "quarter", "year", "custom"}

TRUNC_BY_GRANULARITY = {
    "day": TruncDay,
    "week": TruncWeek,
    "month": TruncMonth,
    "quarter": TruncQuarter,
    "year": TruncYear,
}

MAX_FILLED_BUCKETS = 36  # safety cap for zero-filling very long custom ranges


# ---------------------------------------------------------------------
# DATE HELPERS
# ---------------------------------------------------------------------
def _add_months(d, months):
    """Return the first day of the month `months` away from d's month."""
    total = d.year * 12 + (d.month - 1) + months
    year, month_index = divmod(total, 12)
    return date(year, month_index + 1, 1)


def _month_end(d):
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


def _get_statistics_date_range(period, from_date, to_date):
    """
    Resolves the requested period into a concrete (start_date, end_date).

    month   -> first day of the month 11 months ago  ..  last day of this month
               (12 calendar months including the current one)
    """
    today = date.today()

    if period == "day":
        return today, today

    if period == "week":
        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=6)

    if period == "month":
        start = _add_months(today.replace(day=1), -11)
        return start, _month_end(today)

    if period == "quarter":
        q_start_month = ((today.month - 1) // 3) * 3 + 1
        q_end_month = q_start_month + 2
        last_day = calendar.monthrange(today.year, q_end_month)[1]
        return date(today.year, q_start_month, 1), date(today.year, q_end_month, last_day)

    if period == "year":
        return date(today.year, 1, 1), date(today.year, 12, 31)

    if period == "custom":
        if from_date and to_date:
            try:
                start = date.fromisoformat(from_date)
                end = date.fromisoformat(to_date)
                if end < start:
                    start, end = end, start
                return start, end
            except ValueError:
                pass
        # Fallback if custom dates are missing / invalid: current month
        return today.replace(day=1), _month_end(today)

    # Unknown period -> same as month (12 months)
    start = _add_months(today.replace(day=1), -11)
    return start, _month_end(today)


def _bucket_start(granularity, d):
    """First day of the bucket that contains d."""
    if granularity == "day":
        return d
    if granularity == "week":
        return d - timedelta(days=d.weekday())
    if granularity == "month":
        return d.replace(day=1)
    if granularity == "quarter":
        return date(d.year, ((d.month - 1) // 3) * 3 + 1, 1)
    if granularity == "year":
        return date(d.year, 1, 1)
    return d.replace(day=1)


def _next_bucket(granularity, d):
    if granularity == "day":
        return d + timedelta(days=1)
    if granularity == "week":
        return d + timedelta(days=7)
    if granularity == "month":
        return _add_months(d, 1)
    if granularity == "quarter":
        return _add_months(d, 3)
    if granularity == "year":
        return date(d.year + 1, 1, 1)
    return _add_months(d, 1)


def _iter_buckets(granularity, start_date, end_date):
    current = _bucket_start(granularity, start_date)
    while current <= end_date:
        yield current
        current = _next_bucket(granularity, current)


def _normalize_date(value):
    """Trunc* on DateTimeField returns datetime; on DateField returns date."""
    if value is None:
        return None
    if hasattr(value, "date"):
        return value.date()
    return value


def _get_label(granularity, dt):
    if granularity == "day":
        return dt.strftime("%d %b")
    if granularity == "week":
        return f"Wk {dt.strftime('%d %b')}"
    if granularity == "quarter":
        return f"{dt.year}-Q{((dt.month - 1) // 3) + 1}"
    if granularity == "year":
        return str(dt.year)
    return dt.strftime("%b %y")  # month / custom -> "Nov 25"


class AdminStatisticsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):
        period = request.query_params.get("period", "month")
        if period not in VALID_PERIODS:
            period = "month"

        from_date = request.query_params.get("from")
        to_date = request.query_params.get("to")

        start_date, end_date = _get_statistics_date_range(
            period, from_date, to_date
        )

        # Custom ranges are grouped month-wise (same as before)
        granularity = "month" if period == "custom" else period
        trunc = TRUNC_BY_GRANULARITY[granularity]

        zero = Decimal("0.00")
        money_field = DecimalField(max_digits=24, decimal_places=2)

        def sum_if(value_field, **condition):
            """SUM(value_field) WHERE condition, 0 when nothing matches."""
            return Coalesce(
                Sum(
                    Case(
                        When(then=value_field, **condition),
                        default=Value(zero),
                        output_field=money_field,
                    )
                ),
                Value(zero),
                output_field=money_field,
            )

        # =====================================================
        # 1. TIMELINE BUCKETS (continuous, zero-filled)
        # =====================================================
        timeline_map = {}

        def ensure_bucket(value):
            value = _normalize_date(value)
            if value is None:
                return None
            key = value.isoformat()
            if key not in timeline_map:
                timeline_map[key] = {
                    "key": key,
                    "label": _get_label(granularity, value),
                    "revenue": zero,
                    "expenses": zero,
                }
            return key

        bucket_starts = list(_iter_buckets(granularity, start_date, end_date))
        if len(bucket_starts) <= MAX_FILLED_BUCKETS:
            for bucket_start in bucket_starts:
                ensure_bucket(bucket_start)

        # =====================================================
        # 2. JOURNAL ENTRIES  (grouped by `date`)
        #    One query: income + expenses per bucket
        # =====================================================
        journal_qs = JournalEntry.objects.filter(
            date__gte=start_date,
            date__lte=end_date,
        )

        journal_rows = (
            journal_qs
            .annotate(bucket=trunc("date"))
            .values("bucket")
            .annotate(
                income=sum_if("amount", type=JournalEntry.EntryType.INCOME),
                expenses=sum_if("amount", type=JournalEntry.EntryType.EXPENSE),
            )
            .order_by("bucket")
        )

        journal_income = zero
        journal_expenses = zero

        for row in journal_rows:
            key = ensure_bucket(row["bucket"])
            if key is None:
                continue
            timeline_map[key]["revenue"] += row["income"]
            timeline_map[key]["expenses"] += row["expenses"]
            journal_income += row["income"]
            journal_expenses += row["expenses"]

        # =====================================================
        # 3. PAYMENT RECORDS  (grouped by `paid_date`)
        #    incoming -> revenue, outgoing -> expenses
        # =====================================================
        payment_qs = PaymentRecord.objects.filter(
            paid_date__gte=start_date,
            paid_date__lte=end_date,
        )

        payment_rows = (
            payment_qs
            .annotate(bucket=trunc("paid_date"))
            .values("bucket")
            .annotate(
                incoming=sum_if(
                    "paid_amount",
                    payment_direction=PaymentRecord.PaymentDirection.INCOMING,
                ),
                outgoing=sum_if(
                    "paid_amount",
                    payment_direction=PaymentRecord.PaymentDirection.OUTGOING,
                ),
            )
            .order_by("bucket")
        )

        incoming_payments = zero
        outgoing_payments = zero

        for row in payment_rows:
            key = ensure_bucket(row["bucket"])
            if key is None:
                continue
            timeline_map[key]["revenue"] += row["incoming"]
            timeline_map[key]["expenses"] += row["outgoing"]
            incoming_payments += row["incoming"]
            outgoing_payments += row["outgoing"]

        # =====================================================
        # 4. SALARY PAYMENTS (grouped by `paid_date`)
        # =====================================================
        salary_rows = (
            SalaryPayment.objects.filter(
                payment_status="PAID",
                paid_date__gte=start_date,
                paid_date__lte=end_date,
            )
            .annotate(bucket=trunc("paid_date"))
            .values("bucket")
            .annotate(total=Sum("net_salary"))
            .order_by("bucket")
        )

        salary_paid = zero

        for row in salary_rows:
            key = ensure_bucket(row["bucket"])
            if key is None:
                continue
            amount = row["total"] or zero
            timeline_map[key]["expenses"] += amount
            salary_paid += amount

        # =====================================================
        # 5. ADVANCES (grouped by `advance_date`)
        # =====================================================
        advance_rows = (
            Advance.objects.filter(
                advance_date__gte=start_date,
                advance_date__lte=end_date,
            )
            .annotate(bucket=trunc("advance_date"))
            .values("bucket")
            .annotate(total=Sum("amount"))
            .order_by("bucket")
        )

        advances = zero

        for row in advance_rows:
            key = ensure_bucket(row["bucket"])
            if key is None:
                continue
            amount = row["total"] or zero
            timeline_map[key]["expenses"] += amount
            advances += amount

        # =====================================================
        # 6. REVENUE, EXPENSES AND PROFIT/LOSS (period totals)
        #    These equal the sum of the chart buckets.
        # =====================================================
        total_revenue = journal_income + incoming_payments
        total_expenses = (
            journal_expenses + outgoing_payments + salary_paid + advances
        )
        net_profit = total_revenue - total_expenses

        # =====================================================
        # 7. CHART DATA (oldest -> newest, per-bucket profit/loss)
        # =====================================================
        chart_data = [
            {
                "key": item["key"],
                "label": item["label"],
                "revenue": float(item["revenue"]),
                "expenses": float(item["expenses"]),
                "profit_loss": float(item["revenue"] - item["expenses"]),
            }
            for item in sorted(timeline_map.values(), key=lambda i: i["key"])
        ]

        # =====================================================
        # 8. OUTSTANDING (all dates, unpaid + non-cancelled)
        # =====================================================
        outstanding_tax_invoices = (
            TaxInvoice.objects.filter(
                payment_status=TaxInvoice.PaymentStatus.PENDING,
            )
            .exclude(status=TaxInvoice.Status.CANCELLED)
            .aggregate(total=Sum("grand_total"))["total"]
            or zero
        )

        outstanding_proforma_invoices = (
            ProformaInvoice.objects.filter(
                payment_status=ProformaInvoice.PaymentStatus.PENDING,
            )
            .exclude(status=ProformaInvoice.Status.CANCELLED)
            .aggregate(total=Sum("grand_total"))["total"]
            or zero
        )

        total_outstanding = (
            outstanding_tax_invoices + outstanding_proforma_invoices
        )

        # =====================================================
        # 9. EXPENSE BREAKDOWN
        # =====================================================
        category_rows = (
            journal_qs
            .filter(type=JournalEntry.EntryType.EXPENSE)
            .values("category")
            .annotate(total=Sum("amount"))
            .order_by()
        )

        breakdown_map = {}
        for row in category_rows:
            name = row["category"] or "Other"
            breakdown_map[name] = (
                breakdown_map.get(name, 0.0) + float(row["total"] or zero)
            )

        outgoing_by_document = (
            payment_qs
            .filter(payment_direction=PaymentRecord.PaymentDirection.OUTGOING)
            .values("document_type")
            .annotate(total=Sum("paid_amount"))
            .order_by()
        )

        for row in outgoing_by_document:
            category = f"Payment - {row['document_type'] or 'Other'}"
            breakdown_map[category] = (
                breakdown_map.get(category, 0.0) + float(row["total"] or zero)
            )

        breakdown_map["Salary"] = (
            breakdown_map.get("Salary", 0.0)
            + float(salary_paid)
            + float(advances)
        )

        expense_breakdown = [
            {"category": name, "amount": amount}
            for name, amount in breakdown_map.items()
        ]
        expense_breakdown.sort(key=lambda item: item["amount"], reverse=True)

        # =====================================================
        # 10. PURCHASE ORDER STATUS
        # =====================================================
        real_items = list(
            PurchaseOrderItem.objects
            .select_related("purchase_order")
            .filter(
                purchase_order__status=PurchaseOrder.Status.CONFIRMED,
                purchase_order__created_at__date__gte=start_date,
                purchase_order__created_at__date__lte=end_date,
            )
        )
        item_ids = [item.id for item in real_items]

        material_map = {
            row["purchase_order_item_id"]: row["total"] or zero
            for row in (
                MaterialGRN.objects
                .filter(purchase_order_item_id__in=item_ids)
                .values("purchase_order_item_id")
                .annotate(total=Sum("received_qty"))
            )
        }

        consumable_map = {
            row["purchase_order_item_id"]: row["total"] or zero
            for row in (
                ConsumableGRN.objects
                .filter(purchase_order_item_id__in=item_ids)
                .values("purchase_order_item_id")
                .annotate(total=Sum("received_quantity"))
            )
        }

        counts = {
            "Pending": 0,
            "Partially Received": 0,
            "Outstanding": 0,
            "Fully Received": 0,
        }

        for item in real_items:
            ordered = item.quantity or zero
            received = (
                material_map.get(item.id, zero)
                + consumable_map.get(item.id, zero)
            )
            balance = ordered - received

            if balance <= 0:
                counts["Fully Received"] += 1
            elif received <= 0:
                counts["Pending"] += 1
            else:
                counts["Partially Received"] += 1

        po_status_array = [
            {"status": name, "count": count} for name, count in counts.items()
        ]

        # =====================================================
        # 11. PROJECT COUNT
        # =====================================================
        total_projects = (
            Project.objects.filter(
                Q(start_date__gte=start_date, start_date__lte=end_date)
                | Q(
                    start_date__isnull=True,
                    created_at__date__gte=start_date,
                    created_at__date__lte=end_date,
                )
            )
            .distinct()
            .count()
        )

        # =====================================================
        # 12. RESPONSE (structure unchanged)
        # =====================================================
        return Response(
            {
                "success": True,
                "period": period,
                "range": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                },
                "data": {
                    "kpis": {
                        "revenue": float(total_revenue),
                        "expenses": float(total_expenses),
                        "profit_loss": float(net_profit),
                        "net_profit": float(net_profit),
                        "outstanding": float(total_outstanding),
                        "outstanding_tax_invoices": float(outstanding_tax_invoices),
                        "outstanding_proforma_invoices": float(outstanding_proforma_invoices),
                        "projects": total_projects,
                        "journal_income": float(journal_income),
                        "journal_expenses": float(journal_expenses),
                        "incoming_payments": float(incoming_payments),
                        "outgoing_payments": float(outgoing_payments),
                        "salary_paid": float(salary_paid),
                        "advances": float(advances),
                    },
                    "chart_data": chart_data,
                    "expense_breakdown": expense_breakdown,
                    "po_status": po_status_array,
                },
            },
            status=status.HTTP_200_OK,
        )# =====================================================================
# ADMIN — STATISTICS DASHBOARD
# -----------------------------------------------------------------
# GET /erp/admin/statistics/
#
# Query params:
#   ?period=day|week|month|quarter|year|custom
#   ?from=YYYY-MM-DD  (only for period=custom)
#   ?to=YYYY-MM-DD    (only for period=custom)
#
# Month filter  -> last 12 calendar months (continuous, zero-filled)
# Other filters -> same ranges as before
# =====================================================================

from datetime import date, timedelta
from decimal import Decimal
import calendar

from django.db.models import Sum, Q, Case, When, Value, DecimalField
from django.db.models.functions import (
    Coalesce,
    TruncDay,
    TruncWeek,
    TruncMonth,
    TruncQuarter,
    TruncYear,
)

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import (
    JournalEntry,
    PaymentRecord,
    Project,
    PurchaseOrder,
    PurchaseOrderItem,
    TaxInvoice,
    ProformaInvoice,
    SalaryPayment,
    Advance,
    MaterialGRN,
    ConsumableGRN,
)

# NOTE: keep whatever import you already use for IsERPAdmin, e.g.
# from .permissions import IsERPAdmin


VALID_PERIODS = {"day", "week", "month", "quarter", "year", "custom"}

TRUNC_BY_GRANULARITY = {
    "day": TruncDay,
    "week": TruncWeek,
    "month": TruncMonth,
    "quarter": TruncQuarter,
    "year": TruncYear,
}

MAX_FILLED_BUCKETS = 36  # safety cap for zero-filling very long custom ranges


# ---------------------------------------------------------------------
# DATE HELPERS
# ---------------------------------------------------------------------
def _add_months(d, months):
    """Return the first day of the month `months` away from d's month."""
    total = d.year * 12 + (d.month - 1) + months
    year, month_index = divmod(total, 12)
    return date(year, month_index + 1, 1)


def _month_end(d):
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


def _get_statistics_date_range(period, from_date, to_date):
    """
    Resolves the requested period into a concrete (start_date, end_date).

    month   -> first day of the month 11 months ago  ..  last day of this month
               (12 calendar months including the current one)
    """
    today = date.today()

    if period == "day":
        return today, today

    if period == "week":
        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=6)

    if period == "month":
        start = _add_months(today.replace(day=1), -11)
        return start, _month_end(today)

    if period == "quarter":
        q_start_month = ((today.month - 1) // 3) * 3 + 1
        q_end_month = q_start_month + 2
        last_day = calendar.monthrange(today.year, q_end_month)[1]
        return date(today.year, q_start_month, 1), date(today.year, q_end_month, last_day)

    if period == "year":
        return date(today.year, 1, 1), date(today.year, 12, 31)

    if period == "custom":
        if from_date and to_date:
            try:
                start = date.fromisoformat(from_date)
                end = date.fromisoformat(to_date)
                if end < start:
                    start, end = end, start
                return start, end
            except ValueError:
                pass
        # Fallback if custom dates are missing / invalid: current month
        return today.replace(day=1), _month_end(today)

    # Unknown period -> same as month (12 months)
    start = _add_months(today.replace(day=1), -11)
    return start, _month_end(today)


def _bucket_start(granularity, d):
    """First day of the bucket that contains d."""
    if granularity == "day":
        return d
    if granularity == "week":
        return d - timedelta(days=d.weekday())
    if granularity == "month":
        return d.replace(day=1)
    if granularity == "quarter":
        return date(d.year, ((d.month - 1) // 3) * 3 + 1, 1)
    if granularity == "year":
        return date(d.year, 1, 1)
    return d.replace(day=1)


def _next_bucket(granularity, d):
    if granularity == "day":
        return d + timedelta(days=1)
    if granularity == "week":
        return d + timedelta(days=7)
    if granularity == "month":
        return _add_months(d, 1)
    if granularity == "quarter":
        return _add_months(d, 3)
    if granularity == "year":
        return date(d.year + 1, 1, 1)
    return _add_months(d, 1)


def _iter_buckets(granularity, start_date, end_date):
    current = _bucket_start(granularity, start_date)
    while current <= end_date:
        yield current
        current = _next_bucket(granularity, current)


def _normalize_date(value):
    """Trunc* on DateTimeField returns datetime; on DateField returns date."""
    if value is None:
        return None
    if hasattr(value, "date"):
        return value.date()
    return value


def _get_label(granularity, dt):
    if granularity == "day":
        return dt.strftime("%d %b")
    if granularity == "week":
        return f"Wk {dt.strftime('%d %b')}"
    if granularity == "quarter":
        return f"{dt.year}-Q{((dt.month - 1) // 3) + 1}"
    if granularity == "year":
        return str(dt.year)
    return dt.strftime("%b %y")  # month / custom -> "Nov 25"


class AdminStatisticsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):
        period = request.query_params.get("period", "month")

        if period not in VALID_PERIODS:
            period = "month"

        from_date = request.query_params.get("from")
        to_date = request.query_params.get("to")

        start_date, end_date = _get_statistics_date_range(
            period, from_date, to_date
        )

        # Custom ranges are grouped month-wise
        granularity = "month" if period == "custom" else period
        trunc = TRUNC_BY_GRANULARITY[granularity]

        zero = Decimal("0.00")
        money_field = DecimalField(
            max_digits=24,
            decimal_places=2,
        )

        def sum_if(value_field, **condition):
            """SUM(value_field) WHERE condition, 0 when nothing matches."""
            return Coalesce(
                Sum(
                    Case(
                        When(
                            then=value_field,
                            **condition,
                        ),
                        default=Value(zero),
                        output_field=money_field,
                    )
                ),
                Value(zero),
                output_field=money_field,
            )

        # =====================================================
        # 1. TIMELINE BUCKETS
        # =====================================================
        timeline_map = {}

        def ensure_bucket(value):
            value = _normalize_date(value)

            if value is None:
                return None

            key = value.isoformat()

            if key not in timeline_map:
                timeline_map[key] = {
                    "key": key,
                    "label": _get_label(granularity, value),
                    "revenue": zero,
                    "expenses": zero,
                }

            return key

        bucket_starts = list(
            _iter_buckets(
                granularity,
                start_date,
                end_date,
            )
        )

        if len(bucket_starts) <= MAX_FILLED_BUCKETS:
            for bucket_start in bucket_starts:
                ensure_bucket(bucket_start)

        # =====================================================
        # 2. JOURNAL ENTRIES
        # =====================================================
        journal_qs = JournalEntry.objects.filter(
            date__gte=start_date,
            date__lte=end_date,
        )

        journal_rows = (
            journal_qs
            .annotate(bucket=trunc("date"))
            .values("bucket")
            .annotate(
                income=sum_if(
                    "amount",
                    type=JournalEntry.EntryType.INCOME,
                ),
                expenses=sum_if(
                    "amount",
                    type=JournalEntry.EntryType.EXPENSE,
                ),
            )
            .order_by("bucket")
        )

        journal_income = zero
        journal_expenses = zero

        for row in journal_rows:
            key = ensure_bucket(row["bucket"])

            if key is None:
                continue

            timeline_map[key]["revenue"] += row["income"]
            timeline_map[key]["expenses"] += row["expenses"]

            journal_income += row["income"]
            journal_expenses += row["expenses"]

        # =====================================================
        # 3. PAYMENT RECORDS
        # =====================================================
        payment_qs = PaymentRecord.objects.filter(
            paid_date__gte=start_date,
            paid_date__lte=end_date,
        )

        payment_rows = (
            payment_qs
            .annotate(bucket=trunc("paid_date"))
            .values("bucket")
            .annotate(
                incoming=sum_if(
                    "paid_amount",
                    payment_direction=(
                        PaymentRecord.PaymentDirection.INCOMING
                    ),
                ),
                outgoing=sum_if(
                    "paid_amount",
                    payment_direction=(
                        PaymentRecord.PaymentDirection.OUTGOING
                    ),
                ),
            )
            .order_by("bucket")
        )

        incoming_payments = zero
        outgoing_payments = zero

        for row in payment_rows:
            key = ensure_bucket(row["bucket"])

            if key is None:
                continue

            timeline_map[key]["revenue"] += row["incoming"]
            timeline_map[key]["expenses"] += row["outgoing"]

            incoming_payments += row["incoming"]
            outgoing_payments += row["outgoing"]

        # =====================================================
        # 4. SALARY PAYMENTS
        # =====================================================
        salary_rows = (
            SalaryPayment.objects.filter(
                payment_status="PAID",
                paid_date__gte=start_date,
                paid_date__lte=end_date,
            )
            .annotate(bucket=trunc("paid_date"))
            .values("bucket")
            .annotate(total=Sum("net_salary"))
            .order_by("bucket")
        )

        salary_paid = zero

        for row in salary_rows:
            key = ensure_bucket(row["bucket"])

            if key is None:
                continue

            amount = row["total"] or zero

            timeline_map[key]["expenses"] += amount

            salary_paid += amount

        # =====================================================
        # 5. ADVANCES — GROUPED BY DATE
        # =====================================================
        advance_rows = (
            Advance.objects.filter(
                advance_date__gte=start_date,
                advance_date__lte=end_date,
            )
            .annotate(bucket=trunc("advance_date"))
            .values("bucket")
            .annotate(total=Sum("amount"))
            .order_by("bucket")
        )

        advances = zero

        for row in advance_rows:
            key = ensure_bucket(row["bucket"])

            if key is None:
                continue

            amount = row["total"] or zero

            # Advance contributes to expenses on its date.
            timeline_map[key]["expenses"] += amount

            advances += amount

        # =====================================================
        # 6. TOTAL REVENUE, EXPENSES AND PROFIT/LOSS
        # =====================================================
        total_revenue = (
            journal_income
            + incoming_payments
        )

        total_expenses = (
            journal_expenses
            + outgoing_payments
            + salary_paid
            + advances
        )

        net_profit = (
            total_revenue
            - total_expenses
        )

        # =====================================================
        # 7. CHART DATA
        # =====================================================
        chart_data = [
            {
                "key": item["key"],
                "label": item["label"],
                "revenue": float(item["revenue"]),
                "expenses": float(item["expenses"]),
                "profit_loss": float(
                    item["revenue"] - item["expenses"]
                ),
            }
            for item in sorted(
                timeline_map.values(),
                key=lambda item: item["key"],
            )
        ]

        # =====================================================
        # 8. OUTSTANDING INVOICES
        # =====================================================
        outstanding_tax_invoices = (
            TaxInvoice.objects.filter(
                payment_status=(
                    TaxInvoice.PaymentStatus.PENDING
                ),
            )
            .exclude(
                status=TaxInvoice.Status.CANCELLED
            )
            .aggregate(
                total=Sum("grand_total")
            )["total"]
            or zero
        )

        outstanding_proforma_invoices = (
            ProformaInvoice.objects.filter(
                payment_status=(
                    ProformaInvoice.PaymentStatus.PENDING
                ),
            )
            .exclude(
                status=ProformaInvoice.Status.CANCELLED
            )
            .aggregate(
                total=Sum("grand_total")
            )["total"]
            or zero
        )

        total_outstanding = (
            outstanding_tax_invoices
            + outstanding_proforma_invoices
        )

        # =====================================================
        # 9. EXPENSE BREAKDOWN
        # =====================================================
        category_rows = (
            journal_qs
            .filter(
                type=JournalEntry.EntryType.EXPENSE
            )
            .values("category")
            .annotate(
                total=Sum("amount")
            )
            .order_by()
        )

        breakdown_map = {}

        for row in category_rows:
            name = row["category"] or "Other"

            breakdown_map[name] = (
                breakdown_map.get(name, 0.0)
                + float(row["total"] or zero)
            )

        # Outgoing payment breakdown
        outgoing_by_document = (
            payment_qs
            .filter(
                payment_direction=(
                    PaymentRecord.PaymentDirection.OUTGOING
                )
            )
            .values("document_type")
            .annotate(
                total=Sum("paid_amount")
            )
            .order_by()
        )

        for row in outgoing_by_document:
            category = (
                f"Payment - {row['document_type'] or 'Other'}"
            )

            breakdown_map[category] = (
                breakdown_map.get(category, 0.0)
                + float(row["total"] or zero)
            )

        # -----------------------------------------------------
        # SALARY — SEPARATE CATEGORY
        # -----------------------------------------------------
        breakdown_map["Salary"] = (
            breakdown_map.get("Salary", 0.0)
            + float(salary_paid)
        )

        # -----------------------------------------------------
        # ADVANCE — SEPARATE CATEGORY
        # -----------------------------------------------------
        breakdown_map["Advance"] = (
            breakdown_map.get("Advance", 0.0)
            + float(advances)
        )

        expense_breakdown = [
            {
                "category": name,
                "amount": amount,
            }
            for name, amount in breakdown_map.items()
        ]

        expense_breakdown.sort(
            key=lambda item: item["amount"],
            reverse=True,
        )

        # =====================================================
        # 10. PURCHASE ORDER STATUS
        # =====================================================
        real_items = list(
            PurchaseOrderItem.objects
            .select_related("purchase_order")
            .filter(
                purchase_order__status=(
                    PurchaseOrder.Status.CONFIRMED
                ),
                purchase_order__created_at__date__gte=start_date,
                purchase_order__created_at__date__lte=end_date,
            )
        )

        item_ids = [
            item.id for item in real_items
        ]

        material_map = {
            row["purchase_order_item_id"]: (
                row["total"] or zero
            )
            for row in (
                MaterialGRN.objects
                .filter(
                    purchase_order_item_id__in=item_ids
                )
                .values("purchase_order_item_id")
                .annotate(
                    total=Sum("received_qty")
                )
            )
        }

        consumable_map = {
            row["purchase_order_item_id"]: (
                row["total"] or zero
            )
            for row in (
                ConsumableGRN.objects
                .filter(
                    purchase_order_item_id__in=item_ids
                )
                .values("purchase_order_item_id")
                .annotate(
                    total=Sum("received_quantity")
                )
            )
        }

        counts = {
            "Pending": 0,
            "Partially Received": 0,
            "Outstanding": 0,
            "Fully Received": 0,
        }

        for item in real_items:
            ordered = item.quantity or zero

            received = (
                material_map.get(item.id, zero)
                + consumable_map.get(item.id, zero)
            )

            balance = ordered - received

            if balance <= 0:
                counts["Fully Received"] += 1

            elif received <= 0:
                counts["Pending"] += 1

            else:
                counts["Partially Received"] += 1

        po_status_array = [
            {
                "status": name,
                "count": count,
            }
            for name, count in counts.items()
        ]

        # =====================================================
        # 11. PROJECT COUNT
        # =====================================================
        total_projects = (
            Project.objects.filter(
                Q(
                    start_date__gte=start_date,
                    start_date__lte=end_date,
                )
                |
                Q(
                    start_date__isnull=True,
                    created_at__date__gte=start_date,
                    created_at__date__lte=end_date,
                )
            )
            .distinct()
            .count()
        )

        # =====================================================
        # 12. RESPONSE
        # =====================================================
        return Response(
            {
                "success": True,

                "period": period,

                "range": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                },

                "data": {
                    "kpis": {
                        "revenue": float(total_revenue),
                        "expenses": float(total_expenses),

                        "profit_loss": float(net_profit),
                        "net_profit": float(net_profit),

                        "outstanding": float(total_outstanding),

                        "outstanding_tax_invoices": float(
                            outstanding_tax_invoices
                        ),

                        "outstanding_proforma_invoices": float(
                            outstanding_proforma_invoices
                        ),

                        "projects": total_projects,

                        "journal_income": float(journal_income),
                        "journal_expenses": float(journal_expenses),

                        "incoming_payments": float(
                            incoming_payments
                        ),

                        "outgoing_payments": float(
                            outgoing_payments
                        ),

                        "salary_paid": float(salary_paid),

                        # Advances included in overall expenses
                        "advances": float(advances),
                    },

                    "chart_data": chart_data,

                    "expense_breakdown": expense_breakdown,

                    "po_status": po_status_array,
                },
            },
            status=status.HTTP_200_OK,
        )


# views.py
from collections import defaultdict
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .models import (
    ConsumableGRN,
    ConsumableIssue,
    ConsumableReturn,
)


ZERO = Decimal("0")


class AdminBufferStockAPIView(APIView):

    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):

        grns = (
            ConsumableGRN.objects
            .select_related("consumable_variety")
            .order_by("created_at", "id")
        )

        grouped = {}

        for grn in grns:

            variety = grn.consumable_variety

            # Keep different varieties and warehouses separate.
            key = (
                variety.id if variety else f"legacy-{grn.id}",
                grn.warehouse,
            )

            issued = (
                ConsumableIssue.objects
                .filter(grn=grn)
                .aggregate(total=Sum("quantity_issued"))["total"]
                or ZERO
            )

            returned = (
                ConsumableReturn.objects
                .filter(issue__grn=grn)
                .aggregate(total=Sum("quantity_returned"))["total"]
                or ZERO
            )

            received = grn.received_quantity or ZERO

            available = received - issued + returned

            if key not in grouped:

                grouped[key] = {
                    "id": grn.id,
                    "varietyId": variety.id if variety else None,
                    "materialCode": grn.grn_number,
                    "category": grn.category or "",
                    "consumableName": grn.consumable_name or "",
                    "varietyName": (
                        getattr(variety, "name", "")
                        if variety else ""
                    ),
                    "description": grn.consumable_name or "",
                    "warehouse": grn.warehouse,
                    "unit": grn.unit or "Nos",
                    "receivedQty": ZERO,
                    "issuedQty": ZERO,
                    "returnedQty": ZERO,
                    "availableQty": ZERO,
                    "bufferQty": ZERO,
                    "grnIds": [],
                }

            row = grouped[key]

            row["receivedQty"] += received
            row["issuedQty"] += issued
            row["returnedQty"] += returned
            row["availableQty"] += available

            row["grnIds"].append(grn.id)

            # Existing buffer limit is stored on GRN.
            # Use the highest configured limit in this group.
            try:
                limit = Decimal(str(grn.buffer_stock_limit or 0))
                row["bufferQty"] = max(
                    row["bufferQty"],
                    limit,
                )
            except (InvalidOperation, ValueError, TypeError):
                pass

        rows = []
        alerts_triggered = 0

        for row in grouped.values():

            available = row["availableQty"]
            buffer_limit = row["bufferQty"]

            # Show zero-stock items too, so admins can
            # identify completely depleted consumables.
            is_low = (
                buffer_limit > ZERO
                and available <= buffer_limit
            )

            if is_low:
                alerts_triggered += 1

            rows.append({
                **row,
                "receivedQty": float(row["receivedQty"]),
                "issuedQty": float(row["issuedQty"]),
                "returnedQty": float(row["returnedQty"]),
                "availableQty": float(available),
                "bufferQty": float(buffer_limit),
                "isLow": is_low,
                "status": (
                    "Low Stock"
                    if is_low
                    else "Sufficient"
                ),
            })

        rows.sort(
            key=lambda item: (
                item["category"].lower(),
                item["consumableName"].lower(),
                item["varietyName"].lower(),
                item["warehouse"].lower(),
            )
        )

        return Response({
            "success": True,
            "alerts_triggered": alerts_triggered,
            "data": rows,
        })

    @transaction.atomic
    def patch(self, request, pk):

        try:
            anchor = ConsumableGRN.objects.get(pk=pk)

        except ConsumableGRN.DoesNotExist:
            return Response({
                "success": False,
                "message": "GRN record not found.",
            }, status=404)

        raw_limit = request.data.get("buffer_stock_limit")

        if raw_limit is None:
            return Response({
                "success": False,
                "message": "Buffer limit is required.",
            }, status=400)

        try:
            limit = Decimal(str(raw_limit))

            if not limit.is_finite() or limit < ZERO:
                raise ValueError

        except (ValueError, TypeError, InvalidOperation):
            return Response({
                "success": False,
                "message": "Enter a valid non-negative buffer limit.",
            }, status=400)

        # Update all GRNs belonging to the same variety
        # and warehouse, keeping their buffer limit consistent.
        if anchor.consumable_variety_id:

            matching_grns = (
                ConsumableGRN.objects
                .select_for_update()
                .filter(
                    consumable_variety_id=anchor.consumable_variety_id,
                    warehouse=anchor.warehouse,
                )
            )

        else:
            matching_grns = (
                ConsumableGRN.objects
                .select_for_update()
                .filter(pk=anchor.pk)
            )

        matching_grns.update(
            buffer_stock_limit=limit,
        )

        return Response({
            "success": True,
            "message": "Buffer limit updated successfully.",
            "buffer_stock_limit": float(limit),
        })

# =====================================================================
# ADMIN — PENDING PAYMENTS
# -----------------------------------------------------------------
# GET /erp/admin/pending-payments/
#
# Returns a unified list of all documents where payment is still
# pending.
#
# Logic:
#   - TI (Tax Invoice)      → Customer owes us money
#   - PI (Proforma Invoice) → Customer owes us money
#   - PO / QO               → Ignored (Not invoices, just orders)
# =====================================================================
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

# Adjust these imports to your project layout
# from .models import TaxInvoice, ProformaInvoice
# from .permissions import IsERPAdmin


# =========================================================
# HELPERS
# =========================================================

# Document prefix -> (model, field holding the visible document number)
DOC_TYPES = {
    "TI": (TaxInvoice, "invoice_number"),
    "PI": (ProformaInvoice, "proforma_no"),
}


def _is_paid(doc):
    return doc.payment_status == type(doc).PaymentStatus.PAID


def _build_row(short, doc, number_field):
    """Single place that shapes an invoice into an API row."""
    receiver = doc.receiver_details or {}
    amount = float(doc.grand_total or 0)
    paid = _is_paid(doc)

    return {
        "id": f"{short}-{doc.id}",
        "document_number": getattr(doc, number_field),
        "short": short,
        "customer_name": receiver.get("companyName") or "Unknown Customer",
        "amount": amount,                                   # invoice total
        "outstanding_amount": 0 if paid else amount,        # what is still owed
        "payment_status": doc.payment_status,
        "is_paid": paid,
        "type": "Customer Pays Us",
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
    }


# =========================================================
# 1. LIST: all confirmed TI + PI (paid and unpaid)
#    GET /erp/admin/pending-payments/?status=all|paid|pending
# =========================================================

class AdminPendingPaymentsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):
        status_filter = (request.query_params.get("status") or "all").lower()
        if status_filter not in ("all", "paid", "pending"):
            return Response(
                {"success": False, "message": "status must be all, paid or pending."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        items = []  # (created_at, row)

        for short, (model, number_field) in DOC_TYPES.items():
            qs = model.objects.filter(status=model.Status.CONFIRMED)

            if status_filter == "paid":
                qs = qs.filter(payment_status=model.PaymentStatus.PAID)
            elif status_filter == "pending":
                qs = qs.filter(payment_status=model.PaymentStatus.PENDING)

            for doc in qs:
                row = _build_row(short, doc, number_field)
                items.append((doc.created_at, row))

        # Newest first, across both tables
        items.sort(key=lambda pair: pair[0], reverse=True)
        rows = [row for _, row in items]

        total_outstanding = sum(r["outstanding_amount"] for r in rows)
        total_paid = sum(r["amount"] for r in rows if r["is_paid"])
        paid_count = sum(1 for r in rows if r["is_paid"])

        return Response(
            {
                "success": True,
                "count": len(rows),
                "paid_count": paid_count,
                "pending_count": len(rows) - paid_count,
                "total_outstanding": total_outstanding,
                "total_paid": total_paid,
                "data": rows,
            },
            status=status.HTTP_200_OK,
        )


# =========================================================
# 2. UPDATE: admin marks an invoice paid / pending
#    PATCH /erp/admin/pending-payments/<doc_id>/payment-status/
#    body: { "payment_status": "paid" | "pending" }
#    doc_id looks like "TI-12" or "PI-7" (same as the list `id`)
# =========================================================

from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated


class AdminPaymentStatusUpdateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def patch(self, request, doc_id):
        # --------------------------------------------------
        # 1. PARSE DOCUMENT ID
        # Example: TI-12, PI-7
        # --------------------------------------------------
        prefix, _, raw_pk = str(doc_id).partition("-")
        prefix = prefix.upper()

        if prefix not in DOC_TYPES or not raw_pk.isdigit():
            return Response(
                {
                    "success": False,
                    "message": "Invalid invoice id.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        Model, number_field = DOC_TYPES[prefix]

        # --------------------------------------------------
        # 2. VALIDATE PAYMENT STATUS
        # --------------------------------------------------
        requested = str(
            request.data.get("payment_status", "")
        ).strip().upper()

        status_map = {
            "PAID": Model.PaymentStatus.PAID,
            "PENDING": Model.PaymentStatus.PENDING,
        }

        if requested not in status_map:
            return Response(
                {
                    "success": False,
                    "message": (
                        "payment_status must be 'paid' or 'pending'."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------------------------------
        # 3. UPDATE STATUS AND CREATE PAYMENT RECORD
        # --------------------------------------------------
        with transaction.atomic():
            try:
                doc = Model.objects.select_for_update().get(
                    pk=int(raw_pk),
                    status=Model.Status.CONFIRMED,
                )

            except Model.DoesNotExist:
                return Response(
                    {
                        "success": False,
                        "message": (
                            "Invoice not found or not confirmed."
                        ),
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            old_payment_status = str(
                doc.payment_status or ""
            ).strip().upper()

            new_payment_status = status_map[requested]

            payment_record_data = None

            # ----------------------------------------------
            # 4. CREATE PAYMENT RECORD WHEN FIRST MARKED PAID
            # ----------------------------------------------
            if (
                old_payment_status != "PAID"
                and requested == "PAID"
            ):
                document_number = getattr(
                    doc,
                    number_field,
                    None,
                )

                if not document_number:
                    return Response(
                        {
                            "success": False,
                            "message": "Document number is missing.",
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                raw_amount = getattr(
                    doc,
                    "grand_total",
                    None,
                )

                try:
                    paid_amount = Decimal(str(raw_amount))

                except (InvalidOperation, TypeError, ValueError):
                    return Response(
                        {
                            "success": False,
                            "message": "Invalid invoice grand total.",
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if (
                    not paid_amount.is_finite()
                    or paid_amount <= 0
                ):
                    return Response(
                        {
                            "success": False,
                            "message": (
                                "Payment amount must be greater than zero."
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Choose direction based on document type.
                if prefix == "PO":
                    payment_direction = (
                        PaymentRecord.PaymentDirection.OUTGOING
                    )
                else:
                    payment_direction = (
                        PaymentRecord.PaymentDirection.INCOMING
                    )

                # Create the payment transaction record.
                payment_record = PaymentRecord.objects.create(
                    document_type=prefix,
                    document_number=str(document_number),
                    payment_direction=payment_direction,
                    paid_amount=paid_amount,
                    paid_date=timezone.localdate(),
                )

                payment_record_data = {
                    "id": payment_record.pk,
                    "document_type": payment_record.document_type,
                    "document_number": payment_record.document_number,
                    "payment_direction": payment_record.payment_direction,
                    "paid_amount": str(payment_record.paid_amount),
                    "paid_date": str(payment_record.paid_date),
                }

            # ----------------------------------------------
            # 5. UPDATE THE ORIGINAL DOCUMENT MODEL
            # ----------------------------------------------
            doc.payment_status = new_payment_status
            doc.save(update_fields=["payment_status"])

        # --------------------------------------------------
        # 6. SUCCESS RESPONSE
        # --------------------------------------------------
        return Response(
            {
                "success": True,
                "message": f"Marked as {requested.lower()}.",
                "data": {
                    **_build_row(prefix, doc, number_field),
                    "payment_record": payment_record_data,
                },
            },
            status=status.HTTP_200_OK,
        )
# accounts/views.py  (or hr/views.py — wherever the admin views live)
from datetime import date, timedelta
import calendar as _cal
from django.db.models import Count
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import Attendance, Employee


class AdminAttendanceDailyCountsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsERPAdmin]

    def get(self, request):
        today = timezone.localdate()

        try:
            year = int(request.query_params.get("year") or today.year)
            month = int(request.query_params.get("month") or today.month)
            if not (1900 <= year <= 2200 and 1 <= month <= 12):
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {"success": False, "message": "Invalid year or month."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        first = date(year, month, 1)
        last = date(year, month, _cal.monthrange(year, month)[1])

        active_qs = Employee.objects.filter(
            archived=False,
            employment_status="Active",
        )
        total_active = active_qs.count()

        rows = (
            Attendance.objects
            .filter(
                employee__in=active_qs,
                date__gte=first,
                date__lte=last,
            )
            .values("date", "status")
            .annotate(count=Count("id"))
        )

        by_day = {}
        for row in rows:
            by_day.setdefault(row["date"], {})[row["status"]] = row["count"]

        days = {}
        current = first
        
        # FIX: Use timedelta to safely roll over into the next day
        while current <= last:
            counts = by_day.get(current, {})
            present = (
                counts.get("PRESENT", 0)
                + counts.get("HALF_DAY", 0)
                + counts.get("WFH", 0)
            )
            absent = counts.get("ABSENT", 0)
            leave = (
                counts.get("PAID_LEAVE", 0)
                + counts.get("UNPAID_LEAVE", 0)
            )
            holiday = counts.get("HOLIDAY", 0)
            weekly_off = counts.get("WEEKLY_OFF", 0)

            marked = present + absent + leave + holiday + weekly_off
            not_marked = max(total_active - marked, 0)

            days[current.isoformat()] = {
                "present": present,
                "absent": absent,
                "leave": leave,
                "holiday": holiday,
                "weekly_off": weekly_off,
                "not_marked": not_marked,
                "total": total_active,
            }

            current += timedelta(days=1)

        return Response(
            {
                "success": True,
                "year": year,
                "month": month,
                "total_active": total_active,
                "days": days,
            },
            status=status.HTTP_200_OK,
        )


from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Project, ProjectStatus


class AdminProjectStatusDetailAPIView(APIView):

    permission_classes = [IsAuthenticated]

    STATUS_CHOICES = ["Active", "On Hold", "Completed"]

    def patch(self, request, project_id):

        # ==================================================
        # 1. Validate project
        # ==================================================
        project = get_object_or_404(
            Project,
            id=project_id
        )

        # ==================================================
        # 2. Validate status
        # ==================================================
        new_status = request.data.get("status")

        if new_status not in self.STATUS_CHOICES:
            return Response(
                {
                    "success": False,
                    "message": "Invalid project status.",
                    "allowed_statuses": self.STATUS_CHOICES,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ==================================================
        # 3. Create or update project status
        # ==================================================
        with transaction.atomic():

            project_status, created = (
                ProjectStatus.objects.update_or_create(
                    project=project,
                    defaults={
                        "status": new_status
                    }
                )
            )

        # ==================================================
        # 4. Return response
        # ==================================================
        return Response(
            {
                "success": True,
                "message": (
                    "Project status created successfully."
                    if created
                    else "Project status updated successfully."
                ),
                "data": {
                    "project_id": project.id,
                    "project_name": str(project),
                    "status": project_status.status,
                    "updated_at": project_status.updated_at,
                }
            },
            status=status.HTTP_200_OK
        )