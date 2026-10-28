/* ==========================================================================
   VMC TECH INDIA - AUTHENTICATION & ROLE-BASED ACCESS CONTROLLER
   Secure session persistence, role guards, password setup, reset links
   Multi-Device Session Persistence, Firestore User Verification, Secure Passwords
   ========================================================================== */

import { portalStore } from './store.js';

const AUTH_STORAGE_KEY = 'vmc_portal_current_session';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.authListeners = new Set();
    this.loadSession();
  }

  loadSession() {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        this.currentUser = JSON.parse(stored);
      }
    } catch (e) {
      this.currentUser = null;
    }
  }

  saveSession(user) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    this.notifyListeners();
  }

  onAuthStateChanged(listener) {
    this.authListeners.add(listener);
    listener(this.currentUser);
    return () => this.authListeners.delete(listener);
  }

  notifyListeners() {
    this.authListeners.forEach(listener => {
      try {
        listener(this.currentUser);
      } catch (e) {
        console.error('Error in auth listener:', e);
      }
    });
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
  }

  isClient() {
    return this.currentUser && this.currentUser.role === 'client';
  }

  getCurrentUser() {
    return this.currentUser;
  }

  // Login method for both Admin and Client with credentials
  // Login method for both Admin and Client across devices
  async login(email, password, requestedRole = null) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = portalStore.getCollection('users');
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);

    // 1. Ensure backend is initialized so Firestore is reachable
    if (!portalStore.isLiveFirebase && typeof window !== 'undefined' && window.firebase) {
      await portalStore.initBackend();
    }

    // 2. Query user from local reactive cache
    let users = portalStore.getCollection('users');
    let user = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

    // 3. Multi-device sync: If user was created on another device and not yet in cache, query Firestore directly
    if (!user && portalStore.firebaseDb) {
      try {
        const querySnapshot = await portalStore.firebaseDb.collection('users')
          .where('email', '==', cleanEmail)
          .limit(1)
          .get();
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          user = { id: doc.id, ...doc.data() };
        }
      } catch (err) {
        console.warn('[AuthManager] Direct Firestore user lookup warning:', err.message);
      }
    }

    // 4. Default Admin fallback if database is newly initialized
    if (!user && cleanEmail === 'admin@vmctechindia.in') {
      user = {
        id: 'admin_1',
        email: 'admin@vmctechindia.in',
        displayName: 'VMC Administrator',
        company: 'VMC Tech India HQ',
        role: 'admin',
        phone: '+91 98201 12345',
        status: 'active',
        password: 'swastikdps2009S'
      };
      if (portalStore.firebaseDb) {
        try {
          await portalStore.firebaseDb.collection('users').doc('admin_1').set(user);
        } catch (e) {}
      }
    }

    if (!user) {
      throw new Error('No account found with this email address.');
      throw new Error('No account found with this email address. Please check your credentials.');
    }

    if (user.status === 'suspended') {
      throw new Error('This account has been suspended by administration. Please contact support.');
      throw new Error('This account has been suspended by administration. Please contact support@vmctech.in.');
    }

    if (requestedRole && user.role !== requestedRole) {
      if (user.role === 'admin' && requestedRole === 'client') {
        throw new Error('Administrative account detected. Please use the "Admin Login" portal link at the bottom.');
        throw new Error('Administrative account detected. Please use the Admin Console login.');
      } else if (user.role === 'client' && requestedRole === 'admin') {
        throw new Error('Access restricted. This is a Client account. Please return to the Client Portal.');
      }
      throw new Error(`Unauthorized role access. Please use the ${user.role === 'admin' ? 'Admin' : 'Client'} login portal.`);
    }

    // Default password policy check
    // In local demo mode: accept 'Admin@1234' for admin, or password length >= 6, or user's custom set password
    // Verify credentials
    const validPassword = user.password 
      ? user.password === password 
      : (password && password.length >= 4);
      : (user.tempPassword ? user.tempPassword === password : (password && password.length >= 4));

    if (!validPassword) {
      throw new Error('Invalid password. Please check your credentials or request a password reset.');
    }

    // Update lastLoginAt
    // Update lastLoginAt in Firestore & local store
    portalStore.updateClient(user.id, { lastLoginAt: new Date().toISOString() });

    // Store session without sensitive hashes
    // Store session without sensitive credentials
    const sessionUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      company: user.company,
      role: user.role,
      phone: user.phone,
      status: user.status
    };

    this.saveSession(sessionUser);

    portalStore.logActivity({
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'USER_LOGIN',
      targetType: 'user',
      targetId: user.id,
      details: `${user.displayName} logged in as ${user.role.toUpperCase()}`
    });

    return sessionUser;
  }

  // Quick switch for live testing / demo showcase
  // Quick switch for live testing
  quickLogin(userId) {
    const users = portalStore.getCollection('users');
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error('User not found');

    const sessionUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      company: user.company,
      role: user.role,
      phone: user.phone,
      status: user.status
    };

    this.saveSession(sessionUser);
    return sessionUser;
  }

  logout() {
    const prevUser = this.currentUser;
    this.saveSession(null);
    if (prevUser) {
      portalStore.logActivity({
        actorId: prevUser.id,
        actorName: prevUser.displayName,
        actorRole: prevUser.role,
        action: 'USER_LOGOUT',
        targetType: 'user',
        targetId: prevUser.id,
        details: `${prevUser.displayName} logged out.`
      });
    }
  }

  // Secure Password Reset or Setup link generator (Requirement 1 & 6)
  // Secure Password Reset or Setup link generator
  requestPasswordResetLink(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = portalStore.getCollection('users');
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);
    const user = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

    if (!user) {
      // Security best practice: don't reveal email existence in public notice
      return {
        success: true,
        message: 'If an account exists with this email, a secure setup link has been dispatched.'
      };
    }

    const resetToken = `tok_${Math.random().toString(36).substring(2)}_${Date.now()}`;
    const setupUrl = `${window.location.origin}${window.location.pathname}?action=setup_password&token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    // In a live Firebase/SMTP environment, Cloud Functions handles sending the email.
    // For immediate transparency in portal, we log this and return the link
    portalStore.logActivity({
      action: 'PASSWORD_RESET_DISPATCHED',
      targetType: 'user',
      targetId: user.id,
      details: `Generated password reset invitation link for ${user.email}`
    });

    return {
      success: true,
      email: user.email,
      setupUrl,
      message: `A secure password reset link has been generated for ${user.email}.`
    };
  }

  // Change password for active user
  updatePassword(currentUserId, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    portalStore.updateClient(currentUserId, { password: newPassword });

    portalStore.logActivity({
      actorId: currentUserId,
      actorName: this.currentUser?.displayName || 'User',
      actorRole: this.currentUser?.role || 'client',
      action: 'PASSWORD_CHANGED',
      targetType: 'user',
      targetId: currentUserId,
      details: 'User successfully updated their account password.'
    });

    return true;
  }
}

export const authManager = new AuthManager();
