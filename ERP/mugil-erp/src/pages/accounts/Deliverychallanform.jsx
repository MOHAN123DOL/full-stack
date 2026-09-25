import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "./Deliverychallanform.css";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const DRAFT_KEY = "mei-erp-delivery-challan-draft";

const DC_CUSTOMERS_ENDPOINT = "/erp/delivery-challan-customers/";
const DC_NEXT_NUMBER_ENDPOINT = "/erp/delivery-challans/next-number/";
const DC_SAVE_ENDPOINT = "/erp/delivery-challans/";

/* Single generic error message for every failure. */
const GENERIC_ERROR = "Something went wrong. Please try again.";

/* ========================================================================
   COMPANY ADDRESSES
   ======================================================================== */

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

/* ========================================================================
   HELPERS — ITEMS
   ======================================================================== */

function generateItemId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyItem() {
  return {
    id: generateItemId(),
    description: "",
    quantity: "",
    rate: "",
    remarks: "",
  };
}

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_CUSTOMER = {
  companyName: "",
  address: "",
  contactPerson: "",
  phone: "",
  gstNumber: "",
  returnable: false,
};

function createEmptyFormData() {
  return {
    dcNumber: "",
    dcDate: getTodayISO(),
    poNumber: "",
    poDate: "",
    billNumber: "",
    billDate: "",
    deliveryAt: "",
    companyAddressId: "unit1",
    customer: { ...EMPTY_CUSTOMER },
    items: [createEmptyItem()],
    amountInWords: "",
    preparedBy: "",
  };
}

/* ========================================================================
   AMOUNT IN WORDS — INDIAN NUMBERING
   ======================================================================== */

const ONES = [
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

const TENS = [
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

function twoDigitsToWords(n) {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${TENS[tens]}${ones ? " " + ONES[ones] : ""}`.trim();
}

function threeDigitsToWords(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let out = "";
  if (hundreds) out += `${ONES[hundreds]} Hundred`;
  if (rest) out += `${out ? " " : ""}${twoDigitsToWords(rest)}`;
  return out;
}

function numberToIndianWords(num) {
  if (!Number.isFinite(num) || num < 0) return "";
  if (num === 0) return "Zero";

  const integerPart = Math.floor(num);
  if (integerPart === 0) return "Zero";

  let n = integerPart;
  const parts = [];

  const crore = Math.floor(n / 10000000);
  n %= 10000000;

  const lakh = Math.floor(n / 100000);
  n %= 100000;

  const thousand = Math.floor(n / 1000);
  n %= 1000;

  const hundred = n;

  if (crore) parts.push(`${numberToIndianWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitsToWords(hundred));

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function amountToWords(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return "";

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let words = "Rupees " + numberToIndianWords(rupees);

  if (paise > 0) {
    words += " and " + twoDigitsToWords(paise) + " Paise";
  }

  words += " Only";
  return words;
}

/* ========================================================================
   NORMALIZERS
   ======================================================================== */

const normalizeCustomer = (customer) => ({
  companyName: customer?.companyName ?? "",
  address: customer?.address ?? "",
  contactPerson: customer?.contactPerson ?? "",
  phone: customer?.phone ?? "",
  gstNumber: customer?.gstNumber ?? "",
  returnable: customer?.returnable ?? false,
});

const normalizeFormData = (raw) => {
  const base = createEmptyFormData();
  const source = raw || {};

  return {
    ...base,
    ...source,

    dcNumber: source.dcNumber ?? "",
    dcDate: source.dcDate ?? base.dcDate,
    poNumber: source.poNumber ?? "",
    poDate: source.poDate ?? "",
    billNumber: source.billNumber ?? "",
    billDate: source.billDate ?? "",
    deliveryAt: source.deliveryAt ?? "",
    companyAddressId: source.companyAddressId ?? "unit1",

    customer: normalizeCustomer(source.customer),

    items:
      Array.isArray(source.items) && source.items.length
        ? source.items
        : base.items,

    amountInWords: source.amountInWords ?? "",
    preparedBy: source.preparedBy ?? "",
  };
};

/* ========================================================================
   BACKEND <-> FRONTEND MAPPING
   ======================================================================== */

const customerToPayload = (customer) => ({
  company_name: customer?.companyName?.trim() || "",
  address: customer?.address?.trim() || "",
  contact_person: customer?.contactPerson?.trim() || "",
  phone: customer?.phone?.trim() || "",
  gst_number: customer?.gstNumber?.trim() || "",
});

const backendToCustomer = (customer) => ({
  companyName: customer?.company_name || "",
  address: customer?.address || "",
  contactPerson: customer?.contact_person || "",
  phone: customer?.phone || "",
  gstNumber: customer?.gst_number || "",
  returnable: false,
});

const customersAreEqual = (a, b) => {
  if (!a || !b) return false;
  const keys = [
    "companyName",
    "address",
    "contactPerson",
    "phone",
    "gstNumber",
  ];
  return keys.every(
    (k) => String(a[k] || "").trim() === String(b[k] || "").trim(),
  );
};

/* ========================================================================
   COMPONENT
   ======================================================================== */

export default function DeliveryChallanForm() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // ============================================================
  // REPORT VIEW MODE
  // ============================================================
  const reportMode = location.state?.mode;
  const reportNumber = location.state?.documentNumber;

  const [numberChoice, setNumberChoice] = useState(
    reportMode === "view" && reportNumber ? null : "auto",
  );

  const [data, setData] = useState(() =>
    normalizeFormData(createEmptyFormData()),
  );

  const [errors, setErrors] = useState({});
  const [savedAt, setSavedAt] = useState(null);

  // Flag: user manually edited amountInWords? Then stop auto-syncing.
  const [amountInWordsManual, setAmountInWordsManual] = useState(false);

  // Customers
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [originalCustomer, setOriginalCustomer] = useState(null);

  // Customer action
  const [customerAction, setCustomerAction] = useState(null);
  const [customerActionError, setCustomerActionError] = useState("");

  // DC number + submit
  const [dcNumberLoading, setDcNumberLoading] = useState(false);
  const [dcNumberError, setDcNumberError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  /* ============================================================
     LOAD LOCAL DRAFT
     ============================================================ */
  useEffect(() => {
    // Skip draft restore when opened from Reports
    if (reportMode === "view" && reportNumber) return;

    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      setData(normalizeFormData(parsed));
      if (parsed?.amountInWords) {
        setAmountInWordsManual(true);
      }
    } catch {
      // ignore
    }
  }, [reportMode, reportNumber]);

  /* ============================================================
     LOAD CUSTOMERS
     ============================================================ */
  const loadCustomers = useCallback(async () => {
    if (!accessToken) return [];

    try {
      setCustomersLoading(true);
      setCustomersError("");

      const response = await api.get(DC_CUSTOMERS_ENDPOINT, {
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
      console.error("Failed to load delivery challan customers:", error);
      setCustomers([]);
      setCustomersError(GENERIC_ERROR);
      return [];
    } finally {
      setCustomersLoading(false);
    }
  }, [accessToken]);

  /* ============================================================
     LOAD DC NUMBER
     ============================================================ */
  const loadDcNumber = useCallback(async () => {
    if (!accessToken) return;

    try {
      setDcNumberLoading(true);
      setDcNumberError("");

      const response = await api.get(DC_NEXT_NUMBER_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const responseData = response.data;

      if (!responseData?.success || !responseData?.dc_number) {
        throw new Error("bad response");
      }

      const dcNumber = responseData.dc_number;
      const serverData = responseData.data;

      if (serverData) {
        setData((previous) =>
          normalizeFormData({
            ...previous,
            dcNumber,
            dcDate: serverData.dc_date || previous.dcDate,
            poNumber: serverData.po_number ?? previous.poNumber,
            poDate: serverData.po_date ?? previous.poDate,
            billNumber: serverData.bill_number ?? previous.billNumber,
            billDate: serverData.bill_date ?? previous.billDate,
            deliveryAt: serverData.delivery_at ?? previous.deliveryAt,
            companyAddressId:
              serverData.company_address_id ?? previous.companyAddressId,
            amountInWords: serverData.amount_in_words ?? previous.amountInWords,
            preparedBy: serverData.prepared_by ?? previous.preparedBy,
            items: Array.isArray(serverData.items)
              ? serverData.items
              : previous.items,
            customer: serverData.customer
              ? {
                  ...backendToCustomer(serverData.customer),
                  returnable:
                    serverData.returnable ??
                    previous.customer?.returnable ??
                    false,
                }
              : previous.customer,
          }),
        );

        if (serverData.customer) {
          const customerFromServer = backendToCustomer(serverData.customer);
          setSelectedCustomerId(String(serverData.customer.id || ""));
          setOriginalCustomer(customerFromServer);
        }
      } else {
        setData((previous) =>
          normalizeFormData({
            ...previous,
            dcNumber,
          }),
        );
      }
    } catch (error) {
      console.error("Failed to load delivery challan data:", error);
      setDcNumberError(GENERIC_ERROR);
    } finally {
      setDcNumberLoading(false);
    }
  }, [accessToken]);

  /* ============================================================
     REPORT-VIEW: NUMBER CHOICE HANDLERS
     ============================================================ */
  const handleUseExistingNumber = useCallback(() => {
    setNumberChoice("existing");
    setData((prev) => normalizeFormData({ ...prev, dcNumber: reportNumber }));
    setDcNumberError("");
  }, [reportNumber]);

  const handleUseNewNumber = useCallback(async () => {
    setNumberChoice("new");
    if (accessToken) {
      await loadDcNumber();
    }
  }, [accessToken, loadDcNumber]);

  /* ============================================================
     BOOTSTRAP
     ============================================================ */
  useEffect(() => {
    if (!accessToken) return;
    loadCustomers();

    const cameFromReportWithNumber = reportMode === "view" && !!reportNumber;

    if (cameFromReportWithNumber) {
      setData((prev) => normalizeFormData({ ...prev, dcNumber: reportNumber }));
    } else {
      loadDcNumber();
    }
  }, [accessToken, loadCustomers, loadDcNumber, reportMode, reportNumber]);

  /* ============================================================
     SYNC DROPDOWN AFTER CUSTOMERS LOAD
     ============================================================ */
  useEffect(() => {
    if (!customers.length) return;

    const companyName = data.customer?.companyName?.trim() || "";
    if (!companyName) return;

    const customer = customers.find(
      (item) =>
        String(item.company_name || "")
          .trim()
          .toLowerCase() === companyName.toLowerCase(),
    );

    if (customer) {
      setSelectedCustomerId(String(customer.id));
      setOriginalCustomer((prev) =>
        prev ? prev : backendToCustomer(customer),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  /* ============================================================
     BASIC SETTERS
     ============================================================ */
  const set = (key, value) => setData((d) => ({ ...d, [key]: value }));

  const updateCustomerField = (field, value) =>
    setData((d) => ({
      ...d,
      customer: { ...d.customer, [field]: value },
    }));

  const updateItem = (id, field, value) =>
    setData((d) => ({
      ...d,
      items: d.items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));

  const addRow = () =>
    setData((d) => ({ ...d, items: [...d.items, createEmptyItem()] }));

  const duplicateRow = (id) =>
    setData((d) => {
      const index = d.items.findIndex((item) => item.id === id);
      if (index === -1) return d;
      const clone = { ...d.items[index], id: generateItemId() };
      const items = [...d.items];
      items.splice(index + 1, 0, clone);
      return { ...d, items };
    });

  const deleteRow = (id) =>
    setData((d) => {
      if (d.items.length <= 1) return d;
      return { ...d, items: d.items.filter((item) => item.id !== id) };
    });

  /* ============================================================
     AMOUNT CALCULATION
     ============================================================ */
  const dcSubtotal = useMemo(() => {
    return data.items.reduce((total, item) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      return total + qty * rate;
    }, 0);
  }, [data.items]);

  /* ============================================================
     AUTO-SYNC AMOUNT IN WORDS
     ============================================================ */
  useEffect(() => {
    if (amountInWordsManual) return;

    const words = dcSubtotal > 0 ? amountToWords(dcSubtotal) : "";

    setData((prev) => {
      if (prev.amountInWords === words) return prev;
      return { ...prev, amountInWords: words };
    });
  }, [dcSubtotal, amountInWordsManual]);

  const handleAmountInWordsChange = (value) => {
    setAmountInWordsManual(true);
    set("amountInWords", value);
  };

  const handleRegenerateAmountInWords = () => {
    setAmountInWordsManual(false);
    const words = dcSubtotal > 0 ? amountToWords(dcSubtotal) : "";
    set("amountInWords", words);
  };

  /* ============================================================
     DERIVED — CUSTOMER
     ============================================================ */
  const matchedCustomer = useMemo(() => {
    const name = data.customer?.companyName?.trim().toLowerCase() || "";
    if (!name) return null;
    return (
      customers.find(
        (c) =>
          String(c.company_name || "")
            .trim()
            .toLowerCase() === name,
      ) || null
    );
  }, [customers, data.customer?.companyName]);

  const customerIsModified = useMemo(() => {
    if (!originalCustomer) return false;
    return !customersAreEqual(data.customer, originalCustomer);
  }, [originalCustomer, data.customer]);

  const availableAction = useMemo(() => {
    const hasName = !!data.customer?.companyName?.trim();

    if (selectedCustomerId && originalCustomer && customerIsModified) {
      return "update";
    }

    if (!matchedCustomer && hasName) {
      return "create";
    }

    return null;
  }, [
    selectedCustomerId,
    originalCustomer,
    customerIsModified,
    matchedCustomer,
    data.customer?.companyName,
  ]);

  /* ============================================================
     CUSTOMER SELECTION
     ============================================================ */
  const handleCustomerChange = useCallback(
    (customerId) => {
      setSelectedCustomerId(customerId);
      setCustomerActionError("");

      if (!customerId) {
        setOriginalCustomer(null);
        setData((previous) =>
          normalizeFormData({
            ...previous,
            customer: { ...EMPTY_CUSTOMER },
          }),
        );

        setErrors((previous) => {
          const next = { ...previous };
          delete next.customerCompany;
          return next;
        });
        return;
      }

      const customer = customers.find(
        (item) => String(item.id) === String(customerId),
      );
      if (!customer) return;

      const customerFromList = {
        ...backendToCustomer(customer),
        returnable: data.customer?.returnable ?? false,
      };

      setOriginalCustomer(customerFromList);

      setData((previous) =>
        normalizeFormData({
          ...previous,
          customer: customerFromList,
        }),
      );

      setErrors((previous) => {
        const next = { ...previous };
        delete next.customerCompany;
        return next;
      });
    },
    [customers, data.customer?.returnable],
  );

  /* ============================================================
     CREATE CUSTOMER
     ============================================================ */
  const handleCreateCustomer = useCallback(async () => {
    if (!accessToken) {
      setCustomerActionError("Your session has expired. Please login again.");
      return;
    }

    const customer = data.customer || {};
    const companyName = customer.companyName?.trim() || "";

    if (!companyName) {
      setCustomerActionError("Enter the customer/company name first.");
      return;
    }

    const alreadyExists = customers.some(
      (c) =>
        String(c.company_name || "")
          .trim()
          .toLowerCase() === companyName.toLowerCase(),
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
        DC_CUSTOMERS_ENDPOINT,
        customerToPayload(customer),
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      const responseData = response.data;

      if (!responseData?.success || !responseData?.data) {
        throw new Error("bad response");
      }

      const newCustomer = responseData.data;

      setCustomers((previous) => [...previous, newCustomer]);
      setSelectedCustomerId(String(newCustomer.id));

      const customerFromServer = {
        ...backendToCustomer(newCustomer),
        returnable: data.customer?.returnable ?? false,
      };
      setOriginalCustomer(customerFromServer);

      setData((previous) =>
        normalizeFormData({
          ...previous,
          customer: customerFromServer,
        }),
      );
    } catch (error) {
      console.error("Failed to create delivery challan customer:", error);
      setCustomerActionError(GENERIC_ERROR);
    } finally {
      setCustomerAction(null);
    }
  }, [accessToken, customers, data.customer]);

  /* ============================================================
     UPDATE CUSTOMER
     ============================================================ */
  const handleUpdateCustomer = useCallback(async () => {
    if (!accessToken) {
      setCustomerActionError("Your session has expired. Please login again.");
      return;
    }

    if (!selectedCustomerId) {
      setCustomerActionError("Select a customer before updating.");
      return;
    }

    const customer = data.customer || {};
    const companyName = customer.companyName?.trim() || "";

    if (!companyName) {
      setCustomerActionError("Customer company name is required.");
      return;
    }

    const nameClash = customers.some(
      (c) =>
        String(c.id) !== String(selectedCustomerId) &&
        String(c.company_name || "")
          .trim()
          .toLowerCase() === companyName.toLowerCase(),
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
        `${DC_CUSTOMERS_ENDPOINT}${selectedCustomerId}/`,
        customerToPayload(customer),
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

      const customerFromServer = {
        ...backendToCustomer(updatedCustomer),
        returnable: data.customer?.returnable ?? false,
      };
      setOriginalCustomer(customerFromServer);

      setData((previous) =>
        normalizeFormData({
          ...previous,
          customer: customerFromServer,
        }),
      );
    } catch (error) {
      console.error("Failed to update delivery challan customer:", error);
      setCustomerActionError(GENERIC_ERROR);
    } finally {
      setCustomerAction(null);
    }
  }, [accessToken, customers, data.customer, selectedCustomerId]);

  /* ============================================================
     RESET CUSTOMER
     ============================================================ */
  const handleResetCustomer = useCallback(() => {
    if (!originalCustomer) return;
    setCustomerActionError("");
    setData((previous) =>
      normalizeFormData({
        ...previous,
        customer: {
          ...originalCustomer,
          returnable: previous.customer?.returnable ?? false,
        },
      }),
    );
  }, [originalCustomer]);

  /* ============================================================
     VALIDATION
     ============================================================ */
  const validate = () => {
    const next = {};

    if (!data.dcNumber?.trim()) {
      next.dcNumber = "Delivery challan number is still loading.";
    }

    if (!data.dcDate) {
      next.dcDate = "Delivery Challan Date is required";
    }

    const customerName = data.customer?.companyName?.trim() || "";
    if (!customerName) {
      next.customerCompany = "Customer company name is required";
    }

    const hasItem = data.items.some((it) => it.description?.trim());
    if (!hasItem) {
      next.items = "Add at least one item with a description";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /* ============================================================
     SAVE LOCAL DRAFT
     ============================================================ */
  const saveDraft = () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    setSavedAt(new Date());
  };

  /* ============================================================
     NEW / CLEAR
     ============================================================ */
  const clearForm = async () => {
    if (!window.confirm("Clear all fields and start a new Delivery Challan?"))
      return;

    localStorage.removeItem(DRAFT_KEY);

    const fresh = normalizeFormData(createEmptyFormData());

    setData(fresh);
    setErrors({});
    setSavedAt(null);
    setSelectedCustomerId("");
    setOriginalCustomer(null);
    setCustomerActionError("");
    setSubmitError("");
    setDcNumberError("");
    setAmountInWordsManual(false);
    setNumberChoice("auto");

    if (accessToken) {
      await loadDcNumber();
    }
  };

  /* ============================================================
     SAVE DC TO BACKEND
     ============================================================ */
  const saveDcToBackend = async () => {
    if (!accessToken) {
      setSubmitError("Your session has expired. Please login again.");
      return null;
    }

    const customerName = data.customer?.companyName?.trim() || "";

    const payload = {
      dc_number: data.dcNumber,
      dc_date: data.dcDate,
      customer: customerName,

      po_number: data.poNumber || "",
      po_date: data.poDate || null,

      bill_number: data.billNumber || "",
      bill_date: data.billDate || null,

      delivery_at: data.deliveryAt || "",
      company_address_id: data.companyAddressId || "unit1",
      returnable: !!data.customer?.returnable,

      items: data.items || [],

      amount_in_words: data.amountInWords || "",
      prepared_by: data.preparedBy || "",

      status: data.status || "DRAFT",
    };

    try {
      setSubmitting(true);
      setSubmitError("");

      const response = await api.post(DC_SAVE_ENDPOINT, payload, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.data?.success) {
        throw new Error("bad response");
      }

      const savedDc = response.data?.data;

      if (!savedDc) {
        throw new Error("bad response");
      }

      return savedDc;
    } catch (error) {
      console.error("Delivery challan creation failed:", error);
      setSubmitError(GENERIC_ERROR);
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================================================
     GO TO PREVIEW
     ============================================================ */
  const goToPreview = async () => {
    if (submitting) return;
    setSubmitError("");

    if (!validate()) return;

    const savedDc = await saveDcToBackend();
    if (!savedDc) return;

    const previewData = normalizeFormData({
      ...data,
      dcNumber: savedDc.dc_number || data.dcNumber,
      dcDate: savedDc.dc_date || data.dcDate,
    });

    setData(previewData);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(previewData));
    setSavedAt(new Date());

    const dataParam = encodeURIComponent(JSON.stringify(previewData));
    window.location.href = `/DeliveryChallanPrint.html?data=${dataParam}`;
  };

  /* ============================================================
     SELECTED ADDRESS (for preview info)
     ============================================================ */
  const selectedAddress = useMemo(
    () =>
      COMPANY_ADDRESSES.find((a) => a.id === data.companyAddressId) ||
      COMPANY_ADDRESSES[0],
    [data.companyAddressId],
  );

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
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <h2>Delivery Challan</h2>

          <div className="form-header-actions">
            {savedAt && (
              <span className="form-status form-status-meta">
                Last saved: {savedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* TOP ACTIONS */}
        <div
          className="form-actions-top"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={clearForm}
          >
            + New Challan
          </button>

          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={clearForm}
            style={{
              color: "#dc3545",
              borderColor: "#dc3545",
            }}
          >
            Clear Draft
          </button>

          <button
            type="button"
            className="btn btn-primary top-preview-btn"
            onClick={goToPreview}
            disabled={submitting || dcNumberLoading || !data.dcNumber}
            style={{ marginLeft: "auto" }}
          >
            {submitting ? "Saving..." : "Preview & Print"}
          </button>
        </div>

        {/* ---------- NUMBER CHOICE BANNER ---------- */}
        {reportMode === "view" && reportNumber && numberChoice === null && (
          <div className="qt-alert">
            <div className="qt-alert__icon">?</div>
            <div className="qt-alert__content">
              <strong>
                This Delivery Challan already exists: {reportNumber}
              </strong>
              <span>
                Do you want to edit the existing challan (same number), or
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
              <strong>Editing existing challan {reportNumber}</strong>
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
                Creating a new challan: {data.dcNumber || "Loading..."}
              </strong>
              <span>
                A fresh number from the current sequence will be used.
              </span>
            </div>
          </div>
        )}

        {/* VALIDATION ALERT */}
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

        {/* API ERROR */}
        {(submitError || dcNumberError) && (
          <div className="qt-alert">
            <div className="qt-alert__icon">!</div>
            <div className="qt-alert__content">
              <strong>Delivery Challan API Error</strong>
              <span>{submitError || dcNumberError}</span>
            </div>

            {dcNumberError && !dcNumberLoading && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={loadDcNumber}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* SECTION 1: DC DETAILS */}
        <section className="form-section">
          <h3 className="form-section-title">Delivery Challan Details</h3>

          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="form-group">
              <label className="form-label">DC Number</label>
              <input
                type="text"
                className="form-input form-input-readonly"
                value={data.dcNumber || (dcNumberLoading ? "Loading..." : "")}
                readOnly
                disabled
                title="Auto-generated — cannot be edited"
                style={{
                  backgroundColor: "var(--bg-surface-muted)",
                  color: "var(--text-secondary)",
                  cursor: "not-allowed",
                }}
              />
              {errors.dcNumber && (
                <span className="form-error-text">{errors.dcNumber}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">DC Date</label>
              <input
                type="date"
                className="form-input"
                value={data.dcDate}
                onChange={(e) => set("dcDate", e.target.value)}
              />
              {errors.dcDate && (
                <span className="form-error-text">{errors.dcDate}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">PO / LO / WO Number</label>
              <input
                type="text"
                className="form-input"
                value={data.poNumber}
                onChange={(e) => set("poNumber", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">PO / LO / WO Date</label>
              <input
                type="date"
                className="form-input"
                value={data.poDate}
                onChange={(e) => set("poDate", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Bill Number</label>
              <input
                type="text"
                className="form-input"
                value={data.billNumber}
                onChange={(e) => set("billNumber", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Bill Date</label>
              <input
                type="date"
                className="form-input"
                value={data.billDate}
                onChange={(e) => set("billDate", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Delivery At</label>
              <input
                type="text"
                className="form-input"
                value={data.deliveryAt}
                onChange={(e) => set("deliveryAt", e.target.value)}
              />
            </div>

            <div className="form-group form-group-wide">
              <label className="form-label">Address</label>
              <select
                className="form-input"
                value={data.companyAddressId}
                onChange={(e) => set("companyAddressId", e.target.value)}
              >
                {COMPANY_ADDRESSES.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.label}: {address.address}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* SECTION 2: CUSTOMER DETAILS */}
        <section className="form-section">
          <h3 className="form-section-title">Customer Details</h3>

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
              {customers.length > 0 && (
                <div className="form-grid">
                  <div className="form-group form-group-wide">
                    <label className="form-label">
                      Select Existing Customer
                    </label>

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
                  </div>
                </div>
              )}

              {customers.length === 0 && (
                <div className="qt-customer-empty">
                  No saved customers. You can enter customer details manually
                  below.
                </div>
              )}

              {/* CUSTOMER FORM */}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Company Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={data.customer.companyName}
                    onChange={(e) =>
                      updateCustomerField("companyName", e.target.value)
                    }
                    required
                  />
                  {errors.customerCompany && (
                    <span className="form-error-text">
                      {errors.customerCompany}
                    </span>
                  )}
                </div>

                <div className="form-group form-group-wide">
                  <label className="form-label">Address</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={data.customer.address}
                    onChange={(e) =>
                      updateCustomerField("address", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Person</label>
                  <input
                    type="text"
                    className="form-input"
                    value={data.customer.contactPerson}
                    onChange={(e) =>
                      updateCustomerField("contactPerson", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={data.customer.phone}
                    onChange={(e) =>
                      updateCustomerField("phone", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">GST Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={data.customer.gstNumber}
                    onChange={(e) =>
                      updateCustomerField("gstNumber", e.target.value)
                    }
                  />
                </div>

                <div className="form-group returnable-group">
                  <label className="form-label">Returnable?</label>

                  <label className="returnable-checkbox">
                    <input
                      type="checkbox"
                      checked={data.customer.returnable}
                      onChange={(e) =>
                        updateCustomerField("returnable", e.target.checked)
                      }
                    />
                    <span>{data.customer.returnable ? "Yes" : "No"}</span>
                  </label>
                </div>
              </div>

              {/* CUSTOMER ACTION BAR */}
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
                        Save changes to the master customer record, or reset to
                        the saved values.
                      </span>
                    </>
                  )}

                  {availableAction === "create" && (
                    <>
                      <strong>New customer</strong>
                      <span>
                        No matching customer exists. Create it to reuse in
                        future delivery challans.
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
                        onClick={handleResetCustomer}
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

        {/* SECTION 3: ITEMS */}
        <section className="form-section">
          <h3 className="form-section-title">Items</h3>

          <table className="form-table">
            <thead>
              <tr>
                <th>SL No</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Rate Per Piece</th>
                <th>Remarks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>
                    <input
                      type="text"
                      className="form-input"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(item.id, "description", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, "quantity", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input"
                      value={item.rate}
                      onChange={(e) =>
                        updateItem(item.id, "rate", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-input"
                      value={item.remarks}
                      onChange={(e) =>
                        updateItem(item.id, "remarks", e.target.value)
                      }
                    />
                  </td>
                  <td className="form-table-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => duplicateRow(item.id)}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteRow(item.id)}
                      disabled={data.items.length <= 1}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="button" className="btn btn-secondary" onClick={addRow}>
            + Add Row
          </button>

          {errors.items && (
            <span className="form-error-text">{errors.items}</span>
          )}

          {/* SUBTOTAL DISPLAY */}
          <div
            style={{
              marginTop: "12px",
              display: "flex",
              justifyContent: "flex-end",
              gap: "24px",
              fontWeight: 600,
            }}
          >
            <span>Total:</span>
            <span>₹ {dcSubtotal.toFixed(2)}</span>
          </div>
        </section>

        {/* SECTION 4: AMOUNT IN WORDS */}
        <section className="form-section">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "8px",
            }}
          >
            <h3 className="form-section-title" style={{ margin: 0 }}>
              Amount In Words
            </h3>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleRegenerateAmountInWords}
              disabled={dcSubtotal <= 0}
              title="Regenerate from item totals"
            >
              ↻ Regenerate
            </button>
          </div>

          <textarea
            className="form-textarea"
            rows={3}
            value={data.amountInWords}
            onChange={(e) => handleAmountInWordsChange(e.target.value)}
            placeholder="e.g. Rupees Twelve Thousand Five Hundred Only"
          />

          <div
            style={{
              marginTop: "6px",
              fontSize: "12px",
              color: "var(--text-secondary)",
            }}
          >
            {amountInWordsManual
              ? "Manual edit — click Regenerate to sync with item totals."
              : "Auto-generated from item totals (Quantity × Rate)."}
          </div>
        </section>

        {/* SECTION 5: PREPARED BY */}
        <section className="form-section">
          <h3 className="form-section-title">Prepared By</h3>
          <div className="form-group">
            <input
              type="text"
              className="form-input"
              value={data.preparedBy}
              onChange={(e) => set("preparedBy", e.target.value)}
            />
          </div>
        </section>

        {/* FOOTER ACTIONS */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={saveDraft}
          >
            Save Draft
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={goToPreview}
            disabled={submitting || dcNumberLoading || !data.dcNumber}
          >
            {submitting ? "Saving..." : "Preview & Print"}
          </button>
        </div>

        {/* Hidden helper to keep selectedAddress in tree for future use */}
        <span style={{ display: "none" }}>{selectedAddress?.label}</span>
      </div>
    </>
  );
}
