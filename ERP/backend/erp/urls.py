from django.urls import path

from .views import AccountsModulesAPIView, ChangePasswordAPIView, CustomerAPIView, LoginAPIView ,InventoryAPIView, LogoutAPIView, MaterialMenuAPIView, NextPurchaseOrderNumberAPIView, ProfileAPIView, PurchaseOrderConfirmAPIView, PurchaseOrderListCreateAPIView, RefreshTokenAPIView, UserProfileDetailAPIView, UserProfileListCreateAPIView


urlpatterns = [


    # FOR LOGIN, LOGOUT, REFRESH TOKEN
    path("login/", LoginAPIView.as_view(), name="erp-login"),
     
    path("refresh/",RefreshTokenAPIView.as_view(),name="erp-refresh", ),
    path("logout/", LogoutAPIView.as_view(), name="erp-logout",),
    # FOR PROFILE CREATE ONLY BUT DEV
     path("profiles/",UserProfileListCreateAPIView.as_view(),name="user-profile-list-create",),
     path(
        "user-profiles/<int:id>/",
        UserProfileDetailAPIView.as_view(),
        name="user-profile-detail",
    ),
     # TO GET PROFILE AND CHANGE PASSWORD
    path("profile/", ProfileAPIView.as_view(),name="profile",),
     path("profile/change-password/",ChangePasswordAPIView.as_view(),name="change-password",),

     # FOR acoounts
       path("accounts/modules/",AccountsModulesAPIView.as_view(), name="accounts-modules", ),
     path("purchase-orders/",PurchaseOrderListCreateAPIView.as_view(),name="purchase-order-list-create",),
     path("customers/",CustomerAPIView.as_view(), name="customers", ),
    path("customers/<int:pk>/",CustomerAPIView.as_view(), name="customer-detail",),
    path(
    "purchase-orders/next-number/",
    NextPurchaseOrderNumberAPIView.as_view(),
    name="purchase-order-next-number",
),
    path(
        "purchase-orders/<str:po_number>/confirm/",
        PurchaseOrderConfirmAPIView.as_view(),
        name="purchase-order-confirm",
    ),






       path("inventory/",InventoryAPIView.as_view(),name="inventory",),  
       path("inventory/material/menu/",MaterialMenuAPIView.as_view(),name="material-menu",),
]