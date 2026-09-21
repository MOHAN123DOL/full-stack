import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useCallback,
  useState,
} from 'react'
import {
  monthRange,
  currentMonthStr,
  todayISO,
  startOfWeek,
  endOfWeek,
  formatDisplayDate,
} from './Attendancewages.jsx'
import './Payroll.css'

/* ==========================================================================
   NOTE ON SCOPE
   --------------------------------------------------------------------------
   No Salary Payment / Advance data model existed in the codebase this was
   built against, so this file introduces a minimal, in-memory one — kept in
   the same style as AttendanceProvider / SalaryAdjustmentsProvider (plain
   useState/useReducer, no backend). Salary.jsx and Attendancewages.jsx both
   consume it through the hooks below so there is exactly one source of
   truth for salary payments and advances.

   To swap this for a real backend later: keep the hook signatures
   (useSalaryPayments / useAdvances) identical and replace the bodies of
   PayrollProvider with API calls — nothing in Salary.jsx or
   Attendancewages.jsx should need to change.

   MOUNTING: PayrollProvider must wrap both the Salary and Attendance/Wages
   pages, the same way AttendanceProvider and SalaryAdjustmentsProvider
   already do (typically near the app root, alongside those providers).
   ========================================================================== */

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'PARTIALLY_PAID']

export const PAYMENT_STATUS_LABELS = {
  PENDING: 'Pending',
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partially Paid',
}

export const ADVANCE_STATUSES = ['OUTSTANDING', 'PARTIALLY_REPAID', 'FULLY_REPAID']

export const ADVANCE_STATUS_LABELS = {
  OUTSTANDING: 'Outstanding',
  PARTIALLY_REPAID: 'Partially Repaid',
  FULLY_REPAID: 'Fully Repaid',
}

export const QUICK_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_year', label: 'This Year' },
]

export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const mm = String(i + 1).padStart(2, '0')
  return { value: mm, label: monthName(mm) }
})

export function monthName(mm) {
  return new Date(2000, Number(mm) - 1, 1).toLocaleDateString('en-IN', { month: 'long' })
}

export function salaryMonthLabel(monthStr) {
  if (!monthStr) return '—'
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/* ==========================================================================
   SMALL HELPERS
   ========================================================================== */

let uidCounter = 0
function uid(prefix) {
  uidCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${uidCounter}`
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function advanceStatusFor(outstandingAmount, amount) {
  const outstanding = round2(outstandingAmount)
  if (outstanding <= 0) return 'FULLY_REPAID'
  if (outstanding < round2(amount)) return 'PARTIALLY_REPAID'
  return 'OUTSTANDING'
}

function inDateRange(iso, range) {
  if (!range) return true
  return iso >= range.start && iso <= range.end
}

export function quickRange(key) {
  const today = todayISO()
  if (key === 'this_week') return { start: startOfWeek(today), end: endOfWeek(today) }
  if (key === 'this_month') return monthRange(currentMonthStr())
  if (key === 'last_month') {
    const [y, m] = currentMonthStr().split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    const ms = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return monthRange(ms)
  }
  if (key === 'this_year') {
    const y = Number(currentMonthStr().split('-')[0])
    return { start: `${y}-01-01`, end: `${y}-12-31` }
  }
  return null // 'all' / unrecognised
}

/* ==========================================================================
   PURE REDUCER HELPERS
   --------------------------------------------------------------------------
   Advance deductions taken through payroll are allocated across an
   employee's outstanding advances oldest-first (FIFO), and every allocation
   is logged as its own repayment transaction so the advance ledger is a
   true history rather than a single overwritten number. Editing or
   deleting a salary payment reverses exactly the transactions that payment
   created, then (for edits) re-allocates the new amount — old salary
   snapshots and unrelated advance transactions are never touched.
   ========================================================================== */

function allocateAdvanceDeduction(advances, repayments, employeeId, amount, salaryPaymentId) {
  const deduction = round2(amount)
  if (deduction <= 0) return { advances, advanceRepayments: repayments }

  let remaining = deduction
  const newRepayments = []
  const nextAdvances = advances.map((a) => ({ ...a }))
  const ordered = nextAdvances
    .filter((a) => a.employeeId === employeeId && a.outstandingAmount > 0)
    .sort((a, b) => (a.advanceDate < b.advanceDate ? -1 : 1))

  for (const adv of ordered) {
    if (remaining <= 0) break
    const take = round2(Math.min(remaining, adv.outstandingAmount))
    if (take <= 0) continue
    adv.outstandingAmount = round2(adv.outstandingAmount - take)
    adv.totalRepaid = round2(adv.totalRepaid + take)
    adv.status = advanceStatusFor(adv.outstandingAmount, adv.amount)
    adv.updatedAt = new Date().toISOString()
    newRepayments.push({
      id: uid('ADVREPAY'),
      advanceId: adv.id,
      employeeId,
      amount: take,
      salaryPaymentId,
      date: todayISO(),
      createdAt: new Date().toISOString(),
    })
    remaining = round2(remaining - take)
  }
  // remaining > 0 here would mean the deduction exceeded outstanding advance;
  // callers validate against getOutstandingAdvance() first, so this should
  // not occur — allocation simply stops rather than fabricating a balance.
  return { advances: nextAdvances, advanceRepayments: [...repayments, ...newRepayments] }
}

function reverseRepaymentsForSalaryPayment(advances, repayments, salaryPaymentId) {
  const toReverse = repayments.filter((r) => r.salaryPaymentId === salaryPaymentId)
  if (toReverse.length === 0) return { advances, advanceRepayments: repayments }
  const byAdvance = {}
  toReverse.forEach((r) => {
    byAdvance[r.advanceId] = round2((byAdvance[r.advanceId] || 0) + r.amount)
  })
  const nextAdvances = advances.map((a) => {
    if (!byAdvance[a.id]) return a
    const outstandingAmount = round2(Math.min(a.amount, a.outstandingAmount + byAdvance[a.id]))
    const totalRepaid = round2(Math.max(0, a.totalRepaid - byAdvance[a.id]))
    return {
      ...a,
      outstandingAmount,
      totalRepaid,
      status: advanceStatusFor(outstandingAmount, a.amount),
      updatedAt: new Date().toISOString(),
    }
  })
  return {
    advances: nextAdvances,
    advanceRepayments: repayments.filter((r) => r.salaryPaymentId !== salaryPaymentId),
  }
}

function filterSalaryPayments(payments, filters = {}) {
  const { employeeId, year, month, status, quick, dateStart, dateEnd } = filters
  let range = null
  if (dateStart && dateEnd) range = { start: dateStart, end: dateEnd }
  else if (quick && quick !== 'all') range = quickRange(quick)

  return payments
    .filter((p) => {
      if (employeeId && p.employeeId !== employeeId) return false
      if (year && String(p.salaryYear) !== String(year)) return false
      if (month && p.salaryMonth.split('-')[1] !== String(month).padStart(2, '0')) return false
      if (status && p.paymentStatus !== status) return false
      if (range) {
        const d = p.paidDate || `${p.salaryMonth}-01`
        if (!inDateRange(d, range)) return false
      }
      return true
    })
    .sort((a, b) => (a.salaryMonth < b.salaryMonth ? 1 : a.salaryMonth > b.salaryMonth ? -1 : b.createdAt < a.createdAt ? -1 : 1))
}

function filterAdvances(advances, filters = {}) {
  const { employeeId, year, month, status, quick, dateStart, dateEnd } = filters
  let range = null
  if (dateStart && dateEnd) range = { start: dateStart, end: dateEnd }
  else if (quick && quick !== 'all') range = quickRange(quick)

  return advances
    .filter((a) => {
      if (employeeId && a.employeeId !== employeeId) return false
      if (year && a.advanceDate.slice(0, 4) !== String(year)) return false
      if (month && a.advanceDate.slice(5, 7) !== String(month).padStart(2, '0')) return false
      if (status && a.status !== status) return false
      if (range && !inDateRange(a.advanceDate, range)) return false
      return true
    })
    .sort((a, b) => (a.advanceDate < b.advanceDate ? 1 : -1))
}

/* ==========================================================================
   REDUCER
   ========================================================================== */

function payrollReducer(state, action) {
  switch (action.type) {
    case 'CREATE_ADVANCE':
      return { ...state, advances: [action.record, ...state.advances] }

    case 'UPDATE_ADVANCE':
      return {
        ...state,
        advances: state.advances.map((a) => (a.id === action.id ? action.updater(a) : a)),
      }

    case 'DELETE_ADVANCE':
      return {
        ...state,
        advances: state.advances.filter((a) => a.id !== action.id),
        advanceRepayments: state.advanceRepayments.filter((r) => r.advanceId !== action.id),
      }

    case 'RECORD_REPAYMENT': {
      const allocated = allocateAdvanceDeduction(
        state.advances,
        state.advanceRepayments,
        action.employeeId,
        action.amount,
        action.salaryPaymentId,
      )
      return { ...state, advances: allocated.advances, advanceRepayments: allocated.advanceRepayments }
    }

    case 'SAVE_SALARY_PAYMENT': {
      const { record, existingId } = action
      let { advances, advanceRepayments } = state
      if (existingId) {
        const reversed = reverseRepaymentsForSalaryPayment(advances, advanceRepayments, existingId)
        advances = reversed.advances
        advanceRepayments = reversed.advanceRepayments
      }
      const allocated = allocateAdvanceDeduction(
        advances,
        advanceRepayments,
        record.employeeId,
        record.advanceDeduction,
        record.id,
      )
      advances = allocated.advances
      advanceRepayments = allocated.advanceRepayments

      const salaryPayments = existingId
        ? state.salaryPayments.map((p) => (p.id === existingId ? record : p))
        : [record, ...state.salaryPayments]

      return { ...state, salaryPayments, advances, advanceRepayments }
    }

    case 'DELETE_SALARY_PAYMENT': {
      const reversed = reverseRepaymentsForSalaryPayment(state.advances, state.advanceRepayments, action.id)
      return {
        ...state,
        salaryPayments: state.salaryPayments.filter((p) => p.id !== action.id),
        advances: reversed.advances,
        advanceRepayments: reversed.advanceRepayments,
      }
    }

    default:
      return state
  }
}

/* ==========================================================================
   CONTEXT / PROVIDER
   ========================================================================== */

const PayrollContext = createContext(null)

export function usePayroll() {
  const ctx = useContext(PayrollContext)
  if (!ctx) throw new Error('usePayroll must be used within PayrollProvider')
  return ctx
}

/** Salary-payment-focused slice of the payroll API (see spec §21). */
export function useSalaryPayments() {
  const {
    salaryPayments,
    getSalaryPayment,
    getSalaryHistory,
    saveSalaryPayment,
    updateSalaryPayment,
    deleteSalaryPayment,
  } = usePayroll()
  return { salaryPayments, getSalaryPayment, getSalaryHistory, saveSalaryPayment, updateSalaryPayment, deleteSalaryPayment }
}

/** Advance-focused slice of the payroll API (see spec §21). */
export function useAdvances() {
  const {
    advances,
    advanceRepayments,
    createAdvance,
    getAdvances,
    getEmployeeAdvances,
    updateAdvance,
    deleteAdvance,
    recordAdvanceRepayment,
    getOutstandingAdvance,
    getAdvanceRepaymentLog,
  } = usePayroll()
  return {
    advances,
    advanceRepayments,
    createAdvance,
    getAdvances,
    getEmployeeAdvances,
    updateAdvance,
    deleteAdvance,
    recordAdvanceRepayment,
    getOutstandingAdvance,
    getAdvanceRepaymentLog,
  }
}

export function PayrollProvider({ children }) {
  const [state, dispatch] = useReducer(payrollReducer, {
    salaryPayments: [],
    advances: [],
    advanceRepayments: [],
  })

  const getSalaryPayment = useCallback(
    (employeeId, salaryMonth) =>
      state.salaryPayments.find((p) => p.employeeId === employeeId && p.salaryMonth === salaryMonth) || null,
    [state.salaryPayments],
  )

  const getSalaryHistory = useCallback(
    (filters = {}) => filterSalaryPayments(state.salaryPayments, filters),
    [state.salaryPayments],
  )

  /**
   * Returns { status: 'duplicate', existing } if a record already exists for
   * this employee + salary month and allowUpdate wasn't passed, otherwise
   * saves (creating or overwriting-in-place) and returns { status: 'saved', record }.
   */
  const saveSalaryPayment = useCallback(
    (input, { allowUpdate = false } = {}) => {
      if (!input.employeeId) throw new Error('Employee is required.')
      if (!input.salaryMonth) throw new Error('Salary month is required.')

      const existing = state.salaryPayments.find(
        (p) => p.employeeId === input.employeeId && p.salaryMonth === input.salaryMonth,
      )
      if (existing && !allowUpdate) {
        return { status: 'duplicate', existing }
      }

      const now = new Date().toISOString()
      const id = existing ? existing.id : uid('PAY')
      const paymentStatus = input.paymentStatus || 'PENDING'
      const record = {
        id,
        employeeId: input.employeeId,
        salaryMonth: input.salaryMonth,
        salaryYear: Number(input.salaryMonth.split('-')[0]),
        baseSalary: round2(input.baseSalary),
        attendanceWage: round2(input.attendanceWage),
        allowances: round2(input.allowances),
        overtime: round2(input.overtime),
        grossEarnings: round2(input.grossEarnings),
        pf: round2(input.pf),
        esi: round2(input.esi),
        tax: round2(input.tax),
        otherDeductions: round2(input.otherDeductions),
        advanceDeduction: round2(input.advanceDeduction),
        totalDeductions: round2(input.totalDeductions),
        netSalary: round2(input.netSalary),
        paymentStatus,
        paidDate: paymentStatus === 'PAID' ? input.paidDate || todayISO() : input.paidDate || null,
        remarks: input.remarks || '',
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
      }

      dispatch({ type: 'SAVE_SALARY_PAYMENT', record, existingId: existing ? existing.id : null })
      return { status: 'saved', record }
    },
    [state.salaryPayments],
  )

  const updateSalaryPayment = useCallback(
    (id, updates) => {
      const existing = state.salaryPayments.find((p) => p.id === id)
      if (!existing) return null
      return saveSalaryPayment({ ...existing, ...updates, id }, { allowUpdate: true })
    },
    [state.salaryPayments, saveSalaryPayment],
  )

  const deleteSalaryPayment = useCallback((id) => {
    dispatch({ type: 'DELETE_SALARY_PAYMENT', id })
  }, [])

  const getOutstandingAdvance = useCallback(
    (employeeId) =>
      round2(
        state.advances
          .filter((a) => a.employeeId === employeeId)
          .reduce((s, a) => s + (Number(a.outstandingAmount) || 0), 0),
      ),
    [state.advances],
  )

  const getEmployeeAdvances = useCallback(
    (employeeId) =>
      state.advances
        .filter((a) => a.employeeId === employeeId)
        .sort((a, b) => (a.advanceDate < b.advanceDate ? 1 : -1)),
    [state.advances],
  )

  const getAdvances = useCallback((filters = {}) => filterAdvances(state.advances, filters), [state.advances])

  const getAdvanceRepaymentLog = useCallback(
    (employeeId) =>
      state.advanceRepayments
        .filter((r) => r.employeeId === employeeId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [state.advanceRepayments],
  )

  const createAdvance = useCallback((input) => {
    const amount = Number(input.amount) || 0
    if (amount <= 0) throw new Error('Advance amount must be greater than 0.')
    const now = new Date().toISOString()
    const record = {
      id: uid('ADV'),
      employeeId: input.employeeId,
      advanceDate: input.advanceDate || todayISO(),
      amount: round2(amount),
      totalRepaid: 0,
      outstandingAmount: round2(amount),
      reason: input.reason || '',
      remarks: input.remarks || '',
      status: 'OUTSTANDING',
      createdAt: now,
      updatedAt: now,
    }
    dispatch({ type: 'CREATE_ADVANCE', record })
    return record
  }, [])

  const updateAdvance = useCallback((id, updates) => {
    dispatch({
      type: 'UPDATE_ADVANCE',
      id,
      updater: (a) => {
        const next = { ...a, ...updates, updatedAt: new Date().toISOString() }
        if (updates.amount !== undefined) {
          if (a.totalRepaid > 0) {
            // Protect financial history: once any repayment has posted
            // against this advance, its principal can no longer change.
            next.amount = a.amount
            next.outstandingAmount = a.outstandingAmount
          } else {
            next.amount = round2(Number(updates.amount) || a.amount)
            next.outstandingAmount = next.amount
          }
        }
        next.status = advanceStatusFor(next.outstandingAmount, next.amount)
        return next
      },
    })
  }, [])

  const deleteAdvance = useCallback((id) => {
    dispatch({ type: 'DELETE_ADVANCE', id })
  }, [])

  const recordAdvanceRepayment = useCallback(
    (employeeId, amount, meta = {}) => {
      const outstanding = getOutstandingAdvance(employeeId)
      const deduction = round2(Number(amount) || 0)
      if (deduction <= 0) throw new Error('Repayment amount must be greater than 0.')
      if (deduction > outstanding) throw new Error('Repayment cannot exceed outstanding advance.')
      dispatch({
        type: 'RECORD_REPAYMENT',
        employeeId,
        amount: deduction,
        salaryPaymentId: meta.salaryPaymentId || null,
      })
    },
    [getOutstandingAdvance],
  )

  const value = useMemo(
    () => ({
      salaryPayments: state.salaryPayments,
      advances: state.advances,
      advanceRepayments: state.advanceRepayments,
      getSalaryPayment,
      getSalaryHistory,
      saveSalaryPayment,
      updateSalaryPayment,
      deleteSalaryPayment,
      getOutstandingAdvance,
      getEmployeeAdvances,
      getAdvances,
      getAdvanceRepaymentLog,
      createAdvance,
      updateAdvance,
      deleteAdvance,
      recordAdvanceRepayment,
    }),
    [
      state.salaryPayments,
      state.advances,
      state.advanceRepayments,
      getSalaryPayment,
      getSalaryHistory,
      saveSalaryPayment,
      updateSalaryPayment,
      deleteSalaryPayment,
      getOutstandingAdvance,
      getEmployeeAdvances,
      getAdvances,
      getAdvanceRepaymentLog,
      createAdvance,
      updateAdvance,
      deleteAdvance,
      recordAdvanceRepayment,
    ],
  )

  return <PayrollContext.Provider value={value}>{children}</PayrollContext.Provider>
}

/* ==========================================================================
   EXPORT / PRINT UTILITIES — no charting/spreadsheet library is bundled in
   this project, so these use dependency-free browser primitives: a Blob
   download for CSV/"Excel" (an HTML table Excel opens natively), and a
   print-only popup window for PDF/Print (the browser's own "Save as PDF"
   destination produces a real PDF with zero added dependencies).
   ========================================================================== */

function escapeCsvCell(v) {
  const s = String(v ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportToCSV(filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
  downloadBlob(`\uFEFF${csv}`, filename, 'text/csv;charset=utf-8;')
}

export function exportToExcel(filename, headers, rows) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><table border="1">
    <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></body></html>`
  downloadBlob(html, filename, 'application/vnd.ms-excel')
}

function buildPrintDocument({ title, meta = [], headers, rows, totals = [] }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 24px; color: #1a1a1a; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .pll-print-meta { font-size: 12px; color: #555; margin-bottom: 16px; }
    .pll-print-meta div { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #f2f4f7; }
    tfoot td { font-weight: 600; background: #fafafa; }
    @media print { body { margin: 8mm; } }
  </style></head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <div class="pll-print-meta">${meta.map((m) => `<div>${escapeHtml(m)}</div>`).join('')}</div>
    <table>
      <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      ${totals.length ? `<tfoot><tr>${totals.map((t) => `<td>${escapeHtml(t)}</td>`).join('')}</tr></tfoot>` : ''}
    </table>
  </body></html>`
}

/** Opens a print-only popup containing just the table + summary (not the whole app) and triggers the browser print dialog. */
export function printRecords(opts) {
  const doc = buildPrintDocument(opts)
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    alert('Please allow pop-ups for this site to print or export as PDF.')
    return
  }
  win.document.write(doc)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

/** Same print-only view as printRecords — choosing "Save as PDF" in the print dialog produces the PDF. */
export function exportToPDF(opts) {
  printRecords(opts)
}

/* ==========================================================================
   SHARED UI PRIMITIVES
   ========================================================================== */

export function PaymentStatusBadge({ status }) {
  const cls = (status || 'pending').toLowerCase().replace(/_/g, '-')
  return <span className={`pll-status-pill pll-status-${cls}`}>{PAYMENT_STATUS_LABELS[status] || status}</span>
}

export function AdvanceStatusBadge({ status }) {
  const cls = (status || 'outstanding').toLowerCase().replace(/_/g, '-')
  return <span className={`pll-status-pill pll-status-${cls}`}>{ADVANCE_STATUS_LABELS[status] || status}</span>
}

export function Banner({ kind = 'success', children, onClose }) {
  return (
    <div className={`pll-banner pll-banner-${kind}`}>
      <span>{children}</span>
      {onClose && (
        <button type="button" className="pll-banner-close" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  )
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, busy, onConfirm, onCancel, children }) {
  return (
    <div className="pll-modal-overlay" onClick={onCancel}>
      <div className="pll-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{title}</h3>
        {message && <p className="pll-modal-message">{message}</p>}
        {children}
        <div className="pll-modal-actions">
          <button type="button" className="pll-btn-outline" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'pll-btn-danger' : 'pll-btn-primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Employee / Year / Month / Status filter row + quick filters, shared by Salary History and Advance History. */
export function FilterBar({
  employees,
  employeeId,
  onEmployeeChange,
  year,
  onYearChange,
  years,
  month,
  onMonthChange,
  status,
  onStatusChange,
  statusOptions,
  quick,
  onQuickChange,
  onClear,
  resultCount,
}) {
  return (
    <div className="pll-filter-bar">
      <div className="pll-filter-row">
        <label className="pll-field pll-field-inline">
          <span className="pll-field-label">Employee</span>
          <select className="pll-select" value={employeeId} onChange={(e) => onEmployeeChange(e.target.value)}>
            <option value="">All Employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName} — {e.id}
              </option>
            ))}
          </select>
        </label>

        <label className="pll-field pll-field-inline">
          <span className="pll-field-label">Year</span>
          <select className="pll-select" value={year} onChange={(e) => onYearChange(e.target.value)}>
            <option value="">All</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label className="pll-field pll-field-inline">
          <span className="pll-field-label">Month</span>
          <select className="pll-select" value={month} onChange={(e) => onMonthChange(e.target.value)}>
            <option value="">All</option>
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="pll-field pll-field-inline">
          <span className="pll-field-label">Status</span>
          <select className="pll-select" value={status} onChange={(e) => onStatusChange(e.target.value)}>
            <option value="">All</option>
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="pll-btn-outline pll-btn-sm" onClick={onClear}>
          Clear Filters
        </button>
      </div>

      <div className="pll-filter-row pll-filter-row-quick">
        <div className="pll-quick-filters">
          {QUICK_FILTERS.map((q) => (
            <button
              key={q.key}
              type="button"
              className={`pll-chip ${quick === q.key ? 'pll-chip-active' : ''}`}
              onClick={() => onQuickChange(q.key)}
            >
              {q.label}
            </button>
          ))}
        </div>
        <span className="pll-filter-count">{resultCount} record{resultCount === 1 ? '' : 's'}</span>
      </div>
    </div>
  )
}

/** Read-only list of one employee's advances — used by Wage Rates' "View Advances" button. */
export function EmployeeAdvancesModal({ employeeId, employeeName, advances, onClose }) {
  const outstanding = advances.reduce((s, a) => s + (Number(a.outstandingAmount) || 0), 0)
  return (
    <div className="pll-modal-overlay" onClick={onClose}>
      <div className="pll-modal pll-modal-wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{employeeName || employeeId} — Advances</h3>
        <p className="pll-modal-message">
          Outstanding across all advances: <strong>{`₹${outstanding.toLocaleString('en-IN')}`}</strong>
        </p>
        {advances.length === 0 ? (
          <p className="pll-hint">No advances on record for this employee.</p>
        ) : (
          <div className="pll-table-wrap">
            <table className="pll-table">
              <thead>
                <tr><th>Date</th><th className="pll-num">Amount</th><th className="pll-num">Repaid</th><th className="pll-num">Outstanding</th><th>Reason</th><th>Status</th></tr>
              </thead>
              <tbody>
                {advances.map((a) => (
                  <tr key={a.id}>
                    <td>{formatDisplayDate(a.advanceDate)}</td>
                    <td className="pll-num">{`₹${(Number(a.amount) || 0).toLocaleString('en-IN')}`}</td>
                    <td className="pll-num">{`₹${(Number(a.totalRepaid) || 0).toLocaleString('en-IN')}`}</td>
                    <td className="pll-num">{`₹${(Number(a.outstandingAmount) || 0).toLocaleString('en-IN')}`}</td>
                    <td>{a.reason || '—'}</td>
                    <td><AdvanceStatusBadge status={a.status} /></td>
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
  )
}

export function ExportBar({ onExportExcel, onExportCsv, onExportPdf, onPrint }) {
  return (
    <div className="pll-export-bar">
      <button type="button" className="pll-btn-outline pll-btn-sm" onClick={onExportExcel}>
        Export Excel
      </button>
      <button type="button" className="pll-btn-outline pll-btn-sm" onClick={onExportCsv}>
        Export CSV
      </button>
      <button type="button" className="pll-btn-outline pll-btn-sm" onClick={onExportPdf}>
        Export PDF
      </button>
      <button type="button" className="pll-btn-outline pll-btn-sm" onClick={onPrint}>
        Print
      </button>
    </div>
  )
}

/** Small state hook shared by Salary History / Advance History filter UIs. */
export function useRecordFilters() {
  const [employeeId, setEmployeeId] = useState('')
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [status, setStatus] = useState('')
  const [quick, setQuick] = useState('all')

  const filters = useMemo(
    () => ({ employeeId, year, month, status, quick }),
    [employeeId, year, month, status, quick],
  )

  function clear() {
    setEmployeeId('')
    setYear('')
    setMonth('')
    setStatus('')
    setQuick('all')
  }

  return {
    employeeId, setEmployeeId,
    year, setYear,
    month, setMonth,
    status, setStatus,
    quick, setQuick,
    filters,
    clear,
  }
}

export function formatFilterSummary(filters) {
  const parts = []
  if (filters.employeeId) parts.push(`Employee: ${filters.employeeId}`)
  if (filters.year) parts.push(`Year: ${filters.year}`)
  if (filters.month) parts.push(`Month: ${monthName(filters.month)}`)
  if (filters.status) parts.push(`Status: ${filters.status}`)
  if (filters.quick && filters.quick !== 'all') parts.push(`Range: ${filters.quick.replace(/_/g, ' ')}`)
  return parts.length ? parts.join(' · ') : 'No filters applied'
}

export { formatDisplayDate }
