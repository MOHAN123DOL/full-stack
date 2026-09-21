from django.shortcuts import render

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
from .permissions import IsMaterialPlanning

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
    