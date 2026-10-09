from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):

    class UserType(models.TextChoices):
        PRODUCTION = "production", "Production"
        ADMIN = "admin", "Admin"
        HR = "hr", "HR"
        MATERIAL_PLANNING = "material-planning", "Material Planning"
        SUPERVISOR = "supervisor", "Supervisor"
        ACCOUNTS = "accounts", "Accounts"

    user_type = models.CharField(
        max_length=30,
        choices=UserType.choices,
        default=UserType.PRODUCTION,
    )

    def __str__(self):
        return f"{self.username} - {self.get_user_type_display()}"


class UserProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )

    profile_photo = models.ImageField(
        upload_to="profile_photos/",
        blank=True,
        null=True,
    )

    employee_id = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True,
    )

    phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
    )

    joining_date = models.DateField(
        blank=True,
        null=True,
    )

    role = models.CharField(
        max_length=100,
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.user.username} Profile"


#accounts



from django.conf import settings
from django.db import models
from django.conf import settings
from django.db import models, transaction

import json




class PurchaseOrder(models.Model):

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PREVIEWED = "previewed", "Previewed"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"

    class PaymentStatus(models.TextChoices):
            PAID = "Paid", "Paid"
            PENDING = "Pending", "Pending"
            NA = "N/A", "N/A"
    
    class DeliveryStatus(models.TextChoices):
            DELIVERED = "Delivered", "Delivered"
            PENDING = "Pending", "Pending"
            NA = "N/A", "N/A"   

    # =========================
    # BASIC PO DETAILS
    # =========================

    po_number = models.CharField(
        max_length=100,
        unique=True,
    )

    po_date = models.DateField(
        null=True,
        blank=True,
    )

    ref_quote_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    ref_date = models.DateField(
        null=True,
        blank=True,
    )

    subject = models.CharField(
        max_length=500,
        blank=True,
        default="",
    )

    prepared_by = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    # =========================
    # CUSTOMER / VENDOR
    # =========================

    vendor = models.JSONField(
        default=dict,
        blank=True,
    )

    # =========================
    # INTRO
    # =========================

    intro_text = models.TextField(
        blank=True,
        default="",
    )

    # =========================
    # ORDER ITEMS
    # =========================

    items = models.JSONField(
        default=list,
        blank=True,
    )

    columns = models.JSONField(
        default=list,
        blank=True,
    )
        

    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )

    delivery_status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
    )

    # =========================
    # AMOUNT DETAILS
    # =========================

    include_amount_details = models.BooleanField(
        default=True,
    )

    subtotal = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    gst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
    )

    gst_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    grand_total = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    # =========================
    # DELIVERY
    # =========================

    delivery = models.JSONField(
        default=dict,
        blank=True,
    )

    # =========================
    # PAYMENT
    # =========================

    payment = models.JSONField(
        default=dict,
        blank=True,
    )

    # =========================
    # TERMS
    # =========================

    terms = models.JSONField(
        default=list,
        blank=True,
    )

    # =========================
    # NOTES
    # =========================

    notes = models.TextField(
        blank=True,
        default="",
    )

    # =========================
    # SIGNATURES
    # =========================

    signatures = models.JSONField(
        default=dict,
        blank=True,
    )

    # =========================
    # COMPLETE ORIGINAL FORM DATA
    # =========================

    document_data = models.JSONField(
        default=dict,
        blank=True,
    )

    # =========================
    # STATUS
    # =========================

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PREVIEWED,
    )

    pdf_file = models.FileField(
        upload_to="PO/PDF/",
        blank=True,
        null=True,
    )

    # =========================
    # CREATED BY
    # =========================

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_orders",
    )

    # =========================
    # TIMESTAMPS
    # =========================

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.po_number

   

    def save(self, *args, **kwargs):

        if isinstance(self.items, list):

            normalised = []

            for idx, item in enumerate(self.items, start=1):

                if not isinstance(item, dict):
                    continue

                copy = dict(item)
                copy["serialNo"] = idx
                normalised.append(copy)

            self.items = normalised

        
        super().save(*args, **kwargs)

        
        if self.status == self.Status.CONFIRMED:

            for index, item in enumerate(self.items or [], start=1):

                if not isinstance(item, dict):
                    continue

                # Helper to safely pull and normalise dimension values
                def _dim(key):
                    val = item.get(key)
                    if val is None:
                        return ""
                    return str(val).strip()

                PurchaseOrderItem.objects.update_or_create(
                    purchase_order=self,
                    item_code=f"DESC-{index:03d}",
                                        defaults={
                        "po_number": self.po_number,

                        "description": (
                            item.get("description")
                            or item.get("poDescription")
                            or item.get("itemDescription")
                            or ""
                        ),

                        "material": (
                            item.get("material")
                            or item.get("materialType")
                            or ""
                        ),

                        "material_code": (
                            item.get("materialCode")
                            or item.get("material_code")
                            or ""
                        ),

                        "material_spec": (
                            item.get("materialSpec")
                            or item.get("material_spec")
                            or ""
                        ),

                        "quantity": (
                            item.get("quantity")
                            or item.get("qty")
                            or item.get("poQty")
                            or 0
                        ),

                        "unit": (
                            item.get("unit")
                            or item.get("uom")
                            or ""
                        ),

                        "unit_weight": (
                            item.get("unitWeight")
                            or item.get("unit_weight")
                            or None
                        ),

                        "length": _dim("length"),
                        "width": _dim("width"),
                        "thickness": _dim("thickness"),
                    },
                                    )


class DummyPurchaseOrder(models.Model):
    """
    Internal dummy PO used by Material Planning to integrate
    against a project when no real PO exists.

    Completely separate from PurchaseOrder so nothing leaks into
    accounts, GRN, reports, or Consumable flows.
    """

    po_number = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
    )

    # Owner — who created it. Handy for filtering by user.
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dummy_purchase_orders",
    )

    remarks = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.po_number


class DummyPurchaseOrderItem(models.Model):
    """
    One line of a Dummy Purchase Order. Stores everything the
    modal sends — nothing gets dropped.
    """

    dummy_po = models.ForeignKey(
        DummyPurchaseOrder,
        on_delete=models.CASCADE,
        related_name="items",
    )

    item_code = models.CharField(max_length=100, blank=True, default="")

    description = models.CharField(max_length=500, blank=True, default="")

    material = models.CharField(max_length=150, blank=True, default="")

    length = models.CharField(max_length=50, blank=True, default="")

    width = models.CharField(max_length=50, blank=True, default="")

    thickness = models.CharField(max_length=50, blank=True, default="")

    quantity = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    unit = models.CharField(max_length=50, blank=True, default="")

    remarks = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.dummy_po.po_number} - {self.description}"
class PurchaseOrderNumberSettings(models.Model):
    prefix = models.CharField(
        max_length=20,
        default="PO",
    )

    next_number = models.PositiveIntegerField(
        default=1,
    )

    number_padding = models.PositiveIntegerField(
        default=3,
    )

    is_active = models.BooleanField(
        default=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.prefix}{self.next_number:0{self.number_padding}d}"

class Customer(models.Model):

    class Source(models.TextChoices):
        PURCHASE_ORDER = "purchase_order", "Purchase Order"
        QUOTATION = "quotation", "Quotation"
        DELIVERY_CHALLAN = "delivery_challan", "Delivery Challan"
        TAX_INVOICE = "tax_invoice", "Tax Invoice"
        PROFORMA_INVOICE = "proforma_invoice", "Proforma Invoice"
        OTHER = "other", "Other"

    company_name = models.CharField(
        max_length=255,
    )

    address = models.TextField(
        blank=True,
        default="",
    )

    contact_person = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    phone = models.CharField(
        max_length=20,
        blank=True,
        default="",
    )

    email = models.EmailField(
        blank=True,
        default="",
    )

    gst_number = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )
    state = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    # NEW
    state_code = models.CharField(
        max_length=10,
        blank=True,
        default="",
    )

    # Where this customer was created/entered from
    source = models.CharField(
        max_length=30,
        choices=Source.choices,
        default=Source.PURCHASE_ORDER,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["company_name"]

    def __str__(self):
        return self.company_name
    

class QuotationNumberSettings(models.Model):
    prefix = models.CharField(
        max_length=20,
        default="QTN",
    )

    next_number = models.PositiveIntegerField(
        default=1,
    )

    number_padding = models.PositiveIntegerField(
        default=3,
    )

    is_active = models.BooleanField(
        default=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.prefix}{self.next_number:0{self.number_padding}d}"


class Quotation(models.Model):

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PREVIEWED = "PREVIEWED", "Previewed"
        CONFIRMED = "CONFIRMED", "Confirmed"
        CANCELLED = "CANCELLED", "Cancelled"

    class PaymentStatus(models.TextChoices):
        PAID = "Paid", "Paid"
        PENDING = "Pending", "Pending"
        NA = "N/A", "N/A"

    class DeliveryStatus(models.TextChoices):
        DELIVERED = "Delivered", "Delivered"
        PENDING = "Pending", "Pending"
        NA = "N/A", "N/A"

    quotation_number = models.CharField(
        max_length=50,
        unique=True,
    )

    quotation_date = models.DateField()

    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="quotations",
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )

    delivery_status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
    )

    subject = models.CharField(
        max_length=500,
        blank=True,
        default="",
    )

    intro = models.TextField(
        blank=True,
        default="",
    )

    # Quotation items
    items = models.JSONField(
        default=list,
    )

    # Technical sections
    technical_details = models.JSONField(
        default=list,
    )

    # Terms & conditions
    terms = models.JSONField(
        default=list,
    )

    # Signature information
    signatures = models.JSONField(
        default=dict,
    )

    # Company / designation
    company_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    designation = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    # Amount information
    subtotal = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    gst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
    )

    gst_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    grand_total = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    pdf_file = models.FileField(
    upload_to="quotations/",
    blank=True,
    null=True,
)

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.quotation_number


# for dc 

class DeliveryChallanNumberSettings(models.Model):
    prefix = models.CharField(
        max_length=20,
        default="DC",
    )

    next_number = models.PositiveIntegerField(
        default=1,
    )

    number_padding = models.PositiveIntegerField(
        default=3,
    )

    is_active = models.BooleanField(
        default=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.prefix}{self.next_number:0{self.number_padding}d}"


class DeliveryChallan(models.Model):

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PREVIEWED = "PREVIEWED", "Previewed"
        CONFIRMED = "CONFIRMED", "Confirmed"
        CANCELLED = "CANCELLED", "Cancelled"
    class PaymentStatus(models.TextChoices):
        PAID = "Paid", "Paid"
        PENDING = "Pending", "Pending"
        NA = "N/A", "N/A"

    class DeliveryStatus(models.TextChoices):
        DELIVERED = "Delivered", "Delivered"
        PENDING = "Pending", "Pending"
        NA = "N/A", "N/A"

    # ==================================================
    # Challan identity
    # ==================================================

    dc_number = models.CharField(
        max_length=50,
        unique=True,
    )

    dc_date = models.DateField()
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )

    delivery_status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
    )

    # ==================================================
    # Customer
    # ==================================================

    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="delivery_challans",
    )

    # ==================================================
    # Reference documents
    # ==================================================

    po_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    po_date = models.DateField(
        blank=True,
        null=True,
    )

    bill_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    bill_date = models.DateField(
        blank=True,
        null=True,
    )

    # ==================================================
    # Delivery / dispatch
    # ==================================================

    delivery_at = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    company_address_id = models.CharField(
        max_length=50,
        blank=True,
        default="unit1",
    )

    returnable = models.BooleanField(
        default=False,
    )

    # ==================================================
    # Items
    # ==================================================
    #
    # Each item:
    # {
    #   "id": "...",
    #   "description": "...",
    #   "quantity": "10",
    #   "rate": "250",
    #   "remarks": "..."
    # }
    #
    # ==================================================

    items = models.JSONField(
        default=list,
    )

    # ==================================================
    # Amount in words (manually entered, same as form)
    # ==================================================

    amount_in_words = models.TextField(
        blank=True,
        default="",
    )

    # ==================================================
    # Signature
    # ==================================================

    prepared_by = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    # ==================================================
    # Status / PDF
    # ==================================================

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    pdf_file = models.FileField(
        upload_to="delivery_challans/",
        blank=True,
        null=True,
    )

    # ==================================================
    # Timestamps
    # ==================================================

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.dc_number


#for tax
class TaxInvoiceNumberSettings(models.Model):
    prefix = models.CharField(
        max_length=20,
        default="INV",
    )

    next_number = models.PositiveIntegerField(
        default=1,
    )

    number_padding = models.PositiveIntegerField(
        default=3,
    )

    is_active = models.BooleanField(
        default=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.prefix}{self.next_number:0{self.number_padding}d}"


class TaxInvoice(models.Model):

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PREVIEWED = "PREVIEWED", "Previewed"
        CONFIRMED = "CONFIRMED", "Confirmed"
        CANCELLED = "CANCELLED", "Cancelled"
    class PaymentStatus(models.TextChoices):
        PAID = "Paid", "Paid"
        PENDING = "Pending", "Pending"
        NA = "N/A", "N/A"

    class DeliveryStatus(models.TextChoices):
        DELIVERED = "Delivered", "Delivered"
        PENDING = "Pending", "Pending"
        NA = "N/A", "N/A"

    # ==================================================
    # Invoice identity
    # ==================================================

    invoice_number = models.CharField(
        max_length=50,
        unique=True,
    )

    invoice_date = models.DateField(
        null=True,
        blank=True,
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )

    delivery_status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
    )

    date_of_supply = models.DateField(
        null=True,
        blank=True,
    )

    reverse_charge = models.CharField(
        max_length=5,
        blank=True,
        default="NO",
    )

    # ==================================================
    # Transport
    # ==================================================

    vehicle_number = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    mode_of_transport = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    # ==================================================
    # Receiver (Billed To)
    # ==================================================
    #
    # Stored as JSON because the form allows every field to be
    # overridden per invoice, and there is no FK to Customer here
    # (the form uses a GST-lookup that is independent of the
    # Customer model).
    #
    # Shape:
    # {
    #   "companyName": "...",
    #   "gst": "...",
    #   "address": "...",
    #   "state": "...",
    #   "stateCode": "...",
    #   "phone": "...",
    #   "email": "..."
    # }
    #

    receiver_details = models.JSONField(
        default=dict,
        blank=True,
    )

    # GST value selected from the lookup dropdown (kept separately so
    # the printed receiver block can still be reconstructed if the
    # user later changes receiver_details manually).
    receiver_gst = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    # Which COMPANY_ADDRESSES entry (unit1/unit2) was chosen for the
    # receiver address, if any.
    receiver_address_option_id = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    # ==================================================
    # Consignee (Shipped To)
    # ==================================================

    consignee_details = models.JSONField(
        default=dict,
        blank=True,
    )

    consignee_gst = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    consignee_address_option_id = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    # ==================================================
    # Place of Supply
    # ==================================================

    place_of_supply_state = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    place_of_supply_state_code = models.CharField(
        max_length=10,
        blank=True,
        default="",
    )

    state_name_code = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    # ==================================================
    # Company address (Unit 1 / Unit 2)
    # ==================================================

    company_address_id = models.CharField(
        max_length=50,
        blank=True,
        default="unit1",
    )

    # ==================================================
    # Items
    # ==================================================
    #
    # Each item:
    # {
    #   "id": "...",
    #   "description": "...",
    #   "hsn": "...",
    #   "quantity": "10",
    #   "unit": "Mtrs",
    #   "rate": "250",
    #   "amount": 2500
    # }
    #

    items = models.JSONField(
        default=list,
    )

    # ==================================================
    # Tax percentages / totals
    # ==================================================

    subtotal = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    cgst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=9,
    )

    cgst_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    sgst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=9,
    )

    sgst_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    igst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
    )

    igst_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    rounded_off = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    grand_total = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    amount_in_words = models.TextField(
        blank=True,
        default="",
    )

    # ==================================================
    # Bank details
    # ==================================================

    bank_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    account_number = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    branch = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    ifsc = models.CharField(
        max_length=20,
        blank=True,
        default="",
    )

    pan = models.CharField(
        max_length=20,
        blank=True,
        default="",
    )

    # ==================================================
    # Declaration
    # ==================================================

    declaration = models.TextField(
        blank=True,
        default="",
    )

    # ==================================================
    # Enclosures
    # ==================================================
    #
    # Shape:
    # {
    #   "Delivery Challan": true,
    #   "Material Accountable Statement": true,
    #   ...
    # }
    #

    enclosures = models.JSONField(
        default=dict,
        blank=True,
    )

    # ==================================================
    # Complete original form data
    # --------------------------------------------------
    # Mirrors PurchaseOrder.document_data — the full frontend
    # payload is stored verbatim so nothing the form computes
    # is ever lost even if a field is later added.
    # ==================================================

    document_data = models.JSONField(
        default=dict,
        blank=True,
    )

    # ==================================================
    # Status / PDF
    # ==================================================

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    pdf_file = models.FileField(
        upload_to="tax_invoices/pdf/",
        blank=True,
        null=True,
    )

    # ==================================================
    # Timestamps
    # ==================================================

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.invoice_number


#for perfoma
class ProformaInvoiceNumberSettings(models.Model):
    prefix = models.CharField(
        max_length=20,
        default="PF",
    )

    next_number = models.PositiveIntegerField(
        default=1,
    )

    number_padding = models.PositiveIntegerField(
        default=4,
    )

    is_active = models.BooleanField(
        default=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.prefix}{self.next_number:0{self.number_padding}d}"


class ProformaInvoice(models.Model):

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PREVIEWED = "PREVIEWED", "Previewed"
        CONFIRMED = "CONFIRMED", "Confirmed"
        CANCELLED = "CANCELLED", "Cancelled"
    class PaymentStatus(models.TextChoices):
        PAID = "Paid", "Paid"
        PENDING = "Pending", "Pending"
        NA = "N/A", "N/A"

    class DeliveryStatus(models.TextChoices):
        DELIVERED = "Delivered", "Delivered"
        PENDING = "Pending", "Pending"
        NA = "N/A", "N/A"

    # ==================================================
    # Proforma identity
    # ==================================================

    proforma_no = models.CharField(
        max_length=50,
        unique=True,
    )

    date = models.DateField(
        null=True,
        blank=True,
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )

    delivery_status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
    )

    valid_until = models.DateField(
        null=True,
        blank=True,
    )

    payment_terms = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    # ==================================================
    # Reference / Order information
    # ==================================================

    reference_no = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    customer_po_no = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    po_date = models.DateField(
        null=True,
        blank=True,
    )

    place_of_supply = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    # ==================================================
    # Receiver (Billed To)
    # ==================================================
    #
    # Stored as JSON because the form lets every field be overridden
    # per proforma, and there is no FK to Customer here (the form uses
    # a GST-lookup that is independent of the Customer model).
    #
    # Shape:
    # {
    #   "companyName": "...",
    #   "gst": "...",
    #   "address": "...",
    #   "state": "...",
    #   "stateCode": "...",
    #   "phone": "...",
    #   "email": "..."
    # }
    #

    receiver_details = models.JSONField(
        default=dict,
        blank=True,
    )

    receiver_gst = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    receiver_address_option_id = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    # ==================================================
    # Consignee (Shipped To)
    # ==================================================

    consignee_details = models.JSONField(
        default=dict,
        blank=True,
    )

    consignee_gst = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    consignee_address_option_id = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    # ==================================================
    # Company address (Unit 1 / Unit 2)
    # ==================================================

    company_address_id = models.CharField(
        max_length=50,
        blank=True,
        default="unit1",
    )

    # ==================================================
    # Items
    # ==================================================
    #
    # Each item:
    # {
    #   "id": "...",
    #   "description": "...",
    #   "hsn": "...",
    #   "quantity": "10",
    #   "unit": "Mtrs",
    #   "rate": "250",
    #   "amount": 2500
    # }
    #

    items = models.JSONField(
        default=list,
    )

    # ==================================================
    # Tax percentages / totals
    # ==================================================

    subtotal = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    cgst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=9,
    )

    cgst_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    sgst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=9,
    )

    sgst_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    igst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
    )

    igst_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    rounded_off = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    grand_total = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    amount_in_words = models.TextField(
        blank=True,
        default="",
    )

    # ==================================================
    # Bank details
    # ==================================================

    bank_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    account_number = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    branch = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    ifsc = models.CharField(
        max_length=20,
        blank=True,
        default="",
    )

    pan = models.CharField(
        max_length=20,
        blank=True,
        default="",
    )

    # ==================================================
    # Declaration
    # ==================================================

    declaration = models.TextField(
        blank=True,
        default="",
    )

    # ==================================================
    # Enclosure text
    # --------------------------------------------------
    # A single text block. Each newline becomes one numbered point
    # under "Encl :" on the printed proforma.
    # ==================================================

    enclosure_text = models.TextField(
        blank=True,
        default="",
    )

    # ==================================================
    # Complete original form data
    # --------------------------------------------------
    # Mirrors TaxInvoice.document_data — the full frontend payload is
    # stored verbatim so nothing the form computes is ever lost even
    # if a field is later added.
    # ==================================================

    document_data = models.JSONField(
        default=dict,
        blank=True,
    )

    # ==================================================
    # Status / PDF
    # ==================================================

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    pdf_file = models.FileField(
        upload_to="proforma_invoices/pdf/",
        blank=True,
        null=True,
    )

    # ==================================================
    # Timestamps
    # ==================================================

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.proforma_no

class JournalEntry(models.Model):

    class EntryType(models.TextChoices):
        EXPENSE = "Expense", "Expense"
        INCOME = "Income", "Income"

    class PaymentMode(models.TextChoices):
        CASH = "Cash", "Cash"
        UPI = "UPI", "UPI"
        BANK_TRANSFER = "Bank Transfer", "Bank Transfer"
        CHEQUE = "Cheque", "Cheque"
        OTHER = "Other", "Other"

    class Category(models.TextChoices):
        PURCHASE = "Purchase", "Purchase"
        TRANSPORT = "Transport", "Transport"
        SALARY = "Salary", "Salary"
        RENT = "Rent", "Rent"
        ELECTRICITY = "Electricity", "Electricity"
        MAINTENANCE = "Maintenance", "Maintenance"
        OFFICE = "Office", "Office"
        SALES = "Sales", "Sales"
        OTHER = "Other", "Other"

    # =========================
    # IDENTITY
    # =========================

    record_number = models.CharField(max_length=50, unique=True)
    date          = models.DateField()
    type          = models.CharField(
        max_length=20,
        choices=EntryType.choices,
        default=EntryType.EXPENSE,
    )

    # =========================
    # DETAILS
    # =========================

    category      = models.CharField(
        max_length=50,
        choices=Category.choices,
        default=Category.OTHER,
    )
    description   = models.TextField(blank=True, default="")
    amount        = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    payment_mode  = models.CharField(
        max_length=30,
        choices=PaymentMode.choices,
        default=PaymentMode.CASH,
    )

    # =========================
    # DOCUMENT / REFERENCE
    # =========================

    document_number = models.CharField(max_length=100, blank=True, default="")
    document        = models.CharField(max_length=100, blank=True, default="")
    notes           = models.TextField(blank=True, default="")

    # =========================
    # OPTIONAL LINK TO SOURCE DOC
    # =========================

    source_type = models.CharField(max_length=30, blank=True, default="")
    source_id   = models.PositiveIntegerField(null=True, blank=True)

    # =========================
    # OPTIONAL PURCHASE ORDER LINK   ← NEW
    # =========================
    # When set, this entry is tied to a real Purchase Order.
    # SET_NULL so deleting a PO doesn't cascade-delete financial history.

    purchase_order = models.ForeignKey(
        "PurchaseOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="journal_entries",
    )

    # Snapshot of the PO number at save time so historical rows
    # still read correctly even if the PO is later renamed.
    po_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
    )

    # =========================
    # TIMESTAMPS
    # =========================

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        verbose_name = "Journal Entry"
        verbose_name_plural = "Journal Entries"
        indexes = [
            models.Index(fields=["purchase_order"]),
            models.Index(fields=["po_number"]),
        ]

    def __str__(self):
        return f"{self.record_number} — {self.type} — {self.amount}"

    def save(self, *args, **kwargs):
        # Keep the snapshot in sync automatically.
        if self.purchase_order_id and not self.po_number:
            self.po_number = self.purchase_order.po_number
        super().save(*args, **kwargs)
#hr 
# hr/models.py



class Department(models.TextChoices):
    ENGINEERING = "Engineering", "Engineering"
    PRODUCTION = "Production", "Production"
    HR = "HR", "HR"
    SALES = "Sales", "Sales"
    ACCOUNTS = "Accounts", "Accounts"


class EmploymentStatus(models.TextChoices):
    ACTIVE = "Active", "Active"
    INACTIVE = "Inactive", "Inactive"
    RESIGNED = "Resigned", "Resigned"
    TERMINATED = "Terminated", "Terminated"
    ON_NOTICE = "On Notice", "On Notice"


class EmploymentType(models.TextChoices):
    PERMANENT = "Permanent", "Permanent"
    PROBATION = "Probation", "Probation"
    CONTRACT = "Contract", "Contract"
    TEMPORARY = "Temporary", "Temporary"
    INTERN = "Intern", "Intern"
    CONSULTANT = "Consultant", "Consultant"


class Gender(models.TextChoices):
    MALE = "Male", "Male"
    FEMALE = "Female", "Female"
    OTHER = "Other", "Other"


class MaritalStatus(models.TextChoices):
    SINGLE = "Single", "Single"
    MARRIED = "Married", "Married"
    DIVORCED = "Divorced", "Divorced"
    WIDOWED = "Widowed", "Widowed"


class Employee(models.Model):
    """
    Full employee record.

    - `employee_id` is user-entered (e.g. "EMP001", "TRX-001") and
      is the human-facing identifier the HR user types in.
    - Internal `id` (auto PK) is what the API uses in URLs.
    - JSONField is used for education/experience/bank/documents/
      employmentHistory so the frontend shape maps 1:1.
    """

    # ---------------------------------------------------------
    # IDENTITY  (user-entered — the frontend "id" field)
    # ---------------------------------------------------------
    employee_id = models.CharField(
        max_length=50,
        unique=True,
        help_text="Manually entered employee ID, e.g. EMP001 or TRX-001.",
    )
    employee_code = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Optional secondary code (e.g. payroll code).",
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True, default="")
    photo = models.ImageField(
        upload_to="employee_photos/",
        blank=True,
        null=True,
    )

    # ---------------------------------------------------------
    # PERSONAL
    # ---------------------------------------------------------
    gender = models.CharField(
        max_length=20, choices=Gender.choices, blank=True, default="",
    )
    dob = models.DateField(null=True, blank=True)
    blood_group = models.CharField(max_length=5, blank=True, default="")
    marital_status = models.CharField(
        max_length=20, choices=MaritalStatus.choices, blank=True, default="",
    )

    # ---------------------------------------------------------
    # CONTACT
    # ---------------------------------------------------------
    mobile = models.CharField(max_length=20, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    emergency_contact_name = models.CharField(
        max_length=150, blank=True, default=""
    )
    emergency_contact_number = models.CharField(
        max_length=20, blank=True, default=""
    )

    # ---------------------------------------------------------
    # EMPLOYMENT
    # ---------------------------------------------------------
    department = models.CharField(
        max_length=50, choices=Department.choices, blank=True, default="",
    )
    designation = models.CharField(max_length=100, blank=True, default="")
    branch = models.CharField(max_length=150, blank=True, default="")
    employment_type = models.CharField(
        max_length=20, choices=EmploymentType.choices, blank=True, default="",
    )
    employment_status = models.CharField(
        max_length=20,
        choices=EmploymentStatus.choices,
        default=EmploymentStatus.ACTIVE,
    )
    reporting_manager = models.CharField(
        max_length=150, blank=True, default=""
    )
    work_location = models.CharField(max_length=150, blank=True, default="")
    joining_date = models.DateField(null=True, blank=True)

    # ---------------------------------------------------------
    # ADDRESS
    # ---------------------------------------------------------
    address_line1 = models.CharField(max_length=255, blank=True, default="")
    address_line2 = models.CharField(max_length=255, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="India")
    state = models.CharField(max_length=100, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    district = models.CharField(max_length=100, blank=True, default="")
    pincode = models.CharField(max_length=10, blank=True, default="")

    # ---------------------------------------------------------
    # STATUTORY
    # ---------------------------------------------------------
    aadhaar = models.CharField(max_length=20, blank=True, default="")
    pan = models.CharField(max_length=20, blank=True, default="")
    uan = models.CharField(max_length=20, blank=True, default="")
    pf = models.CharField(max_length=20, blank=True, default="")
    esi = models.CharField(max_length=20, blank=True, default="")
    passport = models.CharField(max_length=20, blank=True, default="")
    driving_license = models.CharField(max_length=20, blank=True, default="")

    # ---------------------------------------------------------
    # JSON COLLECTIONS (match frontend shape exactly)
    # ---------------------------------------------------------
    skills = models.JSONField(default=list, blank=True)
    education = models.JSONField(default=list, blank=True)
    experience = models.JSONField(default=list, blank=True)
    bank_details = models.JSONField(default=dict, blank=True)
    documents = models.JSONField(default=list, blank=True)
    employment_history = models.JSONField(default=list, blank=True)

    # ---------------------------------------------------------
    # LIFECYCLE
    # ---------------------------------------------------------
    archived = models.BooleanField(default=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employee",
        help_text="Linked User account. Set on first profile lookup.",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_employees",
    )

    # ---------------------------------------------------------
    # AUDIT
    # ---------------------------------------------------------
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_employees",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["archived"]),
            models.Index(fields=["employee_id"]),
            models.Index(fields=["department"]),
            models.Index(fields=["city"]),
            models.Index(fields=["employment_status"]),
        ]

    def __str__(self):
        return f"{self.employee_id} — {self.first_name} {self.last_name}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()


class EmployeeCodeSettings(models.Model):
    
    prefix = models.CharField(max_length=20, default="EMP")
    next_number = models.PositiveIntegerField(default=1)
    number_padding = models.PositiveIntegerField(default=3)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.prefix}{self.next_number:0{self.number_padding}d}"

# salary and advance


from django.db import models
from django.core.validators import MinValueValidator


class SalaryPayment(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("PAID", "Paid"),
        ("PARTIALLY_PAID", "Partially Paid"),
    ]

    employee = models.ForeignKey(
        "Employee",
        on_delete=models.PROTECT,
        related_name="salary_payments",
    )

    salary_month = models.DateField()
    salary_year = models.PositiveIntegerField()

    base_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    attendance_wage = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    allowances = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    overtime = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    gross_earnings = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    pf = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    esi = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    tax = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    other_deductions = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    advance_deduction = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    total_deductions = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    net_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default="PENDING",
    )

    paid_date = models.DateField(
        null=True,
        blank=True,
    )

    remarks = models.TextField(
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "salary_payment"
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "salary_month"],
                name="unique_employee_salary_month",
            )
        ]
        ordering = ["-salary_month", "-created_at"]

    def __str__(self):
        return f"{self.employee} - {self.salary_month}"



class Advance(models.Model):
    STATUS_CHOICES = [
        ("OUTSTANDING", "Outstanding"),
        ("PARTIALLY_REPAID", "Partially Repaid"),
        ("FULLY_REPAID", "Fully Repaid"),
    ]

    employee = models.ForeignKey(
        "Employee",
        on_delete=models.PROTECT,
        related_name="salary_advances",
    )

    advance_date = models.DateField()

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )

    total_repaid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    outstanding_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    reason = models.TextField(
        blank=True,
        default="",
    )

    remarks = models.TextField(
        blank=True,
        default="",
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="OUTSTANDING",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "advance"
        ordering = ["-advance_date", "-created_at"]

    def __str__(self):
        return f"{self.employee} - ₹{self.amount}"



class AdvanceRepayment(models.Model):
    advance = models.ForeignKey(
        Advance,
        on_delete=models.PROTECT,
        related_name="repayments",
    )

    employee = models.ForeignKey(
        "Employee",
        on_delete=models.PROTECT,
        related_name="advance_repayments",
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )

    salary_payment = models.ForeignKey(
        SalaryPayment,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="advance_repayments",
    )

    date = models.DateField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "advance_repayment"
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.employee} - ₹{self.amount}"





from decimal import Decimal

from django.db import models
from django.core.validators import MinValueValidator


class WageConfig(models.Model):
    SALARY_TYPE_CHOICES = [
        ("HOURLY", "Hourly Wage"),
        ("MONTHLY", "Monthly Salary"),
    ]

    LEAVE_POLICY_CHOICES = [
        ("UNPAID", "Unpaid"),
        ("FULL_DAY", "Paid Full Day"),
    ]

    employee = models.OneToOneField(
        "Employee",
        on_delete=models.PROTECT,
        related_name="wage_configuration",
    )

    salary_type = models.CharField(
        max_length=20,
        choices=SALARY_TYPE_CHOICES,
        default="HOURLY",
    )

    hourly_rate = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[
            MinValueValidator(Decimal("0"))
        ],
    )

    monthly_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[
            MinValueValidator(Decimal("0"))
        ],
    )

    standard_hours_per_day = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=8,
        validators=[
            MinValueValidator(Decimal("0"))
        ],
    )

    paid_leave_policy = models.CharField(
        max_length=20,
        choices=LEAVE_POLICY_CHOICES,
        default="UNPAID",
    )

    holiday_policy = models.CharField(
        max_length=20,
        choices=LEAVE_POLICY_CHOICES,
        default="UNPAID",
    )

    weekly_off_policy = models.CharField(
        max_length=20,
        choices=LEAVE_POLICY_CHOICES,
        default="UNPAID",
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        db_table = "wage_configuration"

    def __str__(self):
        return (
            f"{self.employee.employee_id} - "
            f"{self.salary_type}"
        )


class Attendance(models.Model):

    STATUS_CHOICES = [
        ("PRESENT", "Present"),
        ("HALF_DAY", "Half Day"),
        ("ABSENT", "Absent"),
        ("PAID_LEAVE", "Paid Leave"),
        ("UNPAID_LEAVE", "Unpaid Leave"),
        ("HOLIDAY", "Holiday"),
        ("WEEKLY_OFF", "Weekly Off"),
        ("WFH", "Work From Home"),
    ]

    employee = models.ForeignKey(
        "Employee",
        on_delete=models.PROTECT,
        related_name="attendance_records",
    )

    date = models.DateField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
    )

    login_time = models.TimeField(
        null=True,
        blank=True,
    )

    logout_time = models.TimeField(
        null=True,
        blank=True,
    )

    break_hours = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[
            MinValueValidator(Decimal("0"))
        ],
    )

    working_hours = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        validators=[
            MinValueValidator(Decimal("0"))
        ],
    )

    hourly_rate = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[
            MinValueValidator(Decimal("0"))
        ],
    )

    daily_wage = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[
            MinValueValidator(Decimal("0"))
        ],
    )

    remarks = models.TextField(
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        db_table = "attendance_record"

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "employee",
                    "date",
                ],
                name="unique_employee_attendance_date",
            )
        ]

        indexes = [
            models.Index(
                fields=[
                    "employee",
                    "date",
                ]
            ),
            models.Index(
                fields=["date"]
            ),
            models.Index(
                fields=["status"]
            ),
        ]

        ordering = [
            "-date",
            "employee__employee_id",
        ]

    def __str__(self):
        return (
            f"{self.employee.employee_id} - "
            f"{self.date} - "
            f"{self.status}"
        )




# for purchase order description
class PurchaseOrderItem(models.Model):

    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="po_items",
    )

    po_number = models.CharField(
        max_length=100,
        db_index=True,
        null=True,
        blank=True,
    )

    item_code = models.CharField(
        max_length=100,
    )

    description = models.TextField(
        blank=True,
        default="",
    )

    material = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    material_code = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    material_spec = models.CharField(
        max_length=200,
        blank=True,
        default="",
    )

    quantity = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    unit = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    unit_weight = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        null=True,
        blank=True,
    )

    length = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    width = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    thickness = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

        constraints = [
            models.UniqueConstraint(
                fields=["purchase_order", "item_code"],
                name="unique_po_item_code",
            )
        ]

    def __str__(self):
        return f"{self.po_number} - {self.description}"


class ConsumableGRN(models.Model):

    class GRNType(models.TextChoices):
        PO = "PO", "Purchase Order"
        DIRECT = "DIRECT", "Direct"

    class Status(models.TextChoices):
        PENDING = "Pending", "Pending"
        PARTIALLY_RECEIVED = "Partially Received", "Partially Received"
        FULLY_RECEIVED = "Fully Received", "Fully Received"

    WAREHOUSE_CHOICES = [
        ("Unit One", "Unit One"),
        ("Unit Two", "Unit Two"),
    ]

    grn_number = models.CharField(max_length=100, unique=True)

    grn_type = models.CharField(
        max_length=20,
        choices=GRNType.choices,
        default=GRNType.PO,
    )

    purchase_order_item = models.ForeignKey(
        PurchaseOrderItem,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="grns",
    )

    po_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
    )

    po_description = models.TextField(
        blank=True,
        default="",
    )

    supplier = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    consumable_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    category = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    unit = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    ordered_quantity = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    received_quantity = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    pending_quantity = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    warehouse = models.CharField(
        max_length=50,
        choices=WAREHOUSE_CHOICES,
        blank=True,
        default="",
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING,
    )

    received_by = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    remarks = models.TextField(
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.grn_number} - {self.po_number}"


class ConsumableIssue(models.Model):

    class Status(models.TextChoices):
        ISSUED = "Issued", "Issued"
        PARTIALLY_RETURNED = "Partially Returned", "Partially Returned"
        FULLY_RETURNED = "Fully Returned", "Fully Returned"

    issue_number = models.CharField(max_length=100, unique=True)

    # Which GRN line the stock came out of.
    # Ties the issue back to a specific (PO, description, warehouse).
    grn = models.ForeignKey(
        ConsumableGRN,
        on_delete=models.PROTECT,
        related_name="issues",
    )

    po_number = models.CharField(
        max_length=100, blank=True, default="", db_index=True,
    )
    po_description = models.TextField(blank=True, default="")
    consumable_name = models.CharField(max_length=255, blank=True, default="")
    category = models.CharField(max_length=100, blank=True, default="")
    unit = models.CharField(max_length=50, blank=True, default="")
    warehouse = models.CharField(max_length=50, blank=True, default="")

    # The issue itself
    quantity_issued = models.DecimalField(
        max_digits=15, decimal_places=3, default=0,
    )

    # Overall lifecycle status (stored, updated on every return)
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.ISSUED,
        db_index=True,
    )

    # Where it went
    department = models.CharField(max_length=150, blank=True, default="")
    employee_name = models.CharField(max_length=255, blank=True, default="")
    job_card = models.CharField(max_length=150, blank=True, default="")
    remarks = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["grn"]),
            models.Index(fields=["po_number"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return (
            f"{self.issue_number} — "
            f"{self.consumable_name} — "
            f"{self.quantity_issued}"
        )

class ConsumableReturn(models.Model):
    

    return_number = models.CharField(max_length=100, unique=True)

    issue = models.ForeignKey(
        ConsumableIssue,
        on_delete=models.PROTECT,
        related_name="returns",
    )

    # Snapshot fields (kept for readability / reports even if the
    # issue row is later edited)
    issue_number = models.CharField(max_length=100, blank=True, default="", db_index=True)
    consumable_name = models.CharField(max_length=255, blank=True, default="")
    unit = models.CharField(max_length=50, blank=True, default="")
    warehouse = models.CharField(max_length=50, blank=True, default="")

    quantity_returned = models.DecimalField(
        max_digits=15, decimal_places=3, default=0,
    )

    returned_by = models.CharField(max_length=255, blank=True, default="")
    remarks = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["issue"]),
            models.Index(fields=["issue_number"]),
        ]

    def __str__(self):
        return (
            f"{self.return_number} — "
            f"{self.consumable_name} — "
            f"{self.quantity_returned}"
        )



#for material drwbom
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator
from django.conf import settings


class Project(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "Active", "Active"
        ON_HOLD = "On Hold", "On Hold"
        COMPLETED = "Completed", "Completed"

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=100, unique=True, db_index=True)
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Drawing(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="drawings",
    )
    dwg_number = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255)
    revision = models.CharField(max_length=50, default="REV-00")
    date = models.DateField(null=True, blank=True)
    file = models.CharField(max_length=255, blank=True, default="")
    remarks = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "dwg_number", "revision"],
                name="unique_project_drawing_revision",
            )
        ]

    def __str__(self):
        return f"{self.dwg_number} - {self.name} ({self.revision})"
class BOMItem(models.Model):
    drawing = models.ForeignKey(
        Drawing,
        on_delete=models.CASCADE,
        related_name="bom_items",
    )
    variant_number = models.CharField(max_length=50, blank=True, default="")
    item_number = models.CharField(max_length=50, blank=True, default="")
    description = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Structured description e.g. "
            '{"material_type": "Plate", "thickness": 6, "length": 530, "width": 530}'
        ),
    )
    std = models.CharField(max_length=100, blank=True, default="-")
    drawing_number = models.CharField(max_length=100, blank=True, default="-")
    item_no = models.CharField(max_length=50, blank=True, default="")
    var_no = models.CharField(max_length=50, blank=True, default="-")
    material_code = models.CharField(max_length=100, db_index=True)
    material_specn = models.CharField(max_length=200, blank=True, default="")
    acp = models.CharField(max_length=50, blank=True, default="-")
    di = models.CharField(max_length=50, blank=True, default="-")
    unit = models.CharField(max_length=30, default="Nos")
    unit_weight = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal("0.000"),
        validators=[MinValueValidator(Decimal("0.000"))],
        help_text="Informational only. Not used for stock consumption.",
    )
    quantity = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=Decimal("1.000"),
        validators=[MinValueValidator(Decimal("0.001"))],
        help_text="Controlling quantity for material requirements.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        d = self.description or {}
        mt = d.get("material_type") or d.get("materialType") or ""
        t, l, w = d.get("thickness"), d.get("length"), d.get("width")
        dims = "x".join(str(v) for v in (t, l, w) if v not in (None, ""))
        label = " ".join(p for p in [mt, dims] if p) or "BOM Item"
        return f"{label} ({self.quantity} {self.unit})"


class BOMPOIntegration(models.Model):

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="po_integrations",
        null=True,
        blank=True,
    )

    bom_item = models.ForeignKey(
        BOMItem,
        on_delete=models.PROTECT,
        related_name="po_integrations",
        null=True,
        blank=True,
    )

    # Real PO line — nullable now
    purchase_order_item = models.ForeignKey(
        PurchaseOrderItem,
        on_delete=models.PROTECT,
        related_name="bom_integrations",
        null=True,
        blank=True,
    )

    # Dummy PO line — nullable
    dummy_purchase_order_item = models.ForeignKey(
        DummyPurchaseOrderItem,
        on_delete=models.PROTECT,
        related_name="integrations",
        null=True,
        blank=True,
    )

    quantity = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )

    is_dummy = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # Exactly one of the two item FKs must be set
            models.CheckConstraint(
                condition=(
                    models.Q(purchase_order_item__isnull=False,
                             dummy_purchase_order_item__isnull=True)
                    | models.Q(purchase_order_item__isnull=True,
                               dummy_purchase_order_item__isnull=False)
                ),
                name="bompo_exactly_one_item",
            ),
        ]

    def __str__(self):
        item = self.purchase_order_item or self.dummy_purchase_order_item
        if not item:
            return f"integration #{self.pk}"
        return f"{item} - {self.quantity}"


#FOR MATERIAL GRN


class MaterialGRN(models.Model):
    """
    One GRN event for a PO item (real or dummy).

    - No project FK, no DWG/BOM FK, no inspection fields.
    - Snapshot fields (po_number, description, material) so the
      history row reads correctly even if the PO item is edited.
    - Received quantity is the only "receipt" number stored.
      Balance is never stored — it is always computed as
      (PurchaseOrderItem.quantity - SUM(MaterialGRN.received_qty)).
    """

    grn_number = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
    )

    grn_date = models.DateField(
        auto_now_add=True,
    )

    # ---- Real PO line (nullable) ----
    purchase_order_item = models.ForeignKey(
        PurchaseOrderItem,
        on_delete=models.PROTECT,
        related_name="material_grns",
        null=True,
        blank=True,
    )

    # ---- Dummy PO line (nullable) ----
    dummy_purchase_order_item = models.ForeignKey(
        DummyPurchaseOrderItem,
        on_delete=models.PROTECT,
        related_name="material_grns",
        null=True,
        blank=True,
    )

    # ---- Snapshot fields ----
    po_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
    )

    description = models.CharField(
        max_length=500,
        blank=True,
        default="",
    )

    material = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    # ---- Receipt payload ----
    receiving_unit = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    received_qty = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    received_by = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    remarks = models.TextField(
        blank=True,
        default="",
    )

    # ---- Audit ----
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="material_grns_created",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["purchase_order_item"]),
            models.Index(fields=["dummy_purchase_order_item"]),
            models.Index(fields=["grn_number"]),
            models.Index(fields=["po_number"]),
        ]
        constraints = [
            # Exactly one of the two item FKs must be set
            models.CheckConstraint(
                condition=(
                    models.Q(
                        purchase_order_item__isnull=False,
                        dummy_purchase_order_item__isnull=True,
                    )
                    | models.Q(
                        purchase_order_item__isnull=True,
                        dummy_purchase_order_item__isnull=False,
                    )
                ),
                name="materialgrn_exactly_one_item",
            ),
        ]

    def __str__(self):
        return f"{self.grn_number} · {self.po_number} · {self.description}"
#FOR MATERIAL GRN NUMBER SETTINGS

class MaterialGRNNumberSettings(models.Model):
    """
    Matches the pattern of every other *NumberSettings model
    in this codebase (PO, QTN, DC, TI, PI, Employee).

    Guarantees concurrency-safe GRN numbering: the row is locked
    with select_for_update() during generation.
    """

    prefix = models.CharField(
        max_length=20,
        default="GRN",
    )

    next_number = models.PositiveIntegerField(
        default=1,
    )

    number_padding = models.PositiveIntegerField(
        default=4,
    )

    is_active = models.BooleanField(
        default=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return (
            f"{self.prefix}"
            f"{self.next_number:0{self.number_padding}d}"
        )


# =====================================================================
# MATERIAL STOCK
# -----------------------------------------------------------------
# One MaterialStock row per physical lot sitting in the yard.
#
# Available quantity is NEVER stored — it is always computed as:
#
#     original_qty
#       + SUM(movements where direction = IN)
#       - SUM(movements where direction = OUT)
#
# Every flow (GRN, issue, job return, cutting, rework)
# writes a MaterialStockMovement row.
# =====================================================================

from django.db.models import Sum 
class MaterialStock(models.Model):

    class SourceType(models.TextChoices):
        PO = "PO", "PO"
        DUMMY_PO = "Dummy PO", "Dummy PO"
        JOB_REMAINING = "Job Remaining", "Job Remaining"
        CUTTING_REMAINING = "Cutting Remaining", "Cutting Remaining"
        REWORK = "Rework", "Rework"
        OTHER = "Other", "Other"

    class StockStatus(models.TextChoices):
        AVAILABLE = "Available", "Available"
        PARTIALLY_USED = "Partially Used", "Partially Used"
        REMAINING = "Remaining", "Remaining"
        CUTTING_REMAINING = "Cutting Remaining", "Cutting Remaining"

    class Warehouse(models.TextChoices):
        UNIT_1 = "Unit 1", "Unit 1"
        UNIT_2 = "Unit 2", "Unit 2"

    # ---- Identity ----
    stock_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )

    unit = models.CharField(
        max_length=50,
        choices=Warehouse.choices,
        default=Warehouse.UNIT_1,
    )

    source_type = models.CharField(
        max_length=30,
        choices=SourceType.choices,
        default=SourceType.PO,
    )

    # ---- Link back to where this lot came from ----
    material_grn = models.ForeignKey(
        "MaterialGRN",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_lots",
    )

    purchase_order_item = models.ForeignKey(
        "PurchaseOrderItem",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_lots",
    )

    dummy_purchase_order_item = models.ForeignKey(
        "DummyPurchaseOrderItem",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_lots",
    )

    # ---- Snapshot fields ----
    po_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
    )

    description = models.CharField(
        max_length=500,
        blank=True,
        default="",
    )

    material = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    material_code = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    material_spec = models.CharField(
        max_length=200,
        blank=True,
        default="",
    )

    # ---- Dimensions ----
    thickness = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    length = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    width = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )
    # Stores the actual weight separately from stock quantity.
    weight = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    # ---- Traceability ----
    heat_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    plate_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    # ---- Quantity ----
    original_qty = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    uom = models.CharField(
        max_length=20,
        blank=True,
        default="Nos",
    )

    # ---- Project / drawing context ----
    project = models.ForeignKey(
        "Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_lots",
    )

    dwg_description = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    revision = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    # ---- Status / lifecycle ----
    stock_status = models.CharField(
        max_length=30,
        choices=StockStatus.choices,
        default=StockStatus.AVAILABLE,
    )

    rework_required = models.BooleanField(
        default=False,
    )

    remarks = models.TextField(
        blank=True,
        default="",
    )

    # ---- Audit ----
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="material_stock_created",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["stock_id"]),
            models.Index(fields=["unit"]),
            models.Index(fields=["source_type"]),
            models.Index(fields=["po_number"]),
            models.Index(fields=["stock_status"]),
        ]

    def __str__(self):
        return f"{self.stock_id} · {self.po_number} · {self.description}"

    # -------------------------------------------------------------
    # COMPUTED AVAILABLE QUANTITY
    # -------------------------------------------------------------
    @property
    def available_qty(self):
        agg = self.movements.aggregate(
            total_in=Sum(
                "quantity",
                filter=models.Q(direction=MaterialStockMovement.Direction.IN),
            ),
            total_out=Sum(
                "quantity",
                filter=models.Q(direction=MaterialStockMovement.Direction.OUT),
            ),
        )
        total_in = agg["total_in"] or Decimal("0")
        total_out = agg["total_out"] or Decimal("0")
        return self.original_qty + total_in - total_out


class MaterialStockMovement(models.Model):
    """
    Every change to a MaterialStock lot.

    IN  → returned from job work, cutting balance, rework return
    OUT → issued to job work, issued to production, scrapped
    """

    class Direction(models.TextChoices):
        IN = "IN", "In"
        OUT = "OUT", "Out"

    class MovementType(models.TextChoices):
        GRN = "GRN", "Goods Receipt"
        ISSUE_JOB_WORK = "Issue Job Work", "Issue to Job Work"
        RETURN_JOB_WORK = "Return Job Work", "Return from Job Work"
        ISSUE_PRODUCTION = "Issue Production", "Issue to Production"
        CUTTING = "Cutting", "Cutting"
        REWORK = "Rework", "Rework"
        SCRAP = "Scrap", "Scrap"
        ADJUSTMENT = "Adjustment", "Manual Adjustment"

    stock = models.ForeignKey(
        MaterialStock,
        on_delete=models.CASCADE,
        related_name="movements",
    )

    direction = models.CharField(
        max_length=5,
        choices=Direction.choices,
    )

    movement_type = models.CharField(
        max_length=30,
        choices=MovementType.choices,
    )

    quantity = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    # Optional link to the downstream record (issue, return, etc.)
    reference_type = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    reference_id = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    remarks = models.TextField(
        blank=True,
        default="",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="material_stock_movements",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["stock"]),
            models.Index(fields=["direction"]),
            models.Index(fields=["movement_type"]),
        ]

    def __str__(self):
        return (
            f"{self.stock.stock_id} · "
            f"{self.direction} · "
            f"{self.quantity}"
        )




# =====================================================================
# ISSUE TO JOB WORK
# -----------------------------------------------------------------
# One row per issue event. The stock side is recorded as an OUT
# MaterialStockMovement on the source lot — this model is the audit
# record of the issue itself.
# =====================================================================

class JobWorkIssue(models.Model):

    class JobWorkType(models.TextChoices):
        IN_HOUSE = "In-House", "In-House"
        OUTSOURCING = "Outsourcing", "Outsourcing"

    class Status(models.TextChoices):
        ISSUED = "Issued", "Issued"
        PARTIALLY_RETURNED = "Partially Returned", "Partially Returned"
        FULLY_RETURNED = "Fully Returned", "Fully Returned"
        CANCELLED = "Cancelled", "Cancelled"

    # ---- Identity ----
    issue_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )

    issue_date = models.DateField(
        auto_now_add=True,
    )

    # ---- Link back to the stock lot ----
    stock = models.ForeignKey(
        MaterialStock,
        on_delete=models.PROTECT,
        related_name="job_work_issues",
    )

    # ---- Snapshot fields (survive stock edits) ----
    po_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
    )

    description = models.CharField(
        max_length=500,
        blank=True,
        default="",
    )

    material = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    material_code = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    material_spec = models.CharField(
        max_length=200,
        blank=True,
        default="",
    )

    thickness = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    length = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    width = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    uom = models.CharField(
        max_length=20,
        blank=True,
        default="Nos",
    )

    # ---- Project context ----
    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="job_work_issues",
    )

    dwg_description = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    revision = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    # ---- Job work details ----
    job_work_type = models.CharField(
        max_length=20,
        choices=JobWorkType.choices,
        default=JobWorkType.IN_HOUSE,
    )

    process_name = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    process_id = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    # In-House
    job_work_unit = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    # Outsourcing
    vendor = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    vendor_contact = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    job_work_location = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    expected_return_date = models.DateField(
        null=True,
        blank=True,
    )

    # ---- Quantities ----
    quantity_issued = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    quantity_returned = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    # ---- People ----
    issued_by = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    remarks = models.TextField(
        blank=True,
        default="",
    )

    # ---- Status ----
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.ISSUED,
    )

    # ---- Audit ----
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="job_work_issues_created",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["issue_number"]),
            models.Index(fields=["stock"]),
            models.Index(fields=["po_number"]),
            models.Index(fields=["job_work_type"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.issue_number} · {self.po_number} · {self.quantity_issued}"


class JobWorkProcess(models.Model):
    """
    Master list of process names used on the Issue to Job Work page.
    Users can add new ones from the modal.
    """

    name = models.CharField(
        max_length=150,
    )

    process_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.process_id})"


class JobWorkIssueNumberSettings(models.Model):
    """
    Concurrency-safe issuer counter — matches the pattern used
    everywhere else in this codebase.
    """

    prefix = models.CharField(
        max_length=20,
        default="ISS",
    )

    next_number = models.PositiveIntegerField(
        default=1,
    )

    number_padding = models.PositiveIntegerField(
        default=3,
    )

    is_active = models.BooleanField(
        default=True,
    )

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return (
            f"{self.prefix}"
            f"{self.next_number:0{self.number_padding}d}"
        )


# =====================================================================
# RECEIVE FROM JOB WORK
# -----------------------------------------------------------------
# One row per receive event against a JobWorkIssue. Tracks:
#   - how much of the original input material came back completed
#   - what pieces were actually produced (per-piece detail)
#   - what remained unprocessed + whether it needs rework
#
# The physical stock side is written as MaterialStockMovement rows:
#   - IN  movement  on the parent lot for returned input
#   - IN  movement  on the parent lot for returned input material
#   - new lots created for pieces (source_type = JOB_REMAINING) when needed
# =====================================================================


class JobWorkReceive(models.Model):
    """
    One receipt against a JobWorkIssue.
    Multiple receipts are allowed — each is a partial return.
    """

    # ---- Identity ----
    receive_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )

    receive_date = models.DateField(
        auto_now_add=True,
    )

    # ---- Link to the issue ----
    issue = models.ForeignKey(
        JobWorkIssue,
        on_delete=models.PROTECT,
        related_name="receives",
    )

    # ---- Snapshot fields ----
    job_work_id = models.CharField(
        max_length=50,
        blank=True,
        default="",
        db_index=True,
    )

    po_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    description = models.CharField(
        max_length=500,
        blank=True,
        default="",
    )

    material = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    material_code = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    material_spec = models.CharField(
        max_length=200,
        blank=True,
        default="",
    )

    thickness = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    length = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    width = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    uom = models.CharField(
        max_length=20,
        blank=True,
        default="Nos",
    )

    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="job_work_receives",
    )

    dwg_description = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    revision = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    process_name = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    process_id = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    # ---- Quantities ----
    completed_input_qty = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    remaining_input_qty = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    total_output_qty = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    total_output_weight = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    total_remaining_weight = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    # ---- People / notes ----
    received_by = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    remarks = models.TextField(
        blank=True,
        default="",
    )

    # ---- Audit ----
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="job_work_receives_created",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["receive_number"]),
            models.Index(fields=["issue"]),
            models.Index(fields=["job_work_id"]),
            models.Index(fields=["po_number"]),
        ]

    def __str__(self):
        return f"{self.receive_number} · {self.job_work_id} · {self.completed_input_qty}"


class JobWorkReceivePiece(models.Model):
    """
    One produced output piece, per receive.
    """

    receive = models.ForeignKey(
        JobWorkReceive,
        on_delete=models.CASCADE,
        related_name="output_pieces",
    )

    piece_no = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    length = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    width = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    thickness = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    qty = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    weight = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    remarks = models.TextField(
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.piece_no} ({self.qty})"


class JobWorkReceiveRemaining(models.Model):
    """
    One remaining input piece, per receive.
    """

    class ReworkChoice(models.TextChoices):
        YES = "Yes", "Yes"
        NO = "No", "No"

    receive = models.ForeignKey(
        JobWorkReceive,
        on_delete=models.CASCADE,
        related_name="remaining_pieces",
    )

    plate_no = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    length = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    width = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    thickness = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    weight = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    remarks = models.TextField(
        blank=True,
        default="",
    )

    rework_required = models.CharField(
        max_length=10,
        choices=ReworkChoice.choices,
        default=ReworkChoice.NO,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.plate_no} ({self.rework_required})"


class JobWorkReceiveNumberSettings(models.Model):
    """
    Concurrency-safe counter for receive numbers.
    """

    prefix = models.CharField(
        max_length=20,
        default="JWR",
    )

    next_number = models.PositiveIntegerField(
        default=1,
    )

    number_padding = models.PositiveIntegerField(
        default=4,
    )

    is_active = models.BooleanField(
        default=True,
    )

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return (
            f"{self.prefix}"
            f"{self.next_number:0{self.number_padding}d}"
        )
    

# =====================================================================
# ISSUE TO PRODUCTION
# -----------------------------------------------------------------
# One row per issue event against a JobWorkReceivePiece (the physical
# piece that came back from Job Work). An issue consumes that piece's
# remaining available quantity.
#
# Stock side: one OUT MaterialStockMovement on the piece's lot.
# =====================================================================


class ProductionIssue(models.Model):
    """
    One issue of a received Job Work piece into production.
    Multiple issues per piece are allowed (partial issues).
    """

    class Status(models.TextChoices):
        ISSUED = "Issued", "Issued"
        IN_PRODUCTION = "In Production", "In Production"
        COMPLETED = "Completed", "Completed"
        CANCELLED = "Cancelled", "Cancelled"

    # ---- Identity ----
    issue_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )

    issue_date = models.DateField(
        auto_now_add=True,
    )

    # ---- Link back to the source ----
    job_work_receive = models.ForeignKey(
        JobWorkReceive,
        on_delete=models.PROTECT,
        related_name="production_issues",
    )

    job_work_piece = models.ForeignKey(
        JobWorkReceivePiece,
        on_delete=models.PROTECT,
        related_name="production_issues",
        null=True,
        blank=True,
        help_text=(
            "The specific piece this issue was drawn from. Nullable for "
            "legacy rows created before piece-level tracking was added."
        ),
    )

    material_stock = models.ForeignKey(
        "MaterialStock",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="production_issues",
        help_text=(
            "The stock lot the piece corresponds to. Set at create time "
            "if a lot was created for this piece."
        ),
    )

    # ---- Snapshot fields ----
    job_work_id = models.CharField(
        max_length=50,
        blank=True,
        default="",
        db_index=True,
    )

    po_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
    )

    po_type = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    supplier = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    description = models.CharField(
        max_length=500,
        blank=True,
        default="",
    )

    material = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    material_code = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    material_spec = models.CharField(
        max_length=200,
        blank=True,
        default="",
    )

    thickness = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    length = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    width = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    unit = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    job_work_type = models.CharField(
        max_length=30,
        blank=True,
        default="",
    )

    job_work_unit = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    process_name = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    process_id = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="production_issues",
    )

    dwg_description = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    revision = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    # ---- Piece identity (snapshot) ----
    piece_no = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    uom = models.CharField(
        max_length=20,
        blank=True,
        default="Nos",
    )

    # ---- Quantities ----
    original_received_qty = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    previously_issued_qty = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    issued_qty = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    remaining_available_qty = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    # ---- People ----
    issued_by = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    remarks = models.TextField(
        blank=True,
        default="",
    )

    # ---- Status ----
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.ISSUED,
    )

    # ---- Audit ----
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="production_issues_created",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["issue_number"]),
            models.Index(fields=["job_work_receive"]),
            models.Index(fields=["job_work_piece"]),
            models.Index(fields=["job_work_id"]),
            models.Index(fields=["po_number"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return (
            f"{self.issue_number} · "
            f"{self.job_work_id} · "
            f"{self.issued_qty}"
        )


class ProductionIssueNumberSettings(models.Model):
    """
    Concurrency-safe counter for Production Issue numbers.
    """

    prefix = models.CharField(
        max_length=20,
        default="IP",
    )

    next_number = models.PositiveIntegerField(
        default=1,
    )

    number_padding = models.PositiveIntegerField(
        default=4,
    )

    is_active = models.BooleanField(
        default=True,
    )

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return (
            f"{self.prefix}"
            f"{self.next_number:0{self.number_padding}d}"
        )



# =====================================================================
# PRODUCTION ASSEMBLY INTEGRATION
# -----------------------------------------------------------------
# An Assembly is a PLANNED combination of:
#   - production materials (physical pieces that came back from Job Work)
#   - previously-created assemblies
# plus a process route with per-step execution config (In-House/Outsourcing).
#
# Assemblies do NOT execute production. They only describe what will be built.
# Production Operation (future module) walks an assembly through its route.
# =====================================================================


class Assembly(models.Model):

    class Status(models.TextChoices):
        PLANNED = "Planned", "Planned"
        IN_PROGRESS = "In Progress", "In Progress"
        COMPLETED = "Completed", "Completed"
        CANCELLED = "Cancelled", "Cancelled"

    # ---- Identity ----
    assembly_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )

    project = models.ForeignKey(
        "Project",
        on_delete=models.PROTECT,
        related_name="assemblies",
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PLANNED,
    )

    # ---- Snapshot for reporting ----
    dwg_description = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    notes = models.TextField(
        blank=True,
        default="",
    )

    # ---- Audit ----
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assemblies_created",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["assembly_id"]),
            models.Index(fields=["project"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.assembly_id} ({self.project.name})"


class AssemblyInput(models.Model):
    """
    One input line of an assembly — either a physical production material
    (from a JobWorkReceivePiece) or a previously-created Assembly.
    Exactly one of the two FKs must be set.
    """

    class SourceType(models.TextChoices):
        MATERIAL = "material", "Material"
        ASSEMBLY = "assembly", "Assembly"

    assembly = models.ForeignKey(
        Assembly,
        on_delete=models.CASCADE,
        related_name="inputs",
    )

    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
    )

    # Real material input
    job_work_piece = models.ForeignKey(
        "JobWorkReceivePiece",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="assembly_inputs",
    )

    # Nested assembly input
    source_assembly = models.ForeignKey(
        Assembly,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="used_by_inputs",
    )

    use_qty = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
    )

    # ---- Snapshot fields ----
    material_name = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    material_code = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    unit = models.CharField(
        max_length=30,
        blank=True,
        default="Nos",
    )

    thickness = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    length = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    width = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    drawing_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        source_type="material",
                        job_work_piece__isnull=False,
                        source_assembly__isnull=True,
                    )
                    | models.Q(
                        source_type="assembly",
                        source_assembly__isnull=False,
                        job_work_piece__isnull=True,
                    )
                ),
                name="assembly_input_exactly_one_source",
            ),
        ]

    def __str__(self):
        return (
            f"{self.assembly.assembly_id} · "
            f"{self.source_type} · {self.use_qty}"
        )


class AssemblyProcess(models.Model):

    class ExecutionType(models.TextChoices):
        IN_HOUSE = "In-House", "In-House"
        OUTSOURCING = "Outsourcing", "Outsourcing"

    assembly = models.ForeignKey(
        Assembly,
        on_delete=models.CASCADE,
        related_name="processes",
    )

    sequence = models.PositiveIntegerField(default=1)

    name = models.CharField(max_length=150)

    process_id = models.CharField(max_length=50)

    qc_required = models.BooleanField(default=False)

    execution_type = models.CharField(
        max_length=20,
        choices=ExecutionType.choices,
        default=ExecutionType.IN_HOUSE,
    )

    execution_unit = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    # Outsourcing fields (nullable when In-House)
    vendor = models.CharField(max_length=255, blank=True, default="")
    vendor_contact = models.CharField(max_length=100, blank=True, default="")
    vendor_location = models.CharField(max_length=255, blank=True, default="")
    expected_return_date = models.DateField(null=True, blank=True)
    outsourcing_remarks = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sequence", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["assembly", "sequence"],
                name="assembly_process_unique_sequence",
            ),
        ]

    def __str__(self):
        return f"{self.assembly.assembly_id} · {self.sequence}. {self.name}"


class AssemblyNumberSettings(models.Model):
    prefix = models.CharField(max_length=20, default="ASM")
    next_number = models.PositiveIntegerField(default=1)
    number_padding = models.PositiveIntegerField(default=3)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["is_active"],
                condition=models.Q(is_active=True),
                name="assemblynumbersettings_single_active",
            ),
        ]

    def __str__(self):
        return f"{self.prefix}{self.next_number:0{self.number_padding}d}"



# =====================================================================
# PRODUCTION OPERATION
# -----------------------------------------------------------------
# Execution layer that walks an Assembly through its process route.
#
# An Assembly is a PLAN. Production Operation is what actually records:
#   - who started/completed each process
#   - how much quantity moves through each stage
#   - QC accept/reject
#   - rework hand-off to the Rework module
#   - outsourcing send/receive with Delivery Challan refs
#
# Nothing here redefines the route. The route comes from
# AssemblyProcess rows created in Production Assembly Integration.
#
# Full views/services are built separately. These models are also
# the FK target for ReworkRecord.assembly_stage_execution.
# =====================================================================


class AssemblyExecution(models.Model):
    """
    One row per Assembly. Lazy-created the first time the assembly
    is opened on Production Operation.
    """

    class Status(models.TextChoices):
        PENDING = "Pending", "Pending"
        IN_PROGRESS = "In Progress", "In Progress"
        COMPLETED = "Completed", "Completed"
        CANCELLED = "Cancelled", "Cancelled"

    assembly = models.OneToOneField(
        "Assembly",
        on_delete=models.CASCADE,
        related_name="execution",
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING,
    )

    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.assembly.assembly_id} — {self.status}"


class AssemblyStageExecution(models.Model):
    """
    Execution state for ONE process step of one Assembly.

    Counters are running tallies of quantity at each phase of the
    stage. They are always derivable from AssemblyStageMovement rows
    but cached here so the list view is one query.
    """

    class ExecutionType(models.TextChoices):
        IN_HOUSE = "In-House", "In-House"
        OUTSOURCING = "Outsourcing", "Outsourcing"

    execution = models.ForeignKey(
        AssemblyExecution,
        on_delete=models.CASCADE,
        related_name="stages",
    )

    assembly_process = models.ForeignKey(
        "AssemblyProcess",
        on_delete=models.PROTECT,
        related_name="execution_rows",
    )

    sequence = models.PositiveIntegerField(default=1)
    name = models.CharField(max_length=150)
    process_id = models.CharField(max_length=50)
    qc_required = models.BooleanField(default=False)

    execution_type = models.CharField(
        max_length=20,
        choices=ExecutionType.choices,
        default=ExecutionType.IN_HOUSE,
    )
    execution_unit = models.CharField(max_length=50, blank=True, default="")

    # Outsourcing fields — mirrored from AssemblyProcess at row
    # creation, then frozen. Production Operation never edits these.
    vendor = models.CharField(max_length=255, blank=True, default="")
    vendor_contact = models.CharField(max_length=100, blank=True, default="")
    vendor_location = models.CharField(max_length=255, blank=True, default="")
    expected_return_date = models.DateField(null=True, blank=True)

    # ---- Quantity counters ----
    available_qty = models.DecimalField(
        max_digits=15, decimal_places=3, default=0,
    )
    pending_operation_qty = models.DecimalField(
        max_digits=15, decimal_places=3, default=0,
    )
    sent_qty = models.DecimalField(
        max_digits=15, decimal_places=3, default=0,
    )
    received_qty = models.DecimalField(
        max_digits=15, decimal_places=3, default=0,
    )
    awaiting_qc_qty = models.DecimalField(
        max_digits=15, decimal_places=3, default=0,
    )
    rework_qty = models.DecimalField(
        max_digits=15, decimal_places=3, default=0,
    )
    released_qty = models.DecimalField(
        max_digits=15, decimal_places=3, default=0,
    )

    started = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sequence", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["execution", "sequence"],
                name="assemblystageexec_unique_sequence",
            ),
        ]
        indexes = [
            models.Index(fields=["execution"]),
            models.Index(fields=["sequence"]),
        ]

    def __str__(self):
        return (
            f"{self.execution.assembly.assembly_id} · "
            f"{self.sequence}. {self.name}"
        )


class AssemblyStageMovement(models.Model):
    """
    Append-only log of every quantity movement on a stage.
    Never edited or deleted. Stage counters are updated in the same
    transaction for read speed.
    """

    class Movement(models.TextChoices):
        START = "Start", "Start"
        COMPLETE = "Complete", "Complete"
        QC_ACCEPT = "QC Accept", "QC Accept"
        QC_REJECT = "QC Reject", "QC Reject"
        REWORK_DONE = "Rework Done", "Rework Done"
        SEND_OUT = "Send Out", "Send Out"
        RECEIVE_IN = "Receive In", "Receive In"
        RELEASE = "Release", "Release"

    stage = models.ForeignKey(
        AssemblyStageExecution,
        on_delete=models.CASCADE,
        related_name="movements",
    )

    movement = models.CharField(
        max_length=20,
        choices=Movement.choices,
    )

    quantity = models.DecimalField(
        max_digits=15, decimal_places=3, default=0,
    )

    performed_by = models.CharField(max_length=150, blank=True, default="")
    supervised_by = models.CharField(max_length=150, blank=True, default="")

    remarks = models.TextField(blank=True, default="")

    # Used by SEND_OUT (Delivery Challan ref) and REWORK_DONE
    # (Rework record number) for traceability.
    dc_ref = models.CharField(max_length=50, blank=True, default="")

    expected_return_date = models.DateField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="assembly_stage_movements_created",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["stage"]),
            models.Index(fields=["movement"]),
        ]

    def __str__(self):
        return f"{self.stage} · {self.movement} · {self.quantity}"


class AssemblyExecutionEvent(models.Model):
    """
    Human-readable history row per assembly. One row per meaningful
    event. Displayed as the "Production History" section.
    """

    execution = models.ForeignKey(
        AssemblyExecution,
        on_delete=models.CASCADE,
        related_name="events",
    )

    event_date = models.DateField(auto_now_add=True)
    event_text = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["execution"])]

    def __str__(self):
        return self.event_text[:80]


# =====================================================================
# REWORK MODULE
# -----------------------------------------------------------------
# One ReworkRecord per rework event. Two sources feed this table:
#
#   1. RECEIVE FROM JOB WORK — a returned piece flagged as
#      "not usable as-is" (JobWorkReceiveRemaining.rework_required="Yes")
#
#   2. PRODUCTION OPERATION — QC rejects a quantity on an assembly stage
#
# The Rework module owns the work-detail: who, when, what was done.
# When a record reaches full completion it hands the quantity back
# to its source via services._hand_back_to_source(). Nothing in the
# source modules polls; the hand-back is transactional.
#
# Duration is frozen on the record the moment it reaches a terminal
# status. It is never recomputed afterwards.
# =====================================================================


class ReworkNumberSettings(models.Model):
    """
    Concurrency-safe counter for rework reference numbers.
    Matches the pattern of every other *NumberSettings model.
    """

    prefix = models.CharField(max_length=20, default="RWK")
    next_number = models.PositiveIntegerField(default=1)
    number_padding = models.PositiveIntegerField(default=4)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.prefix}{self.next_number:0{self.number_padding}d}"


class ReworkRecord(models.Model):

    class Source(models.TextChoices):
        JOB_WORK_RECEIVE = "job-work-receive", "Receive From Job Work"
        PRODUCTION = "production", "Production Operation"

    class Status(models.TextChoices):
        REQUIRED = "Rework Required", "Rework Required"
        IN_PROGRESS = "Rework In Progress", "Rework In Progress"
        PARTIAL = "Partially Completed", "Partially Completed"
        QC_PENDING = "QC Pending", "QC Pending"
        READY_NEXT = "Ready for Next Process", "Ready for Next Process"
        AVAILABLE_STOCK = "Available in Material Stock", "Available in Material Stock"
        CANCELLED = "Cancelled", "Cancelled"

    # ---- Identity ----
    rework_number = models.CharField(
        max_length=50, unique=True, db_index=True,
    )

    source_type = models.CharField(
        max_length=30,
        choices=Source.choices,
        default=Source.PRODUCTION,
        db_index=True,
    )

    # ---- Snapshot: Project / PO / DWG / Material ----
    project = models.ForeignKey(
        "Project",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="rework_records",
    )
    project_code = models.CharField(max_length=100, blank=True, default="")

    po_number = models.CharField(max_length=100, blank=True, default="")
    po_description = models.TextField(blank=True, default="")

    dwg_description = models.CharField(max_length=255, blank=True, default="")
    revision = models.CharField(max_length=50, blank=True, default="")

    material = models.CharField(max_length=150, blank=True, default="")
    material_code = models.CharField(max_length=100, blank=True, default="")
    material_spec = models.CharField(max_length=200, blank=True, default="")

    thickness = models.CharField(max_length=50, blank=True, default="")
    length = models.CharField(max_length=50, blank=True, default="")
    width = models.CharField(max_length=50, blank=True, default="")
    size = models.CharField(max_length=100, blank=True, default="")

    unit = models.CharField(max_length=50, blank=True, default="Nos")

    # ---- Source-specific linkage (nullable) ----
    job_work_remaining = models.ForeignKey(
        "JobWorkReceiveRemaining",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="rework_records",
    )
    job_work_piece_no = models.CharField(max_length=100, blank=True, default="")

    assembly_stage_execution = models.ForeignKey(
        "AssemblyStageExecution",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="rework_records",
    )
    assembly_code = models.CharField(max_length=50, blank=True, default="")
    process_name = models.CharField(max_length=150, blank=True, default="")
    process_id = models.CharField(max_length=50, blank=True, default="")

    # ---- Quantities ----
    required_qty = models.DecimalField(
        max_digits=15, decimal_places=3, default=0,
    )
    completed_qty = models.DecimalField(
        max_digits=15, decimal_places=3, default=0,
    )

    # ---- Reason / who flagged it ----
    reason = models.TextField(
        blank=True, default="",
        help_text="Why this was flagged for rework.",
    )
    flagged_by = models.CharField(max_length=150, blank=True, default="")

    # ---- Work details ----
    rework_by = models.CharField(max_length=150, blank=True, default="")
    supervisor = models.CharField(max_length=150, blank=True, default="")
    start_remarks = models.TextField(blank=True, default="")

    # ---- Timing ----
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Wall-clock minutes between started_at and completed_at.
    # Populated once, when the record reaches a terminal status.
    # Never recomputed afterwards.
    duration_minutes = models.IntegerField(null=True, blank=True)

    # ---- QC verification (source=production and qc_required only) ----
    qc_required = models.BooleanField(default=False)
    qc_verified_by = models.CharField(max_length=150, blank=True, default="")
    qc_result = models.CharField(max_length=20, blank=True, default="")
    qc_remarks = models.TextField(blank=True, default="")
    qc_at = models.DateTimeField(null=True, blank=True)

    # ---- Status ----
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.REQUIRED,
        db_index=True,
    )

    # ---- Audit ----
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="rework_records_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["rework_number"]),
            models.Index(fields=["source_type"]),
            models.Index(fields=["status"]),
            models.Index(fields=["project"]),
        ]

    def __str__(self):
        return f"{self.rework_number} · {self.project_code} · {self.required_qty}"

    @property
    def balance_qty(self):
        return (self.required_qty or 0) - (self.completed_qty or 0)


class ReworkCompletion(models.Model):
    """
    One row per partial completion. Multiple per rework record allowed.
    """

    rework = models.ForeignKey(
        ReworkRecord,
        on_delete=models.CASCADE,
        related_name="completions",
    )

    qty = models.DecimalField(
        max_digits=15, decimal_places=3, default=0,
    )

    completed_by = models.CharField(max_length=150, blank=True, default="")
    remarks = models.TextField(blank=True, default="")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="rework_completions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["rework"])]

    def __str__(self):
        return f"{self.rework.rework_number} · {self.qty}"


class ReworkHistory(models.Model):
    """
    Append-only history. One row per meaningful event.
    The row's created_at is the event timestamp.
    """

    rework = models.ForeignKey(
        ReworkRecord,
        on_delete=models.CASCADE,
        related_name="history",
    )

    event_text = models.TextField()
    performed_by = models.CharField(max_length=150, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["rework"])]

    def __str__(self):
        return self.event_text[:80]






# =====================================================================
# DISPATCH
# -----------------------------------------------------------------
# One DispatchTransaction row per outbound shipment against a
# completed Assembly. Production data (start/end dates, process
# chain, rework state) lives on AssemblyExecution / AssemblyStageExecution
# — this module only records outbound movement and references the
# Delivery Challan used for the shipment.
# =====================================================================


class DispatchNumberSettings(models.Model):
    """
    Concurrency-safe counter for dispatch numbers, matching the
    pattern used by every other *NumberSettings model.
    """

    prefix = models.CharField(max_length=20, default="DISP")
    next_number = models.PositiveIntegerField(default=1)
    number_padding = models.PositiveIntegerField(default=3)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["is_active"],
                condition=models.Q(is_active=True),
                name="dispatchnumbersettings_single_active",
            ),
        ]

    def __str__(self):
        return f"{self.prefix}{self.next_number:0{self.number_padding}d}"


class DispatchTransaction(models.Model):
    """
    One outbound shipment of a completed assembly.
    """

    # ---- Identity ----
    dispatch_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )

    dispatch_date = models.DateField()

    dispatch_time = models.CharField(
        max_length=10,
        blank=True,
        default="",
    )

    # ---- Assembly link ----
    assembly_execution = models.ForeignKey(
        "AssemblyExecution",
        on_delete=models.PROTECT,
        related_name="dispatches",
    )

    # ---- Snapshot fields ----
    assembly_code = models.CharField(
        max_length=50,
        blank=True,
        default="",
        db_index=True,
    )

    project_code = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    dwg_description = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    revision = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    # ---- Destination / transport ----
    dispatch_to = models.CharField(
        max_length=255, blank=True, default=""
    )

    location = models.CharField(
        max_length=255, blank=True, default=""
    )

    vehicle_number = models.CharField(
        max_length=50, blank=True, default=""
    )

    transporter = models.CharField(
        max_length=255, blank=True, default=""
    )

    driver_name = models.CharField(
        max_length=150, blank=True, default=""
    )

    driver_contact = models.CharField(
        max_length=50, blank=True, default=""
    )

    # ---- Quantity ----
    quantity = models.DecimalField(
        max_digits=15, decimal_places=3, default=0,
    )

    remarks = models.TextField(blank=True, default="")

    # ---- Delivery Challan reference ----
    dc_challan_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        help_text="Delivery Challan number raised for this shipment.",
    )

    delivery_challan = models.ForeignKey(
        "DeliveryChallan",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dispatch_transactions",
        help_text="Optional link to the Delivery Challan record, if any.",
    )

    # ---- Audit ----
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dispatches_created",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-dispatch_date", "-created_at"]
        indexes = [
            models.Index(fields=["assembly_execution"]),
            models.Index(fields=["assembly_code"]),
            models.Index(fields=["dispatch_date"]),
            models.Index(fields=["dc_challan_number"]),
        ]

    def __str__(self):
        return (
            f"{self.dispatch_number} — "
            f"{self.assembly_code} — {self.quantity}"
        )


    

class Scrap(models.Model):

    class QuantityUnit(models.TextChoices):
        NOS = "Nos", "Nos"
        KG = "Kg", "Kg"
        TON = "Ton", "Ton"
        METER = "Meter", "Meter"
        PIECE = "Piece", "Piece"

    class WeightUnit(models.TextChoices):
        KG = "Kg", "Kg"
        TON = "Ton", "Ton"

    # =========================================================
    # SCRAP ID
    # =========================================================

    scrap_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
    )

    # =========================================================
    # SOURCE PO ITEM
    # =========================================================

    purchase_order_item = models.ForeignKey(
        PurchaseOrderItem,
        on_delete=models.PROTECT,
        related_name="scrap_records",
    )

    # =========================================================
    # PROJECT
    # =========================================================

    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        related_name="scrap_records",
    )

    # =========================================================
    # PROCESS
    # =========================================================

    process = models.CharField(
        max_length=100,
    )

    # =========================================================
    # SCRAP DETAILS
    # =========================================================

    scrap_type = models.CharField(
        max_length=100,
    )

    quantity = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        null=True,
        blank=True,
    )

    quantity_unit = models.CharField(
        max_length=20,
        choices=QuantityUnit.choices,
        blank=True,
        default="",
    )

    weight = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        null=True,
        blank=True,
    )

    weight_unit = models.CharField(
        max_length=20,
        choices=WeightUnit.choices,
        blank=True,
        default="",
    )

    # =========================================================
    # REASON
    # =========================================================

    reason = models.CharField(
        max_length=150,
    )

    # =========================================================
    # SCRAP DATE / LOCATION
    # =========================================================

    scrap_date = models.DateField()

    location = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    remarks = models.TextField(
        blank=True,
        default="",
    )

    # =========================================================
    # AUDIT
    # =========================================================

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scrap_created",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]

        indexes = [
            models.Index(fields=["scrap_id"]),
            models.Index(fields=["purchase_order_item"]),
            models.Index(fields=["project"]),
            models.Index(fields=["scrap_date"]),
            models.Index(fields=["scrap_type"]),
        ]

    def __str__(self):
        return (
            f"{self.scrap_id} - "
            f"{self.purchase_order_item.po_number} - "
            f"{self.purchase_order_item.description}"
        )
    


class ScrapNumberSettings(models.Model):
    prefix = models.CharField(
        max_length=20,
        default="SCR",
    )

    next_number = models.PositiveBigIntegerField(
        default=1,
    )

    number_padding = models.PositiveIntegerField(
        default=3,
    )

    is_active = models.BooleanField(
        default=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.prefix}-{self.next_number:0{self.number_padding}d}"

from django.db import models


class ContactRequest(models.Model):

    PRIORITY_CHOICES = [
        ("HIGH", "High"),
        ("MEDIUM", "Medium"),
        ("LOW", "Low"),
    ]

    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("EMAIL_SENT", "Email Sent"),
        ("EMAIL_FAILED", "Email Failed"),
    ]

    employee_id = models.CharField(max_length=100)
    subject = models.CharField(max_length=255)
    message = models.TextField()

    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default="MEDIUM"
    )

    inform_admin = models.BooleanField(default=False)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING"
    )

    email_sent_at = models.DateTimeField(null=True, blank=True)
    email_error = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "contact_requests"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.employee_id} - {self.subject}"

from django.db import models


class EmailLog(models.Model):

    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("SENT", "Sent"),
        ("FAILED", "Failed"),
    ]

    email_type = models.CharField(
        max_length=50,
        default="CONTACT_US"
    )

    contact_request = models.ForeignKey(
        "ContactRequest",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="email_logs"
    )

    recipient = models.EmailField()

    subject = models.CharField(
        max_length=255
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING"
    )

    error_message = models.TextField(
        null=True,
        blank=True
    )

    sent_at = models.DateTimeField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        db_table = "email_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.recipient} - {self.status}"
