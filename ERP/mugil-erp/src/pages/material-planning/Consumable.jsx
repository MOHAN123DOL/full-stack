import { Link, useNavigate } from "react-router-dom";
import {
  PackagePlus,
  Boxes,
  PackageMinus,
  Undo2,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import "./Consumable.css";
import Header from "../../components/Header";
import InventoryModuleSwitcher from "../../components/InventoryModuleSwitcher";

const consumableActions = [
  {
    code: "GRN",
    title: "GRN (Goods Receipt Note)",
    description: "Receive consumables from suppliers.",
    icon: PackagePlus,
    path: "/inventory/consumable/grn",
  },
  {
    code: "STK",
    title: "Consumable Stock",
    description: "Display current consumable stock levels.",
    icon: Boxes,
    path: "/inventory/consumable/stock",
  },
  {
    code: "ISS",
    title: "Issue Consumables",
    description: "Issue consumables to departments or production.",
    icon: PackageMinus,
    path: "/inventory/consumable/issue",
  },
  {
    code: "RET",
    title: "Return Consumables",
    description: "Return unused consumables back to inventory.",
    icon: Undo2,
    path: "/inventory/consumable/return",
  },
  {
    code: "RPT",
    title: "Reports",
    description: "GRN, stock, issue, and consumption reports.",
    icon: BarChart3,
    path: "/inventory/consumable/reports",
  },
];

export default function Consumable() {
  const navigate = useNavigate();
return (
  <>
    <Header />

    <div className="consumable-page">
      <div className="consumable-layout">

        {/* ================= SIDEBAR ================= */}

        <aside className="consumable-sidebar">

          <div className="consumable-sidebar-brand">

            <div className="consumable-sidebar-brand-icon">
              <PackagePlus size={21} strokeWidth={1.8} />
            </div>

            <div>
              <span className="consumable-sidebar-label">
                Inventory Module
              </span>

              <h2 className="consumable-sidebar-title">
                Consumables
              </h2>
            </div>

          </div>


          <nav className="consumable-sidebar-nav">

            {consumableActions.map((action) => {
              const Icon = action.icon;

              return (
             <div
  key={action.title}
  className={`consumable-sidebar-item ${
    action.code === "STK"
      ? "consumable-sidebar-item-active"
      : ""
  }`}
  onClick={() => navigate(action.path)}
>
                  <span className="consumable-sidebar-item-icon">
                    <Icon size={18} strokeWidth={1.8} />
                  </span>

                  <span className="consumable-sidebar-item-content">

                    <span className="consumable-sidebar-item-code">
                      {action.code}
                    </span>

                    <span className="consumable-sidebar-item-title">
                      {action.title}
                    </span>

                  </span>

                </div>
              );
            })}

          </nav>


          <div className="consumable-sidebar-footer">

            <div className="consumable-sidebar-footer-icon">
              <Boxes size={19} strokeWidth={1.8} />
            </div>

            <div>
              <strong>Consumable Operations</strong>

              <span>
                Inventory workflows in one place.
              </span>
            </div>

          </div>

        </aside>


        {/* ================= MAIN CONTENT ================= */}

        <main className="consumable-main">

  <div className="inventory-top-row">
    <Link to="/inventory" className="consumable-back-link">
      <ArrowLeft size={15} />
      Inventory
    </Link>

    <InventoryModuleSwitcher />
  </div>

  <header className="consumable-header">

    <span className="consumable-eyebrow">
      Consumables
    </span>

    <h1 className="consumable-title">
      Consumable Inventory
    </h1>

    <p className="consumable-subtitle">
      Manage all production consumables.
    </p>

  </header>


          {/* ================= FEATURED STOCK ================= */}

          {consumableActions
            .filter((action) => action.code === "STK")
            .map((action) => {
              const Icon = action.icon;

              return (
                <section
  className="consumable-featured"
  key={action.title}
  onClick={() => navigate(action.path)}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      navigate(action.path);
    }
  }}
>

                  <div className="consumable-featured-header">

                    <div className="consumable-featured-icon">
                      <Icon size={26} strokeWidth={1.8} />
                    </div>

                    <div className="consumable-featured-heading">

                      <span className="consumable-code">
                        {action.code}
                      </span>

                      <h2 className="consumable-featured-title">
                        {action.title}
                      </h2>

                      <p className="consumable-featured-desc">
                        {action.description}
                      </p>

                    </div>

                  </div>

                </section>
              );
            })}


          {/* ================= ACTION CARDS ================= */}

          <div className="consumable-grid">

            {consumableActions
              .filter((action) => action.code !== "STK")
              .map((action) => {
                const Icon = action.icon;

                return (
               <div
  className="consumable-card"
  key={action.title}
  onClick={() => navigate(action.path)}
>

                    <div className="consumable-card-top">

                      <div className="consumable-icon">
                        <Icon size={22} strokeWidth={1.8} />
                      </div>

                      <span className="consumable-code">
                        {action.code}
                      </span>

                    </div>

                    <h3 className="consumable-card-title">
                      {action.title}
                    </h3>

                    <p className="consumable-card-desc">
                      {action.description}
                    </p>

                  </div>
                );
              })}

          </div>

        </main>

      </div>
    </div>
  </>
);
}