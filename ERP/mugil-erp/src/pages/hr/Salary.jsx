import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useEmployees } from "./Employees.jsx";
import {
  useAttendance,
  summarizeRange,
  monthRange,
  currentMonthStr,
  formatINR,
  formatHours,
} from "./Attendancewages.jsx";
import {
  useSalaryPayments,
  useAdvances,
  PaymentStatusBadge,
  AdvanceStatusBadge,
  Banner,
  ConfirmDialog,
  FilterBar,
  ExportBar,
  useRecordFilters,
  formatFilterSummary,
  salaryMonthLabel,
  exportToCSV,
  exportToExcel,
  exportToPDF,
  printRecords,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  ADVANCE_STATUSES,
  ADVANCE_STATUS_LABELS,
  formatDisplayDate,
} from "./Payroll.jsx";
import "./Salary.css";
import "./Payroll.css";

/* ==========================================================================
   NOTE ON SCOPE
   --------------------------------------------------------------------------
   No Employee Salary page or salary data model existed in the codebase this
   was built against, so this file introduces a minimal one rather than
   guessing at an architecture that isn't there. It defines a small,
   editable set of salary components (allowances / PF / ESI / tax / other
   deductions / advance deduction) per employee per month, kept in-memory
   the same way the Employees and Attendance modules are. If a real payroll
   backend/module already exists elsewhere in the app, wire that in here
   instead of this local SalaryAdjustmentsProvider.

   Salary payment records ("Save Salary") and employee advances live in the
   sibling Payroll.jsx module (PayrollProvider), which must be mounted
   alongside AttendanceProvider / SalaryAdjustmentsProvider — see that
   file's header comment.
   ========================================================================== */

function blankAdjustments() {
  return {
    allowances: 0,
    overtime: 0,
    pf: 0,
    esi: 0,
    tax: 0,
    otherDeductions: 0,
    advanceDeduction: 0,
  };
}

const SalaryContext = createContext(null);

export function useSalaryAdjustments() {
  const ctx = useContext(SalaryContext);
  if (!ctx)
    throw new Error(
      "useSalaryAdjustments must be used within SalaryAdjustmentsProvider",
    );
  return ctx;
}

export function SalaryAdjustmentsProvider({ children }) {
  const [store, setStore] = useState({});

  function key(employeeId, month) {
    return `${employeeId}__${month}`;
  }

  const getAdjustments = useCallback(
    (employeeId, month) => store[key(employeeId, month)] || blankAdjustments(),
    [store],
  );

  const setAdjustments = useCallback((employeeId, month, updates) => {
    setStore((prev) => ({
      ...prev,
      [key(employeeId, month)]: {
        ...blankAdjustments(),
        ...prev[key(employeeId, month)],
        ...updates,
      },
    }));
  }, []);

  const value = useMemo(
    () => ({ getAdjustments, setAdjustments }),
    [getAdjustments, setAdjustments],
  );

  return (
    <SalaryContext.Provider value={value}>{children}</SalaryContext.Provider>
  );
}

/* ==========================================================================
   SMALL SHARED UI PIECES
   ========================================================================== */

function EmployeeSelect({ value, onChange, employees }) {
  return (
    <select
      className="sal-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {employees.map((e) => (
        <option key={e.id} value={e.id}>
          {e.firstName} {e.lastName} — {e.id}
        </option>
      ))}
    </select>
  );
}

function NumberField({ label, value, onChange, hint, error }) {
  return (
    <label className="sal-field">
      <span className="sal-field-label">{label}</span>
      <input
        className="sal-input"
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span className="pll-error">{error}</span>}
      {!error && hint && <span className="sal-hint">{hint}</span>}
    </label>
  );
}

function monthLabel(monthStr) {
  return salaryMonthLabel(monthStr);
}

function employeeName(employees, id) {
  const e = employees.find((emp) => emp.id === id);
  return e ? `${e.firstName} ${e.lastName}` : id;
}

/* ==========================================================================
   SALARY CALCULATOR TAB (Employee + Period → Overview → Attendance/Base →
   Components → Advance Summary → Calculation → Save)
   ========================================================================== */

function SalaryCalculatorTab({
  employeeId,
  setEmployeeId,
  month,
  setMonth,
  activeEmployees,
  onSaved,
  onViewExisting,
}) {
  const { getWageConfig } = useAttendance();
  const { records } = useAttendance();
  const { getAdjustments, setAdjustments } = useSalaryAdjustments();
  const { getOutstandingAdvance } = useAdvances();
  const { getSalaryPayment, saveSalaryPayment } = useSalaryPayments();

  const [saveDialog, setSaveDialog] = useState(null); // { mode: 'duplicate' | 'confirm', existing? }
  const [statusChoice, setStatusChoice] = useState("PAID");
  const [remarksInput, setRemarksInput] = useState("");
  const [negativeAck, setNegativeAck] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const employee = activeEmployees.find((e) => e.id === employeeId);
  const config = getWageConfig(employeeId);
  const { start, end } = monthRange(month);
  const summary = summarizeRange(records, start, end, employeeId)[
    employeeId
  ] || {
    daysWorked: 0,
    totalHours: 0,
    totalWage: 0,
    statusCounts: {},
  };

  const isHourly = config.salaryType === "HOURLY";
  const baseAmount = isHourly
    ? summary.totalWage
    : Number(config.monthlySalary) || 0;

  const draft = getAdjustments(employeeId, month);
  const outstandingAdvance = getOutstandingAdvance(employeeId);

  function updateDraft(field, value) {
    setAdjustments(employeeId, month, {
      [field]: value === "" ? 0 : Number(value),
    });
  }

  const allowances = Number(draft.allowances) || 0;
  const overtime = Number(draft.overtime) || 0;
  const pf = Number(draft.pf) || 0;
  const esi = Number(draft.esi) || 0;
  const tax = Number(draft.tax) || 0;
  const otherDeductions = Number(draft.otherDeductions) || 0;
  const advanceDeduction = Number(draft.advanceDeduction) || 0;

  const grossEarnings = baseAmount + allowances + overtime;
  const normalDeductions = pf + esi + tax + otherDeductions;
  const totalDeductions = normalDeductions + advanceDeduction;
  const netSalary = grossEarnings - totalDeductions;

  const advanceExceedsOutstanding = advanceDeduction > outstandingAdvance;
  const remainingAfterDeduction = Math.max(
    0,
    outstandingAdvance - advanceDeduction,
  );

  function buildPayload(paymentStatus, paidDate, remarks) {
    return {
      employeeId,
      salaryMonth: month,
      baseSalary: isHourly ? 0 : baseAmount,
      attendanceWage: isHourly ? baseAmount : 0,
      allowances,
      overtime,
      grossEarnings,
      pf,
      esi,
      tax,
      otherDeductions,
      advanceDeduction,
      totalDeductions,
      netSalary,
      paymentStatus,
      paidDate,
      remarks,
    };
  }

  function openSaveFlow() {
    if (!employee) {
      alert("Select an employee before saving salary.");
      return;
    }
    if (!month) {
      alert("Select a salary month before saving salary.");
      return;
    }
    if (advanceExceedsOutstanding) {
      alert(
        `Advance deduction (${formatINR(advanceDeduction)}) cannot exceed the outstanding advance (${formatINR(outstandingAdvance)}).`,
      );
      return;
    }
    const existing = getSalaryPayment(employeeId, month);
    setStatusChoice(existing?.paymentStatus || "PAID");
    setRemarksInput(existing?.remarks || "");
    setNegativeAck(false);
    if (existing) {
      setSaveDialog({ mode: "duplicate", existing });
    } else {
      setSaveDialog({ mode: "confirm" });
    }
  }

  function confirmSave(isUpdate) {
    const paidDate = statusChoice === "PAID" ? new Date().toISOString().slice(0, 10) : null;
    const payload = buildPayload(statusChoice, paidDate, remarksInput);
    const result = saveSalaryPayment(payload, { allowUpdate: isUpdate });
    if (result.status === "duplicate") {
      // Race: someone else saved between our check and now — surface it.
      setSaveDialog({ mode: "duplicate", existing: result.existing });
      return;
    }
    setSaveDialog(null);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 3500);
    onSaved?.(result.record);
  }

  return (
    <div>
      {savedFlash && (
        <Banner kind="success" onClose={() => setSavedFlash(false)}>
          Salary saved successfully.
        </Banner>
      )}

      <div className="sal-toolbar">
        <label className="sal-field">
          <span className="sal-field-label">Employee</span>
          <EmployeeSelect
            value={employeeId}
            onChange={setEmployeeId}
            employees={activeEmployees}
          />
        </label>
        <label className="sal-field">
          <span className="sal-field-label">Salary Period</span>
          <input
            className="sal-input"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>

      {employee && (
        <div className="sal-card">
          <div className="sal-card-head">
            <div>
              <h2>
                {employee.firstName} {employee.lastName}
              </h2>
              <span className="sal-hint">
                {employee.id} · {employee.designation} · {monthLabel(month)}
              </span>
            </div>
            <span
              className={`sal-type-pill ${isHourly ? "sal-type-hourly" : "sal-type-monthly"}`}
            >
              {isHourly ? "Hourly Wage" : "Monthly Salary"}
            </span>
          </div>

          {isHourly ? (
            <div className="sal-section">
              <h3>Attendance Summary</h3>
              <div className="sal-attendance-grid">
                <div>
                  <span className="sal-mini-label">Working Days</span>
                  <span className="sal-mini-value">{summary.daysWorked}</span>
                </div>
                <div>
                  <span className="sal-mini-label">Total Hours</span>
                  <span className="sal-mini-value">
                    {formatHours(summary.totalHours)}
                  </span>
                </div>
                <div>
                  <span className="sal-mini-label">Hourly Wage</span>
                  <span className="sal-mini-value">
                    ₹{config.hourlyRate || 0}
                  </span>
                </div>
                <div>
                  <span className="sal-mini-label">Attendance Wage</span>
                  <span className="sal-mini-value">
                    {formatINR(summary.totalWage)}
                  </span>
                </div>
              </div>
              <p className="sal-hint">
                Calculated from each day's stored attendance and the hourly rate
                snapshotted on that record — not the current rate — so past
                months stay correct even if the rate has since changed. Edit or
                add records on the <strong>HR Attendance &amp; Wages</strong>{" "}
                page.
              </p>
            </div>
          ) : (
            <div className="sal-section">
              <h3>Base Salary</h3>
              <div className="sal-attendance-grid">
                <div>
                  <span className="sal-mini-label">Monthly Salary</span>
                  <span className="sal-mini-value">
                    {formatINR(config.monthlySalary)}
                  </span>
                </div>
              </div>
              <p className="sal-hint">
                This employee is on a fixed monthly salary, so attendance does
                not change the base amount. Configure the rate on the HR
                Attendance &amp; Wages → Wage Rates tab.
              </p>
            </div>
          )}

          <div className="sal-section">
            <h3>Salary Components</h3>
            <div className="sal-components-grid">
              <NumberField
                label="Allowances"
                value={draft.allowances}
                onChange={(v) => updateDraft("allowances", v)}
              />
              <NumberField
                label="Overtime"
                value={draft.overtime}
                onChange={(v) => updateDraft("overtime", v)}
                hint="No existing overtime system was found to integrate with — entered manually for now."
              />
              <NumberField
                label="PF Deduction"
                value={draft.pf}
                onChange={(v) => updateDraft("pf", v)}
              />
              <NumberField
                label="ESI Deduction"
                value={draft.esi}
                onChange={(v) => updateDraft("esi", v)}
              />
              <NumberField
                label="Tax (TDS)"
                value={draft.tax}
                onChange={(v) => updateDraft("tax", v)}
              />
              <NumberField
                label="Other Deductions"
                value={draft.otherDeductions}
                onChange={(v) => updateDraft("otherDeductions", v)}
              />
            </div>
          </div>

          <div className="pll-section">
            <h3>Advance Summary</h3>
            <div className="pll-advance-summary">
              <div className="pll-advance-summary-row">
                <span>Outstanding Advance</span>
                <strong>{formatINR(outstandingAdvance)}</strong>
              </div>
              <div className="pll-advance-summary-row">
                <span>This Month Deduction</span>
                <strong>{formatINR(advanceDeduction)}</strong>
              </div>
              <div className="pll-advance-summary-row pll-advance-remaining">
                <span>Remaining After Deduction</span>
                <strong>{formatINR(remainingAfterDeduction)}</strong>
              </div>
            </div>
            <div className="sal-components-grid" style={{ marginTop: 12 }}>
              <NumberField
                label="Advance Deduction"
                value={draft.advanceDeduction}
                onChange={(v) => updateDraft("advanceDeduction", v)}
                hint={
                  outstandingAdvance > 0
                    ? `Up to ${formatINR(outstandingAdvance)} outstanding.`
                    : "No outstanding advance for this employee."
                }
                error={
                  advanceExceedsOutstanding
                    ? `Cannot exceed outstanding advance of ${formatINR(outstandingAdvance)}.`
                    : undefined
                }
              />
            </div>
            <p className="sal-hint">
              The advance received was already paid to the employee earlier and is
              not part of gross earnings. Only the deduction entered here reduces
              this month's net salary, and it reduces the employee's outstanding
              advance once saved.
            </p>
          </div>

          <div className="sal-totals">
            <div className="sal-totals-row">
              <span>{isHourly ? "Attendance Wage" : "Basic Salary"}</span>
              <span>{formatINR(baseAmount)}</span>
            </div>
            <div className="sal-totals-row">
              <span>Allowances + Overtime</span>
              <span>+ {formatINR(allowances + overtime)}</span>
            </div>
            <div className="sal-totals-row sal-totals-sub">
              <span>Gross Earnings</span>
              <span>{formatINR(grossEarnings)}</span>
            </div>
            <div className="sal-totals-row">
              <span>PF + ESI + Tax + Other Deductions</span>
              <span>− {formatINR(normalDeductions)}</span>
            </div>
            <div className="sal-totals-row">
              <span>Advance Deduction</span>
              <span>− {formatINR(advanceDeduction)}</span>
            </div>
            <div className="sal-totals-row sal-totals-net">
              <span>Net Salary</span>
              <span>{formatINR(netSalary)}</span>
            </div>
            {netSalary < 0 && (
              <Banner kind="warning">
                Deductions exceed earnings — net salary is negative. You'll need
                to confirm this explicitly to save.
              </Banner>
            )}
          </div>

          <div className="sal-section" style={{ textAlign: "right" }}>
            <button type="button" className="pll-btn-primary" onClick={openSaveFlow}>
              Save Salary
            </button>
          </div>
        </div>
      )}

      {saveDialog?.mode === "duplicate" && (
        <ConfirmDialog
          title="Salary already saved"
          message={`Salary already saved for this employee for ${monthLabel(month)}.`}
          confirmLabel="Update Salary"
          cancelLabel="Cancel"
          onCancel={() => setSaveDialog(null)}
          onConfirm={() => setSaveDialog({ mode: "confirm", existing: saveDialog.existing, isUpdate: true })}
        >
          <button
            type="button"
            className="pll-btn-outline pll-btn-sm"
            style={{ marginBottom: 10 }}
            onClick={() => {
              setSaveDialog(null);
              onViewExisting?.(saveDialog.existing);
            }}
          >
            View Saved Salary
          </button>
        </ConfirmDialog>
      )}

      {saveDialog?.mode === "confirm" && (
        <ConfirmDialog
          title={saveDialog.isUpdate ? "Update saved salary?" : "Save salary?"}
          message={`${saveDialog.isUpdate ? "Update" : "Save"} salary for ${employee?.firstName} ${employee?.lastName} for ${monthLabel(month)}?`}
          confirmLabel={saveDialog.isUpdate ? "Update Salary" : "Save Salary"}
          onCancel={() => setSaveDialog(null)}
          onConfirm={() => {
            if (netSalary < 0 && !negativeAck) return;
            confirmSave(!!saveDialog.isUpdate);
          }}
        >
          <div className="pll-modal-form-grid">
            <label className="pll-field">
              <span className="pll-field-label">Payment Status</span>
              <select
                className="pll-select"
                value={statusChoice}
                onChange={(e) => setStatusChoice(e.target.value)}
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PAYMENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="pll-field pll-modal-field-wide">
              <span className="pll-field-label">Remarks (optional)</span>
              <input
                className="pll-input"
                type="text"
                value={remarksInput}
                onChange={(e) => setRemarksInput(e.target.value)}
              />
            </label>
          </div>
          {netSalary < 0 && (
            <label className="pll-hint" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={negativeAck}
                onChange={(e) => setNegativeAck(e.target.checked)}
              />
              I understand net salary for this record is negative and want to save it anyway.
            </label>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}

/* ==========================================================================
   VIEW SALARY MODAL (read-only, exact saved snapshot)
   ========================================================================== */

function ViewSalaryModal({ record, employees, onClose, onPrint }) {
  if (!record) return null;
  return (
    <div className="pll-modal-overlay" onClick={onClose}>
      <div className="pll-modal pll-modal-wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>
          {employeeName(employees, record.employeeId)} — {salaryMonthLabel(record.salaryMonth)}
        </h3>
        <p className="pll-modal-message">
          Saved payroll snapshot. These values are frozen at the time of payment and do not
          change if wage rates or attendance are edited later.
        </p>
        <dl className="pll-view-grid">
          <dt>Base Salary</dt><dd>{formatINR(record.baseSalary)}</dd>
          <dt>Attendance Wage</dt><dd>{formatINR(record.attendanceWage)}</dd>
          <dt>Allowances</dt><dd>{formatINR(record.allowances)}</dd>
          <dt>Overtime</dt><dd>{formatINR(record.overtime)}</dd>
          <dt>Gross Earnings</dt><dd>{formatINR(record.grossEarnings)}</dd>
          <dt>PF</dt><dd>{formatINR(record.pf)}</dd>
          <dt>ESI</dt><dd>{formatINR(record.esi)}</dd>
          <dt>Tax</dt><dd>{formatINR(record.tax)}</dd>
          <dt>Other Deductions</dt><dd>{formatINR(record.otherDeductions)}</dd>
          <dt>Advance Deduction</dt><dd>{formatINR(record.advanceDeduction)}</dd>
          <dt>Total Deductions</dt><dd>{formatINR(record.totalDeductions)}</dd>
          <dt>Net Salary</dt><dd>{formatINR(record.netSalary)}</dd>
          <dt>Payment Status</dt><dd><PaymentStatusBadge status={record.paymentStatus} /></dd>
          <dt>Paid Date</dt><dd>{formatDisplayDate(record.paidDate)}</dd>
          {record.remarks && (<><dt>Remarks</dt><dd>{record.remarks}</dd></>)}
        </dl>
        <div className="pll-modal-actions">
          <button type="button" className="pll-btn-outline" onClick={() => onPrint(record)}>Print</button>
          <button type="button" className="pll-btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   SALARY HISTORY TAB
   ========================================================================== */

function printSingleSalary(record, employees) {
  printRecords({
    title: "Salary Payment Slip",
    meta: [
      `Employee: ${employeeName(employees, record.employeeId)} (${record.employeeId})`,
      `Salary Month: ${salaryMonthLabel(record.salaryMonth)}`,
      `Payment Status: ${PAYMENT_STATUS_LABELS[record.paymentStatus] || record.paymentStatus}`,
      `Paid Date: ${formatDisplayDate(record.paidDate)}`,
      `Generated: ${formatDisplayDate(new Date().toISOString().slice(0, 10))}`,
    ],
    headers: ["Component", "Amount"],
    rows: [
      ["Base Salary", formatINR(record.baseSalary)],
      ["Attendance Wage", formatINR(record.attendanceWage)],
      ["Allowances", formatINR(record.allowances)],
      ["Overtime", formatINR(record.overtime)],
      ["Gross Earnings", formatINR(record.grossEarnings)],
      ["PF", formatINR(record.pf)],
      ["ESI", formatINR(record.esi)],
      ["Tax", formatINR(record.tax)],
      ["Other Deductions", formatINR(record.otherDeductions)],
      ["Advance Deduction", formatINR(record.advanceDeduction)],
      ["Total Deductions", formatINR(record.totalDeductions)],
    ],
    totals: ["Net Salary", formatINR(record.netSalary)],
  });
}

function SalaryHistoryTab({ employees, onEdit, onView }) {
  const { getSalaryHistory, deleteSalaryPayment } = useSalaryPayments();
  const f = useRecordFilters();
  const [deleteTarget, setDeleteTarget] = useState(null);

  const rows = getSalaryHistory(f.filters);
  const years = useMemo(() => {
    const s = new Set(rows.map((r) => r.salaryYear));
    const currentYear = new Date().getFullYear();
    s.add(currentYear);
    return Array.from(s).sort((a, b) => b - a);
  }, [rows]);

  const totals = rows.reduce(
    (acc, r) => ({
      gross: acc.gross + r.grossEarnings,
      advance: acc.advance + r.advanceDeduction,
      other: acc.other + r.otherDeductions,
      net: acc.net + r.netSalary,
    }),
    { gross: 0, advance: 0, other: 0, net: 0 },
  );

  const exportHeaders = [
    "Employee", "Employee ID", "Salary Month", "Salary Year", "Gross Salary",
    "Advance Deduction", "PF", "ESI", "Tax", "Other Deductions",
    "Total Deductions", "Net Salary", "Payment Status", "Paid Date",
  ];

  function exportRows() {
    return rows.map((r) => [
      employeeName(employees, r.employeeId), r.employeeId, salaryMonthLabel(r.salaryMonth), r.salaryYear,
      r.grossEarnings, r.advanceDeduction, r.pf, r.esi, r.tax, r.otherDeductions,
      r.totalDeductions, r.netSalary, PAYMENT_STATUS_LABELS[r.paymentStatus] || r.paymentStatus,
      formatDisplayDate(r.paidDate),
    ]);
  }

  function totalsRow() {
    const t = new Array(exportHeaders.length).fill("");
    t[0] = "TOTAL";
    t[4] = formatINR(totals.gross);
    t[5] = formatINR(totals.advance);
    t[9] = formatINR(totals.other);
    t[11] = formatINR(totals.net);
    return t;
  }

  function handleExportExcel() {
    exportToExcel("salary-history.xls", exportHeaders, exportRows());
  }
  function handleExportCsv() {
    exportToCSV("salary-history.csv", exportHeaders, exportRows());
  }
  function handleExportPdf() {
    exportToPDF({
      title: "Salary Payment History — Payroll",
      meta: [
        `Filters: ${formatFilterSummary(f.filters)}`,
        `Generated: ${formatDisplayDate(new Date().toISOString().slice(0, 10))}`,
        `Records: ${rows.length}`,
      ],
      headers: exportHeaders,
      rows: exportRows(),
      totals: totalsRow(),
    });
  }
  function handlePrint() {
    handleExportPdf();
  }

  return (
    <div>
      <FilterBar
        employees={employees}
        employeeId={f.employeeId}
        onEmployeeChange={f.setEmployeeId}
        year={f.year}
        onYearChange={f.setYear}
        years={years}
        month={f.month}
        onMonthChange={f.setMonth}
        status={f.status}
        onStatusChange={f.setStatus}
        statusOptions={PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] }))}
        quick={f.quick}
        onQuickChange={f.setQuick}
        onClear={f.clear}
        resultCount={rows.length}
      />

      <ExportBar
        onExportExcel={handleExportExcel}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        onPrint={handlePrint}
      />

      <div className="pll-table-wrap">
        <table className="pll-table">
          <thead>
            <tr>
              <th>Employee</th><th>Employee ID</th><th>Salary Month</th><th>Salary Year</th>
              <th className="pll-num">Gross Salary</th><th className="pll-num">Advance Deduction</th>
              <th className="pll-num">Other Deductions</th><th className="pll-num">Net Salary</th>
              <th>Payment Status</th><th>Paid Date</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={11} className="pll-empty-row">No salary payment records match this filter.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{employeeName(employees, r.employeeId)}</td>
                <td>{r.employeeId}</td>
                <td>{salaryMonthLabel(r.salaryMonth)}</td>
                <td>{r.salaryYear}</td>
                <td className="pll-num">{formatINR(r.grossEarnings)}</td>
                <td className="pll-num">{formatINR(r.advanceDeduction)}</td>
                <td className="pll-num">{formatINR(r.otherDeductions)}</td>
                <td className="pll-num">{formatINR(r.netSalary)}</td>
                <td><PaymentStatusBadge status={r.paymentStatus} /></td>
                <td>{formatDisplayDate(r.paidDate)}</td>
                <td className="pll-row-actions">
                  <button type="button" className="pll-link-btn" onClick={() => onView(r)}>View</button>
                  <button type="button" className="pll-link-btn" onClick={() => onEdit(r)}>Edit</button>
                  <button type="button" className="pll-link-btn" onClick={() => printSingleSalary(r, employees)}>Print</button>
                  <button type="button" className="pll-link-btn pll-link-danger" onClick={() => setDeleteTarget(r)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4}>Totals</td>
                <td className="pll-num">{formatINR(totals.gross)}</td>
                <td className="pll-num">{formatINR(totals.advance)}</td>
                <td className="pll-num">{formatINR(totals.other)}</td>
                <td className="pll-num">{formatINR(totals.net)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete salary record?"
          message={`This permanently removes the ${salaryMonthLabel(deleteTarget.salaryMonth)} salary record for ${employeeName(employees, deleteTarget.employeeId)}. Any advance deduction it recorded will be reversed and the outstanding advance restored.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            deleteSalaryPayment(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   ADVANCE MANAGEMENT TAB
   ========================================================================== */

function blankAdvanceForm(activeEmployees) {
  return {
    employeeId: activeEmployees[0]?.id || "",
    advanceDate: new Date().toISOString().slice(0, 10),
    amount: "",
    reason: "",
    plannedDeduction: "",
    remarks: "",
  };
}

function AdvanceFormModal({ activeEmployees, onClose, onSaved }) {
  const { createAdvance } = useAdvances();
  const [form, setForm] = useState(() => blankAdvanceForm(activeEmployees));
  const [error, setError] = useState("");

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.employeeId) return setError("Employee is required.");
    if (!amount || amount <= 0) return setError("Advance amount must be greater than 0.");

    // "Repayment/Deduction Amount" on this form is a planning note only —
    // actual deductions only ever happen through Salary/Payroll (spec §13),
    // so it's folded into remarks rather than added as a new financial field.
    const plannedNote = form.plannedDeduction
      ? `Planned deduction per salary cycle: ₹${form.plannedDeduction}.`
      : "";
    const remarks = [form.remarks, plannedNote].filter(Boolean).join(" ");

    try {
      createAdvance({
        employeeId: form.employeeId,
        advanceDate: form.advanceDate,
        amount,
        reason: form.reason,
        remarks,
      });
      onSaved?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="pll-modal-overlay" onClick={onClose}>
      <div className="pll-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>Give Advance</h3>
        <form onSubmit={handleSubmit}>
          <div className="pll-modal-form-grid">
            <label className="pll-field">
              <span className="pll-field-label">Employee<span className="pll-required">*</span></span>
              <select className="pll-select" value={form.employeeId} onChange={(e) => set("employeeId", e.target.value)}>
                {activeEmployees.map((e) => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.id}</option>
                ))}
              </select>
            </label>
            <label className="pll-field">
              <span className="pll-field-label">Advance Date<span className="pll-required">*</span></span>
              <input className="pll-input" type="date" value={form.advanceDate} onChange={(e) => set("advanceDate", e.target.value)} />
            </label>
            <label className="pll-field">
              <span className="pll-field-label">Advance Amount (₹)<span className="pll-required">*</span></span>
              <input className="pll-input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
            </label>
            <label className="pll-field">
              <span className="pll-field-label">Repayment / Deduction Amount (optional)</span>
              <input className="pll-input" type="number" min="0" step="0.01" value={form.plannedDeduction} onChange={(e) => set("plannedDeduction", e.target.value)} />
              <span className="pll-hint">For planning only — actual deductions are entered on the Salary page.</span>
            </label>
            <label className="pll-field pll-modal-field-wide">
              <span className="pll-field-label">Reason</span>
              <input className="pll-input" type="text" value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. Medical emergency" />
            </label>
            <label className="pll-field pll-modal-field-wide">
              <span className="pll-field-label">Remarks</span>
              <input className="pll-input" type="text" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Optional" />
            </label>
          </div>
          {error && <span className="pll-error">{error}</span>}
          <div className="pll-modal-actions">
            <button type="button" className="pll-btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="pll-btn-primary">Save Advance</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditAdvanceModal({ advance, onClose }) {
  const { updateAdvance } = useAdvances();
  const [form, setForm] = useState({
    advanceDate: advance.advanceDate,
    amount: advance.amount,
    reason: advance.reason,
    remarks: advance.remarks,
  });
  const locked = advance.totalRepaid > 0;

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    updateAdvance(advance.id, {
      advanceDate: form.advanceDate,
      amount: locked ? advance.amount : Number(form.amount),
      reason: form.reason,
      remarks: form.remarks,
    });
    onClose();
  }

  return (
    <div className="pll-modal-overlay" onClick={onClose}>
      <div className="pll-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>Edit Advance</h3>
        {locked && (
          <p className="pll-modal-message">
            ₹{advance.totalRepaid} has already been repaid against this advance, so the amount is
            locked to preserve financial history. You can still update the date, reason, and remarks.
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <div className="pll-modal-form-grid">
            <label className="pll-field">
              <span className="pll-field-label">Advance Date</span>
              <input className="pll-input" type="date" value={form.advanceDate} onChange={(e) => set("advanceDate", e.target.value)} />
            </label>
            <label className="pll-field">
              <span className="pll-field-label">Advance Amount (₹)</span>
              <input className="pll-input" type="number" min="0.01" step="0.01" value={form.amount} disabled={locked} onChange={(e) => set("amount", e.target.value)} />
            </label>
            <label className="pll-field pll-modal-field-wide">
              <span className="pll-field-label">Reason</span>
              <input className="pll-input" type="text" value={form.reason} onChange={(e) => set("reason", e.target.value)} />
            </label>
            <label className="pll-field pll-modal-field-wide">
              <span className="pll-field-label">Remarks</span>
              <input className="pll-input" type="text" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
            </label>
          </div>
          <div className="pll-modal-actions">
            <button type="button" className="pll-btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="pll-btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdvanceDetailModal({ advance, employees, onClose }) {
  const { getAdvanceRepaymentLog } = useAdvances();
  const log = getAdvanceRepaymentLog(advance.employeeId).filter((r) => r.advanceId === advance.id);

  return (
    <div className="pll-modal-overlay" onClick={onClose}>
      <div className="pll-modal pll-modal-wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{employeeName(employees, advance.employeeId)} — Advance on {formatDisplayDate(advance.advanceDate)}</h3>
        <dl className="pll-view-grid">
          <dt>Advance Amount</dt><dd>{formatINR(advance.amount)}</dd>
          <dt>Total Repaid</dt><dd>{formatINR(advance.totalRepaid)}</dd>
          <dt>Outstanding</dt><dd>{formatINR(advance.outstandingAmount)}</dd>
          <dt>Status</dt><dd><AdvanceStatusBadge status={advance.status} /></dd>
          {advance.reason && (<><dt>Reason</dt><dd>{advance.reason}</dd></>)}
          {advance.remarks && (<><dt>Remarks</dt><dd>{advance.remarks}</dd></>)}
        </dl>
        <h4>Repayment Log</h4>
        {log.length === 0 ? (
          <p className="pll-hint">No repayments recorded against this advance yet.</p>
        ) : (
          <div className="pll-table-wrap">
            <table className="pll-table">
              <thead><tr><th>Date</th><th className="pll-num">Amount Repaid</th><th>Via</th></tr></thead>
              <tbody>
                {log.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDisplayDate(r.date)}</td>
                    <td className="pll-num">{formatINR(r.amount)}</td>
                    <td>{r.salaryPaymentId ? "Salary Payment" : "Manual"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pll-modal-actions">
          <button type="button" className="pll-btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function AdvanceManagementTab({ employees, activeEmployees }) {
  const { getAdvances, deleteAdvance } = useAdvances();
  const f = useRecordFilters();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const rows = getAdvances(f.filters);
  const years = useMemo(() => {
    const s = new Set(rows.map((r) => Number(r.advanceDate.slice(0, 4))));
    s.add(new Date().getFullYear());
    return Array.from(s).sort((a, b) => b - a);
  }, [rows]);

  const exportHeaders = ["Employee", "Employee ID", "Advance Date", "Advance Amount", "Repaid", "Outstanding", "Reason", "Status"];

  function exportRows() {
    return rows.map((r) => [
      employeeName(employees, r.employeeId), r.employeeId, formatDisplayDate(r.advanceDate),
      r.amount, r.totalRepaid, r.outstandingAmount, r.reason, ADVANCE_STATUS_LABELS[r.status] || r.status,
    ]);
  }

  function handleExportExcel() { exportToExcel("advance-history.xls", exportHeaders, exportRows()); }
  function handleExportCsv() { exportToCSV("advance-history.csv", exportHeaders, exportRows()); }
  function handleExportPdf() {
    exportToPDF({
      title: "Employee Advance History",
      meta: [
        `Filters: ${formatFilterSummary(f.filters)}`,
        `Generated: ${formatDisplayDate(new Date().toISOString().slice(0, 10))}`,
        `Records: ${rows.length}`,
      ],
      headers: exportHeaders,
      rows: exportRows(),
    });
  }

  return (
    <div>
      {savedFlash && (
        <Banner kind="success" onClose={() => setSavedFlash(false)}>Advance saved successfully.</Banner>
      )}

      <div className="pll-toolbar" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Employee Advances</h3>
        <button type="button" className="pll-btn-primary" onClick={() => setShowForm(true)}>+ Give Advance</button>
      </div>

      <FilterBar
        employees={employees}
        employeeId={f.employeeId}
        onEmployeeChange={f.setEmployeeId}
        year={f.year}
        onYearChange={f.setYear}
        years={years}
        month={f.month}
        onMonthChange={f.setMonth}
        status={f.status}
        onStatusChange={f.setStatus}
        statusOptions={ADVANCE_STATUSES.map((s) => ({ value: s, label: ADVANCE_STATUS_LABELS[s] }))}
        quick={f.quick}
        onQuickChange={f.setQuick}
        onClear={f.clear}
        resultCount={rows.length}
      />

      <ExportBar
        onExportExcel={handleExportExcel}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        onPrint={handleExportPdf}
      />

      <div className="pll-table-wrap">
        <table className="pll-table">
          <thead>
            <tr>
              <th>Date</th><th>Employee</th><th className="pll-num">Advance Amount</th>
              <th className="pll-num">Repaid</th><th className="pll-num">Outstanding</th>
              <th>Reason</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="pll-empty-row">No advance records match this filter.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDisplayDate(r.advanceDate)}</td>
                <td>{employeeName(employees, r.employeeId)}</td>
                <td className="pll-num">{formatINR(r.amount)}</td>
                <td className="pll-num">{formatINR(r.totalRepaid)}</td>
                <td className="pll-num">{formatINR(r.outstandingAmount)}</td>
                <td>{r.reason || "—"}</td>
                <td><AdvanceStatusBadge status={r.status} /></td>
                <td className="pll-row-actions">
                  <button type="button" className="pll-link-btn" onClick={() => setViewTarget(r)}>View</button>
                  <button type="button" className="pll-link-btn" onClick={() => setEditTarget(r)}>Edit</button>
                  <button type="button" className="pll-link-btn pll-link-danger" onClick={() => setDeleteTarget(r)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <AdvanceFormModal
          activeEmployees={activeEmployees}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 3000);
          }}
        />
      )}

      {editTarget && <EditAdvanceModal advance={editTarget} onClose={() => setEditTarget(null)} />}
      {viewTarget && <AdvanceDetailModal advance={viewTarget} employees={employees} onClose={() => setViewTarget(null)} />}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete advance record?"
          message={
            deleteTarget.totalRepaid > 0
              ? `This advance already has ${formatINR(deleteTarget.totalRepaid)} repaid against it through salary payments, so it can't be deleted. Delete the related salary payment(s) first if you need to reverse this.`
              : `This removes the ${formatINR(deleteTarget.amount)} advance for ${employeeName(employees, deleteTarget.employeeId)} dated ${formatDisplayDate(deleteTarget.advanceDate)}.`
          }
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (deleteTarget.totalRepaid > 0) {
              setDeleteTarget(null);
              return;
            }
            deleteAdvance(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   PAGE SHELL — with Back Button + Tabs
   ========================================================================== */

const TABS = [
  { key: "calculator", label: "Salary" },
  { key: "history", label: "Salary History" },
  { key: "advances", label: "Advance Management" },
];

export default function Salary() {
  const { employees } = useEmployees();
  const activeEmployees = employees.filter((e) => !e.archived);

  const [activeTab, setActiveTab] = useState("calculator");
  const [employeeId, setEmployeeId] = useState(activeEmployees[0]?.id || "");
  const [month, setMonth] = useState(currentMonthStr());
  const [viewRecord, setViewRecord] = useState(null);

  const handleBack = () => {
    window.history.back();
  };

  function goEditRecord(record) {
    setEmployeeId(record.employeeId);
    setMonth(record.salaryMonth);
    setActiveTab("calculator");
  }

  function goViewRecord(record) {
    setViewRecord(record);
  }

  return (
    <div className="sal-page">
      <div className="sal-page-header">
        <div className="sal-page-header-left">
          <button
            className="sal-back-btn"
            onClick={handleBack}
            aria-label="Go back"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div>
            <h1>Employee Salary</h1>
            <p>
              Attendance-based wages flow in automatically for hourly employees;
              monthly-salary employees are unaffected.
            </p>
          </div>
        </div>
        <div className="sal-page-header-actions">
          <span className="sal-header-badge">Payroll</span>
        </div>
      </div>

      <div className="pll-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`pll-tab-btn ${activeTab === t.key ? "pll-tab-btn-active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "calculator" && (
        <SalaryCalculatorTab
          employeeId={employeeId}
          setEmployeeId={setEmployeeId}
          month={month}
          setMonth={setMonth}
          activeEmployees={activeEmployees}
          onSaved={() => {}}
          onViewExisting={goViewRecord}
        />
      )}

      {activeTab === "history" && (
        <SalaryHistoryTab employees={employees} onEdit={goEditRecord} onView={goViewRecord} />
      )}

      {activeTab === "advances" && (
        <AdvanceManagementTab employees={employees} activeEmployees={activeEmployees} />
      )}

      {viewRecord && (
        <ViewSalaryModal
          record={viewRecord}
          employees={employees}
          onClose={() => setViewRecord(null)}
          onPrint={(r) => printSingleSalary(r, employees)}
        />
      )}
    </div>
  );
}