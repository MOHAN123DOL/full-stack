import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./TaxInvoice.css";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

/* ============================================================
   ENDPOINTS
   ============================================================ */

const TI_CUSTOMERS_ENDPOINT = "/erp/tax-invoice-customers/";
const TI_NEXT_NUMBER_ENDPOINT = "/erp/tax-invoices/next-number/";
const TI_SAVE_ENDPOINT = "/erp/tax-invoices/";

/* ============================================================
   PRINT ENGINE LOADER
   ============================================================ */

let taxInvoicePrintEnginePromise = null;
function loadTaxInvoicePrintEngine() {
  if (typeof window.generateTaxInvoicePrint === "function") {
    return Promise.resolve();
  }
  if (taxInvoicePrintEnginePromise) return taxInvoicePrintEnginePromise;

  taxInvoicePrintEnginePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-tax-invoice-print-engine="true"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("TaxInvoicePrint.js failed to load")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "/TaxInvoicePrint.js";
    script.async = true;
    script.dataset.taxInvoicePrintEngine = "true";
    script.onload = () => resolve();
    script.onerror = () => {
      taxInvoicePrintEnginePromise = null;
      reject(new Error("TaxInvoicePrint.js failed to load"));
    };
    document.head.appendChild(script);
  });

  return taxInvoicePrintEnginePromise;
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

const DRAFT_KEY = "taxInvoiceDraft:__unsaved__";

const defaultFormData = {
  invoiceNumber: "",
  invoiceDate: "",
  dateOfSupply: "",
  reverseCharge: "NO",
  vehicleNumber: "",
  modeOfTransport: "",
  stateNameCode: "",

  receiverGst: "",
  consigneeGst: "",

  receiverDetails: emptyPartyDetails(),
  consigneeDetails: emptyPartyDetails(),

  receiverAddressOptionId: "",
  consigneeAddressOptionId: "",

  placeOfSupplyState: "",
  placeOfSupplyStateCode: "",

  companyAddressId: "unit1",

  cgstPct: 9,
  sgstPct: 9,
  igstPct: 0,
  roundedOff: 0,

  bankName: "STATE BANK OF INDIA",
  accountNumber: "",
  branch: "",
  ifsc: "",

  declaration:
    "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",

  enclosures: {
    "Delivery Challan": true,
    "Material Accountable Statement": true,
    Invoice: true,
    "Inspection Report": true,
    "Rate Workout Sheet": true,
  },
};

/* ============================================================
   HELPERS
   ============================================================ */

function numberToWordsIndian(num) {
  num = Math.round(num || 0);
  if (num === 0) return "Zero";

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven",
    "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen",
    "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty",
    "Seventy", "Eighty", "Ninety",
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

/* Convert a backend Customer record (snake_case) to our local party shape. */
const backendToParty = (customer) => ({
  companyName: customer?.company_name || "",
  gst: customer?.gst_number || "",
  address: customer?.address || "",
  state: customer?.state || "",
  stateCode: customer?.state_code || "",
  phone: customer?.phone || "",
  email: customer?.email || "",
});

/* Convert our local party shape to the backend Customer payload (snake_case). */
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

/* Both sides compared — state and stateCode included so editing them
   triggers the "Update Customer" action bar. */
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

export default function TaxInvoiceForm() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState(defaultFormData);
  const [items, setItems] = useState([emptyItem()]);
  const [saveStatus, setSaveStatus] = useState("");

  /* Receiver / Consignee customer selection state */
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

  /* Invoice number + submit */
  const [invoiceNumberLoading, setInvoiceNumberLoading] = useState(false);
  const [invoiceNumberError, setInvoiceNumberError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  /* ============================================================
     RESTORE WORKING DRAFT
     ============================================================ */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed.formData)
        setFormData({ ...defaultFormData, ...parsed.formData });
      if (parsed.items && parsed.items.length) setItems(parsed.items);
    } catch (e) {
      console.error("Failed to restore draft", e);
    }
  }, []);

  /* ============================================================
     AUTOSAVE WORKING DRAFT
     ============================================================ */
  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ formData, items }),
        );
      } catch (e) {
        console.error("Failed to save draft", e);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [formData, items]);

  /* ============================================================
     LOAD CUSTOMERS
     ============================================================ */
  const loadCustomers = useCallback(async () => {
    if (!accessToken) return [];

    try {
      setCustomersLoading(true);
      setCustomersError("");

      const response = await api.get(TI_CUSTOMERS_ENDPOINT, {
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
      console.error("Failed to load tax invoice customers:", error);
      setCustomers([]);

      if (error.response) {
        setCustomersError(
          error.response.data?.message ||
            "Unable to load tax invoice customers.",
        );
      } else if (error.request) {
        setCustomersError("Unable to connect to the server.");
      } else {
        setCustomersError(
          error.message ||
            "Something went wrong while loading tax invoice customers.",
        );
      }
      return [];
    } finally {
      setCustomersLoading(false);
    }
  }, [accessToken]);

  /* ============================================================
     LOAD NEXT INVOICE NUMBER
     ============================================================ */
  const loadInvoiceNumber = useCallback(async () => {
    if (!accessToken) return;

    try {
      setInvoiceNumberLoading(true);
      setInvoiceNumberError("");

      const response = await api.get(TI_NEXT_NUMBER_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const responseData = response.data;

      if (!responseData?.success || !responseData?.invoice_number) {
        throw new Error(
          responseData?.message || "Unable to get invoice number.",
        );
      }

      const invoiceNumber = responseData.invoice_number;
      const serverData = responseData.data;

      if (serverData) {
        setFormData((prev) => ({
          ...prev,
          invoiceNumber,
          invoiceDate: serverData.invoice_date || prev.invoiceDate,
          dateOfSupply: serverData.date_of_supply || prev.dateOfSupply,
          reverseCharge: serverData.reverse_charge ?? prev.reverseCharge,
          vehicleNumber: serverData.vehicle_number ?? prev.vehicleNumber,
          modeOfTransport:
            serverData.mode_of_transport ?? prev.modeOfTransport,
          stateNameCode: serverData.state_name_code ?? prev.stateNameCode,

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

          placeOfSupplyState:
            serverData.place_of_supply_state ?? prev.placeOfSupplyState,
          placeOfSupplyStateCode:
            serverData.place_of_supply_state_code ??
            prev.placeOfSupplyStateCode,

          companyAddressId:
            serverData.company_address_id ?? prev.companyAddressId,

          cgstPct: serverData.cgst_percent ?? prev.cgstPct,
          sgstPct: serverData.sgst_percent ?? prev.sgstPct,
          igstPct: serverData.igst_percent ?? prev.igstPct,
          roundedOff: serverData.rounded_off ?? prev.roundedOff,

          bankName: serverData.bank_name ?? prev.bankName,
          accountNumber:
            serverData.account_number ?? prev.accountNumber,
          branch: serverData.branch ?? prev.branch,
          ifsc: serverData.ifsc ?? prev.ifsc,

          declaration: serverData.declaration ?? prev.declaration,
          enclosures: serverData.enclosures ?? prev.enclosures,
        }));

        if (Array.isArray(serverData.items) && serverData.items.length) {
          setItems(serverData.items);
        }
      } else {
        setFormData((prev) => ({ ...prev, invoiceNumber }));
      }
    } catch (error) {
      console.error("Failed to load invoice number:", error);
      const message = error.response
        ? error.response.data?.message || "Unable to load invoice number."
        : error.request
          ? "Unable to connect to the server while getting invoice number."
          : error.message || "Unable to load invoice number.";
      setInvoiceNumberError(message);
    } finally {
      setInvoiceNumberLoading(false);
    }
  }, [accessToken]);

  /* ============================================================
     BOOTSTRAP
     ============================================================ */
  useEffect(() => {
    if (!accessToken) return;
    loadCustomers();
    loadInvoiceNumber();
  }, [accessToken, loadCustomers, loadInvoiceNumber]);

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

  const toggleEnclosure = (label) => {
    setFormData((prev) => ({
      ...prev,
      enclosures: { ...prev.enclosures, [label]: !prev.enclosures[label] },
    }));
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
        placeOfSupplyState: party.state || prev.placeOfSupplyState,
        placeOfSupplyStateCode:
          party.stateCode || prev.placeOfSupplyStateCode,
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
     RECEIVER — ACTION STATE (create/update)
     ============================================================ */
  const receiverMatched = useMemo(() => {
    const name = formData.receiverDetails?.companyName?.trim().toLowerCase();
    if (!name) return null;
    return (
      customers.find(
        (c) =>
          String(c.company_name || "").trim().toLowerCase() === name,
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
     CONSIGNEE — ACTION STATE (create/update)
     ============================================================ */
  const consigneeMatched = useMemo(() => {
    const name = formData.consigneeDetails?.companyName
      ?.trim()
      .toLowerCase();
    if (!name) return null;
    return (
      customers.find(
        (c) =>
          String(c.company_name || "").trim().toLowerCase() === name,
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
      TI_CUSTOMERS_ENDPOINT,
      partyToBackend(party),
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const responseData = response.data;
    if (!responseData?.success || !responseData?.data) {
      throw new Error(
        responseData?.message || "Unable to create customer.",
      );
    }

    const newCustomer = responseData.data;
    setCustomers((prev) => [...prev, newCustomer]);
    return newCustomer;
  };

  const updateCustomerApi = async (customerId, party) => {
    const response = await api.patch(
      `${TI_CUSTOMERS_ENDPOINT}${customerId}/`,
      partyToBackend(party),
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const responseData = response.data;
    if (!responseData?.success || !responseData?.data) {
      throw new Error(
        responseData?.message || "Unable to update customer.",
      );
    }

    const updated = responseData.data;
    setCustomers((prev) =>
      prev.map((c) =>
        String(c.id) === String(updated.id) ? updated : c,
      ),
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
      setReceiverActionError(
        err.response?.data?.message ||
          err.message ||
          "Could not create receiver.",
      );
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
      setReceiverActionError(
        err.response?.data?.message ||
          err.message ||
          "Could not update receiver.",
      );
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
      setConsigneeActionError(
        err.response?.data?.message ||
          err.message ||
          "Could not create consignee.",
      );
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
      setConsigneeActionError(
        err.response?.data?.message ||
          err.message ||
          "Could not update consignee.",
      );
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
    amount: (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0),
  }));

  const subtotal = itemsWithAmount.reduce((sum, it) => sum + it.amount, 0);

  const cgstAmount =
    (subtotal * (parseFloat(formData.cgstPct) || 0)) / 100;
  const sgstAmount =
    (subtotal * (parseFloat(formData.sgstPct) || 0)) / 100;
  const igstAmount =
    (subtotal * (parseFloat(formData.igstPct) || 0)) / 100;

  const beforeRounding = subtotal + cgstAmount + sgstAmount + igstAmount;
  const grandTotalRaw =
    beforeRounding + (parseFloat(formData.roundedOff) || 0);
  const grandTotal = Math.round(grandTotalRaw);
  const roundedOffAuto = grandTotal - beforeRounding;

  const amountInWords = numberToWordsIndian(grandTotal) + " Rupees Only";

  const selectedCompanyAddress = useMemo(
    () =>
      COMPANY_ADDRESSES.find(
        (a) => a.id === formData.companyAddressId,
      ) || COMPANY_ADDRESSES[0],
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
    placeOfSupply: {
      state: formData.placeOfSupplyState,
      stateCode: formData.placeOfSupplyStateCode,
      stateNameCode: formData.stateNameCode,
    },
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
     SAVE TAX INVOICE TO BACKEND
     ============================================================ */
  const saveInvoiceToBackend = async () => {
    if (!accessToken) {
      setSubmitError("Session expired. Please login again.");
      return null;
    }

    const payload = {
      invoice_number: (formData.invoiceNumber || "").trim(),
      invoice_date: formData.invoiceDate || null,
      date_of_supply: formData.dateOfSupply || null,
      reverse_charge: formData.reverseCharge || "NO",
      vehicle_number: formData.vehicleNumber || "",
      mode_of_transport: formData.modeOfTransport || "",

      receiver_details: formData.receiverDetails,
      receiver_gst: formData.receiverGst || "",
      receiver_address_option_id: formData.receiverAddressOptionId || "",

      consignee_details: formData.consigneeDetails,
      consignee_gst: formData.consigneeGst || "",
      consignee_address_option_id:
        formData.consigneeAddressOptionId || "",

      place_of_supply_state: formData.placeOfSupplyState || "",
      place_of_supply_state_code: formData.placeOfSupplyStateCode || "",
      state_name_code: formData.stateNameCode || "",

      company_address_id: formData.companyAddressId || "unit1",

      items: itemsWithAmount,

      subtotal,
      cgst_percent: parseFloat(formData.cgstPct) || 0,
      cgst_amount: cgstAmount,
      sgst_percent: parseFloat(formData.sgstPct) || 0,
      sgst_amount: sgstAmount,
      igst_percent: parseFloat(formData.igstPct) || 0,
      igst_amount: igstAmount,
      rounded_off: roundedOffAuto,
      grand_total: grandTotal,
      amount_in_words: amountInWords,

      bank_name: formData.bankName || "",
      account_number: formData.accountNumber || "",
      branch: formData.branch || "",
      ifsc: formData.ifsc || "",
      pan: COMPANY.pan || "",

      declaration: formData.declaration || "",
      enclosures: formData.enclosures || {},

      document_data: previewData,

      status: "DRAFT",
    };

    try {
      setSubmitting(true);
      setSubmitError("");

      const response = await api.post(TI_SAVE_ENDPOINT, payload, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.data?.success) {
        setSubmitError(
          response.data?.message || "Invoice creation failed.",
        );
        return null;
      }

      const saved = response.data?.data;
      if (!saved) {
        setSubmitError("Server returned invalid invoice data.");
        return null;
      }
      return saved;
    } catch (error) {
      console.error("Invoice creation failed:", error);

      if (error.response) {
        const responseData = error.response.data;
        const backendErrors = responseData?.errors;

        if (backendErrors) {
          const messages = Object.entries(backendErrors)
            .map(([field, msgs]) => {
              const m = Array.isArray(msgs)
                ? msgs.join(", ")
                : String(msgs);
              return `${field}: ${m}`;
            })
            .join(" | ");
          setSubmitError(
            messages || responseData?.message || "Save failed.",
          );
        } else {
          setSubmitError(responseData?.message || "Save failed.");
        }
      } else if (error.request) {
        setSubmitError(
          "Unable to connect to the server. Please check whether the backend is running.",
        );
      } else {
        setSubmitError(
          error.message || "Something went wrong while saving.",
        );
      }
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

    if (!formData.invoiceNumber?.trim()) {
      setSubmitError("Invoice number is still loading.");
      return;
    }

    const saved = await saveInvoiceToBackend();
    if (!saved) return;

    try {
      await loadTaxInvoicePrintEngine();
      window.generateTaxInvoicePrint(previewData);
      setSaveStatus(`Saved invoice ${formData.invoiceNumber}.`);
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      console.error(err);
      setSubmitError(
        "Invoice saved, but the print preview could not be loaded.",
      );
    }
  };

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <>
      <Header />
      <div className="ti-form-page">
        <Link to="/accounts" className="erp-back-button">
          <ArrowLeft size={16} />
          Back
        </Link>

        <div className="ti-form-header">
          <div className="ti-form-header-left"></div>

          <div
            className="ti-form-invoice-io"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "8px",
              flexWrap: "wrap",
              marginLeft: "auto",
              transform: "translateX(-8px)",
            }}
          >
            <button
              type="button"
              className="ti-form-preview-btn"
              onClick={goToPrint}
              disabled={submitting || invoiceNumberLoading}
            >
              {submitting ? "Saving..." : "Preview Invoice"}
            </button>

            {saveStatus && (
              <span
                className="ti-form-save-status"
                style={{ fontSize: "13px", color: "#555" }}
              >
                {saveStatus}
              </span>
            )}
          </div>
        </div>

        {submitError && (
          <div className="qt-alert">
            <div className="qt-alert__icon">!</div>
            <div className="qt-alert__content">
              <strong>Tax Invoice API Error</strong>
              <span>{submitError}</span>
            </div>
            {invoiceNumberError && !invoiceNumberLoading && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={loadInvoiceNumber}
              >
                Retry
              </button>
            )}
          </div>
        )}

        <div className="ti-form-content">
          <div className="ti-form-title-block">
            <h1 className="ti-form-title">Tax Invoice</h1>
            <p className="ti-form-subtitle">
              Create and manage tax invoice details
            </p>
          </div>

          {/* 1. Invoice Details */}
          <section className="ti-form-section">
            <div className="ti-form-section-header">
              <span className="ti-form-section-number">01</span>
              <h2 className="ti-form-section-title">Invoice Details</h2>
            </div>

            <div className="ti-form-section-body">
              <div className="ti-form-grid">
                <div className="ti-form-field">
                  <label className="ti-form-label">Invoice Number</label>
                  <input
                    className="ti-form-input"
                    value={
                      formData.invoiceNumber ||
                      (invoiceNumberLoading ? "Loading..." : "")
                    }
                    readOnly
                    title="Auto-generated — cannot be edited"
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">Invoice Date</label>
                  <input
                    className="ti-form-input"
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) =>
                      updateField("invoiceDate", e.target.value)
                    }
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">Date of Supply</label>
                  <input
                    className="ti-form-input"
                    type="date"
                    value={formData.dateOfSupply}
                    onChange={(e) =>
                      updateField("dateOfSupply", e.target.value)
                    }
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">
                    Reverse Charge (Y/N)
                  </label>
                  <select
                    className="ti-form-select"
                    value={formData.reverseCharge}
                    onChange={(e) =>
                      updateField("reverseCharge", e.target.value)
                    }
                  >
                    <option value="NO">NO</option>
                    <option value="YES">YES</option>
                  </select>
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">Vehicle Number</label>
                  <input
                    className="ti-form-input"
                    value={formData.vehicleNumber}
                    onChange={(e) =>
                      updateField("vehicleNumber", e.target.value)
                    }
                    placeholder="e.g. TN23AV9019"
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">Mode of Transport</label>
                  <input
                    className="ti-form-input"
                    value={formData.modeOfTransport}
                    onChange={(e) =>
                      updateField("modeOfTransport", e.target.value)
                    }
                    placeholder="e.g. VAN"
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">Address</label>
                  <select
                    className="ti-form-select"
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

          {/* Loading / Error for customers */}
          {customersLoading && (
            <div className="qt-customer-loading">
              <Loading />
            </div>
          )}

          {!customersLoading && customersError && (
            <div className="qt-customer-error">
              <Error onRetry={loadCustomers} />
            </div>
          )}

          {!customersLoading && !customersError && (
            <>
              {/* 2. Receiver / 3. Consignee */}
              <div className="ti-form-party-grid">
                <section className="ti-form-party-card">
                  <div className="ti-form-party-card-header">
                    <h2 className="ti-form-party-card-title">
                      02 &nbsp; Details of Receiver (Billed To)
                    </h2>
                  </div>

                  <div className="ti-form-party-card-body">
                    <div className="ti-form-field ti-form-customer-select">
                      <label className="ti-form-label">
                        Select Customer
                      </label>
                      <select
                        className="ti-form-select"
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
                      <div className="ti-form-field ti-form-customer-select">
                        <label className="ti-form-label">
                          Mugil Industry — Address
                        </label>
                        <select
                          className="ti-form-select"
                          value={formData.receiverAddressOptionId}
                          onChange={(e) =>
                            handleReceiverAddressOptionChange(
                              e.target.value,
                            )
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

                    <div className="ti-form-grid ti-form-grid--two">
                      <div className="ti-form-field">
                        <label className="ti-form-label">Company Name</label>
                        <input
                          className="ti-form-input"
                          value={formData.receiverDetails.companyName}
                          onChange={(e) =>
                            updateReceiverField(
                              "companyName",
                              e.target.value,
                            )
                          }
                        />
                      </div>

                      <div className="ti-form-field">
                        <label className="ti-form-label">GST Number</label>
                        <input
                          className="ti-form-input"
                          value={formData.receiverDetails.gst}
                          onChange={(e) =>
                            updateReceiverField("gst", e.target.value)
                          }
                        />
                      </div>

                      <div className="ti-form-field ti-form-field--span-2">
                        <label className="ti-form-label">Address</label>
                        <input
                          className="ti-form-input"
                          value={formData.receiverDetails.address}
                          onChange={(e) =>
                            updateReceiverField("address", e.target.value)
                          }
                        />
                      </div>

                      <div className="ti-form-field">
                        <label className="ti-form-label">State</label>
                        <input
                          className="ti-form-input"
                          value={formData.receiverDetails.state}
                          onChange={(e) =>
                            updateReceiverField("state", e.target.value)
                          }
                        />
                      </div>

                      <div className="ti-form-field">
                        <label className="ti-form-label">State Code</label>
                        <input
                          className="ti-form-input"
                          value={formData.receiverDetails.stateCode}
                          onChange={(e) =>
                            updateReceiverField(
                              "stateCode",
                              e.target.value,
                            )
                          }
                        />
                      </div>

                      <div className="ti-form-field">
                        <label className="ti-form-label">
                          Phone Number
                        </label>
                        <input
                          className="ti-form-input"
                          value={formData.receiverDetails.phone}
                          onChange={(e) =>
                            updateReceiverField("phone", e.target.value)
                          }
                        />
                      </div>

                      <div className="ti-form-field">
                        <label className="ti-form-label">Email</label>
                        <input
                          className="ti-form-input"
                          value={formData.receiverDetails.email}
                          onChange={(e) =>
                            updateReceiverField("email", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    {/* Receiver customer action bar */}
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

                <section className="ti-form-party-card">
                  <div className="ti-form-party-card-header">
                    <h2 className="ti-form-party-card-title">
                      03 &nbsp; Details of Consignee (Shipped To)
                    </h2>
                  </div>

                  <div className="ti-form-party-card-body">
                    <div className="ti-form-field ti-form-customer-select">
                      <label className="ti-form-label">
                        Select Customer
                      </label>
                      <select
                        className="ti-form-select"
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
                      <div className="ti-form-field ti-form-customer-select">
                        <label className="ti-form-label">
                          Mugil Industry — Address
                        </label>
                        <select
                          className="ti-form-select"
                          value={formData.consigneeAddressOptionId}
                          onChange={(e) =>
                            handleConsigneeAddressOptionChange(
                              e.target.value,
                            )
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

                    <div className="ti-form-grid ti-form-grid--two">
                      <div className="ti-form-field">
                        <label className="ti-form-label">Company Name</label>
                        <input
                          className="ti-form-input"
                          value={formData.consigneeDetails.companyName}
                          onChange={(e) =>
                            updateConsigneeField(
                              "companyName",
                              e.target.value,
                            )
                          }
                        />
                      </div>

                      <div className="ti-form-field">
                        <label className="ti-form-label">GST</label>
                        <input
                          className="ti-form-input"
                          value={formData.consigneeDetails.gst}
                          onChange={(e) =>
                            updateConsigneeField("gst", e.target.value)
                          }
                        />
                      </div>

                      <div className="ti-form-field ti-form-field--span-2">
                        <label className="ti-form-label">Address</label>
                        <input
                          className="ti-form-input"
                          value={formData.consigneeDetails.address}
                          onChange={(e) =>
                            updateConsigneeField(
                              "address",
                              e.target.value,
                            )
                          }
                        />
                      </div>

                      <div className="ti-form-field">
                        <label className="ti-form-label">State</label>
                        <input
                          className="ti-form-input"
                          value={formData.consigneeDetails.state}
                          onChange={(e) =>
                            updateConsigneeField("state", e.target.value)
                          }
                        />
                      </div>

                      <div className="ti-form-field">
                        <label className="ti-form-label">State Code</label>
                        <input
                          className="ti-form-input"
                          value={formData.consigneeDetails.stateCode}
                          onChange={(e) =>
                            updateConsigneeField(
                              "stateCode",
                              e.target.value,
                            )
                          }
                        />
                      </div>

                      <div className="ti-form-field">
                        <label className="ti-form-label">
                          Phone Number
                        </label>
                        <input
                          className="ti-form-input"
                          value={formData.consigneeDetails.phone}
                          onChange={(e) =>
                            updateConsigneeField("phone", e.target.value)
                          }
                        />
                      </div>

                      <div className="ti-form-field">
                        <label className="ti-form-label">Email</label>
                        <input
                          className="ti-form-input"
                          value={formData.consigneeDetails.email}
                          onChange={(e) =>
                            updateConsigneeField("email", e.target.value)
                          }
                        />
                      </div>
                    </div>

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

          {/* 4. Place of Supply */}
          <section className="ti-form-section">
            <div className="ti-form-section-header">
              <span className="ti-form-section-number">04</span>
              <h2 className="ti-form-section-title">Place of Supply</h2>
            </div>

            <div className="ti-form-section-body">
              <div className="ti-form-grid ti-form-grid--two">
                <div className="ti-form-field">
                  <label className="ti-form-label">
                    Place of Supply (State)
                  </label>
                  <input
                    className="ti-form-input"
                    value={formData.placeOfSupplyState}
                    onChange={(e) =>
                      updateField("placeOfSupplyState", e.target.value)
                    }
                    placeholder="Auto from Consignee — editable"
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">
                    Place of Supply (State Code)
                  </label>
                  <input
                    className="ti-form-input"
                    value={formData.placeOfSupplyStateCode}
                    onChange={(e) =>
                      updateField(
                        "placeOfSupplyStateCode",
                        e.target.value,
                      )
                    }
                    placeholder="Auto from Consignee — editable"
                  />
                </div>

                <div className="ti-form-field ti-form-field--span-2">
                  <label className="ti-form-label">
                    Name & Code of State (Enter Manually)
                  </label>
                  <input
                    className="ti-form-input"
                    value={formData.stateNameCode}
                    onChange={(e) =>
                      updateField("stateNameCode", e.target.value)
                    }
                    placeholder="e.g. Tamilnadu & 33"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 5. Invoice Items */}
          <section className="ti-form-section">
            <div className="ti-form-section-header">
              <span className="ti-form-section-number">05</span>
              <h2 className="ti-form-section-title">Invoice Items</h2>
            </div>

            <div className="ti-form-section-body">
              <div className="ti-form-items-wrapper">
                <table className="ti-form-items-table">
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
                        <td className="ti-form-item-sl">{idx + 1}</td>

                        <td>
                          <input
                            className="ti-form-item-input"
                            value={it.description}
                            onChange={(e) =>
                              updateItem(
                                it.id,
                                "description",
                                e.target.value,
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            className="ti-form-item-input"
                            value={it.hsn}
                            onChange={(e) =>
                              updateItem(it.id, "hsn", e.target.value)
                            }
                          />
                        </td>

                        <td>
                          <input
                            className="ti-form-item-input ti-form-item-number"
                            type="number"
                            value={it.quantity}
                            onChange={(e) =>
                              updateItem(
                                it.id,
                                "quantity",
                                e.target.value,
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            className="ti-form-item-input"
                            value={it.unit}
                            onChange={(e) =>
                              updateItem(it.id, "unit", e.target.value)
                            }
                            placeholder="Mtrs"
                          />
                        </td>

                        <td>
                          <input
                            className="ti-form-item-input ti-form-item-number"
                            type="number"
                            value={it.rate}
                            onChange={(e) =>
                              updateItem(it.id, "rate", e.target.value)
                            }
                          />
                        </td>

                        <td className="ti-form-item-amount">
                          ₹
                          {it.amount.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </td>

                        <td className="ti-form-row-actions">
                          <button
                            type="button"
                            className="ti-form-row-btn"
                            onClick={() => duplicateRow(it.id)}
                          >
                            Duplicate
                          </button>

                          <button
                            type="button"
                            className="ti-form-row-btn ti-form-row-btn--delete"
                            onClick={() => deleteRow(it.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                className="ti-form-add-row"
                onClick={addRow}
              >
                + Add Row
              </button>
            </div>
          </section>

          {/* 6. Amount Summary */}
          <section className="ti-form-section">
            <div className="ti-form-section-header">
              <span className="ti-form-section-number">06</span>
              <h2 className="ti-form-section-title">Amount Summary</h2>
            </div>

            <div className="ti-form-section-body">
              <div className="ti-form-summary-layout">
                <div className="ti-form-tax-grid">
                  <div className="ti-form-field">
                    <label className="ti-form-label">Subtotal</label>
                    <input
                      className="ti-form-input"
                      value={subtotal.toFixed(2)}
                      readOnly
                    />
                  </div>

                  <div className="ti-form-field">
                    <label className="ti-form-label">CGST %</label>
                    <input
                      className="ti-form-input"
                      type="number"
                      value={formData.cgstPct}
                      onChange={(e) =>
                        updateField("cgstPct", e.target.value)
                      }
                    />
                  </div>

                  <div className="ti-form-field">
                    <label className="ti-form-label">CGST Amount</label>
                    <input
                      className="ti-form-input"
                      value={cgstAmount.toFixed(2)}
                      readOnly
                    />
                  </div>

                  <div className="ti-form-field">
                    <label className="ti-form-label">SGST %</label>
                    <input
                      className="ti-form-input"
                      type="number"
                      value={formData.sgstPct}
                      onChange={(e) =>
                        updateField("sgstPct", e.target.value)
                      }
                    />
                  </div>

                  <div className="ti-form-field">
                    <label className="ti-form-label">SGST Amount</label>
                    <input
                      className="ti-form-input"
                      value={sgstAmount.toFixed(2)}
                      readOnly
                    />
                  </div>

                  <div className="ti-form-field">
                    <label className="ti-form-label">IGST %</label>
                    <input
                      className="ti-form-input"
                      type="number"
                      value={formData.igstPct}
                      onChange={(e) =>
                        updateField("igstPct", e.target.value)
                      }
                    />
                  </div>

                  <div className="ti-form-field">
                    <label className="ti-form-label">IGST Amount</label>
                    <input
                      className="ti-form-input"
                      value={igstAmount.toFixed(2)}
                      readOnly
                    />
                  </div>

                  <div className="ti-form-field">
                    <label className="ti-form-label">Rounded Off</label>
                    <input
                      className="ti-form-input"
                      value={roundedOffAuto.toFixed(2)}
                      readOnly
                    />
                  </div>
                </div>

                <div className="ti-form-grand-total">
                  <div className="ti-form-grand-total-header">
                    Grand Total
                  </div>

                  <div className="ti-form-grand-total-body">
                    <p className="ti-form-total-label">Grand Total</p>

                    <p className="ti-form-total-value">
                      ₹
                      {grandTotal.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>

                    <div className="ti-form-amount-words">
                      <div className="ti-form-amount-words-label">
                        Total Amount in Words
                      </div>

                      <div className="ti-form-amount-words-value">
                        {amountInWords}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 7. Bank Details */}
          <section className="ti-form-section">
            <div className="ti-form-section-header">
              <span className="ti-form-section-number">07</span>
              <h2 className="ti-form-section-title">
                Company Bank Details
              </h2>
            </div>

            <div className="ti-form-section-body">
              <div className="ti-form-grid">
                <div className="ti-form-field">
                  <label className="ti-form-label">Bank Name</label>
                  <input
                    className="ti-form-input"
                    value={formData.bankName}
                    onChange={(e) =>
                      updateField("bankName", e.target.value)
                    }
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">Account Number</label>
                  <input
                    className="ti-form-input"
                    value={formData.accountNumber}
                    onChange={(e) =>
                      updateField("accountNumber", e.target.value)
                    }
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">Branch</label>
                  <input
                    className="ti-form-input"
                    value={formData.branch}
                    onChange={(e) => updateField("branch", e.target.value)}
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">IFSC</label>
                  <input
                    className="ti-form-input"
                    value={formData.ifsc}
                    onChange={(e) => updateField("ifsc", e.target.value)}
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">PAN</label>
                  <input
                    className="ti-form-input"
                    value={COMPANY.pan}
                    readOnly
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 8. Declaration */}
          <section className="ti-form-section">
            <div className="ti-form-section-header">
              <span className="ti-form-section-number">08</span>
              <h2 className="ti-form-section-title">Declaration</h2>
            </div>

            <div className="ti-form-section-body">
              <textarea
                className="ti-form-textarea"
                rows={4}
                value={formData.declaration}
                onChange={(e) =>
                  updateField("declaration", e.target.value)
                }
              />
            </div>
          </section>

          {/* 9. Enclosures */}
          <section className="ti-form-section">
            <div className="ti-form-section-header">
              <span className="ti-form-section-number">09</span>
              <h2 className="ti-form-section-title">Enclosures</h2>
            </div>

            <div className="ti-form-section-body">
              <div className="ti-form-enclosure-list">
                {Object.keys(formData.enclosures).map((label) => (
                  <label key={label} className="ti-form-checkbox">
                    <input
                      type="checkbox"
                      checked={formData.enclosures[label]}
                      onChange={() => toggleEnclosure(label)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </section>

          <div className="ti-form-actions">
            <button
              type="button"
              className="ti-form-preview-btn"
              onClick={goToPrint}
              disabled={submitting || invoiceNumberLoading}
            >
              {submitting ? "Saving..." : "Preview Invoice"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}