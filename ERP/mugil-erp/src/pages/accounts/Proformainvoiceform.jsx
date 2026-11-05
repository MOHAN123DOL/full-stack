import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./ProformaInvoiceForm.css";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../../components/Header";
import Loading from "../../components/loading";
// Renamed from `Error` so it no longer shadows the global Error constructor
// (this file uses `new Error(...)`).
import ErrorState from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

/* ============================================================
   ENDPOINTS
   ============================================================ */

const PI_CUSTOMERS_ENDPOINT = "/erp/proforma-invoice-customers/";
const PI_NEXT_NUMBER_ENDPOINT = "/erp/proforma-invoices/next-number/";
const PI_SAVE_ENDPOINT = "/erp/proforma-invoices/";
const PI_DETAIL_ENDPOINT = "/erp/proforma-invoices/";
const COMPANY_BANK_DETAILS_ENDPOINT = "/erp/company-bank-details/";

/* Single generic error message for every failure. */
const GENERIC_ERROR = "Something went wrong. Please try again.";

/* ============================================================
   PRINT ENGINE LOADER
   ============================================================ */

let proformaInvoicePrintEnginePromise = null;
function loadProformaInvoicePrintEngine() {
  if (typeof window.generateProformaInvoicePrint === "function") {
    return Promise.resolve();
  }
  if (proformaInvoicePrintEnginePromise)
    return proformaInvoicePrintEnginePromise;

  proformaInvoicePrintEnginePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-proforma-invoice-print-engine="true"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("ProformaInvoicePrint.js failed to load")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "/ProformaInvoicePrint.js";
    script.async = true;
    script.dataset.proformaInvoicePrintEngine = "true";
    script.onload = () => resolve();
    script.onerror = () => {
      proformaInvoicePrintEnginePromise = null;
      reject(new Error("ProformaInvoicePrint.js failed to load"));
    };
    document.head.appendChild(script);
  });

  return proformaInvoicePrintEnginePromise;
}

/* ============================================================
   CONSTANTS
   ============================================================ */

const COMPANY = {
  name: "MUGIL ENGINEERING INDUSTRY",
  worksLine1: "Works : 2/89. SF No 105, Thanjavur Main Road,",
  worksLine2: "Devarayaneri, Assoor Post, Trichy - 620 015.",
  gstin: "33AHDPR8644K1ZX",
  ssiNo: "18.13.18257 dt 31.01.2001",
  cell1: "98424-52887",
  cell2: "89039-52887",
  pan: "AHDPR8644K",
};

const COMPANY_ADDRESSES = [
  {
    id: "unit1",
    label: "Unit 1",
    address:
      "4/211, S.F. No.105, Thanjavur Main Road, Devarayanery, Assor (P.O.), Trichy - 620 015",
  },
  {
    id: "unit2",
    label: "Unit 2",
    address:
      "S.F. No: 436 / 5A, Near B K Bharath Township, Thanjavur Main Road, Valavanthankottai, Trichy - 620015",
  },
];

const EMPTY_PARTY = {
  companyName: "",
  gst: "",
  address: "",
  state: "",
  stateCode: "",
  phone: "",
  email: "",
};

const emptyPartyDetails = () => ({ ...EMPTY_PARTY });

const emptyItem = () => ({
  id: Date.now() + Math.random(),
  description: "",
  hsn: "",
  quantity: "",
  unit: "",
  rate: "",
});

const defaultFormData = {
  proformaNo: "",
  date: "",
  validUntil: "",
  paymentTerms: "50% Advance, Balance Before Dispatch",

  referenceNo: "",
  customerPoNo: "",
  poDate: "",
  placeOfSupply: "",

  receiverGst: "",
  consigneeGst: "",

  receiverDetails: emptyPartyDetails(),
  consigneeDetails: emptyPartyDetails(),

  receiverAddressOptionId: "",
  consigneeAddressOptionId: "",

  companyAddressId: "unit1",

  cgstPct: 9,
  sgstPct: 9,
  igstPct: 0,
  roundedOff: 0,

  // Loaded from GET /erp/company-bank-details/ on component mount.
  bankName: "",
  accountNumber: "",
  branch: "",
  ifsc: "",

  declaration:
    "This Proforma Invoice is issued for the purpose of order confirmation and advance payment only. It does not constitute a demand for payment under GST law and holds no value as a Tax Invoice for input credit purposes.",

  enclosureText:
    "This is a Proforma Invoice, not a demand for payment or a Tax Invoice.\n" +
    "Prices are valid until the date mentioned above.\n" +
    "GST will be charged as applicable at the time of actual supply.\n" +
    "Delivery: 3–4 weeks from receipt of confirmed order & advance.\n" +
    "Goods once dispatched will not be taken back.",
};

/* ============================================================
   HELPERS
   ============================================================ */

function numberToWordsIndian(num) {
  num = Math.round(num || 0);
  if (num === 0) return "Zero";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const twoDigits = (n) => {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  };

  const threeDigits = (n) => {
    if (n < 100) return twoDigits(n);
    return (
      ones[Math.floor(n / 100)] +
      " Hundred" +
      (n % 100 ? " and " + twoDigits(n % 100) : "")
    );
  };

  let result = "";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = num;

  if (crore) result += threeDigits(crore) + " Crore ";
  if (lakh) result += threeDigits(lakh) + " Lakh ";
  if (thousand) result += threeDigits(thousand) + " Thousand ";
  if (hundred) result += threeDigits(hundred);

  return result.trim();
}

const round2 = (value) => {
  const n = Number(value);
  if (!isFinite(n)) return 0;
  return Number(n.toFixed(2));
};

const backendToParty = (customer) => ({
  companyName: customer?.company_name || "",
  gst: customer?.gst_number || "",
  address: customer?.address || "",
  state: customer?.state || "",
  stateCode: customer?.state_code || "",
  phone: customer?.phone || "",
  email: customer?.email || "",
});

const partyToBackend = (party) => ({
  company_name: party?.companyName?.trim() || "",
  address: party?.address?.trim() || "",
  contact_person: "",
  phone: party?.phone?.trim() || "",
  gst_number: party?.gst?.trim() || "",
  email: party?.email?.trim() || "",
  state: party?.state?.trim() || "",
  state_code: party?.stateCode?.trim() || "",
});

const partiesAreEqual = (a, b) => {
  if (!a || !b) return false;
  const keys = [
    "companyName",
    "gst",
    "address",
    "state",
    "stateCode",
    "phone",
    "email",
  ];
  return keys.every(
    (k) => String(a[k] || "").trim() === String(b[k] || "").trim(),
  );
};

/* ============================================================
   COMPONENT
   ============================================================ */

export default function ProformaInvoiceForm() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // ============================================================
  // REPORT VIEW MODE
  // ============================================================
  const reportMode = location.state?.mode;
  const reportNumber = location.state?.documentNumber;

  const [numberChoice, setNumberChoice] = useState(
    reportMode === "view" && reportNumber ? "existing" : "auto",
  );

  const [formData, setFormData] = useState(defaultFormData);
  const [items, setItems] = useState([emptyItem()]);
  const [saveStatus, setSaveStatus] = useState("");

  /* Customer selection state */
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");

  const [selectedReceiverId, setSelectedReceiverId] = useState("");
  const [selectedConsigneeId, setSelectedConsigneeId] = useState("");

  const [originalReceiver, setOriginalReceiver] = useState(null);
  const [originalConsignee, setOriginalConsignee] = useState(null);

  const [receiverAction, setReceiverAction] = useState(null);
  const [receiverActionError, setReceiverActionError] = useState("");
  const [consigneeAction, setConsigneeAction] = useState(null);
  const [consigneeActionError, setConsigneeActionError] = useState("");

  /* Proforma number + submit */
  const [proformaNumberLoading, setProformaNumberLoading] = useState(false);
  const [proformaNumberError, setProformaNumberError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  /* ============================================================
     BACK NAVIGATION
     ------------------------------------------------------------
     Menu -> Report -> View -> Form: Back returns to the report.
     1. If the report page passes `returnTo` (and optionally
        `returnState`) in the router state, go exactly there so the
        report context/filters are preserved.
     2. Otherwise, if there is an in-app history entry, go back to it
        (the report page when opened via View, or the menu page).
     3. Otherwise (form opened directly in a fresh tab) fall back to
        the Accounts menu instead of leaving the app.
     ============================================================ */
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

  /* ============================================================
     LOAD COMPANY BANK DETAILS (READ-ONLY)
     ============================================================ */
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(COMPANY_BANK_DETAILS_ENDPOINT, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (cancelled) return;

        const data = response.data?.data ?? response.data ?? {};

        setFormData((prev) => ({
          ...prev,
          bankName: data.bank_name ?? prev.bankName,
          accountNumber: data.account_number ?? prev.accountNumber,
          branch: data.branch ?? prev.branch,
          ifsc: data.ifsc ?? prev.ifsc,
        }));
      } catch (err) {
        console.error("Failed to load company bank details:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  /* ============================================================
     LOAD CUSTOMERS
     ============================================================ */
  const loadCustomers = useCallback(async () => {
    if (!accessToken) return [];

    try {
      setCustomersLoading(true);
      setCustomersError("");

      const response = await api.get(PI_CUSTOMERS_ENDPOINT, {
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
      console.error("Failed to load proforma invoice customers:", error);
      setCustomers([]);
      setCustomersError(GENERIC_ERROR);
      return [];
    } finally {
      setCustomersLoading(false);
    }
  }, [accessToken]);

  /* ============================================================
     LOAD NEXT PROFORMA NUMBER
     ============================================================ */
  const loadProformaNumber = useCallback(async () => {
    if (!accessToken) return;

    try {
      setProformaNumberLoading(true);
      setProformaNumberError("");

      const response = await api.get(PI_NEXT_NUMBER_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const responseData = response.data;

      if (!responseData?.success || !responseData?.proforma_no) {
        throw new Error("bad response");
      }

      const proformaNo = responseData.proforma_no;
      const serverData = responseData.data;

      if (serverData) {
        setFormData((prev) => ({
          ...prev,
          proformaNo,

          date: serverData.date || prev.date,
          validUntil: serverData.valid_until || prev.validUntil,
          paymentTerms: serverData.payment_terms ?? prev.paymentTerms,

          referenceNo: serverData.reference_no ?? prev.referenceNo,
          customerPoNo: serverData.customer_po_no ?? prev.customerPoNo,
          poDate: serverData.po_date ?? prev.poDate,
          placeOfSupply: serverData.place_of_supply ?? prev.placeOfSupply,

          receiverGst: serverData.receiver_gst ?? prev.receiverGst,
          consigneeGst: serverData.consignee_gst ?? prev.consigneeGst,
          receiverDetails: serverData.receiver_details
            ? { ...EMPTY_PARTY, ...serverData.receiver_details }
            : prev.receiverDetails,
          consigneeDetails: serverData.consignee_details
            ? { ...EMPTY_PARTY, ...serverData.consignee_details }
            : prev.consigneeDetails,

          receiverAddressOptionId:
            serverData.receiver_address_option_id ??
            prev.receiverAddressOptionId,
          consigneeAddressOptionId:
            serverData.consignee_address_option_id ??
            prev.consigneeAddressOptionId,

          companyAddressId:
            serverData.company_address_id ?? prev.companyAddressId,

          cgstPct: serverData.cgst_percent ?? prev.cgstPct,
          sgstPct: serverData.sgst_percent ?? prev.sgstPct,
          igstPct: serverData.igst_percent ?? prev.igstPct,
          roundedOff: serverData.rounded_off ?? prev.roundedOff,

          // Bank details always come from the backend .env GET endpoint,
          // not from previously saved invoice data.

          declaration: serverData.declaration ?? prev.declaration,
          enclosureText: serverData.enclosure_text ?? prev.enclosureText,
        }));

        if (Array.isArray(serverData.items) && serverData.items.length) {
          setItems(serverData.items);
        }
      } else {
        setFormData((prev) => ({ ...prev, proformaNo }));
      }
    } catch (error) {
      console.error("Failed to load proforma number:", error);
      setProformaNumberError(GENERIC_ERROR);
    } finally {
      setProformaNumberLoading(false);
    }
  }, [accessToken]);

  /* ============================================================
     LOAD EXISTING PROFORMA FROM ACCOUNTS REPORTS
     ============================================================ */
  const loadExistingProforma = useCallback(
    async (proformaNo, customerList = []) => {
      if (!accessToken || !proformaNo) return;

      try {
        setProformaNumberLoading(true);
        setProformaNumberError("");

        const response = await api.get(
          `${PI_DETAIL_ENDPOINT}${encodeURIComponent(proformaNo)}/`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );

        const responseData = response.data?.data ?? response.data;
        if (!responseData || response.data?.success === false) {
          throw new Error("Proforma invoice not found");
        }

        const receiver = {
          ...EMPTY_PARTY,
          ...(responseData.receiver_details || {}),
        };
        const consignee = {
          ...EMPTY_PARTY,
          ...(responseData.consignee_details || {}),
        };

        // Match saved receiver/consignee against the customer master so the
        // dropdowns and customer actions show the correct selection.
        const receiverCustomer = customerList.find(
          (customer) =>
            String(customer.company_name || "")
              .trim()
              .toLowerCase() ===
            String(receiver.companyName || "")
              .trim()
              .toLowerCase(),
        );
        const consigneeCustomer = customerList.find(
          (customer) =>
            String(customer.company_name || "")
              .trim()
              .toLowerCase() ===
            String(consignee.companyName || "")
              .trim()
              .toLowerCase(),
        );

        setSelectedReceiverId(
          receiverCustomer ? String(receiverCustomer.id) : "",
        );
        setSelectedConsigneeId(
          consigneeCustomer ? String(consigneeCustomer.id) : "",
        );
        setOriginalReceiver(
          receiverCustomer ? backendToParty(receiverCustomer) : null,
        );
        setOriginalConsignee(
          consigneeCustomer ? backendToParty(consigneeCustomer) : null,
        );

        setFormData((prev) => ({
          ...prev,
          proformaNo: responseData.proforma_no || proformaNo,
          date: responseData.date || "",
          validUntil: responseData.valid_until || "",
          paymentTerms: responseData.payment_terms ?? "",
          referenceNo: responseData.reference_no ?? "",
          customerPoNo: responseData.customer_po_no ?? "",
          poDate: responseData.po_date || "",
          placeOfSupply: responseData.place_of_supply ?? "",
          receiverGst: responseData.receiver_gst ?? receiver.gst ?? "",
          consigneeGst: responseData.consignee_gst ?? consignee.gst ?? "",
          receiverDetails: receiver,
          consigneeDetails: consignee,
          receiverAddressOptionId:
            responseData.receiver_address_option_id ?? "",
          consigneeAddressOptionId:
            responseData.consignee_address_option_id ?? "",
          companyAddressId: responseData.company_address_id ?? "unit1",
          cgstPct: responseData.cgst_percent ?? 0,
          sgstPct: responseData.sgst_percent ?? 0,
          igstPct: responseData.igst_percent ?? 0,
          roundedOff: responseData.rounded_off ?? 0,
          // Bank details are loaded from the dedicated company-bank endpoint.
          declaration: responseData.declaration ?? "",
          enclosureText: responseData.enclosure_text ?? "",
        }));

        setItems(
          Array.isArray(responseData.items) && responseData.items.length
            ? responseData.items.map((item, index) => ({
                ...item,
                id: item.id ?? `${Date.now()}-${index}`,
              }))
            : [emptyItem()],
        );
        setNumberChoice("existing");
      } catch (error) {
        console.error("Failed to load existing proforma invoice:", error);
        setProformaNumberError(
          error.response?.status === 404
            ? "Proforma invoice not found."
            : GENERIC_ERROR,
        );
      } finally {
        setProformaNumberLoading(false);
      }
    },
    [accessToken],
  );

  /* ============================================================
     REPORT-VIEW: NUMBER CHOICE HANDLERS
     ============================================================ */
  const handleUseExistingNumber = useCallback(() => {
    setNumberChoice("existing");
    setFormData((prev) => ({ ...prev, proformaNo: reportNumber }));
    setProformaNumberError("");
  }, [reportNumber]);

  const handleUseNewNumber = useCallback(async () => {
    setNumberChoice("new");
    setFormData(defaultFormData);
    setItems([emptyItem()]);
    setSelectedReceiverId("");
    setSelectedConsigneeId("");
    setOriginalReceiver(null);
    setOriginalConsignee(null);
    if (accessToken) {
      await loadProformaNumber();
    }
  }, [accessToken, loadProformaNumber]);

  /* ============================================================
     BOOTSTRAP
     ============================================================ */
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    (async () => {
      const customerList = await loadCustomers();
      if (cancelled) return;

      const cameFromReportWithNumber = reportMode === "view" && !!reportNumber;

      if (cameFromReportWithNumber) {
        await loadExistingProforma(reportNumber, customerList || []);
      } else {
        await loadProformaNumber();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    loadCustomers,
    loadProformaNumber,
    loadExistingProforma,
    reportMode,
    reportNumber,
  ]);

  /* ============================================================
     BASIC SETTERS
     ============================================================ */
  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)),
    );
  };

  const addRow = () => setItems((prev) => [...prev, emptyItem()]);

  const duplicateRow = (id) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      if (idx === -1) return prev;
      const copy = { ...prev[idx], id: Date.now() + Math.random() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const deleteRow = (id) => {
    setItems((prev) =>
      prev.length > 1 ? prev.filter((it) => it.id !== id) : prev,
    );
  };

  /* ============================================================
     RECEIVER — CUSTOMER SELECTION
     ============================================================ */
  const handleReceiverCustomerChange = useCallback(
    (customerId) => {
      setSelectedReceiverId(customerId);
      setReceiverActionError("");

      if (!customerId) {
        setOriginalReceiver(null);
        setFormData((prev) => ({
          ...prev,
          receiverGst: "",
          receiverDetails: emptyPartyDetails(),
          receiverAddressOptionId: "",
        }));
        return;
      }

      const customer = customers.find(
        (c) => String(c.id) === String(customerId),
      );
      if (!customer) return;

      const party = backendToParty(customer);

      setOriginalReceiver(party);
      setFormData((prev) => ({
        ...prev,
        receiverGst: party.gst,
        receiverDetails: party,
        receiverAddressOptionId: "",
      }));
    },
    [customers],
  );

  const updateReceiverField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      receiverDetails: { ...prev.receiverDetails, [field]: value },
    }));
  };

  const handleReceiverAddressOptionChange = (addressId) => {
    const chosen = COMPANY_ADDRESSES.find((a) => a.id === addressId);
    setFormData((prev) => ({
      ...prev,
      receiverAddressOptionId: addressId,
      receiverDetails: chosen
        ? { ...prev.receiverDetails, address: chosen.address }
        : prev.receiverDetails,
    }));
  };

  /* ============================================================
     CONSIGNEE — CUSTOMER SELECTION
     ============================================================ */
  const handleConsigneeCustomerChange = useCallback(
    (customerId) => {
      setSelectedConsigneeId(customerId);
      setConsigneeActionError("");

      if (!customerId) {
        setOriginalConsignee(null);
        setFormData((prev) => ({
          ...prev,
          consigneeGst: "",
          consigneeDetails: emptyPartyDetails(),
          consigneeAddressOptionId: "",
        }));
        return;
      }

      const customer = customers.find(
        (c) => String(c.id) === String(customerId),
      );
      if (!customer) return;

      const party = backendToParty(customer);

      setOriginalConsignee(party);
      setFormData((prev) => ({
        ...prev,
        consigneeGst: party.gst,
        consigneeDetails: party,
        consigneeAddressOptionId: "",
      }));
    },
    [customers],
  );

  const updateConsigneeField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      consigneeDetails: { ...prev.consigneeDetails, [field]: value },
    }));
  };

  const handleConsigneeAddressOptionChange = (addressId) => {
    const chosen = COMPANY_ADDRESSES.find((a) => a.id === addressId);
    setFormData((prev) => ({
      ...prev,
      consigneeAddressOptionId: addressId,
      consigneeDetails: chosen
        ? { ...prev.consigneeDetails, address: chosen.address }
        : prev.consigneeDetails,
    }));
  };

  /* ============================================================
     RECEIVER — ACTION STATE
     ============================================================ */
  const receiverMatched = useMemo(() => {
    const name = formData.receiverDetails?.companyName?.trim().toLowerCase();
    if (!name) return null;
    return (
      customers.find(
        (c) =>
          String(c.company_name || "")
            .trim()
            .toLowerCase() === name,
      ) || null
    );
  }, [customers, formData.receiverDetails?.companyName]);

  const receiverModified = useMemo(() => {
    if (!originalReceiver) return false;
    return !partiesAreEqual(formData.receiverDetails, originalReceiver);
  }, [originalReceiver, formData.receiverDetails]);

  const receiverAvailableAction = useMemo(() => {
    const hasName = !!formData.receiverDetails?.companyName?.trim();
    if (selectedReceiverId && originalReceiver && receiverModified) {
      return "update";
    }
    if (!receiverMatched && hasName) return "create";
    return null;
  }, [
    selectedReceiverId,
    originalReceiver,
    receiverModified,
    receiverMatched,
    formData.receiverDetails?.companyName,
  ]);

  /* ============================================================
     CONSIGNEE — ACTION STATE
     ============================================================ */
  const consigneeMatched = useMemo(() => {
    const name = formData.consigneeDetails?.companyName?.trim().toLowerCase();
    if (!name) return null;
    return (
      customers.find(
        (c) =>
          String(c.company_name || "")
            .trim()
            .toLowerCase() === name,
      ) || null
    );
  }, [customers, formData.consigneeDetails?.companyName]);

  const consigneeModified = useMemo(() => {
    if (!originalConsignee) return false;
    return !partiesAreEqual(formData.consigneeDetails, originalConsignee);
  }, [originalConsignee, formData.consigneeDetails]);

  const consigneeAvailableAction = useMemo(() => {
    const hasName = !!formData.consigneeDetails?.companyName?.trim();
    if (selectedConsigneeId && originalConsignee && consigneeModified) {
      return "update";
    }
    if (!consigneeMatched && hasName) return "create";
    return null;
  }, [
    selectedConsigneeId,
    originalConsignee,
    consigneeModified,
    consigneeMatched,
    formData.consigneeDetails?.companyName,
  ]);

  /* ============================================================
     CUSTOMER API HELPERS
     ============================================================ */
  const createCustomerApi = async (party) => {
    const response = await api.post(
      PI_CUSTOMERS_ENDPOINT,
      partyToBackend(party),
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const responseData = response.data;
    if (!responseData?.success || !responseData?.data) {
      throw new Error("bad response");
    }

    const newCustomer = responseData.data;
    setCustomers((prev) => [...prev, newCustomer]);
    return newCustomer;
  };

  const updateCustomerApi = async (customerId, party) => {
    const response = await api.patch(
      `${PI_CUSTOMERS_ENDPOINT}${customerId}/`,
      partyToBackend(party),
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const responseData = response.data;
    if (!responseData?.success || !responseData?.data) {
      throw new Error("bad response");
    }

    const updated = responseData.data;
    setCustomers((prev) =>
      prev.map((c) => (String(c.id) === String(updated.id) ? updated : c)),
    );
    return updated;
  };

  const handleReceiverCreate = useCallback(async () => {
    if (!accessToken) {
      setReceiverActionError("Session expired. Please login again.");
      return;
    }
    const party = formData.receiverDetails || {};
    if (!party.companyName?.trim()) {
      setReceiverActionError("Enter a company name first.");
      return;
    }

    try {
      setReceiverAction("create");
      setReceiverActionError("");
      const newCustomer = await createCustomerApi(party);

      setSelectedReceiverId(String(newCustomer.id));
      const fresh = backendToParty(newCustomer);
      setOriginalReceiver(fresh);
      setFormData((prev) => ({ ...prev, receiverDetails: fresh }));
    } catch (err) {
      console.error("Receiver create failed:", err);
      setReceiverActionError(GENERIC_ERROR);
    } finally {
      setReceiverAction(null);
    }
  }, [accessToken, formData.receiverDetails]);

  const handleReceiverUpdate = useCallback(async () => {
    if (!accessToken) {
      setReceiverActionError("Session expired. Please login again.");
      return;
    }
    if (!selectedReceiverId) {
      setReceiverActionError("Select a customer before updating.");
      return;
    }

    try {
      setReceiverAction("update");
      setReceiverActionError("");
      const updated = await updateCustomerApi(
        selectedReceiverId,
        formData.receiverDetails,
      );
      const fresh = backendToParty(updated);
      setOriginalReceiver(fresh);
      setFormData((prev) => ({ ...prev, receiverDetails: fresh }));
    } catch (err) {
      console.error("Receiver update failed:", err);
      setReceiverActionError(GENERIC_ERROR);
    } finally {
      setReceiverAction(null);
    }
  }, [accessToken, selectedReceiverId, formData.receiverDetails]);

  const handleReceiverReset = useCallback(() => {
    if (!originalReceiver) return;
    setReceiverActionError("");
    setFormData((prev) => ({
      ...prev,
      receiverDetails: { ...originalReceiver },
    }));
  }, [originalReceiver]);

  const handleConsigneeCreate = useCallback(async () => {
    if (!accessToken) {
      setConsigneeActionError("Session expired. Please login again.");
      return;
    }
    const party = formData.consigneeDetails || {};
    if (!party.companyName?.trim()) {
      setConsigneeActionError("Enter a company name first.");
      return;
    }

    try {
      setConsigneeAction("create");
      setConsigneeActionError("");
      const newCustomer = await createCustomerApi(party);

      setSelectedConsigneeId(String(newCustomer.id));
      const fresh = backendToParty(newCustomer);
      setOriginalConsignee(fresh);
      setFormData((prev) => ({ ...prev, consigneeDetails: fresh }));
    } catch (err) {
      console.error("Consignee create failed:", err);
      setConsigneeActionError(GENERIC_ERROR);
    } finally {
      setConsigneeAction(null);
    }
  }, [accessToken, formData.consigneeDetails]);

  const handleConsigneeUpdate = useCallback(async () => {
    if (!accessToken) {
      setConsigneeActionError("Session expired. Please login again.");
      return;
    }
    if (!selectedConsigneeId) {
      setConsigneeActionError("Select a customer before updating.");
      return;
    }

    try {
      setConsigneeAction("update");
      setConsigneeActionError("");
      const updated = await updateCustomerApi(
        selectedConsigneeId,
        formData.consigneeDetails,
      );
      const fresh = backendToParty(updated);
      setOriginalConsignee(fresh);
      setFormData((prev) => ({ ...prev, consigneeDetails: fresh }));
    } catch (err) {
      console.error("Consignee update failed:", err);
      setConsigneeActionError(GENERIC_ERROR);
    } finally {
      setConsigneeAction(null);
    }
  }, [accessToken, selectedConsigneeId, formData.consigneeDetails]);

  const handleConsigneeReset = useCallback(() => {
    if (!originalConsignee) return;
    setConsigneeActionError("");
    setFormData((prev) => ({
      ...prev,
      consigneeDetails: { ...originalConsignee },
    }));
  }, [originalConsignee]);

  /* ============================================================
     CALCULATIONS
     ============================================================ */
  const itemsWithAmount = items.map((it) => ({
    ...it,
    amount: round2((parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0)),
  }));

  const subtotal = round2(
    itemsWithAmount.reduce((sum, it) => sum + it.amount, 0),
  );

  const cgstAmount = round2(
    (subtotal * (parseFloat(formData.cgstPct) || 0)) / 100,
  );
  const sgstAmount = round2(
    (subtotal * (parseFloat(formData.sgstPct) || 0)) / 100,
  );
  const igstAmount = round2(
    (subtotal * (parseFloat(formData.igstPct) || 0)) / 100,
  );

  const beforeRounding = round2(
    subtotal + cgstAmount + sgstAmount + igstAmount,
  );
  const grandTotalRaw = beforeRounding + (parseFloat(formData.roundedOff) || 0);
  const grandTotal = Math.round(grandTotalRaw);
  const roundedOffAuto = round2(grandTotal - beforeRounding);

  const amountInWords = numberToWordsIndian(grandTotal) + " Rupees Only";

  const selectedCompanyAddress = useMemo(
    () =>
      COMPANY_ADDRESSES.find((a) => a.id === formData.companyAddressId) ||
      COMPANY_ADDRESSES[0],
    [formData.companyAddressId],
  );

  const previewData = {
    company: {
      ...COMPANY,
      worksLine1: `Works : ${selectedCompanyAddress.address}`,
      worksLine2: "",
    },
    formData,
    items: itemsWithAmount,
    receiver: formData.receiverDetails,
    consignee: formData.consigneeDetails,
    totals: {
      subtotal,
      cgstAmount,
      sgstAmount,
      igstAmount,
      roundedOff: roundedOffAuto,
      grandTotal,
      amountInWords,
    },
  };

  /* ============================================================
     CLEAR (KEEP PROFORMA NUMBER, ADDRESS, CUSTOMERS & BANK)
     ------------------------------------------------------------
     Clears everything the user typed. API-generated values stay:
     the document number, company address, receiver/consignee details
     and the bank details loaded from the backend.
     ============================================================ */
  const clearForm = () => {
    if (
      !window.confirm(
        "Clear all entered details? The Proforma number, customer details and bank details will be kept.",
      )
    )
      return;

    setFormData((prev) => ({
      ...defaultFormData,
      // ---- kept ----
      proformaNo: prev.proformaNo,
      companyAddressId: prev.companyAddressId,
      receiverGst: prev.receiverGst,
      consigneeGst: prev.consigneeGst,
      receiverDetails: prev.receiverDetails,
      consigneeDetails: prev.consigneeDetails,
      receiverAddressOptionId: prev.receiverAddressOptionId,
      consigneeAddressOptionId: prev.consigneeAddressOptionId,
      bankName: prev.bankName,
      accountNumber: prev.accountNumber,
      branch: prev.branch,
      ifsc: prev.ifsc,
    }));
    setItems([emptyItem()]);
    setSubmitError("");
    setSaveStatus("");
  };

  /* ============================================================
     SAVE PROFORMA TO BACKEND
     ============================================================ */
  const saveProformaToBackend = async () => {
    if (!accessToken) {
      setSubmitError("Session expired. Please login again.");
      return null;
    }

    const payload = {
      proforma_no: (formData.proformaNo || "").trim(),
      date: formData.date || null,
      valid_until: formData.validUntil || null,
      payment_terms: formData.paymentTerms || "",

      reference_no: formData.referenceNo || "",
      customer_po_no: formData.customerPoNo || "",
      po_date: formData.poDate || null,
      place_of_supply: formData.placeOfSupply || "",

      receiver_details: formData.receiverDetails,
      receiver_gst: formData.receiverGst || "",
      receiver_address_option_id: formData.receiverAddressOptionId || "",

      consignee_details: formData.consigneeDetails,
      consignee_gst: formData.consigneeGst || "",
      consignee_address_option_id: formData.consigneeAddressOptionId || "",

      company_address_id: formData.companyAddressId || "unit1",

      items: itemsWithAmount,

      subtotal: round2(subtotal),
      cgst_percent: round2(parseFloat(formData.cgstPct) || 0),
      cgst_amount: round2(cgstAmount),
      sgst_percent: round2(parseFloat(formData.sgstPct) || 0),
      sgst_amount: round2(sgstAmount),
      igst_percent: round2(parseFloat(formData.igstPct) || 0),
      igst_amount: round2(igstAmount),
      rounded_off: round2(roundedOffAuto),
      grand_total: round2(grandTotal),
      amount_in_words: amountInWords,

      bank_name: formData.bankName || "",
      account_number: formData.accountNumber || "",
      branch: formData.branch || "",
      ifsc: formData.ifsc || "",
      pan: COMPANY.pan || "",

      declaration: formData.declaration || "",
      enclosure_text: formData.enclosureText || "",

      document_data: previewData,
    };

    try {
      setSubmitting(true);
      setSubmitError("");

      const response = await api.post(PI_SAVE_ENDPOINT, payload, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.data?.success) {
        throw new Error("bad response");
      }

      const saved = response.data?.data;
      if (!saved) {
        throw new Error("bad response");
      }
      return saved;
    } catch (error) {
      console.error("Proforma creation failed:", error);
      setSubmitError(GENERIC_ERROR);
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================================================
     PREVIEW / PRINT
     ============================================================ */
  const goToPrint = async () => {
    if (submitting) return;
    setSubmitError("");

    if (!formData.proformaNo?.trim()) {
      setSubmitError("Proforma number is still loading.");
      return;
    }

    const saved = await saveProformaToBackend();
    if (!saved) return;

    try {
      await loadProformaInvoicePrintEngine();
      window.generateProformaInvoicePrint(previewData);
      setSaveStatus(`Saved proforma ${formData.proformaNo}.`);
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      console.error(err);
      setSubmitError(
        "Proforma saved, but the print preview could not be loaded.",
      );
    }
  };

  /* ============================================================
     RENDER
     ============================================================ */
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

          <h2>Proforma Invoice</h2>

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

          <div className="form-actions-top-right">
            {saveStatus && (
              <span className="form-save-status">{saveStatus}</span>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={goToPrint}
              disabled={submitting || proformaNumberLoading}
            >
              {submitting ? "Saving..." : "Preview Invoice"}
            </button>
          </div>
        </div>

        {/* ---------- NUMBER CHOICE BANNER ---------- */}
        {reportMode === "view" && reportNumber && numberChoice === null && (
          <div className="qt-alert">
            <div className="qt-alert__icon">?</div>
            <div className="qt-alert__content">
              <strong>
                This Proforma Invoice already exists: {reportNumber}
              </strong>
              <span>
                Do you want to edit the existing proforma (same number), or
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
              <strong>Editing existing proforma {reportNumber}</strong>
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
                Creating a new proforma: {formData.proformaNo || "Loading..."}
              </strong>
              <span>
                A fresh number from the current sequence will be used.
              </span>
            </div>
          </div>
        )}

        {(submitError || proformaNumberError) && (
          <div className="qt-alert">
            <div className="qt-alert__icon">!</div>
            <div className="qt-alert__content">
              <strong>Proforma Invoice API Error</strong>
              <span>{submitError || proformaNumberError}</span>
            </div>
            {proformaNumberError && !proformaNumberLoading && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={loadProformaNumber}
              >
                Retry
              </button>
            )}
          </div>
        )}

        <div className="form-content">
          {/* 1. Proforma Details */}
          <section className="form-section">
            <h3 className="form-section-title">Proforma Details</h3>

            <div className="form-section-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Proforma No</label>
                  <input
                    className="form-input"
                    value={
                      formData.proformaNo ||
                      (proformaNumberLoading ? "Loading..." : "")
                    }
                    readOnly
                    title="Auto-generated — cannot be edited"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={formData.date}
                    onChange={(e) => updateField("date", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Valid Until</label>
                  <input
                    className="form-input"
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => updateField("validUntil", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Terms</label>
                  <input
                    className="form-input"
                    value={formData.paymentTerms}
                    onChange={(e) =>
                      updateField("paymentTerms", e.target.value)
                    }
                    placeholder="e.g. 50% Advance, Balance Before Dispatch"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Address</label>
                  <select
                    className="form-input"
                    value={selectedCompanyAddress.id}
                    onChange={(e) =>
                      updateField("companyAddressId", e.target.value)
                    }
                  >
                    {COMPANY_ADDRESSES.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.label}: {address.address}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Customer loading / error */}
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
              {/* 2. Receiver / 3. Consignee */}
              <div className="form-party-grid">
                <section className="form-section">
                  <h3 className="form-section-title">
                    Details of Receiver (Billed To)
                  </h3>

                  <div className="form-section-body">
                    <div className="form-group form-customer-select">
                      <label className="form-label">Select Customer</label>
                      <select
                        className="form-input"
                        value={selectedReceiverId}
                        onChange={(e) =>
                          handleReceiverCustomerChange(e.target.value)
                        }
                      >
                        <option value="">-- Select Customer --</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.gst_number || "—"} — {c.company_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {formData.receiverGst === COMPANY.gstin && (
                      <div className="form-group form-customer-select">
                        <label className="form-label">
                          Mugil Industry — Address
                        </label>
                        <select
                          className="form-input"
                          value={formData.receiverAddressOptionId}
                          onChange={(e) =>
                            handleReceiverAddressOptionChange(e.target.value)
                          }
                        >
                          <option value="">
                            -- Keep GST-lookup address --
                          </option>
                          {COMPANY_ADDRESSES.map((address) => (
                            <option key={address.id} value={address.id}>
                              {address.label}: {address.address}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="form-grid form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Company Name</label>
                        <input
                          className="form-input"
                          value={formData.receiverDetails.companyName}
                          onChange={(e) =>
                            updateReceiverField("companyName", e.target.value)
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">GST Number</label>
                        <input
                          className="form-input"
                          value={formData.receiverDetails.gst}
                          onChange={(e) =>
                            updateReceiverField("gst", e.target.value)
                          }
                        />
                      </div>

                      <div className="form-group form-group-wide">
                        <label className="form-label">Address</label>
                        <input
                          className="form-input"
                          value={formData.receiverDetails.address}
                          onChange={(e) =>
                            updateReceiverField("address", e.target.value)
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">State</label>
                        <input
                          className="form-input"
                          value={formData.receiverDetails.state}
                          onChange={(e) =>
                            updateReceiverField("state", e.target.value)
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">State Code</label>
                        <input
                          className="form-input"
                          value={formData.receiverDetails.stateCode}
                          onChange={(e) =>
                            updateReceiverField("stateCode", e.target.value)
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Phone Number</label>
                        <input
                          className="form-input"
                          value={formData.receiverDetails.phone}
                          onChange={(e) =>
                            updateReceiverField("phone", e.target.value)
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                          className="form-input"
                          value={formData.receiverDetails.email}
                          onChange={(e) =>
                            updateReceiverField("email", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    {/* Receiver action bar */}
                    <div
                      className={`qt-customer-actions ${
                        receiverAvailableAction === "update"
                          ? "qt-customer-modified"
                          : ""
                      }`}
                    >
                      <div className="qt-customer-actions__info">
                        {receiverAvailableAction === "update" && (
                          <>
                            <strong>Receiver details changed</strong>
                            <span>
                              Save changes to the master record, or reset.
                            </span>
                          </>
                        )}
                        {receiverAvailableAction === "create" && (
                          <>
                            <strong>New customer</strong>
                            <span>
                              No matching customer exists — create it.
                            </span>
                          </>
                        )}
                        {receiverAvailableAction === null && (
                          <>
                            <strong>
                              {selectedReceiverId
                                ? "Customer selected"
                                : "No customer selected"}
                            </strong>
                            <span>
                              {selectedReceiverId
                                ? "Saved values match the customer record."
                                : "Pick a customer or type a new one."}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="qt-customer-actions__buttons">
                        {receiverAvailableAction === "update" && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={handleReceiverReset}
                              disabled={receiverAction === "update"}
                            >
                              Reset
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={handleReceiverUpdate}
                              disabled={receiverAction === "update"}
                            >
                              {receiverAction === "update"
                                ? "Updating..."
                                : "Update Customer"}
                            </button>
                          </>
                        )}

                        {receiverAvailableAction === "create" && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleReceiverCreate}
                            disabled={receiverAction === "create"}
                          >
                            {receiverAction === "create"
                              ? "Creating..."
                              : "Create Customer"}
                          </button>
                        )}
                      </div>
                    </div>

                    {receiverActionError && (
                      <div className="qt-customer-action-error">
                        {receiverActionError}
                      </div>
                    )}
                  </div>
                </section>

                <section className="form-section">
                  <h3 className="form-section-title">
                    Details of Consignee (Shipped To)
                  </h3>

                  <div className="form-section-body">
                    <div className="form-group form-customer-select">
                      <label className="form-label">Select Customer</label>
                      <select
                        className="form-input"
                        value={selectedConsigneeId}
                        onChange={(e) =>
                          handleConsigneeCustomerChange(e.target.value)
                        }
                      >
                        <option value="">-- Select Customer --</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.gst_number || "—"} — {c.company_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {formData.consigneeGst === COMPANY.gstin && (
                      <div className="form-group form-customer-select">
                        <label className="form-label">
                          Mugil Industry — Address
                        </label>
                        <select
                          className="form-input"
                          value={formData.consigneeAddressOptionId}
                          onChange={(e) =>
                            handleConsigneeAddressOptionChange(e.target.value)
                          }
                        >
                          <option value="">
                            -- Keep GST-lookup address --
                          </option>
                          {COMPANY_ADDRESSES.map((address) => (
                            <option key={address.id} value={address.id}>
                              {address.label}: {address.address}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="form-grid form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Company Name</label>
                        <input
                          className="form-input"
                          value={formData.consigneeDetails.companyName}
                          onChange={(e) =>
                            updateConsigneeField("companyName", e.target.value)
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">GST</label>
                        <input
                          className="form-input"
                          value={formData.consigneeDetails.gst}
                          onChange={(e) =>
                            updateConsigneeField("gst", e.target.value)
                          }
                        />
                      </div>

                      <div className="form-group form-group-wide">
                        <label className="form-label">Address</label>
                        <input
                          className="form-input"
                          value={formData.consigneeDetails.address}
                          onChange={(e) =>
                            updateConsigneeField("address", e.target.value)
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">State</label>
                        <input
                          className="form-input"
                          value={formData.consigneeDetails.state}
                          onChange={(e) =>
                            updateConsigneeField("state", e.target.value)
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">State Code</label>
                        <input
                          className="form-input"
                          value={formData.consigneeDetails.stateCode}
                          onChange={(e) =>
                            updateConsigneeField("stateCode", e.target.value)
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Phone Number</label>
                        <input
                          className="form-input"
                          value={formData.consigneeDetails.phone}
                          onChange={(e) =>
                            updateConsigneeField("phone", e.target.value)
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                          className="form-input"
                          value={formData.consigneeDetails.email}
                          onChange={(e) =>
                            updateConsigneeField("email", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    {/* Consignee action bar */}
                    <div
                      className={`qt-customer-actions ${
                        consigneeAvailableAction === "update"
                          ? "qt-customer-modified"
                          : ""
                      }`}
                    >
                      <div className="qt-customer-actions__info">
                        {consigneeAvailableAction === "update" && (
                          <>
                            <strong>Consignee details changed</strong>
                            <span>
                              Save changes to the master record, or reset.
                            </span>
                          </>
                        )}
                        {consigneeAvailableAction === "create" && (
                          <>
                            <strong>New customer</strong>
                            <span>
                              No matching customer exists — create it.
                            </span>
                          </>
                        )}
                        {consigneeAvailableAction === null && (
                          <>
                            <strong>
                              {selectedConsigneeId
                                ? "Customer selected"
                                : "No customer selected"}
                            </strong>
                            <span>
                              {selectedConsigneeId
                                ? "Saved values match the customer record."
                                : "Pick a customer or type a new one."}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="qt-customer-actions__buttons">
                        {consigneeAvailableAction === "update" && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={handleConsigneeReset}
                              disabled={consigneeAction === "update"}
                            >
                              Reset
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={handleConsigneeUpdate}
                              disabled={consigneeAction === "update"}
                            >
                              {consigneeAction === "update"
                                ? "Updating..."
                                : "Update Customer"}
                            </button>
                          </>
                        )}

                        {consigneeAvailableAction === "create" && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleConsigneeCreate}
                            disabled={consigneeAction === "create"}
                          >
                            {consigneeAction === "create"
                              ? "Creating..."
                              : "Create Customer"}
                          </button>
                        )}
                      </div>
                    </div>

                    {consigneeActionError && (
                      <div className="qt-customer-action-error">
                        {consigneeActionError}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}

          {/* 4. Reference / Order Information */}
          <section className="form-section">
            <h3 className="form-section-title">
              Reference / Order Information
            </h3>

            <div className="form-section-body">
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Reference No</label>
                  <input
                    className="form-input"
                    value={formData.referenceNo}
                    onChange={(e) => updateField("referenceNo", e.target.value)}
                    placeholder="e.g. REF-2026-089"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Customer PO No</label>
                  <input
                    className="form-input"
                    value={formData.customerPoNo}
                    onChange={(e) =>
                      updateField("customerPoNo", e.target.value)
                    }
                    placeholder="e.g. PO/2026/315"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">PO Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={formData.poDate}
                    onChange={(e) => updateField("poDate", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Place of Supply</label>
                  <input
                    className="form-input"
                    value={formData.placeOfSupply}
                    onChange={(e) =>
                      updateField("placeOfSupply", e.target.value)
                    }
                    placeholder="e.g. Tamil Nadu (33)"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 5. Proforma Items */}
          <section className="form-section">
            <h3 className="form-section-title">Proforma Items</h3>

            <div className="form-section-body">
              <div className="form-table-wrapper">
                <table className="form-table form-table-wide">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>SL</th>
                      <th>Description of Goods</th>
                      <th style={{ width: 100 }}>HSN/SAC</th>
                      <th style={{ width: 90 }}>Quantity</th>
                      <th style={{ width: 80 }}>Unit</th>
                      <th style={{ width: 110 }}>Rate</th>
                      <th style={{ width: 120 }}>Amount</th>
                      <th style={{ width: 130 }}>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {itemsWithAmount.map((it, idx) => (
                      <tr key={it.id}>
                        <td>{idx + 1}</td>

                        <td>
                          <input
                            className="form-input"
                            value={it.description}
                            onChange={(e) =>
                              updateItem(it.id, "description", e.target.value)
                            }
                          />
                        </td>

                        <td>
                          <input
                            className="form-input"
                            value={it.hsn}
                            onChange={(e) =>
                              updateItem(it.id, "hsn", e.target.value)
                            }
                          />
                        </td>

                        <td>
                          <input
                            className="form-input form-input-number"
                            type="number"
                            value={it.quantity}
                            onChange={(e) =>
                              updateItem(it.id, "quantity", e.target.value)
                            }
                          />
                        </td>

                        <td>
                          <input
                            className="form-input"
                            value={it.unit}
                            onChange={(e) =>
                              updateItem(it.id, "unit", e.target.value)
                            }
                            placeholder="Mtrs"
                          />
                        </td>

                        <td>
                          <input
                            className="form-input form-input-number"
                            type="number"
                            value={it.rate}
                            onChange={(e) =>
                              updateItem(it.id, "rate", e.target.value)
                            }
                          />
                        </td>

                        <td className="form-table-amount">
                          ₹
                          {it.amount.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </td>

                        <td>
                          <div className="form-table-actions">
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => duplicateRow(it.id)}
                            >
                              Duplicate
                            </button>

                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => deleteRow(it.id)}
                              disabled={items.length <= 1}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={addRow}
              >
                + Add Row
              </button>
            </div>
          </section>

          {/* 6. Amount Summary */}
          <section className="form-section">
            <h3 className="form-section-title">Amount Summary</h3>

            <div className="form-section-body">
              <div className="form-summary-layout">
                <div className="form-tax-grid">
                  <div className="form-group">
                    <label className="form-label">Subtotal</label>
                    <input
                      className="form-input"
                      value={subtotal.toFixed(2)}
                      readOnly
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">CGST %</label>
                    <input
                      className="form-input"
                      type="number"
                      value={formData.cgstPct}
                      onChange={(e) => updateField("cgstPct", e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">CGST Amount</label>
                    <input
                      className="form-input"
                      value={cgstAmount.toFixed(2)}
                      readOnly
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">SGST %</label>
                    <input
                      className="form-input"
                      type="number"
                      value={formData.sgstPct}
                      onChange={(e) => updateField("sgstPct", e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">SGST Amount</label>
                    <input
                      className="form-input"
                      value={sgstAmount.toFixed(2)}
                      readOnly
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">IGST %</label>
                    <input
                      className="form-input"
                      type="number"
                      value={formData.igstPct}
                      onChange={(e) => updateField("igstPct", e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">IGST Amount</label>
                    <input
                      className="form-input"
                      value={igstAmount.toFixed(2)}
                      readOnly
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Rounded Off</label>
                    <input
                      className="form-input"
                      value={roundedOffAuto.toFixed(2)}
                      readOnly
                    />
                  </div>
                </div>

                <div className="form-grand-total">
                  <div className="form-grand-total-header">Grand Total</div>

                  <div className="form-grand-total-body">
                    <p className="form-total-label">Grand Total</p>

                    <p className="form-total-value">
                      ₹
                      {grandTotal.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>

                    <div className="form-amount-words">
                      <div className="form-amount-words-label">
                        Total Amount in Words
                      </div>

                      <div className="form-amount-words-value">
                        {amountInWords}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 7. Bank Details */}
          <section className="form-section">
            <h3 className="form-section-title">Company Bank Details</h3>

            <div className="form-section-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input
                    className="form-input"
                    value={formData.bankName}
                    readOnly
                    disabled
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Account Number</label>
                  <input
                    className="form-input"
                    value={formData.accountNumber}
                    readOnly
                    disabled
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Branch</label>
                  <input
                    className="form-input"
                    value={formData.branch}
                    readOnly
                    disabled
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">IFSC</label>
                  <input
                    className="form-input"
                    value={formData.ifsc}
                    readOnly
                    disabled
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">PAN</label>
                  <input
                    className="form-input"
                    value={COMPANY.pan}
                    readOnly
                    disabled
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 8. Declaration */}
          <section className="form-section">
            <h3 className="form-section-title">Declaration</h3>

            <div className="form-section-body">
              <textarea
                className="form-textarea"
                rows={4}
                value={formData.declaration}
                onChange={(e) => updateField("declaration", e.target.value)}
              />
            </div>
          </section>

          {/* 9. Terms / Encl */}
          <section className="form-section">
            <h3 className="form-section-title">Terms / Encl</h3>

            <div className="form-section-body">
              <p className="form-hint">
                Each line becomes one numbered point under &quot;Encl :&quot; on
                the PDF.
              </p>
              <textarea
                className="form-textarea"
                rows={5}
                value={formData.enclosureText}
                onChange={(e) => updateField("enclosureText", e.target.value)}
              />
            </div>
          </section>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={goToPrint}
              disabled={submitting || proformaNumberLoading}
            >
              {submitting ? "Saving..." : "Preview Invoice"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
