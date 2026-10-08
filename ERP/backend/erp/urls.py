from django.urls import path

from .views import ( AccountsModulesAPIView, AccountsReportAPIView, AccountsReportStatusAPIView, AdvanceDetailAPIView, AdvanceListCreateAPIView, AssemblyDetailAPIView, AssemblyListCreateAPIView, AssemblyProjectListAPIView, AssemblySourcesListAPIView, BOMBatchSaveAPIView, BOMItemDetailAPIView, BOMItemListCreateAPIView,  ChangePasswordAPIView, ConsumableDashboardView, ConsumableGRNDirectCreateAPIView, ConsumableGRNPOItemListAPIView, ConsumableGRNReceiveAPIView, ConsumableMovementDetailAPIView, ConsumableMovementGroupListAPIView, ConsumableReturnCreateAPIView, ConsumableReturnableIssueListAPIView, ContactUsAPIView, CustomerAPIView, DeliveryChallanConfirmAPIView, DeliveryChallanCreateAPIView, DeliveryChallanCustomerAPIView, DeliveryChallanNextNumberAPIView, DrawingDetailAPIView, DrawingListCreateAPIView, DummyPurchaseOrderCreateAPIView, EmployeeArchiveAPIView, EmployeeDetailAPIView, EmployeeListCreateAPIView, EmployeePhotoAPIView, FilterOptionsAPIView, JobWorkReceiveCreateAPIView, JobWorkReceiveHistoryAPIView, JobWorkReceiveListAPIView, JournalAPIView, JournalDetailAPIView, JournalPOOptionsAPIView, 
                    LoginAPIView ,InventoryAPIView, LogoutAPIView, MaterialGRNCreateAPIView, MaterialGRNDetailAPIView, MaterialMenuAPIView, MaterialReceiveListAPIView, MaterialStockDetailAPIView, MaterialStockFromGRNAPIView, MaterialStockListAPIView, MaterialStockMovementListAPIView, MyAttendanceAPIView,
                      NextPurchaseOrderNumberAPIView, ProductionAvailableListAPIView, ProductionIssueCreateAPIView, ProductionIssueListAPIView, ProductionOperationActionAPIView, ProductionOperationDetailAPIView, ProductionOperationListAPIView, ProfileAPIView, ProfilePhotoDeleteAPIView, ProformaInvoiceConfirmAPIView, ProformaInvoiceCreateAPIView, ProformaInvoiceCustomerAPIView, ProformaInvoiceNextNumberAPIView, ProjectDetailAPIView, ProjectIntegrationCreateAPIView, ProjectIntegrationListAPIView, ProjectIntegrationSaveAPIView, ProjectListCreateAPIView, ProjectPOItemListAPIView, PurchaseOrderConfirmAPIView, 
                        PurchaseOrderListCreateAPIView, QuotationConfirmAPIView, QuotationCreateAPIView, QuotationCustomerAPIView,
                          QuotationNextNumberAPIView, RefreshTokenAPIView, ReworkCancelAPIView, ReworkCompleteAPIView, ReworkDetailAPIView, ReworkListAPIView, ReworkQcAPIView, ReworkStartAPIView,  SalaryEmployeeListAPIView, SalaryPaymentDetailAPIView, SalaryPaymentListCreateAPIView,  TaxInvoiceConfirmAPIView, TaxInvoiceCreateAPIView, TaxInvoiceCustomerAPIView, TaxInvoiceNextNumberAPIView, UserProfileDetailAPIView, 
                          UserProfileListCreateAPIView, AttendanceEmployeeView,
    AttendanceViewSet,
    WageConfigViewSet,
    ConsumableStockAPIView,
    ConsumableIssueStockAPIView,
    ConsumableIssueCreateAPIView,
    JobWorkStockListAPIView,
    JobWorkProcessListCreateAPIView,
    JobWorkIssueListAPIView,
    JobWorkIssueCreateAPIView,
    DispatchReadyListAPIView,
    DispatchHistoryAPIView,
    DispatchSearchAPIView,
    DispatchByDCAPIView,
    DispatchDetailAPIView,
    DispatchCreateAPIView,
     ReportsKpiAPIView,
    ReportsListAPIView,
    ReportsFilterOptionsAPIView,
    MovementProjectsAPIView,
    MovementPOsAPIView,
    MovementGroupsAPIView,
    MovementTimelineAPIView,
    ScrapPOItemListAPIView,
    ScrapListCreateAPIView,
    ScrapDetailAPIView,
    ScrapDashboardAPIView,
    
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
    path("journal/po-options/", JournalPOOptionsAPIView.as_view(), name="journal-po-options"),



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

    path("consumable-grn/returnable-issues/", ConsumableReturnableIssueListAPIView.as_view(), name="consumable-returnable-issues"),
path("consumable-grn/return/<int:issue_id>/", ConsumableReturnCreateAPIView.as_view(), name="consumable-return-create"),
path(
    "consumable-grn/movement-groups/",
    ConsumableMovementGroupListAPIView.as_view(),
    name="consumable-movement-groups",
),
path(
    "consumable-grn/movements/detail/",
    ConsumableMovementDetailAPIView.as_view(),
    name="consumable-movement-detail",
),
# material
path("inventory/material/menu/",MaterialMenuAPIView.as_view(),name="material-menu",),



path("material/projects/", ProjectListCreateAPIView.as_view(), name="material-projects-list-create"),
    path("material/projects/<int:pk>/", ProjectDetailAPIView.as_view(), name="material-project-detail"),

    # Drawings
    path("material/drawings/", DrawingListCreateAPIView.as_view(), name="material-drawings-list-create"),
    path("material/drawings/<int:pk>/", DrawingDetailAPIView.as_view(), name="material-drawing-detail"),

    # BOM Materials
    path("material/bom-items/", BOMItemListCreateAPIView.as_view(), name="material-bom-items-list-create"),
    path("material/bom-items/<int:pk>/", BOMItemDetailAPIView.as_view(), name="material-bom-item-detail"),
    path("material/bom/batch-save/", BOMBatchSaveAPIView.as_view(), name="material-bom-batch-save"),



     # ============================================================
    # MATERIAL PLANNING — BOM ↔ PO INTEGRATION
    # ============================================================
       # ============================================================
    # MATERIAL PLANNING — PO INTEGRATION
    # ============================================================
    path(
        "material/dummy-purchase-orders/",
        DummyPurchaseOrderCreateAPIView.as_view(),
        name="material-dummy-purchase-order-create",
    ),
    # New — list PO items + history for a project
    path(
        "material/project-po-items/",
        ProjectPOItemListAPIView.as_view(),
        name="material-project-po-items",
    ),
    # New — create integrations tied to a project (no BOM required)
    path(
        "material/project-po-integration/create/",
        ProjectIntegrationCreateAPIView.as_view(),
        name="material-project-po-integration-create",
    ),
   
    path(
        "material/project-integration/",
        ProjectIntegrationListAPIView.as_view(),
        name="material-project-integration-list",
    ),
    path(
        "material/project-integration/save/",
        ProjectIntegrationSaveAPIView.as_view(),
        name="material-project-integration-save",
    ),




    # ============================================================
    # MATERIAL GRN — RECEIVE
    # ============================================================
    path(
        "material/receive/list/",
        MaterialReceiveListAPIView.as_view(),
        name="material-receive-list",
    ),
    path(
        "material/receive/",
        MaterialGRNCreateAPIView.as_view(),
        name="material-receive-create",
    ),
    path(
        "material/receive/history/",
        MaterialGRNDetailAPIView.as_view(),
        name="material-receive-history",
    ),
    path(
        "material/receive/history/<int:pk>/",
        MaterialGRNDetailAPIView.as_view(),
        name="material-receive-history-detail",
    ),


    path(
    "filter-options/",
    FilterOptionsAPIView.as_view(),
    name="filter-options",
),


path(
    "material/stock/",
    MaterialStockListAPIView.as_view(),
    name="material-stock-list",
),
path(
    "material/stock/<int:pk>/",
    MaterialStockDetailAPIView.as_view(),
    name="material-stock-detail",
),
path(
    "material/stock/<int:pk>/movements/",
    MaterialStockMovementListAPIView.as_view(),
    name="material-stock-movements",
),
path(
    "material/stock/from-grn/",
    MaterialStockFromGRNAPIView.as_view(),
    name="material-stock-from-grn",
),
# ============================================================
# ISSUE TO JOB WORK
# ============================================================
path(
    "material/job-work/stock/",
    JobWorkStockListAPIView.as_view(),
    name="material-job-work-stock",
),
path(
    "material/job-work/processes/",
    JobWorkProcessListCreateAPIView.as_view(),
    name="material-job-work-processes",
),
path(
    "material/job-work/issues/",
    JobWorkIssueListAPIView.as_view(),
    name="material-job-work-issues",
),
path(
    "material/job-work/issue/",
    JobWorkIssueCreateAPIView.as_view(),
    name="material-job-work-issue-create",
),



# ============================================================
# RECEIVE FROM JOB WORK
# ============================================================
path(
    "material/job-work/receive/",
    JobWorkReceiveListAPIView.as_view(),
    name="material-job-work-receive-list",
),
path(
    "material/job-work/receive/history/",
    JobWorkReceiveHistoryAPIView.as_view(),
    name="material-job-work-receive-history",
),
path(
    "material/job-work/receive/<int:issue_id>/",
    JobWorkReceiveCreateAPIView.as_view(),
    name="material-job-work-receive-create",
),



# ============================================================
# ISSUE TO PRODUCTION
# ============================================================
path(
    "material/production/available/",
    ProductionAvailableListAPIView.as_view(),
    name="material-production-available",
),
path(
    "material/production/history/",
    ProductionIssueListAPIView.as_view(),
    name="material-production-history",
),
path(
    "material/production/issue/",
    ProductionIssueCreateAPIView.as_view(),
    name="material-production-issue",
),


path(
    "material/assembly/",
    AssemblyListCreateAPIView.as_view(),
    name="material-assembly-list-create",
),
path(
    "material/assembly/sources/",
    AssemblySourcesListAPIView.as_view(),
    name="material-assembly-sources",
),
path(
    "material/assembly/projects/",
    AssemblyProjectListAPIView.as_view(),
    name="material-assembly-projects",
),
path(
    "material/assembly/<str:assembly_id>/",
    AssemblyDetailAPIView.as_view(),
    name="material-assembly-detail",
),



# ============================================================
# REWORK
# ============================================================
path(
    "material/rework/",
    ReworkListAPIView.as_view(),
    name="material-rework-list",
),
path(
    "material/rework/<int:pk>/",
    ReworkDetailAPIView.as_view(),
    name="material-rework-detail",
),
path(
    "material/rework/<int:pk>/start/",
    ReworkStartAPIView.as_view(),
    name="material-rework-start",
),
path(
    "material/rework/<int:pk>/complete/",
    ReworkCompleteAPIView.as_view(),
    name="material-rework-complete",
),
path(
    "material/rework/<int:pk>/qc/",
    ReworkQcAPIView.as_view(),
    name="material-rework-qc",
),
path(
    "material/rework/<int:pk>/cancel/",
    ReworkCancelAPIView.as_view(),
    name="material-rework-cancel",
),



path(
    "material/production/operation/",
    ProductionOperationListAPIView.as_view(),
    name="material-production-operation-list",
),
path(
    "material/production/operation/<str:assembly_id>/",
    ProductionOperationDetailAPIView.as_view(),
    name="material-production-operation-detail",
),
path(
    "material/production/operation/<str:assembly_id>/action/",
    ProductionOperationActionAPIView.as_view(),
    name="material-production-operation-action",
),


# ============================================================
# DISPATCH
# ============================================================
path(
    "material/dispatch/ready/",
    DispatchReadyListAPIView.as_view(),
    name="material-dispatch-ready",
),
path(
    "material/dispatch/history/",
    DispatchHistoryAPIView.as_view(),
    name="material-dispatch-history",
),
path(
    "material/dispatch/search/",
    DispatchSearchAPIView.as_view(),
    name="material-dispatch-search",
),
path(
    "material/dispatch/by-dc/",
    DispatchByDCAPIView.as_view(),
    name="material-dispatch-by-dc",
),
path(
    "material/dispatch/create/<str:assembly_id>/",
    DispatchCreateAPIView.as_view(),
    name="material-dispatch-create",
),
path(
    "material/dispatch/<str:assembly_id>/",
    DispatchDetailAPIView.as_view(),
    name="material-dispatch-detail",
),


  # ---- KPI cards ----
    path(
        "reports/kpis/",
        ReportsKpiAPIView.as_view(),
        name="reports-kpis",
    ),

    # ---- Material Movement (BEFORE the generic <report_key>) ----
    path(
        "reports/material-movement/projects/",
        MovementProjectsAPIView.as_view(),
        name="reports-mm-projects",
    ),
    path(
        "reports/material-movement/pos/",
        MovementPOsAPIView.as_view(),
        name="reports-mm-pos",
    ),
    path(
        "reports/material-movement/groups/",
        MovementGroupsAPIView.as_view(),
        name="reports-mm-groups",
    ),
    path(
        "reports/material-movement/timeline/",
        MovementTimelineAPIView.as_view(),
        name="reports-mm-timeline",
    ),

    # ---- Generic report endpoints ----
    path(
        "reports/<str:report_key>/filter-options/",
        ReportsFilterOptionsAPIView.as_view(),
        name="reports-filter-options",
    ),
    path(
        "reports/<str:report_key>/",
        ReportsListAPIView.as_view(),
        name="reports-list",
    ),
     # =====================================================
    # SCRAP
    # =====================================================

    # Get confirmed PO items for Scrap
    path(
        "material/scrap/po-items/",
        ScrapPOItemListAPIView.as_view(),
        name="scrap-po-items",
    ),

    # List Scrap + Create Scrap
    path(
        "material/scrap/",
        ScrapListCreateAPIView.as_view(),
        name="scrap-list-create",
    ),

    # Get / Update / Delete Scrap
    path(
        "material/scrap/<int:pk>/",
        ScrapDetailAPIView.as_view(),
        name="scrap-detail",
    ),

    # Scrap Dashboard / KPIs
    path(
        "material/scrap/dashboard/",
        ScrapDashboardAPIView.as_view(),
        name="scrap-dashboard",
    ),




    path("contact/", ContactUsAPIView.as_view(), name="contact-us"),


    


   


]