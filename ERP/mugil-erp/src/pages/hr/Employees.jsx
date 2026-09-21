import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import EmployeeForm from "./Employeeform.jsx";
import "./Employee.css";
import Header from "../../components/Header";

/* =====================================================================+
   CONSTANTS — shared master lists used across the employee module.
   In production these would come from lookup/config APIs.
   ========================================================================== */

export const DEPARTMENTS = [
  "Engineering",
  "Production",
  "HR",
  "Sales",
  "Accounts",
];

export const CITIES = [
  "Trichy",
  "Chennai",
  "Madurai",
  "Coimbatore",
  "Bangalore",
];

export const DESIGNATIONS = [
  "Software Engineer",
  "Senior Engineer",
  "Manager",
  "HR Executive",
  "Production Engineer",
  "Sales Executive",
];

export const SKILLS_LIST = [
  "Python",
  "Django",
  "React",
  "Java",
  "Mechanical",
  "Electrical",
  "Welding",
  "CNC",
];

export const EMPLOYMENT_STATUSES = [
  "Active",
  "Inactive",
  "Resigned",
  "Terminated",
  "On Notice",
];

export const EMPLOYMENT_TYPES = [
  "Permanent",
  "Probation",
  "Contract",
  "Temporary",
  "Intern",
  "Consultant",
];

export const GENDERS = ["Male", "Female", "Other"];

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];

export const COUNTRIES = ["India"];

export const STATES = [
  "Tamil Nadu",
  "Karnataka",
  "Kerala",
  "Andhra Pradesh",
  "Telangana",
];

export const DOCUMENT_TYPES = [
  "Resume",
  "Aadhaar",
  "PAN",
  "Offer Letter",
  "Joining Letter",
  "Experience Certificate",
  "Education Certificate",
  "Other",
];

function avatarUrl(name, seed) {
  const colors = [
    "0F766E",
    "1D4ED8",
    "7C3AED",
    "B45309",
    "0369A1",
    "15803D",
    "BE185D",
  ];
  const bg = colors[seed % colors.length];
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&size=128&font-size=0.38&bold=true`;
}

/* ==========================================================================
   MOCK DATA — stand-in for the future REST API. Shape mirrors the
   payload the employee endpoints are expected to return, so swapping
   this state for `fetch()` calls later is a drop-in change.
   ========================================================================== */

const RAW_EMPLOYEES = [
  {
    id: "EMP001",
    employeeCode: "TRX-001",
    firstName: "Mohan",
    lastName: "V",
    gender: "Male",
    dob: "1994-03-12",
    bloodGroup: "B+",
    maritalStatus: "Married",
    mobile: "+91 98765 43210",
    email: "mohan.v@company.com",
    emergencyContactName: "Lakshmi V",
    emergencyContactNumber: "+91 98765 40000",
    department: "Engineering",
    designation: "Software Engineer",
    branch: "Trichy Plant",
    employmentType: "Permanent",
    employmentStatus: "Active",
    reportingManager: "Arun Kumar",
    workLocation: "Trichy HQ",
    joiningDate: "2022-06-01",
    addressLine1: "12 Anna Nagar",
    addressLine2: "",
    country: "India",
    state: "Tamil Nadu",
    city: "Trichy",
    district: "Tiruchirappalli",
    pincode: "620020",
    aadhaar: "",
    pan: "",
    uan: "",
    pf: "",
    esi: "",
    passport: "",
    drivingLicense: "",
    skills: ["Python", "Django", "React"],
    education: [
      {
        id: "ed1",
        degree: "B.E. Computer Science",
        institution: "NIT Trichy",
        specialization: "CSE",
        startYear: "2012",
        endYear: "2016",
        grade: "8.4 CGPA",
      },
    ],
    experience: [
      {
        id: "ex1",
        company: "Zeta Softworks",
        designation: "Jr. Developer",
        startDate: "2016-07-01",
        endDate: "2022-05-20",
        years: "5.9",
        responsibilities: "Built internal tooling and REST services.",
      },
    ],
    bankDetails: {
      accountHolderName: "Mohan V",
      bankName: "HDFC Bank",
      accountNumber: "50100234561234",
      ifsc: "HDFC0001234",
      branch: "Trichy Cantonment",
    },
    documents: [
      {
        id: "doc1",
        type: "Resume",
        number: "",
        issueDate: "",
        expiryDate: "",
        fileName: "mohan_resume.pdf",
      },
    ],
    employmentHistory: [
      {
        id: "h1",
        date: "2023-01-15",
        changeType: "Designation",
        previousValue: "Trainee Engineer",
        newValue: "Software Engineer",
      },
    ],
    archived: false,
  },
  {
    id: "EMP002",
    employeeCode: "CHN-002",
    firstName: "Priya",
    lastName: "Ramesh",
    gender: "Female",
    dob: "1996-08-22",
    bloodGroup: "O+",
    maritalStatus: "Single",
    mobile: "+91 98450 11223",
    email: "priya.ramesh@company.com",
    emergencyContactName: "Ramesh S",
    emergencyContactNumber: "+91 98450 00011",
    department: "HR",
    designation: "HR Executive",
    branch: "Chennai Corporate",
    employmentType: "Permanent",
    employmentStatus: "Active",
    reportingManager: "Divya Menon",
    workLocation: "Chennai HQ",
    joiningDate: "2021-02-15",
    addressLine1: "45 Besant Nagar",
    addressLine2: "Flat 3B",
    country: "India",
    state: "Tamil Nadu",
    city: "Chennai",
    district: "Chennai",
    pincode: "600090",
    aadhaar: "",
    pan: "",
    uan: "",
    pf: "",
    esi: "",
    passport: "",
    drivingLicense: "",
    skills: ["React"],
    education: [
      {
        id: "ed1",
        degree: "MBA HR",
        institution: "Loyola College",
        specialization: "Human Resources",
        startYear: "2017",
        endYear: "2019",
        grade: "8.9 CGPA",
      },
    ],
    experience: [],
    bankDetails: {
      accountHolderName: "Priya Ramesh",
      bankName: "ICICI Bank",
      accountNumber: "00281123456789",
      ifsc: "ICIC0000028",
      branch: "Adyar",
    },
    documents: [],
    employmentHistory: [],
    archived: false,
  },
  {
    id: "EMP003",
    employeeCode: "MDU-003",
    firstName: "Karthik",
    lastName: "Subramanian",
    gender: "Male",
    dob: "1990-11-05",
    bloodGroup: "A+",
    maritalStatus: "Married",
    mobile: "+91 90031 22334",
    email: "karthik.s@company.com",
    emergencyContactName: "Meena K",
    emergencyContactNumber: "+91 90031 00099",
    department: "Production",
    designation: "Production Engineer",
    branch: "Madurai Unit",
    employmentType: "Permanent",
    employmentStatus: "Active",
    reportingManager: "Suresh Babu",
    workLocation: "Madurai Plant",
    joiningDate: "2018-09-10",
    addressLine1: "7 K.K. Nagar",
    addressLine2: "",
    country: "India",
    state: "Tamil Nadu",
    city: "Madurai",
    district: "Madurai",
    pincode: "625020",
    aadhaar: "",
    pan: "",
    uan: "",
    pf: "",
    esi: "",
    passport: "",
    drivingLicense: "",
    skills: ["Mechanical", "CNC"],
    education: [
      {
        id: "ed1",
        degree: "Diploma in Mechanical Engineering",
        institution: "Government Polytechnic Madurai",
        specialization: "Mechanical",
        startYear: "2008",
        endYear: "2011",
        grade: "82%",
      },
    ],
    experience: [
      {
        id: "ex1",
        company: "Southern Forge Ltd",
        designation: "Machine Operator",
        startDate: "2011-06-01",
        endDate: "2018-08-30",
        years: "7.2",
        responsibilities: "CNC machine setup and quality checks.",
      },
    ],
    bankDetails: {
      accountHolderName: "Karthik Subramanian",
      bankName: "SBI",
      accountNumber: "31450098761234",
      ifsc: "SBIN0003145",
      branch: "Madurai Main",
    },
    documents: [],
    employmentHistory: [
      {
        id: "h1",
        date: "2026-03-01",
        changeType: "Department",
        previousValue: "Production",
        newValue: "Engineering",
      },
    ],
    archived: false,
  },
  {
    id: "EMP004",
    employeeCode: "CBE-004",
    firstName: "Divya",
    lastName: "Menon",
    gender: "Female",
    dob: "1988-01-30",
    bloodGroup: "B-",
    maritalStatus: "Married",
    mobile: "+91 99400 55667",
    email: "divya.menon@company.com",
    emergencyContactName: "Anil Menon",
    emergencyContactNumber: "+91 99400 00011",
    department: "HR",
    designation: "Manager",
    branch: "Coimbatore Office",
    employmentType: "Permanent",
    employmentStatus: "Active",
    reportingManager: "CEO Office",
    workLocation: "Coimbatore HQ",
    joiningDate: "2015-04-01",
    addressLine1: "22 RS Puram",
    addressLine2: "",
    country: "India",
    state: "Tamil Nadu",
    city: "Coimbatore",
    district: "Coimbatore",
    pincode: "641002",
    aadhaar: "",
    pan: "",
    uan: "",
    pf: "",
    esi: "",
    passport: "",
    drivingLicense: "",
    skills: [],
    education: [
      {
        id: "ed1",
        degree: "MBA",
        institution: "PSG College",
        specialization: "HR & Ops",
        startYear: "2009",
        endYear: "2011",
        grade: "9.1 CGPA",
      },
    ],
    experience: [],
    bankDetails: {
      accountHolderName: "Divya Menon",
      bankName: "Axis Bank",
      accountNumber: "91200456781234",
      ifsc: "UTIB0000912",
      branch: "RS Puram",
    },
    documents: [],
    employmentHistory: [],
    archived: false,
  },
  {
    id: "EMP005",
    employeeCode: "BLR-005",
    firstName: "Arjun",
    lastName: "Reddy",
    gender: "Male",
    dob: "1997-05-18",
    bloodGroup: "AB+",
    maritalStatus: "Single",
    mobile: "+91 63455 78901",
    email: "arjun.reddy@company.com",
    emergencyContactName: "Sita Reddy",
    emergencyContactNumber: "+91 63455 00022",
    department: "Engineering",
    designation: "Senior Engineer",
    branch: "Bangalore Tech Park",
    employmentType: "Permanent",
    employmentStatus: "On Notice",
    reportingManager: "Arun Kumar",
    workLocation: "Bangalore HQ",
    joiningDate: "2019-01-20",
    addressLine1: "88 Indiranagar 100ft Rd",
    addressLine2: "",
    country: "India",
    state: "Karnataka",
    city: "Bangalore",
    district: "Bangalore Urban",
    pincode: "560038",
    aadhaar: "",
    pan: "",
    uan: "",
    pf: "",
    esi: "",
    passport: "",
    drivingLicense: "",
    skills: ["Java", "React", "Python"],
    education: [
      {
        id: "ed1",
        degree: "B.Tech IT",
        institution: "RV College of Engineering",
        specialization: "Information Tech",
        startYear: "2015",
        endYear: "2019",
        grade: "8.7 CGPA",
      },
    ],
    experience: [],
    bankDetails: {
      accountHolderName: "Arjun Reddy",
      bankName: "Kotak Mahindra",
      accountNumber: "77890012345678",
      ifsc: "KKBK0007789",
      branch: "Indiranagar",
    },
    documents: [],
    employmentHistory: [
      {
        id: "h1",
        date: "2026-06-01",
        changeType: "Designation",
        previousValue: "Engineer",
        newValue: "Senior Engineer",
      },
    ],
    archived: false,
  },
  {
    id: "EMP006",
    employeeCode: "TRX-006",
    firstName: "Saranya",
    lastName: "Elango",
    gender: "Female",
    dob: "1999-09-09",
    bloodGroup: "O-",
    maritalStatus: "Single",
    mobile: "+91 87654 32109",
    email: "saranya.e@company.com",
    emergencyContactName: "Elango R",
    emergencyContactNumber: "+91 87654 00001",
    department: "Sales",
    designation: "Sales Executive",
    branch: "Trichy Plant",
    employmentType: "Probation",
    employmentStatus: "Active",
    reportingManager: "Vikram Singh",
    workLocation: "Trichy HQ",
    joiningDate: "2026-05-04",
    addressLine1: "3 Cantonment Road",
    addressLine2: "",
    country: "India",
    state: "Tamil Nadu",
    city: "Trichy",
    district: "Tiruchirappalli",
    pincode: "620001",
    aadhaar: "",
    pan: "",
    uan: "",
    pf: "",
    esi: "",
    passport: "",
    drivingLicense: "",
    skills: [],
    education: [
      {
        id: "ed1",
        degree: "B.Com",
        institution: "Bishop Heber College",
        specialization: "Commerce",
        startYear: "2019",
        endYear: "2022",
        grade: "76%",
      },
    ],
    experience: [],
    bankDetails: {
      accountHolderName: "",
      bankName: "",
      accountNumber: "",
      ifsc: "",
      branch: "",
    },
    documents: [],
    employmentHistory: [],
    archived: false,
  },
  {
    id: "EMP007",
    employeeCode: "MDU-007",
    firstName: "Vignesh",
    lastName: "Pandi",
    gender: "Male",
    dob: "1985-12-01",
    bloodGroup: "A-",
    maritalStatus: "Married",
    mobile: "+91 94433 21098",
    email: "vignesh.pandi@company.com",
    emergencyContactName: "Kavya Pandi",
    emergencyContactNumber: "+91 94433 00002",
    department: "Production",
    designation: "Manager",
    branch: "Madurai Unit",
    employmentType: "Permanent",
    employmentStatus: "Active",
    reportingManager: "CEO Office",
    workLocation: "Madurai Plant",
    joiningDate: "2010-03-15",
    addressLine1: "56 Anna Nagar",
    addressLine2: "",
    country: "India",
    state: "Tamil Nadu",
    city: "Madurai",
    district: "Madurai",
    pincode: "625016",
    aadhaar: "",
    pan: "",
    uan: "",
    pf: "",
    esi: "",
    passport: "",
    drivingLicense: "",
    skills: ["Welding", "Mechanical"],
    education: [
      {
        id: "ed1",
        degree: "B.E. Mechanical",
        institution: "Thiagarajar College of Engineering",
        specialization: "Mechanical",
        startYear: "2003",
        endYear: "2007",
        grade: "75%",
      },
    ],
    experience: [
      {
        id: "ex1",
        company: "Madurai Forge Works",
        designation: "Shift Supervisor",
        startDate: "2007-06-01",
        endDate: "2010-02-28",
        years: "2.7",
        responsibilities: "Managed shop-floor shift operations.",
      },
    ],
    bankDetails: {
      accountHolderName: "Vignesh Pandi",
      bankName: "Canara Bank",
      accountNumber: "15630087651234",
      ifsc: "CNRB0001563",
      branch: "Madurai Town Hall",
    },
    documents: [],
    employmentHistory: [],
    archived: false,
  },
  {
    id: "EMP008",
    employeeCode: "CHN-008",
    firstName: "Anitha",
    lastName: "Kumar",
    gender: "Female",
    dob: "1993-07-14",
    bloodGroup: "B+",
    maritalStatus: "Married",
    mobile: "+91 98765 11122",
    email: "anitha.kumar@company.com",
    emergencyContactName: "Suresh Kumar",
    emergencyContactNumber: "+91 98765 00033",
    department: "Accounts",
    designation: "Manager",
    branch: "Chennai Corporate",
    employmentType: "Permanent",
    employmentStatus: "Active",
    reportingManager: "CFO Office",
    workLocation: "Chennai HQ",
    joiningDate: "2017-08-01",
    addressLine1: "19 T Nagar",
    addressLine2: "",
    country: "India",
    state: "Tamil Nadu",
    city: "Chennai",
    district: "Chennai",
    pincode: "600017",
    aadhaar: "",
    pan: "",
    uan: "",
    pf: "",
    esi: "",
    passport: "",
    drivingLicense: "",
    skills: [],
    education: [
      {
        id: "ed1",
        degree: "M.Com",
        institution: "Madras Christian College",
        specialization: "Finance",
        startYear: "2012",
        endYear: "2014",
        grade: "8.2 CGPA",
      },
    ],
    experience: [],
    bankDetails: {
      accountHolderName: "Anitha Kumar",
      bankName: "HDFC Bank",
      accountNumber: "50100987654321",
      ifsc: "HDFC0000501",
      branch: "T Nagar",
    },
    documents: [],
    employmentHistory: [],
    archived: false,
  },
  {
    id: "EMP009",
    employeeCode: "BLR-009",
    firstName: "Rahul",
    lastName: "Nair",
    gender: "Male",
    dob: "1998-02-28",
    bloodGroup: "O+",
    maritalStatus: "Single",
    mobile: "+91 90001 23456",
    email: "rahul.nair@company.com",
    emergencyContactName: "Latha Nair",
    emergencyContactNumber: "+91 90001 00044",
    department: "Engineering",
    designation: "Software Engineer",
    branch: "Bangalore Tech Park",
    employmentType: "Contract",
    employmentStatus: "Active",
    reportingManager: "Arjun Reddy",
    workLocation: "Bangalore HQ",
    joiningDate: "2024-11-11",
    addressLine1: "21 Koramangala 5th Block",
    addressLine2: "",
    country: "India",
    state: "Karnataka",
    city: "Bangalore",
    district: "Bangalore Urban",
    pincode: "560095",
    aadhaar: "",
    pan: "",
    uan: "",
    pf: "",
    esi: "",
    passport: "",
    drivingLicense: "",
    skills: ["Java", "Python"],
    education: [
      {
        id: "ed1",
        degree: "B.E. Computer Science",
        institution: "PES University",
        specialization: "CSE",
        startYear: "2016",
        endYear: "2020",
        grade: "8.0 CGPA",
      },
    ],
    experience: [
      {
        id: "ex1",
        company: "Nimbus Tech",
        designation: "Backend Developer",
        startDate: "2020-07-01",
        endDate: "2024-10-30",
        years: "4.3",
        responsibilities: "Owned billing microservices.",
      },
    ],
    bankDetails: {
      accountHolderName: "",
      bankName: "",
      accountNumber: "",
      ifsc: "",
      branch: "",
    },
    documents: [],
    employmentHistory: [],
    archived: false,
  },
  {
    id: "EMP010",
    employeeCode: "TRX-010",
    firstName: "Bala",
    lastName: "Murugan",
    gender: "Male",
    dob: "1982-04-19",
    bloodGroup: "A+",
    maritalStatus: "Married",
    mobile: "+91 91234 56780",
    email: "bala.murugan@company.com",
    emergencyContactName: "Geetha Bala",
    emergencyContactNumber: "+91 91234 00055",
    department: "Production",
    designation: "Production Engineer",
    branch: "Trichy Plant",
    employmentType: "Permanent",
    employmentStatus: "Resigned",
    reportingManager: "Vignesh Pandi",
    workLocation: "Trichy HQ",
    joiningDate: "2012-10-01",
    addressLine1: "9 Srirangam",
    addressLine2: "",
    country: "India",
    state: "Tamil Nadu",
    city: "Trichy",
    district: "Tiruchirappalli",
    pincode: "620006",
    aadhaar: "",
    pan: "",
    uan: "",
    pf: "",
    esi: "",
    passport: "",
    drivingLicense: "",
    skills: ["Electrical", "CNC"],
    education: [
      {
        id: "ed1",
        degree: "Diploma Electrical Engineering",
        institution: "Government Polytechnic Trichy",
        specialization: "Electrical",
        startYear: "2000",
        endYear: "2003",
        grade: "79%",
      },
    ],
    experience: [],
    bankDetails: {
      accountHolderName: "Bala Murugan",
      bankName: "Indian Bank",
      accountNumber: "60078812349900",
      ifsc: "IDIB000T600",
      branch: "Srirangam",
    },
    documents: [],
    employmentHistory: [
      {
        id: "h1",
        date: "2026-07-20",
        changeType: "Employment Status",
        previousValue: "Active",
        newValue: "Resigned",
      },
    ],
    archived: false,
  },
  {
    id: "EMP011",
    employeeCode: "CBE-011",
    firstName: "Sneha",
    lastName: "Iyer",
    gender: "Female",
    dob: "2000-10-03",
    bloodGroup: "B+",
    maritalStatus: "Single",
    mobile: "+91 88888 22334",
    email: "sneha.iyer@company.com",
    emergencyContactName: "Radha Iyer",
    emergencyContactNumber: "+91 88888 00066",
    department: "Sales",
    designation: "Sales Executive",
    branch: "Coimbatore Office",
    employmentType: "Intern",
    employmentStatus: "Active",
    reportingManager: "Divya Menon",
    workLocation: "Coimbatore HQ",
    joiningDate: "2026-06-15",
    addressLine1: "4 Gandhipuram",
    addressLine2: "",
    country: "India",
    state: "Tamil Nadu",
    city: "Coimbatore",
    district: "Coimbatore",
    pincode: "641012",
    aadhaar: "",
    pan: "",
    uan: "",
    pf: "",
    esi: "",
    passport: "",
    drivingLicense: "",
    skills: [],
    education: [
      {
        id: "ed1",
        degree: "BBA",
        institution: "GRD College",
        specialization: "Marketing",
        startYear: "2021",
        endYear: "2024",
        grade: "7.9 CGPA",
      },
    ],
    experience: [],
    bankDetails: {
      accountHolderName: "",
      bankName: "",
      accountNumber: "",
      ifsc: "",
      branch: "",
    },
    documents: [],
    employmentHistory: [],
    archived: false,
  },
  {
    id: "EMP012",
    employeeCode: "BLR-012",
    firstName: "Naveen",
    lastName: "Prakash",
    gender: "Male",
    dob: "1991-06-25",
    bloodGroup: "AB-",
    maritalStatus: "Married",
    mobile: "+91 77889 90011",
    email: "naveen.prakash@company.com",
    emergencyContactName: "Deepa Naveen",
    emergencyContactNumber: "+91 77889 00077",
    department: "Engineering",
    designation: "Senior Engineer",
    branch: "Bangalore Tech Park",
    employmentType: "Permanent",
    employmentStatus: "Terminated",
    reportingManager: "Arun Kumar",
    workLocation: "Bangalore HQ",
    joiningDate: "2016-01-11",
    addressLine1: "67 HSR Layout",
    addressLine2: "",
    country: "India",
    state: "Karnataka",
    city: "Bangalore",
    district: "Bangalore Urban",
    pincode: "560102",
    aadhaar: "",
    pan: "",
    uan: "",
    pf: "",
    esi: "",
    passport: "",
    drivingLicense: "",
    skills: ["Java", "Django"],
    education: [
      {
        id: "ed1",
        degree: "M.Tech CSE",
        institution: "IIIT Bangalore",
        specialization: "Software Engg",
        startYear: "2013",
        endYear: "2015",
        grade: "8.6 CGPA",
      },
    ],
    experience: [],
    bankDetails: {
      accountHolderName: "Naveen Prakash",
      bankName: "Yes Bank",
      accountNumber: "00811276549900",
      ifsc: "YESB0000081",
      branch: "HSR Layout",
    },
    documents: [],
    employmentHistory: [
      {
        id: "h1",
        date: "2026-04-10",
        changeType: "Employment Status",
        previousValue: "On Notice",
        newValue: "Terminated",
      },
    ],
    archived: true,
  },
  {
    id: "EMP013",
    employeeCode: "CHN-013",
    firstName: "Deepika",
    lastName: "Raj",
    gender: "Female",
    dob: "1995-03-08",
    bloodGroup: "O+",
    maritalStatus: "Single",
    mobile: "+91 99887 66554",
    email: "deepika.raj@company.com",
    emergencyContactName: "Raj Mohan",
    emergencyContactNumber: "+91 99887 00088",
    department: "Engineering",
    designation: "Software Engineer",
    branch: "Chennai Corporate",
    employmentType: "Permanent",
    employmentStatus: "Inactive",
    reportingManager: "Arun Kumar",
    workLocation: "Chennai HQ",
    joiningDate: "2020-02-17",
    addressLine1: "31 Velachery Main Rd",
    addressLine2: "",
    country: "India",
    state: "Tamil Nadu",
    city: "Chennai",
    district: "Chennai",
    pincode: "600042",
    aadhaar: "",
    pan: "",
    uan: "",
    pf: "",
    esi: "",
    passport: "",
    drivingLicense: "",
    skills: ["Python", "React"],
    education: [
      {
        id: "ed1",
        degree: "B.Tech CSE",
        institution: "SRM University",
        specialization: "CSE",
        startYear: "2013",
        endYear: "2017",
        grade: "8.1 CGPA",
      },
    ],
    experience: [],
    bankDetails: {
      accountHolderName: "Deepika Raj",
      bankName: "HDFC Bank",
      accountNumber: "50100223344556",
      ifsc: "HDFC0000502",
      branch: "Velachery",
    },
    documents: [],
    employmentHistory: [
      {
        id: "h1",
        date: "2026-02-01",
        changeType: "Employment Status",
        previousValue: "Active",
        newValue: "Inactive",
      },
    ],
    archived: false,
  },
].map((emp, i) => ({
  ...emp,
  photo: avatarUrl(`${emp.firstName} ${emp.lastName}`, i),
}));

/* ==========================================================================
   SHARED STATE — a lightweight context standing in for the future API layer.
   Exported so EmployeeForm.jsx and EmployeeProfile.jsx can read/write the
   same in-memory employee list without prop-drilling across routes.
   ========================================================================== */

const EmployeesContext = createContext(null);

export function useEmployees() {
  const ctx = useContext(EmployeesContext);
  if (!ctx)
    throw new Error("useEmployees must be used within EmployeesProvider");
  return ctx;
}

export function EmployeesProvider({ children }) {
  const [employees, setEmployees] = useState(RAW_EMPLOYEES);

  const getEmployee = useCallback(
    (id) => employees.find((e) => e.id === id),
    [employees],
  );

  const nextSuggestedId = useMemo(() => {
    const nums = employees.map(
      (e) => parseInt(e.id.replace(/\D/g, ""), 10) || 0,
    );
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `EMP${String(next).padStart(3, "0")}`;
  }, [employees]);

  const addEmployee = useCallback(
    (employee) => {
      const withPhoto = {
        ...employee,
        archived: false,
        photo:
          employee.photo ||
          avatarUrl(
            `${employee.firstName} ${employee.lastName}`,
            employees.length,
          ),
      };
      setEmployees((prev) => [withPhoto, ...prev]);
    },
    [employees.length],
  );

  const updateEmployee = useCallback((id, updates, historyEntries = []) => {
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              ...updates,
              employmentHistory: [
                ...historyEntries,
                ...(e.employmentHistory || []),
              ],
            }
          : e,
      ),
    );
  }, []);

  const archiveEmployee = useCallback((id) => {
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, archived: true, employmentStatus: "Inactive" }
          : e,
      ),
    );
  }, []);

  const unarchiveEmployee = useCallback((id) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, archived: false } : e)),
    );
  }, []);

  const value = {
    employees,
    getEmployee,
    addEmployee,
    updateEmployee,
    archiveEmployee,
    unarchiveEmployee,
    nextSuggestedId,
  };

  return (
    <EmployeesContext.Provider value={value}>
      {children}
    </EmployeesContext.Provider>
  );
}

export function createBlankEmployee(suggestedId) {
  return {
    id: suggestedId || "",
    employeeCode: "",
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    bloodGroup: "",
    maritalStatus: "",
    mobile: "",
    email: "",
    emergencyContactName: "",
    emergencyContactNumber: "",
    department: "",
    designation: "",
    branch: "",
    employmentType: "",
    employmentStatus: "Active",
    reportingManager: "",
    workLocation: "",
    joiningDate: "",
    addressLine1: "",
    addressLine2: "",
    country: "India",
    state: "",
    city: "",
    district: "",
    pincode: "",
    aadhaar: "",
    pan: "",
    uan: "",
    pf: "",
    esi: "",
    passport: "",
    drivingLicense: "",
    skills: [],
    education: [],
    experience: [],
    bankDetails: {
      accountHolderName: "",
      bankName: "",
      accountNumber: "",
      ifsc: "",
      branch: "",
    },
    documents: [],
    employmentHistory: [],
    archived: false,
  };
}

/* ==========================================================================
   TOP NAVIGATION
   ========================================================================== */

const NAV_ITEMS = [
  "Employees",
  "Management",
  "Directory",
  "Departments",
  "Learning",
  "Reporting",
  "Configuration",
];



/* ==========================================================================
   STATUS BADGE
   ========================================================================== */

export function StatusBadge({ status }) {
  const cls = status ? status.toLowerCase().replace(/\s+/g, "-") : "inactive";
  return (
    <span className={`emp-status-badge emp-status-${cls}`}>
      <span className="emp-status-dot" />
      {status}
    </span>
  );
}

/* ==========================================================================
   EMPLOYEE LIST PAGE
   ========================================================================== */

const PAGE_SIZE = 8;

const emptyFilters = {
  department: [],
  city: [],
  designation: [],
  skills: [],
  employmentStatus: [],
  employmentType: [],
};

function toggleInArray(arr, value) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default function Employees() {
  const { employees, archiveEmployee } = useEmployees();
  const navigate = useNavigate();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [showArchived, setShowArchived] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(location.state?.openCreate || false);
  const [editingId, setEditingId] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [isLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [flippedIds, setFlippedIds] = useState(() => new Set());

  const toggleCardFlip = useCallback((id) => {
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (e.archived !== showArchived) return false;

      if (q) {
        const haystack = [
          e.id,
          e.employeeCode,
          e.firstName,
          e.lastName,
          e.email,
          e.mobile,
          e.department,
          e.designation,
          e.city,
          ...(e.skills || []),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (
        filters.department.length &&
        !filters.department.includes(e.department)
      )
        return false;
      if (filters.city.length && !filters.city.includes(e.city)) return false;
      if (
        filters.designation.length &&
        !filters.designation.includes(e.designation)
      )
        return false;
      if (
        filters.employmentStatus.length &&
        !filters.employmentStatus.includes(e.employmentStatus)
      )
        return false;
      if (
        filters.employmentType.length &&
        !filters.employmentType.includes(e.employmentType)
      )
        return false;
      if (
        filters.skills.length &&
        !filters.skills.some((s) => (e.skills || []).includes(s))
      )
        return false;

      return true;
    });
  }, [employees, search, filters, showArchived]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (pageSafe - 1) * PAGE_SIZE,
    pageSafe * PAGE_SIZE,
  );

  const activeFilterCount = Object.values(filters).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  function updateFilter(group, value) {
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      [group]: toggleInArray(prev[group], value),
    }));
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setPage(1);
  }

  function openCreateForm() {
    setEditingId(null);
    setFormOpen(true);
  }

  function openEditForm(id) {
    setOpenMenuId(null);
    setEditingId(id);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  function handleSaved(mode) {
    closeForm();
    showToast(
      mode === "create"
        ? "Employee created successfully."
        : "Employee changes saved.",
    );
  }

  function confirmArchive() {
    if (!archiveTarget) return;
    archiveEmployee(archiveTarget.id);
    showToast(
      `${archiveTarget.firstName} ${archiveTarget.lastName} was archived.`,
    );
    setArchiveTarget(null);
  }

  const FilterGroup = ({ label, group, options }) => (
    <div className="emp-filter-group">
      <h4>{label}</h4>
      <div className="emp-filter-options">
        {options.map((opt) => (
          <label key={opt} className="emp-filter-checkbox">
            <input
              type="checkbox"
              checked={filters[group].includes(opt)}
              onChange={() => updateFilter(group, opt)}
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const filterPanel = (
    <>
      <div className="emp-filter-panel-head">
        <h3>Filters</h3>
        {activeFilterCount > 0 && (
          <button className="emp-link-btn" type="button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>
      <label className="emp-filter-checkbox emp-filter-archived-toggle">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={() => {
            setShowArchived((v) => !v);
            setPage(1);
          }}
        />
        <span>Show archived employees</span>
      </label>
      <FilterGroup
        label="Department"
        group="department"
        options={DEPARTMENTS}
      />
      <FilterGroup label="City" group="city" options={CITIES} />
      <FilterGroup
        label="Designation"
        group="designation"
        options={DESIGNATIONS}
      />
      <FilterGroup label="Skills" group="skills" options={SKILLS_LIST} />
      <FilterGroup
        label="Employment status"
        group="employmentStatus"
        options={EMPLOYMENT_STATUSES}
      />
      <FilterGroup
        label="Employment type"
        group="employmentType"
        options={EMPLOYMENT_TYPES}
      />
    </>
  );

return (
  <>
    <Header
      navLinks={[
        {
          label: "Employees",
          path: "/hr/employees",
        },
        {
          label: "Attendance & Wages",
          path: "/hr/attendance",
        },
        {
          label: "Salary",
          path: "/hr/salary",
        },
      ]}
    />

    <div className="emp-app">

      <div className="emp-page-header">
        <div className="emp-page-header-titles">
          <h1>Employees</h1>
          <p>
            {filtered.length} {showArchived ? "archived" : "active"} record
            {filtered.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="emp-page-header-actions">
          <div className="emp-search">
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <path
                d="M13.6 12.2a6 6 0 1 0-1.4 1.4l3.8 3.8 1.4-1.4-3.8-3.8ZM9 13a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"
                fill="currentColor"
              />
            </svg>
            <input
              type="text"
              value={search}
              placeholder="Search employees..."
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search employees"
            />
            {search && (
              <button
                className="emp-search-clear"
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                ×
              </button>
            )}
          </div>
          <button
            className="emp-btn-outline emp-mobile-filter-toggle"
            type="button"
            onClick={() => setFilterDrawerOpen(true)}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
          <button
            className="emp-btn-primary"
            type="button"
            onClick={openCreateForm}
          >
            + New Employee
          </button>
        </div>
      </div>

      <div className="emp-layout">
        <aside className="emp-filter-sidebar">{filterPanel}</aside>

        <main className="emp-main">
          {isLoading ? (
            <div className="emp-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div className="emp-card emp-card-skeleton" key={i}>
                  <div className="emp-skel emp-skel-avatar" />
                  <div
                    className="emp-skel emp-skel-line"
                    style={{ width: "70%" }}
                  />
                  <div
                    className="emp-skel emp-skel-line"
                    style={{ width: "45%" }}
                  />
                  <div
                    className="emp-skel emp-skel-line"
                    style={{ width: "60%" }}
                  />
                </div>
              ))}
            </div>
          ) : pageItems.length === 0 ? (
            <div className="emp-empty-state">
              <div className="emp-empty-icon">🗂️</div>
              <h3>
                {showArchived
                  ? "No archived employees"
                  : "No employees match your search"}
              </h3>
              <p>
                {showArchived
                  ? "Employees you archive will show up here."
                  : "Try adjusting your filters or search terms, or add a new employee record."}
              </p>
              {!showArchived && (
                <button
                  className="emp-btn-primary"
                  type="button"
                  onClick={openCreateForm}
                >
                  + New Employee
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="emp-grid">
                {pageItems.map((emp) => (
                  <article
                    className={`emp-card emp-card-container emp-card-accent-${emp.employmentStatus.toLowerCase().replace(/\s+/g, "-")}${flippedIds.has(emp.id) ? " is-flipped" : ""}`}
                    key={emp.id}
                  >
                    <div className="emp-card-flip">
                      {/* FRONT — identity, badge-style */}
                      <div className="emp-card-front">
                        <div className="emp-card-face-top">
                          <StatusBadge status={emp.employmentStatus} />
                          <div className="emp-menu-wrap">
                            <button
                              className="emp-icon-btn"
                              type="button"
                              aria-label="More actions"
                              onClick={() =>
                                setOpenMenuId(
                                  openMenuId === emp.id ? null : emp.id,
                                )
                              }
                            >
                              ⋮
                            </button>
                            {openMenuId === emp.id && (
                              <div className="emp-menu">
                                {!emp.archived ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setArchiveTarget(emp);
                                    }}
                                  >
                                    Archive employee
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      navigate(`/hr/employees/${emp.id}`);
                                    }}
                                  >
                                    View archived record
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="emp-card-identity"
                          onClick={() => navigate(`/hr/employees/${emp.id}`)}
                        >
                          <div className="emp-card-avatar-wrap">
                            <img
                              className="emp-card-avatar"
                              src={emp.photo}
                              alt=""
                            />
                            <span
                              className="emp-card-avatar-dot"
                              aria-hidden="true"
                            />
                          </div>
                          <h3>
                            {emp.firstName} {emp.lastName}
                          </h3>
                          <p className="emp-card-role">{emp.designation}</p>
                          <span className="emp-card-id">{emp.id}</span>
                          <span className="emp-card-dept-pill">
                            {emp.department}
                          </span>
                        </button>

                        <div className="emp-card-face-footer">
                          <button
                            type="button"
                            className="emp-card-flip-btn"
                            aria-label={
                              flippedIds.has(emp.id)
                                ? "Show employee identity"
                                : "Show employee details"
                            }
                            onClick={() => toggleCardFlip(emp.id)}
                          >
                            Details
                          </button>
                        </div>
                      </div>

                      {/* BACK — department & employment details, no sensitive data */}
                      <div className="emp-card-back">
                        <p className="emp-card-back-eyebrow">
                          Employee Details
                        </p>
                        <dl className="emp-card-detail-list">
                          <div>
                            <dt>Department</dt>
                            <dd>{emp.department}</dd>
                          </div>
                          <div>
                            <dt>Designation</dt>
                            <dd>{emp.designation}</dd>
                          </div>
                          <div>
                            <dt>Location</dt>
                            <dd>{emp.city}</dd>
                          </div>
                          <div>
                            <dt>Branch</dt>
                            <dd>{emp.branch}</dd>
                          </div>
                          <div>
                            <dt>Employment Type</dt>
                            <dd>{emp.employmentType}</dd>
                          </div>
                          <div>
                            <dt>Joining Date</dt>
                            <dd>{emp.joiningDate}</dd>
                          </div>
                          <div>
                            <dt>Manager</dt>
                            <dd>{emp.reportingManager || "—"}</dd>
                          </div>
                        </dl>
                        {emp.skills.length > 0 && (
                          <div className="emp-card-skills">
                            {emp.skills.slice(0, 3).map((s) => (
                              <span className="emp-tag" key={s}>
                                {s}
                              </span>
                            ))}
                            {emp.skills.length > 3 && (
                              <span className="emp-tag emp-tag-more">
                                +{emp.skills.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          className="emp-card-view-profile"
                          onClick={() => navigate(`/hr/employees/${emp.id}`)}
                        >
                          View Profile →
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {totalPages > 1 && (
                <nav
                  className="emp-pagination"
                  aria-label="Employee list pagination"
                >
                  <button
                    className="emp-btn-outline"
                    type="button"
                    disabled={pageSafe === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="emp-pagination-status">
                    Page {pageSafe} of {totalPages}
                  </span>
                  <button
                    className="emp-btn-outline"
                    type="button"
                    disabled={pageSafe === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </main>
      </div>

      {filterDrawerOpen && (
        <div
          className="emp-drawer-overlay"
          onClick={() => setFilterDrawerOpen(false)}
        >
          <div className="emp-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="emp-drawer-head">
              <h3>Filters</h3>
              <button
                className="emp-icon-btn"
                type="button"
                aria-label="Close filters"
                onClick={() => setFilterDrawerOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="emp-drawer-body">{filterPanel}</div>
            <div className="emp-drawer-foot">
              <button
                className="emp-btn-primary"
                type="button"
                onClick={() => setFilterDrawerOpen(false)}
              >
                Show {filtered.length} results
              </button>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <EmployeeForm
          employeeId={editingId}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      )}

      {archiveTarget && (
        <div
          className="emp-modal-overlay"
          onClick={() => setArchiveTarget(null)}
        >
          <div
            className="emp-modal emp-modal-confirm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3>Archive employee?</h3>
            <p>
              Are you sure you want to archive{" "}
              <strong>
                {archiveTarget.firstName} {archiveTarget.lastName}
              </strong>
              ? They'll be removed from the active directory but their record is
              kept.
            </p>
            <div className="emp-modal-actions">
              <button
                className="emp-btn-outline"
                type="button"
                onClick={() => setArchiveTarget(null)}
              >
                Cancel
              </button>
              <button
                className="emp-btn-danger"
                type="button"
                onClick={confirmArchive}
              >
                Archive Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="emp-toast" role="status">
          {toast}
        </div>
      )}
    </div>
    </>
  );
}