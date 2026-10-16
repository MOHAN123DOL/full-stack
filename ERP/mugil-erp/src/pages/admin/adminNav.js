import {
  BarChart3,
  LayoutDashboard,
  CalendarCheck,
  PackageCheck,
  IndianRupee,
  FolderKanban,
  FileText,
  Boxes,
} from "lucide-react";

/* ==========================================================================
   ADMIN NAVIGATION — single source of truth
   --------------------------------------------------------------------------
   Drives BOTH the sidebar and the page header/breadcrumb, so a module's
   label, URL and title are defined exactly once.

   - `label`       : short text shown in the sidebar
   - `title`       : full page title shown in the page header
   - `description` : short description for the page
   - `path`        : route (relative to /admin)
   - `icon`        : Lucide icon used in the sidebar
   ========================================================================== */

export const ADMIN_BASE_PATH = "/admin";

export const ADMIN_NAV = [
  {
    key: "statistics",
    label: "Statistics",
    title: "Admin Statistics",
    description: "Administrative statistics and performance overview",
    path: "statistics",
    icon: BarChart3,
  },
  {
    key: "dashboard",
    label: "Dashboard",
    title: "Admin Dashboard",
    description: "Administration overview",
    path: "dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "attendance",
    label: "Attendance",
    title: "Attendance",
    description: "Who is present and who is on leave today",
    path: "attendance",
    icon: CalendarCheck,
  },
  {
    key: "po-pending-grn",
    label: "PO with Pending GRN",
    title: "PO with Pending GRN",
    description: "Purchase orders not yet fully received",
    path: "po-pending-grn",
    icon: PackageCheck,
  },
  {
    key: "pending-customer-payment",
    label: "Pending Customer Payment",
    title: "Pending Payment from Customer",
    description: "Customer invoices with payment outstanding",
    path: "pending-customer-payment",
    icon: IndianRupee,
  },
  {
    key: "project-status",
    label: "Project Status",
    title: "Project Status",
    description: "Project status and progress",
    path: "project-status",
    icon: FolderKanban,
  },
  {
    key: "document-number",
    label: "Document Number",
    title: "Document Number & Document Saving File Name",
    description: "Document numbers and saving file names",
    path: "document-number",
    icon: FileText,
  },
  {
    key: "buffer-stock",
    label: "Buffer Stock",
    title: "Buffer Stock List",
    description: "Buffer stock levels",
    path: "buffer-stock",
    icon: Boxes,
  },
];

export const ADMIN_HOME_PATH = `${ADMIN_BASE_PATH}/${ADMIN_NAV[0].path}`;

export function adminHref(item) {
  return `${ADMIN_BASE_PATH}/${item.path}`;
}

/** Resolve the nav item for the current pathname (used by the page header). */
export function findAdminNavItem(pathname) {
  return (
    ADMIN_NAV.find((item) => pathname.startsWith(adminHref(item))) ||
    ADMIN_NAV[0]
  );
}