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

    record_number = models.CharField(
        max_length=50,
        unique=True,
    )

    date = models.DateField()

    type = models.CharField(
        max_length=20,
        choices=EntryType.choices,
        default=EntryType.EXPENSE,
    )

    # =========================
    # DETAILS
    # =========================

    category = models.CharField(
        max_length=50,
        choices=Category.choices,
        default=Category.OTHER,
    )

    description = models.TextField(
        blank=True,
        default="",
    )

    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
    )

    payment_mode = models.CharField(
        max_length=30,
        choices=PaymentMode.choices,
        default=PaymentMode.CASH,
    )

    # =========================
    # DOCUMENT / REFERENCE
    # =========================

    document_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    document = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    notes = models.TextField(
        blank=True,
        default="",
    )

    # =========================
    # OPTIONAL LINK TO SOURCE DOC
    # =========================

    source_type = models.CharField(
        max_length=30,
        blank=True,
        default="",
    )

    source_id = models.PositiveIntegerField(
        null=True,
        blank=True,
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
        ordering = ["-date", "-created_at"]
        verbose_name = "Journal Entry"
        verbose_name_plural = "Journal Entries"

    def __str__(self):
        return f"{self.record_number} — {self.type} — {self.amount}"