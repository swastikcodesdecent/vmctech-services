/* ==========================================================================
   VMC TECH INDIA - MAIN APPLICATION COORDINATOR & ROUTER
   View switching, toasts, modals, notifications dropdown, demo switcher
   ========================================================================== */

import { portalStore } from './store.js';
import { authManager } from './auth.js';
import { AdminController } from './admin.js';
import { ClientController } from './client.js';

class App {
  constructor() {
    this.currentView = null; // 'auth' | 'admin' | 'client'
    this.adminController = new AdminController(this);
    this.clientController = new ClientController(this);
    this.modalOverlay = null;
    this.toastContainer = null;
    this.authTab = 'client'; // default auth tab

    // Expose globally for event handlers
    window.app = this;
    window.adminController = this.adminController;
    window.clientController = this.clientController;
  }

  async init() {
    this.modalOverlay = document.getElementById('modal-overlay');
    this.toastContainer = document.getElementById('toast-container');

    // Initialize store backend
    const isLive = await portalStore.initBackend();
    this.updateDbStatus(isLive);

    // Setup Auth Listener
    authManager.onAuthStateChanged((user) => {
      this.route(user);
    });

    this.bindGlobalEvents();
    this.checkUrlParams();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  updateDbStatus(isLive) {
    const el = document.getElementById('db-status-badge');
    if (el) {
      if (isLive) {
        el.innerHTML = `<span class="status-dot"></span> Cloud Firestore (Live)`;
        el.style.color = 'var(--status-success)';
      } else {
        el.innerHTML = `<span class="status-dot"></span> Realtime Engine (Active)`;
        el.title = 'Configured with high-fidelity reactive sync. Real Firebase keys can be added to firebase-config.js';
      }
    }
  }

  route(user) {
    const authView = document.getElementById('view-auth');
    const adminView = document.getElementById('view-admin');
    const clientView = document.getElementById('view-client');

    if (!user) {
      // If URL has ?portal=admin, redirect to dedicated admin login
      if (window.location.search.includes('portal=admin')) {
        window.location.href = 'admin-login.html';
        return;
      }
      this.currentView = 'auth';
      authView.style.display = 'grid';
      adminView.style.display = 'none';
      clientView.style.display = 'none';
      this.adminController.destroy();
      this.clientController.destroy();
    } else if (user.role === 'admin') {
      this.currentView = 'admin';
      authView.style.display = 'none';
      adminView.style.display = 'flex';
      clientView.style.display = 'none';
      this.clientController.destroy();
      this.updateUserProfileInfo(user);
      this.adminController.init();
      this.updateNotificationBadge(user);
    } else if (user.role === 'client') {
      this.currentView = 'client';
      authView.style.display = 'none';
      adminView.style.display = 'none';
      clientView.style.display = 'flex';
      this.adminController.destroy();
      this.updateUserProfileInfo(user);
      this.clientController.init();
      this.updateNotificationBadge(user);
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  updateUserProfileInfo(user) {
    document.querySelectorAll('.profile-user-name').forEach(el => el.textContent = user.displayName);
    document.querySelectorAll('.profile-user-email').forEach(el => el.textContent = user.email);
    document.querySelectorAll('.profile-user-avatar').forEach(el => el.textContent = user.displayName.charAt(0));
    document.querySelectorAll('.profile-user-company').forEach(el => el.textContent = user.company || 'VMC Tech');
  }

  updateNotificationBadge(user) {
    const notifs = portalStore.getCollection('notifications').filter(n => 
      (n.targetUserId === user.id || n.role === user.role || n.role === 'all') && !n.isRead
    );

    document.querySelectorAll('.notif-unread-count').forEach(badge => {
      badge.textContent = notifs.length;
      badge.style.display = notifs.length > 0 ? 'flex' : 'none';
    });
  }

  bindGlobalEvents() {
    // Auth Tabs switcher
    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = btn.getAttribute('data-tab');
        this.setAuthTab(tab);
      });
    });

    // Client Login Form Submission
    const authForm = document.getElementById('auth-login-form');
    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const btn = document.getElementById('auth-submit-btn');

        try {
          btn.disabled = true;
          btn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Signing in...`;
          await authManager.login(email, password, 'client');
          this.showToast('Login successful! Welcome to Client Portal.', 'success');
        } catch (err) {
          this.showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = `<span>Sign In to Client Portal</span>`;
          if (window.lucide) window.lucide.createIcons();
        }
      });
    }

    // Logout buttons
    document.querySelectorAll('.btn-logout').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const wasAdmin = authManager.isAdmin();
        authManager.logout();
        this.showToast('You have been logged out securely.', 'info');
        if (wasAdmin) {
          setTimeout(() => {
            window.location.href = 'admin-login.html';
          }, 400);
        }
      });
    });

    // Mobile Sidebar Toggles
    document.querySelectorAll('.mobile-menu-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const activeSidebar = document.querySelector(this.currentView === 'admin' ? '#admin-sidebar' : '#client-sidebar');
        if (activeSidebar) {
          activeSidebar.classList.toggle('open');
        }
      });
    });

    // Theme Toggles
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        this.showToast(`Switched to ${isLight ? 'Light' : 'Dark'} mode`, 'info');
      });
    });

    // Notifications Dropdown Toggles
    document.querySelectorAll('.notification-bell-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = btn.parentElement.querySelector('.dropdown-menu');
        if (dropdown) {
          dropdown.classList.toggle('active');
          this.renderNotificationDropdown(dropdown);
        }
      });
    });

    // Close dropdowns on outside click
    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('active'));
    });

    // Close modal on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  }

  setAuthTab(role) {
    this.authTab = role;
    document.querySelectorAll('.auth-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === role);
    });

    const submitBtn = document.getElementById('auth-submit-btn');
    if (submitBtn) {
      submitBtn.querySelector('span').textContent = `Sign In to ${role === 'admin' ? 'Admin HQ' : 'Client Portal'}`;
    }

    const emailInput = document.getElementById('auth-email');
    if (emailInput) {
      emailInput.placeholder = role === 'admin' ? 'admin@vmctech.in' : 'client@company.com';
    }
  }

  renderAuthTabs() {
    this.setAuthTab(this.authTab);
  }

  renderNotificationDropdown(dropdownContainer) {
    const user = authManager.getCurrentUser();
    if (!user) return;

    const notifs = portalStore.getCollection('notifications').filter(n => 
      n.targetUserId === user.id || n.role === user.role || n.role === 'all'
    );

    dropdownContainer.innerHTML = `
      <div class="dropdown-header">
        <span>Notifications (${notifs.filter(n => !n.isRead).length} Unread)</span>
        <button class="btn btn-outline-blue btn-sm" onclick="portalStore.markAllNotificationsRead('${user.id}'); window.app.showToast('All marked read', 'info');">
          Mark All Read
        </button>
      </div>
      <div class="notification-list">
        ${notifs.length === 0 ? `
          <div style="padding: 1.5rem; text-align: center; font-size: 0.8rem; color: var(--text-muted);">
            No notifications yet
          </div>
        ` : notifs.slice(0, 10).map(n => `
          <div class="notification-item ${!n.isRead ? 'unread' : ''}" onclick="portalStore.markNotificationRead('${n.id}');">
            <div class="notification-icon-box" style="background: ${n.type === 'danger' ? 'var(--status-danger-bg)' : n.type === 'warning' ? 'var(--status-warning-bg)' : 'rgba(79, 140, 255, 0.15)'}; color: ${n.type === 'danger' ? 'var(--status-danger)' : n.type === 'warning' ? 'var(--status-warning)' : 'var(--accent-blue)'};">
              <i data-lucide="${n.type === 'danger' ? 'alert-octagon' : n.type === 'warning' ? 'alert-triangle' : 'info'}" style="width: 16px; height: 16px;"></i>
            </div>
            <div class="notification-item-content">
              <div class="notification-item-title">${n.title}</div>
              <div class="notification-item-text">${n.message}</div>
              <div class="notification-item-time">${new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // --- MODAL UTILITIES ---
  showModal(htmlContent) {
    if (!this.modalOverlay) return;
    this.modalOverlay.innerHTML = htmlContent;
    this.modalOverlay.classList.add('active');

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  closeModal() {
    if (!this.modalOverlay) return;
    this.modalOverlay.classList.remove('active');
  }

  // --- TOAST UTILITIES ---
  showToast(message, type = 'info') {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : type === 'warning' ? 'alert-triangle' : 'info';

    toast.innerHTML = `
      <i data-lucide="${iconName}" style="width: 20px; height: 20px; flex-shrink: 0;"></i>
      <div style="font-size: 0.875rem; flex: 1;">${message}</div>
    `;

    this.toastContainer.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // --- QUICK DEMO PERSONA SWITCHER ---
  quickLoginAs(userId) {
    try {
      const user = authManager.quickLogin(userId);
      this.showToast(`Switched persona to: ${user.displayName} (${user.role.toUpperCase()})`, 'success');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // URL Parameter check for password setup link (Requirement 1 & 6)
  checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const email = params.get('email');
    const token = params.get('token');

    if (action === 'setup_password' && email && token) {
      this.openSetupPasswordModal(email, token);
    }
  }

  openSetupPasswordModal(email, token) {
    const modalHtml = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Welcome! Set Your Secure Password</h3>
        </div>
        <form id="setup-pass-form">
          <div class="modal-body">
            <p style="font-size: 0.85rem; margin-bottom: 1.25rem;">
              You are configuring your initial password for account <strong>${email}</strong> with VMC Tech India.
            </p>
            <div class="form-group">
              <label>Create New Password * (Minimum 6 characters)</label>
              <input type="password" id="initial-pass" class="form-control no-icon" placeholder="••••••••" required minlength="6">
            </div>
            <div class="form-group">
              <label>Confirm Password *</label>
              <input type="password" id="confirm-initial-pass" class="form-control no-icon" placeholder="••••••••" required minlength="6">
            </div>
          </div>
          <div class="modal-footer">
            <button type="submit" class="btn btn-primary"><i data-lucide="check"></i> Activate Account & Sign In</button>
          </div>
        </form>
      </div>
    `;

    this.showModal(modalHtml);

    document.getElementById('setup-pass-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const p1 = document.getElementById('initial-pass').value;
      const p2 = document.getElementById('confirm-initial-pass').value;

      if (p1 !== p2) {
        this.showToast('Passwords do not match!', 'error');
        return;
      }

      const users = portalStore.getCollection('users');
      const targetUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (targetUser) {
        authManager.updatePassword(targetUser.id, p1);
        this.closeModal();
        this.showToast('Password configured successfully! Signing in...', 'success');
        authManager.quickLogin(targetUser.id);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        this.showToast('Account not found.', 'error');
      }
    });
  }

  // Reset all data to default demo state
  resetData() {
    portalStore.resetToSampleData();
    this.showToast('Data reset to default seed state.', 'info');
    if (this.currentView === 'admin') this.adminController.render();
    if (this.currentView === 'client') this.clientController.render();
  }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
