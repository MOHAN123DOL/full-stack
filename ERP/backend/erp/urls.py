from django.urls import path

from .views import ( AccountsModulesAPIView, ChangePasswordAPIView, CustomerAPIView, DeliveryChallanConfirmAPIView, DeliveryChallanCreateAPIView, DeliveryChallanCustomerAPIView, DeliveryChallanNextNumberAPIView, 
                    LoginAPIView ,InventoryAPIView, LogoutAPIView, MaterialMenuAPIView,
                      NextPurchaseOrderNumberAPIView, ProfileAPIView, PurchaseOrderConfirmAPIView,
                        PurchaseOrderListCreateAPIView, QuotationConfirmAPIView, QuotationCreateAPIView, QuotationCustomerAPIView,
                          QuotationNextNumberAPIView, RefreshTokenAPIView, UserProfileDetailAPIView, 
                          UserProfileListCreateAPIView)


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

       #po
     path("purchase-orders/",PurchaseOrderListCreateAPIView.as_view(),name="purchase-order-list-create",),
     path("customers/",CustomerAPIView.as_view(), name="customers", ),
    path("customers/<int:pk>/",CustomerAPIView.as_view(), name="customer-detail",),
    path("purchase-orders/next-number/",NextPurchaseOrderNumberAPIView.as_view(),name="purchase-order-next-number",),
    path("purchase-orders/<str:po_number>/confirm/",PurchaseOrderConfirmAPIView.as_view(),name="purchase-order-confirm",),
    path("quotations/next-number/",QuotationNextNumberAPIView.as_view(),name="quotation-next-number",),

    # Quotation customers
    path(
        "quotation-customers/",
        QuotationCustomerAPIView.as_view(),
        name="quotation-customers",
    ),
    path(
            "quotation-customers/<int:pk>/",
            QuotationCustomerAPIView.as_view(),
            name="quotation-customer-detail",
        ),

    # Quotation create / update
    path(
        "quotations/",
        QuotationCreateAPIView.as_view(),
        name="quotation-create",
    ),
    path(
    "quotations/<str:quotation_number>/confirm/",
    QuotationConfirmAPIView.as_view(),
    name="quotation-confirm",
),
    # for dc 

    path(
        "delivery-challans/next-number/",
        DeliveryChallanNextNumberAPIView.as_view(),
    ),
    path(
        "delivery-challan-customers/",
        DeliveryChallanCustomerAPIView.as_view(),
    ),
    path(
        "delivery-challan-customers/<int:pk>/",
        DeliveryChallanCustomerAPIView.as_view(),
    ),
    path(
        "delivery-challans/",
        DeliveryChallanCreateAPIView.as_view(),
    ),
    path(
    "delivery-challans/<str:dc_number>/confirm/",
    DeliveryChallanConfirmAPIView.as_view(),
    name="delivery-challan-confirm",
),






       path("inventory/",InventoryAPIView.as_view(),name="inventory",),  
       path("inventory/material/menu/",MaterialMenuAPIView.as_view(),name="material-menu",),
]