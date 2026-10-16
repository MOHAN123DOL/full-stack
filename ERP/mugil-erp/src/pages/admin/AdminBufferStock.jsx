import AdminCard from "./components/AdminCard";
import AdminDataTable from "./components/AdminDataTable";

import "./AdminBufferStock.css";



/**
 * Sample buffer stock data
 *
 * Replace this later with the Inventory API data.
 */
const BUFFER_STOCK_ROWS = [
  {
    materialCode: "MAT-001",
    description: "Copper Busbar 25mm x 5mm",
    unit: "Kg",
    availableQty: 145,
    bufferQty: 100,
  },
  {
    materialCode: "MAT-002",
    description: "Aluminium Sheet 2mm",
    unit: "Kg",
    availableQty: 82,
    bufferQty: 60,
  },
  {
    materialCode: "MAT-003",
    description: "MS Angle 40 x 40 x 5mm",
    unit: "Nos",
    availableQty: 36,
    bufferQty: 50,
  },
  {
    materialCode: "MAT-004",
    description: "PVC Cable Gland 25mm",
    unit: "Nos",
    availableQty: 240,
    bufferQty: 150,
  },
  {
    materialCode: "MAT-005",
    description: "Control Panel Enclosure 600 x 400",
    unit: "Nos",
    availableQty: 18,
    bufferQty: 15,
  },
  {
    materialCode: "MAT-006",
    description: "MCCB 100A 4 Pole",
    unit: "Nos",
    availableQty: 24,
    bufferQty: 20,
  },
  {
    materialCode: "MAT-007",
    description: "Electrical PVC Wiring Duct",
    unit: "Mtr",
    availableQty: 320,
    bufferQty: 200,
  },
  {
    materialCode: "MAT-008",
    description: "Copper Flexible Cable 10 sqmm",
    unit: "Mtr",
    availableQty: 175,
    bufferQty: 250,
  },
];

/**
 * Table columns
 */
const COLUMNS = [
  {
    key: "materialCode",
    header: "Material Code",
    mono: true,
  },
  {
    key: "description",
    header: "Description",
    render: (row) => (
      <span className="admin-cell-wrap">
        {row.description}
      </span>
    ),
  },
  {
    key: "unit",
    header: "Unit",
  },
  {
    key: "availableQty",
    header: "Available Qty",
    align: "right",
  },
  {
    key: "bufferQty",
    header: "Buffer Qty",
    align: "right",
  },
];

export default function AdminBufferStock() {
  return (
    <div className="admin-buffer-stock-page">

      {/* =====================================================
          HERO SECTION
          ===================================================== */}

      <section
        className="buffer-stock-hero"
        style={{
          backgroundImage: "url('/buffer_stock/buffer_stock_hero.png')",
        }}
      >
        <div className="buffer-stock-hero-overlay" />

        <div className="buffer-stock-hero-content">
          <span className="buffer-stock-eyebrow">
            INVENTORY CONTROL
          </span>

          <h1>Buffer Stock</h1>

          <p>
            Monitor material availability and maintain sufficient
            buffer levels to support uninterrupted production.
          </p>
        </div>

        {/* Separate hero icon asset */}
        <img
  src="/buffer_stock/buffer_stock_icon.png"
  alt=""
  className="buffer-stock-hero-icon"
  aria-hidden="true"
/>
      </section>


      {/* =====================================================
          BUFFER STOCK CARD
          ===================================================== */}

      <AdminCard>

        <div className="buffer-stock-card-header">

          <div className="buffer-stock-card-heading">

            <span className="buffer-stock-card-eyebrow">
              INVENTORY REGISTER
            </span>

            <h2>Material Buffer List</h2>

            <p>
              Monitor available quantities against the required
              buffer stock level for each material.
            </p>

          </div>


          <div className="buffer-stock-record-count">
            <span className="buffer-stock-record-icon">
              ◇
            </span>

            <span>
              {BUFFER_STOCK_ROWS.length} Records
            </span>
          </div>

        </div>


        {/* ===================================================
            DATA TABLE
            =================================================== */}

        <div className="buffer-stock-table-wrapper">

          <AdminDataTable
            columns={COLUMNS}
            rows={BUFFER_STOCK_ROWS}
            rowKey="materialCode"
            emptyTitle="No buffer stock data"
            emptyMessage="The buffer stock list will appear here once it is connected to the Inventory module."
            minWidth={620}
          />

        </div>

      </AdminCard>


      {/* =====================================================
          PAGE FOOTER NOTE
          ===================================================== */}

      <div className="buffer-stock-page-note">
        Buffer stock levels help maintain material availability
        and reduce the risk of production interruptions.
      </div>

    </div>
  );
}