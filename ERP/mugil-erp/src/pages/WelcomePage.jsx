import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/welcome.css";

const Icon = ({ d, size = 18, viewBox = "0 0 24 24" }) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

const BriefcaseIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
  </svg>
);

const LogoutIcon = () => (
  <Icon
    d={
      <>
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </>
    }
    size={14}
  />
);

const GridIcon = () => (
  <Icon
    d={
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </>
    }
    size={16}
  />
);

const DollarIcon = () => (
  <Icon d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" size={16} />
);

const UsersIcon = () => (
  <Icon
    d={
      <>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </>
    }
    size={16}
  />
);

const ChecklistIcon = () => (
  <Icon
    d={
      <>
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </>
    }
    size={18}
  />
);

export default function WelcomePage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/production/login");
  };

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : "AD";

  return (
    <div className="welcome-root">
      <nav className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo-mark">
            <BriefcaseIcon />
          </div>
          <span className="topbar-brand">
            Mugil Industries
            <span>ERP Platform</span>
          </span>
        </div>
        <div className="topbar-right">
          <div className="topbar-user">
            <div className="user-avatar">{initials}</div>
            <span className="user-name">
              {user?.username || "Administrator"}
            </span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <LogoutIcon />
            Sign out
          </button>
        </div>
      </nav>

      <main className="welcome-content">
        <section className="welcome-hero">
          <p className="hero-eyebrow">ERP Dashboard</p>
          <h1 className="hero-heading">Welcome to Mugil Industries ERP</h1>
          <p className="hero-body">
            We are happy to work with you. Please share your business
            requirements, workflows, and operational needs so we can build a
            customized ERP solution for Mugil Industries.
          </p>
          <div className="hero-cta-row">
            <div className="tooltip-wrapper">
              <button className="btn-primary">Share Requirements</button>
              <div className="contact-tooltip">
                Whatsapp @ Yadhav <br />
                📞 +91 6381307202
              </div>
            </div>

            <div className="tooltip-wrapper">
              <button className="btn-outline">Schedule a Demo</button>
              <div className="contact-tooltip">
                Contact Yadhav <br />
                📞 +91 6381307202
              </div>
            </div>
          </div>
        </section>

        <div className="stats-strip">
          <div className="stat-card">
            <div className="stat-icon amber">
              <GridIcon />
            </div>
            <div className="stat-value">12+</div>
            <div className="stat-label">ERP Modules</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon navy">
              <UsersIcon />
            </div>
            <div className="stat-value">500+</div>
            <div className="stat-label">Users Supported</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">
              <ChecklistIcon />
            </div>
            <div className="stat-value">99.9%</div>
            <div className="stat-label">Uptime SLA</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue">
              <DollarIcon />
            </div>
            <div className="stat-value">30%</div>
            <div className="stat-label">Avg. Cost Reduction</div>
          </div>
        </div>

        <div className="info-grid">
          <div className="info-card">
            <div className="info-card-header">
              <div className="info-card-icon">
                <GridIcon />
              </div>
              <span className="info-card-title">Available ERP Modules</span>
            </div>
            <ul className="module-list">
              {[
                ["Inventory & Warehouse", "Core"],
                ["Procurement & Purchasing", "Core"],
                ["Finance & Accounting", "Core"],
                ["Sales & CRM", "Add-on"],
                ["HR & Payroll", "Add-on"],
                ["Manufacturing & MRP", "Add-on"],
              ].map(([label, badge]) => (
                <li className="module-item" key={label}>
                  {label}
                  <span
                    className={`module-badge ${
                      badge === "Core" ? "badge-navy" : "badge-amber"
                    }`}
                  >
                    {badge}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="info-card">
            <div className="info-card-header">
              <div className="info-card-icon">
                <ChecklistIcon />
              </div>
              <span className="info-card-title">Implementation Roadmap</span>
            </div>
            <ul className="step-list">
              {[
                [
                  "Discovery & Requirements",
                  "Share workflows and operational data with our team.",
                ],
                [
                  "Solution Design",
                  "We map your processes to ERP modules and customise.",
                ],
                [
                  "Development & Configuration",
                  "Build, test, and iterate with your stakeholders.",
                ],
                [
                  "Training & Go-Live",
                  "User training, data migration, and production launch.",
                ],
                [
                  "Support & Optimisation",
                  "Ongoing SLA support and continuous improvements.",
                ],
              ].map(([title, description], index) => (
                <li className="step-item" key={title}>
                  <span className="step-num">{index + 1}</span>
                  <div className="step-text">
                    <strong>{title}</strong>
                    <span>{description}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      <footer className="statusbar">
        <div className="statusbar-left">
          <span className="status-pill">
            <span className="status-dot" />
            All systems operational
          </span>
          <span className="status-pill">v2.4.1</span>
        </div>
        <div className="statusbar-right">
          © {new Date().getFullYear()} Mugil Industries · Confidential
        </div>
      </footer>
    </div>
  );
}
