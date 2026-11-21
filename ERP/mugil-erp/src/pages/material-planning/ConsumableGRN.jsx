import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, PackagePlus, Search, RefreshCw, Pencil, X, Plus, ClipboardList, Layers, Boxes, Warehouse } from "lucide-react";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./ConsumableGRN.css";

const BASE = "/erp/consumable-grn";
const MASTER = "/erp/consumable";
const WAREHOUSES = ["Unit One", "Unit Two"];
const TODAY = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const blank = () => ({ category_id: "", consumable_id: "", consumable_variety: "", supplier: "", supplier_invoice_number: "", quantity: "", warehouse: "", received_by: "", received_date: TODAY(), buffer_stock_limit: "", remarks: "" });
const safeList = (data) => Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : Array.isArray(data?.data) ? data.data : [];
const text = (v) => typeof v === "string" ? v : v == null ? "" : typeof v === "object" ? (v.name || v.companyName || v.company_name || JSON.stringify(v)) : String(v);
const errorText = (err) => {
  const d = err?.response?.data;
  if (typeof d === "string") return d;
  if (d?.detail || d?.message) return text(d.detail || d.message);
  if (d && typeof d === "object") return Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : text(v)}`).join(" | ");
  return err?.message || "Request failed.";
};
const formatQty = (n) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

export default function ConsumableGRN() {
  const { accessToken } = useAuth();
  const [categories, setCategories] = useState([]);
  const [masters, setMasters] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // 'create' or 'edit'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [addKind, setAddKind] = useState(null);
  const [addForm, setAddForm] = useState({ name: "", unit: "Nos", size: "", description: "" });
  const [addError, setAddError] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  const headers = useMemo(() => ({ Authorization: `Bearer ${accessToken}` }), [accessToken]);
  const fetchAll = useCallback(async (refresh = false) => {
    if (!accessToken) { setError("Please log in again."); setLoading(false); return; }
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [c, m, v, g] = await Promise.all([
        api.get(`${MASTER}/categories/`, { headers }),
        api.get(`${MASTER}/masters/`, { headers }),
        api.get(`${MASTER}/varieties/`, { headers }),
        api.get(`${BASE}/direct/`, { headers }),
      ]);
      setCategories(safeList(c.data)); setMasters(safeList(m.data)); setVarieties(safeList(v.data)); setGrns(safeList(g.data));
    } catch (e) { setError(errorText(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [accessToken, headers]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const categoryMasters = masters.filter(m => String(m.category?.id ?? m.category) === String(form.category_id));
  const masterVarieties = varieties.filter(v => String(v.consumable?.id ?? v.consumable) === String(form.consumable_id));
  const chosenMaster = masters.find(m => String(m.id) === String(form.consumable_id));
  const chosenVariety = varieties.find(v => String(v.id) === String(form.consumable_variety));
  const filtered = grns.filter(g => [g.grn_number, g.supplier, g.consumable_name, g.category, g.warehouse, g.supplier_invoice_number, g.consumable_variety?.size, g.consumable_variety?.description, g.variety_size, g.variety_description].map(text).join(" ").toLowerCase().includes(search.toLowerCase().trim()));
  const stats = { grns: grns.length, quantity: grns.reduce((a, g) => a + Number(g.received_quantity || 0), 0), varieties: new Set(grns.map(g => g.consumable_variety?.id ?? g.consumable_variety).filter(Boolean)).size, warehouses: new Set(grns.map(g => g.warehouse).filter(Boolean)).size };

  const openCreate = () => { setEditing(null); setForm(blank()); setFormError(""); setModal("create"); };
  const openEdit = (g) => {
    setEditing(g); setForm({ ...blank(), supplier: g.supplier || "", supplier_invoice_number: g.supplier_invoice_number || "", quantity: String(g.received_quantity ?? ""), warehouse: g.warehouse || "", received_by: g.received_by || "", received_date: g.received_date || TODAY(), buffer_stock_limit: g.buffer_stock_limit == null ? "" : String(g.buffer_stock_limit), remarks: g.remarks || "" });
    setFormError(""); setModal("edit");
  };
  const change = (key, value) => setForm(prev => ({ ...prev, [key]: value, ...(key === "category_id" ? { consumable_id: "", consumable_variety: "" } : {}), ...(key === "consumable_id" ? { consumable_variety: "" } : {}) }));
  const close = () => { if (!busy) { setModal(null); setEditing(null); } };

  const submit = async (e) => {
    e.preventDefault(); if (busy) return;
    if (!form.supplier.trim() || !form.received_by.trim() || !form.warehouse || !form.quantity || Number(form.quantity) <= 0) { setFormError("Supplier, received by, warehouse, and a positive quantity are required."); return; }
    if (!Number.isFinite(Number(form.quantity)) || Number(form.quantity) > 999999999999) { setFormError("Quantity is too large."); return; }
    if (form.buffer_stock_limit !== "" && (Number(form.buffer_stock_limit) < 0 || !Number.isFinite(Number(form.buffer_stock_limit)))) { setFormError("Buffer stock must be zero or greater."); return; }
    if (modal === "create" && (!form.category_id || !form.consumable_id || !form.consumable_variety)) { setFormError("Select a category, consumable and variety, or create them first."); return; }
    setBusy(true); setFormError("");
    try {
      const payload = { supplier: form.supplier.trim(), supplier_invoice_number: form.supplier_invoice_number.trim(), quantity: form.quantity, warehouse: form.warehouse, received_by: form.received_by.trim(), received_date: form.received_date, buffer_stock_limit: form.buffer_stock_limit === "" ? null : form.buffer_stock_limit, remarks: form.remarks.trim() };
      if (modal === "create") await api.post(`${BASE}/direct/`, { ...payload, consumable_variety: form.consumable_variety }, { headers });
      else {
        // Backend prohibits warehouse and variety changes on an existing GRN.
        const { warehouse: ignored, ...patch } = payload;
        void ignored;
        await api.patch(`${BASE}/${editing.id}/`, patch, { headers });
      }
      setModal(null); setEditing(null); await fetchAll(true);
    } catch (err) { setFormError(errorText(err)); }
    finally { setBusy(false); }
  };

  const openAdd = (kind) => { setAddKind(kind); setAddForm({ name: "", unit: "Nos", size: "", description: "" }); setAddError(""); };
  const saveAdd = async (e) => {
    e.preventDefault(); if (addBusy) return;
    if (addKind === "master" && !form.category_id) { setAddError("Choose a category first."); return; }
    if (addKind === "variety" && !form.consumable_id) { setAddError("Choose a consumable first."); return; }
    setAddBusy(true); setAddError("");
    try {
      const payload = addKind === "category" ? { name: addForm.name.trim() } : addKind === "master" ? { name: addForm.name.trim(), unit: addForm.unit.trim(), category: Number(form.category_id) } : { consumable: Number(form.consumable_id), size: addForm.size.trim(), description: addForm.description.trim() };
      const endpoint = addKind === "category" ? "categories" : addKind === "master" ? "masters" : "varieties";
      const response = await api.post(`${MASTER}/${endpoint}/`, payload, { headers });
      const created = response.data?.data || response.data;
      const id = created?.id;
      if (!id) throw new Error("Created successfully but no ID was returned. Refresh and select the new item.");
      if (addKind === "category") { setCategories(prev => [...prev, created]); change("category_id", String(id)); }
      if (addKind === "master") { setMasters(prev => [...prev, created]); change("consumable_id", String(id)); }
      if (addKind === "variety") { setVarieties(prev => [...prev, created]); change("consumable_variety", String(id)); }
      setAddKind(null);
    } catch (err) { setAddError(errorText(err)); }
    finally { setAddBusy(false); }
  };

  return <><Header /><main className="consumable-grn-page">
    <Link to="/inventory/consumable" className="erp-back-button"><ArrowLeft size={16} /> Back</Link>
    <header className="consumable-grn-header"><h1 className="consumable-grn-title">Consumable GRN</h1><p className="consumable-grn-subtitle">Record direct receipts, manage categories and varieties, and correct GRNs safely.</p></header>
    <section className="consumable-grn-summary-grid">
      {[["Total GRNs", stats.grns, ClipboardList, "total"], ["Received Quantity", formatQty(stats.quantity), PackagePlus, "pending"], ["Varieties Received", stats.varieties, Layers, "partial"], ["Warehouses", stats.warehouses, Warehouse, "completed"]].map(([label, value, Icon, color]) => <div key={label} className={`consumable-grn-summary-card consumable-grn-${color}-card`}><div className="consumable-grn-summary-icon"><Icon size={22} /></div><div className="consumable-grn-summary-content"><span className="consumable-grn-summary-label">{label}</span><span className="consumable-grn-summary-value">{value}</span></div></div>)}
    </section>
    <div className="consumable-grn-toolbar"><label className="consumable-grn-search"><Search size={18}/><input className="consumable-grn-search-input" placeholder="Search GRN, supplier, consumable, variety, warehouse..." value={search} onChange={e => setSearch(e.target.value)} /></label><div className="consumable-grn-toolbar-actions"><button className="consumable-grn-refresh-btn" disabled={refreshing || loading} onClick={() => fetchAll(true)}><RefreshCw size={17} className={refreshing ? "consumable-grn-spin" : ""}/> Refresh</button><button className="consumable-grn-add-btn" onClick={openCreate}><PackagePlus size={17}/> New GRN</button></div></div>
    {error && <div className="consumable-grn-error-box">{error} <button onClick={() => fetchAll(true)}>Retry</button></div>}
    <section className="consumable-grn-table-card"><div className="consumable-grn-table-header"><div><h2 className="consumable-grn-table-title">GRN Records</h2><p className="consumable-grn-table-subtitle">Individual receipts remain separate even when stock is combined.</p></div></div><div className="consumable-grn-table-wrapper"><table className="consumable-grn-table"><thead><tr>{["GRN No.", "Received Date", "Category", "Consumable", "Variety", "Size", "Description", "Supplier", "Invoice", "Warehouse", "Received Qty", "Unit", "Received By", "Action"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>
      {loading ? <tr><td colSpan={14} className="consumable-grn-empty-row"><Loading /></td></tr> : filtered.length === 0 ? <tr><td colSpan={14} className="consumable-grn-empty-row">No GRNs found.</td></tr> : filtered.map(g => <tr key={g.id}><td><strong>{g.grn_number}</strong></td><td>{g.received_date || "—"}</td><td>{text(g.category)}</td><td>{text(g.consumable_name)}</td><td>{text(g.consumable_variety?.variety_code || g.variety_code) || "—"}</td><td>{text(g.consumable_variety?.size || g.variety_size) || "—"}</td><td>{text(g.consumable_variety?.description || g.variety_description) || "—"}</td><td>{text(g.supplier)}</td><td>{text(g.supplier_invoice_number) || "—"}</td><td>{g.warehouse}</td><td>{formatQty(g.received_quantity)}</td><td>{g.unit}</td><td>{g.received_by}</td><td><button className="consumable-grn-receive-btn" onClick={() => openEdit(g)}><Pencil size={15}/> Edit</button></td></tr>)}
    </tbody></table></div></section>
    {modal && <div className="consumable-grn-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><div className="consumable-grn-modal consumable-grn-modal-large" role="dialog" aria-modal="true" aria-label={modal === "create" ? "New GRN" : "Edit GRN"}><div className="consumable-grn-modal-header"><div><h2 className="consumable-grn-modal-title">{modal === "create" ? "New Direct GRN" : `Edit ${editing?.grn_number}`}</h2><p className="consumable-grn-modal-subtitle">{modal === "create" ? "Select or create a category, consumable, and variety." : "Variety and warehouse cannot be changed after receipt. Quantity changes are validated by the server."}</p></div><button className="consumable-grn-modal-close" onClick={close} disabled={busy}><X size={20}/></button></div><div className="consumable-grn-modal-body"><form className="consumable-grn-form" onSubmit={submit}>{formError && <div className="consumable-grn-form-error">{formError}</div>}
      {modal === "create" ? <><div className="consumable-grn-form-grid"><div className="consumable-grn-form-group"><label>Category *</label><div className="consumable-grn-inline"><select value={form.category_id} onChange={e => change("category_id", e.target.value)} required><option value="">Select category</option>{categories.filter(c => c.is_active !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" className="consumable-grn-inline-add" title="Add category" onClick={() => openAdd("category")}><Plus size={17}/></button></div></div><div className="consumable-grn-form-group"><label>Consumable *</label><div className="consumable-grn-inline"><select value={form.consumable_id} onChange={e => change("consumable_id", e.target.value)} disabled={!form.category_id} required><option value="">Select consumable</option>{categoryMasters.filter(m => m.is_active !== false).map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}</select><button type="button" className="consumable-grn-inline-add" title="Add consumable" disabled={!form.category_id} onClick={() => openAdd("master")}><Plus size={17}/></button></div></div><div className="consumable-grn-form-group"><label>Variety *</label><div className="consumable-grn-inline"><select value={form.consumable_variety} onChange={e => change("consumable_variety", e.target.value)} disabled={!form.consumable_id} required><option value="">Select variety</option>{masterVarieties.filter(v => v.is_active !== false).map(v => <option key={v.id} value={v.id}>{v.variety_code} · {v.size} · {v.description}</option>)}</select><button type="button" className="consumable-grn-inline-add" title="Add variety" disabled={!form.consumable_id} onClick={() => openAdd("variety")}><Plus size={17}/></button></div></div><div className="consumable-grn-form-group"><label>Unit</label><input value={chosenMaster?.unit || ""} disabled /></div></div>{chosenVariety && <div className="consumable-grn-selection">Variety <b>{chosenVariety.variety_code}</b> · Size: <b>{chosenVariety.size}</b> · {chosenVariety.description}</div>}</> : <div className="consumable-grn-selection"><b>{editing?.category}</b> / <b>{editing?.consumable_name}</b> · {editing?.warehouse}</div>}
      <div className="consumable-grn-form-grid">
      {[["supplier", "Supplier *", "text"], ["supplier_invoice_number", "Supplier Invoice No.", "text"], ["quantity", "Received Quantity *", "number"], ["received_date", "Received Date", "date"], ["received_by", "Received By *", "text"], ["buffer_stock_limit", "Buffer Stock Limit", "number"]].map(([key, label, type]) => <div className="consumable-grn-form-group" key={key}><label>{label}</label><input type={type} min={type === "number" ? (key === "quantity" ? "0.001" : "0") : undefined} step={type === "number" ? "0.001" : undefined} value={form[key]} onChange={e => change(key, e.target.value)} required={["supplier", "quantity", "received_by"].includes(key)} /></div>)}
      {modal === "create" && <div className="consumable-grn-form-group"><label>Warehouse *</label><select required value={form.warehouse} onChange={e => change("warehouse", e.target.value)}><option value="">Select warehouse</option>{WAREHOUSES.map(w => <option key={w}>{w}</option>)}</select></div>}
      <div className="consumable-grn-form-group consumable-grn-form-group-full"><label>Remarks</label><textarea value={form.remarks} onChange={e => change("remarks", e.target.value)} /></div></div>
      <div className="consumable-grn-form-actions"><button type="button" className="consumable-grn-cancel-btn" disabled={busy} onClick={close}>Cancel</button><button className="consumable-grn-save-btn" disabled={busy}>{busy ? "Saving..." : modal === "create" ? "Create GRN" : "Save Changes"}</button></div>
    </form></div></div></div>}
    {addKind && <div className="consumable-grn-modal-overlay consumable-grn-nested-overlay"><div className="consumable-grn-modal consumable-grn-mini-modal" role="dialog" aria-modal="true"><div className="consumable-grn-modal-header"><h2 className="consumable-grn-modal-title">Add {addKind === "master" ? "Consumable" : addKind === "variety" ? "Variety" : "Category"}</h2><button className="consumable-grn-modal-close" onClick={() => !addBusy && setAddKind(null)}><X size={19}/></button></div><div className="consumable-grn-modal-body"><form className="consumable-grn-form" onSubmit={saveAdd}>{addError && <div className="consumable-grn-form-error">{addError}</div>}{addKind !== "variety" ? <><div className="consumable-grn-form-group"><label>Name *</label><input required value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} /></div>{addKind === "master" && <div className="consumable-grn-form-group"><label>Unit *</label><input required value={addForm.unit} onChange={e => setAddForm(p => ({ ...p, unit: e.target.value }))} placeholder="Nos, Kg, Litre" /></div>}</> : <><div className="consumable-grn-form-group"><label>Size *</label><input required value={addForm.size} onChange={e => setAddForm(p => ({ ...p, size: e.target.value }))} placeholder="M10 × 50" /></div><div className="consumable-grn-form-group"><label>Description *</label><textarea required value={addForm.description} onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))} placeholder="Hex Head" /></div><p className="consumable-grn-helper">The backend assigns the next variety code automatically (A, B, C...).</p></>}
      <div className="consumable-grn-form-actions"><button type="button" className="consumable-grn-cancel-btn" disabled={addBusy} onClick={() => setAddKind(null)}>Cancel</button><button className="consumable-grn-save-btn" disabled={addBusy}>{addBusy ? "Saving..." : "Add"}</button></div></form></div></div></div>}
  </main></>;
}
