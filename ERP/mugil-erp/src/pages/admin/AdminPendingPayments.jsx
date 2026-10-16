import { useMemo, useState } from "react";

import "./AdminPendingPayments.css";

import AdminCard from "./components/AdminCard";
import AdminDataTable from "./components/AdminDataTable";
import AdminStatStrip from "./components/AdminStatStrip";
import AdminToolbar from "./components/AdminToolbar";
import useAdminResource from "./useAdminResource";
import { fetchPendingPayments } from "./adminApi";
import { formatCurrency, matchesQuery } from "./adminUtils";

/* =========================================================
   PREVIEW MODE
   true  = shows sample data for UI development
   false = uses the real API
   ========================================================= */

const PREVIEW_MODE = true;

const PREVIEW_DATA = {
  data: [
    {
      id: 1,
      invoice_number: "INV-2026-001",
      customer_name: "Sri Balaji Hardware",
      outstanding_amount: 185000,
    },
    {
      id: 2,
      invoice_number: "INV-2026-002",
      customer_name: "Metro Electricals",
      outstanding_amount: 127500,
    },
    {
      id: 3,
      invoice_number: "INV-2026-003",
      customer_name: "Kaveri Enterprises",
      outstanding_amount: 92000,
    },
    {
      id: 4,
      invoice_number: "INV-2026-004",
      customer_name: "Sri Murugan Steels",
      outstanding_amount: 248000,
    },
    {
      id: 5,
      invoice_number: "INV-2026-005",
      customer_name: "Trichy Steel Mart",
      outstanding_amount: 76500,
    },
    {
      id: 6,
      invoice_number: "INV-2026-006",
      customer_name: "Vijay Hardware",
      outstanding_amount: 143500,
    },
    {
      id: 7,
      invoice_number: "INV-2026-007",
      customer_name: "Classic Electricals",
      outstanding_amount: 68500,
    },
    {
      id: 8,
      invoice_number: "INV-2026-008",
      customer_name: "ABC Industrial Supplies",
      outstanding_amount: 215000,
    },
  ],
  total_outstanding: 1156000,
};

const COLUMNS = [
  {
    key: "invoice_number",
    header: "Invoice Number",
    mono: true,
    render: (row) => (
      <span className="admin-cell-primary">
        {row.invoice_number || "—"}
      </span>
    ),
  },

  {
    key: "customer_name",
    header: "Customer Name",
    render: (row) => (
      <span className="admin-cell-primary">
        {row.customer_name || "—"}
      </span>
    ),
  },

  {
    key: "outstanding_amount",
    header: "Outstanding Amount",
    align: "right",
    render: (row) => (
      <span className="admin-amount">
        {formatCurrency(row.outstanding_amount)}
      </span>
    ),
  },
];

export default function AdminPendingPayments() {
  const [search, setSearch] = useState("");

  const apiResource = useAdminResource(fetchPendingPayments);

  const data = PREVIEW_MODE
    ? PREVIEW_DATA
    : apiResource.data;

  const loading = PREVIEW_MODE ? false : apiResource.loading;
  const error = PREVIEW_MODE ? null : apiResource.error;
  const reload = apiResource.reload;

  const all = data?.data ?? [];

  const rows = useMemo(
    () =>
      all.filter((r) =>
        matchesQuery(
          search,
          r.invoice_number,
          r.customer_name,
        ),
      ),
    [all, search],
  );

  const visibleTotal = rows.reduce(
    (sum, r) => sum + Number(r.outstanding_amount || 0),
    0,
  );

  const dash = loading || error;

  return (
    <div className="admin-pending-payments-page">

      {/* =====================================================
          HERO
          ===================================================== */}

      <section className="admin-payment-hero">
        <div className="admin-payment-hero-content">
          <span className="admin-payment-eyebrow">
            RECEIVABLES CONTROL
          </span>

          <h1>Pending Customer Payment</h1>

          <p>
            Customer invoices awaiting payment
          </p>
        </div>
      </section>


      {/* =====================================================
          SEARCH
          ===================================================== */}

      <AdminToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search invoice number or customer"
      />


      {/* =====================================================
          KPI CARDS
          ===================================================== */}

      <AdminStatStrip
        items={[
          {
            label: search
              ? "Outstanding (filtered)"
              : "Total Outstanding",
            value: dash
              ? "—"
              : formatCurrency(
                  search
                    ? visibleTotal
                    : data?.total_outstanding,
                ),
            tone: "danger",
          },

          {
            label: "Unpaid Invoices",
            value: dash ? "—" : all.length,
            tone: "info",
          },
        ]}
      />


      {/* =====================================================
          PAYMENT TABLE
          ===================================================== */}

      <AdminCard>
        <div className="admin-payment-card-header">
          <div>
            <h2>Pending Customer Payments</h2>
          </div>

          <span className="admin-payment-count">
            {rows.length} {rows.length === 1 ? "item" : "items"}
          </span>
        </div>

        <AdminDataTable
          columns={COLUMNS}
          rows={rows}
          totalCount={all.length}
          rowKey="id"
          loading={loading}
          error={error}
          onRetry={reload}
          emptyTitle="No outstanding payments"
          emptyMessage={
            all.length
              ? "No invoices match your search."
              : "There are no confirmed customer invoices awaiting payment."
          }
          minWidth={520}
          defaultSort={{
            key: "outstanding_amount",
            direction: "desc",
          }}
        />
      </AdminCard>


      {/* =====================================================
          NOTE
          ===================================================== */}

      <p className="admin-payment-note">
        Shows confirmed tax invoices marked Pending. The
        outstanding amount is the full invoice total, as
        part-payments are not recorded in the system.
      </p>

    </div>
  );
}