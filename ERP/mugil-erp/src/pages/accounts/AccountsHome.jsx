import { useNavigate } from "react-router-dom";
import Header from "../../components/Header";
import "./AccountsHome.css";

export default function AccountsHome() {
  const navigate = useNavigate();

  const menus = [
    {
      title: "Purchase Order",
      short: "PO",
      description: "Create and manage Purchase Orders.",
      path: "/accounts/PO",
      color: "#0f766e",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="20" r="1.3" fill="currentColor" />
          <circle cx="18" cy="20" r="1.3" fill="currentColor" />
        </svg>
      ),
    },
    {
      title: "Quotation",
      short: "QO",
      description: "Create and manage Quotations.",
      path: "/accounts/QO",
      color: "#1d4ed8",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 3h9l4 4v14H6z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M15 3v5h4M9 12h6M9 15h6M9 18h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      title: "Tax Invoice",
      short: "TI",
      description: "Create and manage Tax Invoices.",
      path: "/accounts/TaxInvoice",
      color: "#b45309",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 3h9l4 4v14H6z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M15 3v5h4M9 12h6M9 15h4M9 18h5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      title: "Delivery Challan",
      short: "DC",
      description: "Create and manage Delivery Challans.",
      path: "/accounts/DeliveryChallan",
      color: "#7c3aed",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="7" cy="19" r="1.5" fill="currentColor" />
          <circle cx="18" cy="19" r="1.5" fill="currentColor" />
        </svg>
      ),
    },
    {
      title: "Proforma Invoice",
      short: "PI",
      description: "Create and manage Proforma Invoices.",
      path: "/accounts/ProformaInvoice",
      color: "#dc2626",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 3h9l4 4v14H6z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M15 3v5h4M9 12h6M9 15h6M9 18h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ),
    },

    {
  title: "Report",
  short: "RP",
  description: "View and manage all accounting reports.",
  path: "/accounts/Report",
  color: "#374151",
  icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 4h16v16H4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 16v-4M12 16V8M16 16v-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
},

{
  title: "Journal",
  short: "JR",
  description: "Record and manage financial transactions.",
  path: "/accounts/ExpenseProfit",
  color: "#475569",
  icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 19V5M4 19h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 15l4-4 3 2 5-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
},
  ];

  const handleOpen = (path) => {
    navigate(path);
  };

  const handleKeyDown = (e, path) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate(path);
    }
  };

  return (
    <>
      <Header />

      <main className="accounts-page">
        <div className="accounts-container">

          {/* Page heading */}
          <div className="accounts-heading">
            <h1>Accounts Module</h1>
            <p>Manage your accounting documents and transactions</p>
          </div>

          {/* Large module tiles */}
          <div className="accounts-grid">
            {menus.map((item) => (
              <div
                key={item.title}
                className="accounts-card"
                style={{ backgroundColor: item.color }}
                onClick={() => handleOpen(item.path)}
                onKeyDown={(e) => handleKeyDown(e, item.path)}
                role="button"
                tabIndex={0}
              >
                <div className="accounts-card-icon">
                  {item.icon}
                </div>

                <div className="accounts-card-short">
                  {item.short}
                </div>

                <h2>{item.title}</h2>

                <div className="card-divider" />

                <div className="card-open">
                  <span>Open</span>
                  <span className="card-arrow">→</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>
    </>
  );
}