import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../../components/Header";
import "./AccountsReport.css";

const REPORT_STORAGE_KEY = "accountsReportTempRecords";

const TEMP_RECORDS = [
  {
    id: 1,
    type: "Purchase Order",
    short: "PO",
    documentNumber: "PO1001",
    paymentStatus: "Pending",
    deliveryStatus: "Pending",
    path: "/accounts/po",

    documentData: {
      poNumber: "PO1001",
      poDate: "2026-09-01",
      refQuoteNumber: "QO1001",
      refDate: "2026-08-28",
      subject: "Purchase Order for Steel Materials",
      preparedBy: "Admin",

      vendor: {
        companyName: "ABC Engineering Pvt Ltd",
        contactPerson: "Raj Kumar",
        gst: "33ABCDE1234F1Z5",
        address1: "25 Industrial Estate",
        address2: "Guindy",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600032",
        phone: "9876543210",
        email: "abc@example.com",
      },

      introText:
        "With reference to your quotation, we are pleased to place the purchase order as per the below-mentioned details.",

      items: [
        {
          id: "temp-po-item-1",
          sku: "ST-001",
          itemCode: "MSP-001",
          description: "MS Steel Plate",
          specification: "IS 2062 Grade A",
          length: "2000",
          width: "1000",
          thickness: "10",
          qty: "10",
          unit: "No",
          unitPrice: "5000",
          amount: "50000",
          discount: "0",
          gstPercent: "18",
        },
      ],

      interState: false,

      delivery: {
        address: "25 Industrial Estate, Guindy, Chennai, Tamil Nadu - 600032",
        date: "2026-09-15",
        mode: "By Road",
        expectedDelivery: "2 weeks",
      },

      payment: {
        terms: "50% advance, 50% before dispatch",
        advancePercent: "50",
        creditDays: "0",
        bankDetails: "ABC Bank, Chennai",
      },

      terms: [
        "Prices are inclusive of packing & forwarding unless stated otherwise.",
        "GST shall be charged extra as applicable.",
        "Any deviation from the above specification shall be subject to mutual discussion and approval.",
      ],

      notes: "Temporary test Purchase Order.",

      signatures: {
        preparedBy: "Admin",
        checkedBy: "Manager",
        approvedBy: "Director",
      },
    },
  },

  {
    id: 2,
    type: "Quotation",
    short: "QO",
    documentNumber: "QO1001",
    paymentStatus: "Pending",
    deliveryStatus: "Pending",
    path: "/accounts/qo",

    documentData: {
      quotationNumber: "QO1001",
    },
  },

  {
    id: 3,
    type: "Tax Invoice",
    short: "TI",
    documentNumber: "TI1001",
    paymentStatus: "Paid",
    deliveryStatus: "Delivered",
    path: "/accounts/TaxInvoice",

    documentData: {
      invoiceNumber: "TI1001",
    },
  },

  {
    id: 4,
    type: "Delivery Challan",
    short: "DC",
    documentNumber: "DC1001",
    paymentStatus: "N/A",
    deliveryStatus: "Delivered",
    path: "/accounts/DeliveryChallan",

    documentData: {
      dcNumber: "DC1001",
    },
  },

  {
    id: 5,
    type: "Proforma Invoice",
    short: "PI",
    documentNumber: "PI1001",
    paymentStatus: "Pending",
    deliveryStatus: "Pending",
    path: "/accounts/ProformaInvoice",

    documentData: {
      proformaNo: "PI1001",
    },
  },
];

export default function AccountsReport() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);

useEffect(() => {
  localStorage.setItem(
    REPORT_STORAGE_KEY,
    JSON.stringify(TEMP_RECORDS)
  );

  setRecords(TEMP_RECORDS);
}, []);

  const handleView = (record) => {
    navigate(record.path, {
      state: {
        documentNumber: record.documentNumber,
        reportRecord: record,
      },
    });
  };

  const loadPurchaseOrderPrintEngine = () => {
  if (typeof window.generatePurchaseOrderPrint === "function") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-purchase-order-print-engine="true"]'
    );

    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("PurchaseOrderPrint.js failed to load")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");

    script.src = "/PurchaseOrderPrint.js";
    script.async = true;
    script.dataset.purchaseOrderPrintEngine = "true";

    script.onload = resolve;

    script.onerror = () => {
      reject(new Error("PurchaseOrderPrint.js failed to load"));
    };

    document.head.appendChild(script);
  });
};

const handlePrint = async (record) => {
  if (record.type !== "Purchase Order") {
    alert("Print is currently available for the Purchase Order example.");
    return;
  }

  try {
    await loadPurchaseOrderPrintEngine();

    if (typeof window.generatePurchaseOrderPrint !== "function") {
      alert("Purchase Order print system is not available.");
      return;
    }

    const data = {
      ...record.documentData,
      includeAmountDetails: true,
    };

    const subtotal = data.items.reduce((sum, item) => {
      return sum + (Number(item.amount) || 0);
    }, 0);

    const gstPercent = Number(data.gstPercent) || 0;
    const gstAmount = (subtotal * gstPercent) / 100;
    const grandTotal = subtotal + gstAmount;

    const summary = {
      subtotal,
      totalGst: gstAmount,
      grandTotal,
      gstPercent,
      interState: data.interState,
    };

    window.generatePurchaseOrderPrint(
      data,
      summary,
      record.columns || []
    );
  } catch (error) {
    console.error("Purchase Order print failed:", error);
    alert("Unable to open Purchase Order print preview.");
  }
};
  return (
    <>
      <Header />

      <main className="accounts-report-page">
  <div className="accounts-report-container">

    <div className="accounts-report-top">
      <Link to="/accounts" className="erp-back-button">
        <ArrowLeft size={16} />
        Back
      </Link>
    </div>

    {/* Page heading */}
    <div className="accounts-report-heading">
            <h1>Reports</h1>
            <p>View and manage all accounting documents</p>
          </div>

          <div className="accounts-report-filter">
  <label htmlFor="document-type-filter">Document Type</label>

  <select
    id="document-type-filter"
    className="accounts-report-filter-select"
  >
    <option value="all">ALL</option>
    <option value="PO">PO</option>
    <option value="QO">QO</option>
    <option value="TI">TI</option>
    <option value="DC">DC</option>
    <option value="PI">PI</option>
  </select>
</div>

{/* Report table */}
<div className="accounts-report-table-wrapper">
            <table className="accounts-report-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Document Number</th>
                  <th>Payment Status</th>
                  <th>Delivery Status</th>
                  <th>View</th>
                  <th>Print</th>
                </tr>
              </thead>

              <tbody>
                {records.length > 0 ? (
                  records.map((record, index) => (
                    <tr key={record.id}>
                      <td>{index + 1}</td>

                      <td>
                        <div className="report-document-info">
                          <span className="report-document-short">
                            {record.short}
                          </span>

                          <span className="report-document-number">
                            {record.documentNumber}
                          </span>
                        </div>
                      </td>

                      <td>
<select
  className={`report-status-select payment-status-${record.paymentStatus
    .toLowerCase()
    .replace("/", "")}`}
  defaultValue={record.paymentStatus}
>
  <option value="Paid">Paid</option>
  <option value="Pending">Pending</option>
  <option value="N/A">N/A</option>
</select>
</td>

                      <td>
<select
  className={`report-status-select delivery-status-${record.deliveryStatus
    .toLowerCase()
    .replace("/", "")}`}
  defaultValue={record.deliveryStatus}
>
  <option value="Delivered">Delivered</option>
  <option value="Pending">Pending</option>
  <option value="N/A">N/A</option>
</select>
</td>

                      <td>
                        <button
                          type="button"
                          className="report-action-button report-view-button"
                          onClick={() => handleView(record)}
                        >
                          View
                        </button>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="report-action-button report-print-button"
                          onClick={() => handlePrint(record)}
                        >
                          Print
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="report-empty">
                      No documents found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </main>
    </>
  );
}