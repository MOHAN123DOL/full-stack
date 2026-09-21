import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./ConsumableGRN.css";
import {
  ArrowLeft,
  PackagePlus,
  Search,
  ClipboardList,
  Clock,
  CheckCircle2,
  X,
} from "lucide-react";
import Header from "../../components/Header";
import consumableStore from "../../data/consumableStore";
// import { useEffect, useState } from "react";
// import { Link } from "react-router-dom";
// import {
//   ArrowLeft,
//   PackagePlus,
//   Search,
//   ClipboardList,
//   Clock,
//   CheckCircle2,
//   X,
// } from "lucide-react";
// import Header from "../../components/Header";
// import consumableStore from "../../store/consumableStore";

const initialReceiveForm = {
  quantityReceived: "",
  receivedBy: "",
  remarks: "",
};

const initialDirectForm = {
  supplier: "",
  consumableName: "",
  category: "",
  unit: "",
  quantity: "",
  warehouse: "",
  receivedBy: "",
  remarks: "",
};

export default function ConsumableGRN() {
  const [purchaseOrders, setPurchaseOrders] = useState(
    consumableStore.getPurchaseOrders(),
  );
  const [search, setSearch] = useState("");

  const [selectedPO, setSelectedPO] = useState(null);
  const [receiveForm, setReceiveForm] = useState(initialReceiveForm);

  const [showDirectModal, setShowDirectModal] = useState(false);
  const [directForm, setDirectForm] = useState(initialDirectForm);

  useEffect(() => {
    const unsubscribe = consumableStore.subscribe(() => {
      setPurchaseOrders([...consumableStore.getPurchaseOrders()]);
    });
    return unsubscribe;
  }, []);

  const filteredPOs = purchaseOrders.filter((po) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      po.poNumber.toLowerCase().includes(term) ||
      po.supplier.toLowerCase().includes(term) ||
      po.consumableName.toLowerCase().includes(term) ||
      po.category.toLowerCase().includes(term)
    );
  });

  const stats = {
    total: purchaseOrders.length,
    pending: purchaseOrders.filter((po) => po.status === "Pending").length,
    partial: purchaseOrders.filter((po) => po.status === "Partially Received")
      .length,
    completed: purchaseOrders.filter((po) => po.status === "Completed").length,
  };

  function openReceiveModal(po) {
    setSelectedPO(po);
    setReceiveForm(initialReceiveForm);
  }

  function closeReceiveModal() {
    setSelectedPO(null);
    setReceiveForm(initialReceiveForm);
  }

  function handleReceiveSubmit(e) {
    e.preventDefault();
    if (!selectedPO) return;
    if (!receiveForm.quantityReceived || !receiveForm.receivedBy) return;

    consumableStore.receiveConsumableGRN(selectedPO.poNumber, {
      quantityReceived: Number(receiveForm.quantityReceived),
      receivedBy: receiveForm.receivedBy,
      remarks: receiveForm.remarks,
    });

    closeReceiveModal();
  }

  function openDirectModal() {
    setDirectForm(initialDirectForm);
    setShowDirectModal(true);
  }

  function closeDirectModal() {
    setShowDirectModal(false);
    setDirectForm(initialDirectForm);
  }

  function handleDirectChange(field, value) {
    setDirectForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleDirectSubmit(e) {
    e.preventDefault();
    const {
      supplier,
      consumableName,
      category,
      unit,
      quantity,
      warehouse,
      receivedBy,
    } = directForm;
    if (
      !supplier ||
      !consumableName ||
      !category ||
      !unit ||
      !quantity ||
      !warehouse ||
      !receivedBy
    ) {
      return;
    }

    consumableStore.createDirectConsumableGRN({
      ...directForm,
      quantity: Number(directForm.quantity),
    });

    closeDirectModal();
  }

  return (
    <>
      <Header />
      <div className="consumable-grn-page">
      <Link to="/inventory/consumable" className="erp-back-button">
  <ArrowLeft size={16} />
  Back
</Link>

<header className="consumable-grn-header">

  <div className="consumable-grn-header-content">

    <div className="consumable-grn-title-section">

      

      <h1 className="consumable-grn-title">
        Consumable GRN
      </h1>

      <p className="consumable-grn-subtitle">
        Receive consumables against Purchase Orders or create Direct GRNs for
        local purchases.
      </p>

    </div>

  </div>

</header>


{/* ================= KPI ================= */}

<div className="consumable-grn-summary-grid">

  <div className="consumable-grn-summary-card consumable-grn-total-card">

    <div className="consumable-grn-summary-icon">
      <ClipboardList size={22} />
    </div>

    <div className="consumable-grn-summary-content">

      <span className="consumable-grn-summary-label">
        Total Purchase Orders
      </span>

      <span className="consumable-grn-summary-value">
        {stats.total}
      </span>

    </div>

  </div>


  <div className="consumable-grn-summary-card consumable-grn-pending-card">

    <div className="consumable-grn-summary-icon">
      <Clock size={22} />
    </div>

    <div className="consumable-grn-summary-content">

      <span className="consumable-grn-summary-label">
        Pending
      </span>

      <span className="consumable-grn-summary-value">
        {stats.pending}
      </span>

    </div>

  </div>


  <div className="consumable-grn-summary-card consumable-grn-partial-card">

    <div className="consumable-grn-summary-icon">
      <Clock size={22} />
    </div>

    <div className="consumable-grn-summary-content">

      <span className="consumable-grn-summary-label">
        Partially Received
      </span>

      <span className="consumable-grn-summary-value">
        {stats.partial}
      </span>

    </div>

  </div>


  <div className="consumable-grn-summary-card consumable-grn-completed-card">

    <div className="consumable-grn-summary-icon">
      <CheckCircle2 size={22} />
    </div>

    <div className="consumable-grn-summary-content">

      <span className="consumable-grn-summary-label">
        Completed
      </span>

      <span className="consumable-grn-summary-value">
        {stats.completed}
      </span>

    </div>

  </div>

</div>

    {/* ================= TOOLBAR ================= */}

<div className="consumable-grn-toolbar">

  <div className="consumable-grn-search">

    <Search size={17} />

    <input
      type="text"
      className="consumable-grn-search-input"
      placeholder="Search by PO Number, Supplier, Consumable or Category..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />

  </div>

  <button
    className="consumable-grn-add-btn"
    onClick={openDirectModal}
  >
    <PackagePlus size={17} />
    <span>New Direct GRN</span>
  </button>

</div>

{/* ================= PURCHASE ORDER TABLE ================= */}

<div className="consumable-grn-table-card">

  <div className="consumable-grn-table-header">

    <div>
      <h3 className="consumable-grn-table-title">
        Purchase Orders
      </h3>

      <p className="consumable-grn-table-subtitle">
        Receive consumables against approved purchase orders.
      </p>
    </div>

  </div>

  <div className="consumable-grn-table-wrapper">

    <table className="consumable-grn-table">

      <thead>

        <tr>
          <th>PO Number</th>
          <th>Supplier</th>
          <th>Consumable</th>
          <th>Category</th>
          <th>Unit</th>
          <th>Ordered Qty</th>
          <th>Received Qty</th>
          <th>Pending Qty</th>
          <th>Warehouse</th>
          <th>Status</th>
          <th>Action</th>
        </tr>

      </thead>

      <tbody>

        {filteredPOs.map((po) => (

          <tr key={po.id}>

            <td>{po.poNumber}</td>

            <td>{po.supplier}</td>

            <td>{po.consumableName}</td>

            <td>{po.category}</td>

            <td>{po.unit}</td>

            <td>{po.orderedQty}</td>

            <td>{po.receivedQty}</td>

            <td>{po.pendingQty}</td>

            <td>{po.warehouse}</td>

            <td>

              <span
                className={`consumable-grn-status consumable-grn-status-${po.status
                  .replace(/\s+/g, "-")
                  .toLowerCase()}`}
              >
                {po.status}
              </span>

            </td>

            <td>

              <button
                className="consumable-grn-receive-btn"
                disabled={po.status === "Completed"}
                onClick={() => openReceiveModal(po)}
              >
                Receive
              </button>

            </td>

          </tr>

        ))}

        {filteredPOs.length === 0 && (

          <tr>

            <td
              colSpan={11}
              className="consumable-grn-empty-row"
            >
              No purchase orders found.
            </td>

          </tr>

        )}

      </tbody>

    </table>

  </div>

</div>

{/* ================= RECEIVE MODAL ================= */}

{selectedPO && (
  <div
    className="consumable-grn-modal-overlay"
    onClick={closeReceiveModal}
  >
    <div
      className="consumable-grn-modal"
      onClick={(e) => e.stopPropagation()}
    >

      <div className="consumable-grn-modal-header">

        <div>

          <h2 className="consumable-grn-modal-title">
            Receive Consumable
          </h2>

          <p className="consumable-grn-modal-subtitle">
            Update the received quantity for this Purchase Order.
          </p>

        </div>

        <button
          className="consumable-grn-modal-close"
          onClick={closeReceiveModal}
        >
          <X size={18} />
        </button>

      </div>

      <div className="consumable-grn-modal-body">

        <div className="consumable-grn-info-grid">

          <div className="consumable-grn-info-card">
            <span className="consumable-grn-info-label">
              PO Number
            </span>

            <span className="consumable-grn-info-value">
              {selectedPO.poNumber}
            </span>
          </div>

          <div className="consumable-grn-info-card">
            <span className="consumable-grn-info-label">
              Consumable
            </span>

            <span className="consumable-grn-info-value">
              {selectedPO.consumableName}
            </span>
          </div>

          <div className="consumable-grn-info-card">
            <span className="consumable-grn-info-label">
              Ordered Qty
            </span>

            <span className="consumable-grn-info-value">
              {selectedPO.orderedQty}
            </span>
          </div>

          <div className="consumable-grn-info-card">
            <span className="consumable-grn-info-label">
              Received Qty
            </span>

            <span className="consumable-grn-info-value">
              {selectedPO.receivedQty}
            </span>
          </div>

          <div className="consumable-grn-info-card">
            <span className="consumable-grn-info-label">
              Pending Qty
            </span>

            <span className="consumable-grn-info-value">
              {selectedPO.pendingQty}
            </span>
          </div>

        </div>

        <form
          className="consumable-grn-form"
          onSubmit={handleReceiveSubmit}
        >

          <div className="consumable-grn-form-group">

            <label>Quantity Received</label>

            <input
              type="number"
              min="1"
              max={selectedPO.pendingQty}
              value={receiveForm.quantityReceived}
              onChange={(e) =>
                setReceiveForm((prev) => ({
                  ...prev,
                  quantityReceived: e.target.value,
                }))
              }
              required
            />

          </div>

          <div className="consumable-grn-form-group">

            <label>Received By</label>

            <input
              type="text"
              value={receiveForm.receivedBy}
              onChange={(e) =>
                setReceiveForm((prev) => ({
                  ...prev,
                  receivedBy: e.target.value,
                }))
              }
              required
            />

          </div>

          <div className="consumable-grn-form-group">

            <label>Remarks</label>

            <textarea
              value={receiveForm.remarks}
              onChange={(e) =>
                setReceiveForm((prev) => ({
                  ...prev,
                  remarks: e.target.value,
                }))
              }
            />

          </div>

          <div className="consumable-grn-form-actions">

            <button
              type="button"
              className="consumable-grn-cancel-btn"
              onClick={closeReceiveModal}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="consumable-grn-save-btn"
            >
              Save
            </button>

          </div>

        </form>

      </div>

    </div>
  </div>
)}

{/* ================= DIRECT GRN MODAL ================= */}

{showDirectModal && (
  <div
    className="consumable-grn-modal-overlay"
    onClick={closeDirectModal}
  >
    <div
      className="consumable-grn-modal consumable-grn-modal-large"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="consumable-grn-modal-header">

        <div>

          <h2 className="consumable-grn-modal-title">
            New Direct GRN
          </h2>

          <p className="consumable-grn-modal-subtitle">
            Record consumables received directly from a supplier without a Purchase Order.
          </p>

        </div>

        <button
          className="consumable-grn-modal-close"
          onClick={closeDirectModal}
        >
          <X size={18} />
        </button>

      </div>

      <div className="consumable-grn-modal-body">

        <form
          className="consumable-grn-form consumable-grn-form-grid"
          onSubmit={handleDirectSubmit}
        >

          <div className="consumable-grn-form-group">
            <label>Supplier</label>
            <input
              type="text"
              value={directForm.supplier}
              onChange={(e) =>
                handleDirectChange("supplier", e.target.value)
              }
              required
            />
          </div>

          <div className="consumable-grn-form-group">
            <label>Consumable Name</label>
            <input
              type="text"
              value={directForm.consumableName}
              onChange={(e) =>
                handleDirectChange("consumableName", e.target.value)
              }
              required
            />
          </div>

          <div className="consumable-grn-form-group">
            <label>Category</label>
            <input
              type="text"
              value={directForm.category}
              onChange={(e) =>
                handleDirectChange("category", e.target.value)
              }
              required
            />
          </div>

          <div className="consumable-grn-form-group">
            <label>Unit</label>
            <input
              type="text"
              placeholder="Nos, Kg, Litre..."
              value={directForm.unit}
              onChange={(e) =>
                handleDirectChange("unit", e.target.value)
              }
              required
            />
          </div>

          <div className="consumable-grn-form-group">
            <label>Quantity</label>
            <input
              type="number"
              min="1"
              value={directForm.quantity}
              onChange={(e) =>
                handleDirectChange("quantity", e.target.value)
              }
              required
            />
          </div>

          <div className="consumable-grn-form-group">
            <label>Warehouse</label>
            <input
              type="text"
              value={directForm.warehouse}
              onChange={(e) =>
                handleDirectChange("warehouse", e.target.value)
              }
              required
            />
          </div>

          <div className="consumable-grn-form-group">
            <label>Received By</label>
            <input
              type="text"
              value={directForm.receivedBy}
              onChange={(e) =>
                handleDirectChange("receivedBy", e.target.value)
              }
              required
            />
          </div>

          <div className="consumable-grn-form-group consumable-grn-form-group-full">
            <label>Remarks</label>
            <textarea
              value={directForm.remarks}
              onChange={(e) =>
                handleDirectChange("remarks", e.target.value)
              }
            />
          </div>

          <div className="consumable-grn-form-actions consumable-grn-form-actions-full">

            <button
              type="button"
              className="consumable-grn-cancel-btn"
              onClick={closeDirectModal}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="consumable-grn-save-btn"
            >
              Save
            </button>

          </div>

        </form>

      </div>
    </div>
  </div>
)}
      </div>
    </>
  );
}
