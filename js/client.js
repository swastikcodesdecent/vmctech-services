/* ==========================================================================
   VMC TECH INDIA - CLIENT DASHBOARD CONTROLLER
   Live Service Cards, Real-time Usage Sync, Countdowns, Invoices, Support
   ========================================================================== */

import { portalStore } from './store.js';
import { authManager } from './auth.js';

export class ClientController {
  constructor(app) {
    this.app = app;
    this.currentTab = 'services';
    this.unsubscribers = [];
  }

  init() {
    this.bindEvents();
    this.setupRealtimeListeners();
    this.render();
  }

  destroy() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }

  setupRealtimeListeners() {
    // REAL-TIME LISTENER: Any metric updates by admin immediately reflect on client view!
    const collections = ['clientServices', 'invoices', 'notifications'];
    collections.forEach(col => {
      const unsub = portalStore.subscribe(col, () => {
        if (this.app.currentView === 'client') {
          this.render();
        }
      });
      this.unsubscribers.push(unsub);
    });
  }

  bindEvents() {
    document.querySelectorAll('.client-nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.getAttribute('data-tab');
        if (tab) {
          this.switchTab(tab);
        }
      });
    });
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll('.client-nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-tab') === tabName);
    });

    const pageTitleEl = document.getElementById('client-page-title');
    if (pageTitleEl) {
      const titles = {
        services: 'My Active Services & Usage',
        invoices: 'Billing & Tax Invoices',
        notifications: 'Notifications & Alerts',
        support: 'Help Desk & Support SLA',
        settings: 'Account Settings & Security'
      };
      pageTitleEl.textContent = titles[tabName] || 'Client Portal';
    }

    this.renderCurrentTab();
  }

  render() {
    const user = authManager.getCurrentUser();
    if (!user) return;

    // Welcome banner text
    const welcomeEl = document.getElementById('client-welcome-text');
    if (welcomeEl) {
      welcomeEl.textContent = `Welcome back, ${user.displayName}`;
    }

    const companyEl = document.getElementById('client-company-text');
    if (companyEl) {
      companyEl.textContent = user.company || 'Client Organization';
    }

    this.renderQuickStats();
    this.renderCurrentTab();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderQuickStats() {
    const user = authManager.getCurrentUser();
    if (!user) return;

    const myServices = portalStore.getCollection('clientServices').filter(s => s.clientId === user.id);
    const myInvoices = portalStore.getCollection('invoices').filter(i => i.clientId === user.id);
    const myNotifs = portalStore.getCollection('notifications').filter(n => n.targetUserId === user.id && !n.isRead);

    const activeServices = myServices.filter(s => s.status === 'active' || s.status === 'expiring_soon');
    const pendingInvoices = myInvoices.filter(i => i.status === 'pending' || i.status === 'overdue');

    // Find nearest upcoming renewal
    const sortedServices = [...myServices]
      .filter(s => s.status !== 'suspended')
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    const nearest = sortedServices[0];
    const nearestText = nearest ? portalStore.calculateExpiryInfo(nearest.expiryDate).label : 'No active services';

    const statElements = {
      'c-stat-active-services': activeServices.length,
      'c-stat-next-renewal': nearestText,
      'c-stat-pending-invoices': pendingInvoices.length,
      'c-stat-unread-notifs': myNotifs.length
    };

    Object.entries(statElements).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  }

  renderCurrentTab() {
    const container = document.getElementById('client-tab-content');
    if (!container) return;

    switch (this.currentTab) {
      case 'services':
        container.innerHTML = this.renderServicesTab();
        break;
      case 'invoices':
        container.innerHTML = this.renderInvoicesTab();
        break;
      case 'notifications':
        container.innerHTML = this.renderNotificationsTab();
        break;
      case 'support':
        container.innerHTML = this.renderSupportTab();
        break;
      case 'settings':
        container.innerHTML = this.renderSettingsTab();
        break;
      default:
        container.innerHTML = this.renderServicesTab();
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // --- 1. SERVICES TAB ---
  renderServicesTab() {
    const user = authManager.getCurrentUser();
    const myServices = portalStore.getCollection('clientServices').filter(s => s.clientId === user.id);

    if (myServices.length === 0) {
      return `
        <div class="section-container" style="text-align: center; padding: 3rem 1.5rem;">
          <div style="width: 54px; height: 54px; margin: 0 auto 1rem; border-radius: 50%; background: rgba(79, 140, 255, 0.1); color: var(--accent-blue); display: flex; align-items: center; justify-content: center;">
            <i data-lucide="server" style="width: 28px; height: 28px;"></i>
          </div>
          <h3>No Active Subscriptions</h3>
          <p style="margin-top: 0.5rem; max-width: 440px; margin-left: auto; margin-right: auto;">
            You currently have no services provisioned. Please contact our support team or your account manager to activate your hosting, domain, or maintenance plan.
          </p>
          <button class="btn btn-primary" style="margin-top: 1.5rem;" onclick="window.clientController.switchTab('support')">
            <i data-lucide="help-circle"></i> Contact Support
          </button>
        </div>
      `;
    }

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <div>
          <h2 style="font-size: 1.25rem;">My Active Subscriptions & Real-Time Resource Usage</h2>
          <p style="font-size: 0.85rem; margin-top: 0.2rem;">All metrics and countdowns synchronize live with VMC Tech India backend infrastructure.</p>
        </div>
        <div class="live-synced-badge" style="font-size: 0.78rem; padding: 0.35rem 0.75rem;">
          <span class="live-dot"></span> Live Real-Time Feed Active
        </div>
      </div>

      <div class="services-grid">
        ${myServices.map(service => {
          const expiry = portalStore.calculateExpiryInfo(service.expiryDate);
          const percent = Math.min(100, Math.round((service.metric.current / service.metric.max) * 100));

          let barClass = 'safe';
          if (percent >= service.metric.thresholdWarning) barClass = 'warning';
          if (percent >= 92) barClass = 'critical';

          let countdownClass = '';
          if (expiry.daysLeft <= 3) countdownClass = 'expired';
          else if (expiry.daysLeft <= 7) countdownClass = 'expiring-soon';

          return `
            <div class="service-card">
              <div>
                <div class="service-card-top">
                  <div class="service-card-icon-box">
                    <i data-lucide="${this.getServiceIcon(service.serviceId)}"></i>
                  </div>
                  <span class="badge-status badge-${service.status}">${service.status.replace('_', ' ')}</span>
                </div>

                <div class="service-card-title">
                  <h3>${service.serviceName}</h3>
                  <p>${service.description}</p>
                </div>

                <div class="service-card-body" style="margin-top: 1.25rem;">
                  <!-- Live Metric Progress Bar -->
                  <div class="service-metric-section">
                    <div class="usage-track-header" style="margin-bottom: 0.5rem;">
                      <span class="usage-track-label">${service.metric.label}:</span>
                      <span class="usage-track-value">${service.metric.current} / ${service.metric.max} ${service.metric.unit} (${percent}%)</span>
                    </div>

                    <div class="progress-bar-bg" style="height: 10px;">
                      <div class="progress-bar-fill ${barClass}" style="width: ${percent}%;"></div>
                    </div>

                    <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-dim); margin-top: 0.4rem;">
                      <span>Allocated: ${service.metric.max} ${service.metric.unit}</span>
                      ${percent >= service.metric.thresholdWarning ? `
                        <span style="color: var(--status-warning); font-weight: 600;"><i data-lucide="alert-circle" style="width: 12px; height: 12px; display: inline;"></i> Approaching quota</span>
                      ` : `
                        <span style="color: var(--status-success);">Optimal Health</span>
                      `}
                    </div>
                  </div>

                  <!-- Countdown Card Box -->
                  <div class="countdown-box ${countdownClass}">
                    <div>
                      <div class="countdown-label">Expiry / Renewal Due</div>
                      <div class="countdown-time">${service.expiryDate}</div>
                    </div>
                    <div style="text-align: right;">
                      <div class="countdown-label">Time Remaining</div>
                      <div style="font-weight: 700; font-size: 0.88rem; color: ${expiry.daysLeft <= 7 ? 'var(--status-danger)' : 'var(--accent-blue)'};">
                        ${expiry.label}
                      </div>
                    </div>
                  </div>

                  <!-- Meta Details -->
                  <div class="service-meta-row">
                    <span class="service-meta-label"><i data-lucide="credit-card" style="width: 14px; height: 14px;"></i> Billing Cycle</span>
                    <span class="service-meta-value" style="text-transform: capitalize;">${service.billingCycle} (₹${service.billingAmount.toLocaleString('en-IN')})</span>
                  </div>

                  <div class="service-meta-row">
                    <span class="service-meta-label"><i data-lucide="calendar" style="width: 14px; height: 14px;"></i> Provisioned Since</span>
                    <span class="service-meta-value">${service.startDate}</span>
                  </div>
                </div>
              </div>

              <div class="service-card-footer">
                <button class="btn btn-outline-blue btn-sm" onclick="window.clientController.openRenewalRequestModal('${service.id}')">
                  <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Request Renewal
                </button>
                <button class="btn btn-secondary btn-sm" onclick="window.clientController.openServiceDetailsModal('${service.id}')">
                  <i data-lucide="info" style="width: 14px; height: 14px;"></i> SLA Details
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // --- 2. INVOICES TAB ---
  renderInvoicesTab() {
    const user = authManager.getCurrentUser();
    const myInvoices = portalStore.getCollection('invoices').filter(i => i.clientId === user.id);

    return `
      <div class="section-container">
        <div class="section-header">
          <div class="section-title">
            <i data-lucide="receipt" style="color: var(--accent-blue)"></i>
            <h2>My Invoices & Payment Records</h2>
            <span class="count-badge">${myInvoices.length} Invoices</span>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Service Description</th>
                <th>Amount (INR)</th>
                <th>Issued Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${myInvoices.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No invoices on record.</td></tr>
              ` : myInvoices.map(inv => `
                <tr>
                  <td><strong>${inv.invoiceNumber}</strong></td>
                  <td>${inv.serviceName}</td>
                  <td><strong style="font-size: 0.95rem;">₹${inv.amount.toLocaleString('en-IN')}</strong></td>
                  <td>${inv.issueDate}</td>
                  <td>
                    <span>${inv.dueDate}</span>
                    ${inv.status === 'overdue' ? `<div style="font-size: 0.72rem; color: var(--status-danger); font-weight: 600;">Overdue!</div>` : ''}
                  </td>
                  <td>
                    <span class="badge-status badge-${inv.status}">${inv.status.toUpperCase()}</span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 0.4rem;">
                      <button class="btn btn-secondary btn-sm" onclick="window.clientController.openInvoiceModal('${inv.id}')">
                        <i data-lucide="file-text" style="width: 14px; height: 14px;"></i> View & Print
                      </button>
                      ${inv.status !== 'paid' ? `
                        <button class="btn btn-primary btn-sm" onclick="window.clientController.openPayModal('${inv.id}')">
                          <i data-lucide="credit-card" style="width: 14px; height: 14px;"></i> Pay Now
                        </button>
                      ` : `
                        <span style="color: var(--status-success); font-size: 0.78rem; display: flex; align-items: center; gap: 0.2rem;">
                          <i data-lucide="check-circle" style="width: 14px; height: 14px;"></i> Paid
                        </span>
                      `}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // --- 3. NOTIFICATIONS TAB ---
  renderNotificationsTab() {
    const user = authManager.getCurrentUser();
    const myNotifs = portalStore.getCollection('notifications').filter(n => n.targetUserId === user.id || n.role === 'all');

    return `
      <div class="section-container">
        <div class="section-header">
          <div class="section-title">
            <i data-lucide="bell" style="color: var(--status-warning)"></i>
            <h2>Notifications & Service Alerts</h2>
          </div>
          <button class="btn btn-outline-blue btn-sm" onclick="window.clientController.markAllRead()">
            <i data-lucide="check-check"></i> Mark All as Read
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${myNotifs.length === 0 ? `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">No new notifications.</div>
          ` : myNotifs.map(notif => `
            <div style="display: flex; gap: 1rem; align-items: flex-start; padding: 1rem; border-radius: var(--radius-md); background: ${notif.isRead ? 'rgba(255,255,255,0.02)' : 'rgba(79, 140, 255, 0.08)'}; border: 1px solid ${notif.isRead ? 'var(--border-color)' : 'rgba(79, 140, 255, 0.3)'};">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: ${notif.type === 'danger' ? 'var(--status-danger-bg)' : notif.type === 'warning' ? 'var(--status-warning-bg)' : 'rgba(79, 140, 255, 0.15)'}; color: ${notif.type === 'danger' ? 'var(--status-danger)' : notif.type === 'warning' ? 'var(--status-warning)' : 'var(--accent-blue)'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <i data-lucide="${notif.type === 'danger' ? 'alert-octagon' : notif.type === 'warning' ? 'alert-triangle' : 'info'}" style="width: 18px; height: 18px;"></i>
              </div>
              <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                  <strong style="color: var(--text-main); font-size: 0.95rem;">${notif.title}</strong>
                  <span style="font-size: 0.72rem; color: var(--text-dim);">${new Date(notif.createdAt).toLocaleString()}</span>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">${notif.message}</p>
                ${!notif.isRead ? `
                  <button class="btn btn-secondary btn-sm" onclick="window.clientController.markSingleRead('${notif.id}')">
                    Mark Read
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // --- 4. SUPPORT TAB ---
  renderSupportTab() {
    const user = authManager.getCurrentUser();
    const myServices = portalStore.getCollection('clientServices').filter(s => s.clientId === user.id);

    return `
      <div class="section-container" style="max-width: 800px; margin: 0 auto;">
        <div class="section-header">
          <div class="section-title">
            <i data-lucide="headphones" style="color: var(--accent-blue)"></i>
            <h2>Dedicated VMC Tech India Support Desk</h2>
          </div>
        </div>

        <p style="font-size: 0.88rem; margin-bottom: 1.5rem;">
          Need assistance with server configuration, DNS changes, SSL renewal, or website maintenance? Submit a high-priority ticket below and our engineering team will respond within 2 hours.
        </p>

        <form id="client-support-form">
          <div class="form-group">
            <label>Associated Service</label>
            <select id="sup-service-id" class="form-control no-icon" required>
              <option value="general">General Inquiry / New Project</option>
              ${myServices.map(s => `<option value="${s.id}">${s.serviceName} (${s.description})</option>`).join('')}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Urgency Level</label>
              <select id="sup-priority" class="form-control no-icon">
                <option value="normal">Normal (Next business day)</option>
                <option value="high">High (4-6 Hours)</option>
                <option value="critical">Critical / Outage (Immediate)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Subject</label>
              <input type="text" id="sup-subject" class="form-control no-icon" placeholder="e.g. Need to increase disk quota" required>
            </div>
          </div>

          <div class="form-group">
            <label>Issue Details & Description</label>
            <textarea id="sup-message" class="form-control no-icon" rows="4" placeholder="Describe the task or issue you are experiencing in detail..." required></textarea>
          </div>

          <button type="submit" class="btn btn-primary">
            <i data-lucide="send"></i> Dispatch Support Request
          </button>
        </form>

        <div style="margin-top: 2rem; padding: 1.25rem; border-radius: var(--radius-md); background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); font-size: 0.85rem;">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; color: var(--accent-blue);">Emergency Escalation Contacts</h4>
          <div style="display: flex; flex-direction: column; gap: 0.35rem; color: var(--text-muted);">
            <div><strong>Operations NOC:</strong> noc@vmctech.in | +91 98201 12345</div>
            <div><strong>Billing Desk:</strong> accounts@vmctech.in</div>
            <div><strong>Office Hours:</strong> Monday – Saturday, 9:30 AM to 7:00 PM IST</div>
          </div>
        </div>
      </div>
    `;
  }

  // --- 5. SETTINGS TAB ---
  renderSettingsTab() {
    const user = authManager.getCurrentUser();

    return `
      <div class="section-container" style="max-width: 720px; margin: 0 auto;">
        <div class="section-header">
          <div class="section-title">
            <i data-lucide="settings" style="color: var(--accent-purple)"></i>
            <h2>Account Settings & Security</h2>
          </div>
        </div>

        <div class="form-group">
          <label>Company / Organization Name</label>
          <input type="text" class="form-control no-icon" value="${user.company}" disabled style="opacity: 0.7;">
          <small style="color: var(--text-dim); font-size: 0.72rem;">To modify billing organization, please raise an administrative ticket.</small>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Registered Email Address</label>
            <input type="email" class="form-control no-icon" value="${user.email}" disabled style="opacity: 0.7;">
          </div>
          <div class="form-group">
            <label>Contact Phone</label>
            <input type="tel" id="settings-phone" class="form-control no-icon" value="${user.phone || ''}">
          </div>
        </div>

        <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 1.5rem 0;">

        <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">Change Account Password</h3>
        <p style="font-size: 0.825rem; margin-bottom: 1.25rem;">Ensure your new password contains at least 6 characters for optimal account protection.</p>

        <form id="client-password-form">
          <div class="form-group">
            <label>New Password</label>
            <input type="password" id="client-new-pass" class="form-control no-icon" placeholder="••••••••" required minlength="6">
          </div>
          <div class="form-group">
            <label>Confirm New Password</label>
            <input type="password" id="client-confirm-pass" class="form-control no-icon" placeholder="••••••••" required minlength="6">
          </div>
          <button type="submit" class="btn btn-primary">
            <i data-lucide="lock"></i> Update Password
          </button>
        </form>
      </div>
    `;
  }

  // Helper icons
  getServiceIcon(serviceId) {
    if (serviceId.includes('hosting')) return 'server';
    if (serviceId.includes('domain')) return 'globe';
    if (serviceId.includes('maintenance')) return 'tool';
    if (serviceId.includes('development')) return 'code';
    if (serviceId.includes('ssl')) return 'shield-check';
    if (serviceId.includes('email')) return 'mail';
    return 'cpu';
  }

  // Modals & Handlers
  openRenewalRequestModal(serviceId) {
    const service = portalStore.getItemById('clientServices', serviceId);
    if (!service) return;

    const modalHtml = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Request Service Renewal</h3>
          <button class="btn-icon" onclick="window.app.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <form id="req-renewal-form">
          <div class="modal-body">
            <p style="font-size: 0.85rem; margin-bottom: 1.25rem;">
              You are requesting renewal for <strong>${service.serviceName}</strong> (Current Expiry: ${service.expiryDate}).
            </p>
            <div class="form-group">
              <label>Preferred Renewal Duration</label>
              <select id="req-duration" class="form-control no-icon">
                <option value="1_year">1 Year (₹${service.billingAmount.toLocaleString('en-IN')})</option>
                <option value="2_years">2 Years (Save 10%)</option>
                <option value="3_years">3 Years (Save 20%)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Special Instructions / Scaling Requests</label>
              <textarea id="req-notes" class="form-control no-icon" rows="3" placeholder="e.g. Also upgrade storage capacity to 100 GB"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary"><i data-lucide="send"></i> Submit Renewal Request</button>
          </div>
        </form>
      </div>
    `;

    this.app.showModal(modalHtml);

    document.getElementById('req-renewal-form').addEventListener('submit', (e) => {
      e.preventDefault();
      portalStore.createNotification({
        targetUserId: 'admin_1',
        role: 'admin',
        title: 'Client Requested Service Renewal',
        message: `${service.clientName} requested renewal for ${service.serviceName} (${document.getElementById('req-duration').value}).`,
        type: 'warning'
      });

      portalStore.logActivity({
        actorId: service.clientId,
        actorName: service.clientName,
        actorRole: 'client',
        action: 'RENEWAL_REQUESTED',
        targetType: 'clientService',
        targetId: service.id,
        details: `Requested renewal for ${service.serviceName}`
      });

      this.app.closeModal();
      this.app.showToast('Renewal request sent to VMC Tech billing team!', 'success');
    });
  }

  openServiceDetailsModal(serviceId) {
    const service = portalStore.getItemById('clientServices', serviceId);
    if (!service) return;

    const modalHtml = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>${service.serviceName} - SLA & Details</h3>
          <button class="btn-icon" onclick="window.app.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 1.25rem;">
            <strong>Plan Specification:</strong>
            <p style="margin-top: 0.25rem;">${service.description}</p>
          </div>

          <div class="service-meta-row">
            <span class="service-meta-label">Uptime SLA Guarantee:</span>
            <span class="service-meta-value" style="color: var(--status-success); font-weight: 700;">99.9% High Availability</span>
          </div>
          <div class="service-meta-row">
            <span class="service-meta-label">Daily Backup Retention:</span>
            <span class="service-meta-value">30-day offsite rolling backup</span>
          </div>
          <div class="service-meta-row">
            <span class="service-meta-label">Security Shield:</span>
            <span class="service-meta-value">Cloudflare Enterprise WAF + DDoS</span>
          </div>
          <div class="service-meta-row">
            <span class="service-meta-label">Current Metric Status:</span>
            <span class="service-meta-value">${service.metric.current} / ${service.metric.max} ${service.metric.unit}</span>
          </div>

          <div style="margin-top: 1.25rem; font-size: 0.8rem; color: var(--text-dim);">
            For technical modifications or resource scaling, please connect with your assigned engineer.
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Close</button>
        </div>
      </div>
    `;

    this.app.showModal(modalHtml);
  }

  openInvoiceModal(invoiceId) {
    // Delegate to admin invoice viewer modal since it generates the official tax invoice preview
    this.app.adminController.openInvoicePreviewModal(invoiceId);
  }

  openPayModal(invoiceId) {
    const invoice = portalStore.getItemById('invoices', invoiceId);
    if (!invoice) return;

    // Requirement 5: Never mark an invoice as paid solely because a client clicks a payment button!
    // Provide official UPI QR code & NEFT bank details for genuine transfer verification
    const modalHtml = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Pay Invoice: ${invoice.invoiceNumber}</h3>
          <button class="btn-icon" onclick="window.app.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <div style="font-size: 0.85rem; color: var(--text-muted);">Amount Payable</div>
            <div style="font-size: 2rem; font-weight: 700; color: var(--status-success);">
              ₹${invoice.amount.toLocaleString('en-IN')}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 0.2rem;">Due Date: ${invoice.dueDate}</div>
          </div>

          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem;">
            <h4 style="font-size: 0.925rem; margin-bottom: 0.75rem; color: var(--accent-blue);">Option 1: Instant UPI Payment</h4>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 0.35rem 0;">
              <span style="color: var(--text-dim);">UPI ID / VPA:</span>
              <strong style="color: var(--text-main);">vmctechindia@icici</strong>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.25rem;">
              Accepted via Google Pay, PhonePe, Paytm, BHIM UPI.
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem;">
            <h4 style="font-size: 0.925rem; margin-bottom: 0.75rem; color: var(--accent-blue);">Option 2: Direct Bank Transfer (NEFT / RTGS / IMPS)</h4>
            <div style="font-size: 0.825rem; line-height: 1.6; color: var(--text-muted);">
              <div><strong>Account Name:</strong> VMC TECH INDIA PVT LTD</div>
              <div><strong>Account Number:</strong> 50200012345678</div>
              <div><strong>Bank Name:</strong> HDFC Bank Ltd (Connaught Place Branch)</div>
              <div><strong>IFSC Code:</strong> HDFC0001234</div>
            </div>
          </div>

          <div style="background: rgba(245, 158, 11, 0.08); border: 1px dashed rgba(245, 158, 11, 0.3); border-radius: var(--radius-md); padding: 0.85rem; font-size: 0.8rem; color: var(--status-warning);">
            <strong>Notice:</strong> Once your transfer is complete, please notify administration with your UTR / Reference number. The invoice will be officially marked as Paid once verified by our accounts desk.
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Close</button>
          <button type="button" class="btn btn-primary" onclick="window.clientController.notifyTransferDone('${invoice.id}')">
            <i data-lucide="check"></i> I Have Made the Payment
          </button>
        </div>
      </div>
    `;

    this.app.showModal(modalHtml);
  }

  notifyTransferDone(invoiceId) {
    const invoice = portalStore.getItemById('invoices', invoiceId);
    if (!invoice) return;

    portalStore.createNotification({
      targetUserId: 'admin_1',
      role: 'admin',
      title: 'Payment Verification Requested',
      message: `${invoice.clientName} indicated payment for invoice ${invoice.invoiceNumber} (₹${invoice.amount.toLocaleString('en-IN')}). Please verify bank credits.`,
      type: 'warning'
    });

    portalStore.logActivity({
      actorId: invoice.clientId,
      actorName: invoice.clientName,
      actorRole: 'client',
      action: 'PAYMENT_SUBMITTED_FOR_VERIFICATION',
      targetType: 'invoice',
      targetId: invoice.id,
      details: `Client submitted bank transfer notice for ${invoice.invoiceNumber}`
    });

    this.app.closeModal();
    this.app.showToast('Payment notice sent to accounts team for credit verification!', 'success');
  }

  markAllRead() {
    const user = authManager.getCurrentUser();
    if (!user) return;
    portalStore.markAllNotificationsRead(user.id);
    this.app.showToast('All notifications marked as read.', 'info');
  }

  markSingleRead(notifId) {
    portalStore.markNotificationRead(notifId);
  }
}
