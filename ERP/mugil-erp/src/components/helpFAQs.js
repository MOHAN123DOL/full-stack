/* ============================================================
   MUGIL ERP — HELP CENTER CONTENT
   ------------------------------------------------------------
   Every answer below was written from the real source code of
   this repository (React pages, Django views/serializers/
   permissions). No tokens, passwords or server settings are
   described here on purpose.

   Entry shape:
     id         unique, stable id
     category   one of HELP_CATEGORIES
     question   shown as the accordion title
     answer     short plain-language answer
     steps      optional numbered steps
     causes     optional "common causes" list
     nextAction what to do if it still does not work
     retry      RETRY.SAFE  → trying again cannot create duplicates
                RETRY.CHECK → the action may already have been saved;
                              check the list/history BEFORE retrying
                RETRY.NA    → not an action that can be retried
     retryNote  optional one-line explanation of the retry advice
     keywords   extra search words
     actions    optional: "login" | "refresh" | "contact"
   ============================================================ */

export const RETRY = { SAFE: "safe", CHECK: "check", NA: "na" };

export const HELP_CATEGORIES = [
  "Login & Access",
  "Material Planning",
  "Consumables",
  "Accounts",
  "HR & Payroll",
  "Troubleshooting",
];

const CONTACT_NEXT =
  "If the problem continues, use Contact Us and include the exact message you see.";

export const HELP_FAQS = [
  /* ========================================================
     LOGIN & ACCESS
     ======================================================== */
  {
    id: "login-how",
    category: "Login & Access",
    question: "How do I log in to Mugil Industries ERP?",
    answer:
      "Open the ERP address. It opens the Production login page first. Use the department selector on that page to switch to your own department, then sign in with your username and password.",
    steps: [
      "Open the ERP in your browser.",
      "Choose your department in the department selector. The page changes to that department's login.",
      "Enter your username and password.",
      "Select Sign in.",
    ],
    causes: [
      "After signing in you land on: Inventory (Material Planning, Production, Supervisor), Employees (HR), Accounts home (Accounts) or the Welcome page (Admin).",
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.SAFE,
    retryNote: "Signing in again is safe.",
    keywords: ["login", "sign in", "log in", "username", "password", "start", "landing"],
    actions: ["login"],
  },
  {
    id: "login-department",
    category: "Login & Access",
    question: "How do I select the correct department?",
    answer:
      "Every ERP account belongs to one department: Production, Admin, HR, Material Planning, Supervisor or Accounts. You must sign in from that same department's login page, otherwise the sign-in is refused.",
    steps: [
      "Go to the login page.",
      "Pick your department in the department selector (Production, Admin, HR, Material Planning, Supervisor or Accounts).",
      "Enter your credentials and sign in.",
    ],
    causes: ["If you are not sure which department your account belongs to, ask your administrator."],
    nextAction: CONTACT_NEXT,
    retry: RETRY.SAFE,
    keywords: ["department", "role", "user type", "select department", "wrong department"],
    actions: ["login", "contact"],
  },
  {
    id: "login-redirected",
    category: "Login & Access",
    question: "Why am I redirected to the login page?",
    answer:
      "ERP pages are protected. When the app cannot confirm that you are signed in, it sends you to the login page. Note that it always sends you to the Production login page, so switch to your own department there.",
    steps: [
      "Select your department in the department selector.",
      "Sign in again.",
      "Open the page you wanted from the menu.",
    ],
    causes: [
      "You have not signed in yet, or you signed out.",
      "Your sign-in expired because you were away for a long time.",
      "Browser cookies were cleared or are blocked, so the app cannot restore your session.",
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.SAFE,
    keywords: ["redirect", "login page", "kicked out", "logged out", "protected", "session"],
    actions: ["login", "contact"],
  },
  {
    id: "login-401",
    category: "Login & Access",
    question: 'What does "401 Unauthorized" mean?',
    answer:
      "401 means the system could not confirm who you are. On the login page it usually means the username, password or department was not accepted. Inside the ERP it means your session is no longer valid.",
    steps: [
      "On the login page: check the department, username and password, then try again.",
      "Inside the ERP: the app first tries to renew your session automatically. If that fails, return to login and sign in again.",
    ],
    nextAction: "If you can sign in but 401 keeps appearing, contact support.",
    retry: RETRY.CHECK,
    retryNote:
      "If a Save was running when the error appeared, open the list or history to see whether it was saved before you save again.",
    keywords: ["401", "unauthorized", "unauthorised", "not authenticated"],
    actions: ["login", "contact"],
  },
  {
    id: "login-session-expired",
    category: "Login & Access",
    question: "Why has my session expired?",
    answer:
      "The ERP renews your sign-in automatically in the background, but a sign-in cannot last forever. It ends if you stay away for several days, if you sign out, or if browser cookies are cleared.",
    steps: [
      "Return to the login page.",
      "Select your department.",
      "Sign in again.",
    ],
    causes: [
      "Long inactivity.",
      "You signed out on this browser.",
      "Cookies were deleted or blocked.",
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote:
      "If the session ended while you were saving something, sign in and check the list first. The record may already exist.",
    keywords: ["session", "expired", "timeout", "time out", "sign in again", "authentication"],
    actions: ["login", "contact"],
  },
  {
    id: "login-refresh-error",
    category: "Login & Access",
    question: "Why am I seeing a refresh-token error?",
    answer:
      'Messages like "Refresh token not found." or "Refresh token is invalid or expired." mean the stored sign-in can no longer be renewed. Reloading the page will not fix this. You need to sign in again.',
    steps: [
      "Do not keep reloading the page.",
      "Return to the login page.",
      "Select your department and sign in again.",
    ],
    causes: [
      "The sign-in has expired.",
      "You signed out, possibly in another tab.",
      "Cookies were cleared or blocked in the browser.",
    ],
    nextAction: "If you see this right after a fresh sign-in, check that browser cookies are enabled, then contact support.",
    retry: RETRY.NA,
    keywords: ["refresh token", "token", "invalid", "expired", "cookie", "cookies"],
    actions: ["login", "contact"],
  },
  {
    id: "login-cannot",
    category: "Login & Access",
    question: "What should I do if I cannot log in?",
    answer:
      "Read the red message on the login page. It comes from the system and tells you the reason.",
    steps: [
      '"Please enter both username and password." → fill in both fields.',
      '"Invalid username or password." → re-type carefully and check Caps Lock.',
      '"You are not authorized for this department." → switch to the department your account belongs to.',
      '"Your account is inactive." → ask your administrator to reactivate it.',
      '"Unable to connect to the server…" → check your network, wait a moment and try again.',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.SAFE,
    keywords: ["cannot login", "can't login", "unable to log in", "invalid username", "inactive", "wrong password", "failed"],
    actions: ["login", "contact"],
  },
  {
    id: "login-403",
    category: "Login & Access",
    question: "Why do I receive an access-denied or 403 error?",
    answer:
      'You are signed in, but your department is not allowed to use that page or action. Messages look like "HR access required.", "Accounts access required." or "Material Planning access required."',
    steps: [
      "Go back to a page from your own department's menu.",
      "If you need that page for your work, ask your administrator about your access.",
    ],
    causes: [
      "You opened a page that belongs to another department.",
      "You are signed in under a different department than you intended.",
    ],
    nextAction: "Use Contact Us to request access. Do not try to bypass the restriction.",
    retry: RETRY.NA,
    retryNote: "Retrying will give the same result until your access changes.",
    keywords: ["403", "forbidden", "access denied", "permission", "not allowed", "access required"],
    actions: ["contact"],
  },
  {
    id: "login-difference",
    category: "Login & Access",
    question: "How can I tell an expired session from wrong credentials or missing permission?",
    answer:
      "Look at where and when the message appears.",
    steps: [
      "Wrong credentials: shown on the login page when you press Sign in (for example \"Invalid username or password.\" or \"You are not authorized for this department.\"). Fix the entry and try again.",
      "Expired session: you were already working and suddenly land on the login page, or see \"Session is invalid or expired.\" / \"Session not found. Please login again.\". Sign in again.",
      "Missing permission: you are signed in and the page or action says \"… access required.\" (403). Ask your administrator.",
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.NA,
    keywords: ["difference", "401", "403", "credentials", "permission", "expired"],
    actions: ["login", "contact"],
  },
  {
    id: "login-change-password",
    category: "Login & Access",
    question: "Why is my password change rejected?",
    answer:
      "The change-password form checks your input and shows the reason.",
    steps: [
      '"Current password is incorrect." → re-enter your present password.',
      '"New password and confirm password do not match." → type the same new password in both fields.',
      '"New password must be different…" → choose a password you are not already using.',
      '"Password must contain at least one uppercase letter / lowercase letter…" → follow the rule shown under the field.',
    ],
    nextAction: "If you forgot your current password, use Contact Us. Never share your password in the message.",
    retry: RETRY.SAFE,
    keywords: ["password", "change password", "profile", "reset"],
    actions: ["contact"],
  },

  /* ========================================================
     MATERIAL PLANNING
     ======================================================== */
  {
    id: "mp-access",
    category: "Material Planning",
    question: "Which pages are in Material Planning and who can use them?",
    answer:
      "The Inventory area has two parts: Consumable (GRN, Stock, Issue, Return, Reports) and Material (Drawing & BOM, PO Integration, GRN, Material Stock, Issue to Job Work, Receive from Job Work, Issue to Production, Production Operation, Production Assembly Integration, Rework, Dispatch, Scrap, Reports). Several of them (Consumables, Drawing & BOM, PO Integration and Scrap) are restricted to Material Planning users.",
    causes: ["If another department opens a restricted page, its data requests are refused with a 403 \"access required\" message."],
    nextAction: "Ask your administrator if you need access.",
    retry: RETRY.NA,
    keywords: ["inventory", "material", "menu", "modules", "pages", "who can"],
    actions: ["contact"],
  },
  {
    id: "mp-bom",
    category: "Material Planning",
    question: "How do I enter a Drawing and its BOM?",
    answer:
      "BOM entry follows this order: Project → Drawing → BOM items.",
    steps: [
      "Create or choose a Project.",
      "Create or choose a Drawing under that project.",
      "Add BOM items. Fill at least one of: material type, thickness, length, width, grade or remarks.",
      "Save the BOM.",
    ],
    causes: [
      '"Enter at least one field…" → the BOM row is empty.',
      '"drawingId is required." / "Drawing not found." → select a drawing first.',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "A batch save may already have stored your rows. Reopen the drawing and review the BOM before saving again.",
    keywords: ["drawing", "bom", "dwg", "project", "bill of materials", "thickness", "grade"],
    actions: ["contact"],
  },
  {
    id: "mp-po-integration",
    category: "Material Planning",
    question: "How does Purchase Order integration work and why does it fail?",
    answer:
      "PO Integration links purchase-order items to a project. You select a project, enter the quantity for each PO item you want to link, then save.",
    steps: [
      "Select the project first.",
      "Enter a quantity greater than 0 against each PO item to integrate.",
      "Save the integrations.",
    ],
    causes: [
      '"Select a project first." → choose a project.',
      '"Enter at least one quantity to integrate." → no quantity was entered.',
      '"PO is not confirmed." → the Purchase Order must be confirmed in Accounts before it can be used.',
      '"Some rows failed validation." → a row has a missing or invalid quantity; correct the highlighted rows.',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Saved integrations appear in the integration history. Check it before saving the same rows again.",
    keywords: ["po", "purchase order", "integration", "integrate", "project", "confirmed"],
    actions: ["contact"],
  },
  {
    id: "mp-dummy-po",
    category: "Material Planning",
    question: "How do I create a Dummy Purchase Order and why is it rejected?",
    answer:
      "A Dummy PO lets you integrate or receive material that has no real confirmed Purchase Order yet.",
    steps: [
      "Enter a Dummy PO number.",
      "Enter a description and a unit.",
      "Enter a quantity greater than 0.",
      "Create the Dummy PO.",
    ],
    causes: [
      '"Dummy PO number is required." / "Description is required." / "Unit is required."',
      '"Quantity must be greater than zero."',
      "\"Dummy PO '…' already exists.\" → use a different number.",
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "If you see \"already exists\", the first attempt worked. Do not create it again.",
    keywords: ["dummy po", "dummy purchase order", "temporary po"],
    actions: ["contact"],
  },
  {
    id: "mp-grn",
    category: "Material Planning",
    question: "How do I receive material with a GRN?",
    answer:
      "Receive GRN records material that has arrived against a PO item (real or dummy).",
    steps: [
      "Find the PO item in the receivable list.",
      "Enter the quantity received (greater than 0).",
      "Choose the receiving unit: Unit 1 or Unit 2.",
      "Enter who received it (Received By).",
      "Save. The system shows the GRN number that was recorded.",
    ],
    causes: [
      '"Receiving Unit must be Unit 1 or Unit 2." / "Received By is required."',
      '"PO is not confirmed." → confirm the PO in Accounts first.',
      '"This PO item is already fully received." → nothing is left to receive.',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "If the save was interrupted, check GRN history before saving again so the same delivery is not received twice.",
    keywords: ["grn", "goods received", "receive", "receiving unit", "unit 1", "unit 2", "received by"],
    actions: ["contact"],
  },
  {
    id: "mp-stock",
    category: "Material Planning",
    question: "Why is a material not in Material Stock, or why is the quantity different?",
    answer:
      "Material Stock holds stock lots created from received GRNs. Each lot has a movement history showing every issue and return.",
    steps: [
      "Confirm the GRN was saved (see GRN history).",
      "Open Material Stock and clear any filters or search text.",
      "Open the lot and review its movements to see what reduced the quantity.",
    ],
    causes: [
      "The GRN was not saved or no stock lot was created from it yet.",
      "Part of the quantity was issued to job work or production.",
    ],
    nextAction: "If the movements do not explain the quantity, use Contact Us with the stock ID.",
    retry: RETRY.SAFE,
    retryNote: "Reloading the list is safe. It only reads data.",
    keywords: ["stock", "material stock", "quantity", "lot", "stock id", "movement", "missing"],
    actions: ["refresh", "contact"],
  },
  {
    id: "mp-rework-block",
    category: "Material Planning",
    question: 'Why do I see "Rework not completed — cannot issue until Rework marks it Done"?',
    answer:
      "That stock lot is linked to a Rework record that is still open. It can be issued only after the Rework is completed.",
    steps: [
      "Open the Rework page.",
      "Find the record for that material.",
      "Complete the Rework (and QC if required).",
      "Return to the issue screen.",
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.NA,
    keywords: ["rework", "cannot issue", "blocked", "not completed"],
    actions: ["contact"],
  },
  {
    id: "mp-jobwork-issue",
    category: "Material Planning",
    question: "How do I issue material to Job Work?",
    answer:
      "Choose the stock lot, the job work type and process, then record who is receiving it and when it should return.",
    steps: [
      "Select the material (stock lot) to issue.",
      "Select the job work type and the process. If the process does not exist, create it with a process name and a unique process ID.",
      "Enter the issue quantity (greater than 0 and not more than available).",
      "Select the job work unit (Unit 1 or Unit 2), the vendor, the job work location and the expected return date.",
      "Enter who is issuing the material, then save.",
    ],
    causes: [
      '"Only … are available to issue." → reduce the quantity.',
      '"This Process ID already exists." → use a different process ID.',
      '"Vendor / location / expected return date / issued by is required."',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Check the issue history before saving again. A second save would issue the material twice.",
    keywords: ["job work", "jobwork", "issue", "vendor", "process", "expected return"],
    actions: ["contact"],
  },
  {
    id: "mp-jobwork-receive",
    category: "Material Planning",
    question: "How do I receive material back from Job Work?",
    answer:
      "Open the pending job work issue, record how much input was completed and list the output pieces that came back.",
    steps: [
      "Select the job work issue.",
      "Enter the completed input quantity (greater than 0).",
      "Add at least one output piece with a piece number and quantity.",
      "For remaining pieces, enter a plate / material number.",
      "Enter who received the material, then save.",
    ],
    causes: [
      '"Only … balance to return." → the quantity is more than what is still out with the vendor.',
      '"Enter a Plate / Material No for every remaining piece."',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "A saved receipt gets a receive number. Check receive history before saving again.",
    keywords: ["receive from job work", "return", "output piece", "balance", "plate"],
    actions: ["contact"],
  },
  {
    id: "mp-production-issue",
    category: "Material Planning",
    question: "How do I issue material to Production?",
    answer:
      "Issue to Production moves available job-work pieces to production.",
    steps: [
      "Open the list of available pieces.",
      "Select the piece and enter the quantity (greater than 0).",
      "Enter who is issuing it and save.",
    ],
    causes: [
      '"Piece not found." → the piece is no longer in the available list; refresh the list.',
      '"Issued quantity must be > 0." / "issuedBy is required."',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Check the production issue history before saving again.",
    keywords: ["issue to production", "piece", "production issue"],
    actions: ["refresh", "contact"],
  },
  {
    id: "mp-assembly",
    category: "Material Planning",
    question: "How do I use Production Assembly Integration?",
    answer:
      "It builds an assembly for a project from issued inputs and a list of processes.",
    steps: [
      "Select the project.",
      "Add at least one input with a quantity greater than 0.",
      "Add at least one process.",
      "Save. An assembly ID is generated.",
    ],
    causes: [
      '"projectId is required." / "At least one input is required." / "At least one process is required."',
      '"Input #n: quantity must be > 0."',
      '"Assembly not found." → it may have been deleted; reload the list.',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Look for the new assembly ID in the list before saving again.",
    keywords: ["assembly", "production assembly", "integration", "inputs", "processes"],
    actions: ["contact"],
  },
  {
    id: "mp-operation",
    category: "Material Planning",
    question: "How does Production Operation work?",
    answer:
      "Each assembly has stages that are started, completed and QC-verified one at a time. Stages that go to an outside vendor create a Delivery Challan reference.",
    steps: [
      "Open the assembly.",
      "Start the next stage.",
      "Record its completion.",
      "Record the QC verification.",
      "For a stage sent to a vendor, open the Delivery Challan module when the message tells you to.",
    ],
    causes: ['"Stage not found." / "sequence is required." → reload the assembly and select the stage again.'],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Reload the assembly to see the stage status before repeating a start, complete or QC action.",
    keywords: ["production operation", "stage", "qc", "start", "complete", "vendor", "delivery challan"],
    actions: ["refresh", "contact"],
  },
  {
    id: "mp-rework",
    category: "Material Planning",
    question: "How do I handle Rework?",
    answer:
      "A Rework record moves through Start → Complete → QC. It can be cancelled until it is completed.",
    steps: [
      "Start the rework. Enter who is doing it and the supervisor.",
      "Complete the rework. Enter who completed it.",
      "Record QC. Enter the verifier and choose Approved or Rejected.",
    ],
    causes: [
      '"Cannot start a record that is …" → the record is already past that step.',
      '"A completed rework cannot be cancelled."',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Reload the record to see its current status before repeating a step.",
    keywords: ["rework", "qc", "approved", "rejected", "cancel", "supervisor"],
    actions: ["refresh", "contact"],
  },
  {
    id: "mp-dispatch",
    category: "Material Planning",
    question: "Why is an assembly missing from the Dispatch ready list?",
    answer:
      "The Ready list shows only assemblies that are completed and pass the dispatch-readiness check. Dispatches that are already recorded appear under History.",
    steps: [
      "Clear the filters (project, assembly ID, DC reference, status).",
      "Check Production Operation: the assembly must be completed with QC accepted.",
      "Check the History tab in case it was already dispatched.",
    ],
    causes: ['"Invalid dispatch data." → the dispatch form has missing or invalid values; review each field.'],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Check Dispatch History before saving again, so the same assembly is not dispatched twice.",
    keywords: ["dispatch", "ready", "history", "dc", "delivery challan", "assembly missing"],
    actions: ["refresh", "contact"],
  },
  {
    id: "mp-scrap",
    category: "Material Planning",
    question: "How do I record Scrap?",
    answer:
      "Scrap entries are linked to confirmed PO items and need a type and a reason.",
    steps: [
      "Select the PO item.",
      "Select the scrap type and the scrap reason.",
      "Enter the quantity or weight and save.",
      "Use the dashboard to see totals by type, process and reason.",
    ],
    causes: ['"Please select a scrap type." / "Please select a scrap reason."'],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Check the scrap list before saving again.",
    keywords: ["scrap", "waste", "reason", "type", "weight"],
    actions: ["contact"],
  },
  {
    id: "mp-reports",
    category: "Material Planning",
    question: "Why are Inventory Reports empty or incomplete?",
    answer:
      "Reports are built from saved records and the filters you choose. A filter that is too narrow, or a record that was never saved, gives an empty report.",
    steps: [
      "Clear all filters and the date range.",
      "Select the report again.",
      "Open the Material Movement view for a project or PO to follow its full timeline.",
    ],
    nextAction: "If a saved record is still missing, use Contact Us with the document number.",
    retry: RETRY.SAFE,
    retryNote: "Reports only read data, so reloading is safe.",
    keywords: ["reports", "empty report", "filter", "movement", "timeline", "kpi"],
    actions: ["refresh", "contact"],
  },

  /* ========================================================
     CONSUMABLES
     ======================================================== */
  {
    id: "cons-grn",
    category: "Consumables",
    question: "How do I receive a consumable (GRN)?",
    answer:
      "You can receive against a Purchase Order item, or create a Direct GRN.",
    steps: [
      "Choose the PO item (or start a Direct GRN).",
      "Enter the quantity (greater than 0).",
      "Choose the warehouse: Unit One or Unit Two.",
      "Enter who received it and save.",
    ],
    causes: [
      '"Received by is required." / "Invalid warehouse. Select Unit One or Unit Two."',
      '"This PO item is already fully received."',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Look in Consumable Stock before saving again. A second save would receive the quantity twice.",
    keywords: ["consumable", "grn", "direct grn", "warehouse", "unit one", "unit two"],
    actions: ["contact"],
  },
  {
    id: "cons-issue",
    category: "Consumables",
    question: "Why can't I issue a consumable?",
    answer:
      "The issue form needs a stock line with quantity left, a department and an employee name.",
    steps: [
      "Select a stock line that still has quantity.",
      "Enter the department and the employee name.",
      "Enter a quantity greater than 0 and save.",
    ],
    causes: [
      '"This stock line is fully issued." → pick another stock line.',
      '"Department is required." / "Employee name is required."',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Check the issue history before saving again.",
    keywords: ["issue consumable", "department", "employee", "stock line", "fully issued"],
    actions: ["contact"],
  },
  {
    id: "cons-return",
    category: "Consumables",
    question: "How do I return a consumable?",
    answer:
      "Only issues that are marked returnable and not fully returned can be returned.",
    steps: [
      "Open Return Consumable and select the issue.",
      "Enter the return quantity (greater than 0).",
      "Save.",
    ],
    causes: ['"This issue is already fully returned." → nothing remains to return.'],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Check the issue's returned quantity before saving again.",
    keywords: ["return consumable", "returnable", "fully returned"],
    actions: ["contact"],
  },
  {
    id: "cons-reports",
    category: "Consumables",
    question: "Where can I see consumable movements?",
    answer:
      "Consumable Reports groups the movements (receive, issue, return) and lets you open the detail of each group. Consumable Stock shows what is currently on hand.",
    steps: ["Open Consumable Reports.", "Select a movement group.", "Open the detail to see each transaction."],
    nextAction: CONTACT_NEXT,
    retry: RETRY.SAFE,
    keywords: ["consumable reports", "movement", "stock", "history"],
    actions: ["refresh", "contact"],
  },

  /* ========================================================
     ACCOUNTS
     ======================================================== */
  {
    id: "acc-workflow",
    category: "Accounts",
    question: "How do Accounts documents work (PO, Quotation, Tax Invoice, Delivery Challan, Proforma)?",
    answer:
      "All five documents follow the same pattern: the system proposes the next number, you fill in customer and items, save, preview, and then Confirm. Confirming stores the PDF.",
    steps: [
      "Open the document from the Accounts home.",
      "Check the number the system proposed.",
      "Choose or add the customer, then add the items.",
      "Save, then open the preview.",
      "Confirm to store the PDF.",
    ],
    causes: ["Documents are managed from the Accounts department, and the Confirm step requires an Accounts sign-in. Delivery Challan can also be used by Material Planning."],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Check the Accounts Report for the document number before saving or confirming again.",
    keywords: ["purchase order", "quotation", "tax invoice", "delivery challan", "proforma", "workflow", "confirm"],
    actions: ["contact"],
  },
  {
    id: "acc-validation",
    category: "Accounts",
    question: "Why does an Accounts form show a validation error?",
    answer:
      "The form is checked before it is saved. The message names the problem.",
    steps: [
      '"At least one … item is required." → add a line item.',
      '"Item n: description is required." → fill the item description.',
      '"quantity/rate cannot be negative" or "must be a number" → correct the number.',
      '"GST / CGST / SGST / IGST percentage cannot be negative."',
      '"Invoice number / Proforma number / Delivery challan date is required." → fill the missing header field.',
      '"Customer company name is required." / "Customer validation failed." → complete the customer details.',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.SAFE,
    retryNote: "A rejected validation did not save anything, so correcting and saving again is safe.",
    keywords: ["validation", "required", "invoice", "gst", "cgst", "sgst", "igst", "customer", "item", "negative"],
    actions: ["contact"],
  },
  {
    id: "acc-confirm",
    category: "Accounts",
    question: "Why can't I confirm a document or save its PDF?",
    answer:
      "Confirm needs a valid session in the Accounts department and a PDF file.",
    steps: [
      '"No PDF file was uploaded." → open the document preview and use Confirm from there so the PDF is included.',
      '"Only valid PDF files are allowed." / "PDF files must be 10 MB or smaller." → use a real PDF under 10 MB.',
      '"Session not found. Please login again." / "Session is invalid or expired." → sign in again, then check whether the document was already confirmed.',
      '"Accounts access required." → sign in under the Accounts department.',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "The message \"… confirmed and PDF saved\" means it worked. Check the document's status in the Accounts Report before confirming again.",
    keywords: ["confirm", "pdf", "upload", "10 mb", "session", "confirmed"],
    actions: ["login", "contact"],
  },
  {
    id: "acc-customers",
    category: "Accounts",
    question: "How do I add or correct a customer?",
    answer:
      "Each document type keeps its own customer list. You can add a new customer or update an existing one while creating the document.",
    steps: [
      "Search for the customer in the document's customer field.",
      "If it is not listed, add the customer with at least the company name.",
      "To correct details, edit the customer and save.",
    ],
    causes: ['"Customer validation failed." → a required customer field is missing or invalid.', '"Customer not found." → reload the list and select again.'],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Search the customer list first to see whether the customer was already added.",
    keywords: ["customer", "vendor", "company name", "gst number", "add customer"],
    actions: ["contact"],
  },
  {
    id: "acc-report",
    category: "Accounts",
    question: "How do I find a document or update its status in Accounts Report?",
    answer:
      "Accounts Report lists the documents you created. You can filter by type and update payment or delivery status.",
    steps: [
      "Open Accounts Report and choose the document type.",
      "Use the search or filters to find the number.",
      "Change the payment or delivery status and save.",
    ],
    causes: [
      '"Provide at least one of payment_status or delivery_status." → choose a status to change.',
      '"Document not found." → reload the list.',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.SAFE,
    retryNote: "Setting the same status again does not create a duplicate.",
    keywords: ["accounts report", "status", "payment status", "delivery status", "find document"],
    actions: ["refresh", "contact"],
  },
  {
    id: "acc-expense",
    category: "Accounts",
    question: "How do I use Expense & Profit (Journal)?",
    answer:
      "Expense & Profit is a journal. You add entries, the page shows a summary, and an entry can be edited or deleted.",
    steps: [
      "Open Expense & Profit.",
      "Add a journal entry and fill every required field.",
      "Save and review the summary at the top.",
    ],
    causes: ['"Invalid journal entry." → a required field is missing or invalid.'],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Check the journal list before saving again so the same entry is not added twice.",
    keywords: ["expense", "profit", "journal", "entry", "income"],
    actions: ["contact"],
  },

  /* ========================================================
     HR & PAYROLL
     ======================================================== */
  {
    id: "hr-access",
    category: "HR & Payroll",
    question: "Who can use the HR pages?",
    answer:
      "Employees, Employee Profile, Attendance, Salary and Advances are for HR users. Other departments see a 403 message such as \"HR access required.\". Only the employee lookup used on the Salary page is also open to Material Planning.",
    nextAction: "Ask your administrator about access.",
    retry: RETRY.NA,
    keywords: ["hr", "access", "permission", "403", "employees"],
    actions: ["contact"],
  },
  {
    id: "hr-employee",
    category: "HR & Payroll",
    question: "Why can't I save an employee?",
    answer:
      "The employee form is checked before saving.",
    steps: [
      '"First name is required." / "Employee ID is required." → fill the field.',
      '"This Employee ID is already in use." → use a different ID.',
      '"An employee with this email already exists." → the employee may already be in the list; search for them.',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.SAFE,
    retryNote: "A rejected form saved nothing. If you saw \"created successfully\", do not add the employee again.",
    keywords: ["employee", "add employee", "employee id", "email", "duplicate", "validation"],
    actions: ["contact"],
  },
  {
    id: "hr-photo",
    category: "HR & Payroll",
    question: "Why is an employee photo rejected?",
    answer:
      "Photos must be real image files: JPEG, PNG, WebP or GIF, up to 5 MB.",
    steps: ["Choose a JPEG, PNG, WebP or GIF image.", "Make sure it is 5 MB or smaller.", "Upload again."],
    causes: ['"No image was uploaded." / "Only image files are allowed." / "Image must be 5 MB or smaller."'],
    nextAction: CONTACT_NEXT,
    retry: RETRY.SAFE,
    keywords: ["photo", "image", "upload", "5 mb", "picture"],
    actions: ["contact"],
  },
  {
    id: "hr-profile",
    category: "HR & Payroll",
    question: "How do I open or archive an employee profile?",
    answer:
      "Select an employee in the Employees list to open the profile. Archiving takes the employee out of the active list.",
    steps: ["Open Employees.", "Select the employee.", "Edit details or use the archive option."],
    causes: ['"Employee not found." → the employee may have been removed; reload the list.'],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Reload the list to see the current state before repeating an archive or delete.",
    keywords: ["profile", "archive", "employee profile", "delete employee"],
    actions: ["refresh", "contact"],
  },
  {
    id: "hr-attendance",
    category: "HR & Payroll",
    question: "Why is an attendance entry rejected?",
    answer:
      "Attendance supports these statuses: Present, Half Day, Absent, Paid Leave, Unpaid Leave, Holiday, Weekly Off and Work From Home. Some statuses need times.",
    steps: [
      '"Employee is required." → choose the employee.',
      '"Login time is required for this status." / "Logout time is required for this status." → enter the times.',
      '"Logout time cannot be equal to login time."',
      '"Break hours cannot be negative."',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "Check the day's entries before saving again to avoid a duplicate record.",
    keywords: ["attendance", "login time", "logout time", "break", "present", "absent", "leave", "wfh"],
    actions: ["contact"],
  },
  {
    id: "hr-salary",
    category: "HR & Payroll",
    question: "Why can't I save a salary payment or advance?",
    answer:
      "Salary is recorded per employee and per month. Advances are recorded separately.",
    steps: [
      '"Salary month is required." → choose the month.',
      '"Salary already exists for this employee…" → a payment for that month was already saved. Open the existing record instead.',
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "If you see \"already exists\", the first save worked. Do not save again.",
    keywords: ["salary", "payroll", "advance", "wage", "month", "payment"],
    actions: ["contact"],
  },
  {
    id: "hr-loading",
    category: "HR & Payroll",
    question: "Why do HR lists fail to load?",
    answer:
      "HR pages load employee, attendance and payroll data when you open them. A failure is usually a lost session, a department mismatch or a network problem.",
    steps: [
      "Check that you signed in under HR.",
      "Reload the page once.",
      "If you are sent to the login page, sign in again.",
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.SAFE,
    retryNote: "Loading data is safe to repeat.",
    keywords: ["load", "loading", "hr", "employees", "failed to load", "empty list"],
    actions: ["refresh", "login", "contact"],
  },

  /* ========================================================
     TROUBLESHOOTING
     ======================================================== */
  {
    id: "ts-page-not-loading",
    category: "Troubleshooting",
    question: "Why is the page not loading?",
    answer:
      "A page can fail to load because of your network, a lost session, or the server being unavailable.",
    steps: [
      "Check your internet or office network.",
      "Reload the page once.",
      "If you are sent to the login page, sign in again.",
      "If an error screen with a Try Again button appears, select it once.",
    ],
    nextAction: "If it still does not load, use Contact Us and mention the page name and time.",
    retry: RETRY.SAFE,
    retryNote: "Reloading a page only reads data.",
    keywords: ["not loading", "blank", "white screen", "loading", "stuck", "error screen"],
    actions: ["refresh", "login", "contact"],
  },
  {
    id: "ts-400",
    category: "Troubleshooting",
    question: "Why am I getting 400 Bad Request?",
    answer:
      "400 means the system rejected the information you sent because something is missing or invalid.",
    steps: [
      "Read the message under the field or at the top of the form.",
      "Fix the field it names.",
      "Save again.",
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.SAFE,
    retryNote: "A 400 means nothing was saved, so correcting and saving again is safe.",
    keywords: ["400", "bad request", "invalid", "validation"],
    actions: ["contact"],
  },
  {
    id: "ts-401",
    category: "Troubleshooting",
    question: "Why am I getting 401 Unauthorized?",
    answer:
      "Your session is no longer valid, or the login details were not accepted. The app tries to renew the session once, automatically.",
    steps: ["Return to the login page.", "Select your department.", "Sign in again."],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "If you were saving, check the list first. The save may have gone through after the session was renewed.",
    keywords: ["401", "unauthorized", "session"],
    actions: ["login", "contact"],
  },
  {
    id: "ts-403",
    category: "Troubleshooting",
    question: "Why am I getting 403 Forbidden?",
    answer:
      "You are signed in, but your department is not allowed to do that. Retrying will not change it.",
    steps: ["Go back to a page in your own department.", "Ask your administrator if you need access."],
    nextAction: "Use Contact Us to request access.",
    retry: RETRY.NA,
    keywords: ["403", "forbidden", "permission", "access required"],
    actions: ["contact"],
  },
  {
    id: "ts-404",
    category: "Troubleshooting",
    question: "Why am I getting 404 Not Found?",
    answer:
      'The record or page could not be found. Messages look like "Employee not found." or "Assembly not found." The record may have been deleted, or the list on your screen is out of date. Typing a wrong address in the browser also leads to the login page.',
    steps: ["Reload the list.", "Search for the record again.", "Open it from the menu instead of an old link."],
    nextAction: CONTACT_NEXT,
    retry: RETRY.SAFE,
    keywords: ["404", "not found", "missing", "deleted"],
    actions: ["refresh", "contact"],
  },
  {
    id: "ts-429",
    category: "Troubleshooting",
    question: "Why does the system say too many requests?",
    answer:
      "The server limits how many requests can be made in a short time. This is a 429 error.",
    steps: ["Stop clicking and wait about a minute.", "Try once more."],
    nextAction: CONTACT_NEXT,
    retry: RETRY.CHECK,
    retryNote: "If you were saving, check whether it was saved before you try again.",
    keywords: ["429", "too many requests", "throttle", "rate limit", "slow down"],
    actions: ["contact"],
  },
  {
    id: "ts-500",
    category: "Troubleshooting",
    question: "What does a server error (500) mean?",
    answer:
      "The server hit a problem while processing your request. It is not caused by anything you typed.",
    steps: ["Wait a minute.", "Open the list or history to check whether your action was saved.", "Only then try again if it was not saved."],
    nextAction: "If it repeats, use Contact Us with the page, the time and what you were doing.",
    retry: RETRY.CHECK,
    retryNote: "A server error can happen after the data was saved. Always check first.",
    keywords: ["500", "server error", "internal", "failed"],
    actions: ["contact"],
  },
  {
    id: "ts-not-in-list",
    category: "Troubleshooting",
    question: "Why is a saved record not appearing in the list?",
    answer:
      "The list may be filtered, out of date, or the save may not have completed.",
    steps: [
      "Clear all filters and search text.",
      "Reload the page.",
      "Look in the History or Report page for the document number.",
      "Do not save the same record again until you have checked.",
    ],
    causes: ["An active filter hides it.", "The save was interrupted.", "The record is in a different tab (for example History instead of Ready)."],
    nextAction: "If the record is not anywhere, use Contact Us with the number and time.",
    retry: RETRY.CHECK,
    retryNote: "Saving again can create a duplicate GRN, issue, invoice or order.",
    keywords: ["not appearing", "missing record", "saved", "cannot find", "list", "disappeared"],
    actions: ["refresh", "contact"],
  },
  {
    id: "ts-dropdown-empty",
    category: "Troubleshooting",
    question: "Why is a dropdown empty?",
    answer:
      "Dropdowns are filled from saved data, so they are empty when that data has not loaded or does not exist yet.",
    steps: [
      "Select the parent value first (for example, a project before its drawings).",
      "Reload the page.",
      "Check that the earlier step was completed (for example, the PO must be confirmed).",
    ],
    causes: ["The data request failed.", "No matching records exist yet.", "You are signed in under a department that cannot see that data."],
    nextAction: CONTACT_NEXT,
    retry: RETRY.SAFE,
    keywords: ["dropdown", "empty", "no options", "select", "list is empty"],
    actions: ["refresh", "contact"],
  },
  {
    id: "ts-not-integrable",
    category: "Troubleshooting",
    question: "Why is a record not available for integration or receiving?",
    answer:
      "A record is offered only when the earlier step in the workflow is finished.",
    steps: [
      "Purchase Order: it must be confirmed in Accounts.",
      "GRN: the PO item must not be fully received already.",
      "Issue or production: stock must be available and any Rework must be completed.",
      "Dispatch: the assembly must be completed and QC-accepted.",
    ],
    nextAction: CONTACT_NEXT,
    retry: RETRY.SAFE,
    keywords: ["not available", "integration", "cannot select", "not confirmed", "po not showing"],
    actions: ["refresh", "contact"],
  },
  {
    id: "ts-validation",
    category: "Troubleshooting",
    question: "Why is the form showing a validation error?",
    answer:
      "The form found a missing or invalid value. Nothing was saved.",
    steps: ["Read the message beside the field.", "Fix that field.", "Check the other required fields.", "Save again."],
    nextAction: CONTACT_NEXT,
    retry: RETRY.SAFE,
    keywords: ["validation", "required", "invalid", "must be", "greater than"],
    actions: ["contact"],
  },
  {
    id: "ts-network",
    category: "Troubleshooting",
    question: "Why am I seeing a network error?",
    answer:
      "Your device could not reach the ERP server. The message often reads \"Unable to connect to the server\".",
    steps: [
      "Check your Wi-Fi or office network.",
      "Wait a few seconds and reload once.",
      "If you were saving, open the list first to check whether it was saved.",
    ],
    nextAction: "If the network is fine but the error stays, use Contact Us.",
    retry: RETRY.CHECK,
    retryNote: "A network drop can happen after the server saved your data. Check before you save again.",
    keywords: ["network", "offline", "connect", "connection", "server", "timeout"],
    actions: ["refresh", "contact"],
  },
  {
    id: "ts-refresh-not-working",
    category: "Troubleshooting",
    question: "What should I do if refreshing the page does not fix the problem?",
    answer:
      "Refreshing only helps with temporary loading problems. It does not fix a missing permission, a failed validation or an expired sign-in.",
    steps: [
      "Read the exact message.",
      "Expired sign-in → return to login.",
      "Validation message → correct the field.",
      "\"… access required\" → you need access from your administrator.",
      "None of these → use Contact Us.",
    ],
    nextAction: "Use Contact Us and include the page name, the message and the time.",
    retry: RETRY.NA,
    keywords: ["refresh", "reload", "not working", "still failing", "try again"],
    actions: ["login", "contact"],
  },
  {
    id: "ts-duplicate",
    category: "Troubleshooting",
    question: "How do I avoid creating a duplicate after an error?",
    answer:
      "The ERP does not retry saves for you, except that one request that fails with 401 is retried once after your session is renewed. A request can fail on your screen even though the data was saved.",
    steps: [
      "Do not press Save again immediately.",
      "Open the list, history or report for that page.",
      "Search for the document, GRN or entry number and time.",
      "Save again only if it is not there.",
    ],
    nextAction: "If you find a duplicate, use Contact Us. Do not try to delete it yourself.",
    retry: RETRY.CHECK,
    keywords: ["duplicate", "double", "twice", "resubmit", "resubmission", "retry"],
    actions: ["contact"],
  },
];
