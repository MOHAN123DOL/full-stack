import { useCallback, useEffect, useMemo, useState } from "react";
import VendorDetails from "../../components/VendorDetails";
import OrderItemsTable from "../../components/OrderItemsTable";
import AmountSummary from "../../components/AmountSummary";
import TermsEditor from "../../components/TermsEditor";
import { initialQuoteData } from "../../utils/initialData";
import "./Quotation.css";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../../components/Header";
import Loading from "../../components/loading";
// Renamed from `Error` so it no longer shadows the global Error constructor
// (this file uses `new Error(...)`).
import ErrorState from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const QUOTATION_CUSTOMERS_ENDPOINT = "/erp/quotation-customers/";
const QUOTATION_NEXT_NUMBER_ENDPOINT = "/erp/quotations/next-number/";
const QUOTATION_SAVE_ENDPOINT = "/erp/quotations/";

/* Single generic error message for every failure. */
const GENERIC_ERROR = "Something went wrong. Please try again.";

// ---------------------------------------------------------------------------
// Print engine loader
// ---------------------------------------------------------------------------
let quotationPrintEnginePromise = null;
function loadQuotationPrintEngine() {
  if (typeof window.generateQuotationPrint === "function") {
    return Promise.resolve();
  }
  if (quotationPrintEnginePromise) return quotationPrintEnginePromise;

  quotationPrintEnginePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-quotation-print-engine="true"]'
    );
    if (existing) {
      if (typeof window.generateQuotationPrint === "function") {
        resolve();
        return;
      }
      const onLoad = () => {
        if (typeof window.generateQuotationPrint === "function") {
          resolve();
        } else {
          quotationPrintEnginePromise = null;
          reject(new Error("QuotationPrint.js loaded but did not register generateQuotationPrint"));
        }
      };
      const onError = () => {
        quotationPrintEnginePromise = null;
        reject(new Error("QuotationPrint.js failed to load"));
      };
      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }
    
    const script = document.createElement("script");
    script.src = "/QuotationPrint.js";
    script.async = true;
    script.dataset.quotationPrintEngine = "true";
    script.onload = () => {
      if (typeof window.generateQuotationPrint === "function") {
        resolve();
      } else {
        quotationPrintEnginePromise = null;
        reject(new Error("QuotationPrint.js loaded but did not register generateQuotationPrint"));
      }
    };
    script.onerror = () => {
      quotationPrintEnginePromise = null;
      reject(new Error("QuotationPrint.js failed to load"));
    };
    document.head.appendChild(script);
  });

  return quotationPrintEnginePromise;
}

// ---------------------------------------------------------------------------
// Default technical sections
// ---------------------------------------------------------------------------
const DEFAULT_TECHNICAL_SECTIONS = [
  {
    heading: "Material",
    points: [
      "Mild Steel Plates conforming to IS 2062 Grade. Plate Thickness: 20 mm.",
    ],
  },
  {
    heading: "Pipe Specification",
    points: [
      "Type of Pipe: Fabricated Mild Steel Pipe",
      "Internal Diameter (I.D.): 540 mm",
      "Standard Pipe Length: 6.0 metres",
    ],
  },
  {
    heading: "Fabrication Scope",
    points: [
      "Procurement of M.S. plates.",
      "Cutting of plates to the required dimensions.",
      "Plate rolling to achieve the specified diameter.",
      "Full penetration welding of all circumferential joints.",
      "Grinding and finishing of weld joints.",
      "Dimensional inspection of fabricated pipes.",
    ],
  },
  {
    heading: "Fabrication Methodology",
    points: [
      "The pipes shall be fabricated at our works in transportable sections and supplied to the project site.",
      "Each 6.0-metre-long pipe shall be fabricated by welding four (4) rolled sections of 1.5 metre length each to achieve the required pipe length.",
      "All circumferential weld joints shall be fully welded, ground, and finished before dispatch.",
    ],
  },
  {
    heading: "Inspection",
    points: [
      "Visual inspection of weld joints.",
      "Dimensional inspection of fabricated pipes.",
    ],
  },
];

// ---------------------------------------------------------------------------
// Vendor shape (matches VendorDetails)
// ---------------------------------------------------------------------------
const EMPTY_VENDOR = {
  companyName: "",
  contactPerson: "",
  gst: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  email: "",
};

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------
const normalizeVendor = (vendor) => ({
  companyName: vendor?.companyName ?? "",
  contactPerson: vendor?.contactPerson ?? "",
  gst: vendor?.gst ?? "",
  address1: vendor?.address1 ?? "",
  address2: vendor?.address2 ?? "",
  city: vendor?.city ?? "",
  state: vendor?.state ?? "",
  pincode: vendor?.pincode ?? "",
  phone: vendor?.phone ?? "",
  email: vendor?.email ?? "",
});

const normalizeSignatures = (signatures) => ({
  preparedBy: signatures?.preparedBy ?? "",
});

const normalizeQuoteData = (raw) => {
  const base = initialQuoteData();
  const source = raw || {};

  return {
    ...base,
    ...source,

    quotationNumber: source.quotationNumber ?? "",
    quotationDate: source.quotationDate ?? base.quotationDate ?? "",
    subject: source.subject ?? "",
    intro: source.intro ?? "",
    companyName: source.companyName ?? "",
    designation: source.designation ?? "",
    gstPercent:
      source.gstPercent === undefined || source.gstPercent === null
        ? ""
        : source.gstPercent,

    items: Array.isArray(source.items) ? source.items : base.items,
    technicalDetails:
      Array.isArray(source.technicalDetails) &&
      source.technicalDetails.length
        ? source.technicalDetails
        : DEFAULT_TECHNICAL_SECTIONS,
    terms: Array.isArray(source.terms) ? source.terms : base.terms,

    vendor: normalizeVendor(source.vendor),
    signatures: normalizeSignatures(source.signatures),
  };
};

// ---------------------------------------------------------------------------
// Vendor <-> backend payload mapping
// ---------------------------------------------------------------------------
const vendorToPayload = (vendor) => ({
  company_name: vendor?.companyName?.trim() || "",
  contact_person: vendor?.contactPerson?.trim() || "",
  gst_number: vendor?.gst?.trim() || "",
  address: [
    vendor?.address1,
    vendor?.address2,
    vendor?.city,
    vendor?.state,
    vendor?.pincode,
  ]
    .map((v) => (v || "").trim())
    .filter(Boolean)
    .join(", "),
  phone: vendor?.phone?.trim() || "",
  email: vendor?.email?.trim() || "",
});

const customerToVendor = (customer) => ({
  companyName: customer?.company_name || "",
  contactPerson: customer?.contact_person || "",
  gst: customer?.gst_number || "",
  address1: customer?.address || "",
  address2: "",
  city: "",
  state: "",
  pincode: "",
  phone: customer?.phone || "",
  email: customer?.email || "",
});

const vendorsAreEqual = (a, b) => {
  if (!a || !b) return false;
  const keys = [
    "companyName",
    "contactPerson",
    "gst",
    "address1",
    "address2",
    "city",
    "state",
    "pincode",
    "phone",
    "email",
  ];
  return keys.every(
    (k) => String(a[k] || "").trim() === String(b[k] || "").trim(),
  );
};

export default function QuotationForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken } = useAuth();

  // ============================================================
  // REPORT VIEW MODE
  // ============================================================
  const reportMode = location.state?.mode;
  const reportNumber = location.state?.documentNumber;

  const [numberChoice, setNumberChoice] = useState(
    reportMode === "view" && reportNumber ? null : "auto",
  );

  const [data, setData] = useState(() => {
    const initial = initialQuoteData();
    if (!initial.technicalDetails || initial.technicalDetails.length === 0) {
      initial.technicalDetails = DEFAULT_TECHNICAL_SECTIONS;
    }
    return normalizeQuoteData(initial);
  });

  const [errors, setErrors] = useState({});

  // Customers
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  // Snapshot of the currently selected customer (to detect edits)
  const [originalVendor, setOriginalVendor] = useState(null);

  // Action state
  const [customerAction, setCustomerAction] = useState(null);
  const [customerActionError, setCustomerActionError] = useState("");

  // Quotation number + submit
  const [quotationNumberLoading, setQuotationNumberLoading] = useState(false);
  const [quotationNumberError, setQuotationNumberError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ============================================================
  // BACK NAVIGATION
  // Menu -> Report -> View -> Form: Back returns to the report.
  // 1. `returnTo` (+ optional `returnState`) from the report page wins,
  //    so report context/filters are preserved.
  // 2. Otherwise go back to the previous in-app page (report or menu).
  // 3. Otherwise (form opened directly in a fresh tab) fall back to the
  //    Accounts menu instead of leaving the app.
  // ============================================================
  const handleBack = useCallback(() => {
    const returnTo = location.state?.returnTo;
    if (returnTo) {
      navigate(returnTo, { state: location.state?.returnState });
      return;
    }
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }
    navigate("/accounts");
  }, [navigate, location.state]);

  // ============================================================
  // LOAD EXISTING QUOTATION FROM ACCOUNTS REPORT
  // ============================================================
  useEffect(() => {
    const reportRecord = location.state?.reportRecord;
    const reportData = reportRecord?.document_data || reportRecord?.documentData;

    if (reportMode !== "view" || reportRecord?.type !== "Quotation" || !reportData) {
      return;
    }

    const reportCustomer = reportData.customer || {};
    const reportVendor = {
      companyName:
        reportCustomer.company_name || reportCustomer.companyName || reportCustomer.name || "",
      contactPerson:
        reportCustomer.contact_person || reportCustomer.contactPerson || "",
      gst: reportCustomer.gst_number || reportCustomer.gst || "",
      address1: reportCustomer.address || reportCustomer.address1 || "",
      address2: reportCustomer.address2 || "",
      city: reportCustomer.city || "",
      state: reportCustomer.state || "",
      pincode: reportCustomer.pincode || reportCustomer.pin_code || "",
      phone: reportCustomer.phone || "",
      email: reportCustomer.email || "",
    };

    setData((previous) =>
      normalizeQuoteData({
        ...previous,
        ...reportData,
        quotationNumber: reportRecord.document_number || reportData.quotationNumber || reportNumber || "",
        quotationDate: reportData.quotationDate || reportData.quotation_date || previous.quotationDate,
        vendor: reportVendor,
        items: Array.isArray(reportData.items) ? reportData.items : previous.items,
        technicalDetails:
          Array.isArray(reportData.technicalDetails)
            ? reportData.technicalDetails
            : Array.isArray(reportData.technical_details)
              ? reportData.technical_details
              : previous.technicalDetails,
        gstPercent: reportData.gstPercent ?? reportData.gst_percent ?? previous.gstPercent,
        companyName: reportData.companyName ?? reportData.company_name ?? previous.companyName,
        designation: reportData.designation ?? previous.designation,
        signatures: reportData.signatures ?? previous.signatures,
      }),
    );

    setNumberChoice("existing");
    setSelectedCustomerId(String(reportCustomer.id || ""));
    setOriginalVendor(reportVendor);
    setErrors({});
  }, [location.state, reportMode, reportNumber]);

  // ============================================================
  // LOAD CUSTOMERS
  // ============================================================
  const loadCustomers = useCallback(async () => {
    if (!accessToken) return [];

    try {
      setCustomersLoading(true);
      setCustomersError("");

      const response = await api.get(QUOTATION_CUSTOMERS_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const responseData = response.data;
      let customerList = [];

      if (Array.isArray(responseData)) {
        customerList = responseData;
      } else if (Array.isArray(responseData?.data)) {
        customerList = responseData.data;
      } else if (Array.isArray(responseData?.results)) {
        customerList = responseData.results;
      }

      setCustomers(customerList);
      return customerList;
    } catch (error) {
      console.error("Failed to load quotation customers:", error);
      setCustomers([]);
      setCustomersError(GENERIC_ERROR);
      return [];
    } finally {
      setCustomersLoading(false);
    }
  }, [accessToken]);

  // ============================================================
  // LOAD QUOTATION NUMBER
  // ============================================================
  const loadQuotationNumber = useCallback(async () => {
    if (!accessToken) return;

    try {
      setQuotationNumberLoading(true);
      setQuotationNumberError("");

      const response = await api.get(QUOTATION_NEXT_NUMBER_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const responseData = response.data;

      if (!responseData?.success || !responseData?.quotation_number) {
        throw new Error("bad response");
      }

      const quotationNumber = responseData.quotation_number;
      const serverData = responseData.data;

      if (serverData) {
        setData((previous) =>
          normalizeQuoteData({
            ...previous,
            quotationNumber,
            quotationDate: serverData.quotation_date || previous.quotationDate,
            subject: serverData.subject ?? previous.subject,
            intro: serverData.intro ?? previous.intro,
            items: Array.isArray(serverData.items)
              ? serverData.items
              : previous.items,
            technicalDetails:
              Array.isArray(serverData.technical_details) &&
              serverData.technical_details.length
                ? serverData.technical_details
                : previous.technicalDetails,
            terms: Array.isArray(serverData.terms)
              ? serverData.terms
              : previous.terms,
            signatures: serverData.signatures ?? previous.signatures,
            companyName: serverData.company_name ?? previous.companyName,
            designation: serverData.designation ?? previous.designation,
            gstPercent: serverData.gst_percent ?? previous.gstPercent,
          }),
        );

        if (serverData.customer) {
          const vendorFromServer = customerToVendor(serverData.customer);

          setSelectedCustomerId(String(serverData.customer.id || ""));
          setOriginalVendor(vendorFromServer);

          setData((previous) =>
            normalizeQuoteData({
              ...previous,
              vendor: vendorFromServer,
            }),
          );
        }
      } else {
        setData((previous) =>
          normalizeQuoteData({
            ...previous,
            quotationNumber,
          }),
        );
      }
    } catch (error) {
      console.error("Failed to load quotation data:", error);
      setQuotationNumberError(GENERIC_ERROR);
    } finally {
      setQuotationNumberLoading(false);
    }
  }, [accessToken]);

  // ============================================================
  // REPORT-VIEW: NUMBER CHOICE HANDLERS
  // ============================================================
  const handleUseExistingNumber = useCallback(() => {
    setNumberChoice("existing");
    setData((prev) =>
      normalizeQuoteData({ ...prev, quotationNumber: reportNumber }),
    );
    setQuotationNumberError("");
  }, [reportNumber]);

  const handleUseNewNumber = useCallback(async () => {
    setNumberChoice("new");
    if (accessToken) {
      await loadQuotationNumber();
    }
  }, [accessToken, loadQuotationNumber]);

  // ============================================================
  // BOOTSTRAP
  // ============================================================
  useEffect(() => {
    if (!accessToken) return;

    loadCustomers();

    const cameFromReportWithNumber = reportMode === "view" && !!reportNumber;

    if (cameFromReportWithNumber) {
      setData((prev) =>
        normalizeQuoteData({ ...prev, quotationNumber: reportNumber }),
      );
    } else {
      loadQuotationNumber();
    }
  }, [
    accessToken,
    loadCustomers,
    loadQuotationNumber,
    reportMode,
    reportNumber,
  ]);

  // ============================================================
  // SYNC DROPDOWN AFTER CUSTOMERS LOAD
  // ============================================================
  useEffect(() => {
    if (!customers.length) return;

    const companyName = data.vendor?.companyName?.trim() || "";
    if (!companyName) return;

    const customer = customers.find(
      (item) =>
        String(item.company_name || "")
          .trim()
          .toLowerCase() === companyName.toLowerCase(),
    );

    if (customer) {
      setSelectedCustomerId(String(customer.id));

      setOriginalVendor((prev) => (prev ? prev : customerToVendor(customer)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  // ============================================================
  // BASIC SETTERS
  // ============================================================
  const set = (key, value) => setData((d) => ({ ...d, [key]: value }));

  const setNested = (parent, key, value) => {
    setData((d) => ({
      ...d,
      [parent]: {
        ...(d[parent] || {}),
        [key]: value,
      },
    }));
  };

  // ============================================================
  // DERIVED
  // ============================================================
  const matchedCustomer = useMemo(() => {
    const name = data.vendor?.companyName?.trim().toLowerCase() || "";
    if (!name) return null;
    return (
      customers.find(
        (c) => String(c.company_name || "").trim().toLowerCase() === name,
      ) || null
    );
  }, [customers, data.vendor?.companyName]);

  const vendorIsModified = useMemo(() => {
    if (!originalVendor) return false;
    return !vendorsAreEqual(data.vendor, originalVendor);
  }, [originalVendor, data.vendor]);

  const availableAction = useMemo(() => {
    const hasName = !!data.vendor?.companyName?.trim();

    if (selectedCustomerId && originalVendor && vendorIsModified) {
      return "update";
    }

    if (!matchedCustomer && hasName) {
      return "create";
    }

    return null;
  }, [
    selectedCustomerId,
    originalVendor,
    vendorIsModified,
    matchedCustomer,
    data.vendor?.companyName,
  ]);

  // ============================================================
  // CUSTOMER SELECTION
  // ============================================================
  const handleCustomerChange = useCallback(
    (customerId) => {
      setSelectedCustomerId(customerId);
      setCustomerActionError("");

      if (!customerId) {
        setOriginalVendor(null);
        setData((previous) =>
          normalizeQuoteData({
            ...previous,
            vendor: EMPTY_VENDOR,
          }),
        );

        setErrors((previous) => {
          const next = { ...previous };
          delete next.vendorCompany;
          return next;
        });
        return;
      }

      const customer = customers.find(
        (item) => String(item.id) === String(customerId),
      );
      if (!customer) return;

      const vendorFromCustomer = customerToVendor(customer);
      setOriginalVendor(vendorFromCustomer);

      setData((previous) =>
        normalizeQuoteData({
          ...previous,
          vendor: vendorFromCustomer,
        }),
      );

      setErrors((previous) => {
        const next = { ...previous };
        delete next.vendorCompany;
        return next;
      });
    },
    [customers],
  );

  // ============================================================
  // CREATE CUSTOMER
  // ============================================================
  const handleCreateCustomer = useCallback(async () => {
    if (!accessToken) {
      setCustomerActionError("Your session has expired. Please login again.");
      return;
    }

    const vendor = data.vendor || {};
    const companyName = vendor.companyName?.trim() || "";

    if (!companyName) {
      setCustomerActionError("Enter the customer/company name first.");
      return;
    }

    const alreadyExists = customers.some(
      (c) =>
        String(c.company_name || "").trim().toLowerCase() ===
        companyName.toLowerCase(),
    );

    if (alreadyExists) {
      setCustomerActionError(
        "This customer already exists. Please select it from the dropdown.",
      );
      return;
    }

    try {
      setCustomerAction("create");
      setCustomerActionError("");

      const response = await api.post(
        QUOTATION_CUSTOMERS_ENDPOINT,
        vendorToPayload(vendor),
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      const responseData = response.data;

      if (!responseData?.success || !responseData?.data) {
        throw new Error("bad response");
      }

      const newCustomer = responseData.data;

      setCustomers((previous) => [...previous, newCustomer]);
      setSelectedCustomerId(String(newCustomer.id));

      const vendorFromCustomer = customerToVendor(newCustomer);
      setOriginalVendor(vendorFromCustomer);

      setData((previous) =>
        normalizeQuoteData({
          ...previous,
          vendor: vendorFromCustomer,
        }),
      );
    } catch (error) {
      console.error("Failed to create quotation customer:", error);
      setCustomerActionError(GENERIC_ERROR);
    } finally {
      setCustomerAction(null);
    }
  }, [accessToken, customers, data.vendor]);

  // ============================================================
  // UPDATE CUSTOMER
  // ============================================================
  const handleUpdateCustomer = useCallback(async () => {
    if (!accessToken) {
      setCustomerActionError("Your session has expired. Please login again.");
      return;
    }

    if (!selectedCustomerId) {
      setCustomerActionError("Select a customer before updating.");
      return;
    }

    const vendor = data.vendor || {};
    const companyName = vendor.companyName?.trim() || "";

    if (!companyName) {
      setCustomerActionError("Customer company name is required.");
      return;
    }

    const nameClash = customers.some(
      (c) =>
        String(c.id) !== String(selectedCustomerId) &&
        String(c.company_name || "").trim().toLowerCase() ===
          companyName.toLowerCase(),
    );

    if (nameClash) {
      setCustomerActionError(
        "Another customer already uses that company name.",
      );
      return;
    }

    try {
      setCustomerAction("update");
      setCustomerActionError("");

      const response = await api.patch(
        `${QUOTATION_CUSTOMERS_ENDPOINT}${selectedCustomerId}/`,
        vendorToPayload(vendor),
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      const responseData = response.data;

      if (!responseData?.success || !responseData?.data) {
        throw new Error("bad response");
      }

      const updatedCustomer = responseData.data;

      setCustomers((previous) =>
        previous.map((c) =>
          String(c.id) === String(updatedCustomer.id) ? updatedCustomer : c,
        ),
      );

      const vendorFromCustomer = customerToVendor(updatedCustomer);
      setOriginalVendor(vendorFromCustomer);

      setData((previous) =>
        normalizeQuoteData({
          ...previous,
          vendor: vendorFromCustomer,
        }),
      );
    } catch (error) {
      console.error("Failed to update quotation customer:", error);
      setCustomerActionError(GENERIC_ERROR);
    } finally {
      setCustomerAction(null);
    }
  }, [accessToken, customers, data.vendor, selectedCustomerId]);

  // ============================================================
  // RESET VENDOR
  // ============================================================
  const handleResetVendor = useCallback(() => {
    if (!originalVendor) return;
    setCustomerActionError("");
    setData((previous) =>
      normalizeQuoteData({
        ...previous,
        vendor: originalVendor,
      }),
    );
  }, [originalVendor]);

  // ============================================================
  // AMOUNT CALCULATIONS
  // ============================================================
  const quotationSubtotal = data.items.reduce((total, item) => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    return total + qty * rate;
  }, 0);

  const quotationGstPercent = Number(data.gstPercent) || 0;
  const quotationGstAmount = (quotationSubtotal * quotationGstPercent) / 100;
  const quotationFinalTotal = quotationSubtotal + quotationGstAmount;

  // ============================================================
  // VALIDATION
  // ============================================================
  const validate = () => {
    const next = {};

    if (!data.quotationNumber?.trim()) {
      next.quotationNumber = "Quotation number is still loading.";
    }

    if (!data.quotationDate) {
      next.quotationDate = "Quotation Date is required";
    }

    const customerName = data.vendor?.companyName?.trim() || "";

    if (!customerName) {
      next.vendorCompany = "Customer company name is required";
    }

    const hasItem = data.items.some(
      (it) => it.description?.trim() && Number(it.qty) > 0,
    );

    if (!hasItem) {
      next.items = "Add at least one item with a description and quantity";
    }

    const gst = Number(data.gstPercent || 0);

    if (!Number.isFinite(gst) || gst < 0) {
      next.gstPercent = "GST percentage cannot be negative.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // ============================================================
  // CLEAR FORM
  // Keeps Quotation Number and Customer details,
  // resets everything else.
  // ============================================================
  const clearForm = async () => {
    if (
      !window.confirm(
        "Clear all fields? The Quotation Number and Customer details will be kept.",
      )
    )
      return;

    // Snapshot the fields that must survive the reset.
    const preservedQuotationNumber = data.quotationNumber;
    const preservedVendor = data.vendor;
    const preservedSelectedCustomerId = selectedCustomerId;
    const preservedOriginalVendor = originalVendor;

    // Build a fresh quotation, then restore the preserved fields.
    const fresh = normalizeQuoteData(initialQuoteData());
    setData({
      ...fresh,
      quotationNumber: preservedQuotationNumber,
      vendor: preservedVendor,
    });

    setErrors({});
    setCustomerActionError("");
    setSubmitError("");
    setQuotationNumberError("");
    setNumberChoice("auto");

    // Restore customer selection state (do NOT re-load quotation number).
    setSelectedCustomerId(preservedSelectedCustomerId);
    setOriginalVendor(preservedOriginalVendor);

    // NOTE: intentionally do NOT call loadQuotationNumber() here,
    // because that endpoint returns the previous quotation's data
    // and would re-populate the fields we just cleared.
  };

  // ============================================================
  // SAVE QUOTATION TO BACKEND
  // ============================================================
  const saveQuotationToBackend = async () => {
    if (!accessToken) {
      setSubmitError("Your session has expired. Please login again.");
      return null;
    }

    const customerName = data.vendor?.companyName?.trim() || "";

    const payload = {
      quotation_number: data.quotationNumber,
      quotation_date: data.quotationDate,
      customer: customerName,
      subject: data.subject || "",
      intro: data.intro || "",
      items: data.items || [],
      technical_details: data.technicalDetails || [],
      terms: data.terms || [],
      signatures: data.signatures || {},
      company_name: data.companyName || "",
      designation: data.designation || "",
      gst_percent: Number(data.gstPercent) || 0,
      // Keep the status of an existing quotation; nothing is sent for new ones.
      ...(data.status ? { status: data.status } : {}),
    };

    try {
      setSubmitting(true);
      setSubmitError("");

      const response = await api.post(QUOTATION_SAVE_ENDPOINT, payload, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.data?.success) {
        throw new Error("bad response");
      }

      const savedQuotation = response.data?.data;

      if (!savedQuotation) {
        throw new Error("bad response");
      }

      return savedQuotation;
    } catch (error) {
      console.error("Quotation creation failed:", error);
      setSubmitError(GENERIC_ERROR);
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // GO TO PREVIEW
  // ============================================================
  const goToPreview = async () => {
    if (submitting) return;
    setSubmitError("");

    if (!validate()) return;

    const savedQuotation = await saveQuotationToBackend();
    if (!savedQuotation) return;

    const previewData = normalizeQuoteData({
      ...data,
      quotationNumber:
        savedQuotation.quotation_number || data.quotationNumber,
      quotationDate: savedQuotation.quotation_date || data.quotationDate,
    });

    setData(previewData);

    try {
      await loadQuotationPrintEngine();
      window.generateQuotationPrint(previewData, {
        subtotal: quotationSubtotal,
        gstPercent: quotationGstPercent,
        gstAmount: quotationGstAmount,
        grandTotal: quotationFinalTotal,
      });
    } catch (err) {
      console.error(err);
      setSubmitError(
        "Quotation was saved successfully, but the print preview could not be loaded.",
      );
    }
  };

  // ============================================================
  // TECHNICAL DETAILS HELPERS
  // ============================================================
  const addSection = () => {
    set("technicalDetails", [
      ...data.technicalDetails,
      { heading: "", points: [""] },
    ]);
  };

  const updateSectionHeading = (idx, heading) => {
    const next = [...data.technicalDetails];
    next[idx] = { ...next[idx], heading };
    set("technicalDetails", next);
  };

  const removeSection = (idx) => {
    if (data.technicalDetails.length <= 1) {
      alert("At least one technical section is required.");
      return;
    }
    set(
      "technicalDetails",
      data.technicalDetails.filter((_, i) => i !== idx),
    );
  };

  const addPoint = (idx) => {
    const next = [...data.technicalDetails];
    next[idx] = { ...next[idx], points: [...next[idx].points, ""] };
    set("technicalDetails", next);
  };

  const updatePoint = (secIdx, pointIdx, value) => {
    const next = [...data.technicalDetails];
    const points = [...next[secIdx].points];
    points[pointIdx] = value;
    next[secIdx] = { ...next[secIdx], points };
    set("technicalDetails", next);
  };

  const removePoint = (secIdx, pointIdx) => {
    const next = [...data.technicalDetails];
    const points = next[secIdx].points;
    if (points.length <= 1) {
      alert("At least one point is required per section.");
      return;
    }
    next[secIdx] = {
      ...next[secIdx],
      points: points.filter((_, i) => i !== pointIdx),
    };
    set("technicalDetails", next);
  };

  const resetToDefaultTechnical = () => {
    if (!window.confirm("Reset technical details to default template?")) return;
    set("technicalDetails", DEFAULT_TECHNICAL_SECTIONS);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <Header />
      <div className="form-page">
        <div className="form-header">
          <button
            type="button"
            className="erp-back-button"
            onClick={handleBack}
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <h2>Quotation</h2>

          {/* Spacer keeps the title centred between Back and the right edge */}
          <div className="form-header-actions" />
        </div>

        {/* TOP ACTIONS */}
        <div className="form-actions-top">
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={clearForm}
          >
            Clear
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={goToPreview}
            disabled={
              submitting || quotationNumberLoading || !data.quotationNumber
            }
            style={{ marginLeft: "auto" }}
          >
            {submitting ? "Saving..." : "Preview →"}
          </button>
        </div>

        {/* ---------- NUMBER CHOICE BANNER ---------- */}
        {reportMode === "view" && reportNumber && numberChoice === null && (
          <div className="qt-alert">
            <div className="qt-alert__icon">?</div>
            <div className="qt-alert__content">
              <strong>This Quotation already exists: {reportNumber}</strong>
              <span>
                Do you want to edit the existing quotation (same number), or
                create a new one with the next number in the sequence?
              </span>

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleUseExistingNumber}
                >
                  Use this number (edit)
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleUseNewNumber}
                >
                  New number
                </button>
              </div>
            </div>
          </div>
        )}

        {reportMode === "view" && numberChoice === "existing" && (
          <div className="qt-alert">
            <div className="qt-alert__icon">i</div>
            <div className="qt-alert__content">
              <strong>Editing existing quotation {reportNumber}</strong>
              <span>
                When you click Preview, the backend will not consume a new
                number.
              </span>
            </div>
          </div>
        )}

        {reportMode === "view" && numberChoice === "new" && (
          <div className="qt-alert">
            <div className="qt-alert__icon">i</div>
            <div className="qt-alert__content">
              <strong>
                Creating a new quotation: {data.quotationNumber || "Loading..."}
              </strong>
              <span>
                A fresh number from the current sequence will be used.
              </span>
            </div>
          </div>
        )}

        {Object.keys(errors).length > 0 && (
          <div className="qt-alert">
            <div className="qt-alert__icon">!</div>
            <div className="qt-alert__content">
              <strong>Validation Required</strong>
              <span>
                Please fix the highlighted fields before previewing:{" "}
                {Object.values(errors).join(" · ")}
              </span>
            </div>
          </div>
        )}

        {(submitError || quotationNumberError) && (
          <div className="qt-alert">
            <div className="qt-alert__icon">!</div>
            <div className="qt-alert__content">
              <strong>Quotation API Error</strong>
              <span>{submitError || quotationNumberError}</span>
            </div>

            {quotationNumberError && !quotationNumberLoading && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={loadQuotationNumber}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* 01 QUOTATION DETAILS */}
        <section className="form-section">
          <h3 className="form-section-title">Quotation Details</h3>

          <div className="form-grid">
            <label className="form-group">
              <span className="form-label">
                Quotation Number
                <span className="form-required">*</span>
              </span>
              <input
                className={`form-input ${
                  errors.quotationNumber ? "form-input-error" : ""
                }`}
                value={
                  data.quotationNumber ||
                  (quotationNumberLoading ? "Loading..." : "")
                }
                readOnly
              />
            </label>

            <label className="form-group">
              <span className="form-label">
                Quotation Date
                <span className="form-required">*</span>
              </span>
              <input
                type="date"
                className={`form-input ${
                  errors.quotationDate ? "form-input-error" : ""
                }`}
                value={data.quotationDate || ""}
                onChange={(e) => set("quotationDate", e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* 02 CUSTOMER DETAILS */}
        <section className="form-section">
          <h3 className="form-section-title">Customer Details</h3>

          {customersLoading && (
            <div className="qt-customer-loading">
              <Loading />
            </div>
          )}

          {!customersLoading && customersError && (
            <div className="qt-customer-error">
              <ErrorState onRetry={loadCustomers} />
            </div>
          )}

          {!customersLoading && !customersError && (
            <>
              {customers.length > 0 && (
                <div className="form-grid">
                  <label className="form-group form-group-wide">
                    <span className="form-label">
                      Select Existing Customer
                    </span>

                    <select
                      className="form-input"
                      value={selectedCustomerId}
                      onChange={(e) => handleCustomerChange(e.target.value)}
                    >
                      <option value="">Select Customer</option>

                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.company_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {customers.length === 0 && (
                <div className="qt-customer-empty">
                  No saved customers. You can enter customer details manually
                  below.
                </div>
              )}

              <VendorDetails
                mode="form"
                vendor={data.vendor}
                onChange={(value) =>
                  setData((d) => normalizeQuoteData({ ...d, vendor: value }))
                }
                heading=""
              />

              <div
                className={`qt-customer-actions ${
                  availableAction === "update" ? "qt-customer-modified" : ""
                }`}
              >
                <div className="qt-customer-actions__info">
                  {availableAction === "update" && (
                    <>
                      <strong>Customer details changed</strong>
                      <span>
                        Save changes to the master customer record, or reset
                        to the saved values.
                      </span>
                    </>
                  )}

                  {availableAction === "create" && (
                    <>
                      <strong>New customer</strong>
                      <span>
                        No matching customer exists. Create it to reuse in
                        future quotations.
                      </span>
                    </>
                  )}

                  {availableAction === null && (
                    <>
                      <strong>
                        {selectedCustomerId
                          ? "Customer selected"
                          : "No customer selected"}
                      </strong>
                      <span>
                        {selectedCustomerId
                          ? "Saved values match the customer record."
                          : "Pick a customer from the dropdown or type a new one."}
                      </span>
                    </>
                  )}
                </div>

                <div className="qt-customer-actions__buttons">
                  {availableAction === "update" && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleResetVendor}
                        disabled={customerAction === "update"}
                      >
                        Reset
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleUpdateCustomer}
                        disabled={customerAction === "update"}
                      >
                        {customerAction === "update"
                          ? "Updating..."
                          : "Update Customer"}
                      </button>
                    </>
                  )}

                  {availableAction === "create" && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleCreateCustomer}
                      disabled={customerAction === "create"}
                    >
                      {customerAction === "create"
                        ? "Creating..."
                        : "Create Customer"}
                    </button>
                  )}
                </div>
              </div>

              {customerActionError && (
                <div className="qt-customer-action-error">
                  {customerActionError}
                </div>
              )}
            </>
          )}
        </section>

        {/* 03 INTRODUCTION */}
        <section className="form-section">
          <h3 className="form-section-title">Introduction</h3>

          <label className="form-group form-group-wide">
            <span className="form-label">Subject</span>
            <input
              type="text"
              className="form-input"
              value={data.subject ?? ""}
              onChange={(e) => set("subject", e.target.value)}
              placeholder="Enter quotation subject..."
            />
          </label>

          <label className="form-group form-group-wide">
            <span className="form-label">Intro Paragraph</span>
            <textarea
              className="form-textarea"
              rows={5}
              value={data.intro ?? ""}
              onChange={(e) => set("intro", e.target.value)}
              placeholder="Enter introduction..."
            />
          </label>
        </section>

        {/* 04 QUOTATION ITEMS */}
        <section className="form-section">
          <h3 className="form-section-title">Quotation Items</h3>

          <OrderItemsTable
            variant="quote"
            mode="form"
            items={data.items}
            onChange={(items) => set("items", items)}
          />
        </section>

        {/* 05 AMOUNT SUMMARY */}
        <section className="form-section">
          <h3 className="form-section-title">Amount Summary</h3>

          <div className="form-grid">
            <label className="form-group">
              <span className="form-label">Total Amount (₹)</span>
              <input
                type="number"
                className="form-input"
                value={quotationSubtotal.toFixed(2)}
                readOnly
              />
            </label>

            <label className="form-group">
              <span className="form-label">GST %</span>
              <input
                type="number"
                className="form-input"
                value={data.gstPercent ?? ""}
                onChange={(e) => set("gstPercent", e.target.value)}
                placeholder="18"
                min="0"
              />
            </label>

            <label className="form-group">
              <span className="form-label">GST Amount (₹)</span>
              <input
                type="number"
                className="form-input"
                value={quotationGstAmount.toFixed(2)}
                readOnly
              />
            </label>

            <label className="form-group">
              <span className="form-label">Final Total (₹)</span>
              <input
                type="number"
                className="form-input"
                value={quotationFinalTotal.toFixed(2)}
                readOnly
              />
            </label>
          </div>
        </section>

        {/* 06 TECHNICAL DETAILS */}
        <section className="form-section">
          <div className="form-section-head">
            <h3 className="form-section-title">Technical Details</h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={resetToDefaultTechnical}
            >
              ↻ Reset to Default
            </button>
          </div>

          {data.technicalDetails.map((sec, secIdx) => (
            <div key={secIdx} className="form-tech-card">
              <div className="form-tech-header">
                <label className="form-group form-field-grow">
                  <span className="form-label">Section Heading</span>
                  <input
                    className="form-input form-input-bold"
                    value={sec.heading ?? ""}
                    onChange={(e) =>
                      updateSectionHeading(secIdx, e.target.value)
                    }
                    placeholder="Section Heading"
                  />
                </label>

                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => removeSection(secIdx)}
                >
                  Remove Section
                </button>
              </div>

              <div className="form-tech-points">
                {sec.points.map((pt, ptIdx) => (
                  <div key={ptIdx} className="form-tech-point">
                    <span className="form-tech-index">{ptIdx + 1}</span>
                    <input
                      className="form-input"
                      value={pt ?? ""}
                      onChange={(e) =>
                        updatePoint(secIdx, ptIdx, e.target.value)
                      }
                      placeholder="Enter point"
                    />
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removePoint(secIdx, ptIdx)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => addPoint(secIdx)}
              >
                + Add Point
              </button>
            </div>
          ))}

          <button type="button" className="btn btn-secondary" onClick={addSection}>
            + Add Section
          </button>
        </section>

        {/* 07 TERMS */}
        <section className="form-section">
          <h3 className="form-section-title">Terms & Conditions</h3>

          <TermsEditor
            mode="form"
            terms={data.terms}
            onChange={(terms) => set("terms", terms)}
          />
        </section>

        {/* 08 SIGNATURE */}
        <section className="form-section">
          <h3 className="form-section-title">Signature Details</h3>

          <div className="form-grid">
            <label className="form-group">
              <span className="form-label">Prepared By</span>
              <input
                className="form-input"
                value={data.signatures?.preparedBy ?? ""}
                onChange={(e) =>
                  setNested("signatures", "preparedBy", e.target.value)
                }
              />
            </label>

            <label className="form-group">
              <span className="form-label">Company Name</span>
              <input
                className="form-input"
                value={data.companyName ?? ""}
                onChange={(e) => set("companyName", e.target.value)}
              />
            </label>

            <label className="form-group">
              <span className="form-label">Designation</span>
              <input
                className="form-input"
                value={data.designation ?? ""}
                onChange={(e) => set("designation", e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* FOOTER */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={goToPreview}
            disabled={
              submitting || quotationNumberLoading || !data.quotationNumber
            }
          >
            {submitting ? "Saving..." : "Preview →"}
          </button>
        </div>
      </div>
    </>
  );
}