from django.urls import path

from .views import ( AccountsModulesAPIView, AccountsReportAPIView, AccountsReportStatusAPIView, AdvanceDetailAPIView, AdvanceListCreateAPIView, ChangePasswordAPIView, ConsumableDashboardView, ConsumableGRNDirectCreateAPIView, ConsumableGRNPOItemListAPIView, ConsumableGRNReceiveAPIView, CustomerAPIView, DeliveryChallanConfirmAPIView, DeliveryChallanCreateAPIView, DeliveryChallanCustomerAPIView, DeliveryChallanNextNumberAPIView, EmployeeArchiveAPIView, EmployeeDetailAPIView, EmployeeListCreateAPIView, EmployeePhotoAPIView, JournalAPIView, JournalDetailAPIView, 
                    LoginAPIView ,InventoryAPIView, LogoutAPIView, MaterialMenuAPIView, MyAttendanceAPIView,
                      NextPurchaseOrderNumberAPIView, ProfileAPIView, ProfilePhotoDeleteAPIView, ProformaInvoiceConfirmAPIView, ProformaInvoiceCreateAPIView, ProformaInvoiceCustomerAPIView, ProformaInvoiceNextNumberAPIView, PurchaseOrderConfirmAPIView,
                        PurchaseOrderListCreateAPIView, QuotationConfirmAPIView, QuotationCreateAPIView, QuotationCustomerAPIView,
                          QuotationNextNumberAPIView, RefreshTokenAPIView,  SalaryEmployeeListAPIView, SalaryPaymentDetailAPIView, SalaryPaymentListCreateAPIView,  TaxInvoiceConfirmAPIView, TaxInvoiceCreateAPIView, TaxInvoiceCustomerAPIView, TaxInvoiceNextNumberAPIView, UserProfileDetailAPIView, 
                          UserProfileListCreateAPIView, AttendanceEmployeeView,
    AttendanceViewSet,
    WageConfigViewSet,
    ConsumableStockAPIView,
    ConsumableIssueStockAPIView,
    ConsumableIssueCreateAPIView
    )


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
    path(
        "attendance/my/",
        MyAttendanceAPIView.as_view(),
        name="my-attendance",
    ),
     path("profile/change-password/",ChangePasswordAPIView.as_view(),name="change-password",),
     path(
        "profile/photo/",
        ProfilePhotoDeleteAPIView.as_view(),
        name="profile-photo-delete",
    ),

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
#for tax invoice

        path(
            "tax-invoices/next-number/",
            TaxInvoiceNextNumberAPIView.as_view(),
            name="tax-invoice-next-number",
        ),
        path(
            "tax-invoice-customers/",
            TaxInvoiceCustomerAPIView.as_view(),
            name="tax-invoice-customers",
        ),
        path(
            "tax-invoice-customers/<int:pk>/",
            TaxInvoiceCustomerAPIView.as_view(),
            name="tax-invoice-customer-detail",
        ),
        path(
            "tax-invoices/",
            TaxInvoiceCreateAPIView.as_view(),
            name="tax-invoice-create",
        ),
        path(
            "tax-invoices/<str:invoice_number>/confirm/",
            TaxInvoiceConfirmAPIView.as_view(),
            name="tax-invoice-confirm",
        ),
        path(
            "proforma-invoices/next-number/",
            ProformaInvoiceNextNumberAPIView.as_view(),
            name="proforma-invoice-next-number",
        ),
        path(
            "proforma-invoice-customers/",
            ProformaInvoiceCustomerAPIView.as_view(),
            name="proforma-invoice-customers",
        ),
        path(
            "proforma-invoice-customers/<int:pk>/",
            ProformaInvoiceCustomerAPIView.as_view(),
            name="proforma-invoice-customer-detail",
        ),
        path(
            "proforma-invoices/",
            ProformaInvoiceCreateAPIView.as_view(),
            name="proforma-invoice-create",
        ),
        path(
            "proforma-invoices/<str:proforma_no>/confirm/",
            ProformaInvoiceConfirmAPIView.as_view(),
            name="proforma-invoice-confirm",
        ),

        #for report 
        path(
        "accounts-report/",
        AccountsReportAPIView.as_view(),
        name="accounts-report",
    ),

    # Filtered by type
    path(
        "accounts-report/<str:document_type>/",
        AccountsReportAPIView.as_view(),
        name="accounts-report-by-type",
    ),

    path(
        "accounts-report/<str:short>/<int:pk>/status/",
        AccountsReportStatusAPIView.as_view(),
        name="accounts-report-status",
    ),
     path("journal/", JournalAPIView.as_view(), name="journal"),
    path("journal/<int:pk>/", JournalDetailAPIView.as_view(), name="journal-detail"),


    #hr module
    path("employees/",EmployeeListCreateAPIView.as_view(),name="employee-list-create", ),
    path( "employees/<int:pk>/", EmployeeDetailAPIView.as_view(), name="employee-detail", ),
    path( "employees/<int:pk>/archive/", EmployeeArchiveAPIView.as_view(), name="employee-archive", ),
    path(
        "employees/<int:pk>/photo/",
        EmployeePhotoAPIView.as_view(),
        name="employee-photo",
    ),


    #employer salaryy
     # Employee search for salary page
    path(
        "salary/employees/",
        SalaryEmployeeListAPIView.as_view(),
        name="salary-employees",
    ),

    # -----------------------------------------
    # SALARY
    # -----------------------------------------

    path(
        "salary-payments/",
        SalaryPaymentListCreateAPIView.as_view(),
        name="salary-payment-list-create",
    ),

    path(
        "salary-payments/<int:pk>/",
        SalaryPaymentDetailAPIView.as_view(),
        name="salary-payment-detail",
    ),

    # -----------------------------------------
    # ADVANCE
    # -----------------------------------------

    path(
        "advances/",
        AdvanceListCreateAPIView.as_view(),
        name="advance-list-create",
    ),

    path(
        "advances/<int:pk>/",
        AdvanceDetailAPIView.as_view(),
        name="advance-detail",
    ),


     path(
        "attendance/employees/",
        AttendanceEmployeeView.as_view(),
        name="attendance-employees",
    ),


    # ========================================================
    # ATTENDANCE
    # ========================================================

    path(
        "attendance/",
        AttendanceViewSet.as_view({
            "get": "list",
            "post": "create",
        }),
        name="attendance-list",
    ),

    path(
        "attendance/<int:pk>/",
        AttendanceViewSet.as_view({
            "get": "retrieve",
            "put": "update",
            "patch": "partial_update",
            "delete": "destroy",
        }),
        name="attendance-detail",
    ),


    # ========================================================
    # ATTENDANCE DAILY SUMMARY
    # ========================================================

    path(
        "attendance/daily-summary/",
        AttendanceViewSet.as_view({
            "get": "daily_summary",
        }),
        name="attendance-daily-summary",
    ),


    # ========================================================
    # ATTENDANCE WEEKLY SUMMARY
    # ========================================================

    path(
        "attendance/weekly-summary/",
        AttendanceViewSet.as_view({
            "get": "weekly_summary",
        }),
        name="attendance-weekly-summary",
    ),


    # ========================================================
    # ATTENDANCE MONTHLY SUMMARY
    # ========================================================

    path(
        "attendance/monthly-summary/",
        AttendanceViewSet.as_view({
            "get": "monthly_summary",
        }),
        name="attendance-monthly-summary",
    ),


    # ========================================================
    # EMPLOYEE ATTENDANCE SUMMARY
    # ========================================================

    path(
        "attendance/employee-summary/",
        AttendanceViewSet.as_view({
            "get": "employee_summary",
        }),
        name="attendance-employee-summary",
    ),


    # ========================================================
    # WAGE CONFIG
    # ========================================================

    path(
        "wage-config/",
        WageConfigViewSet.as_view({
            "get": "list",
            "post": "create",
        }),
        name="wage-config-list",
    ),

    path(
        "wage-config/<int:pk>/",
        WageConfigViewSet.as_view({
            "get": "retrieve",
            "put": "update",
            "patch": "partial_update",
            "delete": "destroy",
        }),
        name="wage-config-detail",
    ),





      # inventory

       path("inventory/",InventoryAPIView.as_view(),name="inventory",),  
       path("inventory/material/menu/",MaterialMenuAPIView.as_view(),name="material-menu",),
       path(
        "consumable/",
        ConsumableDashboardView.as_view(),
        name="consumable-dashboard"
    ),
    #consumable grn po items list
    path("consumable-grn/po-items/",ConsumableGRNPOItemListAPIView.as_view(),name="consumable-grn-po-items",),
   
   
    # Receive quantity against one PO item
    path(
        "consumable-grn/receive/<int:item_id>/",
        ConsumableGRNReceiveAPIView.as_view(),
        name="consumable-grn-receive",
    ),

    path(
        "consumable-grn/direct/",
        ConsumableGRNDirectCreateAPIView.as_view(),
        name="consumable-grn-direct",
    ),


    path(
    "consumable-grn/stock/",
    ConsumableStockAPIView.as_view(),
        name="consumable-stock",
    ),
    path(
        "consumable-grn/issue-stock/",
        ConsumableIssueStockAPIView.as_view(),
        name="consumable-issue-stock",
    ),
    path(
        "consumable-grn/issue/<int:grn_id>/",
        ConsumableIssueCreateAPIView.as_view(),
        name="consumable-issue-create",
    ),

   


]