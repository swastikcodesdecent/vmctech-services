/* ==========================================================================
   VMC TECH INDIA - FIREBASE CONFIGURATION & INITIALIZATION
   Supports Firebase v10 CDN (compat & modular) with seamless live fallback
   ========================================================================== */

// Replace the placeholder values below with your Firebase Project Settings
export const firebaseConfig = {
  apiKey: "AIzaSyBO08s36tzD35-XlYv7pF-Q5wPl3eMKILE",
  authDomain: "vmc-tech-client-portal.firebaseapp.com",
  projectId: "vmc-tech-client-portal",
  storageBucket: "vmc-tech-client-portal.firebasestorage.app",
  messagingSenderId: "312293642338",
  appId: "1:312293642338:web:3d2b1373bcbf2d99e3413b"
};

// State flag for active backend mode
export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.includes("YOUR_API_KEY") &&
    firebaseConfig.projectId !== "vmc-tech-india";
};

// Initialize Firebase if CDN script is loaded and config is valid
let app = null;
let auth = null;
let db = null;

export const initializeFirebaseServices = async () => {
  if (typeof window !== 'undefined' && window.firebase && isFirebaseConfigured()) {
    try {
      if (!window.firebase.apps.length) {
        app = window.firebase.initializeApp(firebaseConfig);
      } else {
        app = window.firebase.app();
      }
      auth = window.firebase.auth();
      db = window.firebase.firestore();
      console.info("[VMC Portal] Connected to Live Cloud Firestore & Firebase Auth.");
      return { isLive: true, app, auth, db };
    } catch (err) {
      console.warn("[VMC Portal] Firebase init error, falling back to Realtime Engine:", err);
      return { isLive: false, error: err };
    }
  } else {
    console.info("[VMC Portal] Operating in Local High-Fidelity Realtime Engine (Production-ready schema & listeners).");
    return { isLive: false, reason: "Local mode / Demo active" };
  }
};

export { app, auth, db };
