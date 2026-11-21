import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  Pencil,
  RefreshCw,
  Search,
  Send,
  X,
  Lock,
} from "lucide-react";
import Header from "../../components/Header";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./IssueConsumable.css";

const STOCK_URL = "/erp/consumable-grn/issue-stock/";
const ISSUE_URL = "/erp/consumable-grn/issue/";
const HISTORY_URL = "/erp/consumable-grn/issues/";
const asArray = (payload) =>
  Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.data)
        ? payload.data
        : [];
const display = (v) =>
  v == null
    ? ""
    : typeof v === "object"
      ? (v.name ?? v.label ?? v.title ?? "")
      : String(v);
const pick = (obj, ...keys) =>
  keys
    .map((k) => obj?.[k])
    .find((v) => v !== undefined && v !== null && v !== "");
const num = (v) => Number(v) || 0;
const fmt = (v) =>
  num(v).toLocaleString(undefined, { maximumFractionDigits: 3 });
const errText = (e) => {
  const d = e?.response?.data;
  if (typeof d === "string") return d;
  if (typeof d?.detail === "string") return d.detail;
  if (typeof d?.message === "string") return d.message;
  const value =
    d &&
    Object.values(d)
      .flat()
      .find((x) => typeof x === "string");
  return value || e.message || "Request failed";
};
const varietyId = (s) =>
  pick(
    s,
    "variety_id",
    "consumable_variety_id",
    "consumable_variety",
    "varietyId",
    "variety_id_value",
    "variety",
  )?.id ??
  pick(
    s,
    "variety_id",
    "consumable_variety_id",
    "consumable_variety",
    "varietyId",
    "variety",
  );
const category = (s) => display(pick(s, "category", "category_name"));
const master = (s) =>
  display(
    pick(s, "consumable_name", "consumableName", "consumable", "master_name"),
  );
const variety = (s) =>
  display(
    pick(s, "variety_name", "variety_code", "varietyName", "variety", "code"),
  );
const warehouse = (s) => display(pick(s, "warehouse", "warehouse_name"));
const unit = (s) => display(pick(s, "unit", "uom"));
const available = (s) =>
  num(
    pick(
      s,
      "available_quantity",
      "available_qty",
      "availableQty",
      "current_stock",
      "balance_quantity",
    ),
  );
const blank = {
  department: "",
  employeeName: "",
  jobCard: "",
  quantity: "",
  remarks: "",
};

export default function IssueConsumable() {
  const { accessToken } = useAuth();
  const [stocks, setStocks] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [search, setSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken],
  );

  const load = useCallback(
    async (refresh = false) => {
      if (!accessToken) {
        setError("Please log in again.");
        setLoading(false);
        return;
      }
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      setHistoryError("");
      const [stockResult, issueResult] = await Promise.allSettled([
        api.get(STOCK_URL, { headers }),
        api.get(HISTORY_URL, { headers }),
      ]);
      if (stockResult.status === "fulfilled")
        setStocks(asArray(stockResult.value.data));
      else setError(`Could not load stock: ${errText(stockResult.reason)}`);
      if (issueResult.status === "fulfilled")
        setIssues(asArray(issueResult.value.data));
      else
        setHistoryError(
          `Could not load issue history: ${errText(issueResult.reason)}. Add GET ${HISTORY_URL} in Django.`,
        );
      setLoading(false);
      setRefreshing(false);
    },
    [accessToken, headers],
  );
  useEffect(() => {
    load();
  }, [load]);

  // Stock API is authoritative for balances. Merge duplicate variety/warehouse rows only.
  const combined = useMemo(() => {
    const map = new Map();
    for (const s of stocks) {
      const id = varietyId(s);
      const key =
        id != null && typeof id !== "object"
          ? `${id}|${warehouse(s).trim().toLowerCase()}`
          : `${category(s)}|${master(s)}|${variety(s)}|${warehouse(s)}`.toLowerCase();
      if (!map.has(key))
        map.set(key, { ...s, _key: key, _available: 0, _count: 0 });
      const row = map.get(key);
      row._available += available(s);
      row._count++;
    }
    return [...map.values()];
  }, [stocks]);
  const filtered = combined.filter((s) =>
    [
      category(s),
      master(s),
      variety(s),
      warehouse(s),
      display(pick(s, "description", "size")),
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const filteredIssues = issues.filter((i) =>
    [
      pick(i, "issue_number", "id"),
      master(i),
      variety(i),
      pick(i, "department"),
      pick(i, "employee_name", "employeeName"),
      warehouse(i),
    ]
      .join(" ")
      .toLowerCase()
      .includes(historySearch.toLowerCase()),
  );
  const byUnit = useMemo(() => {
    const totals = new Map();
    for (const s of combined)
      totals.set(
        unit(s) || "Units",
        (totals.get(unit(s) || "Units") || 0) + s._available,
      );
    return [...totals.entries()];
  }, [combined]);

  function openCreate(s) {
    setModal({ type: "create", item: s });
    setForm(blank);
    setFormError("");
  }
  function openEdit(i) {
    if (
      i.can_edit === false ||
      num(pick(i, "returned_quantity", "returned_qty", "returnedQty")) > 0 ||
      i.has_returns === true
    )
      return;
    setModal({ type: "edit", item: i });
    setForm({
      department: display(i.department),
      employeeName: display(pick(i, "employee_name", "employeeName")),
      jobCard: display(pick(i, "job_card", "jobCard")),
      quantity: String(pick(i, "quantity", "issued_quantity") ?? ""),
      remarks: display(i.remarks),
    });
    setFormError("");
  }
  function close() {
    if (!saving) {
      setModal(null);
      setFormError("");
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (!modal || saving) return;
    const q = Number(form.quantity);
    if (!form.department.trim() || !form.employeeName.trim()) {
      setFormError("Department and employee name are required.");
      return;
    }
    if (!Number.isFinite(q) || q <= 0) {
      setFormError("Enter a quantity greater than zero.");
      return;
    }
    if (modal.type === "create" && q > modal.item._available) {
      setFormError(`Only ${fmt(modal.item._available)} available.`);
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        department: form.department.trim(),
        employeeName: form.employeeName.trim(),
        jobCard: form.jobCard.trim(),
        quantity: q,
        remarks: form.remarks.trim(),
      };
      if (modal.type === "create") {
        const s = modal.item;
        const id = varietyId(s);
        if (!id || typeof id === "object")
          throw new Error(
            "Stock response must include variety_id / consumable_variety_id for combined-stock issuing.",
          );
        // New direct issue API; no GRN ID in URL.
        await api.post(
          ISSUE_URL,
          { ...payload, consumable_variety: id, warehouse: warehouse(s) },
          { headers },
        );
      } else {
        await api.patch(`${HISTORY_URL}${modal.item.id}/`, payload, {
          headers,
        });
      }
      setModal(null);
      await load(true);
    } catch (e2) {
      setFormError(errText(e2));
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Header />
      <main className="issue-consumable-page">
        <div className="issue-consumable-container">
          <Link
            to="/inventory/consumable"
            className="issue-consumable-back-link"
          >
            <ArrowLeft size={17} /> Back to Consumables
          </Link>
          <section className="issue-consumable-hero">
            <span className="issue-consumable-eyebrow">
              INVENTORY / TRANSACTIONS
            </span>
            <h1 className="issue-consumable-title">Issue Consumables</h1>
            <p className="issue-consumable-description">
              Issue from combined stock and edit individual issue records before
              any return is made.
            </p>
          </section>
          <section className="issue-consumable-summary-grid">
            <div className="issue-consumable-summary-card">
              <Boxes size={26} />
              <div>
                <div className="issue-consumable-summary-value">
                  {combined.filter((s) => s._available > 0).length}
                </div>
                <div className="issue-consumable-summary-label">
                  Available varieties / warehouses
                </div>
              </div>
            </div>
            <div className="issue-consumable-summary-card">
              <Send size={26} />
              <div>
                <div className="issue-consumable-summary-value">
                  {issues.length}
                </div>
                <div className="issue-consumable-summary-label">
                  Recorded issues
                </div>
              </div>
            </div>
          </section>
          <section className="issue-consumable-section">
            <div className="issue-consumable-section-heading">
              <div>
                <h2>Available Stock</h2>
                <p>Combined by variety and warehouse</p>
              </div>
              <div className="issue-consumable-actions">
                <label className="issue-consumable-search-box">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search stock..."
                  />
                </label>
                <button
                  className="issue-consumable-refresh-button"
                  onClick={() => load(true)}
                  disabled={refreshing}
                >
                  <RefreshCw size={16} />
                  {refreshing ? "Refreshing" : "Refresh"}
                </button>
              </div>
            </div>
            {error && (
              <div className="issue-consumable-form-error">{error}</div>
            )}
            <div className="issue-consumable-table-card">
              <div className="issue-consumable-table-scroll">
                <table className="issue-consumable-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Consumable</th>
                      <th>Variety</th>
                      <th>Size / Description</th>
                      <th>Warehouse</th>
                      <th>Available</th>
                      <th>Unit</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8}>Loading stock...</td>
                      </tr>
                    ) : filtered.length ? (
                      filtered.map((s) => (
                        <tr key={s._key}>
                          <td>{category(s) || "—"}</td>
                          <td className="issue-consumable-name">
                            {master(s) || "—"}
                          </td>
                          <td>{variety(s) || "—"}</td>
                          <td>
                            {[display(s.size), display(s.description)]
                              .filter(Boolean)
                              .join(" / ") || "—"}
                          </td>
                          <td>{warehouse(s) || "—"}</td>
                          <td className="issue-consumable-stock-value">
                            {fmt(s._available)}
                          </td>
                          <td>{unit(s) || "—"}</td>
                          <td>
                            <button
                              className="issue-consumable-issue-button"
                              disabled={s._available <= 0}
                              onClick={() => openCreate(s)}
                            >
                              Issue
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={8}
                          className="issue-consumable-empty-state"
                        >
                          No stock matches your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="issue-consumable-unit-totals">
              {byUnit.map(([u, q]) => (
                <span key={u}>
                  {fmt(q)} {u} available
                </span>
              ))}
            </div>
          </section>
          <section className="issue-consumable-section">
            <div className="issue-consumable-section-heading">
              <div>
                <h2>
                  <ClipboardList size={22} /> Issue History
                </h2>
                <p>Edit each issue until a return is recorded against it.</p>
              </div>
              <label className="issue-consumable-search-box">
                <Search size={17} />
                <input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search issue history..."
                />
              </label>
            </div>
            {historyError && (
              <div className="issue-consumable-form-error">{historyError}</div>
            )}
            <div className="issue-consumable-table-card">
              <div className="issue-consumable-table-scroll">
                <table className="issue-consumable-table">
                  <thead>
                    <tr>
                      <th>Issue</th>
                      <th>Date</th>
                      <th>Consumable</th>
                      <th>Variety</th>
                      <th>Warehouse</th>
                      <th>Department</th>
                      <th>Employee</th>
                      <th>Issued</th>
                      <th>Returned</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={10}>Loading history...</td>
                      </tr>
                    ) : filteredIssues.length ? (
                      filteredIssues.map((i) => {
                        const returned = num(
                          pick(
                            i,
                            "returned_quantity",
                            "returned_qty",
                            "returnedQty",
                          ),
                        );
                        const locked =
                          i.can_edit === false ||
                          i.has_returns === true ||
                          returned > 0;
                        return (
                          <tr key={i.id}>
                            <td>
                              {display(
                                pick(
                                  i,
                                  "issue_number",
                                  "reference_number",
                                  "id",
                                ),
                              )}
                            </td>
                            <td>
                              {display(
                                pick(
                                  i,
                                  "issued_date",
                                  "issue_date",
                                  "date",
                                  "created_at",
                                ),
                              )?.slice(0, 10) || "—"}
                            </td>
                            <td>{master(i) || "—"}</td>
                            <td>{variety(i) || "—"}</td>
                            <td>{warehouse(i) || "—"}</td>
                            <td>{display(i.department) || "—"}</td>
                            <td>
                              {display(
                                pick(i, "employee_name", "employeeName"),
                              ) || "—"}
                            </td>
                            <td>
                              {fmt(pick(i, "quantity", "issued_quantity"))}{" "}
                              {unit(i)}
                            </td>
                            <td>{fmt(returned)}</td>
                            <td>
                              {locked ? (
                                <span className="issue-consumable-locked">
                                  <Lock size={14} /> Edit Locked
                                </span>
                              ) : (
                                <button
                                  className="issue-consumable-edit-button"
                                  onClick={() => openEdit(i)}
                                >
                                  <Pencil size={14} /> Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={10}
                          className="issue-consumable-empty-state"
                        >
                          No issue records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
          {modal && (
            <div className="issue-consumable-modal-overlay" onMouseDown={close}>
              <div
                className="issue-consumable-modal"
                onMouseDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className="issue-consumable-modal-header">
                  <h3 className="issue-consumable-modal-title">
                    {modal.type === "edit" ? "Edit Issue" : "Issue Consumable"}
                  </h3>
                  <button
                    className="issue-consumable-modal-close"
                    onClick={close}
                    disabled={saving}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="issue-consumable-modal-body">
                  <div className="issue-consumable-info-panel">
                    <div className="issue-consumable-info-item">
                      <span className="issue-consumable-info-label">
                        Consumable
                      </span>
                      <strong>{master(modal.item) || "—"}</strong>
                    </div>
                    <div className="issue-consumable-info-item">
                      <span className="issue-consumable-info-label">
                        Variety
                      </span>
                      <strong>{variety(modal.item) || "—"}</strong>
                    </div>
                    <div className="issue-consumable-info-item">
                      <span className="issue-consumable-info-label">
                        Warehouse
                      </span>
                      <strong>{warehouse(modal.item) || "—"}</strong>
                    </div>
                    {modal.type === "create" && (
                      <div className="issue-consumable-info-item">
                        <span className="issue-consumable-info-label">
                          Available
                        </span>
                        <strong>
                          {fmt(modal.item._available)} {unit(modal.item)}
                        </strong>
                      </div>
                    )}
                  </div>
                  <form onSubmit={submit} className="issue-consumable-form">
                    {formError && (
                      <div className="issue-consumable-form-error">
                        {formError}
                      </div>
                    )}
                    <div className="issue-consumable-form-grid">
                      {[
                        ["department", "Department *"],
                        ["employeeName", "Employee Name *"],
                        ["jobCard", "Job Card / Production Order"],
                        ["quantity", "Quantity *"],
                      ].map(([key, label]) => (
                        <label className="issue-consumable-field" key={key}>
                          <span>{label}</span>
                          <input
                            type={key === "quantity" ? "number" : "text"}
                            step={key === "quantity" ? "0.001" : undefined}
                            min={key === "quantity" ? "0.001" : undefined}
                            value={form[key]}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, [key]: e.target.value }))
                            }
                            disabled={saving}
                          />
                        </label>
                      ))}
                      <label className="issue-consumable-field issue-consumable-field-full">
                        <span>Remarks</span>
                        <textarea
                          value={form.remarks}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, remarks: e.target.value }))
                          }
                          disabled={saving}
                        />
                      </label>
                    </div>
                    <div className="issue-consumable-modal-actions">
                      <button
                        type="button"
                        className="issue-consumable-cancel-button"
                        onClick={close}
                      >
                        Cancel
                      </button>
                      <button
                        className="issue-consumable-save-button"
                        disabled={saving}
                      >
                        {saving
                          ? "Saving..."
                          : modal.type === "edit"
                            ? "Save Changes"
                            : "Create Issue"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
