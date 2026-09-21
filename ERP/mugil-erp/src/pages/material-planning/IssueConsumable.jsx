import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Send, Boxes, X } from "lucide-react";
import Header from "../../components/Header";
import consumableStore from "../../data/consumableStore";
import "./IssueConsumable.css";

// import { useEffect, useMemo, useState } from "react";
// import { Link } from "react-router-dom";
// import { ArrowLeft, Search, Send, Boxes, X } from "lucide-react";
// import Header from "../../components/Header";
// import consumableStore from "../../store/consumableStore";

const initialIssueForm = {
  department: "",
  employeeName: "",
  jobCard: "",
  quantity: "",
  remarks: "",
};

export default function IssueConsumable() {
  const [stock, setStock] = useState(consumableStore.getConsumableStock());
  const [search, setSearch] = useState("");

  const [selectedStock, setSelectedStock] = useState(null);
  const [issueForm, setIssueForm] = useState(initialIssueForm);

  useEffect(() => {
    const unsubscribe = consumableStore.subscribe(() => {
      setStock([...consumableStore.getConsumableStock()]);
    });
    return unsubscribe;
  }, []);

  // Only consumables that currently have stock on hand can be issued.
  const availableStock = useMemo(
    () => stock.filter((item) => item.availableQty > 0),
    [stock],
  );

  const filteredStock = availableStock.filter((item) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      item.consumableName.toLowerCase().includes(term) ||
      item.referenceNumber.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term) ||
      item.warehouse.toLowerCase().includes(term)
    );
  });

  const totalAvailableItems = availableStock.length;
  const totalAvailableQty = availableStock.reduce(
    (sum, item) => sum + item.availableQty,
    0,
  );

  function openIssueModal(stockItem) {
    setSelectedStock(stockItem);
    setIssueForm(initialIssueForm);
  }

  function closeIssueModal() {
    setSelectedStock(null);
    setIssueForm(initialIssueForm);
  }

  function handleIssueChange(field, value) {
    setIssueForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleIssueSubmit(e) {
    e.preventDefault();
    if (!selectedStock) return;

    const { department, employeeName, jobCard, quantity, remarks } = issueForm;
    if (!department || !employeeName || !quantity) return;

    const qty = Number(quantity);
    if (qty <= 0 || qty > selectedStock.availableQty) return;

    consumableStore.issueConsumable(selectedStock.id, {
      department,
      employeeName,
      jobCard,
      quantity: qty,
      remarks,
    });

    closeIssueModal();
  }

return (
  <>
    <Header />

    <div className="issue-consumable-page">
      <div className="issue-consumable-container">
       <Link to="/inventory/consumable" className="erp-back-button">
  <ArrowLeft size={16} />
  Back
</Link>

        <section className="issue-consumable-hero">
          <div className="issue-consumable-hero-content">
            <span className="issue-consumable-eyebrow">
              Consumables
            </span>

            <h1 className="issue-consumable-title">
              Issue Consumables
            </h1>

            <p className="issue-consumable-description">
              Issue available consumable stock to a department, employee, or job
              card / production order.
            </p>
          </div>
        </section>

        <section className="issue-consumable-summary-grid">
          <div className="issue-consumable-summary-card">
            <div className="issue-consumable-summary-icon">
              <Boxes size={20} />
            </div>

            <div className="issue-consumable-summary-content">
              <span className="issue-consumable-summary-value">
                {totalAvailableItems}
              </span>
              <span className="issue-consumable-summary-label">
                Consumables Available
              </span>
            </div>
          </div>

          <div className="issue-consumable-summary-card">
            <div className="issue-consumable-summary-icon">
              <Send size={20} />
            </div>

            <div className="issue-consumable-summary-content">
              <span className="issue-consumable-summary-value">
                {totalAvailableQty}
              </span>
              <span className="issue-consumable-summary-label">
                Total Available Quantity
              </span>
            </div>
          </div>
        </section>

        <section className="issue-consumable-toolbar">
          <div className="issue-consumable-search-box">
            <Search size={16} />

            <input
              type="text"
              placeholder="Search consumable, reference, category, warehouse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </section>

        <section className="issue-consumable-table-card">
          <div className="issue-consumable-table-scroll">
            <table className="issue-consumable-table">
              <thead>
                <tr>
                  <th>Reference Number</th>
                  <th>Consumable</th>
                  <th>Category</th>
                  <th>Warehouse</th>
                  <th>Available Quantity</th>
                  <th>Unit</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredStock.map((item) => (
                  <tr key={item.id}>
                    <td>{item.referenceNumber}</td>

                    <td>
                      <div className="issue-consumable-name-cell">
                        <span className="issue-consumable-name">
                          {item.consumableName}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="issue-consumable-category-badge">
                        {item.category}
                      </span>
                    </td>

                    <td>{item.warehouse}</td>

                    <td>
                      <span className="issue-consumable-stock-value">
                        {item.availableQty}
                      </span>
                    </td>

                    <td>{item.unit}</td>

                    <td>
                      <button
                        className="issue-consumable-issue-button"
                        onClick={() => openIssueModal(item)}
                      >
                        Issue
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredStock.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="issue-consumable-empty-state"
                    >
                      No available consumable stock to issue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        {selectedStock && (
          <div
            className="issue-consumable-modal-overlay"
            onClick={closeIssueModal}
          >
            <div
              className="issue-consumable-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="issue-consumable-modal-header">
                <div>
                  <h3 className="issue-consumable-modal-title">
                    Issue Consumable
                  </h3>
                </div>

                <button
                  className="issue-consumable-modal-close"
                  onClick={closeIssueModal}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="issue-consumable-modal-body">
                <div className="issue-consumable-info-panel">
                  <div className="issue-consumable-info-item">
                    <span className="issue-consumable-info-label">
                      Consumable
                    </span>

                    <span className="issue-consumable-info-value">
                      {selectedStock.consumableName}
                    </span>
                  </div>

                  <div className="issue-consumable-info-item">
                    <span className="issue-consumable-info-label">
                      Available Quantity
                    </span>

                    <span className="issue-consumable-info-value">
                      {selectedStock.availableQty} {selectedStock.unit}
                    </span>
                  </div>

                  <div className="issue-consumable-info-item">
                    <span className="issue-consumable-info-label">
                      Warehouse
                    </span>

                    <span className="issue-consumable-info-value">
                      {selectedStock.warehouse}
                    </span>
                  </div>
                </div>

                <form
                  className="issue-consumable-form"
                  onSubmit={handleIssueSubmit}
                >
                  <div className="issue-consumable-form-grid">
                    <label className="issue-consumable-field">
                      <span>Department</span>

                      <input
                        type="text"
                        value={issueForm.department}
                        onChange={(e) =>
                          handleIssueChange("department", e.target.value)
                        }
                        required
                      />
                    </label>

                    <label className="issue-consumable-field">
                      <span>Employee Name</span>

                      <input
                        type="text"
                        value={issueForm.employeeName}
                        onChange={(e) =>
                          handleIssueChange("employeeName", e.target.value)
                        }
                        required
                      />
                    </label>

                    <label className="issue-consumable-field">
                      <span>Job Card / Production Order</span>

                      <input
                        type="text"
                        value={issueForm.jobCard}
                        onChange={(e) =>
                          handleIssueChange("jobCard", e.target.value)
                        }
                      />
                    </label>

                    <label className="issue-consumable-field">
                      <span>Quantity</span>

                      <input
                        type="number"
                        min="1"
                        max={selectedStock.availableQty}
                        value={issueForm.quantity}
                        onChange={(e) =>
                          handleIssueChange("quantity", e.target.value)
                        }
                        required
                      />
                    </label>

                    <label className="issue-consumable-field issue-consumable-field-full">
                      <span>Remarks</span>

                      <textarea
                        value={issueForm.remarks}
                        onChange={(e) =>
                          handleIssueChange("remarks", e.target.value)
                        }
                      />
                    </label>
                  </div>

                  <div className="issue-consumable-modal-actions">
                    <button
                      type="button"
                      className="issue-consumable-cancel-button"
                      onClick={closeIssueModal}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="issue-consumable-save-button"
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
    </div>
  </>
);
}