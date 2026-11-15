import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "../../components/Header";
import { useSalaryApi } from "./salaryApi.js";
import "./Salary.css";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const messageOf = (err) => {
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  if (data?.detail) return String(data.detail);
  if (data && typeof data === "object") {
    const first = Object.values(data)[0];
    if (first) return Array.isArray(first) ? first.join(", ") : String(first);
  }
  return err?.message || "Request failed. Please try again.";
};
const itemsOf = (data) => (Array.isArray(data) ? data : data?.results || []);
const employeeName = (emp) =>
  emp?.name ||
  emp?.employee_name ||
  emp?.full_name ||
  [emp?.first_name, emp?.last_name].filter(Boolean).join(" ") ||
  "Unnamed employee";
const employeeCode = (emp) => emp?.employee_id || emp?.employee_code || "—";
const canModify = (advance) =>
  advance?.can_edit !== undefined
    ? Boolean(advance.can_edit)
    : Number(advance?.total_repaid || 0) === 0;

function AdvanceModal({ employee, advance, onClose, onSaved, api }) {
  const editing = Boolean(advance);
  const [form, setForm] = useState({
    advance_date: advance?.advance_date || today(),
    amount: advance?.amount ?? "",
    reason: advance?.reason || "",
    remarks: advance?.remarks || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Advance amount must be greater than zero.");
      return;
    }
    if (!form.advance_date) {
      setError("Advance date is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = { ...form, amount: String(form.amount) };
      if (editing) await api.updateAdvance(advance.id, payload);
      else await api.createAdvance({ ...payload, employee: employee.id });
      onSaved();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sal-overlay">
      <section
        className="sal-modal"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit advance" : "Add advance"}
      >
        <div className="sal-modal-header">
          <div>
            <h2>{editing ? "Edit Advance" : "Add Advance"}</h2>
            <p>
              {employeeName(employee)} · {employeeCode(employee)}
            </p>
          </div>
          <button
            className="sal-icon-btn"
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form onSubmit={submit} className="sal-form">
          <div className="sal-form-grid">
            <label>
              Advance Date <span>*</span>
              <input
                type="date"
                value={form.advance_date}
                onChange={(e) => set("advance_date", e.target.value)}
                required
              />
            </label>
            <label>
              Amount (₹) <span>*</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                required
              />
            </label>
            <label className="sal-wide">
              Reason
              <input
                type="text"
                maxLength={500}
                value={form.reason}
                onChange={(e) => set("reason", e.target.value)}
                placeholder="Reason for advance"
              />
            </label>
            <label className="sal-wide">
              Remarks
              <textarea
                rows={3}
                value={form.remarks}
                onChange={(e) => set("remarks", e.target.value)}
                placeholder="Optional remarks"
              />
            </label>
          </div>
          {error && (
            <div className="sal-alert sal-alert-error" role="alert">
              {error}
            </div>
          )}
          <div className="sal-modal-actions">
            <button
              type="button"
              className="sal-btn sal-btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="sal-btn sal-btn-primary"
              disabled={busy}
            >
              {busy ? "Saving…" : editing ? "Save Changes" : "Save Advance"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Salary() {
  const api = useSalaryApi();
  const { getSalaryEmployees, getAdvances, deleteAdvance } = api;
  const [tab, setTab] = useState("employees");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [page, setPage] = useState(1);
  const [employeeData, setEmployeeData] = useState({ count: 0, results: [] });
  const [advances, setAdvances] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [advancesLoading, setAdvancesLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [deleting, setDeleting] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, department]);

  useEffect(() => {
    if (tab !== "employees") return;
    let cancelled = false;
    setEmployeesLoading(true);
    setError("");
    getSalaryEmployees({
      search: debouncedSearch,
      department,
      page,
      page_size: 25,
    })
      .then((data) => {
        if (!cancelled)
          setEmployeeData({
            count: data?.count ?? itemsOf(data).length,
            results: itemsOf(data),
            next: data?.next,
            previous: data?.previous,
          });
      })
      .catch((err) => {
        if (!cancelled) setError(messageOf(err));
      })
      .finally(() => {
        if (!cancelled) setEmployeesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, debouncedSearch, department, page, refresh, getSalaryEmployees]);

  // Fetch every advance page, rather than only the first 100, so employee totals are accurate.
  const loadAdvances = useCallback(async () => {
    let nextPage = 1;
    const all = [];
    while (nextPage) {
      const data = await getAdvances({ page: nextPage, page_size: 100 });
      const rows = itemsOf(data);
      all.push(...rows);
      if (Array.isArray(data) || !data?.next) break;
      nextPage += 1;
      if (nextPage > 1000)
        throw new Error("Advance list exceeds supported pagination range.");
    }
    return all;
  }, [getAdvances]);

  useEffect(() => {
    if (tab !== "outstanding") return;
    let cancelled = false;
    setAdvancesLoading(true);
    setError("");
    loadAdvances()
      .then((rows) => {
        if (!cancelled) setAdvances(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(messageOf(err));
      })
      .finally(() => {
        if (!cancelled) setAdvancesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, refresh, loadAdvances]);

  const outstanding = useMemo(() => {
    const byEmployee = new Map();
    for (const a of advances) {
      const due = Number(a.outstanding_amount || 0);
      if (!(due > 0)) continue;
      const id = String(a.employee);
      if (!byEmployee.has(id))
        byEmployee.set(id, {
          id,
          name: a.employee_name || `Employee ${id}`,
          code: a.employee_code || "—",
          amount: 0,
          advances: [],
        });
      const row = byEmployee.get(id);
      row.amount += due;
      row.advances.push(a);
    }
    return Array.from(byEmployee.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [advances]);
  const visibleOutstanding = useMemo(
    () =>
      outstanding.filter((row) =>
        `${row.name} ${row.code}`
          .toLowerCase()
          .includes(debouncedSearch.toLowerCase()),
      ),
    [outstanding, debouncedSearch],
  );
  const totalOutstanding = useMemo(
    () => outstanding.reduce((sum, row) => sum + row.amount, 0),
    [outstanding],
  );

  function saved() {
    setModal(null);
    setNotice("Advance saved successfully.");
    setRefresh((n) => n + 1);
  }
  async function removeAdvance(advance) {
    if (!canModify(advance) || advance.can_delete === false) return;
    if (
      !window.confirm(
        `Delete advance of ${money(advance.amount)} for ${advance.employee_name || "this employee"}?`,
      )
    )
      return;
    setDeleting(advance.id);
    setError("");
    try {
      await deleteAdvance(advance.id);
      setNotice("Advance deleted successfully.");
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <Header
        navLinks={[
          { label: "Employees", path: "/hr/employees" },
          { label: "Attendance", path: "/hr/attendance" },
          { label: "Advance", path: "/hr/salary" },
        ]}
      />
      <main className="sal-page">
        <div className="sal-heading">
          <div>
            <h1>Employee Advances</h1>
            <p>Manage employee advances and view outstanding balances.</p>
          </div>
        </div>
        <div className="sal-tabs" role="tablist" aria-label="Advance sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "employees"}
            className={tab === "employees" ? "active" : ""}
            onClick={() => {
              setTab("employees");
              setError("");
            }}
          >
            Add Advance
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "outstanding"}
            className={tab === "outstanding" ? "active" : ""}
            onClick={() => {
              setTab("outstanding");
              setError("");
            }}
          >
            Outstanding Advances
          </button>
        </div>
        {notice && (
          <div className="sal-alert sal-alert-success" role="status">
            {notice}
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
        {error && (
          <div className="sal-alert sal-alert-error" role="alert">
            {error}
            <button type="button" onClick={() => setRefresh((n) => n + 1)}>
              Retry
            </button>
          </div>
        )}
        <div className="sal-panel">
          <div className="sal-toolbar">
            <input
              aria-label="Search employees"
              className="sal-search"
              placeholder="Search by employee name or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {tab === "employees" && (
              <input
                aria-label="Filter department"
                className="sal-filter"
                placeholder="Department (optional)"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            )}
            <button
              type="button"
              className="sal-btn sal-btn-secondary"
              onClick={() => setRefresh((n) => n + 1)}
            >
              Refresh
            </button>
          </div>
          {tab === "employees" ? (
            <>
              <div className="sal-table-scroll">
                <table className="sal-table">
                  <thead>
                    <tr>
                      <th>Employee ID</th>
                      <th>Employee Name</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Branch</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeesLoading ? (
                      <tr>
                        <td colSpan={6} className="sal-empty">
                          Loading employees…
                        </td>
                      </tr>
                    ) : employeeData.results.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="sal-empty">
                          No employees found.
                        </td>
                      </tr>
                    ) : (
                      employeeData.results.map((emp) => (
                        <tr key={emp.id}>
                          <td>{employeeCode(emp)}</td>
                          <td className="sal-strong">{employeeName(emp)}</td>
                          <td>{emp.department || "—"}</td>
                          <td>{emp.designation || "—"}</td>
                          <td>{emp.branch || "—"}</td>
                          <td>
                            <button
                              type="button"
                              className="sal-btn sal-btn-primary sal-btn-small"
                              onClick={() => setModal({ employee: emp })}
                            >
                              + Add Advance
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="sal-pagination">
                <span>
                  {employeeData.count} employees · Page {page}
                </span>
                <div>
                  <button
                    type="button"
                    className="sal-btn sal-btn-secondary sal-btn-small"
                    disabled={employeesLoading || page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="sal-btn sal-btn-secondary sal-btn-small"
                    disabled={employeesLoading || !employeeData.next}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="sal-stats">
                <div>
                  <span>Employees with outstanding advances</span>
                  <strong>{outstanding.length}</strong>
                </div>
                <div>
                  <span>Total outstanding</span>
                  <strong>{money(totalOutstanding)}</strong>
                </div>
              </div>
              <div className="sal-table-scroll">
                <table className="sal-table">
                  <thead>
                    <tr>
                      <th>Employee ID</th>
                      <th>Employee Name</th>
                      <th>Open Advances</th>
                      <th>Outstanding Amount</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advancesLoading ? (
                      <tr>
                        <td colSpan={5} className="sal-empty">
                          Loading outstanding advances…
                        </td>
                      </tr>
                    ) : visibleOutstanding.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="sal-empty">
                          No outstanding advances found.
                        </td>
                      </tr>
                    ) : (
                      visibleOutstanding.map((row) => (
                        <tr key={row.id}>
                          <td>{row.code}</td>
                          <td className="sal-strong">{row.name}</td>
                          <td>{row.advances.length}</td>
                          <td className="sal-money">{money(row.amount)}</td>
                          <td>
                            <button
                              type="button"
                              className="sal-btn sal-btn-secondary sal-btn-small"
                              onClick={() =>
                                setExpanded((prev) => ({
                                  ...prev,
                                  [row.id]: !prev[row.id],
                                }))
                              }
                            >
                              {expanded[row.id] ? "Hide" : "View"}
                            </button>
                            {expanded[row.id] && (
                              <div className="sal-detail-list">
                                {row.advances.map((a) => (
                                  <div className="sal-detail-item" key={a.id}>
                                    <div>
                                      <strong>
                                        {money(a.outstanding_amount)}
                                      </strong>
                                      <span>
                                        Advance: {money(a.amount)} ·{" "}
                                        {a.advance_date} · {a.status}
                                      </span>
                                      {a.reason && <span>{a.reason}</span>}
                                    </div>
                                    <div className="sal-detail-actions">
                                      {canModify(a) &&
                                        a.can_delete !== false && (
                                          <>
                                            <button
                                              type="button"
                                              className="sal-btn sal-btn-secondary sal-btn-small"
                                              onClick={() =>
                                                setModal({
                                                  employee: {
                                                    id: a.employee,
                                                    name: a.employee_name,
                                                    employee_id:
                                                      a.employee_code,
                                                  },
                                                  advance: a,
                                                })
                                              }
                                            >
                                              Edit
                                            </button>
                                            <button
                                              type="button"
                                              className="sal-btn sal-btn-danger sal-btn-small"
                                              disabled={deleting === a.id}
                                              onClick={() => removeAdvance(a)}
                                            >
                                              {deleting === a.id
                                                ? "Deleting…"
                                                : "Delete"}
                                            </button>
                                          </>
                                        )}
                                      {(!canModify(a) ||
                                        a.can_delete === false) && (
                                        <small>Locked after repayment</small>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
      {modal && (
        <AdvanceModal
          key={modal.advance?.id || modal.employee.id}
          employee={modal.employee}
          advance={modal.advance}
          onClose={() => setModal(null)}
          onSaved={saved}
          api={api}
        />
      )}
    </>
  );
}
