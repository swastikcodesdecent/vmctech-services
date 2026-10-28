# VMC Tech India — Client Service Management Portal

A responsive, production-ready **Client Service Management Portal** engineered for **VMC Tech India**, a website development, cloud infrastructure, and IT maintenance company.

The platform provides complete role-separated portals for administrators and clients, real-time live service usage meters, automated expiry countdowns, invoice generation, payment tracking, and scheduled reminder automations.

---

## 🌟 Key Features

### 1. Dual-Portal Authentication & Role Isolation
- **Separate Client & Admin Access:** Strict role validation ensuring clients only access their assigned subscriptions, invoices, and profile.
- **Secure Password Setup Link:** Admins provision clients by name and Gmail address. The system dispatches a cryptographically secure setup/reset link—no plaintext passwords are ever emailed or hardcoded.
- **Client Privilege Isolation:** Clients cannot modify service usage, thresholds, expiry dates, pricing, or administrative logs.
- **Quick Demo Switcher:** Switch between Admin and multiple Client personas with a single click to test live real-time sync across sessions.

### 2. Live Service Usage & Metric Tracking
- **Multi-Unit Custom Metrics:** Custom labels, units, and thresholds tailored to each service:
  - *Website Hosting:* Disk usage in GB (e.g., `18.5 / 50 GB`) with configurable threshold alerts.
  - *Maintenance:* Task tickets consumed (e.g., `7 / 10 Tasks`).
  - *SSL Certificates:* Remaining days valid (e.g., `285 / 365 Days`).
  - *Custom Development:* Milestone completion percentage (`85%`).
- **Real-Time Reactive Updates:** Powered by Cloud Firestore `onSnapshot` and `BroadcastChannel`. When an administrator adjusts a metric or drags the slider, the client's dashboard updates immediately without requiring a browser refresh.
- **Dynamic Color Warnings:** Automatically transitions between Green (Optimal), Amber (Approaching Threshold), and Red (Critical Quota Exceeded).

### 3. Automated Expiry & Scheduled Reminders
- **Automatic Expiry Calculations:** Computes exact days remaining to service renewal.
- **Configurable Reminder Intervals:** Triggers notifications at **7 days**, **3 days**, **1 day**, and **Expiration Day**.
- **Server-Side Scheduled Cron (`checkServiceExpiryCron`):** Daily Cloud Function runs at 06:00 IST independently of whether anyone is logged in.
- **Duplicate Prevention:** Checks `reminderLogs` to ensure clients never receive duplicate notices on the same day.

### 4. Billing, Invoices & Payment Receipts
- **GST-Compliant Tax Invoices:** Generates formal invoices with line items, 18% GST breakdown, and print/PDF output.
- **Lifecycle Statuses:** `Pending`, `Paid`, `Overdue`, and `Cancelled`.
- **Payment Verification Safeguard:** Invoices are never marked as paid simply by clicking a client payment button; payments require formal UTR/reference recording by administrators or verified gateway webhooks.
- **Automated Payment Receipts:** Generates formal confirmation receipts sent via transactional email.

### 5. Activity Audit Trail & In-App Notification Hub
- **Immutable Audit Trail (`activityLogs`):** Records every admin action, metric change, client suspension, and payment.
- **In-App Notification Center:** Unread count badge, mark-as-read toggles, and direct links to active services.

---

## 🎨 UI/UX & Design Architecture

Built according to the specified visual direction:
- **Primary Background:** `#0B1020`
- **Secondary Background:** `#111827`
- **Accent Blue:** `#4F8CFF`
- **Secondary Accent:** `#7C5CFC`
- **Status Green:** `#22C55E`
- **Status Warning:** `#F59E0B`
- **Status Danger:** `#EF4444`
- **Typography:** `Inter` & `Manrope` from Google Fonts
- **Icons:** Lucide Icons (CDN)
- **Design Elements:** Glassmorphism, subtle glowing ambient backgrounds, smooth transitions, skeleton loaders, and a Light/Dark theme toggle.

---

## 📂 Project Structure

```text
├── css/
│   └── styles.css              # Custom SaaS design system & theme variables
├── js/
│   ├── firebase-config.js      # Firebase v10 initialization with local reactive fallback
│   ├── store.js                # Central data store, Firestore abstraction & live sync
│   ├── auth.js                 # Authentication, session manager & setup link generator
│   ├── admin.js                # Admin dashboard controllers, sliders, modals & CRUD
│   ├── client.js               # Client portal controllers, countdowns & ticket dispatch
│   └── app.js                  # Main coordinator, routing, modals & toast notifications
├── functions/
│   ├── package.json            # Cloud Functions dependencies (firebase-admin, nodemailer)
│   ├── index.js                # Expiry cron, invite links, receipts & transactional email
│   └── provision-admin.js      # CLI script for initial admin provisioning without secrets
├── index.html                  # Single-page application shell
├── firestore.rules             # Role-based Firestore security rules
├── firebase.json               # Firebase Hosting, Firestore & Functions config
├── vercel.json                 # Vercel deployment configuration & SPA rewrites
└── README.md                   # Documentation & setup guide
```

---

## 🚀 Quick Start (Running Locally)

The portal is designed to work immediately out-of-the-box using vanilla web standards:

1. Open `index.html` in any modern web browser or serve it with any local HTTP server:
   ```bash
   # Using Python 3:
   python -m http.server 3000

   # Or using npx serve:
   npx serve .
   ```
2. Access the portals:
   - **Client Portal:** `http://localhost:3000/index.html` (or `http://127.0.0.1:5500/index.html`)
   - **Dedicated Admin Portal:** `http://localhost:3000/admin-login.html` (or `http://127.0.0.1:5500/admin-login.html`)
3. Administrator Credentials:
   - **Email:** `admin@vmctechindia.in`
   - **Password:** `swastikdps2009S` (can be updated inside account settings)
4. From the Admin Dashboard, click **"+ Add New Client"** to create real client accounts and assign services.

---

## ☁️ Connecting Live Firebase Backend

To connect the application to your production Firebase project:

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com).
2. Enable **Email/Password** under **Authentication -> Sign-in method**.
3. Create a **Cloud Firestore** database in production mode.
4. Open [js/firebase-config.js](file:///c:/Users/Admin/Desktop/services/js/firebase-config.js) and replace the configuration keys with your Firebase Web App credentials:
   ```javascript
   export const firebaseConfig = {
     apiKey: "YOUR_FIREBASE_API_KEY",
     authDomain: "your-project-id.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef"
   };
   ```
5. Deploy Firestore Security Rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

---

## 🔐 Initial Admin Account Provisioning

To prevent exposing administrative credentials in client-side code, provision the primary administrator using the backend provisioning script:

1. Download your Firebase service account key from **Project Settings -> Service accounts -> Generate new private key** and save it as `functions/serviceAccountKey.json`.
2. Run the provisioning CLI command:
   ```bash
   node functions/provision-admin.js admin@vmctech.in "Vikram Choudhary"
   ```
3. The script:
   - Creates the Firebase Auth record (or fetches existing).
   - Assigns custom claims: `{ admin: true, role: 'admin' }`.
   - Creates the profile in the Firestore `users` collection.
   - Outputs a one-time secure password setup link.

---

## ✉️ Cloud Functions & Transactional Email Setup

To configure automated emails (reminders, invitations, invoices, receipts):

1. Set your transactional email environment variables in Firebase:
   ```bash
   firebase functions:config:set \
     smtp.host="smtp.gmail.com" \
     smtp.port="465" \
     smtp.user="support@vmctech.in" \
     smtp.pass="YOUR_GMAIL_APP_PASSWORD"
   ```
2. Deploy the scheduled cron and backend triggers:
   ```bash
   cd functions
   npm install
   firebase deploy --only functions
   ```

---

## 🌐 Deployment to Vercel & Firebase Hosting

### Deploying Frontend to Vercel:
```bash
# Install Vercel CLI if not installed:
npm i -g vercel

# Deploy:
vercel --prod
```
The included [vercel.json](file:///c:/Users/Admin/Desktop/services/vercel.json) automatically handles single-page routing and security headers.

### Deploying Frontend to Firebase Hosting:
```bash
firebase deploy --only hosting
```

---

## 🛡️ Firestore Database Schema

- **`users`**: `{ id, email, displayName, company, role, phone, status, createdAt, lastLoginAt }`
- **`services`**: `{ id, name, category, defaultUnit, defaultMax, description }`
- **`clientServices`**: `{ id, clientId, clientName, clientEmail, serviceId, serviceName, description, billingAmount, billingCycle, startDate, expiryDate, status, metric: { label, current, max, unit, thresholdWarning, isPercentage }, adminNotes, renewalHistory }`
- **`invoices`**: `{ id, invoiceNumber, clientId, clientName, clientEmail, clientServiceId, serviceName, amount, issueDate, dueDate, status, items, paymentMethod, paidAt }`
- **`payments`**: `{ id, paymentNumber, invoiceId, clientId, clientName, amount, paymentDate, method, referenceNo, recordedBy, notes }`
- **`notifications`**: `{ id, targetUserId, role, title, message, type, isRead, link, createdAt }`
- **`reminderLogs`**: `{ id, clientServiceId, clientEmail, reminderType, sentDate, sentAt, status }`
- **`activityLogs`**: `{ id, actorId, actorName, actorRole, action, targetType, targetId, details, timestamp }`

---

## 📄 License & Attribution

Developed for **VMC Tech India** — All rights reserved.
