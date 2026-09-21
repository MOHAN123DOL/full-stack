import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./Deliverychallanform.css";

/* ========================================================================
   DELIVERY CHALLAN NUMBER GENERATION
   ======================================================================== */

const DC_NUMBER_CONFIG = {
    storageKey: "deliveryChallanLastNumber",
    seedNumber: 458,
    prefix: "",
    suffix: "",
    padLength: 0,
};

function formatChallanNumber(num) {
    const { prefix, suffix, padLength } = DC_NUMBER_CONFIG;
    const numStr = padLength > 0 ? String(num).padStart(padLength, "0") : String(num);
    return `${prefix}${numStr}${suffix}`;
}

async function generateDeliveryChallanNumber() {
    const { storageKey, seedNumber } = DC_NUMBER_CONFIG;
    const stored = window.localStorage.getItem(storageKey);
    const lastNumber = stored ? parseInt(stored, 10) : seedNumber - 1;
    const nextNumber = Number.isNaN(lastNumber) ? seedNumber : lastNumber + 1;
    window.localStorage.setItem(storageKey, String(nextNumber));
    return formatChallanNumber(nextNumber);
}

/* ========================================================================
   DRAFT PERSISTENCE
   ======================================================================== */

const DRAFT_STORAGE_KEY = "deliveryChallanDraft";
const DRAFT_META_KEY = "deliveryChallanDraftMeta";

function loadDraft() {
    try {
        const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        console.error("Failed to load draft:", err);
        return null;
    }
}

function saveDraft(data) {
    try {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
        window.localStorage.setItem(DRAFT_META_KEY, JSON.stringify({
            updatedAt: new Date().toISOString()
        }));
        return true;
    } catch (err) {
        console.error("Failed to save draft:", err);
        return false;
    }
}

function clearDraft() {
    try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        window.localStorage.removeItem(DRAFT_META_KEY);
        return true;
    } catch (err) {
        console.error("Failed to clear draft:", err);
        return false;
    }
}

function getDraftMeta() {
    try {
        const raw = window.localStorage.getItem(DRAFT_META_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}

/* ========================================================================
   ITEM ROW HELPERS
   ======================================================================== */

function generateItemId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyItem() {
    return {
        id: generateItemId(),
        description: "",
        quantity: "",
        rate: "",
        remarks: "",
    };
}

function getTodayISO() {
    return new Date().toISOString().slice(0, 10);
}

function createEmptyFormData() {
    return {
        dcNumber: "",
        dcDate: getTodayISO(),
        poNumber: "",
        poDate: "",
        billNumber: "",
        billDate: "",
        deliveryAt: "",
        customer: {
            companyName: "",
            address: "",
            contactPerson: "",
            phone: "",
            gstNumber: "",
        },
        items: [createEmptyItem()],
        amountInWords: "",
        preparedBy: "",
    };
}

/* ========================================================================
   COMPONENT
   ======================================================================== */

export default function DeliveryChallanForm() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState(createEmptyFormData);
    const [draftStatus, setDraftStatus] = useState("");
    const [draftSavedTime, setDraftSavedTime] = useState(null);
    const [isDraftRestored, setIsDraftRestored] = useState(false);
    const [isPreviewMode, setIsPreviewMode] = useState(false);

    const hasLoadedRef = useRef(false);
    const saveTimeoutRef = useRef(null);
    const isInitialLoadRef = useRef(true);

    // ================================================================
    // LOAD DRAFT ON MOUNT
    // ================================================================

    useEffect(() => {
        if (hasLoadedRef.current) return;
        hasLoadedRef.current = true;

        const draft = loadDraft();
        const meta = getDraftMeta();

        if (draft && draft.dcNumber) {
            setFormData(draft);
            setIsDraftRestored(true);
            if (meta && meta.updatedAt) {
                setDraftSavedTime(new Date(meta.updatedAt));
                setDraftStatus(`Draft loaded — last saved at ${new Date(meta.updatedAt).toLocaleTimeString()}`);
            } else {
                setDraftStatus("Draft loaded");
            }
            setTimeout(() => setDraftStatus(""), 3000);
            return;
        }

        generateDeliveryChallanNumber().then((number) => {
            setFormData((prev) => ({ ...prev, dcNumber: number }));
        });
    }, []);

    // ================================================================
    // AUTO-SAVE (debounced)
    // ================================================================

    useEffect(() => {
        if (isInitialLoadRef.current) {
            isInitialLoadRef.current = false;
            return;
        }

        if (isPreviewMode) return;
        if (!hasLoadedRef.current) return;

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            if (formData.dcNumber) {
                const ok = saveDraft(formData);
                if (ok) {
                    setDraftSavedTime(new Date());
                    setDraftStatus("Draft saved");
                    setTimeout(() => setDraftStatus(""), 2000);
                }
            }
        }, 800);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [formData, isPreviewMode]);

    // ================================================================
    // HANDLERS
    // ================================================================

    const updateField = useCallback((field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    }, []);

    const updateCustomerField = useCallback((field, value) => {
        setFormData((prev) => ({
            ...prev,
            customer: { ...prev.customer, [field]: value },
        }));
    }, []);

    const updateItem = useCallback((id, field, value) => {
        setFormData((prev) => ({
            ...prev,
            items: prev.items.map((item) =>
                item.id === id ? { ...item, [field]: value } : item
            ),
        }));
    }, []);

    const addRow = useCallback(() => {
        setFormData((prev) => ({
            ...prev,
            items: [...prev.items, createEmptyItem()],
        }));
    }, []);

    const duplicateRow = useCallback((id) => {
        setFormData((prev) => {
            const index = prev.items.findIndex((item) => item.id === id);
            if (index === -1) return prev;
            const clone = { ...prev.items[index], id: generateItemId() };
            const items = [...prev.items];
            items.splice(index + 1, 0, clone);
            return { ...prev, items };
        });
    }, []);

    const deleteRow = useCallback((id) => {
        setFormData((prev) => {
            if (prev.items.length <= 1) return prev;
            return { ...prev, items: prev.items.filter((item) => item.id !== id) };
        });
    }, []);

    // ================================================================
    // SAVE DRAFT
    // ================================================================

    const handleSaveDraft = useCallback(() => {
        const ok = saveDraft(formData);
        if (ok) {
            const now = new Date();
            setDraftSavedTime(now);
            setDraftStatus(`Draft saved at ${now.toLocaleTimeString()}`);
            setTimeout(() => setDraftStatus(""), 3000);
        } else {
            setDraftStatus("Could not save draft");
            setTimeout(() => setDraftStatus(""), 3000);
        }
    }, [formData]);

    // ================================================================
    // NEW CHALLAN
    // ================================================================

    const handleNewChallan = useCallback(() => {
        if (!window.confirm("Are you sure you want to create a new Delivery Challan? Current draft will be cleared.")) {
            return;
        }

        clearDraft();
        const empty = createEmptyFormData();
        setFormData(empty);
        setIsDraftRestored(false);
        setDraftSavedTime(null);
        setDraftStatus("Creating new challan...");

        generateDeliveryChallanNumber().then((number) => {
            setFormData((prev) => ({ ...prev, dcNumber: number }));
            setDraftStatus("New challan ready");
            setTimeout(() => setDraftStatus(""), 2000);
        });
    }, []);

    // ================================================================
    // CLEAR DRAFT
    // ================================================================

    const handleClearDraft = useCallback(() => {
        if (!window.confirm("Are you sure you want to clear this Delivery Challan draft?")) {
            return;
        }

        clearDraft();
        const empty = createEmptyFormData();
        setFormData(empty);
        setIsDraftRestored(false);
        setDraftSavedTime(null);
        setDraftStatus("Draft cleared");

        generateDeliveryChallanNumber().then((number) => {
            setFormData((prev) => ({ ...prev, dcNumber: number }));
            setTimeout(() => setDraftStatus(""), 2000);
        });
    }, []);

    // ================================================================
    // PREVIEW (SAME TAB)
    // ================================================================

    const handlePreview = useCallback(() => {
        // Validate
        if (!formData.dcNumber) {
            alert("Please wait for the DC number to be generated.");
            return;
        }

        if (!formData.customer.companyName.trim()) {
            alert("Please enter a customer company name.");
            return;
        }

        const hasItemData = formData.items.some(
            (item) => item.description.trim() !== "" || item.quantity || item.rate
        );
        if (!hasItemData) {
            alert("Please add at least one item.");
            return;
        }

        // Save draft
        saveDraft(formData);

        // Navigate to print page with data in URL
        const dataParam = encodeURIComponent(JSON.stringify(formData));
        window.location.href = `/DeliveryChallanPrint.html?data=${dataParam}`;
    }, [formData]);

    // ================================================================
    // BACK TO FORM
    // ================================================================

    const handleBack = useCallback(() => {
        navigate(-1);
    }, [navigate]);

    // ================================================================
    // RENDER
    // ================================================================

    return (
        <div className="form-page">
            <div className="form-header">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-800 transition-colors"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M19 12H5" />
                        <path d="M12 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
                <h2>Delivery Challan</h2>
                <div className="form-header-actions">
                    {draftStatus && <span className="form-status">{draftStatus}</span>}
                    {draftSavedTime && (
                        <span className="form-status form-status-meta">
                            Last saved: {draftSavedTime.toLocaleTimeString()}
                        </span>
                    )}
                    {isDraftRestored && (
                        <span className="form-status form-status-restored">
                            Draft restored
                        </span>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="form-actions-top" style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleNewChallan}
                >
                    + New Challan
                </button>
                <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={handleClearDraft}
                    style={{ color: '#dc3545', borderColor: '#dc3545' }}
                >
                    Clear Draft
                </button>
            </div>

            {/* SECTION 1: Delivery Challan Details */}
            <section className="form-section">
                <h3 className="form-section-title">Delivery Challan Details</h3>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label">DC Number</label>
                        <input
                            type="text"
                            className="form-input form-input-readonly"
                            value={formData.dcNumber}
                            readOnly
                            disabled
                            title="Auto-generated — cannot be edited"
                            style={{
                                backgroundColor: "var(--bg-surface-muted)",
                                color: "var(--text-secondary)",
                                cursor: "not-allowed",
                            }}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">DC Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={formData.dcDate}
                            onChange={(e) => updateField("dcDate", e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">PO / LO / WO Number</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.poNumber}
                            onChange={(e) => updateField("poNumber", e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">PO / LO / WO Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={formData.poDate}
                            onChange={(e) => updateField("poDate", e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Bill Number</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.billNumber}
                            onChange={(e) => updateField("billNumber", e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Bill Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={formData.billDate}
                            onChange={(e) => updateField("billDate", e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Delivery At</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.deliveryAt}
                            onChange={(e) => updateField("deliveryAt", e.target.value)}
                        />
                    </div>
                </div>
            </section>

            {/* SECTION 2: Customer Details */}
            <section className="form-section">
                <h3 className="form-section-title">Customer Details</h3>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label">Company Name *</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.customer.companyName}
                            onChange={(e) =>
                                updateCustomerField("companyName", e.target.value)
                            }
                            required
                        />
                    </div>
                    <div className="form-group form-group-wide">
                        <label className="form-label">Address</label>
                        <textarea
                            className="form-textarea"
                            rows={2}
                            value={formData.customer.address}
                            onChange={(e) => updateCustomerField("address", e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Contact Person</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.customer.contactPerson}
                            onChange={(e) =>
                                updateCustomerField("contactPerson", e.target.value)
                            }
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input
                            type="tel"
                            className="form-input"
                            value={formData.customer.phone}
                            onChange={(e) => updateCustomerField("phone", e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">GST Number</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.customer.gstNumber}
                            onChange={(e) => updateCustomerField("gstNumber", e.target.value)}
                        />
                    </div>
                </div>
            </section>

            {/* SECTION 3: Items */}
            <section className="form-section">
                <h3 className="form-section-title">Items</h3>
                <table className="form-table">
                    <thead>
                        <tr>
                            <th>SL No</th>
                            <th>Description</th>
                            <th>Quantity</th>
                            <th>Rate Per Piece</th>
                            <th>Remarks</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {formData.items.map((item, index) => (
                            <tr key={item.id}>
                                <td>{index + 1}</td>
                                <td>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={item.description}
                                        onChange={(e) =>
                                            updateItem(item.id, "description", e.target.value)
                                        }
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={item.quantity}
                                        onChange={(e) =>
                                            updateItem(item.id, "quantity", e.target.value)
                                        }
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={item.rate}
                                        onChange={(e) =>
                                            updateItem(item.id, "rate", e.target.value)
                                        }
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={item.remarks}
                                        onChange={(e) =>
                                            updateItem(item.id, "remarks", e.target.value)
                                        }
                                    />
                                </td>
                                <td className="form-table-actions">
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        onClick={() => duplicateRow(item.id)}
                                    >
                                        Duplicate
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-danger btn-sm"
                                        onClick={() => deleteRow(item.id)}
                                        disabled={formData.items.length <= 1}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button type="button" className="btn btn-secondary" onClick={addRow}>
                    + Add Row
                </button>
            </section>

            {/* SECTION 4: Amount In Words */}
            <section className="form-section">
                <h3 className="form-section-title">Amount In Words</h3>
                <textarea
                    className="form-textarea"
                    rows={3}
                    value={formData.amountInWords}
                    onChange={(e) => updateField("amountInWords", e.target.value)}
                    placeholder="e.g. Rupees Twelve Thousand Five Hundred Only"
                />
            </section>

            {/* SECTION 5: Prepared By */}
            <section className="form-section">
                <h3 className="form-section-title">Prepared By</h3>
                <div className="form-group">
                    <input
                        type="text"
                        className="form-input"
                        value={formData.preparedBy}
                        onChange={(e) => updateField("preparedBy", e.target.value)}
                    />
                </div>
            </section>

            {/* FORM ACTIONS */}
            <div className="form-actions">
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleSaveDraft}
                >
                    Save Draft
                </button>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handlePreview}
                >
                    Preview & Print
                </button>
            </div>
        </div>
    );
}