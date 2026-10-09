import { Navigate, Route, Routes, Outlet } from "react-router-dom";
import CustomCursor from "./components/CustomCursor.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import AccountsLoginPage from "./pages/accounts/LoginPage.jsx";
import AdminLoginPage from "./pages/admin/LoginPage.jsx";
import HrLoginPage from "./pages/hr/LoginPage.jsx";
import MaterialPlanningLoginPage from "./pages/material-planning/LoginPage.jsx";
import ProductionLoginPage from "./pages/production/LoginPage.jsx";
import SupervisorLoginPage from "./pages/supervisor/LoginPage.jsx";
import WelcomePage from "./pages/WelcomePage.jsx";
import Inventory from "./pages/material-planning/Inventory.jsx";
import Consumable from "./pages/material-planning/Consumable.jsx";
import { PayrollProvider } from "./pages/hr/Payroll.jsx";
import ConsumableGRN from "./pages/material-planning/ConsumableGRN";
import ConsumableStock from "./pages/material-planning/ConsumableStock";
import IssueConsumable from "./pages/material-planning/IssueConsumable";
import ReturnConsumable from "./pages/material-planning/ReturnConsumable";
import ConsumableReports from "./pages/material-planning/ConsumableReports";
import PO from "./pages/accounts/PurchaseOrderForm";
import QO from "./pages/accounts/QuotationForm";
import AccountsHome from "./pages/accounts/AccountsHome";
import TaxInvoice from "./pages/accounts/Taxinvoiceform";
import DeliveryChallan from "./pages/accounts/Deliverychallanform";
import ProformaInvoiceForm from "./pages/accounts/Proformainvoiceform";
import Employees, { EmployeesProvider } from "./pages/hr/Employees.jsx";
import Profile from "./components/Profile.jsx";
import Salary from "./pages/hr/Salary.jsx";
import Attendance from "./pages/hr/Attendancewages.jsx";
import { AttendanceProvider } from "./pages/hr/Attendancewages.jsx";

import AccountsReport from "./pages/accounts/AccountsReport.jsx";
import EmployeeProfile from "./pages/hr/EmployeeProfile.jsx";
import ExpenseProfit from "./pages/accounts/ExpenseProfit.jsx";
import MenuCard from "./pages/material-planning/MenuCard.jsx";
import DwgBom from "./pages/material-planning/DwgBom.jsx";
import POIntegration from "./pages/material-planning/POIntegration.jsx";
import ReceiveGRN from "./pages/material-planning/ReceiveGRN.jsx";
import MaterialStock from "./pages/material-planning/Materialstock.jsx";
import IssueToJobWork from "./pages/material-planning/IssueToJobWork";
import ReceiveFromJobWork from "./pages/material-planning/ReceiveFromJobWork";
import IssueToProduction from "./pages/material-planning/IssueToProduction.jsx";
import ProductionOperation from "./pages/material-planning/ProductionOperation.jsx";
import ProductionAssemblyIntegration from "./pages/material-planning/ProductionAssemblyIntegration.jsx";
import Rework from "./pages/material-planning/Rework.jsx";
import Dispatch from "./pages/material-planning/Dispatch.jsx";
import Reports from "./pages/material-planning/Reports";
import Scrap from "./pages/material-planning/Scrap";
import Contact from "./components/ContactUs.jsx";
import HelpCenter from "./components/HelpCenter.jsx";

/* =====================================================================
   HR LAYOUT
   ---------------------------------------------------------------------
   Wraps every HR route in the three providers that only HR pages need:
      EmployeesProvider  → GET /erp/employees/  (HR-only endpoint)
      AttendanceProvider → attendance state
      PayrollProvider    → payroll state

   Because these are mounted ONLY when a /hr/* route matches, non-HR
   users (accounts, material-planning, production, …) never trigger the
   /erp/employees/ request. That eliminates the 403 spam in the console
   and saves bandwidth on every non-HR page load.
   ===================================================================== */
function HrLayout() {
  return (
    <EmployeesProvider>
      <AttendanceProvider>
        <PayrollProvider>
          <Outlet />
        </PayrollProvider>
      </AttendanceProvider>
    </EmployeesProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ================= ROOT REDIRECT ================= */}
        <Route
          path="/"
          element={<Navigate to="/production/login" replace />}
        />

        {/* ================= LOGIN PAGES ================= */}
        <Route
          path="/production/login"
          element={<ProductionLoginPage />}
        />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/hr/login" element={<HrLoginPage />} />
        <Route
          path="/material-planning/login"
          element={<MaterialPlanningLoginPage />}
        />
        <Route
          path="/supervisor/login"
          element={<SupervisorLoginPage />}
        />
        <Route path="/accounts/login" element={<AccountsLoginPage />} />

        {/* ================= SHARED ================= */}
        <Route
          path="/welcome"
          element={
            <ProtectedRoute>
              <WelcomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        {/* Public on purpose: users who cannot sign in must still be able to
            read Help and reach support. Both pages load no protected data. */}
        <Route path="/help" element={<HelpCenter />} />
        <Route path="/contact" element={<Contact />} />

        {/* ================= MATERIAL PLANNING / INVENTORY ================= */}
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <Inventory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/consumable"
          element={
            <ProtectedRoute>
              <Consumable />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/consumable/grn"
          element={
            <ProtectedRoute>
              <ConsumableGRN />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/consumable/stock"
          element={
            <ProtectedRoute>
              <ConsumableStock />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/consumable/issue"
          element={
            <ProtectedRoute>
              <IssueConsumable />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/consumable/return"
          element={
            <ProtectedRoute>
              <ReturnConsumable />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/consumable/reports"
          element={
            <ProtectedRoute>
              <ConsumableReports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory/material"
          element={
            <ProtectedRoute>
              <MenuCard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/material/dwg-bom"
          element={
            <ProtectedRoute>
              <DwgBom />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/material/po-integration"
          element={
            <ProtectedRoute>
              <POIntegration />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/material/grn"
          element={
            <ProtectedRoute>
              <ReceiveGRN />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/material/material-stock"
          element={
            <ProtectedRoute>
              <MaterialStock />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/material/issue-to-jobwork"
          element={
            <ProtectedRoute>
              <IssueToJobWork />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/material/receive-from-jobwork"
          element={
            <ProtectedRoute>
              <ReceiveFromJobWork />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/material/issue-to-production"
          element={
            <ProtectedRoute>
              <IssueToProduction />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/material/production-operation"
          element={
            <ProtectedRoute>
              <ProductionOperation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/material/production-assembly-integration"
          element={
            <ProtectedRoute>
              <ProductionAssemblyIntegration />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/material/rework"
          element={
            <ProtectedRoute>
              <Rework />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/material/dispatch"
          element={
            <ProtectedRoute>
              <Dispatch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/material/scrap"
          element={
            <ProtectedRoute>
              <Scrap />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/material/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />

        {/* ================= ACCOUNTS ================= */}
        <Route
          path="/accounts"
          element={
            <ProtectedRoute>
              <AccountsHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts/po"
          element={
            <ProtectedRoute>
              <PO />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts/qo"
          element={
            <ProtectedRoute>
              <QO />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts/TaxInvoice"
          element={
            <ProtectedRoute>
              <TaxInvoice />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts/DeliveryChallan"
          element={
            <ProtectedRoute>
              <DeliveryChallan />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts/ProformaInvoice"
          element={
            <ProtectedRoute>
              <ProformaInvoiceForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts/Report"
          element={
            <ProtectedRoute>
              <AccountsReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts/ExpenseProfit"
          element={
            <ProtectedRoute>
              <ExpenseProfit />
            </ProtectedRoute>
          }
        />

        {/* ================= HR (scoped providers) =================
            Every route under /hr uses the HrLayout wrapper, which mounts
            EmployeesProvider / AttendanceProvider / PayrollProvider only
            for these pages. */}

        <Route element={<HrLayout />}>
          <Route
            path="/hr/employees"
            element={
              <ProtectedRoute>
                <Employees />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/employees/:id"
            element={
              <ProtectedRoute>
                <EmployeeProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/salary"
            element={
              <ProtectedRoute>
                <Salary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/attendance"
            element={
              <ProtectedRoute>
                <Attendance />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* ================= FALLBACK ================= */}
        <Route
          path="*"
          element={<Navigate to="/production/login" replace />}
        />
      </Routes>
    </AuthProvider>
  );
}