# 🪶 House of Panchhi HR Pro

Complete HR Management Software — GSheet-only backend, real-time sync, Google Drive attachments, multi-user login, OTP password reset, and activity logging.

---

## ⚡ Quick Setup

### 1. Create Google Sheet
- Go to [Google Sheets](https://sheets.new)
- Create a blank sheet named **"Panchhi HR Data"**
- Copy the **Sheet ID** from the URL:
  ```
  https://docs.google.com/spreadsheets/d/THIS_IS_THE_SHEET_ID/edit
  ```

### 2. Create Google Drive Folder
- Go to [Google Drive](https://drive.google.com)
- Create a folder named **"Panchhi HR Attachments"**
- Right-click → **Share** → Make sure owner has access (your email)
- Open the folder, copy the **Folder ID** from URL:
  ```
  https://drive.google.com/drive/folders/THIS_IS_THE_FOLDER_ID
  ```

### 3. Paste IDs in `backend/Code.gs`
```javascript
const CONFIG = {
  SHEET_ID: 'YOUR_SHEET_ID_HERE',
  DRIVE_FOLDER_ID: 'YOUR_FOLDER_ID_HERE',
  // Also change default admin email/password
};
```

### 4. Deploy Apps Script
1. Open the Google Sheet
2. Click **Extensions → Apps Script**
3. Delete default `Code.gs` content
4. Paste the entire `backend/Code.gs`
5. Click **Save** (Ctrl+S)
6. Click **Run → setupAll()** (grant permissions when asked)
7. Click **Deploy → New deployment**
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone
8. Copy the **Web App URL**

### 5. Paste Web App URL in Frontend
Open `assets/js/app.js` and replace:
```javascript
const CONFIG = {
  WEB_APP_URL: 'YOUR_WEB_APP_URL_HERE',
  ...
};
```

### 6. Deploy Website
- Push all files to GitHub Pages or any static host
- Open `login.html`

---

## 🔐 Default Login

```
Email: aditya@houseofpanchhi.com
Password: admin123
```

⚠️ **Change this immediately after first login!**

---

## 📁 File Structure

```
Panchhi-HR-New/
├── login.html
├── index.html
├── employees.html
├── attendance.html
├── gatepass.html
├── leave.html
├── salary.html
├── store.html
├── analytics.html
├── teams.html
├── users.html
├── assets/
│   ├── css/style.css
│   ├── js/app.js
│   └── img/
└── backend/
    └── Code.gs
```

---

## ✅ Features

- Multi-user login with roles (Super Admin, Director, User)
- Module-based permissions
- OTP password reset via email
- Activity log (who changed what, when)
- Google Drive attachment upload (store bills, profile photos, medical certs)
- Real-time sync from Google Sheets
- No localStorage — everything reads from GSheet
- All modules: Employees, Attendance, Gate Pass, Leave, Salary, Store, Analytics, Teams

---

## 🛠️ Built For

**House of Panchhi** — by Aditya Tomar
