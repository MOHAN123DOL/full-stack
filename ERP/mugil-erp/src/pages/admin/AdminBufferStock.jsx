

import { useCallback, useEffect, useState } from "react";
import AdminCard from "./components/AdminCard";
import AdminDataTable from "./components/AdminDataTable";
import Loading from "../../components/loading";
import ErrorState from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

import "./AdminBufferStock.css";

const BUFFER_STOCK_ENDPOINT = "/erp/admin/buffer-stock/";

export default function AdminBufferStock() {
  const { accessToken } = useAuth();
  
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit Modal State
  const [editRow, setEditRow] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      setError("");
      const response = await api.get(BUFFER_STOCK_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.data?.success) {
        setRows(response.data.data);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load buffer stock data.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save the updated buffer limit
  const handleSaveEdit = async () => {
    if (!editRow) return;
    try {
      setSaving(true);
      await api.patch(
        `${BUFFER_STOCK_ENDPOINT}${editRow.id}/`,
        { buffer_stock_limit: editValue },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setEditRow(null); // Close modal
      loadData(); // Reload table to update colors
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to update buffer limit.");
    } finally {
      setSaving(false);
    }
  };

  const COLUMNS = [
    { key: "materialCode", header: "GRN / Code", mono: true },
    {
      key: "description",
      header: "Description",
      render: (row) => <span className="admin-cell-wrap">{row.description}</span>,
    },
    { key: "warehouse", header: "Warehouse" },
    { key: "unit", header: "Unit" },
    {
      key: "availableQty",
      header: "Available Qty",
      align: "right",
      render: (row) => {
        // Rule: If available quantity is under 100, make it red and bold
        const isLow = row.availableQty < 100;
        
        return (
          <span
            style={{
              color: isLow ? "#ef4444" : "inherit", // Red if under 100, else default
              fontWeight: isLow ? "bold" : "normal",
            }}
          >
            {row.availableQty}
          </span>
        );
      },
    },
    {
      key: "bufferQty",
      header: "Buffer Limit",
      align: "right",
      render: (row) => (
        <span style={{ color: row.bufferQty > 0 ? "inherit" : "#94a3b8" }}>
          {row.bufferQty > 0 ? row.bufferQty : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.isLow ? (
          <span style={{ color: "#ef4444", fontWeight: "bold", fontSize: "11px", backgroundColor: "#fee2e2", padding: "4px 8px", borderRadius: "4px" }}>
            ⚠️ LOW STOCK
          </span>
        ) : (
          <span style={{ color: "#10b981", fontSize: "12px", fontWeight: "bold" }}>OK</span>
        ),
    },
    {
      key: "actions",
      header: "Edit",
      align: "center",
      render: (row) => (
        <button
          onClick={() => {
            setEditRow(row);
            setEditValue(row.bufferQty || 0);
          }}
          style={{
            background: "none",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: "12px",
            color: "#475569",
          }}
        >
          ✏️ Edit
        </button>
      ),
    },
  ];

  return (
    <div className="admin-buffer-stock-page">
      <section className="buffer-stock-hero" style={{ backgroundImage: "url('/buffer_stock/buffer_stock_hero.png')" }}>
        <div className="buffer-stock-hero-overlay" />
        <div className="buffer-stock-hero-content">
          <span className="buffer-stock-eyebrow">INVENTORY CONTROL</span>
          <h1>Buffer Stock</h1>
          <p>Monitor material availability and maintain sufficient buffer levels to support uninterrupted production.</p>
        </div>
        <img src="/buffer_stock/buffer_stock_icon.png" alt="" className="buffer-stock-hero-icon" aria-hidden="true" />
      </section>

      <AdminCard>
        <div className="buffer-stock-card-header">
          <div className="buffer-stock-card-heading">
            <span className="buffer-stock-card-eyebrow">INVENTORY REGISTER</span>
            <h2>Material Buffer List</h2>
            <p>Monitor available quantities against the required buffer stock level.</p>
          </div>
          <div className="buffer-stock-record-count">
            <span className="buffer-stock-record-icon">◇</span>
            <span>{rows.length} Records</span>
          </div>
        </div>

        <div className="buffer-stock-table-wrapper">
          {loading ? (
            <div style={{ padding: "40px 0", display: "flex", justifyContent: "center" }}><Loading /></div>
          ) : error ? (
            <div style={{ padding: "40px 0" }}><ErrorState onRetry={loadData} /></div>
          ) : (
            <AdminDataTable columns={COLUMNS} rows={rows} rowKey="id" emptyTitle="No buffer stock data" minWidth={800} />
          )}
        </div>
      </AdminCard>

      {/* EDIT MODAL OVERLAY */}
      {editRow && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "16px"
          }}
          onClick={() => setEditRow(null)}
        >
          <div
            style={{
              background: "#fff", borderRadius: "12px", padding: "24px", width: "100%", maxWidth: "400px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#0f172a" }}>Set Buffer Limit</h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b" }}>
              {editRow.description} ({editRow.materialCode})
            </p>

            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>
              Minimum Quantity Alert Level ({editRow.unit})
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              style={{
                width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1",
                fontSize: "14px", marginBottom: "20px", boxSizing: "border-box"
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setEditRow(null)}
                style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                style={{
                  padding: "8px 16px", borderRadius: "6px", border: "none",
                  background: "#4f46e5", color: "#fff", fontWeight: "600",
                  cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1
                }}
              >
                {saving ? "Saving..." : "Save Limit"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="buffer-stock-page-note">
        Buffer stock levels help maintain material availability and reduce the risk of production interruptions.
      </div>
    </div>
  );
}