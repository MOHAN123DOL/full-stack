import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
} from 'react'
import { useEmployees } from './Employees.jsx'
import { useAdvances, AdvanceStatusBadge, EmployeeAdvancesModal } from './Payroll.jsx'
import './Attendance.css'
import './Payroll.css'

/* NOTE: Attendancewages.jsx <-> Payroll.jsx is a deliberate two-way import.
   Payroll.jsx only reuses pure date helpers from here (monthRange,
   currentMonthStr, todayISO, startOfWeek, endOfWeek, formatDisplayDate),
   and only inside function bodies — never at module top level — so the
   circular reference resolves fine at runtime. This keeps a single source
   of truth for both the attendance/date helpers and the advance data model
   instead of duplicating either. */

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

export const ATTENDANCE_STATUSES = [
  'PRESENT',
  'HALF_DAY',
  'ABSENT',
  'PAID_LEAVE',
  'UNPAID_LEAVE',
  'HOLIDAY',
  'WEEKLY_OFF',
  'WFH',
]

// Single source of truth for how each status behaves. Anything that reads
// "based on policy" in the spec is intentionally left configurable via
// wageConfig.leavePolicy rather than hardcoded here.
export const STATUS_META = {
  PRESENT: { label: 'Present', requiresTime: true, policyBased: false },
  HALF_DAY: { label: 'Half Day', requiresTime: true, policyBased: false },
  WFH: { label: 'Work From Home', requiresTime: true, policyBased: false },
  ABSENT: { label: 'Absent', requiresTime: false, policyBased: false },
  UNPAID_LEAVE: { label: 'Unpaid Leave', requiresTime: false, policyBased: false },
  PAID_LEAVE: { label: 'Paid Leave', requiresTime: false, policyBased: true, policyKey: 'paidLeave' },
  HOLIDAY: { label: 'Holiday', requiresTime: false, policyBased: true, policyKey: 'holiday' },
  WEEKLY_OFF: { label: 'Weekly Off', requiresTime: false, policyBased: true, policyKey: 'weeklyOff' },
}

export function statusLabel(status) {
  return STATUS_META[status]?.label || status
}

const DEFAULT_LEAVE_POLICY = {
  // 'UNPAID' -> 0 wage for the day. 'FULL_DAY' -> standardHoursPerDay x hourlyRate.
  // Defaults to UNPAID because no existing leave/payroll policy was found in
  // the codebase to inherit. HR can switch this per employee in Wage Rates.
  paidLeave: 'UNPAID',
  holiday: 'UNPAID',
  weeklyOff: 'UNPAID',
}

export function defaultWageConfig() {
  return {
    salaryType: 'HOURLY', // 'HOURLY' | 'MONTHLY'
    hourlyRate: 0,
    monthlySalary: 0,
    standardHoursPerDay: 8,
    leavePolicy: { ...DEFAULT_LEAVE_POLICY },
    updatedAt: null,
  }
}

/* ==========================================================================
   CALCULATION HELPERS — pure functions, exported so the Salary page (and
   tests) can reuse the exact same math instead of re-deriving it.
   ========================================================================== */

function timeToMinutes(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function calcWorkingHours(loginTime, logoutTime, breakHours = 0) {
  const start = timeToMinutes(loginTime)
  const end = timeToMinutes(logoutTime)
  if (start === null || end === null) return 0
  let diffMinutes = end - start
  if (diffMinutes <= 0) diffMinutes += 24 * 60 // overnight shift wrap-around
  const hours = diffMinutes / 60 - (Number(breakHours) || 0)
  return Math.max(0, Math.round(hours * 100) / 100)
}

export function calcDailyWage(status, workingHours, hourlyRate, wageConfig) {
  const meta = STATUS_META[status]
  const rate = Number(hourlyRate) || 0
  if (!meta) return 0

  if (meta.requiresTime) {
    return Math.round(workingHours * rate * 100) / 100
  }

  if (meta.policyBased) {
    const policy = wageConfig?.leavePolicy?.[meta.policyKey] || 'UNPAID'
    if (policy === 'FULL_DAY') {
      const std = Number(wageConfig?.standardHoursPerDay) || 8
      return Math.round(std * rate * 100) / 100
    }
    return 0
  }

  // ABSENT, UNPAID_LEAVE
  return 0
}

export function formatHours(hours) {
  return `${(Number(hours) || 0).toFixed(2)} hrs`
}

export function formatINR(amount) {
  const n = Number(amount) || 0
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export function formatDisplayDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function toDate(iso) {
  return new Date(`${iso}T00:00:00`)
}

export function startOfWeek(iso) {
  const d = toDate(iso)
  const day = d.getDay() // 0=Sun
  const diff = (day + 6) % 7 // Monday-start week
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

export function endOfWeek(iso) {
  const start = toDate(startOfWeek(iso))
  start.setDate(start.getDate() + 6)
  return start.toISOString().slice(0, 10)
}

export function monthRange(monthStr) {
  // monthStr = 'YYYY-MM'
  const [y, m] = monthStr.split('-').map(Number)
  const start = `${monthStr}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${monthStr}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export function currentMonthStr() {
  return todayISO().slice(0, 7)
}

function inRange(iso, start, end) {
  return iso >= start && iso <= end
}

function allDatesBetween(start, end) {
  const dates = []
  let cur = toDate(start)
  const last = toDate(end)
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

/* ==========================================================================
   MOCK DATA — seed rows so the page isn't empty on first load. Shaped to
   mirror the future attendance/wage API payloads.
   ========================================================================== */

let seedCounter = 0
function seedId(prefix) {
  seedCounter += 1
  return `${prefix}-SEED-${seedCounter}`
}

const SEED_WAGE_CONFIGS = {
  EMP001: {
    salaryType: 'HOURLY',
    hourlyRate: 250,
    monthlySalary: 0,
    standardHoursPerDay: 8,
    leavePolicy: { ...DEFAULT_LEAVE_POLICY },
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  EMP002: {
    salaryType: 'MONTHLY',
    hourlyRate: 0,
    monthlySalary: 32000,
    standardHoursPerDay: 8,
    leavePolicy: { ...DEFAULT_LEAVE_POLICY },
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
}

function buildSeedAttendance() {
  const rows = []
  const days = [
    ['2026-08-28', '09:00', '18:00', 1, 'PRESENT'],
    ['2026-08-29', '09:15', '18:00', 1, 'PRESENT'],
    ['2026-08-30', null, null, 0, 'WEEKLY_OFF'],
    ['2026-08-31', '09:00', '13:00', 0, 'HALF_DAY'],
    ['2026-09-01', '09:00', '18:00', 1, 'PRESENT'],
  ]
  days.forEach(([date, login, logout, brk, status]) => {
    const rate = SEED_WAGE_CONFIGS.EMP001.hourlyRate
    const hours = STATUS_META[status].requiresTime
      ? calcWorkingHours(login, logout, brk)
      : 0
    rows.push({
      id: seedId('ATT'),
      employeeId: 'EMP001',
      date,
      status,
      loginTime: login,
      logoutTime: logout,
      breakHours: brk,
      workingHours: hours,
      hourlyRate: rate,
      dailyWage: calcDailyWage(status, hours, rate, SEED_WAGE_CONFIGS.EMP001),
      remarks: '',
      createdAt: `${date}T18:05:00.000Z`,
      updatedAt: `${date}T18:05:00.000Z`,
    })
  })
  return rows
}

/* ==========================================================================
   CONTEXT
   ========================================================================== */

const AttendanceContext = createContext(null)

export function useAttendance() {
  const ctx = useContext(AttendanceContext)
  if (!ctx) throw new Error('useAttendance must be used within AttendanceProvider')
  return ctx
}

export function AttendanceProvider({ children }) {
  const [records, setRecords] = useState(buildSeedAttendance)
  const [wageConfigs, setWageConfigs] = useState(() => ({ ...SEED_WAGE_CONFIGS }))

  const getWageConfig = useCallback(
    (employeeId) => wageConfigs[employeeId] || defaultWageConfig(),
    [wageConfigs],
  )

  const setWageConfig = useCallback((employeeId, updates) => {
    setWageConfigs((prev) => ({
      ...prev,
      [employeeId]: {
        ...defaultWageConfig(),
        ...prev[employeeId],
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    }))
  }, [])

  const findByEmployeeDate = useCallback(
    (employeeId, date, excludeId = null) =>
      records.find(
        (r) => r.employeeId === employeeId && r.date === date && r.id !== excludeId,
      ),
    [records],
  )

  const saveAttendance = useCallback(
    (input, editId = null) => {
      const config = wageConfigs[input.employeeId] || defaultWageConfig()
      const meta = STATUS_META[input.status]
      const usesTime = meta?.requiresTime

      const loginTime = usesTime ? input.loginTime || null : null
      const logoutTime = usesTime ? input.logoutTime || null : null
      const breakHours = usesTime ? Number(input.breakHours) || 0 : 0
      const workingHours = usesTime
        ? calcWorkingHours(loginTime, logoutTime, breakHours)
        : 0
      const hourlyRate = Number(input.hourlyRate) || config.hourlyRate || 0
      const dailyWage = calcDailyWage(input.status, workingHours, hourlyRate, config)

      const now = new Date().toISOString()
      const record = {
        id: editId || `ATT-${Date.now().toString(36)}-${Math.round(Math.random() * 1e4)}`,
        employeeId: input.employeeId,
        date: input.date,
        status: input.status,
        loginTime,
        logoutTime,
        breakHours,
        workingHours,
        hourlyRate,
        dailyWage,
        remarks: input.remarks || '',
        createdAt: editId
          ? records.find((r) => r.id === editId)?.createdAt || now
          : now,
        updatedAt: now,
      }

      setRecords((prev) =>
        editId ? prev.map((r) => (r.id === editId ? record : r)) : [record, ...prev],
      )
      return record
    },
    [records, wageConfigs],
  )

  const deleteAttendance = useCallback((id) => {
    setRecords((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const value = useMemo(
    () => ({
      records,
      wageConfigs,
      getWageConfig,
      setWageConfig,
      findByEmployeeDate,
      saveAttendance,
      deleteAttendance,
    }),
    [records, wageConfigs, getWageConfig, setWageConfig, findByEmployeeDate, saveAttendance, deleteAttendance],
  )

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>
}

/* ==========================================================================
   AGGREGATION HELPERS — exported for reuse on the Salary page.
   ========================================================================== */

export function summarizeRange(records, start, end, employeeId = null) {
  const rows = records.filter(
    (r) => inRange(r.date, start, end) && (!employeeId || r.employeeId === employeeId),
  )
  const byEmployee = {}
  rows.forEach((r) => {
    if (!byEmployee[r.employeeId]) {
      byEmployee[r.employeeId] = {
        employeeId: r.employeeId,
        daysWorked: 0,
        totalHours: 0,
        totalWage: 0,
        statusCounts: {},
        lastRate: r.hourlyRate,
      }
    }
    const bucket = byEmployee[r.employeeId]
    bucket.totalHours += r.workingHours
    bucket.totalWage += r.dailyWage
    bucket.statusCounts[r.status] = (bucket.statusCounts[r.status] || 0) + 1
    if (STATUS_META[r.status]?.requiresTime) bucket.daysWorked += 1
    bucket.lastRate = r.hourlyRate
  })
  Object.values(byEmployee).forEach((b) => {
    b.totalHours = Math.round(b.totalHours * 100) / 100
    b.totalWage = Math.round(b.totalWage * 100) / 100
  })
  return byEmployee
}

export function getMissingDates(records, employeeId, start, end, joiningDate) {
  const effectiveStart = joiningDate && joiningDate > start ? joiningDate : start
  const today = todayISO()
  const effectiveEnd = end > today ? today : end
  if (effectiveStart > effectiveEnd) return []
  const covered = new Set(
    records.filter((r) => r.employeeId === employeeId).map((r) => r.date),
  )
  return allDatesBetween(effectiveStart, effectiveEnd).filter((d) => !covered.has(d))
}

/* ==========================================================================
   SMALL UI PRIMITIVES
   ========================================================================== */

function SummaryCard({ label, value, sub }) {
  return (
    <div className="aw-summary-card">
      <span className="aw-summary-label">{label}</span>
      <span className="aw-summary-value">{value}</span>
      {sub && <span className="aw-summary-sub">{sub}</span>}
    </div>
  )
}

function StatusPill({ status }) {
  const cls = status ? status.toLowerCase().replace(/_/g, '-') : 'unknown'
  return <span className={`aw-status-pill aw-status-${cls}`}>{statusLabel(status)}</span>
}

/* Small "Advance: ₹X outstanding" badge — informational only, never
   deducts anything. Advance deduction happens only through Salary/Payroll
   (see Payroll.jsx / Salary.jsx). */
function AdvanceIndicator({ employeeId }) {
  const { getOutstandingAdvance } = useAdvances()
  const outstanding = getOutstandingAdvance(employeeId)
  if (!outstanding) return null
  return <span className="pll-advance-indicator">Advance: {formatINR(outstanding)} outstanding</span>
}

function EmployeeSelect({ value, onChange, employees, includeAll = false }) {
  return (
    <select
      className="aw-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {includeAll && <option value="">All Employees</option>}
      {employees.map((e) => (
        <option key={e.id} value={e.id}>
          {e.firstName} {e.lastName} — {e.id}
        </option>
      ))}
    </select>
  )
}

/* ==========================================================================
   ATTENDANCE ENTRY FORM (add / edit, modal)
   ========================================================================== */

function blankFormState(employees, presetEmployeeId, presetDate) {
  return {
    employeeId: presetEmployeeId || employees[0]?.id || '',
    date: presetDate || todayISO(),
    status: 'PRESENT',
    loginTime: '09:00',
    logoutTime: '18:00',
    breakHours: 0,
    hourlyRate: '',
    remarks: '',
  }
}

function AttendanceFormModal({ editRecord, presetEmployeeId, presetDate, onClose, onSaved, onJumpToEdit }) {
  const { employees } = useEmployees()
  const { getWageConfig, findByEmployeeDate, saveAttendance } = useAttendance()
  const activeEmployees = employees.filter((e) => !e.archived)

  const [form, setForm] = useState(() => {
    if (editRecord) {
      return {
        employeeId: editRecord.employeeId,
        date: editRecord.date,
        status: editRecord.status,
        loginTime: editRecord.loginTime || '09:00',
        logoutTime: editRecord.logoutTime || '18:00',
        breakHours: editRecord.breakHours || 0,
        hourlyRate: String(editRecord.hourlyRate ?? ''),
        remarks: editRecord.remarks || '',
      }
    }
    return blankFormState(activeEmployees, presetEmployeeId, presetDate)
  })
  const [errors, setErrors] = useState({})
  const [duplicateOf, setDuplicateOf] = useState(null)

  const meta = STATUS_META[form.status]
  const usesTime = meta?.requiresTime
  const config = getWageConfig(form.employeeId)

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleStatusChange(status) {
    setForm((prev) => ({ ...prev, status }))
  }

  const effectiveRate = form.hourlyRate !== '' ? Number(form.hourlyRate) : config.hourlyRate
  const previewHours = usesTime
    ? calcWorkingHours(form.loginTime, form.logoutTime, form.breakHours)
    : 0
  const previewWage = calcDailyWage(form.status, previewHours, effectiveRate, config)

  function validate() {
    const next = {}
    if (!form.employeeId) next.employeeId = 'Employee is required.'
    if (!form.date) next.date = 'Date is required.'
    if (usesTime) {
      if (!form.loginTime) next.loginTime = 'Login time is required.'
      if (!form.logoutTime) next.logoutTime = 'Logout time is required.'
      if (form.loginTime && form.logoutTime && form.loginTime === form.logoutTime) {
        next.logoutTime = 'Logout cannot equal login.'
      }
    }
    if (effectiveRate < 0) next.hourlyRate = 'Hourly rate cannot be negative.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    const existing = findByEmployeeDate(form.employeeId, form.date, editRecord?.id)
    if (existing && !editRecord) {
      setDuplicateOf(existing)
      return
    }

    saveAttendance(
      {
        employeeId: form.employeeId,
        date: form.date,
        status: form.status,
        loginTime: form.loginTime,
        logoutTime: form.logoutTime,
        breakHours: form.breakHours,
        hourlyRate: effectiveRate,
        remarks: form.remarks,
      },
      editRecord?.id || null,
    )
    onSaved()
  }

  const selectedEmployee = activeEmployees.find((e) => e.id === form.employeeId)

  return (
    <div className="aw-modal-overlay" onClick={onClose}>
      <div className="aw-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="aw-modal-head">
          <h3>{editRecord ? 'Edit Attendance' : 'Add Attendance'}</h3>
          <button className="aw-icon-btn" type="button" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <form className="aw-form" onSubmit={handleSubmit}>
          <div className="aw-form-grid">
            <label className="aw-field">
              <span className="aw-field-label">Employee<span className="aw-required">*</span></span>
              <EmployeeSelect
                value={form.employeeId}
                onChange={(v) => set('employeeId', v)}
                employees={activeEmployees}
              />
              {errors.employeeId && <span className="aw-error">{errors.employeeId}</span>}
            </label>

            <label className="aw-field">
              <span className="aw-field-label">Date<span className="aw-required">*</span></span>
              <input
                className="aw-input"
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
              />
              {errors.date && <span className="aw-error">{errors.date}</span>}
            </label>

            <label className="aw-field">
              <span className="aw-field-label">Status<span className="aw-required">*</span></span>
              <select
                className="aw-select"
                value={form.status}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                {ATTENDANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </label>

            <label className="aw-field">
              <span className="aw-field-label">Hourly Rate</span>
              <input
                className="aw-input"
                type="number"
                min="0"
                step="0.01"
                placeholder={String(config.hourlyRate || 0)}
                value={form.hourlyRate}
                onChange={(e) => set('hourlyRate', e.target.value)}
              />
              {errors.hourlyRate && <span className="aw-error">{errors.hourlyRate}</span>}
              <span className="aw-hint">
                Defaults to {selectedEmployee ? selectedEmployee.firstName : 'employee'}'s current
                rate (₹{config.hourlyRate || 0}/hr). This is snapshotted onto the record.
              </span>
            </label>

            <label className={`aw-field ${!usesTime ? 'aw-field-disabled' : ''}`}>
              <span className="aw-field-label">Login Time{usesTime && <span className="aw-required">*</span>}</span>
              <input
                className="aw-input"
                type="time"
                disabled={!usesTime}
                value={usesTime ? form.loginTime : ''}
                onChange={(e) => set('loginTime', e.target.value)}
              />
              {errors.loginTime && <span className="aw-error">{errors.loginTime}</span>}
            </label>

            <label className={`aw-field ${!usesTime ? 'aw-field-disabled' : ''}`}>
              <span className="aw-field-label">Logout Time{usesTime && <span className="aw-required">*</span>}</span>
              <input
                className="aw-input"
                type="time"
                disabled={!usesTime}
                value={usesTime ? form.logoutTime : ''}
                onChange={(e) => set('logoutTime', e.target.value)}
              />
              {errors.logoutTime && <span className="aw-error">{errors.logoutTime}</span>}
            </label>

            <label className={`aw-field ${!usesTime ? 'aw-field-disabled' : ''}`}>
              <span className="aw-field-label">Break (hours)</span>
              <input
                className="aw-input"
                type="number"
                min="0"
                step="0.25"
                disabled={!usesTime}
                value={usesTime ? form.breakHours : 0}
                onChange={(e) => set('breakHours', e.target.value)}
              />
            </label>

            <label className="aw-field aw-field-wide">
              <span className="aw-field-label">Remarks</span>
              <input
                className="aw-input"
                type="text"
                value={form.remarks}
                onChange={(e) => set('remarks', e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="aw-calc-preview">
            {usesTime ? (
              <span>
                {formatHours(previewHours)} × ₹{effectiveRate || 0}/hour = <strong>{formatINR(previewWage)}</strong>
              </span>
            ) : (
              <span>
                {statusLabel(form.status)} — <strong>{formatINR(previewWage)}</strong>
                {meta?.policyBased && (
                  <span className="aw-hint-inline">
                    {' '}(per current wage policy — configurable in Wage Rates)
                  </span>
                )}
              </span>
            )}
          </div>

          {duplicateOf && (
            <div className="aw-duplicate-banner">
              <span>
                Attendance for this employee on {formatDisplayDate(form.date)} already exists
                ({statusLabel(duplicateOf.status)}). Edit it instead of creating a duplicate.
              </span>
              <button
                type="button"
                className="aw-btn-outline aw-btn-sm"
                onClick={() => onJumpToEdit(duplicateOf)}
              >
                Edit existing record
              </button>
            </div>
          )}

          <div className="aw-modal-actions">
            <button type="button" className="aw-btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="aw-btn-primary">
              {editRecord ? 'Save Changes' : 'Save Attendance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ==========================================================================
   WAGE RATES PANEL
   ========================================================================== */

function WageRatesPanel() {
  const { employees } = useEmployees()
  const { getWageConfig, setWageConfig } = useAttendance()
  const { getOutstandingAdvance, getEmployeeAdvances } = useAdvances()
  const activeEmployees = employees.filter((e) => !e.archived)
  const [employeeId, setEmployeeId] = useState(activeEmployees[0]?.id || '')
  const config = getWageConfig(employeeId)
  const [draft, setDraft] = useState(config)
  const [savedFlash, setSavedFlash] = useState(false)
  const [showAdvances, setShowAdvances] = useState(false)

  useMemo(() => {
    setDraft(getWageConfig(employeeId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId])

  function save() {
    if (Number(draft.hourlyRate) < 0 || Number(draft.monthlySalary) < 0) return
    setWageConfig(employeeId, draft)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const employee = activeEmployees.find((e) => e.id === employeeId)

  return (
    <div className="aw-panel">
      <div className="aw-panel-head">
        <h3>Wage Configuration</h3>
        <p>Set how each employee is paid. Changing a rate here only affects future attendance — past records keep the rate stored on them.</p>
      </div>

      <div className="aw-wage-grid">
        <label className="aw-field">
          <span className="aw-field-label">Employee</span>
          <EmployeeSelect value={employeeId} onChange={setEmployeeId} employees={activeEmployees} />
        </label>

        <label className="aw-field">
          <span className="aw-field-label">Salary Type</span>
          <select
            className="aw-select"
            value={draft.salaryType}
            onChange={(e) => setDraft((d) => ({ ...d, salaryType: e.target.value }))}
          >
            <option value="HOURLY">Hourly Wage</option>
            <option value="MONTHLY">Monthly Salary</option>
          </select>
        </label>

        {draft.salaryType === 'HOURLY' ? (
          <label className="aw-field">
            <span className="aw-field-label">Hourly Rate (₹/hour)</span>
            <input
              className="aw-input"
              type="number"
              min="0"
              step="0.01"
              value={draft.hourlyRate}
              onChange={(e) => setDraft((d) => ({ ...d, hourlyRate: e.target.value }))}
            />
          </label>
        ) : (
          <label className="aw-field">
            <span className="aw-field-label">Monthly Salary (₹)</span>
            <input
              className="aw-input"
              type="number"
              min="0"
              step="1"
              value={draft.monthlySalary}
              onChange={(e) => setDraft((d) => ({ ...d, monthlySalary: e.target.value }))}
            />
          </label>
        )}

        <label className="aw-field">
          <span className="aw-field-label">Standard Hours / Day</span>
          <input
            className="aw-input"
            type="number"
            min="1"
            step="0.5"
            value={draft.standardHoursPerDay}
            onChange={(e) => setDraft((d) => ({ ...d, standardHoursPerDay: e.target.value }))}
          />
          <span className="aw-hint">Used only when a leave/holiday/weekly-off is configured as paid below.</span>
        </label>
      </div>

      {employee && (
        <div className="pll-advance-summary" style={{ marginBottom: 18 }}>
          <div className="pll-advance-summary-row">
            <span>Outstanding Advance</span>
            <strong>{formatINR(getOutstandingAdvance(employeeId))}</strong>
          </div>
          <p className="aw-hint" style={{ margin: '6px 0 10px' }}>
            This is read-only here. Wage rate changes never modify an employee's outstanding
            advance — advances are only created, adjusted, or repaid via Salary → Advance Management.
          </p>
          <button type="button" className="pll-btn-outline pll-btn-sm" onClick={() => setShowAdvances(true)}>
            View Advances
          </button>
        </div>
      )}

      <div className="aw-panel-sub">
        <h4>Leave &amp; Holiday Pay Policy</h4>
        <p>No existing payroll policy was found for these — defaulting to unpaid. Adjust per employee if your company pays for them.</p>
        <div className="aw-policy-row">
          {[
            ['paidLeave', 'Paid Leave'],
            ['holiday', 'Holiday'],
            ['weeklyOff', 'Weekly Off'],
          ].map(([key, label]) => (
            <label key={key} className="aw-field">
              <span className="aw-field-label">{label}</span>
              <select
                className="aw-select"
                value={draft.leavePolicy[key]}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    leavePolicy: { ...d.leavePolicy, [key]: e.target.value },
                  }))
                }
              >
                <option value="UNPAID">Unpaid (₹0)</option>
                <option value="FULL_DAY">Paid (standard hours × rate)</option>
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="aw-panel-actions">
        {employee && (
          <span className="aw-panel-current">
            Current: {employee.firstName} {employee.lastName} —{' '}
            {config.salaryType === 'HOURLY'
              ? `₹${config.hourlyRate || 0}/hour`
              : `₹${config.monthlySalary || 0}/month`}
          </span>
        )}
        <button type="button" className="aw-btn-primary" onClick={save}>Save Rate</button>
        {savedFlash && <span className="aw-saved-flash">Saved</span>}
      </div>

      {showAdvances && employee && (
        <EmployeeAdvancesModal
          employeeId={employeeId}
          employeeName={`${employee.firstName} ${employee.lastName}`}
          advances={getEmployeeAdvances(employeeId)}
          onClose={() => setShowAdvances(false)}
        />
      )}
    </div>
  )
}

/* ==========================================================================
   DAILY TAB — dashboard + entry table
   ========================================================================== */

function DailyTab({ onAdd, onEdit }) {
  const { employees } = useEmployees()
  const { records, deleteAttendance } = useAttendance()
  const activeEmployees = employees.filter((e) => !e.archived)

  const [date, setDate] = useState(todayISO())
  const [employeeId, setEmployeeId] = useState('')
  const [status, setStatus] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const dayRecords = records.filter((r) => r.date === date)
  const summary = summarizeRange(records, date, date)
  const totalHours = Object.values(summary).reduce((s, b) => s + b.totalHours, 0)
  const totalWages = Object.values(summary).reduce((s, b) => s + b.totalWage, 0)
  const presentCount = dayRecords.filter((r) => STATUS_META[r.status]?.requiresTime).length
  const absentCount = dayRecords.filter((r) => r.status === 'ABSENT').length

  const weekStart = startOfWeek(todayISO())
  const weekEnd = endOfWeek(todayISO())
  const weekSummary = summarizeRange(records, weekStart, weekEnd)
  const weekWage = Object.values(weekSummary).reduce((s, b) => s + b.totalWage, 0)

  const monthStr = currentMonthStr()
  const { start: mStart, end: mEnd } = monthRange(monthStr)
  const monthSummary = summarizeRange(records, mStart, mEnd)
  const monthWage = Object.values(monthSummary).reduce((s, b) => s + b.totalWage, 0)

  const filteredRows = records
    .filter((r) => (!employeeId || r.employeeId === employeeId))
    .filter((r) => (!status || r.status === status))
    .filter((r) => r.date === date)
    .sort((a, b) => (a.employeeId > b.employeeId ? 1 : -1))

  function employeeName(id) {
    const e = employees.find((emp) => emp.id === id)
    return e ? `${e.firstName} ${e.lastName}` : id
  }

  return (
    <div className="aw-tab">
      <div className="aw-summary-grid">
        <SummaryCard label="Present Today" value={presentCount} sub={`${absentCount} absent`} />
        <SummaryCard label="Hours Today" value={formatHours(totalHours)} />
        <SummaryCard label="Wages Today" value={formatINR(totalWages)} />
        <SummaryCard label="This Week's Wage" value={formatINR(weekWage)} />
        <SummaryCard label="This Month's Wage" value={formatINR(monthWage)} />
      </div>

      <div className="aw-toolbar">
        <label className="aw-field aw-field-inline">
          <span className="aw-field-label">Date</span>
          <input className="aw-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="aw-field aw-field-inline">
          <span className="aw-field-label">Employee</span>
          <EmployeeSelect value={employeeId} onChange={setEmployeeId} employees={activeEmployees} includeAll />
        </label>
        <label className="aw-field aw-field-inline">
          <span className="aw-field-label">Status</span>
          <select className="aw-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {ATTENDANCE_STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
        </label>
        <button type="button" className="aw-btn-primary aw-toolbar-add" onClick={() => onAdd(null, date)}>
          + Add Attendance
        </button>
      </div>

      <div className="aw-table-wrap">
        <table className="aw-table">
          <thead>
            <tr>
              <th>Date</th><th>Employee</th><th>Status</th><th>Login</th><th>Logout</th>
              <th className="aw-num">Hours</th><th className="aw-num">Rate</th>
              <th className="aw-num">Daily Wage</th><th>Remarks</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr><td colSpan={10} className="aw-empty-row">No attendance records for this filter.</td></tr>
            )}
            {filteredRows.map((r) => (
              <tr key={r.id}>
                <td>{formatDisplayDate(r.date)}</td>
                <td>
                  {employeeName(r.employeeId)}
                  <AdvanceIndicator employeeId={r.employeeId} />
                </td>
                <td><StatusPill status={r.status} /></td>
                <td>{r.loginTime || '—'}</td>
                <td>{r.logoutTime || '—'}</td>
                <td className="aw-num">{r.workingHours.toFixed(2)}</td>
                <td className="aw-num">₹{r.hourlyRate}</td>
                <td className="aw-num">{formatINR(r.dailyWage)}</td>
                <td className="aw-remarks">{r.remarks || '—'}</td>
                <td className="aw-row-actions">
                  <button type="button" className="aw-link-btn" onClick={() => onEdit(r)}>Edit</button>
                  <button type="button" className="aw-link-btn aw-link-danger" onClick={() => setDeleteTarget(r)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <div className="aw-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="aw-modal aw-modal-confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>Delete attendance record?</h3>
            <p>
              This removes the record for {employeeName(deleteTarget.employeeId)} on{' '}
              {formatDisplayDate(deleteTarget.date)}. Weekly, monthly, and salary totals will update immediately.
            </p>
            <div className="aw-modal-actions">
              <button type="button" className="aw-btn-outline" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                type="button"
                className="aw-btn-danger"
                onClick={() => { deleteAttendance(deleteTarget.id); setDeleteTarget(null) }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   WEEKLY TAB
   ========================================================================== */

function WeeklyTab() {
  const { employees } = useEmployees()
  const { records, getWageConfig } = useAttendance()
  const { getOutstandingAdvance } = useAdvances()
  const [anchorDate, setAnchorDate] = useState(todayISO())
  const start = startOfWeek(anchorDate)
  const end = endOfWeek(anchorDate)
  const summary = summarizeRange(records, start, end)
  const activeEmployees = employees.filter((e) => !e.archived)

  const rows = activeEmployees
    .map((e) => ({ employee: e, bucket: summary[e.id] }))
    .filter((r) => r.bucket)

  const totalWage = rows.reduce((s, r) => s + r.bucket.totalWage, 0)
  const totalHours = rows.reduce((s, r) => s + r.bucket.totalHours, 0)

  return (
    <div className="aw-tab">
      <div className="aw-toolbar">
        <label className="aw-field aw-field-inline">
          <span className="aw-field-label">Week</span>
          <input className="aw-input" type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
        </label>
        <span className="aw-hint">{formatDisplayDate(start)} – {formatDisplayDate(end)}</span>
      </div>

      <div className="aw-summary-grid aw-summary-grid-tight">
        <SummaryCard label="Total Hours" value={formatHours(totalHours)} />
        <SummaryCard label="Total Wage" value={formatINR(totalWage)} />
        <SummaryCard label="Employees" value={rows.length} />
      </div>

      <div className="aw-table-wrap">
        <table className="aw-table">
          <thead>
            <tr>
              <th>Employee</th><th className="aw-num">Days Worked</th><th className="aw-num">Total Hours</th>
              <th className="aw-num">Hourly Rate</th><th className="aw-num">Total Wage</th>
              <th className="aw-num">Outstanding Advance</th><th>Status Breakdown</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="aw-empty-row">No attendance recorded for this week.</td></tr>
            )}
            {rows.map(({ employee, bucket }) => (
              <tr key={employee.id}>
                <td>{employee.firstName} {employee.lastName}</td>
                <td className="aw-num">{bucket.daysWorked}</td>
                <td className="aw-num">{bucket.totalHours.toFixed(2)}</td>
                <td className="aw-num">₹{getWageConfig(employee.id).hourlyRate || bucket.lastRate}</td>
                <td className="aw-num">{formatINR(bucket.totalWage)}</td>
                <td className="aw-num">{formatINR(getOutstandingAdvance(employee.id))}</td>
                <td className="aw-status-breakdown">
                  {Object.entries(bucket.statusCounts).map(([s, count]) => (
                    <span key={s} className="aw-mini-pill">{statusLabel(s)}: {count}</span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ==========================================================================
   MONTHLY TAB
   ========================================================================== */

function MonthlyTab({ onFixMissing }) {
  const { employees } = useEmployees()
  const { records } = useAttendance()
  const { getOutstandingAdvance } = useAdvances()
  const [month, setMonth] = useState(currentMonthStr())
  const { start, end } = monthRange(month)
  const summary = summarizeRange(records, start, end)
  const activeEmployees = employees.filter((e) => !e.archived)

  const rows = activeEmployees.map((e) => ({
    employee: e,
    bucket: summary[e.id] || { daysWorked: 0, totalHours: 0, totalWage: 0, statusCounts: {} },
    missing: getMissingDates(records, e.id, start, end, e.joiningDate),
  }))

  const totalHours = rows.reduce((s, r) => s + r.bucket.totalHours, 0)
  const totalWage = rows.reduce((s, r) => s + r.bucket.totalWage, 0)
  const totalDays = rows.reduce((s, r) => s + r.bucket.daysWorked, 0)
  const totalMissing = rows.reduce((s, r) => s + r.missing.length, 0)

  return (
    <div className="aw-tab">
      <div className="aw-toolbar">
        <label className="aw-field aw-field-inline">
          <span className="aw-field-label">Month</span>
          <input className="aw-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>

      <div className="aw-summary-grid aw-summary-grid-tight">
        <SummaryCard label="Total Employees" value={activeEmployees.length} />
        <SummaryCard label="Total Working Days" value={totalDays} />
        <SummaryCard label="Total Working Hours" value={formatHours(totalHours)} />
        <SummaryCard label="Total Wage Amount" value={formatINR(totalWage)} />
        {totalMissing > 0 && (
          <SummaryCard label="⚠ Missing Attendance" value={totalMissing} sub="across all employees" />
        )}
      </div>

      <div className="aw-table-wrap">
        <table className="aw-table">
          <thead>
            <tr>
              <th>Employee</th><th className="aw-num">Days Worked</th><th className="aw-num">Total Hours</th>
              <th className="aw-num">Total Wage</th><th className="aw-num">Outstanding Advance</th>
              <th>Status Breakdown</th><th>Missing</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ employee, bucket, missing }) => (
              <tr key={employee.id}>
                <td>{employee.firstName} {employee.lastName}</td>
                <td className="aw-num">{bucket.daysWorked}</td>
                <td className="aw-num">{bucket.totalHours.toFixed(2)}</td>
                <td className="aw-num">{formatINR(bucket.totalWage)}</td>
                <td className="aw-num">{formatINR(getOutstandingAdvance(employee.id))}</td>
                <td className="aw-status-breakdown">
                  {Object.entries(bucket.statusCounts).map(([s, count]) => (
                    <span key={s} className="aw-mini-pill">{statusLabel(s)}: {count}</span>
                  ))}
                  {Object.keys(bucket.statusCounts).length === 0 && '—'}
                </td>
                <td>
                  {missing.length === 0 ? (
                    '—'
                  ) : (
                    <button
                      type="button"
                      className="aw-link-btn aw-link-warning"
                      onClick={() => onFixMissing(employee.id, missing[0])}
                    >
                      ⚠ {missing.length} missing
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ==========================================================================
   EMPLOYEE SUMMARY TAB
   ========================================================================== */

function EmployeeSummaryTab() {
  const { employees } = useEmployees()
  const { records, getWageConfig } = useAttendance()
  const { getEmployeeAdvances, getOutstandingAdvance, getAdvanceRepaymentLog } = useAdvances()
  const activeEmployees = employees.filter((e) => !e.archived)
  const [employeeId, setEmployeeId] = useState(activeEmployees[0]?.id || '')

  const config = getWageConfig(employeeId)
  const weekStart = startOfWeek(todayISO())
  const weekEnd = endOfWeek(todayISO())
  const monthStr = currentMonthStr()
  const { start: mStart, end: mEnd } = monthRange(monthStr)

  const weekBucket = summarizeRange(records, weekStart, weekEnd, employeeId)[employeeId]
  const monthBucket = summarizeRange(records, mStart, mEnd, employeeId)[employeeId]
  const totalAttendance = records.filter(
    (r) => r.employeeId === employeeId && STATUS_META[r.status]?.requiresTime,
  ).length

  const employee = activeEmployees.find((e) => e.id === employeeId)

  const employeeAdvances = getEmployeeAdvances(employeeId)
  const totalAdvanceReceived = employeeAdvances.reduce((s, a) => s + (Number(a.amount) || 0), 0)
  const totalAdvanceRepaid = employeeAdvances.reduce((s, a) => s + (Number(a.totalRepaid) || 0), 0)
  const outstandingAdvance = getOutstandingAdvance(employeeId)
  const monthDeduction = getAdvanceRepaymentLog(employeeId)
    .filter((r) => r.date >= mStart && r.date <= mEnd)
    .reduce((s, r) => s + (Number(r.amount) || 0), 0)

  return (
    <div className="aw-tab">
      <div className="aw-toolbar">
        <label className="aw-field aw-field-inline">
          <span className="aw-field-label">Employee</span>
          <EmployeeSelect value={employeeId} onChange={setEmployeeId} employees={activeEmployees} />
        </label>
      </div>

      {employee && (
        <div className="aw-employee-summary">
          <div className="aw-employee-summary-head">
            <h3>{employee.firstName} {employee.lastName}</h3>
            <span className="aw-hint">{employee.id} · {employee.department}</span>
          </div>

          <div className="pll-section">
            <h4>Attendance Summary</h4>
            <div className="aw-summary-grid">
              <SummaryCard
                label="Current Rate"
                value={config.salaryType === 'HOURLY' ? `₹${config.hourlyRate || 0}/hr` : `₹${config.monthlySalary || 0}/mo`}
              />
              <SummaryCard
                label="This Week"
                value={formatHours(weekBucket?.totalHours || 0)}
                sub={formatINR(weekBucket?.totalWage || 0)}
              />
              <SummaryCard
                label="This Month"
                value={formatHours(monthBucket?.totalHours || 0)}
                sub={formatINR(monthBucket?.totalWage || 0)}
              />
              <SummaryCard label="Total Attendance" value={`${totalAttendance} days`} />
            </div>
          </div>

          <div className="pll-section">
            <h4>Advance Summary</h4>
            <div className="pll-summary-grid">
              <SummaryCard label="Total Advance Received" value={formatINR(totalAdvanceReceived)} />
              <SummaryCard label="Total Repaid" value={formatINR(totalAdvanceRepaid)} />
              <SummaryCard label="Outstanding" value={formatINR(outstandingAdvance)} />
              <SummaryCard label="This Month's Deduction" value={formatINR(monthDeduction)} />
            </div>

            {employeeAdvances.length > 0 && (
              <div className="pll-table-wrap">
                <table className="pll-table">
                  <thead>
                    <tr><th>Date</th><th className="pll-num">Amount</th><th className="pll-num">Repaid</th><th className="pll-num">Outstanding</th><th>Reason</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {employeeAdvances.map((a) => (
                      <tr key={a.id}>
                        <td>{formatDisplayDate(a.advanceDate)}</td>
                        <td className="pll-num">{formatINR(a.amount)}</td>
                        <td className="pll-num">{formatINR(a.totalRepaid)}</td>
                        <td className="pll-num">{formatINR(a.outstandingAmount)}</td>
                        <td>{a.reason || '—'}</td>
                        <td><AdvanceStatusBadge status={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {employeeAdvances.length === 0 && (
              <p className="aw-hint">No advances on record for this employee.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   PAGE SHELL
   ========================================================================== */

/* ==========================================================================
   PAGE SHELL — with Back Button
   ========================================================================== */

const TABS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'employee', label: 'Employee Summary' },
  { key: 'rates', label: 'Wage Rates' },
]

export default function AttendanceWages() {
  const [activeTab, setActiveTab] = useState('daily')
  const [modal, setModal] = useState(null) // { editRecord, presetEmployeeId, presetDate } | null

  // Navigation handler for back button
  const handleBack = () => {
    // Option 1: Use React Router if you have it
    // navigate(-1) or navigate('/hr')
    
    // Option 2: Use window.history
    window.history.back()
    
    // Option 3: Custom navigation - replace with your routing logic
    // window.location.href = '/hr' // or wherever you want to go
  }

  function openAdd(_unused, presetDate) {
    setModal({ editRecord: null, presetDate })
  }
  function openEdit(record) {
    setModal({ editRecord: record })
  }
  function closeModal() {
    setModal(null)
  }
  function handleSaved() {
    setModal(null)
  }
  function handleFixMissing(employeeId, date) {
    setModal({ editRecord: null, presetEmployeeId: employeeId, presetDate: date })
  }

  return (
    <div className="aw-page">
      <div className="aw-page-header">
        <div className="aw-page-header-left">
          <button 
            className="aw-back-btn" 
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
          <div className="aw-page-header-titles">
            <h1>HR Attendance &amp; Wages</h1>
            <p>Log daily login/logout times, configure hourly rates, and feed calculated wages into Salary.</p>
          </div>
        </div>
        <div className="aw-page-header-actions">
          <span className="aw-header-badge">v2.0</span>
        </div>
      </div>

      <div className="aw-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`aw-tab-btn ${activeTab === t.key ? 'aw-tab-btn-active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'daily' && <DailyTab onAdd={openAdd} onEdit={openEdit} />}
      {activeTab === 'weekly' && <WeeklyTab />}
      {activeTab === 'monthly' && <MonthlyTab onFixMissing={handleFixMissing} />}
      {activeTab === 'employee' && <EmployeeSummaryTab />}
      {activeTab === 'rates' && <WageRatesPanel />}

      {modal && (
        <AttendanceFormModal
          editRecord={modal.editRecord}
          presetEmployeeId={modal.presetEmployeeId}
          presetDate={modal.presetDate}
          onClose={closeModal}
          onSaved={handleSaved}
          onJumpToEdit={(record) => setModal({ editRecord: record })}
        />
      )}
    </div>
  )
}