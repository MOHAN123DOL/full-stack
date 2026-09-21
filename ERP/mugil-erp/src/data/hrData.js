// ============================================================================
// hrData.js
// SINGLE SOURCE OF TRUTH — HR Payroll & Biometric Attendance ERP
// Plain JavaScript / ES6 modules. No backend, no API, no libraries, no state
// management. All data is generated in-memory at import time and every piece
// of business logic (CRUD, calculations, search, filter, sort, reports,
// dashboard) reads from / mutates the same in-memory arrays, so any change
// (e.g. editing an employee's salary or attendance) is instantly reflected
// everywhere else that reads from these arrays.
// ============================================================================

// ----------------------------------------------------------------------------
// SECTION 0: SEEDED RANDOM NUMBER GENERATOR & GENERIC HELPERS
// (seeded so the "random" dummy data is stable across reloads)
// ----------------------------------------------------------------------------

function mulberry32(seed) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260601);

function randomInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function randomBool(probTrue = 0.5) {
  return rand() < probTrue;
}

function pad(num, size = 2) {
  return String(num).padStart(size, '0');
}

function randomDateBetween(startDate, endDate) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const d = new Date(start + rand() * (end - start));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function randomMobile() {
  const first = randomItem(['6', '7', '8', '9']);
  let rest = '';
  for (let i = 0; i < 9; i++) rest += randomInt(0, 9);
  return first + rest;
}

function randomAadhaar() {
  const g = () => String(randomInt(1000, 9999));
  return `${g()} ${g()} ${g()}`;
}

function randomPAN() {
  const letters = Array.from({ length: 5 }, () => String.fromCharCode(65 + randomInt(0, 25))).join('');
  return `${letters}${randomInt(1000, 9999)}${String.fromCharCode(65 + randomInt(0, 25))}`;
}

function randomIFSC(bankCode) {
  const alnum = Array.from({ length: 6 }, () =>
    randomInt(0, 1) ? String.fromCharCode(65 + randomInt(0, 25)) : String(randomInt(0, 9))
  ).join('');
  return `${bankCode}0${alnum}`;
}

function randomAccountNumber() {
  let acc = '';
  const len = randomInt(11, 15);
  for (let i = 0; i < len; i++) acc += randomInt(0, 9);
  return acc;
}

// ----------------------------------------------------------------------------
// SECTION 1: COMPANY INFORMATION
// ----------------------------------------------------------------------------

export const company = {
  companyName: 'Sri Vignesh Precision Industries Pvt Ltd',
  address: '14, SIDCO Industrial Estate, Kumbakonam, Thanjavur District, Tamil Nadu - 612001',
  phone: '+91 435 240 1122',
  email: 'hr@srivigneshprecision.com',
  gst: '33AABCS1234C1Z5',
  website: 'www.srivigneshprecision.com',
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  defaultShift: 'General',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
};

// ----------------------------------------------------------------------------
// SECTION 2: DEPARTMENTS
// (head is filled in after employees are generated, see SECTION 6b)
// ----------------------------------------------------------------------------

export const departments = [
  { id: 'DPT01', name: 'HR', code: 'HR', head: null },
  { id: 'DPT02', name: 'Accounts', code: 'ACC', head: null },
  { id: 'DPT03', name: 'Production', code: 'PRD', head: null },
  { id: 'DPT04', name: 'Quality', code: 'QLT', head: null },
  { id: 'DPT05', name: 'Stores', code: 'STR', head: null },
  { id: 'DPT06', name: 'Purchase', code: 'PUR', head: null },
  { id: 'DPT07', name: 'Maintenance', code: 'MNT', head: null },
  { id: 'DPT08', name: 'Planning', code: 'PLN', head: null },
  { id: 'DPT09', name: 'Sales', code: 'SLS', head: null },
  { id: 'DPT10', name: 'IT', code: 'IT', head: null },
  { id: 'DPT11', name: 'Administration', code: 'ADM', head: null },
];

// ----------------------------------------------------------------------------
// SECTION 3: DESIGNATIONS
// level 1 = most senior .. level 8 = most junior (used for salary scaling)
// ----------------------------------------------------------------------------

export const designations = [
  { id: 'DSG01', title: 'Manager', level: 1 },
  { id: 'DSG02', title: 'Assistant Manager', level: 2 },
  { id: 'DSG03', title: 'Senior Engineer', level: 3 },
  { id: 'DSG04', title: 'Engineer', level: 4 },
  { id: 'DSG05', title: 'Supervisor', level: 5 },
  { id: 'DSG06', title: 'Operator', level: 6 },
  { id: 'DSG07', title: 'Technician', level: 6 },
  { id: 'DSG08', title: 'Executive', level: 5 },
  { id: 'DSG09', title: 'Junior Executive', level: 7 },
  { id: 'DSG10', title: 'Office Assistant', level: 8 },
];

// ----------------------------------------------------------------------------
// SECTION 4: SHIFT DETAILS
// ----------------------------------------------------------------------------

export const shifts = [
  { id: 'SH01', name: 'Morning', startTime: '06:00', endTime: '14:00', breakTime: 30, lateGrace: 10, workingHours: 8, weeklyOff: 'Sunday' },
  { id: 'SH02', name: 'General', startTime: '09:30', endTime: '18:30', breakTime: 60, lateGrace: 15, workingHours: 8, weeklyOff: 'Sunday' },
  { id: 'SH03', name: 'Evening', startTime: '14:00', endTime: '22:00', breakTime: 30, lateGrace: 10, workingHours: 8, weeklyOff: 'Sunday' },
  { id: 'SH04', name: 'Night', startTime: '22:00', endTime: '06:00', breakTime: 30, lateGrace: 10, workingHours: 8, weeklyOff: 'Sunday' },
];

// ----------------------------------------------------------------------------
// SECTION 5: LEAVE TYPES
// ----------------------------------------------------------------------------

export const leaveTypes = [
  { id: 'LV01', name: 'Casual Leave', maxDaysPerYear: 12, paid: true },
  { id: 'LV02', name: 'Sick Leave', maxDaysPerYear: 10, paid: true },
  { id: 'LV03', name: 'Earned Leave', maxDaysPerYear: 15, paid: true },
  { id: 'LV04', name: 'Maternity Leave', maxDaysPerYear: 182, paid: true },
  { id: 'LV05', name: 'Comp Off', maxDaysPerYear: 6, paid: true },
  { id: 'LV06', name: 'Loss Of Pay', maxDaysPerYear: 0, paid: false },
];

// ----------------------------------------------------------------------------
// SECTION 6: HOLIDAY LIST (2026)
// ----------------------------------------------------------------------------

export const holidays = [
  { date: '2026-01-01', title: "New Year's Day", type: 'National' },
  { date: '2026-01-14', title: 'Pongal / Makar Sankranti', type: 'Festival' },
  { date: '2026-01-15', title: 'Thiruvalluvar Day', type: 'Regional' },
  { date: '2026-01-26', title: 'Republic Day', type: 'National' },
  { date: '2026-03-04', title: 'Holi', type: 'Festival' },
  { date: '2026-04-14', title: 'Tamil New Year', type: 'Regional' },
  { date: '2026-05-01', title: 'May Day', type: 'National' },
  { date: '2026-08-15', title: 'Independence Day', type: 'National' },
  { date: '2026-09-14', title: 'Ganesh Chaturthi', type: 'Festival' },
  { date: '2026-10-02', title: 'Gandhi Jayanti', type: 'National' },
  { date: '2026-11-08', title: 'Diwali', type: 'Festival' },
  { date: '2026-12-25', title: 'Christmas', type: 'Festival' },
];

// ----------------------------------------------------------------------------
// SECTION 7: BIOMETRIC DEVICES
// ----------------------------------------------------------------------------

export const biometricDevices = [
  { id: 'DEV01', deviceName: 'Main Gate Scanner', brand: 'eSSL', model: 'X990', serialNumber: 'ESSL-X990-10234', ip: '192.168.1.101', port: 4370, firmware: 'v6.60', status: 'Online', lastSync: '2026-06-30 18:42:10', location: 'Main Gate' },
  { id: 'DEV02', deviceName: 'Production Block A', brand: 'ZKTeco', model: 'MB460', serialNumber: 'ZK-MB460-88231', ip: '192.168.1.102', port: 4370, firmware: 'v8.12', status: 'Online', lastSync: '2026-06-30 18:40:55', location: 'Production Block A' },
  { id: 'DEV03', deviceName: 'Production Block B', brand: 'ZKTeco', model: 'MB460', serialNumber: 'ZK-MB460-88245', ip: '192.168.1.103', port: 4370, firmware: 'v8.12', status: 'Offline', lastSync: '2026-06-29 09:15:03', location: 'Production Block B' },
  { id: 'DEV04', deviceName: 'Quality Lab Entrance', brand: 'Matrix', model: 'COSEC ARC', serialNumber: 'MTX-ARC-55671', ip: '192.168.1.104', port: 4370, firmware: 'v3.4', status: 'Online', lastSync: '2026-06-30 18:39:47', location: 'Quality Lab' },
  { id: 'DEV05', deviceName: 'Stores & Warehouse Gate', brand: 'Suprema', model: 'BioStation 2', serialNumber: 'SUP-BS2-99871', ip: '192.168.1.105', port: 4370, firmware: 'v1.9', status: 'Online', lastSync: '2026-06-30 18:35:12', location: 'Stores & Warehouse' },
  { id: 'DEV06', deviceName: 'Admin Block Reception', brand: 'eSSL', model: 'K30 Pro', serialNumber: 'ESSL-K30-44502', ip: '192.168.1.106', port: 4370, firmware: 'v5.2', status: 'Online', lastSync: '2026-06-30 18:41:30', location: 'Admin Block' },
  { id: 'DEV07', deviceName: 'Maintenance Workshop', brand: 'ZKTeco', model: 'F18', serialNumber: 'ZK-F18-33019', ip: '192.168.1.107', port: 4370, firmware: 'v7.0', status: 'Offline', lastSync: '2026-06-28 14:22:18', location: 'Maintenance Workshop' },
  { id: 'DEV08', deviceName: 'IT & Sales Wing', brand: 'Matrix', model: 'COSEC VEGA FAX', serialNumber: 'MTX-VEGA-77120', ip: '192.168.1.108', port: 4370, firmware: 'v2.7', status: 'Online', lastSync: '2026-06-30 18:44:02', location: 'IT & Sales Wing' },
];

// ----------------------------------------------------------------------------
// SECTION 8: SALARY SETTINGS (global defaults used by all payroll functions)
// ----------------------------------------------------------------------------

export const salarySettings = {
  weekStart: 'Monday',
  weekEnd: 'Sunday',
  defaultOTRate: 1.5,
  pfPercentage: 12,
  esiPercentage: 0.75,
  professionalTax: 200,
  salaryCalculationMode: 'Calendar Days',
  standardWorkingDays: 26,
  allowancePercentage: 20,
};

const STANDARD_WORKING_DAYS = salarySettings.standardWorkingDays;
const ALLOWANCE_PERCENT = salarySettings.allowancePercentage / 100;

// ----------------------------------------------------------------------------
// SECTION 9: NAME / REFERENCE POOLS USED FOR DUMMY DATA GENERATION
// ----------------------------------------------------------------------------

const MALE_FIRST_NAMES = [
  'Arun', 'Vijay', 'Karthik', 'Suresh', 'Ramesh', 'Prakash', 'Senthil', 'Manikandan',
  'Saravanan', 'Dinesh', 'Ganesh', 'Mahesh', 'Naveen', 'Praveen', 'Rajesh', 'Sathish',
  'Vignesh', 'Bala', 'Kumar', 'Anand', 'Balaji', 'Gopal', 'Hari', 'Ilango', 'Jagan',
  'Kannan', 'Logesh', 'Muthu', 'Nandha', 'Pandi', 'Raghu', 'Selvam', 'Siva', 'Udhay',
  'Venkat', 'Yogesh', 'Ashok', 'Chandran', 'Deepak', 'Elango', 'Guru', 'Harish',
  'Iyappan', 'Jeeva', 'Kishore', 'Loganathan', 'Manoj', 'Natarajan', 'Ravi', 'Sundar',
];

const FEMALE_FIRST_NAMES = [
  'Priya', 'Divya', 'Lakshmi', 'Kavya', 'Meena', 'Sangeetha', 'Deepa', 'Anitha',
  'Revathi', 'Saranya', 'Vidya', 'Swathi', 'Kalpana', 'Nithya', 'Shanthi', 'Uma',
  'Vani', 'Yamuna', 'Bhavani', 'Chitra', 'Devi', 'Geetha', 'Hema', 'Indira',
  'Jayanthi', 'Kavitha', 'Latha', 'Malar', 'Nirmala', 'Padma', 'Radha', 'Sarala',
  'Tamilarasi', 'Usha', 'Valli',
];

const LAST_NAMES = [
  'Kumar', 'Raman', 'Krishnan', 'Subramaniam', 'Iyer', 'Iyengar', 'Pillai', 'Nair',
  'Reddy', 'Naidu', 'Chettiar', 'Gounder', 'Mudaliar', 'Nadar', 'Rajan', 'Murthy',
  'Sharma', 'Gupta', 'Verma', 'Singh', 'Rao', 'Prasad', 'Menon', 'Varma', 'Achari',
  'Bhat', 'Desai', 'Joshi', 'Patel', 'Shetty', 'Hegde', 'Kamath', 'Pai', 'Shenoy',
];

const CITIES = [
  'Kumbakonam', 'Thanjavur', 'Chennai', 'Coimbatore', 'Tiruchirappalli', 'Madurai',
  'Salem', 'Erode', 'Tirunelveli', 'Vellore', 'Tiruppur', 'Karur', 'Dindigul',
  'Nagercoil', 'Cuddalore',
];

const STREETS = [
  'Gandhi', 'Nehru', 'Anna', 'Bharathi', 'Kamaraj', 'Periyar', 'MGR', 'Rajaji',
  'Bazaar', 'Market', 'Temple', 'Mill', 'Station',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const BANKS = [
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Indian Bank', 'Canara Bank',
  'Axis Bank', 'Indian Overseas Bank', 'Union Bank of India', 'Punjab National Bank',
  'Karur Vysya Bank',
];

const DESIGNATION_WEIGHTS = {
  'Manager': 3,
  'Assistant Manager': 5,
  'Senior Engineer': 6,
  'Engineer': 10,
  'Supervisor': 10,
  'Operator': 26,
  'Technician': 20,
  'Executive': 8,
  'Junior Executive': 7,
  'Office Assistant': 5,
};

function buildWeightedPool(weights) {
  const pool = [];
  Object.entries(weights).forEach(([key, weight]) => {
    for (let i = 0; i < weight; i++) pool.push(key);
  });
  return pool;
}

const DESIGNATION_POOL = buildWeightedPool(DESIGNATION_WEIGHTS);

const SALARY_TYPE_POOL = [
  ...Array(70).fill('Monthly'),
  ...Array(15).fill('Daily'),
  ...Array(10).fill('Hourly'),
  ...Array(5).fill('Weekly'),
];

const SALARY_RANGE_BY_DESIGNATION = {
  'Manager': [65000, 95000],
  'Assistant Manager': [45000, 65000],
  'Senior Engineer': [40000, 55000],
  'Engineer': [28000, 40000],
  'Supervisor': [25000, 35000],
  'Operator': [16000, 22000],
  'Technician': [17000, 24000],
  'Executive': [22000, 30000],
  'Junior Executive': [16000, 20000],
  'Office Assistant': [14000, 18000],
};

// ----------------------------------------------------------------------------
// SECTION 10: EMPLOYEES (exactly 100, generated programmatically)
// ----------------------------------------------------------------------------

function generateEmployees(count) {
  const list = [];
  for (let i = 1; i <= count; i++) {
    const gender = randomBool(0.62) ? 'Male' : 'Female';
    const firstName = gender === 'Male' ? randomItem(MALE_FIRST_NAMES) : randomItem(FEMALE_FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);
    const department = randomItem(departments).name;
    const designationTitle = randomItem(DESIGNATION_POOL);
    const shiftObj = randomItem(shifts);
    const salaryType = randomItem(SALARY_TYPE_POOL);
    const [minSal, maxSal] = SALARY_RANGE_BY_DESIGNATION[designationTitle];
    const monthlyEquivalent = randomInt(minSal, maxSal);
    const hourlyRate = parseFloat((monthlyEquivalent / (STANDARD_WORKING_DAYS * shiftObj.workingHours)).toFixed(2));

    let salary;
    if (salaryType === 'Monthly') salary = monthlyEquivalent;
    else if (salaryType === 'Daily') salary = parseFloat((monthlyEquivalent / STANDARD_WORKING_DAYS).toFixed(2));
    else if (salaryType === 'Weekly') salary = parseFloat((monthlyEquivalent / 4.33).toFixed(2));
    else salary = hourlyRate;

    const city = randomItem(CITIES);
    const bank = randomItem(BANKS);
    const bankCode = bank
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4)
      .padEnd(4, 'X');

    list.push({
      id: i,
      employeeCode: `EMP${pad(i, 4)}`,
      deviceUserId: String(1000 + i),
      name: `${firstName} ${lastName}`,
      gender,
      age: randomInt(21, 58),
      department,
      designation: designationTitle,
      mobile: randomMobile(),
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@srivigneshprecision.com`,
      joiningDate: randomDateBetween('2015-01-01', '2026-05-01'),
      shift: shiftObj.name,
      salaryType,
      salary,
      overtimeRate: parseFloat((hourlyRate * salarySettings.defaultOTRate).toFixed(2)),
      bonus: randomBool(0.4) ? randomInt(500, 3000) : 0,
      deduction: randomBool(0.3) ? randomInt(200, 1500) : 0,
      advance: randomBool(0.15) ? randomInt(1000, 6000) : 0,
      status: randomBool(0.93) ? 'Active' : 'Inactive',
      weeklyOff: shiftObj.weeklyOff,
      attendanceDevice: randomItem(biometricDevices).deviceName,
      fingerRegistered: randomBool(0.92),
      faceRegistered: randomBool(0.55),
      cardRegistered: randomBool(0.7),
      address: `No.${randomInt(1, 200)}, ${randomItem(STREETS)} Street, ${city} - ${randomInt(600001, 643253)}`,
      bloodGroup: randomItem(BLOOD_GROUPS),
      emergencyContact: randomMobile(),
      bankName: bank,
      accountNumber: randomAccountNumber(),
      ifsc: randomIFSC(bankCode),
      pan: randomPAN(),
      aadhaar: randomAadhaar(),
    });
  }
  return list;
}

export const employees = generateEmployees(100);

// SECTION 10b: assign a department head — the highest-ranking active employee
// in each department — now that employees exist.
departments.forEach((dept) => {
  const deptEmployees = employees.filter((e) => e.department === dept.name && e.status === 'Active');
  const sorted = deptEmployees.sort((a, b) => {
    const levelA = designations.find((d) => d.title === a.designation)?.level ?? 99;
    const levelB = designations.find((d) => d.title === b.designation)?.level ?? 99;
    return levelA - levelB;
  });
  dept.head = sorted.length ? sorted[0].name : 'Unassigned';
});

// ----------------------------------------------------------------------------
// SECTION 11: ATTENDANCE (one complete month, generated per employee/day)
// ----------------------------------------------------------------------------

export const ATTENDANCE_YEAR = 2026;
export const ATTENDANCE_MONTH = 6; // June (1-indexed for display purposes)

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function daysInMonth(year, month1Indexed) {
  return new Date(year, month1Indexed, 0).getDate();
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMinutes) {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

function buildAttendanceRecords() {
  const records = [];
  const totalDays = daysInMonth(ATTENDANCE_YEAR, ATTENDANCE_MONTH);
  let recId = 1;

  for (const emp of employees) {
    const shiftObj = shifts.find((s) => s.name === emp.shift) || shifts[1];

    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(ATTENDANCE_YEAR, ATTENDANCE_MONTH - 1, day);
      const dateStr = `${ATTENDANCE_YEAR}-${pad(ATTENDANCE_MONTH)}-${pad(day)}`;
      const dayName = WEEKDAY_NAMES[dateObj.getDay()];
      const holiday = holidays.find((h) => h.date === dateStr);

      const record = {
        id: `ATT${pad(recId, 5)}`,
        employeeId: emp.id,
        date: dateStr,
        day: dayName,
        checkIn: null,
        checkOut: null,
        breakTime: 0,
        workingHours: 0,
        overtimeHours: 0,
        lateMinutes: 0,
        earlyExitMinutes: 0,
        verificationMethod: null,
        deviceName: emp.attendanceDevice,
        attendanceStatus: '',
        direction: 'N/A',
      };

      if (holiday) {
        record.attendanceStatus = 'Holiday';
      } else if (dayName === emp.weeklyOff) {
        record.attendanceStatus = 'Weekly Off';
      } else {
        const roll = rand();
        let status;
        if (roll < 0.76) status = 'Present';
        else if (roll < 0.87) status = 'Late';
        else if (roll < 0.92) status = 'Half Day';
        else if (roll < 0.97) status = 'Absent';
        else status = 'Leave';

        record.attendanceStatus = status;

        if (status === 'Present' || status === 'Late' || status === 'Half Day') {
          const baseStart = timeToMinutes(shiftObj.startTime);
          const scheduledEnd = baseStart + shiftObj.workingHours * 60 + shiftObj.breakTime;

          let checkInMin;
          let checkOutMin;

          if (status === 'Late') {
            checkInMin = baseStart + shiftObj.lateGrace + randomInt(1, 55);
            record.lateMinutes = checkInMin - (baseStart + shiftObj.lateGrace);
            checkOutMin = scheduledEnd + randomInt(-10, 30);
          } else if (status === 'Half Day') {
            checkInMin = baseStart + randomInt(-5, shiftObj.lateGrace);
            checkOutMin = baseStart + Math.round(shiftObj.workingHours * 30) + randomInt(-15, 15);
          } else {
            const graceWindow = Math.max(shiftObj.lateGrace - 2, 0);
            checkInMin = baseStart + randomInt(-10, graceWindow);
            checkOutMin = scheduledEnd + randomInt(-5, 50);
          }

          if (checkOutMin < scheduledEnd) {
            record.earlyExitMinutes = scheduledEnd - checkOutMin;
          }

          record.checkIn = minutesToTime(checkInMin);
          record.checkOut = minutesToTime(checkOutMin);
          record.breakTime = shiftObj.breakTime;

          const grossMinutes = Math.max(0, checkOutMin - checkInMin - shiftObj.breakTime);
          const grossHours = parseFloat((grossMinutes / 60).toFixed(2));
          record.workingHours = grossHours;
          record.overtimeHours =
            grossHours > shiftObj.workingHours ? parseFloat((grossHours - shiftObj.workingHours).toFixed(2)) : 0;

          const methods = [];
          if (emp.fingerRegistered) methods.push('Fingerprint');
          if (emp.faceRegistered) methods.push('Face');
          if (emp.cardRegistered) methods.push('Card');
          record.verificationMethod = methods.length ? randomItem(methods) : 'Fingerprint';
          record.direction = 'IN/OUT';
        } else if (status === 'Leave') {
          record.leaveType = randomItem(leaveTypes).name;
        }
      }

      records.push(record);
      recId += 1;
    }
  }

  return records;
}

export const attendanceRecords = buildAttendanceRecords();

// ----------------------------------------------------------------------------
// SECTION 12: ATTENDANCE LOGS (individual IN / OUT punch events)
// ----------------------------------------------------------------------------

function buildAttendanceLogs() {
  const logs = [];
  let logId = 1;

  attendanceRecords.forEach((rec) => {
    const emp = employees.find((e) => e.id === rec.employeeId);
    const employeeName = emp ? emp.name : 'Unknown';

    if (rec.checkIn) {
      logs.push({
        id: `LOG${pad(logId, 6)}`,
        employeeId: rec.employeeId,
        employeeName,
        device: rec.deviceName,
        verification: rec.verificationMethod,
        direction: 'IN',
        date: rec.date,
        time: rec.checkIn,
      });
      logId += 1;
    }

    if (rec.checkOut) {
      logs.push({
        id: `LOG${pad(logId, 6)}`,
        employeeId: rec.employeeId,
        employeeName,
        device: rec.deviceName,
        verification: rec.verificationMethod,
        direction: 'OUT',
        date: rec.date,
        time: rec.checkOut,
      });
      logId += 1;
    }
  });

  return logs;
}

export const attendanceLogs = buildAttendanceLogs();

// ----------------------------------------------------------------------------
// SECTION 13: EMPLOYEE CRUD & QUERY FUNCTIONS
// ----------------------------------------------------------------------------

export function getEmployees() {
  return employees;
}

export function getEmployee(id) {
  return employees.find((e) => e.id === Number(id));
}

export function addEmployee(data) {
  const newId = employees.length ? Math.max(...employees.map((e) => e.id)) + 1 : 1;
  const newEmployee = {
    id: newId,
    employeeCode: `EMP${pad(newId, 4)}`,
    deviceUserId: String(1000 + newId),
    status: 'Active',
    bonus: 0,
    deduction: 0,
    advance: 0,
    fingerRegistered: false,
    faceRegistered: false,
    cardRegistered: false,
    ...data,
  };
  employees.push(newEmployee);
  return newEmployee;
}

export function updateEmployee(id, updates) {
  const emp = getEmployee(id);
  if (!emp) return null;
  Object.assign(emp, updates);
  return emp;
}

export function deleteEmployee(id) {
  const index = employees.findIndex((e) => e.id === Number(id));
  if (index === -1) return false;
  employees.splice(index, 1);
  return true;
}

export function searchEmployees(keyword) {
  return searchByKeyword(employees, keyword, ['name', 'employeeCode', 'department', 'designation', 'mobile', 'email']);
}

export function filterEmployees(filters = {}) {
  return employees.filter((emp) =>
    Object.entries(filters).every(([key, value]) => {
      if (value === undefined || value === null || value === '') return true;
      return String(emp[key]).toLowerCase() === String(value).toLowerCase();
    })
  );
}

export function sortEmployees(field = 'name', order = 'asc') {
  return order === 'desc' ? sortDescending(employees, field) : sortAscending(employees, field);
}

export function getDepartmentEmployees(department) {
  return employees.filter((e) => e.department === department);
}

export function getShiftEmployees(shiftName) {
  return employees.filter((e) => e.shift === shiftName);
}

export function getActiveEmployees() {
  return employees.filter((e) => e.status === 'Active');
}

export function getInactiveEmployees() {
  return employees.filter((e) => e.status === 'Inactive');
}

// ----------------------------------------------------------------------------
// SECTION 14: ATTENDANCE FUNCTIONS
// ----------------------------------------------------------------------------

export function getReferenceDate() {
  return attendanceRecords.length ? attendanceRecords[attendanceRecords.length - 1].date : null;
}

export function getTodayAttendance() {
  const today = getReferenceDate();
  return attendanceRecords.filter((a) => a.date === today);
}

export function getMonthlyAttendance(month = ATTENDANCE_MONTH, year = ATTENDANCE_YEAR) {
  return attendanceRecords.filter((a) => {
    const [y, m] = a.date.split('-');
    return Number(y) === year && Number(m) === month;
  });
}

export function getEmployeeAttendance(employeeId) {
  return attendanceRecords.filter((a) => a.employeeId === Number(employeeId));
}

export function updateAttendance(id, updates) {
  const record = attendanceRecords.find((a) => a.id === id);
  if (!record) return null;
  Object.assign(record, updates);
  return record;
}

export function searchAttendance(keyword) {
  return searchByKeyword(attendanceRecords, keyword, ['date', 'attendanceStatus', 'deviceName', 'verificationMethod']);
}

export function filterAttendance(filters = {}) {
  return attendanceRecords.filter((rec) =>
    Object.entries(filters).every(([key, value]) => {
      if (value === undefined || value === null || value === '') return true;
      return String(rec[key]).toLowerCase() === String(value).toLowerCase();
    })
  );
}

export function sortAttendance(field = 'date', order = 'asc') {
  return order === 'desc' ? sortDescending(attendanceRecords, field) : sortAscending(attendanceRecords, field);
}

function employeesFromAttendance(records) {
  const ids = new Set(records.map((r) => r.employeeId));
  return employees.filter((e) => ids.has(e.id));
}

export function getPresentEmployees(date = getReferenceDate()) {
  return employeesFromAttendance(attendanceRecords.filter((a) => a.date === date && a.attendanceStatus === 'Present'));
}

export function getAbsentEmployees(date = getReferenceDate()) {
  return employeesFromAttendance(attendanceRecords.filter((a) => a.date === date && a.attendanceStatus === 'Absent'));
}

export function getLateEmployees(date = getReferenceDate()) {
  return employeesFromAttendance(attendanceRecords.filter((a) => a.date === date && a.attendanceStatus === 'Late'));
}

export function getLeaveEmployees(date = getReferenceDate()) {
  return employeesFromAttendance(attendanceRecords.filter((a) => a.date === date && a.attendanceStatus === 'Leave'));
}

export function getHalfDayEmployees(date = getReferenceDate()) {
  return employeesFromAttendance(attendanceRecords.filter((a) => a.date === date && a.attendanceStatus === 'Half Day'));
}

export function getAttendancePercentage(employeeId, month = ATTENDANCE_MONTH, year = ATTENDANCE_YEAR) {
  const records = getEmployeeAttendance(employeeId).filter((r) => {
    const [y, m] = r.date.split('-');
    return Number(y) === year && Number(m) === month;
  });
  const workingDayRecords = records.filter((r) => r.attendanceStatus !== 'Weekly Off' && r.attendanceStatus !== 'Holiday');
  if (!workingDayRecords.length) return 0;
  const presentCount = workingDayRecords.filter((r) => ['Present', 'Late', 'Half Day'].includes(r.attendanceStatus)).length;
  return parseFloat(((presentCount / workingDayRecords.length) * 100).toFixed(2));
}

export function getWorkingHours(employeeId, date) {
  const record = attendanceRecords.find((a) => a.employeeId === Number(employeeId) && a.date === date);
  return record ? record.workingHours : 0;
}

export function getOvertimeHours(employeeId, date) {
  if (date) {
    const record = attendanceRecords.find((a) => a.employeeId === Number(employeeId) && a.date === date);
    return record ? record.overtimeHours : 0;
  }
  return getEmployeeAttendance(employeeId).reduce((sum, r) => sum + r.overtimeHours, 0);
}

export function calculateAttendance(employeeId, month = ATTENDANCE_MONTH, year = ATTENDANCE_YEAR) {
  const records = getEmployeeAttendance(employeeId).filter((r) => {
    const [y, m] = r.date.split('-');
    return Number(y) === year && Number(m) === month;
  });

  const summary = {
    employeeId: Number(employeeId),
    totalDays: records.length,
    presentDays: records.filter((r) => r.attendanceStatus === 'Present').length,
    lateDays: records.filter((r) => r.attendanceStatus === 'Late').length,
    halfDays: records.filter((r) => r.attendanceStatus === 'Half Day').length,
    absentDays: records.filter((r) => r.attendanceStatus === 'Absent').length,
    leaveDays: records.filter((r) => r.attendanceStatus === 'Leave').length,
    holidayDays: records.filter((r) => r.attendanceStatus === 'Holiday').length,
    weeklyOffDays: records.filter((r) => r.attendanceStatus === 'Weekly Off').length,
    totalWorkingHours: parseFloat(records.reduce((sum, r) => sum + r.workingHours, 0).toFixed(2)),
    totalOvertimeHours: parseFloat(records.reduce((sum, r) => sum + r.overtimeHours, 0).toFixed(2)),
    totalLateMinutes: records.reduce((sum, r) => sum + r.lateMinutes, 0),
  };

  summary.payableDays =
    summary.presentDays + summary.lateDays + summary.holidayDays + summary.weeklyOffDays + summary.halfDays * 0.5;

  return summary;
}

// ----------------------------------------------------------------------------
// SECTION 15: PAYROLL CALCULATION FUNCTIONS
// ----------------------------------------------------------------------------

export function calculateDailySalary(emp) {
  if (emp.salaryType === 'Daily') return emp.salary;
  if (emp.salaryType === 'Monthly') return parseFloat((emp.salary / STANDARD_WORKING_DAYS).toFixed(2));
  if (emp.salaryType === 'Weekly') return parseFloat((emp.salary / 6).toFixed(2));
  const shiftObj = shifts.find((s) => s.name === emp.shift) || shifts[1];
  return parseFloat((emp.salary * shiftObj.workingHours).toFixed(2));
}

export function calculateWeeklySalary(emp) {
  if (emp.salaryType === 'Weekly') return emp.salary;
  if (emp.salaryType === 'Monthly') return parseFloat((emp.salary / 4.33).toFixed(2));
  return parseFloat((calculateDailySalary(emp) * 6).toFixed(2));
}

export function calculateMonthlySalary(emp, attendanceSummary) {
  const summary = attendanceSummary || calculateAttendance(emp.id);

  if (emp.salaryType === 'Monthly') {
    const perDay = emp.salary / STANDARD_WORKING_DAYS;
    return parseFloat(Math.max(0, emp.salary - summary.absentDays * perDay).toFixed(2));
  }
  if (emp.salaryType === 'Daily') {
    return parseFloat((emp.salary * summary.payableDays).toFixed(2));
  }
  if (emp.salaryType === 'Weekly') {
    return parseFloat(((emp.salary / 6) * summary.payableDays).toFixed(2));
  }
  const shiftObj = shifts.find((s) => s.name === emp.shift) || shifts[1];
  return parseFloat((emp.salary * summary.payableDays * shiftObj.workingHours).toFixed(2));
}

export function calculateHourlySalary(emp, hours) {
  const shiftObj = shifts.find((s) => s.name === emp.shift) || shifts[1];
  let hourlyRate;
  if (emp.salaryType === 'Hourly') hourlyRate = emp.salary;
  else if (emp.salaryType === 'Daily') hourlyRate = emp.salary / shiftObj.workingHours;
  else if (emp.salaryType === 'Weekly') hourlyRate = emp.salary / (6 * shiftObj.workingHours);
  else hourlyRate = emp.salary / (STANDARD_WORKING_DAYS * shiftObj.workingHours);
  return parseFloat((hourlyRate * hours).toFixed(2));
}

export function calculateOvertimePay(emp, overtimeHours) {
  return parseFloat((emp.overtimeRate * overtimeHours).toFixed(2));
}

export function calculateBonus(emp) {
  return emp.bonus || 0;
}

export function calculateDeduction(emp, grossSalary) {
  const pf = parseFloat((grossSalary * (salarySettings.pfPercentage / 100)).toFixed(2));
  const esi = grossSalary <= 21000 ? parseFloat((grossSalary * (salarySettings.esiPercentage / 100)).toFixed(2)) : 0;
  const pt = salarySettings.professionalTax;
  const other = emp.deduction || 0;
  return parseFloat((pf + esi + pt + other).toFixed(2));
}

export function calculateGrossSalary(emp, attendanceSummary) {
  const summary = attendanceSummary || calculateAttendance(emp.id);
  const basic = calculateMonthlySalary(emp, summary);
  const allowance = parseFloat((basic * ALLOWANCE_PERCENT).toFixed(2));
  const overtimePay = calculateOvertimePay(emp, summary.totalOvertimeHours);
  const bonus = calculateBonus(emp);
  return parseFloat((basic + allowance + overtimePay + bonus).toFixed(2));
}

export function calculateNetSalary(emp, grossSalary, deduction) {
  return parseFloat((grossSalary - deduction - (emp.advance || 0)).toFixed(2));
}

export function calculatePayroll(employeeId, month = ATTENDANCE_MONTH, year = ATTENDANCE_YEAR) {
  const emp = getEmployee(employeeId);
  if (!emp) return null;

  const summary = calculateAttendance(employeeId, month, year);
  const basicSalary = calculateMonthlySalary(emp, summary);
  const allowance = parseFloat((basicSalary * ALLOWANCE_PERCENT).toFixed(2));
  const overtimePay = calculateOvertimePay(emp, summary.totalOvertimeHours);
  const bonus = calculateBonus(emp);
  const grossSalary = parseFloat((basicSalary + allowance + overtimePay + bonus).toFixed(2));
  const deduction = calculateDeduction(emp, grossSalary);
  const netSalary = calculateNetSalary(emp, grossSalary, deduction);

  return {
    id: `PAY-${emp.id}-${year}${pad(month)}`,
    employeeId: emp.id,
    basicSalary,
    allowance,
    bonus,
    deduction,
    advance: emp.advance || 0,
    overtimePay,
    grossSalary,
    netSalary,
    salaryMonth: `${year}-${pad(month)}`,
    paymentStatus: 'Pending',
    paymentDate: null,
    salarySlipNumber: `SLIP/${year}/${pad(month)}/${pad(emp.id, 4)}`,
  };
}

export const payrollRecords = [];

export function generatePayroll(month = ATTENDANCE_MONTH, year = ATTENDANCE_YEAR) {
  const nextMonth = month + 1 > 12 ? 1 : month + 1;
  const nextMonthYear = month + 1 > 12 ? year + 1 : year;

  const records = employees.map((emp) => {
    const record = calculatePayroll(emp.id, month, year);
    const statusRoll = rand();
    if (statusRoll < 0.65) {
      record.paymentStatus = 'Paid';
      record.paymentDate = randomDateBetween(`${year}-${pad(month)}-26`, `${nextMonthYear}-${pad(nextMonth)}-05`);
    } else if (statusRoll < 0.85) {
      record.paymentStatus = 'Processing';
    } else {
      record.paymentStatus = 'Pending';
    }
    return record;
  });

  payrollRecords.length = 0;
  payrollRecords.push(...records);
  return payrollRecords;
}

// initial payroll generation for the same month as the generated attendance
generatePayroll(ATTENDANCE_MONTH, ATTENDANCE_YEAR);

export function updatePayroll(id, updates) {
  const record = payrollRecords.find((p) => p.id === id);
  if (!record) return null;
  Object.assign(record, updates);
  return record;
}

export function markPayrollPaid(id) {
  const record = payrollRecords.find((p) => p.id === id);
  if (!record) return null;
  record.paymentStatus = 'Paid';
  record.paymentDate = new Date().toISOString().slice(0, 10);
  return record;
}

export function getPaidPayroll() {
  return payrollRecords.filter((p) => p.paymentStatus === 'Paid');
}

export function getPendingPayroll() {
  return payrollRecords.filter((p) => p.paymentStatus === 'Pending' || p.paymentStatus === 'Processing');
}

export function getMonthlyPayroll(month = ATTENDANCE_MONTH, year = ATTENDANCE_YEAR) {
  const key = `${year}-${pad(month)}`;
  return payrollRecords.filter((p) => p.salaryMonth === key);
}

export function getWeeklyPayroll(weekStartDate) {
  const start = new Date(weekStartDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const startStr = weekStartDate;
  const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;

  return employees.map((emp) => {
    const records = attendanceRecords.filter((a) => a.employeeId === emp.id && a.date >= startStr && a.date <= endStr);
    const overtimeHours = parseFloat(records.reduce((sum, r) => sum + r.overtimeHours, 0).toFixed(2));
    const payableDays =
      records.filter((r) => ['Present', 'Late', 'Holiday', 'Weekly Off'].includes(r.attendanceStatus)).length +
      records.filter((r) => r.attendanceStatus === 'Half Day').length * 0.5;
    const weeklyBase = calculateWeeklySalary(emp);
    const perDay = weeklyBase / 6;
    const earnedBase = parseFloat((perDay * payableDays).toFixed(2));
    const overtimePay = calculateOvertimePay(emp, overtimeHours);

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      weekStart: startStr,
      weekEnd: endStr,
      payableDays,
      overtimeHours,
      earnedBase,
      overtimePay,
      totalPay: parseFloat((earnedBase + overtimePay).toFixed(2)),
    };
  });
}

// ----------------------------------------------------------------------------
// SECTION 16: DASHBOARD FUNCTIONS
// ----------------------------------------------------------------------------

export function calculateDashboardSummary() {
  const today = getReferenceDate();
  const todayRecords = attendanceRecords.filter((a) => a.date === today);
  const monthlyPayroll = getMonthlyPayroll();

  return {
    totalEmployees: employees.length,
    activeEmployees: getActiveEmployees().length,
    inactiveEmployees: getInactiveEmployees().length,
    totalDepartments: departments.length,
    presentToday: todayRecords.filter((r) => r.attendanceStatus === 'Present').length,
    absentToday: todayRecords.filter((r) => r.attendanceStatus === 'Absent').length,
    lateToday: todayRecords.filter((r) => r.attendanceStatus === 'Late').length,
    onLeaveToday: todayRecords.filter((r) => r.attendanceStatus === 'Leave').length,
    halfDayToday: todayRecords.filter((r) => r.attendanceStatus === 'Half Day').length,
    totalPayrollThisMonth: parseFloat(monthlyPayroll.reduce((sum, p) => sum + p.netSalary, 0).toFixed(2)),
    paidPayrollCount: monthlyPayroll.filter((p) => p.paymentStatus === 'Paid').length,
    pendingPayrollCount: monthlyPayroll.filter((p) => p.paymentStatus !== 'Paid').length,
    totalDevices: biometricDevices.length,
    devicesOnline: biometricDevices.filter((d) => d.status === 'Online').length,
  };
}

export function calculateDepartmentSummary() {
  const today = getReferenceDate();
  return departments.map((dept) => {
    const deptEmployees = getDepartmentEmployees(dept.name);
    const presentToday = deptEmployees.filter((emp) => {
      const rec = attendanceRecords.find((a) => a.employeeId === emp.id && a.date === today);
      return rec && rec.attendanceStatus === 'Present';
    }).length;
    const avgSalary = deptEmployees.length
      ? parseFloat((deptEmployees.reduce((sum, e) => sum + calculateMonthlySalary(e), 0) / deptEmployees.length).toFixed(2))
      : 0;

    return {
      department: dept.name,
      head: dept.head,
      employeeCount: deptEmployees.length,
      activeCount: deptEmployees.filter((e) => e.status === 'Active').length,
      presentToday,
      avgSalary,
    };
  });
}

export function calculateShiftSummary() {
  const today = getReferenceDate();
  return shifts.map((shift) => {
    const shiftEmployees = getShiftEmployees(shift.name);
    const presentToday = shiftEmployees.filter((emp) => {
      const rec = attendanceRecords.find((a) => a.employeeId === emp.id && a.date === today);
      return rec && (rec.attendanceStatus === 'Present' || rec.attendanceStatus === 'Late');
    }).length;

    return {
      shift: shift.name,
      employeeCount: shiftEmployees.length,
      presentToday,
      startTime: shift.startTime,
      endTime: shift.endTime,
    };
  });
}

export function calculateTodaySummary() {
  const today = getReferenceDate();
  const records = attendanceRecords.filter((a) => a.date === today);

  return {
    date: today,
    present: records.filter((r) => r.attendanceStatus === 'Present').length,
    absent: records.filter((r) => r.attendanceStatus === 'Absent').length,
    late: records.filter((r) => r.attendanceStatus === 'Late').length,
    halfDay: records.filter((r) => r.attendanceStatus === 'Half Day').length,
    onLeave: records.filter((r) => r.attendanceStatus === 'Leave').length,
    holiday: records.filter((r) => r.attendanceStatus === 'Holiday').length,
    weeklyOff: records.filter((r) => r.attendanceStatus === 'Weekly Off').length,
  };
}

export function calculateMonthlySummary(month = ATTENDANCE_MONTH, year = ATTENDANCE_YEAR) {
  const records = getMonthlyAttendance(month, year);
  const payroll = getMonthlyPayroll(month, year);

  return {
    month,
    year,
    totalAttendanceRecords: records.length,
    totalPresent: records.filter((r) => r.attendanceStatus === 'Present').length,
    totalAbsent: records.filter((r) => r.attendanceStatus === 'Absent').length,
    totalLate: records.filter((r) => r.attendanceStatus === 'Late').length,
    totalOvertimeHours: parseFloat(records.reduce((sum, r) => sum + r.overtimeHours, 0).toFixed(2)),
    totalGrossPayroll: parseFloat(payroll.reduce((sum, p) => sum + p.grossSalary, 0).toFixed(2)),
    totalNetPayroll: parseFloat(payroll.reduce((sum, p) => sum + p.netSalary, 0).toFixed(2)),
  };
}

// ----------------------------------------------------------------------------
// SECTION 17: REPORT FUNCTIONS
// ----------------------------------------------------------------------------

export function generateAttendanceReport(filters = {}) {
  let records = attendanceRecords;

  if (filters.department) {
    const ids = new Set(getDepartmentEmployees(filters.department).map((e) => e.id));
    records = records.filter((r) => ids.has(r.employeeId));
  }
  if (filters.shift) {
    const ids = new Set(getShiftEmployees(filters.shift).map((e) => e.id));
    records = records.filter((r) => ids.has(r.employeeId));
  }
  if (filters.status) records = records.filter((r) => r.attendanceStatus === filters.status);
  if (filters.dateFrom) records = records.filter((r) => r.date >= filters.dateFrom);
  if (filters.dateTo) records = records.filter((r) => r.date <= filters.dateTo);

  return {
    filters,
    totalRecords: records.length,
    summary: {
      present: records.filter((r) => r.attendanceStatus === 'Present').length,
      absent: records.filter((r) => r.attendanceStatus === 'Absent').length,
      late: records.filter((r) => r.attendanceStatus === 'Late').length,
      halfDay: records.filter((r) => r.attendanceStatus === 'Half Day').length,
      leave: records.filter((r) => r.attendanceStatus === 'Leave').length,
    },
    records,
  };
}

export function generatePayrollReport(filters = {}) {
  let records = payrollRecords;

  if (filters.month && filters.year) {
    records = records.filter((p) => p.salaryMonth === `${filters.year}-${pad(filters.month)}`);
  }
  if (filters.status) records = records.filter((p) => p.paymentStatus === filters.status);
  if (filters.department) {
    const ids = new Set(getDepartmentEmployees(filters.department).map((e) => e.id));
    records = records.filter((p) => ids.has(p.employeeId));
  }

  return {
    filters,
    totalRecords: records.length,
    totalGross: parseFloat(records.reduce((sum, p) => sum + p.grossSalary, 0).toFixed(2)),
    totalNet: parseFloat(records.reduce((sum, p) => sum + p.netSalary, 0).toFixed(2)),
    totalDeduction: parseFloat(records.reduce((sum, p) => sum + p.deduction, 0).toFixed(2)),
    records,
  };
}

export function generateDepartmentReport() {
  return calculateDepartmentSummary().map((deptSummary) => {
    const deptEmployees = getDepartmentEmployees(deptSummary.department);
    const attendancePercentages = deptEmployees.map((e) => getAttendancePercentage(e.id));
    const avgAttendance = attendancePercentages.length
      ? parseFloat((attendancePercentages.reduce((s, v) => s + v, 0) / attendancePercentages.length).toFixed(2))
      : 0;
    return { ...deptSummary, avgAttendancePercentage: avgAttendance };
  });
}

export function generateOvertimeReport(month = ATTENDANCE_MONTH, year = ATTENDANCE_YEAR) {
  return employees
    .map((emp) => {
      const summary = calculateAttendance(emp.id, month, year);
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        totalOvertimeHours: summary.totalOvertimeHours,
        overtimePay: calculateOvertimePay(emp, summary.totalOvertimeHours),
      };
    })
    .filter((r) => r.totalOvertimeHours > 0)
    .sort((a, b) => b.totalOvertimeHours - a.totalOvertimeHours);
}

export function generateLateReport(month = ATTENDANCE_MONTH, year = ATTENDANCE_YEAR) {
  return employees
    .map((emp) => {
      const summary = calculateAttendance(emp.id, month, year);
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        lateDays: summary.lateDays,
        totalLateMinutes: summary.totalLateMinutes,
      };
    })
    .filter((r) => r.lateDays > 0)
    .sort((a, b) => b.totalLateMinutes - a.totalLateMinutes);
}

// ----------------------------------------------------------------------------
// SECTION 18: DEVICE FUNCTIONS
// ----------------------------------------------------------------------------

export function getDevices() {
  return biometricDevices;
}

export function updateDevice(id, updates) {
  const device = biometricDevices.find((d) => d.id === id);
  if (!device) return null;
  Object.assign(device, updates);
  return device;
}

export function syncAttendance(deviceId) {
  const device = biometricDevices.find((d) => d.id === deviceId);
  if (!device) return { success: false, message: 'Device not found' };
  device.lastSync = new Date().toISOString();
  const recordsSynced = attendanceRecords.filter((r) => r.deviceName === device.deviceName).length;
  return { success: true, deviceId, recordsSynced };
}

export function syncEmployees(deviceId) {
  const device = biometricDevices.find((d) => d.id === deviceId);
  if (!device) return { success: false, message: 'Device not found' };
  const employeesSynced = employees.filter((e) => e.attendanceDevice === device.deviceName).length;
  return { success: true, deviceId, employeesSynced };
}

export function testConnection(deviceId) {
  const device = biometricDevices.find((d) => d.id === deviceId);
  if (!device) return { success: false, message: 'Device not found' };
  return {
    success: device.status === 'Online',
    deviceId,
    latencyMs: device.status === 'Online' ? randomInt(8, 150) : null,
  };
}

// ----------------------------------------------------------------------------
// SECTION 19: GENERIC SEARCH / FILTER / SORT UTILITIES
// ----------------------------------------------------------------------------

export function searchByKeyword(list, keyword, fields) {
  if (!keyword) return list;
  const lower = String(keyword).toLowerCase();
  return list.filter((item) => fields.some((field) => String(item[field] ?? '').toLowerCase().includes(lower)));
}

export function filterByDepartment(list, department) {
  return list.filter((item) => item.department === department);
}

export function filterByShift(list, shift) {
  return list.filter((item) => item.shift === shift);
}

export function filterBySalaryType(list, salaryType) {
  return list.filter((item) => item.salaryType === salaryType);
}

export function filterByStatus(list, status) {
  return list.filter((item) => item.status === status || item.attendanceStatus === status || item.paymentStatus === status);
}

export function sortAscending(list, field) {
  return [...list].sort((a, b) => {
    if (a[field] > b[field]) return 1;
    if (a[field] < b[field]) return -1;
    return 0;
  });
}

export function sortDescending(list, field) {
  return [...list].sort((a, b) => {
    if (a[field] < b[field]) return 1;
    if (a[field] > b[field]) return -1;
    return 0;
  });
}

export function paginate(list, page = 1, pageSize = 10) {
  const totalRecords = list.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const start = (page - 1) * pageSize;
  const data = list.slice(start, start + pageSize);
  return { data, currentPage: page, pageSize, totalPages, totalRecords };
}
