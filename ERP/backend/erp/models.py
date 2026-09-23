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


class PurchaseOrder(models.Model):

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PREVIEWED = "previewed", "Previewed"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"

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