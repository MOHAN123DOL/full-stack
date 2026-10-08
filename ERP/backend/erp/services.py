# =====================================================================
# REWORK SERVICES
# -----------------------------------------------------------------
# The only place Rework talks to its source modules.
#
#   create_rework_from_job_work(...)    ← Receive From Job Work
#   create_rework_from_production(...)  ← Production Operation
#   mark_rework_done(...)               → hands quantity back
#
# The hand-back is transactional. If the target stage or stock
# creation fails, nothing is committed anywhere.
# =====================================================================

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import (
    ReworkRecord,
    ReworkCompletion,
    ReworkHistory,
    ReworkNumberSettings,
)


# ---------------------------------------------------------------------
# NUMBER GENERATOR
# ---------------------------------------------------------------------
def generate_rework_number():
    settings_obj = (
        ReworkNumberSettings.objects
        .select_for_update()
        .filter(is_active=True)
        .first()
    )
    if settings_obj is None:
        settings_obj = ReworkNumberSettings.objects.create(
            prefix="RWK", next_number=1, number_padding=4, is_active=True,
        )
    number = (
        f"{settings_obj.prefix}"
        f"{settings_obj.next_number:0{settings_obj.number_padding}d}"
    )
    settings_obj.next_number += 1
    settings_obj.save(update_fields=["next_number", "updated_at"])
    return number


def _log(rework, text, performed_by=""):
    ReworkHistory.objects.create(
        rework=rework,
        event_text=text,
        performed_by=performed_by,
    )


def _freeze_duration(rework):
    """
    Compute and store the wall-clock minutes between started_at
    and completed_at. Called only once, when a record first reaches
    a terminal status.
    """
    if not rework.started_at:
        rework.duration_minutes = 0
        return
    end = rework.completed_at or timezone.now()
    delta = end - rework.started_at
    rework.duration_minutes = int(delta.total_seconds() // 60)


# ---------------------------------------------------------------------
# SOURCE 1 — Receive From Job Work
# ---------------------------------------------------------------------
@transaction.atomic
def create_rework_from_job_work(
    *,
    job_work_receive,
    job_work_remaining,
    created_by=None,
):
    """
    Called when a Receive From Job Work remaining row is marked
    rework_required="Yes". Creates a ReworkRecord.

    Returns the new ReworkRecord.
    """
    qty = Decimal("1")

    rework = ReworkRecord.objects.create(
        rework_number=generate_rework_number(),
        source_type=ReworkRecord.Source.JOB_WORK_RECEIVE,

        project=job_work_receive.project,
        project_code=(
            job_work_receive.project.code
            if job_work_receive.project else ""
        ),

        po_number=job_work_receive.po_number or "",
        po_description=job_work_receive.description or "",
        dwg_description=job_work_receive.dwg_description or "",
        revision=job_work_receive.revision or "",

        material=job_work_receive.material or "",
        material_code=job_work_receive.material_code or "",
        material_spec=job_work_receive.material_spec or "",

        thickness=(
            job_work_remaining.thickness
            or job_work_receive.thickness
            or ""
        ),
        length=job_work_remaining.length or "",
        width=job_work_remaining.width or "",
        size=(
            f"{job_work_remaining.length} x {job_work_remaining.width}"
            if job_work_remaining.length and job_work_remaining.width
            else ""
        ),
        unit=job_work_receive.uom or "Nos",

        job_work_remaining=job_work_remaining,
        job_work_piece_no=job_work_remaining.plate_no or "",

        required_qty=qty,
        completed_qty=Decimal("0"),

        reason=job_work_remaining.remarks or "",
        flagged_by=job_work_receive.received_by or "",

        qc_required=False,

        status=ReworkRecord.Status.REQUIRED,
        created_by=created_by,
    )

    _log(
        rework,
        f"Remaining piece {job_work_remaining.plate_no or '—'} "
        f"flagged for rework during Receive From Job Work.",
        performed_by=job_work_receive.received_by or "",
    )

    return rework


# ---------------------------------------------------------------------
# SOURCE 2 — Production Operation
# ---------------------------------------------------------------------
@transaction.atomic
def create_rework_from_production(
    *,
    assembly_stage_execution,
    qty,
    reason="",
    flagged_by="",
    qc_required=False,
    created_by=None,
):
    """
    Called from Production Operation QC reject. Creates a ReworkRecord.

    Returns the new ReworkRecord.
    """
    stage = assembly_stage_execution
    execution = stage.execution
    assembly = execution.assembly
    project = assembly.project

    rework = ReworkRecord.objects.create(
        rework_number=generate_rework_number(),
        source_type=ReworkRecord.Source.PRODUCTION,

        project=project,
        project_code=project.code if project else "",

        dwg_description=assembly.dwg_description or "",
        material="",
        unit="Nos",

        assembly_stage_execution=stage,
        assembly_code=assembly.assembly_id,
        process_name=stage.name,
        process_id=stage.process_id,

        required_qty=Decimal(str(qty)),
        completed_qty=Decimal("0"),

        reason=reason or "",
        flagged_by=flagged_by or "",

        qc_required=bool(qc_required),

        status=ReworkRecord.Status.REQUIRED,
        created_by=created_by,
    )

    _log(
        rework,
        f"{qty} Nos rejected at {stage.name} ({assembly.assembly_id}) — "
        f"Rework ID {rework.rework_number} created.",
        performed_by=flagged_by,
    )

    return rework


# ---------------------------------------------------------------------
# MARK DONE
# ---------------------------------------------------------------------
@transaction.atomic
def mark_rework_done(
    *,
    rework,
    done_qty=None,
    completed_by="",
    remarks="",
):
    """
    Records a completion.

    - Partial completion: record goes to PARTIAL, timing not frozen.
    - Full completion: record goes to a terminal status, timing is
      frozen via _freeze_duration, and quantity is handed back to
      the source via _hand_back_to_source.

    Returns the updated ReworkRecord.
    """
    if rework.status in (
        ReworkRecord.Status.AVAILABLE_STOCK,
        ReworkRecord.Status.READY_NEXT,
        ReworkRecord.Status.CANCELLED,
    ):
        raise ValueError(f"Rework record is {rework.status}.")

    remaining = rework.required_qty - rework.completed_qty
    qty = Decimal(str(done_qty)) if done_qty is not None else remaining

    if qty <= 0:
        raise ValueError("done_qty must be greater than 0.")
    if qty > remaining:
        raise ValueError(
            f"done_qty ({qty}) exceeds remaining ({remaining})."
        )

    # ---- Record the completion ----
    ReworkCompletion.objects.create(
        rework=rework,
        qty=qty,
        completed_by=completed_by,
        remarks=remarks or "",
        created_by=rework.created_by,
    )

    rework.completed_qty += qty
    if completed_by:
        rework.rework_by = rework.rework_by or completed_by
    if rework.started_at is None:
        rework.started_at = timezone.now()

    new_balance = rework.required_qty - rework.completed_qty

    # ---- Decide next status ----
    if new_balance > 0:
        rework.status = ReworkRecord.Status.PARTIAL
    else:
        # Terminal transition
        rework.completed_at = timezone.now()
        _freeze_duration(rework)

        if rework.source_type == ReworkRecord.Source.JOB_WORK_RECEIVE:
            rework.status = ReworkRecord.Status.AVAILABLE_STOCK
        else:
            rework.status = (
                ReworkRecord.Status.QC_PENDING
                if rework.qc_required
                else ReworkRecord.Status.READY_NEXT
            )

    rework.save()

    _log(
        rework,
        f"{qty} Nos completed by {completed_by}"
        + (
            f" — {new_balance} remaining"
            if new_balance > 0
            else " — Rework Completed"
        ),
        performed_by=completed_by,
    )

    if new_balance <= 0:
        _hand_back_to_source(rework, qty)

    return rework


# ---------------------------------------------------------------------
# HAND BACK TO SOURCE
# ---------------------------------------------------------------------
def _hand_back_to_source(rework, qty):
    if rework.source_type == ReworkRecord.Source.JOB_WORK_RECEIVE:
        _hand_back_to_job_work(rework, qty)
    elif rework.source_type == ReworkRecord.Source.PRODUCTION:
        if rework.qc_required:
            _hand_back_to_production_qc(rework, qty)
        else:
            _hand_back_to_production_next(rework, qty)

def _hand_back_to_job_work(rework, qty):
    """
    Reworked Job Work piece becomes usable stock again.

    We flip the ORIGINAL MaterialStock lot in place:
      - rework_required:  True  → False
      - stock_status:     Remaining → Available
      - append an IN movement so the ledger shows the Rework event

    The lot keeps its stock_id and its history, so the Issue to Job Work
    page sees it as a normal, issuable lot on the next refresh.

    A secondary, empty history row is not created — everything is
    appended to the same lot.
    """
    from .models import (
        MaterialStock,
        MaterialStockMovement,
    )

    remaining = rework.job_work_remaining
    if remaining is None:
        return

    receive = remaining.receive

    # ---- Find the lot this rework came from ----
    # Match by plate_number + project + po_number, since the lot was
    # created in JobWorkReceiveCreateAPIView with those exact values.
    lot = (
        MaterialStock.objects
        .filter(
            plate_number=remaining.plate_no or "",
            po_number=receive.po_number or "",
            project=receive.project,
            rework_required=True,
        )
        .order_by("-created_at")
        .first()
    )

    if lot is None:
        # Defensive — lot was deleted or never flagged. Nothing to flip.
        _log(
            rework,
            f"Original stock lot for {remaining.plate_no or '—'} "
            f"not found — nothing to update.",
            performed_by=rework.rework_by,
        )
        return

    # ---- Flip the flag ----
    lot.rework_required = False
    lot.stock_status = MaterialStock.StockStatus.AVAILABLE
    lot.remarks = (
        f"{lot.remarks} | Reworked via {rework.rework_number}"
        if lot.remarks
        else f"Reworked via {rework.rework_number}"
    )
    lot.save(
        update_fields=[
            "rework_required",
            "stock_status",
            "remarks",
            "updated_at",
        ]
    )

    # ---- Append an IN movement so the ledger reflects the Rework event ----
    # The physical piece never left the yard, so quantity = 0. This is
    # a "state change" row, not a physical receipt. Keeping quantity at 0
    # means available_qty is unchanged — which is exactly what we want.
    MaterialStockMovement.objects.create(
        stock=lot,
        direction=MaterialStockMovement.Direction.IN,
        movement_type=MaterialStockMovement.MovementType.REWORK,
        quantity=Decimal("0"),
        reference_type="ReworkRecord",
        reference_id=rework.id,
        remarks=f"Rework completed via {rework.rework_number}",
        created_by=rework.created_by,
    )

    _log(
        rework,
        f"Material {remaining.plate_no or ''} reworked — "
        f"now Available in Material Stock (lot {lot.stock_id}).",
        performed_by=rework.rework_by,
    )

def _hand_back_to_production_qc(rework, qty):
    """
    Reworked quantity goes back to QC at the same stage.
    """
    from .models import (
        AssemblyStageMovement, AssemblyExecutionEvent,
    )

    stage = rework.assembly_stage_execution
    if stage is None:
        return

    execution = stage.execution

    stage.rework_qty = max(stage.rework_qty - qty, 0)
    stage.awaiting_qc_qty += qty
    stage.save(update_fields=["rework_qty", "awaiting_qc_qty", "updated_at"])

    AssemblyStageMovement.objects.create(
        stage=stage,
        movement=AssemblyStageMovement.Movement.REWORK_DONE,
        quantity=qty,
        performed_by=rework.rework_by,
        remarks=rework.qc_remarks or "",
        dc_ref=rework.rework_number,
        created_by=rework.created_by,
    )

    AssemblyExecutionEvent.objects.create(
        execution=execution,
        event_text=(
            f"Rework marked Done for {qty} Nos ({stage.name}) — "
            f"ref {rework.rework_number}, sent back to QC"
        ),
    )

    _log(
        rework,
        f"{qty} Nos sent back to QC ({stage.name}).",
        performed_by=rework.rework_by,
    )


def _hand_back_to_production_next(rework, qty):
    """
    Reworked quantity released directly to the next stage.
    """
    from .models import (
        AssemblyStageMovement, AssemblyExecutionEvent,
    )

    stage = rework.assembly_stage_execution
    if stage is None:
        return

    execution = stage.execution

    stage.rework_qty = max(stage.rework_qty - qty, 0)
    stage.released_qty += qty
    stage.save(update_fields=["rework_qty", "released_qty", "updated_at"])

    nxt = (
        execution.stages
        .filter(sequence__gt=stage.sequence)
        .order_by("sequence")
        .first()
    )
    if nxt is not None:
        nxt.available_qty += qty
        nxt.pending_operation_qty += qty
        nxt.save(update_fields=[
            "available_qty", "pending_operation_qty", "updated_at",
        ])

    AssemblyStageMovement.objects.create(
        stage=stage,
        movement=AssemblyStageMovement.Movement.REWORK_DONE,
        quantity=qty,
        performed_by=rework.rework_by,
        remarks=rework.qc_remarks or "",
        dc_ref=rework.rework_number,
        created_by=rework.created_by,
    )

    nxt_name = nxt.name if nxt else "Final Completion"

    AssemblyExecutionEvent.objects.create(
        execution=execution,
        event_text=(
            f"Rework marked Done for {qty} Nos ({stage.name}) — "
            f"ref {rework.rework_number}, released to {nxt_name}"
        ),
    )

    _log(
        rework,
        f"{qty} Nos released to {nxt_name}.",
        performed_by=rework.rework_by,
    )





"""
Material Reports — row builders.

Every builder returns a list[dict] whose keys match the column
definitions in Reports.jsx → REPORT_CONFIGS[key].columns.

Nothing here returns a model instance. Dates are ISO strings,
Decimals are floats, and None is normalized to the "—" sentinel
the frontend's fmt() understands.
"""

from decimal import Decimal

from django.db.models import Sum, Q


DASH = "—"


# =====================================================================
# GENERIC HELPERS
# =====================================================================

def _d(v):
    if v in (None, "", "None"):
        return DASH
    return str(v)


def _f(v):
    if v is None:
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _iso(d):
    if not d:
        return DASH
    return d.isoformat()


def _supplier_name(vendor):
    """PurchaseOrder.vendor is a JSONField — pull companyName."""
    if not vendor:
        return DASH
    if isinstance(vendor, dict):
        return vendor.get("companyName") or DASH
    text = str(vendor).strip()
    if text.startswith("{") and text.endswith("}"):
        try:
            import ast
            parsed = ast.literal_eval(text)
            if isinstance(parsed, dict):
                return parsed.get("companyName") or DASH
        except (ValueError, SyntaxError):
            pass
    return text or DASH


def _project_for_po_item(po_item_id=None, dummy_item_id=None):
    """Resolve the project a PO item is integrated into."""
    from .models import BOMPOIntegration
    qs = BOMPOIntegration.objects.select_related("project")
    if po_item_id:
        qs = qs.filter(purchase_order_item_id=po_item_id)
    elif dummy_item_id:
        qs = qs.filter(dummy_purchase_order_item_id=dummy_item_id)
    else:
        return None
    row = qs.order_by("-created_at").first()
    return row.project if row else None


def _po_type(po_number):
    if not po_number:
        return DASH
    up = str(po_number).upper()
    if up.startswith("DUMMY") or up.startswith("DPO"):
        return "Dummy PO"
    return "Actual PO"


# =====================================================================
# KPI CARDS
# =====================================================================

def compute_kpis():
    from .models import (
        PurchaseOrderItem,
        BOMPOIntegration,
        MaterialGRN,
        MaterialStock,
        JobWorkIssue,
        ReworkRecord,
        AssemblyExecution,
        AssemblyStageExecution,
        DispatchTransaction,
    )

    total_po = (
        PurchaseOrderItem.objects
        .exclude(po_number="")
        .values("po_number")
        .distinct()
        .count()
    )

    integrated_po_items = (
        BOMPOIntegration.objects
        .exclude(purchase_order_item__isnull=True)
        .values("purchase_order_item_id")
        .distinct()
        .count()
    )

    total_received = (
        MaterialGRN.objects.aggregate(s=Sum("received_qty"))["s"]
        or Decimal("0")
    )

    available_stock = Decimal("0")
    for lot in MaterialStock.objects.all().only("id", "original_qty"):
        available_stock += lot.available_qty

    job_work_pending = (
        JobWorkIssue.objects
        .exclude(status__in=[
            JobWorkIssue.Status.FULLY_RETURNED,
            JobWorkIssue.Status.CANCELLED,
        ])
        .count()
    )

    job_work_rework = (
        ReworkRecord.objects
        .filter(source_type=ReworkRecord.Source.JOB_WORK_RECEIVE)
        .exclude(status__in=[
            ReworkRecord.Status.AVAILABLE_STOCK,
            ReworkRecord.Status.CANCELLED,
        ])
        .count()
    )

    production_in_progress = (
        AssemblyExecution.objects
        .filter(status=AssemblyExecution.Status.IN_PROGRESS)
        .count()
    )

    qc_pending = (
        AssemblyStageExecution.objects
        .filter(awaiting_qc_qty__gt=0)
        .count()
    )

    production_rework = (
        ReworkRecord.objects
        .filter(source_type=ReworkRecord.Source.PRODUCTION)
        .exclude(status__in=[
            ReworkRecord.Status.READY_NEXT,
            ReworkRecord.Status.AVAILABLE_STOCK,
            ReworkRecord.Status.CANCELLED,
        ])
        .count()
    )

    completed_assemblies = (
        AssemblyExecution.objects
        .filter(status=AssemblyExecution.Status.COMPLETED)
        .count()
    )

    dispatched_ids = set(
        DispatchTransaction.objects
        .values_list("assembly_execution_id", flat=True)
    )
    ready_for_dispatch = (
        AssemblyExecution.objects
        .filter(status=AssemblyExecution.Status.COMPLETED)
        .exclude(id__in=dispatched_ids)
        .filter(stages__rework_qty=0)
        .distinct()
        .count()
    )

    dispatched = (
        DispatchTransaction.objects
        .values("assembly_execution_id")
        .distinct()
        .count()
    )

    return [
        {"label": "Total PO",               "value": total_po,               "cls": "rpt-po-card"},
        {"label": "Integrated PO Items",    "value": integrated_po_items,    "cls": "rpt-stock-card"},
        {"label": "Total Received (GRN)",   "value": int(total_received),    "cls": "rpt-finished-card"},
        {"label": "Available Stock",        "value": int(available_stock),   "cls": "rpt-balance-card"},
        {"label": "Job Work Pending",       "value": job_work_pending,       "cls": "rpt-production-card"},
        {"label": "Job Work Rework",        "value": job_work_rework,        "cls": "rpt-rework-card"},
        {"label": "Production In Progress", "value": production_in_progress, "cls": "rpt-production-card"},
        {"label": "QC Pending",             "value": qc_pending,             "cls": "rpt-scrap-card"},
        {"label": "Production Rework",      "value": production_rework,      "cls": "rpt-rejection-card"},
        {"label": "Completed Assemblies",   "value": completed_assemblies,   "cls": "rpt-finished-card"},
        {"label": "Ready For Dispatch",     "value": ready_for_dispatch,     "cls": "rpt-stock-card"},
        {"label": "Dispatched",             "value": dispatched,             "cls": "rpt-po-card"},
    ]


# =====================================================================
# 1 — PO / PO INTEGRATION
# =====================================================================

def build_po_integration_rows():
    from .models import (
        PurchaseOrderItem,
        DummyPurchaseOrderItem,
        BOMPOIntegration,
        MaterialGRN,
        PurchaseOrder,
    )

    rows = []

    real_items = (
        PurchaseOrderItem.objects
        .select_related("purchase_order")
        .filter(purchase_order__status=PurchaseOrder.Status.CONFIRMED)
        .order_by("po_number", "id")
    )

    real_grn = dict(
        MaterialGRN.objects
        .filter(purchase_order_item__isnull=False)
        .values("purchase_order_item_id")
        .annotate(t=Sum("received_qty"))
        .values_list("purchase_order_item_id", "t")
    )
    real_int = dict(
        BOMPOIntegration.objects
        .filter(purchase_order_item__isnull=False)
        .values("purchase_order_item_id")
        .annotate(t=Sum("quantity"))
        .values_list("purchase_order_item_id", "t")
    )

    for it in real_items:
        po_qty = it.quantity or Decimal("0")
        received = real_grn.get(it.id, Decimal("0"))
        integrated = real_int.get(it.id, Decimal("0"))

        if integrated <= 0:
            status = "Not Integrated"
        elif integrated >= po_qty:
            status = "Integrated"
        else:
            status = "Partially Integrated"

        project = _project_for_po_item(po_item_id=it.id)

        rows.append({
            "id": f"poi-real-{it.id}",
            "poType": "Actual PO",
            "poNumber": _d(it.po_number),
            "supplier": _supplier_name(it.purchase_order.vendor),
            "description": _d(it.description),
            "material": DASH,
            "materialCode": _d(it.item_code),
            "materialSpec": DASH,
            "thickness": _d(it.thickness),
            "length": _d(it.length),
            "width": _d(it.width),
            "size": (
                f"{it.length} x {it.width}"
                if it.length and it.width else DASH
            ),
            "unit": _d(it.unit),
            "poQty": _f(po_qty),
            "received": _f(received),
            "balanceQty": _f(po_qty - received),
            "integrationQty": _f(integrated),
            "integrationStatus": status,
            "project": project.name if project else DASH,
            "dwgNumber": DASH,
            "dwgDescription": DASH,
            "integrationDate": DASH,
        })

    dummy_items = (
        DummyPurchaseOrderItem.objects
        .select_related("dummy_po")
        .order_by("dummy_po__po_number", "id")
    )

    dummy_grn = dict(
        MaterialGRN.objects
        .filter(dummy_purchase_order_item__isnull=False)
        .values("dummy_purchase_order_item_id")
        .annotate(t=Sum("received_qty"))
        .values_list("dummy_purchase_order_item_id", "t")
    )
    dummy_int = dict(
        BOMPOIntegration.objects
        .filter(dummy_purchase_order_item__isnull=False)
        .values("dummy_purchase_order_item_id")
        .annotate(t=Sum("quantity"))
        .values_list("dummy_purchase_order_item_id", "t")
    )

    for it in dummy_items:
        po_qty = it.quantity or Decimal("0")
        received = dummy_grn.get(it.id, Decimal("0"))
        integrated = dummy_int.get(it.id, Decimal("0"))

        if integrated <= 0:
            status = "Not Integrated"
        elif integrated >= po_qty:
            status = "Integrated"
        else:
            status = "Partially Integrated"

        project = _project_for_po_item(dummy_item_id=it.id)

        rows.append({
            "id": f"poi-dummy-{it.id}",
            "poType": "Dummy PO",
            "poNumber": _d(it.dummy_po.po_number),
            "supplier": "Dummy / Internal",
            "description": _d(it.description),
            "material": _d(it.material),
            "materialCode": _d(it.item_code),
            "materialSpec": DASH,
            "thickness": _d(it.thickness),
            "length": _d(it.length),
            "width": _d(it.width),
            "size": (
                f"{it.length} x {it.width}"
                if it.length and it.width else DASH
            ),
            "unit": _d(it.unit),
            "poQty": _f(po_qty),
            "received": _f(received),
            "balanceQty": _f(po_qty - received),
            "integrationQty": _f(integrated),
            "integrationStatus": status,
            "project": project.name if project else DASH,
            "dwgNumber": DASH,
            "dwgDescription": DASH,
            "integrationDate": DASH,
        })

    return rows


# =====================================================================
# 2 — GRN / RECEIVED MATERIAL
# =====================================================================

def build_grn_rows():
    from .models import MaterialGRN

    rows = []

    grns = (
        MaterialGRN.objects
        .select_related(
            "purchase_order_item",
            "dummy_purchase_order_item",
            "dummy_purchase_order_item__dummy_po",
        )
        .order_by("-grn_date", "-id")
    )

    real_totals = dict(
        MaterialGRN.objects
        .filter(purchase_order_item__isnull=False)
        .values("purchase_order_item_id")
        .annotate(t=Sum("received_qty"))
        .values_list("purchase_order_item_id", "t")
    )
    dummy_totals = dict(
        MaterialGRN.objects
        .filter(dummy_purchase_order_item__isnull=False)
        .values("dummy_purchase_order_item_id")
        .annotate(t=Sum("received_qty"))
        .values_list("dummy_purchase_order_item_id", "t")
    )

    for g in grns:
        item = g.purchase_order_item
        dummy = g.dummy_purchase_order_item

        if item:
            po_qty = item.quantity or Decimal("0")
            received_total = real_totals.get(item.id, Decimal("0"))
            thickness = item.thickness or DASH
            length = item.length or ""
            width = item.width or ""
            material_code = item.item_code or DASH
            supplier = _supplier_name(item.purchase_order.vendor)
            po_type = "Actual PO"
        else:
            po_qty = dummy.quantity or Decimal("0")
            received_total = dummy_totals.get(dummy.id, Decimal("0"))
            thickness = dummy.thickness or DASH
            length = dummy.length or ""
            width = dummy.width or ""
            material_code = dummy.item_code or DASH
            supplier = "Dummy / Internal"
            po_type = "Dummy PO"

        if received_total >= po_qty and po_qty > 0:
            grn_status = "Fully Received"
        elif received_total > 0:
            grn_status = "Partially Received"
        else:
            grn_status = "Not Received"

        rows.append({
            "id": f"grn-{g.id}",
            "grnNumber": _d(g.grn_number),
            "grnDate": _iso(g.grn_date),
            "poType": po_type,
            "poNumber": _d(g.po_number),
            "supplier": supplier,
            "description": _d(g.description),
            "material": _d(g.material),
            "materialCode": material_code,
            "thickness": thickness,
            "size": f"{length} x {width}" if length and width else DASH,
            "receivedQty": _f(g.received_qty),
            "balanceQty": _f(po_qty - received_total),
            "inspectionStatus": "Accepted",
            "grnStatus": grn_status,
            "receivingUnit": _d(g.receiving_unit),
            "inspectedBy": DASH,
            "receivedBy": _d(g.received_by),
            "remarks": _d(g.remarks),
        })

    return rows


# =====================================================================
# 3 — MATERIAL STOCK
# =====================================================================

def build_material_stock_rows():
    from .models import MaterialStock

    rows = []

    for lot in (
        MaterialStock.objects
        .select_related("project")
        .order_by("-created_at")
    ):
        avail = lot.available_qty
        if avail <= 0:
            continue

        rows.append({
            "id": f"stk-{lot.id}",
            "stockId": lot.stock_id,
            "unit": _d(lot.unit),
            "sourceType": lot.get_source_type_display(),
            "poNumber": _d(lot.po_number),
            "description": _d(lot.description),
            "material": _d(lot.material),
            "materialCode": _d(lot.material_code),
            "materialSpec": _d(lot.material_spec),
            "thickness": _d(lot.thickness),
            "length": _d(lot.length),
            "width": _d(lot.width),
            "size": (
                f"{lot.length} x {lot.width}"
                if lot.length and lot.width else DASH
            ),
            "plateNumber": _d(lot.plate_number),
            "originalQuantity": _f(lot.original_qty),
            "availableQuantity": _f(avail),
            "uom": _d(lot.uom),
            "project": lot.project.name if lot.project else DASH,
            "dwgDescription": _d(lot.dwg_description),
            "revision": _d(lot.revision),
            "stockStatus": _d(lot.stock_status),
            "reworkRequired": "Yes" if lot.rework_required else "No",
            "heatNumber": _d(lot.heat_number),
        })

    return rows


# =====================================================================
# 4 — ISSUE TO JOB WORK
# =====================================================================

def build_issue_to_job_work_rows():
    from .models import JobWorkIssue

    rows = []
    for it in (
        JobWorkIssue.objects
        .select_related("project", "stock")
        .order_by("-created_at")
    ):
        rows.append({
            "id": it.issue_number,
            "date": _iso(it.issue_date),
            "poNumber": _d(it.po_number),
            "description": _d(it.description),
            "project": it.project.name if it.project else DASH,
            "dwg": _d(it.dwg_description),
            "material": _d(it.material),
            "materialCode": _d(it.material_code),
            "materialSpec": _d(it.material_spec),
            "thickness": _d(it.thickness),
            "length": _d(it.length),
            "width": _d(it.width),
            "process": _d(it.process_name),
            "processId": _d(it.process_id),
            "jobWorkType": _d(it.job_work_type),
            "unit": _d(it.job_work_unit),
            "vendor": _d(it.vendor),
            "quantity": _f(it.quantity_issued),
            "uom": _d(it.uom),
            "issuedBy": _d(it.issued_by),
            "status": _d(it.status),
            "revision": _d(it.revision),
        })
    return rows


# =====================================================================
# 5 — RECEIVE FROM JOB WORK
# =====================================================================

def build_receive_from_job_work_rows():
    from .models import JobWorkReceive

    rows = []
    qs = (
        JobWorkReceive.objects
        .select_related("issue", "issue__stock", "project")
        .prefetch_related("output_pieces", "remaining_pieces")
        .order_by("-created_at")
    )

    for r in qs:
        issue = r.issue
        total_out = sum(
            (p.qty or Decimal("0")) for p in r.output_pieces.all()
        )
        rework_pending = any(
            p.rework_required == "Yes"
            for p in r.remaining_pieces.all()
        )
        issued_qty = issue.quantity_issued if issue else Decimal("0")
        returned_qty = issue.quantity_returned if issue else Decimal("0")

        if issue and returned_qty >= issued_qty:
            status = "Fully Received"
        elif issue and returned_qty > 0:
            status = "Partially Received"
        else:
            status = "Not Received"

        rows.append({
            "id": r.receive_number,
            "poType": _po_type(r.po_number),
            "poNumber": _d(r.po_number),
            "supplier": issue.vendor if issue and issue.vendor else DASH,
            "poDescription": _d(r.description),
            "project": r.project.name if r.project else DASH,
            "dwg": _d(r.dwg_description),
            "dwgDescription": _d(r.dwg_description),
            "revision": _d(r.revision),
            "material": _d(r.material),
            "materialCode": _d(r.material_code),
            "materialSpec": _d(r.material_spec),
            "thickness": _d(r.thickness),
            "requiredQty": _f(issued_qty),
            "issuedQty": _f(issued_qty),
            "previouslyReceived": _f(returned_qty),
            "outputQty": _f(total_out),
            "remainingQty": _f(r.remaining_input_qty),
            "uom": _d(r.uom),
            "size": (
                f"{r.length} x {r.width}"
                if r.length and r.width else DASH
            ),
            "unit": issue.job_work_unit if issue and issue.job_work_unit else DASH,
            "jobWorkType": issue.job_work_type if issue else DASH,
            "process": _d(r.process_name),
            "processId": _d(r.process_id),
            "issueDate": _iso(issue.issue_date) if issue else DASH,
            "reworkPending": rework_pending,
            "status": status,
        })
    return rows


# =====================================================================
# 6 — CUTTING / FINISHED PIECES
# =====================================================================

def build_cutting_rows():
    from .models import JobWorkReceivePiece, MaterialStock

    rows = []

    pieces = (
        JobWorkReceivePiece.objects
        .select_related(
            "receive",
            "receive__project",
            "receive__issue",
        )
        .order_by("-receive__created_at", "id")
    )

    for p in pieces:
        receive = p.receive
        rows.append({
            "rowKey": f"out-{p.id}",
            "rowType": "Finished Output",
            "id": receive.receive_number,
            "poNumber": _d(receive.po_number),
            "project": receive.project.name if receive.project else DASH,
            "material": _d(receive.material),
            "materialCode": _d(receive.material_code),
            "thickness": _d(p.thickness or receive.thickness),
            "originalSize": DASH,
            "pieceNo": _d(p.piece_no),
            "size": (
                f"{p.length} × {p.width}"
                if p.length and p.width else DASH
            ),
            "length": _d(p.length),
            "width": _d(p.width),
            "quantity": _f(p.qty),
            "weight": _f(p.weight),
            "unit": _d(receive.uom),
            "reworked": "No",
            "status": "Available",
            "date": _iso(receive.receive_date),
        })

    lots = (
        MaterialStock.objects
        .select_related("project")
        .filter(
            source_type=MaterialStock.SourceType.CUTTING_REMAINING,
        )
    )
    for lot in lots:
        rows.append({
            "rowKey": f"rem-{lot.id}",
            "rowType": "Remaining Balance",
            "id": lot.stock_id,
            "poNumber": _d(lot.po_number),
            "project": lot.project.name if lot.project else DASH,
            "material": _d(lot.material),
            "materialCode": _d(lot.material_code),
            "thickness": _d(lot.thickness),
            "originalSize": (
                f"{lot.length} × {lot.width}"
                if lot.length and lot.width else DASH
            ),
            "pieceNo": _d(lot.plate_number),
            "size": (
                f"{lot.length} × {lot.width}"
                if lot.length and lot.width else DASH
            ),
            "length": _d(lot.length),
            "width": _d(lot.width),
            "quantity": _f(lot.available_qty),
            "weight": 0,
            "unit": _d(lot.uom),
            "reworked": "Yes" if lot.rework_required else "No",
            "status": _d(lot.stock_status),
            "date": DASH,
        })

    return rows


# =====================================================================
# 7 — ISSUE TO PRODUCTION
# =====================================================================

def build_issue_to_production_rows():
    from .models import ProductionIssue

    rows = []
    for it in (
        ProductionIssue.objects
        .select_related("project", "job_work_receive")
        .order_by("-created_at")
    ):
        rows.append({
            "issueId": it.issue_number,
            "issueDate": _iso(it.issue_date),
            "jobWorkId": _d(it.job_work_id),
            "poType": _d(it.po_type),
            "poNumber": _d(it.po_number),
            "supplier": _d(it.supplier),
            "poDescription": _d(it.description),
            "project": it.project.name if it.project else DASH,
            "dwg": _d(it.dwg_description),
            "dwgDescription": _d(it.dwg_description),
            "revision": _d(it.revision),
            "material": _d(it.material),
            "materialCode": _d(it.material_code),
            "materialSpec": _d(it.material_spec),
            "thickness": _d(it.thickness),
            "size": (
                f"{it.length} × {it.width}"
                if it.length and it.width else DASH
            ),
            "unit": _d(it.unit),
            "jobWorkType": _d(it.job_work_type),
            "process": _d(it.process_name),
            "processId": _d(it.process_id),
            "originalReceivedQty": _f(it.original_received_qty),
            "previouslyIssuedQty": _f(it.previously_issued_qty),
            "issuedNow": _f(it.issued_qty),
            "remainingAvailableQty": _f(it.remaining_available_qty),
            "issuedBy": _d(it.issued_by),
            "status": _d(it.status),
        })
    return rows


# =====================================================================
# 8 — PRODUCTION ASSEMBLY INTEGRATION
# =====================================================================

def build_assembly_integration_rows():
    from .models import Assembly

    rows = []
    for asm in (
        Assembly.objects
        .select_related("project")
        .prefetch_related(
            "inputs",
            "inputs__job_work_piece__receive",
            "inputs__source_assembly",
        )
        .order_by("-created_at")
    ):
        materials = [
            i for i in asm.inputs.all() if i.source_type == "material"
        ]
        subs = [
            i for i in asm.inputs.all() if i.source_type == "assembly"
        ]

        dwg_set = {
            i.drawing_number for i in materials if i.drawing_number
        }
        mat_set = {
            i.material_name for i in materials if i.material_name
        }
        po_set = set()
        for i in materials:
            receive = i.job_work_piece.receive if i.job_work_piece else None
            if receive and receive.po_number:
                po_set.add(receive.po_number)

        input_qty = sum(
            (i.use_qty or Decimal("0")) for i in asm.inputs.all()
        )

        if mat_set:
            material_text = " + ".join(sorted(mat_set))
        elif subs:
            material_text = " + ".join(
                f"{s.source_assembly.assembly_id} (assembly)"
                for s in subs
            )
        else:
            material_text = DASH

        rows.append({
            "assemblyId": asm.assembly_id,
            "project": asm.project.code if asm.project else DASH,
            "dwgText": (
                " + ".join(sorted(dwg_set)) if dwg_set else DASH
            ),
            "materialText": material_text,
            "poText": ", ".join(sorted(po_set)) if po_set else DASH,
            "inputQty": _f(input_qty),
            "createdDate": (
                asm.created_at.date().isoformat()
                if asm.created_at else DASH
            ),
            "status": _d(asm.status),
        })
    return rows


# =====================================================================
# 9 — PRODUCTION OPERATION
# =====================================================================

def build_production_operation_rows():
    from .models import AssemblyStageExecution

    rows = []
    stages = (
        AssemblyStageExecution.objects
        .select_related(
            "execution",
            "execution__assembly",
            "execution__assembly__project",
        )
        .prefetch_related("movements")
        .order_by("execution_id", "sequence")
    )

    for s in stages:
        asm = s.execution.assembly

        dwg_set = {
            i.drawing_number
            for i in asm.inputs.all()
            if i.source_type == "material" and i.drawing_number
        }
        dwg_text = " + ".join(sorted(dwg_set)) if dwg_set else DASH

        last_qc = (
            s.movements
            .filter(movement__in=["QC Accept", "QC Reject"])
            .order_by("-created_at")
            .first()
        )

        if last_qc and last_qc.movement == "QC Accept":
            qc_status = "Accepted"
            accepted = _f(last_qc.quantity)
            rejected = 0
            verified_by = _d(last_qc.performed_by)
            qc_date = last_qc.created_at.date().isoformat()
        elif last_qc and last_qc.movement == "QC Reject":
            qc_status = "Rejected"
            accepted = 0
            rejected = _f(last_qc.quantity)
            verified_by = _d(last_qc.performed_by)
            qc_date = last_qc.created_at.date().isoformat()
        elif s.qc_required:
            qc_status = "Pending"
            accepted = rejected = 0
            verified_by = DASH
            qc_date = DASH
        else:
            qc_status = "Not Required"
            accepted = rejected = 0
            verified_by = DASH
            qc_date = DASH

        if s.awaiting_qc_qty > 0:
            process_status = "QC Pending"
        elif s.rework_qty > 0:
            process_status = "Rework Required"
        elif s.released_qty > 0 and s.pending_operation_qty == 0:
            process_status = "Completed"
        elif s.started:
            process_status = "In Progress"
        else:
            process_status = "Waiting For Previous Process"

        rows.append({
            "assemblyId": asm.assembly_id,
            "project": asm.project.code if asm.project else DASH,
            "process": s.name,
            "processId": s.process_id,
            "sequence": s.sequence,
            "dwg": dwg_text,
            "totalQty": _f(
                s.available_qty
                + s.pending_operation_qty
                + s.released_qty
                + s.awaiting_qc_qty
                + s.rework_qty
            ),
            "availableQty": _f(s.available_qty),
            "completedQty": _f(s.released_qty),
            "pendingQty": _f(s.pending_operation_qty),
            "reworkQty": _f(s.rework_qty),
            "performedBy": (
                (last_qc.performed_by if last_qc else None) or DASH
            ),
            "supervisor": (
                (last_qc.supervised_by if last_qc else None) or DASH
            ),
            "startDate": DASH,
            "completionDate": (
                qc_date if qc_status in ("Accepted", "Rejected") else DASH
            ),
            "qcStatus": qc_status,
            "qcVerifiedBy": verified_by,
            "qcDate": qc_date,
            "acceptedQty": accepted,
            "rejectedQty": rejected,
            "processStatus": process_status,
        })
    return rows# =====================================================================
# 10 — REWORK
# =====================================================================

def build_rework_rows():
    from .models import ReworkRecord

    rows = []
    for r in (
        ReworkRecord.objects
        .select_related("project")
        .order_by("-created_at")
    ):
        source_label = (
            "Receive From Job Work"
            if r.source_type == ReworkRecord.Source.JOB_WORK_RECEIVE
            else "Production Operation"
        )
        rows.append({
            "reworkId": r.rework_number,
            "source": source_label,
            "project": r.project.name if r.project else DASH,
            "dwg": _d(r.dwg_description),
            "poNumber": _d(r.po_number),
            "poDescription": _d(r.po_description),
            "assembly": _d(r.assembly_code),
            "material": _d(r.material),
            "pieceNo": _d(r.job_work_piece_no),
            "process": _d(r.process_name),
            "requiredQty": _f(r.required_qty),
            "completedQty": _f(r.completed_qty),
            "balanceQty": _f(
                max(
                    (r.required_qty or 0) - (r.completed_qty or 0),
                    0,
                )
            ),
            "reworkDoneBy": _d(r.rework_by),
            "supervisor": _d(r.supervisor),
            "startDate": (
                r.started_at.date().isoformat() if r.started_at else DASH
            ),
            "startTime": (
                r.started_at.strftime("%H:%M") if r.started_at else DASH
            ),
            "completionDate": (
                r.completed_at.date().isoformat() if r.completed_at else DASH
            ),
            "completionTime": (
                r.completed_at.strftime("%H:%M") if r.completed_at else DASH
            ),
            "status": _d(r.status),
            "remarks": _d(r.reason or r.start_remarks),
        })
    return rows


# =====================================================================
# 11 — DISPATCH
# =====================================================================

def build_dispatch_rows():
    from .models import DispatchTransaction

    rows = []
    for d in (
        DispatchTransaction.objects
        .select_related("assembly_execution")
        .order_by("-dispatch_date", "-created_at")
    ):
        ex = d.assembly_execution
        planned_qty = 1.0

        dispatched_total = (
            DispatchTransaction.objects
            .filter(assembly_execution=ex)
            .aggregate(t=Sum("quantity"))["t"]
            or Decimal("0")
        )
        balance = max(Decimal(str(planned_qty)) - dispatched_total, 0)

        if dispatched_total <= 0:
            dispatch_status = "Ready for Dispatch"
        elif balance > 0:
            dispatch_status = "Partially Dispatched"
        else:
            dispatch_status = "Dispatched"

        rows.append({
            "rowKey": d.dispatch_number,
            "dispatchId": d.dispatch_number,
            "assemblyId": d.assembly_code or DASH,
            "project": d.project_code or DASH,
            "dwgText": d.dwg_description or DASH,
            "revision": d.revision or DASH,
            "description": d.dwg_description or DASH,
            "plannedQty": planned_qty,
            "productionStartDate": DASH,
            "productionEndDate": DASH,
            "duration": DASH,
            "date": _iso(d.dispatch_date),
            "time": _d(d.dispatch_time),
            "dispatchTo": _d(d.dispatch_to),
            "location": _d(d.location),
            "vehicleNumber": _d(d.vehicle_number),
            "transporter": _d(d.transporter),
            "driverName": _d(d.driver_name),
            "driverContact": _d(d.driver_contact),
            "dispatchQty": _f(d.quantity),
            "dispatchedQty": _f(dispatched_total),
            "balanceQty": _f(balance),
            "dispatchStatus": dispatch_status,
            "remarks": _d(d.remarks),
            "dateDiff": DASH,
            "dcChallanNumber": _d(d.dc_challan_number),
        })
    return rows


# =====================================================================
# 12 — MATERIAL MOVEMENT HISTORY  (project + PO scoped)
# =====================================================================

def _movement_id(n):
    return f"MOV-{n:04d}"


def _project_of_real_item(po_item_id):
    from .models import BOMPOIntegration
    row = (
        BOMPOIntegration.objects
        .filter(purchase_order_item_id=po_item_id)
        .select_related("project")
        .order_by("-created_at")
        .first()
    )
    return row.project if row else None


def _project_of_dummy_item(dummy_id):
    from .models import BOMPOIntegration
    row = (
        BOMPOIntegration.objects
        .filter(dummy_purchase_order_item_id=dummy_id)
        .select_related("project")
        .order_by("-created_at")
        .first()
    )
    return row.project if row else None


def build_movement_events(project_id=None, po_number=None):
    """
    Flat list of every material movement event, optionally scoped
    to one project and/or one PO.

    Every row carries projectId / projectCode / projectName so the
    grouped view can bucket correctly.
    """
    from .models import (
        MaterialGRN,
        JobWorkIssue,
        JobWorkReceive,
        ProductionIssue,
        ReworkRecord,
        MaterialStockMovement,
        DispatchTransaction,
    )

    rows = []
    counter = {"n": 0}

    def push(date_str, mtype, source, destination, **extra):
        counter["n"] += 1
        rows.append({
            "movementId": _movement_id(counter["n"]),
            "date": date_str,
            "time": extra.get("time", DASH),
            "movementType": mtype,
            "source": source,
            "destination": destination,

            "projectId": extra.get("projectId"),
            "projectCode": extra.get("projectCode", DASH),
            "projectName": extra.get("projectName", DASH),

            "po": extra.get("po", DASH),
            "poDescription": extra.get("poDesc", DASH),
            "poItemCode": extra.get("poItemCode", DASH),

            "dwg": extra.get("dwg", DASH),
            "assembly": extra.get("assembly", DASH),

            "material": extra.get("material", DASH),
            "thickness": extra.get("thick", DASH),
            "size": extra.get("size", DASH),
            "pieceNumber": extra.get("piece", DASH),

            "quantity": extra.get("qty", DASH),
            "unit": extra.get("unit", DASH),
            "referenceId": extra.get("ref", DASH),
            "status": extra.get("status", DASH),
            "process": extra.get("process", DASH),
        })

    # -------- GRN --------
    grn_qs = MaterialGRN.objects.select_related(
        "purchase_order_item",
        "dummy_purchase_order_item",
    )
    if po_number:
        grn_qs = grn_qs.filter(po_number=po_number)

    for g in grn_qs:
        item = g.purchase_order_item or g.dummy_purchase_order_item
        project = None
        if g.purchase_order_item_id:
            project = _project_of_real_item(g.purchase_order_item_id)
        elif g.dummy_purchase_order_item_id:
            project = _project_of_dummy_item(g.dummy_purchase_order_item_id)

        if project_id and (not project or project.id != project_id):
            continue

        push(
            _iso(g.grn_date),
            "GRN Received",
            g.po_number or DASH,
            f"Material Stock ({g.receiving_unit or '—'})",
            projectId=project.id if project else None,
            projectCode=project.code if project else DASH,
            projectName=project.name if project else DASH,
            po=g.po_number,
            poDesc=g.description,
            poItemCode=(item.item_code if item else DASH),
            material=g.material or DASH,
            qty=_f(g.received_qty),
            unit=(item.unit if item else DASH),
            ref=g.grn_number,
            status="Accepted",
            thick=(item.thickness if item else DASH),
            size=(
                f"{item.length} x {item.width}"
                if item and item.length and item.width else DASH
            ),
        )

    # -------- Issue to Job Work --------
    ji_qs = JobWorkIssue.objects.select_related("project")
    if project_id:
        ji_qs = ji_qs.filter(project_id=project_id)
    if po_number:
        ji_qs = ji_qs.filter(po_number=po_number)

    for j in ji_qs:
        push(
            _iso(j.issue_date),
            "Issued to Job Work",
            "Material Stock",
            f"{j.process_name or '—'} ({j.job_work_type or '—'})",
            projectId=j.project_id,
            projectCode=j.project.code if j.project else DASH,
            projectName=j.project.name if j.project else DASH,
            po=j.po_number,
            poDesc=j.description,
            dwg=j.dwg_description,
            material=j.material,
            qty=_f(j.quantity_issued),
            unit=j.uom,
            ref=j.issue_number,
            status=j.status,
            process=j.process_name,
        )

    # -------- Receive from Job Work --------
    jwr_qs = JobWorkReceive.objects.select_related("project", "issue")
    if project_id:
        jwr_qs = jwr_qs.filter(project_id=project_id)
    if po_number:
        jwr_qs = jwr_qs.filter(po_number=po_number)

    for r in jwr_qs:
        push(
            _iso(r.receive_date),
            "Received from Job Work",
            r.process_name or DASH,
            "Material Stock / Rework",
            projectId=r.project_id,
            projectCode=r.project.code if r.project else DASH,
            projectName=r.project.name if r.project else DASH,
            po=r.po_number,
            poDesc=r.description,
            dwg=r.dwg_description,
            material=r.material,
            qty=_f(r.completed_input_qty),
            unit=r.uom,
            ref=r.receive_number,
            status=r.issue.status if r.issue else DASH,
            thick=r.thickness,
            size=(
                f"{r.length} x {r.width}"
                if r.length and r.width else DASH
            ),
            process=r.process_name,
        )

    # -------- Rework --------
    rw_qs = ReworkRecord.objects.select_related("project")
    if project_id:
        rw_qs = rw_qs.filter(project_id=project_id)
    if po_number:
        rw_qs = rw_qs.filter(po_number=po_number)

    for rw in rw_qs:
        date_str = (
            rw.completed_at.date().isoformat() if rw.completed_at
            else (rw.started_at.date().isoformat() if rw.started_at else DASH)
        )
        push(
            date_str,
            "Rework Completed" if rw.completed_at else "Rework Required",
            "Receive From Job Work"
            if rw.source_type == ReworkRecord.Source.JOB_WORK_RECEIVE
            else "Production Operation",
            (
                "Material Stock"
                if rw.status == ReworkRecord.Status.AVAILABLE_STOCK
                else "Rework"
            ),
            projectId=rw.project_id,
            projectCode=rw.project.code if rw.project else DASH,
            projectName=rw.project.name if rw.project else DASH,
            po=rw.po_number,
            poDesc=rw.po_description,
            dwg=rw.dwg_description,
            assembly=rw.assembly_code,
            material=rw.material,
            piece=rw.job_work_piece_no,
            qty=_f(rw.completed_qty or rw.required_qty),
            unit=rw.unit,
            ref=rw.rework_number,
            status=rw.status,
            process=rw.process_name,
        )

    # -------- Issue to Production --------
    pi_qs = ProductionIssue.objects.select_related("project")
    if project_id:
        pi_qs = pi_qs.filter(project_id=project_id)
    if po_number:
        pi_qs = pi_qs.filter(po_number=po_number)

    for p in pi_qs:
        push(
            _iso(p.issue_date),
            "Issued to Production",
            "Material Stock",
            "Production Assembly Integration",
            projectId=p.project_id,
            projectCode=p.project.code if p.project else DASH,
            projectName=p.project.name if p.project else DASH,
            po=p.po_number,
            poDesc=p.description,
            dwg=p.dwg_description,
            material=p.material,
            qty=_f(p.issued_qty),
            unit=p.uom,
            ref=p.issue_number,
            status=p.status,
            thick=p.thickness,
            size=(
                f"{p.length} x {p.width}"
                if p.length and p.width else DASH
            ),
            process=p.process_name,
        )

    # -------- Stock movements --------
    mv_qs = MaterialStockMovement.objects.select_related(
        "stock", "stock__project"
    )
    if project_id:
        mv_qs = mv_qs.filter(stock__project_id=project_id)
    if po_number:
        mv_qs = mv_qs.filter(stock__po_number=po_number)

    for mv in mv_qs:
        stock = mv.stock
        push(
            mv.created_at.date().isoformat(),
            f"Stock {mv.get_direction_display()} — {mv.get_movement_type_display()}",
            mv.get_movement_type_display(),
            stock.unit or "—",
            projectId=stock.project_id,
            projectCode=stock.project.code if stock.project else DASH,
            projectName=stock.project.name if stock.project else DASH,
            po=stock.po_number,
            poDesc=stock.description,
            dwg=stock.dwg_description,
            material=stock.material,
            piece=stock.plate_number,
            qty=_f(mv.quantity),
            unit=stock.uom,
            ref=stock.stock_id,
            status=mv.get_direction_display(),
            thick=stock.thickness,
            size=(
                f"{stock.length} x {stock.width}"
                if stock.length and stock.width else DASH
            ),
        )

    # -------- Dispatch --------
    disp_qs = DispatchTransaction.objects.select_related(
        "assembly_execution",
        "assembly_execution__assembly",
        "assembly_execution__assembly__project",
    )
    if project_id:
        disp_qs = disp_qs.filter(
            assembly_execution__assembly__project_id=project_id
        )

    for d in disp_qs:
        ex = d.assembly_execution
        project = ex.assembly.project if ex and ex.assembly else None
        push(
            _iso(d.dispatch_date),
            "Dispatched",
            "Production Operation (Completed)",
            d.location or "—",
            projectId=project.id if project else None,
            projectCode=project.code if project else DASH,
            projectName=project.name if project else DASH,
            assembly=d.assembly_code,
            material=d.dwg_description,
            qty=_f(d.quantity),
            unit="Nos",
            ref=d.dispatch_number,
            status="Dispatched",
        )

    rows.sort(key=lambda r: (r["date"], r["movementId"]))
    for idx, r in enumerate(rows, start=1):
        r["movementId"] = _movement_id(idx)
    return rows


def _first_real(events, field):
    for e in events:
        v = e.get(field)
        if v and v != DASH:
            return v
    return DASH


def _distinct(events, field):
    return sorted({
        str(e.get(field)).strip()
        for e in events
        if e.get(field) not in (None, "", DASH)
    })


def build_movement_groups(events):
    """
    One PO always produces exactly one group.
    Assemblies get their own group.
    Stock-only rows without a PO fall back to (project, referenceId).
    """
    buckets = {}

    for r in events:
        pid = r.get("projectId")
        po = r.get("po")
        assembly = r.get("assembly")
        ref = r.get("referenceId")

        if po and po != DASH:
            key = f"PO::{pid}::{po}"
        elif assembly and assembly != DASH:
            key = f"ASM::{pid}::{assembly}"
        else:
            key = f"REF::{pid}::{ref}"

        buckets.setdefault(key, []).append(r)

    groups = []
    for key, evs in buckets.items():
        evs.sort(key=lambda e: (e["date"], e["movementId"]))
        latest = evs[-1]

        pieces = _distinct(evs, "pieceNumber")
        materials = _distinct(evs, "material")
        processes = _distinct(evs, "process")
        dwgs = _distinct(evs, "dwg")
        po_items = _distinct(evs, "poItemCode")

        groups.append({
            "groupKey": key,
            "projectId": latest.get("projectId"),
            "projectCode": latest.get("projectCode", DASH),
            "projectName": latest.get("projectName", DASH),

            "poNumber": _first_real(evs, "po"),
            "poDescription": _first_real(evs, "poDescription"),
            "poItemCodes": po_items,

            "dwg": (
                dwgs[0] if len(dwgs) == 1
                else (" + ".join(dwgs) if dwgs else DASH)
            ),
            "assembly": _first_real(evs, "assembly"),

            "material": (
                materials[0] if len(materials) == 1
                else (" + ".join(materials) if materials else DASH)
            ),
            "thickness": _first_real(evs, "thickness"),
            "size": _first_real(evs, "size"),
            "unit": latest.get("unit") or _first_real(evs, "unit"),

            "process": (
                processes[0] if len(processes) == 1
                else (" + ".join(processes) if processes else DASH)
            ),

            "pieceLabel": ", ".join(pieces) if pieces else DASH,
            "qtyLabel": (
                f"{latest.get('quantity')}"
                f"{' ' + latest.get('unit') if latest.get('unit') and latest.get('unit') != DASH else ''}"
            ),

            "currentStage": latest["movementType"],
            "currentStatus": latest["status"],
            "currentLocation": latest["destination"],
            "lastMovementDate": latest["date"],
            "eventCount": len(evs),
            "events": evs,
        })

    groups.sort(
        key=lambda g: (g["lastMovementDate"], g["groupKey"]),
        reverse=True,
    )
    return groups


# =====================================================================
# PROJECT + PO SEARCH INDEXES (for the picker)
# =====================================================================

def search_project_index(query=""):
    """
    Projects with any movement activity. Optional free-text filter
    against code or name.
    """
    from .models import (
        BOMPOIntegration,
        MaterialGRN,
        JobWorkIssue,
        JobWorkReceive,
        ProductionIssue,
        ReworkRecord,
        MaterialStock,
        DispatchTransaction,
        Project,
    )

    project_ids = set()

    real_po_ids = (
        MaterialGRN.objects
        .filter(purchase_order_item__isnull=False)
        .values_list("purchase_order_item_id", flat=True)
    )
    dummy_item_ids = (
        MaterialGRN.objects
        .filter(dummy_purchase_order_item__isnull=False)
        .values_list("dummy_purchase_order_item_id", flat=True)
    )

    project_ids |= set(
        BOMPOIntegration.objects
        .filter(purchase_order_item_id__in=real_po_ids)
        .values_list("project_id", flat=True)
    )
    project_ids |= set(
        BOMPOIntegration.objects
        .filter(dummy_purchase_order_item_id__in=dummy_item_ids)
        .values_list("project_id", flat=True)
    )

    project_ids |= set(
        JobWorkIssue.objects
        .exclude(project__isnull=True)
        .values_list("project_id", flat=True)
    )
    project_ids |= set(
        JobWorkReceive.objects
        .exclude(project__isnull=True)
        .values_list("project_id", flat=True)
    )
    project_ids |= set(
        ProductionIssue.objects
        .exclude(project__isnull=True)
        .values_list("project_id", flat=True)
    )
    project_ids |= set(
        ReworkRecord.objects
        .exclude(project__isnull=True)
        .values_list("project_id", flat=True)
    )
    project_ids |= set(
        MaterialStock.objects
        .exclude(project__isnull=True)
        .values_list("project_id", flat=True)
    )
    project_ids |= set(
        DispatchTransaction.objects
        .exclude(assembly_execution__assembly__project__isnull=True)
        .values_list(
            "assembly_execution__assembly__project_id", flat=True
        )
    )

    project_ids.discard(None)

    qs = Project.objects.filter(id__in=project_ids)
    q = (query or "").strip()
    if q:
        qs = qs.filter(Q(code__icontains=q) | Q(name__icontains=q))
    qs = qs.order_by("code")

    out = []
    for p in qs[:500]:
        po_count = _count_pos_for_project(p.id)
        movement_count = _count_movements_for_project(p.id)
        last = _last_movement_date_for_project(p.id)
        out.append({
            "projectId": p.id,
            "code": p.code,
            "name": p.name,
            "poCount": po_count,
            "movementCount": movement_count,
            "lastMovementDate": last,
        })
    return out


def search_po_index(query="", project_id=None):
    """POs with movement activity. Optional text search + project filter."""
    from .models import (
        PurchaseOrderItem,
        DummyPurchaseOrderItem,
        BOMPOIntegration,
    )

    q = (query or "").strip()
    results = {}

    real_qs = PurchaseOrderItem.objects.all()
    if q:
        real_qs = real_qs.filter(po_number__icontains=q)
    if project_id:
        real_qs = real_qs.filter(
            id__in=BOMPOIntegration.objects
            .filter(project_id=project_id)
            .values_list("purchase_order_item_id", flat=True)
        )

    for item in real_qs[:500]:
        po = item.po_number
        if not po:
            continue
        if po not in results:
            results[po] = {
                "poNumber": po,
                "poType": "Actual PO",
                "supplier": _supplier_name(
                    item.purchase_order.vendor
                ) if item.purchase_order_id else DASH,
                "projectIds": set(),
            }
        pid = _project_of_real_item(item.id)
        if pid:
            results[po]["projectIds"].add(pid.id)

    dummy_qs = DummyPurchaseOrderItem.objects.select_related("dummy_po")
    if q:
        dummy_qs = dummy_qs.filter(dummy_po__po_number__icontains=q)
    if project_id:
        dummy_qs = dummy_qs.filter(
            id__in=BOMPOIntegration.objects
            .filter(project_id=project_id)
            .values_list("dummy_purchase_order_item_id", flat=True)
        )

    for item in dummy_qs[:500]:
        po = item.dummy_po.po_number
        if not po:
            continue
        if po not in results:
            results[po] = {
                "poNumber": po,
                "poType": "Dummy PO",
                "supplier": "Dummy / Internal",
                "projectIds": set(),
            }
        pid = _project_of_dummy_item(item.id)
        if pid:
            results[po]["projectIds"].add(pid.id)

    out = []
    for entry in results.values():
        entry["projectIds"] = sorted(entry["projectIds"])
        out.append(entry)
    out.sort(key=lambda x: x["poNumber"])
    return out


def _count_pos_for_project(project_id):
    from .models import BOMPOIntegration
    real = set(
        BOMPOIntegration.objects
        .filter(
            project_id=project_id,
            purchase_order_item__isnull=False,
        )
        .values_list("purchase_order_item__po_number", flat=True)
    )
    dummy = set(
        BOMPOIntegration.objects
        .filter(
            project_id=project_id,
            dummy_purchase_order_item__isnull=False,
        )
        .values_list(
            "dummy_purchase_order_item__dummy_po__po_number",
            flat=True,
        )
    )
    real.discard(None); real.discard("")
    dummy.discard(None); dummy.discard("")
    return len(real | dummy)


def _count_movements_for_project(project_id):
    from .models import (
        BOMPOIntegration, MaterialGRN, JobWorkIssue,
        JobWorkReceive, ProductionIssue, ReworkRecord,
        MaterialStock, DispatchTransaction,
    )
    real_ids = BOMPOIntegration.objects.filter(
        project_id=project_id, purchase_order_item__isnull=False
    ).values_list("purchase_order_item_id", flat=True)
    dummy_ids = BOMPOIntegration.objects.filter(
        project_id=project_id, dummy_purchase_order_item__isnull=False
    ).values_list("dummy_purchase_order_item_id", flat=True)

    n = 0
    n += MaterialGRN.objects.filter(
        Q(purchase_order_item_id__in=real_ids)
        | Q(dummy_purchase_order_item_id__in=dummy_ids)
    ).count()
    n += JobWorkIssue.objects.filter(project_id=project_id).count()
    n += JobWorkReceive.objects.filter(project_id=project_id).count()
    n += ProductionIssue.objects.filter(project_id=project_id).count()
    n += ReworkRecord.objects.filter(project_id=project_id).count()
    n += MaterialStock.objects.filter(project_id=project_id).count()
    n += DispatchTransaction.objects.filter(
        assembly_execution__assembly__project_id=project_id
    ).count()
    return n


def _last_movement_date_for_project(project_id):
    from .models import (
        BOMPOIntegration, MaterialGRN, JobWorkIssue,
        JobWorkReceive, ProductionIssue, ReworkRecord,
        DispatchTransaction,
    )
    real_ids = BOMPOIntegration.objects.filter(
        project_id=project_id, purchase_order_item__isnull=False
    ).values_list("purchase_order_item_id", flat=True)
    dummy_ids = BOMPOIntegration.objects.filter(
        project_id=project_id, dummy_purchase_order_item__isnull=False
    ).values_list("dummy_purchase_order_item_id", flat=True)

    cands = []

    d = (MaterialGRN.objects
         .filter(Q(purchase_order_item_id__in=real_ids)
                 | Q(dummy_purchase_order_item_id__in=dummy_ids))
         .order_by("-grn_date")
         .values_list("grn_date", flat=True).first())
    if d: cands.append(d.isoformat())

    d = (JobWorkIssue.objects.filter(project_id=project_id)
         .order_by("-issue_date")
         .values_list("issue_date", flat=True).first())
    if d: cands.append(d.isoformat())

    d = (JobWorkReceive.objects.filter(project_id=project_id)
         .order_by("-receive_date")
         .values_list("receive_date", flat=True).first())
    if d: cands.append(d.isoformat())

    d = (ProductionIssue.objects.filter(project_id=project_id)
         .order_by("-issue_date")
         .values_list("issue_date", flat=True).first())
    if d: cands.append(d.isoformat())

    d = (ReworkRecord.objects.filter(project_id=project_id)
         .order_by("-created_at")
         .values_list("created_at", flat=True).first())
    if d: cands.append(d.date().isoformat())

    d = (DispatchTransaction.objects
         .filter(assembly_execution__assembly__project_id=project_id)
         .order_by("-dispatch_date")
         .values_list("dispatch_date", flat=True).first())
    if d: cands.append(d.isoformat())

    return max(cands) if cands else DASH