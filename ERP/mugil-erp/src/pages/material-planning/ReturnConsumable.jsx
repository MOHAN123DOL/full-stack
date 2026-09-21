import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Undo2, X } from "lucide-react";
import Header from "../../components/Header";
import consumableStore from "../../data/consumableStore";
import "./ReturnConsumable.css";

// import { useEffect, useState } from "react";
// import { Link } from "react-router-dom";
// import { ArrowLeft, Search, Undo2, X } from "lucide-react";
// import Header from "../../components/Header";
// import consumableStore from "../../store/consumableStore";

const initialReturnForm = {
  returnQty: "",
  remarks: "",
};

export default function ReturnConsumable() {
  const [issued, setIssued] = useState(consumableStore.getIssuedConsumables());
  const [search, setSearch] = useState("");

  const [selectedIssue, setSelectedIssue] = useState(null);
  const [returnForm, setReturnForm] = useState(initialReturnForm);

  useEffect(() => {
    const unsubscribe = consumableStore.subscribe(() => {
      setIssued([...consumableStore.getIssuedConsumables()]);
    });
    return unsubscribe;
  }, []);

  const filteredIssued = issued.filter((item) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      item.issueNumber.toLowerCase().includes(term) ||
      item.consumableName.toLowerCase().includes(term) ||
      item.department.toLowerCase().includes(term) ||
      item.employeeName.toLowerCase().includes(term) ||
      (item.jobCard || "").toLowerCase().includes(term)
    );
  });

  const stats = {
    issued: issued.filter((item) => item.status === "Issued").length,
    partial: issued.filter((item) => item.status === "Partially Returned")
      .length,
    fully: issued.filter((item) => item.status === "Fully Returned").length,
  };

  function openReturnModal(issueItem) {
    setSelectedIssue(issueItem);
    setReturnForm(initialReturnForm);
  }

  function closeReturnModal() {
    setSelectedIssue(null);
    setReturnForm(initialReturnForm);
  }

  function handleReturnSubmit(e) {
    e.preventDefault();
    if (!selectedIssue) return;

    const qty = Number(returnForm.returnQty);
    if (!qty || qty <= 0 || qty > selectedIssue.balanceQty) return;

    consumableStore.returnConsumable(selectedIssue.id, {
      returnQty: qty,
      remarks: returnForm.remarks,
      returnedBy: selectedIssue.employeeName,
    });

    closeReturnModal();
  } 

  return (
    <>
      <Header />
      <div className="rcn-page">
<div className="rcn-header-section">
  <Link to="/inventory/consumable" className="erp-back-button">
  <ArrowLeft size={16} />
  Back
</Link>

  <div className="rcn-header-card">
    <div className="rcn-header-content">
      <span className="rcn-header-tag">Consumables</span>

      <h1 className="rcn-page-title">
        Return Consumables
      </h1>

      <p className="rcn-page-description">
        Record consumables returned against an issue. Stock is restored
        automatically.
      </p>
    </div>
  </div>
</div>

<div className="rcn-summary-grid">

  <div className="rcn-summary-card">
    <div className="rcn-summary-icon">
      <Undo2 size={20} />
    </div>

    <div className="rcn-summary-details">
      <span className="rcn-summary-value">
        {stats.issued}
      </span>

      <span className="rcn-summary-label">
        Issued
      </span>
    </div>
  </div>

  <div className="rcn-summary-card">
    <div className="rcn-summary-icon">
      <Undo2 size={20} />
    </div>

    <div className="rcn-summary-details">
      <span className="rcn-summary-value">
        {stats.partial}
      </span>

      <span className="rcn-summary-label">
        Partially Returned
      </span>
    </div>
  </div>

  <div className="rcn-summary-card">
    <div className="rcn-summary-icon">
      <Undo2 size={20} />
    </div>

    <div className="rcn-summary-details">
      <span className="rcn-summary-value">
        {stats.fully}
      </span>

      <span className="rcn-summary-label">
        Fully Returned
      </span>
    </div>
  </div>

</div>

<div className="rcn-toolbar-card">

  <div className="rcn-search-box">
    <Search size={16} />

    <input
      type="text"
      placeholder="Search issue number, consumable, department, employee..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  </div>

</div>

 <div className="rcn-table-card">

  <div className="rcn-table-header">
    <div>
      <h2 className="rcn-table-title">
        Issued Consumables
      </h2>

      <p className="rcn-table-subtitle">
        Record consumables returned against an issue.
      </p>
    </div>
  </div>

  <div className="rcn-table-wrapper">

    <table className="rcn-table">

      <thead>

        <tr>
          <th>Issue Number</th>
          <th>Consumable</th>
          <th>Department</th>
          <th>Employee</th>
          <th>Job Card</th>
          <th>Issued Qty</th>
          <th>Returned Qty</th>
          <th>Balance Qty</th>
          <th>Status</th>
          <th>Action</th>
        </tr>

      </thead>

      <tbody>

        {filteredIssued.map((item) => (

          <tr key={item.id}>

            <td>
              <span className="rcn-issue-number">
                {item.issueNumber}
              </span>
            </td>

            <td>
              <div className="rcn-consumable-cell">
                <span className="rcn-consumable-name">
                  {item.consumableName}
                </span>
              </div>
            </td>

            <td>{item.department}</td>

            <td>{item.employeeName}</td>

            <td>{item.jobCard || "-"}</td>

            <td>
              <span className="rcn-qty">
                {item.issuedQty}
              </span>
            </td>

            <td>
              <span className="rcn-qty">
                {item.returnedQty}
              </span>
            </td>

            <td>
              <span className="rcn-balance">
                {item.balanceQty}
              </span>
            </td>

            <td>

              <span
                className={`rcn-status-badge rcn-status-${item.status
                  .replace(/\s+/g, "-")
                  .toLowerCase()}`}
              >
                {item.status}
              </span>

            </td>

            <td>

              <button
                className="rcn-return-btn"
                disabled={item.balanceQty <= 0}
                onClick={() => openReturnModal(item)}
              >
                Return
              </button>

            </td>

          </tr>

        ))}

        {filteredIssued.length === 0 && (

          <tr>

            <td
              colSpan={10}
              className="rcn-empty-row"
            >
              No issued consumables found.
            </td>

          </tr>

        )}

      </tbody>

    </table>

  </div>

</div>

{selectedIssue && (
  <div
    className="rcn-modal-overlay"
    onClick={closeReturnModal}
  >
    <div
      className="rcn-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="rcn-modal-header">

        <div>
          <h3 className="rcn-modal-title">
            Return Consumable
          </h3>

          <h3>Return Consumable</h3>
        </div>

        <button
          className="rcn-modal-close"
          onClick={closeReturnModal}
        >
          <X size={18} />
        </button>

      </div>

      <div className="rcn-modal-body">

        <div className="rcn-info-grid">

          <div className="rcn-info-card">
            <span className="rcn-info-label">
              Consumable
            </span>

            <span className="rcn-info-value">
              {selectedIssue.consumableName}
            </span>
          </div>

          <div className="rcn-info-card">
            <span className="rcn-info-label">
              Issued Quantity
            </span>

            <span className="rcn-info-value">
              {selectedIssue.issuedQty} {selectedIssue.unit}
            </span>
          </div>

          <div className="rcn-info-card">
            <span className="rcn-info-label">
              Already Returned
            </span>

            <span className="rcn-info-value">
              {selectedIssue.returnedQty} {selectedIssue.unit}
            </span>
          </div>

          <div className="rcn-info-card">
            <span className="rcn-info-label">
              Balance
            </span>

            <span className="rcn-info-value">
              {selectedIssue.balanceQty} {selectedIssue.unit}
            </span>
          </div>

        </div>

        <form
          className="rcn-form"
          onSubmit={handleReturnSubmit}
        >

          <div className="rcn-form-grid">

            <label className="rcn-field">

              <span className="rcn-field-label">
                Return Quantity
              </span>

              <input
                type="number"
                min="1"
                max={selectedIssue.balanceQty}
                value={returnForm.returnQty}
                onChange={(e) =>
                  setReturnForm((prev) => ({
                    ...prev,
                    returnQty: e.target.value,
                  }))
                }
                required
              />

            </label>

            <label className="rcn-field rcn-field-full">

              <span className="rcn-field-label">
                Remarks
              </span>

              <textarea
                value={returnForm.remarks}
                onChange={(e) =>
                  setReturnForm((prev) => ({
                    ...prev,
                    remarks: e.target.value,
                  }))
                }
              />

            </label>

          </div>

          <div className="rcn-modal-actions">

            <button
              type="button"
              className="rcn-cancel-btn"
              onClick={closeReturnModal}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="rcn-save-btn"
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