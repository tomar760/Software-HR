/***********************************************************************************
 * PANCHHI HR PRO — Google Apps Script Backend
 * GSheet-only backend | Real-time | Google Drive attachments | Multi-user | OTP
 *
 * SETUP:
 * 1. Create a blank Google Sheet → copy its ID and paste in SHEET_ID below
 * 2. Create a Google Drive folder → copy its ID and paste in DRIVE_FOLDER_ID below
 * 3. Open Apps Script from Sheet → paste this code
 * 4. Run setupAll() once
 * 5. Deploy → New Deployment → Web App (Execute as: Me, Access: Anyone)
 * 6. Copy Web App URL → paste in frontend Settings / app.js WEB_APP_URL
 ***********************************************************************************/

const CONFIG = {
  SHEET_ID: '10qQe9hxaDB8rj8YThTXyMnSDUv_j6nbiLrGg0_LYP-4',       // ← CHANGE THIS
  DRIVE_FOLDER_ID: '1haM_kHc-gUpjOlZv8JXFENRMt5MdhkPv', // ← CHANGE THIS
  DEFAULT_ADMIN: {
    name: 'Aditya Tomar',
    email: 'aditya@houseofpanchhi.com',
    password: 'admin123'  // ← CHANGE AFTER FIRST LOGIN
  },
  COMPANY: 'House of Panchhi',
  MAX_USERS: 10
};

const SHEETS = {
  USERS: 'Users',
  ACTIVITY_LOG: 'ActivityLog',
  EMPLOYEES: 'Employees',
  ATTENDANCE: 'Attendance',
  GATE_PASS: 'GatePass',
  LEAVE: 'LeaveRecords',
  SALARY: 'SalaryRegister',
  ADVANCE: 'AdvanceLoans',
  STORE: 'StoreEntries',
  DEPARTMENTS: 'Departments'
};

const ALL_MODULES = [
  'dashboard','employees','attendance','gatepass','leave','salary','store','analytics','teams','settings','profile','users'
];

// ===================== CORS / ENTRY POINTS =====================
function setCORS(output) {
  return output
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function doOptions(e) {
  return setCORS(ContentService.createTextOutput(''));
}

function doPost(e) {
  try {
    let payload = {};
    if (e.postData && e.postData.type === 'application/x-www-form-urlencoded') {
      payload = e.parameter;
      if (payload.data) payload.data = JSON.parse(payload.data);
    } else if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    const sheet = payload.sheet || '';
    const action = payload.action || '';
    const data = payload.data || {};

    let result;
    if (sheet === 'Auth' || sheet === 'Users') {
      result = handleAuth(action, data);
    } else if (sheet === 'ActivityLog') {
      result = logActivity(data);
    } else if (sheet === 'DriveUpload') {
      result = uploadToDrive(data);
    } else {
      result = processSheet(sheet, action, data);
    }

    return setCORS(ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON));
  } catch (err) {
    return setCORS(ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message, stack: err.stack })).setMimeType(ContentService.MimeType.JSON));
  }
}

function doGet(e) {
  try {
    const sheet = e.parameter.sheet || '';
    const action = e.parameter.action || '';
    const filter = e.parameter.filter || '';
    const email = e.parameter.email || '';
    let result;

    if (sheet === 'Auth' || sheet === 'Users') {
      const data = { filter: filter };
      if (email) data.email = email;
      result = handleAuth(action || 'GET_USERS', data);
    } else if (sheet === 'ActivityLog') {
      result = readActivityLog(filter);
    } else {
      result = readSheetData(sheet, filter);
    }

    return setCORS(ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON));
  } catch (err) {
    return setCORS(ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON));
  }
}

// ===================== AUTH & USERS =====================
function handleAuth(action, data) {
  switch (action) {
    case 'LOGIN': return loginUser(data);
    case 'GET_USERS': return getUsers();
    case 'GET_USER': return getUserByEmail(data.email);
    case 'CREATE': return createUser(data);
    case 'UPDATE': return updateUser(data);
    case 'DELETE': return deleteUser(data);
    case 'FORGOT_OTP': return sendForgotOTP(data);
    case 'VERIFY_OTP': return verifyOTP(data);
    case 'RESET_PASS': return resetPassword(data);
    case 'CHANGE_PASSWORD': return changePassword(data);
    case 'UPDATE_PROFILE': return updateProfile(data);
    default: return { success: false, msg: 'Unknown auth action: ' + action };
  }
}

function hashPassword(pwd) {
  if (!pwd) return '';
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pwd, Utilities.Charset.UTF_8);
  return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

function getUsersSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = getOrCreateSheet(ss, SHEETS.USERS);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID','Name','Email','Password','Role','Modules','Status','Photo','Phone','Last Login','Created By','Created At','OTP','OTP Expiry']);
    styleHeader(sheet);
  }
  return sheet;
}

function createAdminIfMissing() {
  const sheet = getUsersSheet();
  if (sheet.getLastRow() < 2) {
    const id = 'USER_' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyyMMdd_HHmmss');
    sheet.appendRow([
      id, CONFIG.DEFAULT_ADMIN.name, CONFIG.DEFAULT_ADMIN.email,
      hashPassword(CONFIG.DEFAULT_ADMIN.password), 'Super Admin',
      ALL_MODULES.join(','), 'ACTIVE', '', '', '', 'System',
      Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm'), '', ''
    ]);
    alternateRows(sheet);
    Logger.log('✅ Default Super Admin created: ' + CONFIG.DEFAULT_ADMIN.email);
  }
}

function loginUser(data) {
  const sheet = getUsersSheet();
  const email = (data.email || '').toString().trim().toLowerCase();
  const pwd = hashPassword(data.password || '');
  const rows = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 14).getValues();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r[2].toString().trim().toLowerCase() === email && r[3].toString() === pwd) {
      if ((r[6] || '').toString().toUpperCase() !== 'ACTIVE') {
        return { success: false, msg: 'Account inactive. Contact admin.' };
      }
      const rowNum = i + 2;
      sheet.getRange(rowNum, 10).setValue(Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm'));
      const user = {
        id: r[0].toString(), name: r[1].toString(), email: r[2].toString(),
        role: r[4].toString(), modules: r[5].toString().split(',').map(m => m.trim()).filter(Boolean),
        status: r[6].toString(), photo: r[7].toString(), phone: r[8].toString()
      };
      logActivity({ user: user.name, role: user.role, action: 'Login', module: 'auth', details: 'User logged in' });
      return { success: true, user: user };
    }
  }
  return { success: false, msg: 'Invalid email or password' };
}

function getUsers() {
  const sheet = getUsersSheet();
  const rows = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 14).getValues();
  const users = rows.filter(r => r[2] !== '').map(r => ({
    id: r[0].toString(), name: r[1].toString(), email: r[2].toString(),
    role: r[4].toString(), modules: r[5].toString().split(',').map(m => m.trim()).filter(Boolean),
    status: r[6].toString(), photo: r[7].toString(), phone: r[8].toString(),
    lastLogin: r[9].toString(), createdBy: r[10].toString(), createdAt: r[11].toString()
  }));
  return { success: true, users: users };
}

function getUserByEmail(email) {
  if (!email) return { success: false, msg: 'Email required' };
  const sheet = getUsersSheet();
  const rows = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 14).getValues();
  for (let r of rows) {
    if (r[2].toString().trim().toLowerCase() === email.toLowerCase()) {
      return { success: true, user: {
        id: r[0].toString(), name: r[1].toString(), email: r[2].toString(),
        role: r[4].toString(), modules: r[5].toString().split(',').map(m => m.trim()).filter(Boolean),
        status: r[6].toString(), photo: r[7].toString(), phone: r[8].toString()
      }};
    }
  }
  return { success: false, msg: 'User not found' };
}

function createUser(data) {
  const sheet = getUsersSheet();
  const email = (data.email || '').toString().trim().toLowerCase();
  if (!email || !data.name || !data.password || !data.role) {
    return { success: false, msg: 'Name, email, password and role required' };
  }
  const total = sheet.getLastRow() - 1;
  if (total >= CONFIG.MAX_USERS) {
    return { success: false, msg: 'Max ' + CONFIG.MAX_USERS + ' users allowed' };
  }
  if (findRow(sheet, 3, email) > 0) return { success: false, msg: 'Email already exists' };

  let modules = data.modules || '';
  if (data.role === 'Super Admin' || data.role === 'Director') modules = ALL_MODULES.join(',');
  if (!modules) return { success: false, msg: 'Select at least one module' };

  const id = 'USER_' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyyMMdd_HHmmss');
  sheet.appendRow([
    id, data.name, email, hashPassword(data.password), data.role, modules,
    'ACTIVE', data.photo || '', data.phone || '', '', data.createdBy || 'Admin',
    Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm'), '', ''
  ]);
  alternateRows(sheet);

  try {
    MailApp.sendEmail({
      to: email,
      subject: 'Your House of Panchhi HR Account',
      body: 'Hi ' + data.name + ',\n\nYour HR software account has been created.\n\nEmail: ' + email + '\nPassword: ' + data.password + '\nRole: ' + data.role + '\n\nLogin: ' + CONFIG.COMPANY + ' HR Software\n\nPlease change your password after first login.\n\n- House of Panchhi HR Team'
    });
  } catch (e) { Logger.log('Email failed: ' + e); }

  logActivity({ user: data.createdBy || 'Admin', role: 'Admin', action: 'Created user', module: 'users', details: data.name + ' (' + data.role + ')' });
  return { success: true, id: id, msg: 'User created' };
}

function updateUser(data) {
  const sheet = getUsersSheet();
  const row = findRow(sheet, 1, data.id);
  if (row < 1) return { success: false, msg: 'User not found' };
  let modules = data.modules || '';
  if (data.role === 'Super Admin' || data.role === 'Director') modules = ALL_MODULES.join(',');
  const updates = [];
  if (data.name) updates.push({ col: 2, val: data.name });
  if (data.email) updates.push({ col: 3, val: data.email.toString().trim().toLowerCase() });
  if (data.password) updates.push({ col: 4, val: hashPassword(data.password) });
  if (data.role) updates.push({ col: 5, val: data.role });
  if (modules) updates.push({ col: 6, val: modules });
  if (data.status) updates.push({ col: 7, val: data.status });
  if (data.photo !== undefined) updates.push({ col: 8, val: data.photo });
  if (data.phone !== undefined) updates.push({ col: 9, val: data.phone });
  updates.forEach(u => sheet.getRange(row, u.col).setValue(u.val));
  alternateRows(sheet);
  return { success: true, msg: 'User updated' };
}

function deleteUser(data) {
  const sheet = getUsersSheet();
  const row = findRow(sheet, 1, data.id);
  if (row < 1) return { success: false, msg: 'User not found' };
  if (sheet.getRange(row, 5).getValue().toString() === 'Super Admin') {
    return { success: false, msg: 'Cannot delete Super Admin' };
  }
  sheet.deleteRow(row);
  alternateRows(sheet);
  return { success: true, msg: 'User deleted' };
}

function updateProfile(data) {
  const sheet = getUsersSheet();
  const row = findRow(sheet, 1, data.id);
  if (row < 1) return { success: false, msg: 'User not found' };
  if (data.name) sheet.getRange(row, 2).setValue(data.name);
  if (data.phone !== undefined) sheet.getRange(row, 9).setValue(data.phone);
  if (data.photo !== undefined) sheet.getRange(row, 8).setValue(data.photo);
  return { success: true, msg: 'Profile updated' };
}

function changePassword(data) {
  const sheet = getUsersSheet();
  const row = findRow(sheet, 1, data.id);
  if (row < 1) return { success: false, msg: 'User not found' };
  const currentHash = sheet.getRange(row, 4).getValue().toString();
  if (currentHash !== hashPassword(data.currentPassword || '')) {
    return { success: false, msg: 'Current password incorrect' };
  }
  sheet.getRange(row, 4).setValue(hashPassword(data.newPassword || ''));
  return { success: true, msg: 'Password changed' };
}

function sendForgotOTP(data) {
  const sheet = getUsersSheet();
  const email = (data.email || '').toString().trim().toLowerCase();
  const row = findRow(sheet, 3, email);
  if (row < 1) return { success: false, msg: 'Email not registered' };
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = Utilities.formatDate(new Date(Date.now() + 15 * 60 * 1000), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm');
  sheet.getRange(row, 13).setValue(otp);
  sheet.getRange(row, 14).setValue(expiry);
  try {
    MailApp.sendEmail({
      to: email,
      subject: 'Password Reset OTP — House of Panchhi HR',
      body: 'Your OTP for password reset is: ' + otp + '\n\nValid for 15 minutes.\n\nIf you did not request this, please ignore.\n\n- House of Panchhi HR Team'
    });
    return { success: true, msg: 'OTP sent to your email' };
  } catch (e) {
    return { success: false, msg: 'Failed to send OTP: ' + e.message };
  }
}

function verifyOTP(data) {
  const sheet = getUsersSheet();
  const email = (data.email || '').toString().trim().toLowerCase();
  const row = findRow(sheet, 3, email);
  if (row < 1) return { success: false, msg: 'Email not registered' };
  const savedOTP = sheet.getRange(row, 13).getValue().toString();
  const expiryStr = sheet.getRange(row, 14).getValue().toString();
  if (!savedOTP || savedOTP !== data.otp) return { success: false, msg: 'Invalid OTP' };
  if (!expiryStr) return { success: false, msg: 'OTP expired' };
  const expiry = parseDateTime(expiryStr);
  if (expiry && new Date() > expiry) return { success: false, msg: 'OTP expired' };
  return { success: true, msg: 'OTP verified' };
}

function resetPassword(data) {
  const sheet = getUsersSheet();
  const email = (data.email || '').toString().trim().toLowerCase();
  const row = findRow(sheet, 3, email);
  if (row < 1) return { success: false, msg: 'Email not registered' };
  const otpCheck = verifyOTP(data);
  if (!otpCheck.success) return otpCheck;
  sheet.getRange(row, 4).setValue(hashPassword(data.password || ''));
  sheet.getRange(row, 13).setValue('');
  sheet.getRange(row, 14).setValue('');
  return { success: true, msg: 'Password reset successful' };
}

function parseDateTime(str) {
  try {
    const [d, t] = str.split(' ');
    const [dd, mm, yyyy] = d.split('/').map(Number);
    const [h, m] = t.split(':').map(Number);
    return new Date(yyyy, mm - 1, dd, h, m);
  } catch (e) { return null; }
}

// ===================== ACTIVITY LOG =====================
function getActivityLogSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = getOrCreateSheet(ss, SHEETS.ACTIVITY_LOG);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp','User','Role','Action','Module','Details']);
    styleHeader(sheet);
  }
  return sheet;
}

function logActivity(data) {
  try {
    const sheet = getActivityLogSheet();
    sheet.appendRow([
      Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm:ss'),
      data.user || 'System', data.role || '', data.action || '', data.module || '', data.details || ''
    ]);
    alternateRows(sheet);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function readActivityLog(limit) {
  const sheet = getActivityLogSheet();
  const rows = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 6).getValues();
  let logs = rows.map(r => ({
    timestamp: r[0].toString(), user: r[1].toString(), role: r[2].toString(),
    action: r[3].toString(), module: r[4].toString(), details: r[5].toString()
  })).reverse();
  if (limit) logs = logs.slice(0, parseInt(limit) || 100);
  return { success: true, logs: logs };
}

// ===================== EMPLOYEES =====================
function saveEmployees(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = getOrCreateSheet(ss, SHEETS.EMPLOYEES);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'ID','E-Code','Old E-Code','Full Name','First Name','Father/Husband','Last Name','DOB','Gender',
      'Marital Status','Department','Designation','Location','Joining Date','Confirmation Date','Shift',
      'Status','Senior Tag','Bonus Tag','Mobile','Alt Mobile','Email','Official Email','Current Address',
      'PIN','Permanent Address','Permanent PIN','Emergency Name','Emergency Relation','Emergency Phone',
      'Aadhar','PAN','Fixed CTC','New CTC','Payment Mode','Bank','Account Holder','Account No','IFSC',
      'Branch','PF','UAN','ESIC','ESIC No','Remark','Added On'
    ]);
    styleHeader(sheet);
  }
  const row = [
    data.id || '', data.ecode || '', data.oldcode || '', data.fullname || '', data.fname || '',
    data.fhname || '', data.lname || '', data.dob || '', data.gender || '', data.marital || '',
    data.department || '', data.designation || '', data.location || '', data.joining || '',
    data.confirm || '', data.shift || '', data.status || 'ACTIVE', data.tagSenior ? 'YES' : 'NO',
    data.tagBonus ? 'YES' : 'NO', data.mobile || '', data.altmobile || '', data.email || '',
    data.offemail || '', data.curraddr || '', data.currpin || '', data.permaddr || '', data.permpin || '',
    data.emgname || '', data.emgrelation || '', data.emgphone || '', data.aadhar || '', data.pan || '',
    data.fixctc || 0, data.newctc || 0, data.paymode || '', data.bank || '', data.bankname || '',
    data.accno || '', data.ifsc || '', data.branch || '', data.pfapp || 'NO', data.uan || '',
    data.esicapp || 'NO', data.esicno || '', data.remark || '',
    data.addedOn || Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy')
  ];
  const existRow = findRow(sheet, 2, data.ecode);
  if (existRow > 0) sheet.getRange(existRow, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  alternateRows(sheet);
  return { success: true, ecode: data.ecode };
}

// ===================== ATTENDANCE =====================
function saveAttendance(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = getOrCreateSheet(ss, SHEETS.ATTENDANCE);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID','Date','E-Code','Name','Department','Shift','In Time','Late Min','Status','Remark','Saved At']);
    styleHeader(sheet);
  }
  const records = Array.isArray(data) ? data : [data];
  records.forEach(r => {
    const row = [
      r.id || '', r.date || '', r.ecode || '', r.empName || '', r.department || '', r.shift || '',
      r.inTime || '', r.lateMin || 0, r.status || '', r.remark || '',
      Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm')
    ];
    const existRow = findRowMulti(sheet, [{ col: 2, val: r.date }, { col: 3, val: r.ecode }]);
    if (existRow > 0) sheet.getRange(existRow, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
  });
  alternateRows(sheet);
  return { success: true, count: records.length };
}

// ===================== GATE PASS =====================
function saveGatePass(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = getOrCreateSheet(ss, SHEETS.GATE_PASS);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID','Date','E-Code','Name','Department','Mobile','Shift','Shift End','Out Time','Return Time','Expected Return','Purpose','Early Min','Duration Min','Status','Created At']);
    styleHeader(sheet);
  }
  const row = [
    data.id || '', data.date || '', data.ecode || '', data.empName || '', data.department || '',
    data.mobile || '', data.shift || '', data.shiftEnd || '', data.outTime || '', data.returnTime || '',
    data.expectedReturn || '', data.purpose || '', data.earlyMinutes || 0, data.durationMinutes || 0,
    data.status || 'OUT', Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm')
  ];
  const existRow = findRow(sheet, 1, data.id);
  if (existRow > 0) sheet.getRange(existRow, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  alternateRows(sheet);
  return { success: true };
}

// ===================== LEAVE =====================
function saveLeave(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = getOrCreateSheet(ss, SHEETS.LEAVE);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID','Applied On','E-Code','Name','Department','Type','From','To','Days','Reason','Med Cert','Verified','Status','Approved On','Approved By']);
    styleHeader(sheet);
  }
  const row = [
    data.id || '', data.appliedOn || '', data.ecode || '', data.empName || '', data.department || '',
    data.type || '', data.from || '', data.to || '', data.days || 0, data.reason || '', data.medCert || '',
    data.medVerified ? 'YES' : 'NO', data.status || 'PENDING', data.approvedOn || '', data.approvedBy || ''
  ];
  const existRow = findRow(sheet, 1, data.id);
  if (existRow > 0) sheet.getRange(existRow, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  alternateRows(sheet);
  return { success: true };
}

// ===================== SALARY =====================
function savePayroll(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = getOrCreateSheet(ss, SHEETS.SALARY);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID','Month','E-Code','Name','Department','Bank A/C','Gross','Working Days','Present Days','Payable Days','Bonus Days','Gross Earned','Advance Ded','Loan EMI','LWP Ded','Total Ded','Net Salary','Senior','Bonus Tag','Calculated At']);
    styleHeader(sheet);
  }
  const records = Array.isArray(data) ? data : [data];
  records.forEach(r => {
    const row = [
      r.id || '', r.month || '', r.ecode || '', r.empName || '', r.department || '', r.bankAcc || '',
      r.gross || 0, r.workingDays || 0, r.presentDays || 0, r.payableDays || 0, r.bonusDays || 0,
      r.grossEarned || 0, r.advanceDeduction || 0, r.loanEMI || 0, r.lwpDeduction || 0,
      r.totalDeductions || 0, r.netSalary || 0, r.tagSenior ? 'YES' : 'NO', r.tagBonus ? 'YES' : 'NO',
      Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm')
    ];
    const existRow = findRowMulti(sheet, [{ col: 2, val: r.month }, { col: 3, val: r.ecode }]);
    if (existRow > 0) sheet.getRange(existRow, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
  });
  alternateRows(sheet);
  return { success: true, count: records.length };
}

// ===================== ADVANCE / LOAN =====================
function saveAdvance(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = getOrCreateSheet(ss, SHEETS.ADVANCE);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID','Given On','E-Code','Name','Department','Type','Amount','EMI','Balance','Deduct Month','EMI Start','Remark','Status']);
    styleHeader(sheet);
  }
  const row = [
    data.id || '', data.givenOn || '', data.ecode || '', data.empName || '', data.department || '',
    data.type || '', data.amount || 0, data.emi || 0, data.balance || 0, data.deductMonth || '',
    data.emiStartMonth || '', data.remark || '', data.status || 'ACTIVE'
  ];
  const existRow = findRow(sheet, 1, data.id);
  if (existRow > 0) sheet.getRange(existRow, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  alternateRows(sheet);
  return { success: true };
}

// ===================== STORE =====================
function saveStore(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = getOrCreateSheet(ss, SHEETS.STORE);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID','Date','Item','Category','Condition','Qty','Unit','Rate','Total','Vendor','PO No','PR No','Bill No','Attachment URL','Attachment Name','PO Status','Remark','Added At']);
    styleHeader(sheet);
  }
  const row = [
    data.id || '', data.date || '', data.itemName || '', data.category || '', data.condition || '',
    data.qty || 0, data.unit || '', data.rate || 0, data.total || 0, data.vendor || '', data.po || '',
    data.pr || '', data.bill || '', data.attachmentUrl || '', data.attachmentName || '',
    data.poStatus || 'PENDING', data.remark || '',
    Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm')
  ];
  const existRow = findRow(sheet, 1, data.id);
  if (existRow > 0) sheet.getRange(existRow, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  alternateRows(sheet);
  return { success: true };
}

// ===================== DEPARTMENTS =====================
function saveDepartments(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = getOrCreateSheet(ss, SHEETS.DEPARTMENTS);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Name','HOD','Count','Color']);
    styleHeader(sheet);
  }
  const records = Array.isArray(data) ? data : [data];
  records.forEach(r => {
    const row = [r.name || '', r.hod || '', r.count || 0, r.color || ''];
    const existRow = findRow(sheet, 1, r.name);
    if (existRow > 0) sheet.getRange(existRow, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
  });
  alternateRows(sheet);
  return { success: true };
}

// ===================== GOOGLE DRIVE UPLOAD =====================
function uploadToDrive(data) {
  try {
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    const subfolderName = data.folder || 'General';
    let subfolder = folder.getFoldersByName(subfolderName);
    let targetFolder = subfolder.hasNext() ? subfolder.next() : folder.createFolder(subfolderName);

    const blob = Utilities.newBlob(Utilities.base64Decode(data.base64), data.mimeType, data.fileName);
    const file = targetFolder.createFile(blob);
    const url = 'https://drive.google.com/uc?export=view&id=' + file.getId();
    return { success: true, url: url, fileId: file.getId(), fileName: data.fileName };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ===================== SHEET PROCESSOR =====================
function processSheet(sheet, action, data) {
  switch (sheet) {
    case 'Employees': return saveEmployees(data);
    case 'Employees_Bulk': return bulkSave(data, saveEmployees);
    case 'Attendance': return saveAttendance(data);
    case 'GatePass': return saveGatePass(data);
    case 'Leave': return saveLeave(data);
    case 'Payroll': return savePayroll(data);
    case 'Advance': return saveAdvance(data);
    case 'Store': return saveStore(data);
    case 'Departments': return saveDepartments(data);
    default: return { success: false, msg: 'Unknown sheet: ' + sheet };
  }
}

function bulkSave(dataArr, fn) {
  if (!Array.isArray(dataArr)) dataArr = [dataArr];
  dataArr.forEach(d => fn(d));
  return { success: true, count: dataArr.length };
}

// ===================== READ DATA =====================
function readSheetData(sheetName, filter) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const name = SHEETS[sheetName] || sheetName;
  const sheet = ss.getSheetByName(name);
  if (!sheet) return { success: false, msg: 'Sheet not found: ' + name };
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { success: true, data: [] };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const data = rows
    .filter(row => row.some(v => v !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
  return { success: true, data: data };
}

// ===================== HELPERS =====================
function getOrCreateSheet(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function findRow(sheet, col, value) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const vals = sheet.getRange(2, col, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (vals[i][0]?.toString().trim() === value?.toString().trim()) return i + 2;
  }
  return -1;
}

function findRowMulti(sheet, conditions) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const maxCol = Math.max(...conditions.map(c => c.col));
  const vals = sheet.getRange(2, 1, last - 1, maxCol).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (conditions.every(c => vals[i][c.col - 1]?.toString().trim() === c.val?.toString().trim())) return i + 2;
  }
  return -1;
}

function styleHeader(sheet) {
  const last = sheet.getLastColumn();
  if (last === 0) return;
  const range = sheet.getRange(1, 1, 1, last);
  range.setBackground('#1a0533');
  range.setFontColor('#ffffff');
  range.setFontWeight('bold');
  range.setFontSize(10);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 36);
  for (let i = 1; i <= last; i++) {
    try { sheet.setColumnWidth(i, 120); } catch (e) {}
  }
}

function alternateRows(sheet) {
  const last = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (last < 2 || lastCol === 0) return;
  for (let i = 2; i <= last; i++) {
    sheet.getRange(i, 1, 1, lastCol).setBackground(i % 2 === 0 ? '#f5f3ff' : '#ffffff');
  }
}

// ===================== SETUP =====================
function setupAll() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  Object.values(SHEETS).forEach(name => {
    if (!ss.getSheetByName(name)) ss.insertSheet(name);
  });
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  createAdminIfMissing();
  seedDepartments();
  Logger.log('✅ Setup complete!');
  Logger.log('Sheet ID: ' + CONFIG.SHEET_ID);
  Logger.log('Drive Folder ID: ' + CONFIG.DRIVE_FOLDER_ID);
}

function seedDepartments() {
  const depts = [
    'ADMIN','SALES','ONLINE SALES','ONLINE DISPATCH','DESIGN','DISPATCH','QC','STITCHING','EMBROIDERY',
    'MENDING','PRODUCTION PLANNING','PURCHASE','STORE','VALUE ADDITION'
  ];
  const colors = ['#6c47ff','#10b981','#f59e0b','#3b82f6','#ef4444','#ec4899','#8b5cf6','#06b6d4','#14b8a6','#f97316','#6366f1','#84cc16','#d946ef','#0ea5e9'];
  const data = depts.map((d, i) => ({ name: d, hod: '', count: 0, color: colors[i] }));
  saveDepartments(data);
}
