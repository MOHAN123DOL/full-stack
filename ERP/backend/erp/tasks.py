from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.db.models import Sum
from django.utils import timezone
from decimal import Decimal

from .models import (
    ConsumableGRN,
    ConsumableIssue,
    ConsumableReturn,
    ConsumableEmailLog,
)


def get_consumable_available_stock(grn):
    """
    Calculate the latest available stock for one GRN.

    Available = Received - Issued + Returned
    """

    received_qty = grn.received_quantity or Decimal("0")

    issued_qty = (
        ConsumableIssue.objects
        .filter(grn_id=grn.id)
        .aggregate(total=Sum("quantity_issued"))["total"]
        or Decimal("0")
    )

    returned_qty = (
        ConsumableReturn.objects
        .filter(issue__grn_id=grn.id)
        .aggregate(total=Sum("quantity_returned"))["total"]
        or Decimal("0")
    )

    return received_qty - issued_qty + returned_qty


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def check_consumable_buffer_stock(self, grn_id, reference_issue_id=None):

    try:
        # Always fetch fresh data from the database.
        grn = ConsumableGRN.objects.get(id=grn_id)

        if grn.buffer_stock_limit is None:
            return "Skipped: Buffer stock limit is not configured."

        # Calculate latest stock, including all returns.
        available_stock = get_consumable_available_stock(grn)

        buffer_limit = grn.buffer_stock_limit

        # IMPORTANT: Check latest quantity before sending.
        if available_stock > buffer_limit:
            return (
                f"Skipped: Available stock {available_stock} "
                f"is above buffer limit {buffer_limit}."
            )

        admin_email = (
            getattr(settings, "CONTACT_ADMIN_EMAIL", None)
            or getattr(settings, "EMAIL_HOST_USER", None)
        )

        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None)

        if not admin_email:
            raise ValueError("Admin email is not configured.")

        if not from_email:
            raise ValueError("DEFAULT_FROM_EMAIL is not configured.")

        issue = None

        if reference_issue_id:
            issue = ConsumableIssue.objects.filter(
                id=reference_issue_id
            ).first()

        material_name = (
            grn.consumable_name
            or grn.po_description
            or "Consumable"
        )

        subject = f"LOW BUFFER STOCK ALERT: {material_name}"

        context = {
            "company_name": getattr(
                settings, "COMPANY_NAME", "ERP System"
            ),
            "year": timezone.now().year,
            "material_name": material_name,
            "grn_number": grn.grn_number,
            "warehouse": grn.warehouse or "Main Warehouse",
            "issue_number": issue.issue_number if issue else "Stock Return",
            "issued_quantity": (
                issue.quantity_issued if issue else Decimal("0")
            ),
            "available_qty": available_stock,
            "buffer_limit": buffer_limit,
            "unit": grn.unit or "Nos",
            "po_number": grn.po_number or "N/A",
            "received_date": grn.created_at.strftime(
                "%d %b %Y, %I:%M %p"
            ),
        }

        html_body = render_to_string(
            "emails/buffer_stock_alert.html",
            context,
        )

        text_body = (
            "LOW BUFFER STOCK ALERT\n\n"
            f"Consumable: {material_name}\n"
            f"GRN: {grn.grn_number}\n"
            f"Warehouse: {grn.warehouse}\n"
            f"Available Stock: {available_stock} {grn.unit}\n"
            f"Buffer Limit: {buffer_limit} {grn.unit}\n\n"
            "Please arrange restocking."
        )

        email = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=from_email,
            to=[admin_email],
        )

        email.attach_alternative(html_body, "text/html")
        email.send(fail_silently=False)

        # Save successful email log.
        ConsumableEmailLog.objects.create(
            alert_type="LOW_STOCK",
            consumable_name=material_name,
            category=grn.category,
            warehouse=grn.warehouse,
            available_stock=available_stock,
            buffer_stock_limit=buffer_limit,
            recipient_email=admin_email,
            subject=subject,
            email_body=text_body,
            email_status="SENT",
            sent_at=timezone.now(),
        )

        return f"Alert sent successfully for {material_name}."

    except Exception as exc:

        # Log the failed attempt.
        try:
            grn = ConsumableGRN.objects.get(id=grn_id)

            ConsumableEmailLog.objects.create(
                alert_type="LOW_STOCK",
                consumable_name=(
                    grn.consumable_name
                    or grn.po_description
                    or "Consumable"
                ),
                category=grn.category,
                warehouse=grn.warehouse,
                available_stock=get_consumable_available_stock(grn),
                buffer_stock_limit=grn.buffer_stock_limit,
                recipient_email=(
                    getattr(settings, "CONTACT_ADMIN_EMAIL", None)
                    or getattr(settings, "EMAIL_HOST_USER", "")
                ),
                subject="Consumable Buffer Stock Alert",
                email_body="",
                email_status="FAILED",
                error_message=str(exc),
            )

        except Exception:
            pass

        raise self.retry(exc=exc)