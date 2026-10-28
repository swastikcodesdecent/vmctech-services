/* ==========================================================================
   VMC TECH INDIA - SERVER-SIDE AUTOMATIONS & CLOUD FUNCTIONS
   Scheduled Expiry Cron, Transactional Emails, Invoice Alerts & Receipts
   ========================================================================== */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

// --------------------------------------------------------------------------
// Email Transporter (Securely uses environment variables)
// --------------------------------------------------------------------------
function createMailTransporter() {
  const host = process.env.SMTP_HOST || functions.config().smtp?.host || 'smtp.gmail.com';
  const port = process.env.SMTP_PORT || functions.config().smtp?.port || 465;
  const user = process.env.SMTP_USER || functions.config().smtp?.user;
  const pass = process.env.SMTP_PASS || functions.config().smtp?.pass;

  if (!user || !pass) {
    console.warn('[VMC Functions] SMTP credentials not set. Simulating email in server logs.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass }
  });
}

async function sendEmail({ to, subject, htmlText, text }) {
  const transporter = createMailTransporter();
  const fromAddress = `"VMC Tech India Operations" <${process.env.SMTP_FROM || 'support@vmctech.in'}>`;

  if (!transporter) {
    console.log(`[SIMULATED EMAIL TO: ${to}]`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${text || htmlText}`);
    return { simulated: true };
  }

  return transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text,
    html: htmlText
  });
}

// --------------------------------------------------------------------------
// 1. SCHEDULED DAILY CRON: Check Service Expiries & Dispatch Reminders
// Runs every morning at 06:00 IST without requiring client browser open
// --------------------------------------------------------------------------
exports.checkServiceExpiryCron = functions.pubsub
  .schedule('0 6 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    console.log('[Cron Job] Starting daily service expiry & automated reminder check...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snapshot = await db.collection('clientServices')
      .where('status', 'in', ['active', 'expiring_soon'])
      .get();

    if (snapshot.empty) {
      console.log('[Cron Job] No active services to evaluate.');
      return null;
    }

    const batch = db.batch();
    let remindersDispatched = 0;

    for (const doc of snapshot.docs) {
      const service = doc.data();
      const expiry = new Date(service.expiryDate);
      expiry.setHours(0, 0, 0, 0);

      const diffTime = expiry.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let newStatus = service.status;
      let reminderType = null;

      if (daysLeft < 0) {
        newStatus = 'expired';
        reminderType = 'expired';
      } else if (daysLeft === 0) {
        newStatus = 'expiring_soon';
        reminderType = '0_day';
      } else if (daysLeft <= 1) {
        newStatus = 'expiring_soon';
        reminderType = '1_day';
      } else if (daysLeft <= 3) {
        newStatus = 'expiring_soon';
        reminderType = '3_days';
      } else if (daysLeft <= 7) {
        newStatus = 'expiring_soon';
        reminderType = '7_days';
      }

      // Update status if changed
      if (newStatus !== service.status) {
        batch.update(doc.ref, { status: newStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }

      // Check if reminder was already sent today to prevent duplicate emails
      if (reminderType) {
        const todayStr = today.toISOString().split('T')[0];
        const logQuery = await db.collection('reminderLogs')
          .where('clientServiceId', '==', doc.id)
          .where('reminderType', '==', reminderType)
          .where('sentDate', '==', todayStr)
          .limit(1)
          .get();

        if (logQuery.empty) {
          // Send transactional reminder email
          const subject = daysLeft < 0
            ? `[URGENT] Your Service "${service.serviceName}" Has Expired — VMC Tech India`
            : `[Action Required] Renewal Notice: ${service.serviceName} expires in ${daysLeft} days`;

          const emailBody = `
            <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #4F8CFF; margin-top: 0;">VMC Tech India Renewal Notice</h2>
              <p>Dear <strong>${service.clientName}</strong>,</p>
              <p>This is an automated reminder regarding your subscription for <strong>${service.serviceName}</strong> (${service.description}).</p>
              
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid ${daysLeft <= 3 ? '#ef4444' : '#f59e0b'};">
                <p style="margin: 0 0 8px;"><strong>Expiry Date:</strong> ${service.expiryDate}</p>
                <p style="margin: 0 0 8px;"><strong>Remaining Time:</strong> ${daysLeft < 0 ? 'Expired' : `${daysLeft} Day(s)`}</p>
                <p style="margin: 0;"><strong>Renewal Cost:</strong> ₹${(service.billingAmount || 0).toLocaleString('en-IN')}</p>
              </div>

              <p>To ensure uninterrupted service and zero downtime for your web properties, please log into your client portal or clear the associated invoice.</p>
              
              <p style="margin-top: 25px;">
                <a href="https://vmctech.in" style="background: #4F8CFF; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Access Client Dashboard
                </a>
              </p>

              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;">
              <p style="font-size: 12px; color: #64748b;">
                VMC Tech India — Client Operations Desk<br>
                Email: support@vmctech.in | Web: https://vmctech.in
              </p>
            </div>
          `;

          await sendEmail({
            to: service.clientEmail,
            subject,
            htmlText: emailBody,
            text: `Dear ${service.clientName}, your service ${service.serviceName} expires on ${service.expiryDate}. Please renew via your client portal.`
          });

          // Log in reminderLogs
          const newLogRef = db.collection('reminderLogs').doc();
          batch.set(newLogRef, {
            clientServiceId: doc.id,
            clientEmail: service.clientEmail,
            reminderType,
            sentDate: todayStr,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'delivered'
          });

          // Create In-App Notification
          const notifRef = db.collection('notifications').doc();
          batch.set(notifRef, {
            targetUserId: service.clientId,
            role: 'client',
            title: daysLeft < 0 ? 'Service Expired' : 'Service Renewal Due',
            message: `Your ${service.serviceName} is due for renewal on ${service.expiryDate}.`,
            type: daysLeft <= 1 ? 'danger' : 'warning',
            isRead: false,
            createdAt: new Date().toISOString()
          });

          remindersDispatched++;
        }
      }
    }

    await batch.commit();
    console.log(`[Cron Job] Completed. Status updated and ${remindersDispatched} reminders dispatched.`);
    return null;
  });

// --------------------------------------------------------------------------
// 2. HTTPS CALLABLE: Send Secure Client Invitation Link
// Admin calls this to invite new client; emails setup link without plaintext pass
// --------------------------------------------------------------------------
exports.sendClientInvite = functions.https.onCall(async (data, context) => {
  // Authorization check: Only authenticated Admins can call
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const callerDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only Admins can invite clients.');
  }

  const { clientEmail, clientName } = data;
  if (!clientEmail) {
    throw new functions.https.HttpsError('invalid-argument', 'Client email is required.');
  }

  try {
    // Generate secure password reset / initial setup link via Firebase Admin
    const setupLink = await admin.auth().generatePasswordResetLink(clientEmail, {
      url: 'https://vmctech.in'
    });

    const emailBody = `
      <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4F8CFF;">Welcome to VMC Tech India</h2>
        <p>Dear <strong>${clientName || 'Valued Client'}</strong>,</p>
        <p>Your client portal account with <strong>VMC Tech India</strong> has been created. Through this portal, you can monitor your hosting usage, active domains, SSL certificates, invoices, and service health in real-time.</p>
        
        <p>For your security, please click the link below to set your confidential account password:</p>

        <p style="margin: 25px 0;">
          <a href="${setupLink}" style="background: #4F8CFF; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">
            Set Your Secure Password
          </a>
        </p>

        <p style="font-size: 13px; color: #64748b;">If the button does not work, copy and paste this URL into your browser:<br>${setupLink}</p>
        
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;">
        <p style="font-size: 12px; color: #64748b;">
          VMC Tech India — Website Development & Cloud Services<br>
          Need help? Contact support@vmctech.in
        </p>
      </div>
    `;

    await sendEmail({
      to: clientEmail,
      subject: 'Account Setup: Welcome to VMC Tech India Client Portal',
      htmlText: emailBody,
      text: `Welcome to VMC Tech India. Please set your password here: ${setupLink}`
    });

    return { success: true, message: `Invitation setup link dispatched to ${clientEmail}` };
  } catch (error) {
    console.error('Error in sendClientInvite:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// --------------------------------------------------------------------------
// 3. FIRESTORE TRIGGER: On Payment Recorded -> Email Official Receipt
// --------------------------------------------------------------------------
exports.onPaymentRecorded = functions.firestore
  .document('payments/{paymentId}')
  .onCreate(async (snap, context) => {
    const payment = snap.data();
    
    // Fetch client email
    const clientDoc = await db.collection('users').doc(payment.clientId).get();
    if (!clientDoc.exists) return null;
    const clientEmail = clientDoc.data().email;

    const emailBody = `
      <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #22C55E;">Payment Receipt Confirmed</h2>
        <p>Dear <strong>${payment.clientName}</strong>,</p>
        <p>We gratefully acknowledge receipt of your payment. Details are recorded below:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Receipt Number:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${payment.paymentNumber}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Invoice Reference:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${payment.invoiceNumber}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Amount Paid:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #22c55e;">₹${Number(payment.amount).toLocaleString('en-IN')}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Payment Method:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-transform: uppercase;">${payment.method}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">UTR / Ref No:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${payment.referenceNo}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Date:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${payment.paymentDate}</td></tr>
        </table>

        <p>Your invoice status is now updated to <strong>PAID</strong>. Thank you for your continued partnership with VMC Tech India.</p>
      </div>
    `;

    return sendEmail({
      to: clientEmail,
      subject: `Payment Receipt: ${payment.paymentNumber} — VMC Tech India`,
      htmlText: emailBody,
      text: `Payment confirmed for ${payment.invoiceNumber}: ₹${payment.amount}`
    });
  });
