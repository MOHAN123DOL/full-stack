import { useNavigate } from "react-router-dom";
import {
  Ruler,
  ClipboardList,
  ArrowRight,
  Factory,
  Truck,
  Boxes,
  BriefcaseBusiness,
  Settings,
  Combine,
  Wrench,
  Send,
  Recycle,
  BarChart3,
  Package,
  ArrowLeft,
} from "lucide-react";
import "./MenuCard.css";
import Header from "../../components/Header";

// ============================================================
// MENU CARDS DATA
// ============================================================
const menuCards = [
  {
    code: "DB",
    title: "DWG & BOM",
    description: "Manage projects, drawings and bill of materials.",
    icon: Ruler,
    path: "/inventory/material/dwg-bom",
  },
  {
    code: "PO",
    title: "PO Integration",
    description: "Integrate project BOM materials with purchase order descriptions.",
    icon: ClipboardList,
    path: "/inventory/material/po-integration",
  },
  {
    code: "GRN",
    title: "GRN / Receive Material",
    description: "Receive and track materials against actual and dummy purchase orders.",
    icon: Truck,
    path: "/inventory/material/grn",
  },
  {
    code: "STK",
    title: "Material Stock",
    description: "Track available material by unit, source and specification.",
    icon: Boxes,
    path: "/inventory/material/material-stock",
  },
  {
    code: "IJW",
    title: "Issue to Job Work",
    description: "Issue available material for in-house or outsourced job work processes.",
    icon: BriefcaseBusiness,
    path: "/inventory/material/issue-to-jobwork",
  },
  {
    code: "RJW",
    title: "Receive from Job Work",
    description: "Receive completed job work, record output pieces and manage remaining material.",
    icon: BriefcaseBusiness,
    path: "/inventory/material/receive-from-jobwork",
  },
  {
    code: "IPR",
    title: "Issue to Production",
    description: "Issue available material from stock to production for manufacturing.",
    icon: Factory,
    path: "/inventory/material/issue-to-production",
  },
  {
    code: "PAI",
    title: "Production Assembly Integration",
    description: "Combine production materials and prior assemblies into a planned assembly.",
    icon: Combine,
    path: "/inventory/material/production-assembly-integration",
  },
  {
    code: "OPR",
    title: "Production Operation",
    description: "Manage and track production operations, workflows, and manufacturing processes.",
    icon: Settings,
    path: "/inventory/material/production-operation",
  },
  {
    code: "RWK",
    title: "Rework",
    description: "Track QC-rejected quantities through rework until they are cleared and released.",
    icon: Wrench,
    path: "/inventory/material/rework",
  },
  {
    code: "SCR",
    title: "Scrap",
    description: "Create and track scrap directly from a Purchase Order.",
    icon: Recycle,
    path: "/inventory/material/scrap",
  },
  {
    code: "DSP",
    title: "Dispatch",
    description: "Prepare and record outgoing dispatch of finished and processed material.",
    icon: Send,
    path: "/inventory/material/dispatch",
  },
  {
    code: "RPT",
    title: "Reports",
    description: "Read-only reports covering the full material journey.",
    icon: BarChart3,
    path: "/inventory/material/reports",
  },
];

// ============================================================
// MAIN MENU COMPONENT
// ============================================================
export default function MenuCard() {
  const navigate = useNavigate();

  // Featured card (first one - DWG & BOM)
  const featuredCard = menuCards[0];
  const otherCards = menuCards.slice(1);

  return (
    <>
      <Header />

      <div className="consumable-page material-page">
        <div className="consumable-layout">

          {/* ================= SIDEBAR ================= */}
          <aside className="consumable-sidebar">

            <div className="consumable-sidebar-brand">
              <div className="consumable-sidebar-brand-icon">
                <Package size={21} strokeWidth={1.8} />
              </div>
              <div>
                <span className="consumable-sidebar-label">
                  Inventory Module
                </span>
                <h2 className="consumable-sidebar-title">
                  Materials
                </h2>
              </div>
            </div>

            <nav className="consumable-sidebar-nav">
              {menuCards.map((card) => {
                const Icon = card.icon;
                const isActive = card.code === "STK";

                return (
                  <div
                    key={card.title}
                    className={`consumable-sidebar-item ${
                      isActive ? "consumable-sidebar-item-active" : ""
                    }`}
                    onClick={() => navigate(card.path)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        navigate(card.path);
                      }
                    }}
                  >
                    <span className="consumable-sidebar-item-icon">
                      <Icon size={18} strokeWidth={1.8} />
                    </span>

                    <span className="consumable-sidebar-item-content">
                      <span className="consumable-sidebar-item-code">
                        {card.code}
                      </span>
                      <span className="consumable-sidebar-item-title">
                        {card.title}
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
                <strong>Material Operations</strong>
                <span>Inventory workflows in one place.</span>
              </div>
            </div>

          </aside>

          {/* ================= MAIN CONTENT ================= */}
          <main className="consumable-main">

            <header className="consumable-header">
              <div className="consumable-back-link" onClick={() => navigate("/inventory")}>
                <ArrowLeft size={15} />
                Inventory
              </div>

              <span className="consumable-eyebrow">
                Materials
              </span>

              <h1 className="consumable-title">
                Material Management
              </h1>

              <p className="consumable-subtitle">
                Track material from project drawings through BOM, purchase orders, receiving, stock and job work.
              </p>
            </header>

            {/* ================= FEATURED CARD ================= */}
            <section
              className="consumable-featured"
              onClick={() => navigate(featuredCard.path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  navigate(featuredCard.path);
                }
              }}
            >
              <div className="consumable-featured-header">
                <div className="consumable-featured-icon">
                  <featuredCard.icon size={26} strokeWidth={1.8} />
                </div>

                <div className="consumable-featured-heading">
                  <span className="consumable-code">
                    {featuredCard.code}
                  </span>
                  <h2 className="consumable-featured-title">
                    {featuredCard.title}
                  </h2>
                  <p className="consumable-featured-desc">
                    {featuredCard.description}
                  </p>
                </div>
              </div>
            </section>

            {/* ================= ACTION CARDS ================= */}
            <div className="consumable-grid">
              {otherCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div
                    className="consumable-card"
                    key={card.title}
                    onClick={() => navigate(card.path)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        navigate(card.path);
                      }
                    }}
                  >
                    <div className="consumable-card-top">
                      <div className="consumable-icon">
                        <Icon size={22} strokeWidth={1.8} />
                      </div>
                      <span className="consumable-code">
                        {card.code}
                      </span>
                    </div>

                    <h3 className="consumable-card-title">
                      {card.title}
                    </h3>

                    <p className="consumable-card-desc">
                      {card.description}
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