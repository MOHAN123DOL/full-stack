import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Search, Pencil, Eye, X } from "lucide-react";

import AdminCard from "./components/AdminCard";
import AdminDataTable from "./components/AdminDataTable";

import Loading from "../../components/loading";
import ErrorState from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

import "./AdminDocumentNumber.css";

/* =========================================================
   ENDPOINT
   ========================================================= */

const DOCUMENT_NUMBERS_ENDPOINT = "/erp/admin/document-numbers/";

const GENERIC_ERROR = "Something went wrong. Please try again.";

/* =========================================================
   DROPDOWN OPTIONS
   ========================================================= */

const DOCUMENT_TYPES = [
  { value: "all",         label: "All Document Types" },
  { value: "po",          label: "Purchase Order" },
  { value: "quotation",   label: "Quotation" },
  { value: "dc",          label: "Delivery Challan" },
  { value: "tax-invoice", label: "Tax Invoice" },
  { value: "proforma",    label: "Proforma Invoice" },
];

/* =========================================================
   NORMALIZE ROW
   ========================================================= */

const normalizeRow = (row) => ({
  id: row.key,
  key: row.key,
  document_type: row.label || row.key,
  document_number: row.currentNumber || "—",
  nextFormatted: row.nextNumberFormatted || "—",
  prefix: row.prefix || "",
  nextNumber: row.nextNumber ?? 1,
  numberPadding: row.numberPadding ?? 3,
  isActive: Boolean(row.isActive),
  exists: Boolean(row.exists),
});

/* =========================================================
   FORMAT DATE
   ========================================================= */

const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";

    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

/* =========================================================
   TABLE COLUMNS
   ========================================================= */

const createColumns = ({ onEdit, onView }) => [
  {
    key: "document_type",
    header: "Document Type",
    render: (row) => (
      <span className="admin-cell-primary">
        {row.document_type}
      </span>
    ),
  },

  {
    key: "document_number",
    header: "Current Number",
    mono: true,
    render: (row) => (
      <span className="admin-cell-primary">
        {row.document_number}
      </span>
    ),
  },

  {
    key: "nextFormatted",
    header: "Next Document",
    mono: true,
    render: (row) => (
      <span className="document-next-number">
        {row.nextFormatted}
      </span>
    ),
  },

  {
    key: "isActive",
    header: "Active",
    align: "center",
    render: (row) => (
      <span
        className={
          row.isActive
            ? "document-active-badge document-active-badge-on"
            : "document-active-badge document-active-badge-off"
        }
      >
        {row.isActive ? "Active" : "Inactive"}
      </span>
    ),
  },

  {
    key: "actions",
    header: "Actions",
    align: "center",
    render: (row) => (
      <div className="document-actions">
        <button
          type="button"
          className="document-icon-button document-view-button"
          onClick={() => onView(row)}
          title={`View issued numbers for ${row.document_type}`}
          aria-label={`View issued numbers for ${row.document_type}`}
        >
          <Eye size={15} strokeWidth={2} />
        </button>

        <button
          type="button"
          className="document-icon-button document-edit-button"
          onClick={() => onEdit(row)}
          title={`Edit ${row.document_type}`}
          aria-label={`Edit ${row.document_type}`}
        >
          <Pencil size={14} strokeWidth={2} />
        </button>
      </div>
    ),
  },
];

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export default function AdminDocumentNumber() {
  const { accessToken } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [documentType, setDocumentType] = useState("all");

  /* ---------- EDIT MODAL ---------- */
  const [editRow, setEditRow] = useState(null);
  const [formPrefix, setFormPrefix] = useState("");
  const [formNext, setFormNext] = useState(1);
  const [formPad, setFormPad] = useState(3);
  const [formActive, setFormActive] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  /* ---------- VIEW MODAL ---------- */
  const [viewRow, setViewRow] = useState(null);
  const [usedNumbers, setUsedNumbers] = useState([]);
  const [usedLoading, setUsedLoading] = useState(false);
  const [usedError, setUsedError] = useState("");
  const [usedSearch, setUsedSearch] = useState("");

  /* =======================================================
     LOAD LIST
     ======================================================= */

  const loadRows = useCallback(async () => {
    if (!accessToken) {
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError("");

      const res = await api.get(DOCUMENT_NUMBERS_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.data?.success) {
        throw new Error("Invalid response");
      }

      setRows((res.data.data || []).map(normalizeRow));
    } catch (err) {
      console.error("Failed to load document numbers:", err);
      setRows([]);
      setLoadError(err?.response?.data?.message || GENERIC_ERROR);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  /* =======================================================
     EDIT MODAL
     ======================================================= */

  const handleEdit = (row) => {
    setEditRow(row);
    setFormPrefix(row.prefix || "");
    setFormNext(row.nextNumber || 1);
    setFormPad(row.numberPadding || 3);
    setFormActive(Boolean(row.isActive));
    setSaveError("");
  };

  const handleCloseEditModal = () => {
    setEditRow(null);
    setSaveError("");
    setIsSaving(false);
  };

  const handleSave = async () => {
    if (!editRow) return;

    const prefix = String(formPrefix).trim();
    const nextNumber = Number(formNext);
    const numberPadding = Number(formPad);

    if (!prefix) {
      setSaveError("Prefix cannot be empty.");
      return;
    }
    if (!Number.isInteger(nextNumber) || nextNumber < 1) {
      setSaveError("Next number must be a positive integer.");
      return;
    }
    if (
      !Number.isInteger(numberPadding) ||
      numberPadding < 1 ||
      numberPadding > 10
    ) {
      setSaveError("Number padding must be between 1 and 10.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError("");

      const res = await api.patch(
        `${DOCUMENT_NUMBERS_ENDPOINT}${editRow.key}/`,
        {
          prefix,
          nextNumber,
          numberPadding,
          isActive: formActive,
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Save failed.");
      }

      const updated = normalizeRow(res.data.data);

      setRows((current) =>
        current.map((r) => (r.key === updated.key ? updated : r)),
      );

      handleCloseEditModal();
    } catch (err) {
      console.error("Failed to save document number:", err);
      setSaveError(
        err?.response?.data?.message ||
          err?.message ||
          GENERIC_ERROR,
      );
    } finally {
      setIsSaving(false);
    }
  };

  /* =======================================================
     VIEW MODAL
     ======================================================= */

  const handleView = async (row) => {
    setViewRow(row);
    setUsedNumbers([]);
    setUsedError("");
    setUsedSearch("");

    if (!accessToken) return;

    try {
      setUsedLoading(true);

      const res = await api.get(
        `${DOCUMENT_NUMBERS_ENDPOINT}${row.key}/used/`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!res.data?.success) throw new Error("Invalid response");

      setUsedNumbers(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      console.error("Failed to load used numbers:", err);
      setUsedNumbers([]);
      setUsedError(err?.response?.data?.message || GENERIC_ERROR);
    } finally {
      setUsedLoading(false);
    }
  };

  const handleCloseViewModal = () => {
    setViewRow(null);
    setUsedNumbers([]);
    setUsedError("");
    setUsedSearch("");
  };

  const filteredUsed = useMemo(() => {
    const q = usedSearch.trim().toLowerCase();
    if (!q) return usedNumbers;

    return usedNumbers.filter((row) =>
      String(row.number || "").toLowerCase().includes(q),
    );
  }, [usedNumbers, usedSearch]);

  /* =======================================================
     ESC TO CLOSE
     ======================================================= */

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (editRow) handleCloseEditModal();
      else if (viewRow) handleCloseViewModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRow, viewRow]);

  /* =======================================================
     FILTER
     ======================================================= */

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !query ||
        String(row.document_number || "").toLowerCase().includes(query) ||
        String(row.nextFormatted || "").toLowerCase().includes(query) ||
        String(row.document_type || "").toLowerCase().includes(query) ||
        String(row.prefix || "").toLowerCase().includes(query);

      const matchesType =
        documentType === "all" || row.key === documentType;

      return matchesSearch && matchesType;
    });
  }, [rows, searchQuery, documentType]);

  /* =======================================================
     COLUMNS
     ======================================================= */

  const columns = useMemo(
    () =>
      createColumns({
        onEdit: handleEdit,
        onView: handleView,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* =======================================================
     PREVIEW STRING (uses current prefix/pad/next)
     ======================================================= */

  const previewCurrent = useMemo(() => {
    const val = Math.max(Number(formNext) - 1, 0);
    if (val <= 0) return "—";
    const pad = Math.max(1, Number(formPad) || 1);
    return `${String(formPrefix || "").trim()}${String(val).padStart(pad, "0")}`;
  }, [formPrefix, formNext, formPad]);

  const previewNext = useMemo(() => {
    const val = Math.max(1, Number(formNext) || 1);
    const pad = Math.max(1, Number(formPad) || 1);
    return `${String(formPrefix || "").trim()}${String(val).padStart(pad, "0")}`;
  }, [formPrefix, formNext, formPad]);

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="admin-document-number-page">

      {/* HERO */}
      <section
        className="document-number-hero"
        style={{
          backgroundImage: "url('/document_admin/document_hero_bg.png')",
        }}
      >
        <div className="document-number-hero-overlay" />

        <div className="document-number-hero-content">
          <span className="document-number-eyebrow">
            DOCUMENT CONTROL
          </span>

          <h1>Document Number</h1>

          <p>
            Manage document identifiers and their associated saving
            file names across the ERP system.
          </p>
        </div>

        <img
          src="/document_admin/document_hero_icon.png"
          alt="Document management"
          className="document-number-hero-icon"
        />
      </section>

      {/* TABLE CARD */}
      <AdminCard>
        <div className="document-table-heading">
          <div className="document-table-heading-info">
            <span className="document-table-eyebrow">
              DOCUMENT REGISTRY
            </span>

            <h2>Document Records</h2>

            <p>
              Current number (last issued) and the number that will
              be handed out next. Click <strong>View</strong> to see
              numbers already in use, or <strong>Edit</strong> to
              change the next number.
            </p>
          </div>

          <div className="document-table-controls">
            <div className="document-search">
              <Search size={16} strokeWidth={2} />

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                aria-label="Search documents"
              />
            </div>

            <div className="document-type-filter">
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                aria-label="Filter by document type"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="document-record-count">
              {filteredRows.length} Records
            </div>
          </div>
        </div>

        {loading ? (
          <div className="admin-docnum-loading">
            <Loading />
          </div>
        ) : loadError ? (
          <div className="admin-docnum-error">
            <ErrorState onRetry={loadRows} />
            <div style={{ marginTop: 8, fontSize: 13 }}>
              {loadError}
            </div>
          </div>
        ) : (
          <AdminDataTable
            columns={columns}
            rows={filteredRows}
            rowKey="id"
            loading={false}
            error={null}
            onRetry={loadRows}
            emptyTitle="No documents to show"
            emptyMessage={
              searchQuery || documentType !== "all"
                ? "No documents match the selected search or document type."
                : "Document numbers will appear here once document generation is connected."
            }
            minWidth={780}
          />
        )}
      </AdminCard>

      <p className="document-page-note">
        Editing the next number changes the value that will be
        assigned to the next document created in that module.
      </p>

      {/* =====================================================
          EDIT MODAL
          ===================================================== */}
      {editRow && (
        <div
          className="admin-docnum-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleCloseEditModal();
          }}
        >
          <div
            className="admin-docnum-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-docnum-edit-title"
          >
            <div className="admin-docnum-modal-header">
              <div>
                <span className="admin-docnum-modal-eyebrow">
                  EDIT DOCUMENT NUMBER
                </span>

                <h2 id="admin-docnum-edit-title">
                  {editRow.document_type}
                </h2>
              </div>

              <button
                type="button"
                className="admin-docnum-modal-close"
                onClick={handleCloseEditModal}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="admin-docnum-modal-body">
              <label className="admin-docnum-field">
                <span>Prefix</span>
                <input
                  type="text"
                  value={formPrefix}
                  onChange={(e) => setFormPrefix(e.target.value)}
                  maxLength={20}
                  disabled={isSaving}
                />
                <small>
                  Text before the number, e.g. PO, QTN, DC, INV, PF
                </small>
              </label>

              <label className="admin-docnum-field">
                <span>Next Number</span>
                <input
                  type="number"
                  min="1"
                  value={formNext}
                  onChange={(e) => setFormNext(e.target.value)}
                  disabled={isSaving}
                />
                <small>
                  The number that will be issued on the next document.
                  The current number automatically becomes this minus
                  one.
                </small>
              </label>

              <label className="admin-docnum-field">
                <span>Number Padding</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formPad}
                  onChange={(e) => setFormPad(e.target.value)}
                  disabled={isSaving}
                />
                <small>
                  Zero-pad to this many digits, e.g. 3 → 001
                </small>
              </label>

              <label className="admin-docnum-field admin-docnum-checkbox">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  disabled={isSaving}
                />
                <span>Active</span>
              </label>

              <div className="admin-docnum-preview">
                <span>Preview</span>
                <div className="admin-docnum-preview-values">
                  <div>
                    <small>Current</small>
                    <strong>{previewCurrent}</strong>
                  </div>
                  <div>
                    <small>Next</small>
                    <strong>{previewNext}</strong>
                  </div>
                </div>
              </div>

              {saveError && (
                <div className="admin-docnum-error-text" role="alert">
                  {saveError}
                </div>
              )}
            </div>

            <div className="admin-docnum-modal-actions">
              <button
                type="button"
                className="admin-docnum-secondary"
                onClick={handleCloseEditModal}
                disabled={isSaving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="admin-docnum-primary"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          VIEW (USED NUMBERS) MODAL
          ===================================================== */}
      {viewRow && (
        <div
          className="admin-docnum-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleCloseViewModal();
          }}
        >
          <div
            className="admin-docnum-modal admin-docnum-modal-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-docnum-view-title"
          >
            <div className="admin-docnum-modal-header">
              <div>
                <span className="admin-docnum-modal-eyebrow">
                  ISSUED NUMBERS
                </span>

                <h2 id="admin-docnum-view-title">
                  {viewRow.document_type}
                </h2>

                <p className="admin-docnum-modal-subtitle">
                  {usedNumbers.length} number
                  {usedNumbers.length === 1 ? "" : "s"} already issued.
                </p>
              </div>

              <button
                type="button"
                className="admin-docnum-modal-close"
                onClick={handleCloseViewModal}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="admin-docnum-modal-body">
              <div className="admin-docnum-view-search">
                <Search size={15} strokeWidth={2} />

                <input
                  type="text"
                  value={usedSearch}
                  onChange={(e) => setUsedSearch(e.target.value)}
                  placeholder="Filter issued numbers..."
                  aria-label="Filter issued numbers"
                />
              </div>

              {usedLoading ? (
                <div className="admin-docnum-view-loading">
                  <Loading />
                </div>
              ) : usedError ? (
                <div className="admin-docnum-view-error">
                  <ErrorState onRetry={() => handleView(viewRow)} />
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    {usedError}
                  </div>
                </div>
              ) : filteredUsed.length === 0 ? (
                <div className="admin-docnum-view-empty">
                  {usedNumbers.length === 0
                    ? "No documents of this type have been created yet."
                    : "No numbers match your filter."}
                </div>
              ) : (
                <div className="admin-docnum-view-list">
                  {filteredUsed.map((item, idx) => (
                    <div
                      key={`${item.number}-${idx}`}
                      className="admin-docnum-view-row"
                    >
                      <span className="admin-docnum-view-number">
                        {item.number}
                      </span>

                      <span className="admin-docnum-view-date">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="admin-docnum-modal-actions">
              <button
                type="button"
                className="admin-docnum-secondary"
                onClick={handleCloseViewModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}