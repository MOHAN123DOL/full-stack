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