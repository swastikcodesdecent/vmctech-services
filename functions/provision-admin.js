/* ==========================================================================
   VMC TECH INDIA - INITIAL ADMIN ACCOUNT PROVISIONING SCRIPT
   Safely provisions the primary administrator with Admin Custom Claims & Firestore record
   Usage: node functions/provision-admin.js <admin-email> [displayName]
   ========================================================================== */

const admin = require('firebase-admin');
const readline = require('readline');

// Check for service account key
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';

try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
} catch (e) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (err) {
    console.error('Failed to initialize Firebase Admin. Please set GOOGLE_APPLICATION_CREDENTIALS or provide serviceAccountKey.json.');
    console.error(err.message);
    process.exit(1);
  }
}

const auth = admin.auth();
const db = admin.firestore();

async function provisionAdmin(email, displayName = 'VMC Administrator') {
  if (!email || !email.includes('@')) {
    console.error('Error: Please provide a valid email address.');
    process.exit(1);
  }

  console.log(`\n--- Provisioning Administrator: ${email} ---`);

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`Found existing Firebase Auth user with UID: ${userRecord.uid}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log('User does not exist in Auth. Creating new user record...');
      userRecord = await auth.createUser({
        email,
        displayName,
        emailVerified: true
      });
      console.log(`Created new Firebase Auth user with UID: ${userRecord.uid}`);
    } else {
      throw err;
    }
  }

  // 1. Set Custom User Claims for Firebase Auth token
  await auth.setCustomUserClaims(userRecord.uid, {
    admin: true,
    role: 'admin'
  });
  console.log('✓ Successfully set custom token claim { admin: true, role: "admin" }');

  // 2. Set Firestore role in 'users' collection
  const userDocRef = db.collection('users').doc(userRecord.uid);
  await userDocRef.set({
    id: userRecord.uid,
    email: userRecord.email,
    displayName: displayName || userRecord.displayName,
    company: 'VMC Tech India HQ',
    role: 'admin',
    status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastLoginAt: null
  }, { merge: true });
  console.log('✓ Successfully created/updated Firestore document at users/' + userRecord.uid);

  // 3. Generate secure password setup link
  const setupLink = await auth.generatePasswordResetLink(email);
  console.log('\n======================================================');
  console.log('ADMIN ACCOUNT PROVISIONED SUCCESSFULLY!');
  console.log('======================================================');
  console.log(`Admin Email: ${email}`);
  console.log(`UID:         ${userRecord.uid}`);
  console.log(`Secure Setup Link:`);
  console.log(setupLink);
  console.log('======================================================\n');
  console.log('Send this setup link to the administrator to set their password.');
  process.exit(0);
}

const emailArg = process.argv[2] || 'admin@vmctechindia.in';
const nameArg = process.argv[3] || 'VMC Administrator';

console.log(`Starting provision script for: ${emailArg}`);

provisionAdmin(emailArg, nameArg).catch(err => {
  console.error('Provisioning failed:', err);
  process.exit(1);
});
