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

        
        if self.status == self.Status.CONFIRMED:

            for index, item in enumerate(self.items or [], start=1):

                if not isinstance(item, dict):
                    continue

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
                    },
                )


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

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["id"]

        constraints = [
            models.UniqueConstraint(
                fields=["purchase_order", "item_code"],
                name="unique_po_item_code",
            )
        ]

    def __str__(self):
        return f"{self.po_number} - {self.item_code}"


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
        ]

    def __str__(self):
        return (
            f"{self.issue_number} — "
            f"{self.consumable_name} — "
            f"{self.quantity_issued}"
        )