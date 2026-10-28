/* ==========================================================================
   VMC TECH INDIA - ADMIN DASHBOARD CONTROLLER
   Client CRUD, Service Subscriptions, Live Usage Sliders, Invoices, Payments
   ========================================================================== */

import { portalStore } from './store.js';
import { authManager } from './auth.js';

export class AdminController {
  constructor(app) {
    this.app = app;
    this.currentTab = 'overview';
    this.unsubscribers = [];
    this.searchTerm = '';
    this.statusFilter = 'all';
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
    // Listen for live updates across collections
    const collections = ['users', 'clientServices', 'invoices', 'payments', 'notifications', 'activityLogs'];
    collections.forEach(col => {
      const unsub = portalStore.subscribe(col, () => {
        // Only re-render if current tab relies on changed data
        if (this.app.currentView === 'admin') {
          this.render();
        }
      });
      this.unsubscribers.push(unsub);
    });
  }

  bindEvents() {
    // Topbar search
    const searchInput = document.getElementById('admin-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase();
        this.renderCurrentTab();
      });
    }

    // Sidebar navigation
    document.querySelectorAll('.admin-nav-item').forEach(item => {
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
    document.querySelectorAll('.admin-nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-tab') === tabName);
    });

    const pageTitleEl = document.getElementById('admin-page-title');
    if (pageTitleEl) {
      const titles = {
        overview: 'Admin Dashboard & Analytics',
        clients: 'Client Management Directory',
        services: 'Client Services & Live Usage Metrics',
        invoices: 'Invoice & Payment Management',
        reminders: 'Automated Expiry & Reminder Hub',
        activity: 'Audit Logs & System Activity'
      };
      pageTitleEl.textContent = titles[tabName] || 'Admin Portal';
    }

    this.renderCurrentTab();
  }

  render() {
    this.renderStats();
    this.renderCurrentTab();
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderStats() {
    const clients = portalStore.getCollection('users').filter(u => u.role === 'client');
    const services = portalStore.getCollection('clientServices');
    const invoices = portalStore.getCollection('invoices');

    const totalClients = clients.length;
    const activeClients = clients.filter(c => c.status === 'active').length;

    const activeServices = services.filter(s => s.status === 'active').length;
    const expiringServices = services.filter(s => s.status === 'expiring_soon').length;
    const expiredServices = services.filter(s => s.status === 'expired').length;

    const pendingInvoices = invoices.filter(i => i.status === 'pending');
    const pendingAmount = pendingInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    const paidInvoices = invoices.filter(i => i.status === 'paid');
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    // Update stats bar if rendered
    const statElements = {
      'stat-total-clients': `${activeClients} / ${totalClients}`,
      'stat-active-services': activeServices,
      'stat-expiring-services': expiringServices,
      'stat-expired-services': expiredServices,
      'stat-pending-invoices': `₹${pendingAmount.toLocaleString('en-IN')}`,
      'stat-total-revenue': `₹${totalRevenue.toLocaleString('en-IN')}`
    };

    Object.entries(statElements).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  }

  renderCurrentTab() {
    const container = document.getElementById('admin-tab-content');
    if (!container) return;

    switch (this.currentTab) {
      case 'overview':
        container.innerHTML = this.renderOverviewTab();
        break;
      case 'clients':
        container.innerHTML = this.renderClientsTab();
        break;
      case 'services':
        container.innerHTML = this.renderServicesTab();
        break;
      case 'invoices':
        container.innerHTML = this.renderInvoicesTab();
        break;
      case 'reminders':
        container.innerHTML = this.renderRemindersTab();
        break;
      case 'activity':
        container.innerHTML = this.renderActivityTab();
        break;
      default:
        container.innerHTML = this.renderOverviewTab();
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // --- 1. OVERVIEW TAB ---
  renderOverviewTab() {
    const services = portalStore.getCollection('clientServices');
    const invoices = portalStore.getCollection('invoices');
    const activities = portalStore.getCollection('activityLogs').slice(0, 6);

    // Sort upcoming renewals
    const upcomingRenewals = [...services]
      .filter(s => s.status !== 'suspended')
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
      .slice(0, 5);

    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-info">
            <h3>Active Clients</h3>
            <div class="stat-card-value" id="stat-total-clients">...</div>
            <div class="stat-card-subtext positive"><i data-lucide="users"></i> Managed client accounts</div>
          </div>
          <div class="stat-icon-box"><i data-lucide="user-check"></i></div>
        </div>

        <div class="stat-card">
          <div class="stat-card-info">
            <h3>Active Services</h3>
            <div class="stat-card-value" id="stat-active-services">...</div>
            <div class="stat-card-subtext positive"><i data-lucide="check-circle-2"></i> Healthy & Running</div>
          </div>
          <div class="stat-icon-box green"><i data-lucide="server"></i></div>
        </div>

        <div class="stat-card">
          <div class="stat-card-info">
            <h3>Expiring Soon</h3>
            <div class="stat-card-value" id="stat-expiring-services">...</div>
            <div class="stat-card-subtext warning"><i data-lucide="clock"></i> Next 7 days</div>
          </div>
          <div class="stat-icon-box amber"><i data-lucide="alert-triangle"></i></div>
        </div>

        <div class="stat-card">
          <div class="stat-card-info">
            <h3>Expired Services</h3>
            <div class="stat-card-value" id="stat-expired-services">...</div>
            <div class="stat-card-subtext danger"><i data-lucide="alert-octagon"></i> Requires renewal</div>
          </div>
          <div class="stat-icon-box red"><i data-lucide="shield-alert"></i></div>
        </div>

        <div class="stat-card">
          <div class="stat-card-info">
            <h3>Pending Receivables</h3>
            <div class="stat-card-value" id="stat-pending-invoices">...</div>
            <div class="stat-card-subtext warning"><i data-lucide="file-text"></i> Pending & Overdue</div>
          </div>
          <div class="stat-icon-box purple"><i data-lucide="credit-card"></i></div>
        </div>

        <div class="stat-card">
          <div class="stat-card-info">
            <h3>Total Revenue (Paid)</h3>
            <div class="stat-card-value" id="stat-total-revenue">...</div>
            <div class="stat-card-subtext positive"><i data-lucide="trending-up"></i> Confirmed payments</div>
          </div>
          <div class="stat-icon-box green"><i data-lucide="indian-rupee"></i></div>
        </div>
      </div>

      <!-- Overview Tables Grid -->
      <div class="overview-grid-columns">
        <!-- Upcoming Expiries -->
        <div class="section-container" style="margin-bottom: 0;">
          <div class="section-header">
            <div class="section-title">
              <i data-lucide="calendar-clock" style="color: var(--accent-blue)"></i>
              <h2>Upcoming Service Renewals</h2>
            </div>
            <button class="btn btn-outline-blue btn-sm" onclick="window.adminController.switchTab('services')">View All Services</button>
          </div>
          
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Client / Company</th>
                  <th>Service</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${upcomingRenewals.length === 0 ? `
                  <tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-dim);">No upcoming renewals found. Subscriptions are all active and up to date.</td></tr>
                ` : upcomingRenewals.map(item => {
                  const expiryInfo = portalStore.calculateExpiryInfo(item.expiryDate);
                  return `
                    <tr>
                      <td>
                        <strong>${item.clientName}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-dim);">${item.clientEmail}</div>
                      </td>
                      <td>
                        <strong>${item.serviceName}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">₹${item.billingAmount.toLocaleString('en-IN')} / ${item.billingCycle}</div>
                      </td>
                      <td>
                        <strong>${item.expiryDate}</strong>
                        <div style="font-size: 0.75rem; color: ${expiryInfo.daysLeft <= 3 ? 'var(--status-danger)' : 'var(--status-warning)'}; font-weight: 600;">
                          ${expiryInfo.label}
                        </div>
                      </td>
                      <td>
                        <span class="badge-status badge-${item.status}">${item.status.replace('_', ' ')}</span>
                      </td>
                      <td>
                        <button class="btn btn-primary btn-sm" onclick="window.adminController.openRenewModal('${item.id}')">
                          <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Renew
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Recent Audit Log Activity -->
        <div class="section-container" style="margin-bottom: 0;">
          <div class="section-header">
            <div class="section-title">
              <i data-lucide="activity" style="color: var(--accent-purple)"></i>
              <h2>Recent Activity</h2>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            ${activities.length === 0 ? `
              <div style="text-align: center; padding: 2rem; color: var(--text-dim); font-size: 0.85rem;">No administrative activities logged yet.</div>
            ` : activities.map(act => `
              <div style="display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.6rem; border-radius: var(--radius-md); background: rgba(255,255,255,0.02); border: 1px solid var(--border-color);">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--accent-gradient-glow); display: flex; align-items: center; justify-content: center; color: var(--accent-blue); flex-shrink: 0; font-size: 0.75rem;">
                  <i data-lucide="zap" style="width: 14px; height: 14px;"></i>
                </div>
                <div style="flex: 1; font-size: 0.8rem;">
                  <div style="font-weight: 600; color: var(--text-main);">${act.details}</div>
                  <div style="display: flex; justify-content: space-between; color: var(--text-dim); margin-top: 0.25rem; font-size: 0.72rem;">
                    <span>By: ${act.actorName}</span>
                    <span>${new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // --- 2. CLIENTS TAB ---
  renderClientsTab() {
    let clients = portalStore.getCollection('users').filter(u => u.role === 'client');
    const allServices = portalStore.getCollection('clientServices');
    const allInvoices = portalStore.getCollection('invoices');

    if (this.searchTerm) {
      clients = clients.filter(c => 
        c.displayName.toLowerCase().includes(this.searchTerm) ||
        c.email.toLowerCase().includes(this.searchTerm) ||
        c.company.toLowerCase().includes(this.searchTerm)
      );
    }

    return `
      <div class="section-container">
        <div class="section-header">
          <div class="section-title">
            <i data-lucide="users" style="color: var(--accent-blue)"></i>
            <h2>Client Directory</h2>
            <span class="count-badge">${clients.length} Clients</span>
          </div>
          <div class="section-actions">
            <button class="btn btn-primary" onclick="window.adminController.openAddClientModal()">
              <i data-lucide="user-plus"></i> Add New Client
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Client Details</th>
                <th>Company</th>
                <th>Active Services</th>
                <th>Invoices Status</th>
                <th>Account Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${clients.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No clients found matching criteria.</td></tr>
              ` : clients.map(client => {
                const clientSrvs = allServices.filter(s => s.clientId === client.id);
                const clientInvs = allInvoices.filter(i => i.clientId === client.id);
                const hasPendingInvoices = clientInvs.some(i => i.status === 'pending' || i.status === 'overdue');

                return `
                  <tr>
                    <td>
                      <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div class="avatar">${client.displayName.charAt(0)}</div>
                        <div>
                          <strong>${client.displayName}</strong>
                          <div style="font-size: 0.75rem; color: var(--text-dim);">${client.email}</div>
                          ${client.phone ? `<div style="font-size: 0.72rem; color: var(--text-dim);"><i data-lucide="phone" style="width: 12px; height: 12px; display: inline;"></i> ${client.phone}</div>` : ''}
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>${client.company}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-dim);">Joined: ${new Date(client.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td>
                      <span class="badge-status ${clientSrvs.length > 0 ? 'badge-active' : 'badge-suspended'}">
                        ${clientSrvs.length} ${clientSrvs.length === 1 ? 'Service' : 'Services'}
                      </span>
                    </td>
                    <td>
                      ${hasPendingInvoices ? 
                        `<span class="badge-status badge-pending">Payment Due</span>` : 
                        `<span class="badge-status badge-paid">All Clear</span>`
                      }
                    </td>
                    <td>
                      <span class="badge-status badge-${client.status}">
                        ${client.status}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 0.4rem;">
                        <button class="btn btn-secondary btn-sm" title="Assign Service" onclick="window.adminController.openAssignServiceModal('${client.id}')">
                          <i data-lucide="plus-circle" style="width: 14px; height: 14px;"></i> Service
                        </button>
                        <button class="btn btn-secondary btn-sm" title="View Full Client Card" onclick="window.adminController.openClientDetailModal('${client.id}')">
                          <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button class="btn btn-outline-blue btn-sm" title="Send Setup Link" onclick="window.adminController.sendSetupLink('${client.email}')">
                          <i data-lucide="mail" style="width: 14px; height: 14px;"></i> Link
                        </button>
                        <button class="btn ${client.status === 'suspended' ? 'btn-success' : 'btn-danger'} btn-sm" title="Suspend/Reactivate" onclick="window.adminController.toggleSuspension('${client.id}')">
                          <i data-lucide="${client.status === 'suspended' ? 'check' : 'slash'}" style="width: 14px; height: 14px;"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // --- 3. SERVICES & LIVE USAGE TAB ---
  renderServicesTab() {
    let services = portalStore.getCollection('clientServices');

    if (this.searchTerm) {
      services = services.filter(s => 
        s.serviceName.toLowerCase().includes(this.searchTerm) ||
        s.clientName.toLowerCase().includes(this.searchTerm) ||
        s.description.toLowerCase().includes(this.searchTerm)
      );
    }

    if (this.statusFilter !== 'all') {
      services = services.filter(s => s.status === this.statusFilter);
    }

    return `
      <div class="section-container">
        <div class="section-header">
          <div class="section-title">
            <i data-lucide="server" style="color: var(--accent-blue)"></i>
            <h2>Client Services & Live Usage Metrics</h2>
            <span class="count-badge">${services.length} Active Subscriptions</span>
          </div>
          <div class="section-actions">
            <!-- Filter Bar -->
            <div class="filter-bar">
              <button class="filter-btn ${this.statusFilter === 'all' ? 'active' : ''}" onclick="window.adminController.setStatusFilter('all')">All</button>
              <button class="filter-btn ${this.statusFilter === 'active' ? 'active' : ''}" onclick="window.adminController.setStatusFilter('active')">Active</button>
              <button class="filter-btn ${this.statusFilter === 'expiring_soon' ? 'active' : ''}" onclick="window.adminController.setStatusFilter('expiring_soon')">Expiring Soon</button>
              <button class="filter-btn ${this.statusFilter === 'expired' ? 'active' : ''}" onclick="window.adminController.setStatusFilter('expired')">Expired</button>
            </div>

            <button class="btn btn-primary" onclick="window.adminController.openAssignServiceModal()">
              <i data-lucide="plus-circle"></i> Assign Service
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Service & Client</th>
                <th>Live Usage / Metric Tracking</th>
                <th>Billing & Cycle</th>
                <th>Expiry Countdown</th>
                <th>Status</th>
                <th>Live Actions</th>
              </tr>
            </thead>
            <tbody>
              ${services.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No services found.</td></tr>
              ` : services.map(srv => {
                const expiry = portalStore.calculateExpiryInfo(srv.expiryDate);
                const percent = Math.min(100, Math.round((srv.metric.current / srv.metric.max) * 100));
                
                let barClass = 'safe';
                if (percent >= srv.metric.thresholdWarning) barClass = 'warning';
                if (percent >= 92) barClass = 'critical';

                return `
                  <tr>
                    <td>
                      <strong>${srv.serviceName}</strong>
                      <div style="font-size: 0.78rem; color: var(--accent-blue); font-weight: 500;">Client: ${srv.clientName}</div>
                      <div style="font-size: 0.72rem; color: var(--text-dim);">${srv.description}</div>
                    </td>
                    <td style="min-width: 220px;">
                      <div class="usage-track-container">
                        <div class="usage-track-header">
                          <span class="usage-track-label">${srv.metric.label}:</span>
                          <span class="usage-track-value">${srv.metric.current} / ${srv.metric.max} ${srv.metric.unit} (${percent}%)</span>
                        </div>
                        <div class="progress-bar-bg">
                          <div class="progress-bar-fill ${barClass}" style="width: ${percent}%;"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-dim); margin-top: 2px;">
                          <span>Threshold: ${srv.metric.thresholdWarning}%</span>
                          <span class="live-synced-badge"><span class="live-dot"></span> Live Synced</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>₹${srv.billingAmount.toLocaleString('en-IN')}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-dim); text-transform: capitalize;">${srv.billingCycle}</div>
                    </td>
                    <td>
                      <strong>${srv.expiryDate}</strong>
                      <div style="font-size: 0.75rem; color: ${expiry.daysLeft <= 7 ? 'var(--status-danger)' : 'var(--status-warning)'}; font-weight: 600;">
                        ${expiry.label}
                      </div>
                    </td>
                    <td>
                      <span class="badge-status badge-${srv.status}">${srv.status.replace('_', ' ')}</span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 0.4rem;">
                        <button class="btn btn-outline-blue btn-sm" title="Live Usage Adjuster (Updates Client Dashboard Instantly)" onclick="window.adminController.openLiveUsageSliderModal('${srv.id}')">
                          <i data-lucide="sliders" style="width: 14px; height: 14px;"></i> Adjust
                        </button>
                        <button class="btn btn-primary btn-sm" title="Renew Service" onclick="window.adminController.openRenewModal('${srv.id}')">
                          <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Renew
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // --- 4. INVOICES & PAYMENTS TAB ---
  renderInvoicesTab() {
    let invoices = portalStore.getCollection('invoices');
    const payments = portalStore.getCollection('payments');

    if (this.searchTerm) {
      invoices = invoices.filter(inv => 
        inv.invoiceNumber.toLowerCase().includes(this.searchTerm) ||
        inv.clientName.toLowerCase().includes(this.searchTerm) ||
        inv.serviceName.toLowerCase().includes(this.searchTerm)
      );
    }

    return `
      <div class="section-container">
        <div class="section-header">
          <div class="section-title">
            <i data-lucide="receipt" style="color: var(--accent-blue)"></i>
            <h2>Invoices & Billing Management</h2>
            <span class="count-badge">${invoices.length} Invoices</span>
          </div>
          <div class="section-actions">
            <button class="btn btn-primary" onclick="window.adminController.openCreateInvoiceModal()">
              <i data-lucide="file-plus"></i> Generate Invoice
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Service Description</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-dim);">No invoices generated yet. Click "Generate Invoice" above to issue one.</td></tr>
              ` : invoices.map(inv => `
                <tr>
                  <td><strong>${inv.invoiceNumber}</strong></td>
                  <td>
                    <strong>${inv.clientName}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-dim);">${inv.clientEmail}</div>
                  </td>
                  <td>${inv.serviceName}</td>
                  <td><strong>₹${inv.amount.toLocaleString('en-IN')}</strong></td>
                  <td>
                    <span>${inv.dueDate}</span>
                    <div style="font-size: 0.72rem; color: var(--text-dim);">Issued: ${inv.issueDate}</div>
                  </td>
                  <td>
                    <span class="badge-status badge-${inv.status}">${inv.status}</span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 0.4rem;">
                      <button class="btn btn-secondary btn-sm" title="View & Print Official Invoice" onclick="window.adminController.openInvoicePreviewModal('${inv.id}')">
                        <i data-lucide="file-text" style="width: 14px; height: 14px;"></i> View
                      </button>
                      ${inv.status !== 'paid' ? `
                        <button class="btn btn-success btn-sm" title="Record Received Payment" onclick="window.adminController.openRecordPaymentModal('${inv.id}')">
                          <i data-lucide="check-circle" style="width: 14px; height: 14px;"></i> Record Pay
                        </button>
                      ` : `
                        <span style="font-size: 0.75rem; color: var(--status-success); display: flex; align-items: center; gap: 0.2rem;">
                          <i data-lucide="check" style="width: 14px; height: 14px;"></i> Paid
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

      <!-- Payment Receipts History -->
      <div class="section-container">
        <div class="section-header">
          <div class="section-title">
            <i data-lucide="credit-card" style="color: var(--status-success)"></i>
            <h2>Recorded Payment Transactions</h2>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Amount</th>
                <th>Payment Date</th>
                <th>Method & Ref</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              ${payments.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-dim);">No payment transactions recorded yet.</td></tr>
              ` : payments.map(pay => `
                <tr>
                  <td><strong>${pay.paymentNumber}</strong></td>
                  <td>${pay.invoiceNumber || pay.invoiceId}</td>
                  <td>${pay.clientName}</td>
                  <td><strong style="color: var(--status-success);">₹${pay.amount.toLocaleString('en-IN')}</strong></td>
                  <td>${pay.paymentDate}</td>
                  <td>
                    <strong style="text-transform: uppercase; font-size: 0.78rem;">${pay.method.replace('_', ' ')}</strong>
                    <div style="font-size: 0.72rem; color: var(--text-dim);">${pay.referenceNo}</div>
                  </td>
                  <td>${pay.recordedBy}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // --- 5. REMINDERS TAB ---
  renderRemindersTab() {
    const services = portalStore.getCollection('clientServices');
    const reminderLogs = portalStore.getCollection('reminderLogs');

    const expiringServices = services.filter(s => {
      const exp = portalStore.calculateExpiryInfo(s.expiryDate);
      return exp.daysLeft <= 14 && s.status !== 'suspended';
    });

    return `
      <div class="section-container">
        <div class="section-header">
          <div class="section-title">
            <i data-lucide="bell-ring" style="color: var(--status-warning)"></i>
            <h2>Automated Expiry & Notification Hub</h2>
          </div>
          <button class="btn btn-outline-blue" onclick="window.adminController.runManualCronCheck()">
            <i data-lucide="refresh-cw"></i> Run Expiry & Reminder Check Now
          </button>
        </div>

        <p style="margin-bottom: 1.5rem; font-size: 0.88rem;">
          Our backend engine automatically evaluates upcoming service expiries and dispatches email & in-app alerts at <strong>7 days</strong>, <strong>3 days</strong>, <strong>1 day</strong>, and on <strong>Expiry Day</strong>.
        </p>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Service</th>
                <th>Expiry Date</th>
                <th>Time Left</th>
                <th>Next Scheduled Action</th>
                <th>Direct Dispatch</th>
              </tr>
            </thead>
            <tbody>
              ${expiringServices.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-dim);">No services approaching expiry in the next 14 days.</td></tr>
              ` : expiringServices.map(srv => {
                const exp = portalStore.calculateExpiryInfo(srv.expiryDate);
                return `
                  <tr>
                    <td>
                      <strong>${srv.clientName}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-dim);">${srv.clientEmail}</div>
                    </td>
                    <td>${srv.serviceName}</td>
                    <td>${srv.expiryDate}</td>
                    <td>
                      <span style="color: ${exp.daysLeft <= 3 ? 'var(--status-danger)' : 'var(--status-warning)'}; font-weight: 700;">
                        ${exp.label}
                      </span>
                    </td>
                    <td>
                      <span class="badge-status badge-warning">
                        ${exp.daysLeft <= 0 ? 'Expiry Notification' : `Reminder at ${exp.daysLeft <= 3 ? '1 Day' : '3 Days'}`}
                      </span>
                    </td>
                    <td>
                      <button class="btn btn-secondary btn-sm" onclick="window.adminController.sendManualReminder('${srv.id}')">
                        <i data-lucide="send" style="width: 14px; height: 14px;"></i> Send Reminder Now
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Reminder Dispatch Log -->
      <div class="section-container">
        <div class="section-header">
          <div class="section-title">
            <i data-lucide="history" style="color: var(--accent-purple)"></i>
            <h2>Reminder Delivery History</h2>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Client Email</th>
                <th>Reminder Type</th>
                <th>Sent Timestamp</th>
                <th>Delivery Status</th>
              </tr>
            </thead>
            <tbody>
              ${reminderLogs.length === 0 ? `
                <tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-dim);">No reminders dispatched yet. Automated cron runs daily at 06:00 IST.</td></tr>
              ` : reminderLogs.map(log => `
                <tr>
                  <td>${log.clientEmail}</td>
                  <td><span class="badge-status badge-info">${log.reminderType.replace('_', ' ')}</span></td>
                  <td>${new Date(log.sentAt).toLocaleString()}</td>
                  <td><span class="badge-status badge-active">${log.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // --- 6. AUDIT ACTIVITY LOGS TAB ---
  renderActivityTab() {
    const logs = portalStore.getCollection('activityLogs');

    return `
      <div class="section-container">
        <div class="section-header">
          <div class="section-title">
            <i data-lucide="shield-check" style="color: var(--status-success)"></i>
            <h2>System Audit Trail & Admin Actions</h2>
            <span class="count-badge">${logs.length} Recorded Events</span>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action Type</th>
                <th>Target Object</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length === 0 ? `
                <tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-dim);">No system audit activity recorded yet.</td></tr>
              ` : logs.map(log => `
                <tr>
                  <td style="white-space: nowrap; font-size: 0.8rem; color: var(--text-dim);">
                    ${new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <strong>${log.actorName}</strong>
                    <div style="font-size: 0.72rem; color: var(--accent-blue); text-transform: uppercase;">${log.actorRole}</div>
                  </td>
                  <td>
                    <span class="badge-status badge-info" style="font-size: 0.72rem;">${log.action}</span>
                  </td>
                  <td style="font-size: 0.78rem; text-transform: capitalize; color: var(--text-muted);">
                    ${log.targetType} (${log.targetId})
                  </td>
                  <td style="font-size: 0.85rem; font-weight: 500;">
                    ${log.details}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Filter helper
  setStatusFilter(filter) {
    this.statusFilter = filter;
    this.renderCurrentTab();
  }

  // --- MODAL DIALOGS & ACTION HANDLERS ---

  // 1. Add New Client Modal
  openAddClientModal() {
    const modalHtml = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Add New Client Account</h3>
          <button class="btn-icon" onclick="window.app.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <form id="add-client-form">
          <div class="modal-body">
            <p style="font-size: 0.85rem; margin-bottom: 1.25rem;">
              Create a client account with their Gmail address. In accordance with security requirements, a secure account setup link will be generated for them to define their own password.
            </p>
            <div class="form-group">
              <label>Client Full Name *</label>
              <input type="text" id="new-client-name" class="form-control no-icon" placeholder="e.g. Rajesh Kumar" required>
            </div>
            <div class="form-group">
              <label>Client Gmail / Email Address *</label>
              <input type="email" id="new-client-email" class="form-control no-icon" placeholder="client@gmail.com" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Company / Business Name</label>
                <input type="text" id="new-client-company" class="form-control no-icon" placeholder="e.g. Apex Digital Ltd">
              </div>
              <div class="form-group">
                <label>Phone / WhatsApp Number</label>
                <input type="tel" id="new-client-phone" class="form-control no-icon" placeholder="+91 98000 00000">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary"><i data-lucide="mail"></i> Create & Generate Invite Link</button>
          </div>
        </form>
      </div>
    `;

    this.app.showModal(modalHtml);

    document.getElementById('add-client-form').addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const name = document.getElementById('new-client-name').value;
        const email = document.getElementById('new-client-email').value;
        const company = document.getElementById('new-client-company').value;
        const phone = document.getElementById('new-client-phone').value;

        const newClient = portalStore.createClient({ displayName: name, email, company, phone });
        this.app.closeModal();
        this.app.showToast(`Client ${newClient.displayName} created successfully!`, 'success');

        // Show setup link modal
        this.sendSetupLink(newClient.email);
      } catch (err) {
        this.app.showToast(err.message, 'error');
      }
    });
  }

  // 2. Assign Service Modal
  openAssignServiceModal(preselectedClientId = null) {
    const clients = portalStore.getCollection('users').filter(u => u.role === 'client');
    const serviceTemplates = portalStore.getCollection('services');

    const modalHtml = `
      <div class="modal-dialog modal-lg">
        <div class="modal-header">
          <h3>Assign Service Subscription to Client</h3>
          <button class="btn-icon" onclick="window.app.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <form id="assign-service-form">
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Select Client *</label>
                <select id="as-client-id" class="form-control no-icon" required>
                  <option value="">-- Choose Client --</option>
                  ${clients.map(c => `
                    <option value="${c.id}" ${c.id === preselectedClientId ? 'selected' : ''}>
                      ${c.displayName} (${c.company})
                    </option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group">
                <label>Service Category / Template *</label>
                <select id="as-service-template" class="form-control no-icon" required>
                  ${serviceTemplates.map(t => `
                    <option value="${t.id}" data-unit="${t.defaultUnit}" data-max="${t.defaultMax}" data-name="${t.name}">
                      ${t.name}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Service Specific Title / Description</label>
              <input type="text" id="as-description" class="form-control no-icon" placeholder="e.g. Production Hosting (domain.com)" required>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Billing Amount (₹ INR) *</label>
                <input type="number" id="as-amount" class="form-control no-icon" placeholder="12500" required>
              </div>

              <div class="form-group">
                <label>Billing Cycle</label>
                <select id="as-cycle" class="form-control no-icon">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="half_yearly">Half-Yearly</option>
                  <option value="yearly" selected>Yearly</option>
                  <option value="custom">Custom Milestone</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Start Date</label>
                <input type="date" id="as-start-date" class="form-control no-icon" value="${new Date().toISOString().split('T')[0]}" required>
              </div>

              <div class="form-group">
                <label>Expiry Date *</label>
                <input type="date" id="as-expiry-date" class="form-control no-icon" value="${new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]}" required>
              </div>
            </div>

            <h4 style="font-size: 0.95rem; margin: 1.25rem 0 0.75rem; color: var(--accent-blue);">Custom Service Metric Tracking</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Metric Label</label>
                <input type="text" id="as-metric-label" class="form-control no-icon" value="Disk Storage Used">
              </div>

              <div class="form-group">
                <label>Metric Unit</label>
                <input type="text" id="as-metric-unit" class="form-control no-icon" value="GB">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Initial Metric Value</label>
                <input type="number" step="any" id="as-metric-current" class="form-control no-icon" value="5">
              </div>

              <div class="form-group">
                <label>Max Capacity / Limit</label>
                <input type="number" step="any" id="as-metric-max" class="form-control no-icon" value="50">
              </div>
            </div>

            <div class="form-group">
              <label>Internal Admin Notes (Client cannot see this)</label>
              <textarea id="as-admin-notes" class="form-control no-icon" rows="2" placeholder="e.g. SLA level, server IP, cPanel credentials reference"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary"><i data-lucide="check"></i> Assign Service</button>
          </div>
        </form>
      </div>
    `;

    this.app.showModal(modalHtml);

    document.getElementById('assign-service-form').addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const templateSelect = document.getElementById('as-service-template');
        const selectedOption = templateSelect.options[templateSelect.selectedIndex];

        portalStore.assignClientService({
          clientId: document.getElementById('as-client-id').value,
          serviceId: selectedOption.value,
          serviceName: selectedOption.getAttribute('data-name'),
          description: document.getElementById('as-description').value,
          billingAmount: document.getElementById('as-amount').value,
          billingCycle: document.getElementById('as-cycle').value,
          startDate: document.getElementById('as-start-date').value,
          expiryDate: document.getElementById('as-expiry-date').value,
          metricLabel: document.getElementById('as-metric-label').value,
          metricUnit: document.getElementById('as-metric-unit').value,
          metricCurrent: document.getElementById('as-metric-current').value,
          metricMax: document.getElementById('as-metric-max').value,
          thresholdWarning: 80,
          adminNotes: document.getElementById('as-admin-notes').value
        });

        this.app.closeModal();
        this.app.showToast('Service assigned successfully to client!', 'success');
      } catch (err) {
        this.app.showToast(err.message, 'error');
      }
    });
  }

  // 3. LIVE USAGE SLIDER / METRIC ADJUSTER (Requirement 3: Live updates to client without page refresh!)
  openLiveUsageSliderModal(serviceId) {
    const service = portalStore.getItemById('clientServices', serviceId);
    if (!service) return;

    const modalHtml = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Live Usage & Metric Adjuster</h3>
          <button class="btn-icon" onclick="window.app.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 1.25rem;">
            <strong>${service.serviceName}</strong>
            <div style="font-size: 0.85rem; color: var(--text-dim); margin-top: 0.2rem;">
              Client: <span style="color: var(--accent-blue);">${service.clientName}</span>
            </div>
          </div>

          <div class="service-metric-section" style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span id="slider-metric-title" style="font-weight: 600;">${service.metric.label}</span>
              <span id="slider-metric-val-display" style="font-weight: 700; color: var(--accent-blue);">
                ${service.metric.current} / ${service.metric.max} ${service.metric.unit}
              </span>
            </div>

            <!-- Interactive Live Slider -->
            <input type="range" id="live-metric-slider" min="0" max="${service.metric.max}" step="1" value="${service.metric.current}" style="width: 100%; accent-color: var(--accent-blue); margin: 0.75rem 0; cursor: pointer;">
            
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-dim);">
              <span>0 ${service.metric.unit}</span>
              <span id="slider-pct-preview">${Math.round((service.metric.current / service.metric.max) * 100)}% Consumed</span>
              <span>${service.metric.max} ${service.metric.unit}</span>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Direct Exact Value (${service.metric.unit})</label>
              <input type="number" step="any" id="live-metric-input" class="form-control no-icon" value="${service.metric.current}">
            </div>
            <div class="form-group">
              <label>Warning Alert Threshold (%)</label>
              <input type="number" id="live-threshold-input" class="form-control no-icon" value="${service.metric.thresholdWarning || 80}">
            </div>
          </div>

          <div class="form-group">
            <label>Admin Note / Reason for Update</label>
            <input type="text" id="live-update-notes" class="form-control no-icon" placeholder="e.g. Month-end disk audit / Additional ticket consumed">
          </div>

          <div style="padding: 0.75rem; border-radius: var(--radius-sm); background: rgba(79, 140, 255, 0.08); border: 1px dashed rgba(79, 140, 255, 0.3); font-size: 0.8rem; display: flex; align-items: center; gap: 0.5rem; color: var(--accent-blue);">
            <i data-lucide="radio" style="width: 16px; height: 16px;"></i>
            <span>Real-time Broadcast Active: When saved, the client dashboard updates immediately without manual reload!</span>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Close</button>
          <button type="button" class="btn btn-primary" id="save-live-metric-btn"><i data-lucide="check"></i> Apply Live Update</button>
        </div>
      </div>
    `;

    this.app.showModal(modalHtml);

    const slider = document.getElementById('live-metric-slider');
    const input = document.getElementById('live-metric-input');
    const valDisplay = document.getElementById('slider-metric-val-display');
    const pctPreview = document.getElementById('slider-pct-preview');

    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      input.value = val;
      valDisplay.textContent = `${val} / ${service.metric.max} ${service.metric.unit}`;
      pctPreview.textContent = `${Math.round((val / service.metric.max) * 100)}% Consumed`;
    });

    input.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      slider.value = val;
      valDisplay.textContent = `${val} / ${service.metric.max} ${service.metric.unit}`;
      pctPreview.textContent = `${Math.round((val / service.metric.max) * 100)}% Consumed`;
    });

    document.getElementById('save-live-metric-btn').addEventListener('click', () => {
      const newVal = parseFloat(input.value) || 0;
      const newThreshold = parseInt(document.getElementById('live-threshold-input').value) || 80;
      const notes = document.getElementById('live-update-notes').value;

      portalStore.updateServiceMetric(service.id, {
        current: newVal,
        thresholdWarning: newThreshold
      }, notes);

      this.app.closeModal();
      this.app.showToast(`Updated ${service.serviceName} metric to ${newVal} ${service.metric.unit}. Broadcasted to client!`, 'success');
    });
  }

  // 4. Renew Service Modal
  openRenewModal(serviceId) {
    const service = portalStore.getItemById('clientServices', serviceId);
    if (!service) return;

    // Calculate suggested next expiry based on billing cycle
    const currentExp = new Date(service.expiryDate);
    currentExp.setFullYear(currentExp.getFullYear() + 1);
    const suggestedNextDate = currentExp.toISOString().split('T')[0];

    const modalHtml = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Renew Service Subscription</h3>
          <button class="btn-icon" onclick="window.app.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <form id="renew-service-form">
          <div class="modal-body">
            <div style="margin-bottom: 1.25rem;">
              <strong>${service.serviceName}</strong>
              <div style="font-size: 0.85rem; color: var(--text-dim);">Client: ${service.clientName}</div>
              <div style="font-size: 0.85rem; color: var(--status-warning); margin-top: 0.2rem;">Current Expiry: ${service.expiryDate}</div>
            </div>

            <div class="form-group">
              <label>New Expiry Date *</label>
              <input type="date" id="renew-expiry-date" class="form-control no-icon" value="${suggestedNextDate}" required>
            </div>

            <div class="form-group">
              <label>Renewal Amount (₹ INR)</label>
              <input type="number" id="renew-amount" class="form-control no-icon" value="${service.billingAmount}" required>
            </div>

            <div class="form-group">
              <label>Renewal Admin Notes</label>
              <input type="text" id="renew-notes" class="form-control no-icon" placeholder="e.g. 1 Year extended after payment confirmation.">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary"><i data-lucide="refresh-cw"></i> Confirm Renewal</button>
          </div>
        </form>
      </div>
    `;

    this.app.showModal(modalHtml);

    document.getElementById('renew-service-form').addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const newExpiry = document.getElementById('renew-expiry-date').value;
        const amount = document.getElementById('renew-amount').value;
        const notes = document.getElementById('renew-notes').value;

        portalStore.renewClientService(service.id, newExpiry, amount, notes);
        this.app.closeModal();
        this.app.showToast(`Service renewed successfully until ${newExpiry}!`, 'success');
      } catch (err) {
        this.app.showToast(err.message, 'error');
      }
    });
  }

  // 5. Create Invoice Modal
  openCreateInvoiceModal() {
    const clients = portalStore.getCollection('users').filter(u => u.role === 'client');
    const services = portalStore.getCollection('clientServices');

    const modalHtml = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Generate New Invoice</h3>
          <button class="btn-icon" onclick="window.app.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <form id="create-invoice-form">
          <div class="modal-body">
            <div class="form-group">
              <label>Select Client *</label>
              <select id="inv-client-id" class="form-control no-icon" required>
                <option value="">-- Choose Client --</option>
                ${clients.map(c => `<option value="${c.id}">${c.displayName} (${c.company})</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>Associated Service / Project</label>
              <input type="text" id="inv-service-name" class="form-control no-icon" placeholder="e.g. Cloud Hosting Annual Renewal" required>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Total Amount (₹ INR, incl. GST) *</label>
                <input type="number" id="inv-amount" class="form-control no-icon" placeholder="12500" required>
              </div>

              <div class="form-group">
                <label>Due Date *</label>
                <input type="date" id="inv-due-date" class="form-control no-icon" value="${new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]}" required>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary"><i data-lucide="file-plus"></i> Generate & Issue</button>
          </div>
        </form>
      </div>
    `;

    this.app.showModal(modalHtml);

    document.getElementById('create-invoice-form').addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const inv = portalStore.createInvoice({
          clientId: document.getElementById('inv-client-id').value,
          serviceName: document.getElementById('inv-service-name').value,
          amount: document.getElementById('inv-amount').value,
          dueDate: document.getElementById('inv-due-date').value
        });

        this.app.closeModal();
        this.app.showToast(`Invoice ${inv.invoiceNumber} created and client notified!`, 'success');
      } catch (err) {
        this.app.showToast(err.message, 'error');
      }
    });
  }

  // 6. Record Payment Modal
  openRecordPaymentModal(invoiceId) {
    const invoice = portalStore.getItemById('invoices', invoiceId);
    if (!invoice) return;

    const modalHtml = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Record Received Payment</h3>
          <button class="btn-icon" onclick="window.app.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <form id="record-pay-form">
          <div class="modal-body">
            <div style="margin-bottom: 1.25rem;">
              <strong>Invoice: ${invoice.invoiceNumber}</strong>
              <div style="font-size: 0.85rem; color: var(--text-dim);">Client: ${invoice.clientName}</div>
              <div style="font-size: 1.1rem; font-weight: 700; color: var(--status-success); margin-top: 0.35rem;">
                Amount Due: ₹${invoice.amount.toLocaleString('en-IN')}
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Amount Received (₹) *</label>
                <input type="number" id="pay-amount" class="form-control no-icon" value="${invoice.amount}" required>
              </div>

              <div class="form-group">
                <label>Payment Date *</label>
                <input type="date" id="pay-date" class="form-control no-icon" value="${new Date().toISOString().split('T')[0]}" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Payment Mode *</label>
                <select id="pay-method" class="form-control no-icon">
                  <option value="upi">UPI / GPay / PhonePe</option>
                  <option value="bank_transfer" selected>NEFT / RTGS / IMPS</option>
                  <option value="card">Credit / Debit Card</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div class="form-group">
                <label>Transaction / UTR Reference #</label>
                <input type="text" id="pay-ref" class="form-control no-icon" placeholder="UTR123456789" required>
              </div>
            </div>

            <div class="form-group">
              <label>Internal Audit Notes</label>
              <input type="text" id="pay-notes" class="form-control no-icon" placeholder="e.g. Verified in ICICI Bank Current Account">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-success"><i data-lucide="check"></i> Confirm Payment</button>
          </div>
        </form>
      </div>
    `;

    this.app.showModal(modalHtml);

    document.getElementById('record-pay-form').addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        portalStore.recordPayment({
          invoiceId: invoice.id,
          amount: document.getElementById('pay-amount').value,
          paymentDate: document.getElementById('pay-date').value,
          method: document.getElementById('pay-method').value,
          referenceNo: document.getElementById('pay-ref').value,
          notes: document.getElementById('pay-notes').value
        });

        this.app.closeModal();
        this.app.showToast(`Payment recorded for ${invoice.invoiceNumber}. Receipt dispatched to client!`, 'success');
      } catch (err) {
        this.app.showToast(err.message, 'error');
      }
    });
  }

  // 7. Printable Invoice Preview Modal
  openInvoicePreviewModal(invoiceId) {
    const invoice = portalStore.getItemById('invoices', invoiceId);
    if (!invoice) return;

    const baseAmount = invoice.amount / 1.18;
    const gstAmount = invoice.amount - baseAmount;

    const modalHtml = `
      <div class="modal-dialog modal-lg">
        <div class="modal-header">
          <h3>Official Tax Invoice Preview</h3>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="window.print()"><i data-lucide="printer"></i> Print / PDF</button>
            <button class="btn-icon" onclick="window.app.closeModal()"><i data-lucide="x"></i></button>
          </div>
        </div>
        <div class="modal-body" style="background: #F8FAFC;">
          <div class="invoice-sheet">
            <div class="invoice-header-row">
              <div class="invoice-logo-title">
                <h2>VMC TECH INDIA</h2>
                <p style="color: #64748B; font-size: 0.8rem; margin: 0;">Website Development, Cloud Infrastructure & IT Solutions</p>
                <p style="color: #64748B; font-size: 0.75rem; margin: 0;">GSTIN: 27AABCV1234F1Z5 | Support: support@vmctech.in</p>
              </div>
              <div class="invoice-meta-right">
                <h3>TAX INVOICE</h3>
                <div style="font-weight: 700; font-size: 0.95rem;">${invoice.invoiceNumber}</div>
                <div style="font-size: 0.8rem; color: #64748B;">Date: ${invoice.issueDate}</div>
                <div style="font-size: 0.8rem; color: #64748B;">Due: ${invoice.dueDate}</div>
              </div>
            </div>

            <div class="invoice-parties">
              <div>
                <strong style="color: #64748B; font-size: 0.75rem; text-transform: uppercase;">Billed To:</strong>
                <div style="font-weight: 700; font-size: 1rem; color: #0F172A;">${invoice.clientName}</div>
                <div style="color: #475569;">${invoice.clientEmail}</div>
              </div>
              <div style="text-align: right;">
                <strong style="color: #64748B; font-size: 0.75rem; text-transform: uppercase;">Payment Status:</strong>
                <div>
                  <span class="badge-status badge-${invoice.status}" style="font-size: 0.85rem; padding: 0.35rem 0.8rem;">
                    ${invoice.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <table class="invoice-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align: right;">Amount (INR)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>${invoice.serviceName}</strong>
                    <div style="font-size: 0.78rem; color: #64748B;">High availability infrastructure and SLA maintenance</div>
                  </td>
                  <td style="text-align: right;">₹${baseAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Goods and Services Tax (GST 18%)</td>
                  <td style="text-align: right;">₹${gstAmount.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <div class="invoice-summary-box">
              <div class="invoice-summary-row">
                <span>Subtotal:</span>
                <span>₹${baseAmount.toFixed(2)}</span>
              </div>
              <div class="invoice-summary-row">
                <span>GST (18%):</span>
                <span>₹${gstAmount.toFixed(2)}</span>
              </div>
              <div class="invoice-summary-row total">
                <span>Total Due:</span>
                <span style="color: #4F8CFF;">₹${invoice.amount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #E2E8F0; font-size: 0.75rem; color: #64748B;">
              <strong>Payment Instructions:</strong> Direct NEFT/IMPS transfer to VMC Tech India Current Account. Account No: 50200012345678 | IFSC: HDFC0001234.
            </div>
          </div>
        </div>
      </div>
    `;

    this.app.showModal(modalHtml);
  }

  // 8. Client Detail Drawer Modal
  openClientDetailModal(clientId) {
    const client = portalStore.getItemById('users', clientId);
    if (!client) return;

    const services = portalStore.getCollection('clientServices').filter(s => s.clientId === clientId);
    const invoices = portalStore.getCollection('invoices').filter(i => i.clientId === clientId);

    const modalHtml = `
      <div class="modal-dialog modal-lg">
        <div class="modal-header">
          <h3>Client Profile: ${client.displayName}</h3>
          <button class="btn-icon" onclick="window.app.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <div style="display: flex; gap: 1.5rem; margin-bottom: 1.5rem; background: rgba(255,255,255,0.02); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div class="avatar" style="width: 56px; height: 56px; font-size: 1.4rem;">${client.displayName.charAt(0)}</div>
            <div>
              <h3 style="font-size: 1.2rem; margin-bottom: 0.2rem;">${client.displayName}</h3>
              <div style="color: var(--accent-blue); font-size: 0.9rem;">${client.company}</div>
              <div style="color: var(--text-dim); font-size: 0.8rem; margin-top: 0.2rem;">Email: ${client.email} | Phone: ${client.phone || 'N/A'}</div>
            </div>
          </div>

          <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem;">Assigned Subscriptions (${services.length})</h4>
          <div class="table-responsive" style="margin-bottom: 1.5rem;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Expiry</th>
                  <th>Current Metric</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${services.map(s => `
                  <tr>
                    <td><strong>${s.serviceName}</strong></td>
                    <td>${s.expiryDate}</td>
                    <td>${s.metric.current} / ${s.metric.max} ${s.metric.unit}</td>
                    <td><span class="badge-status badge-${s.status}">${s.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem;">Invoices & Billing History (${invoices.length})</h4>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Amount</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => `
                  <tr>
                    <td><strong>${inv.invoiceNumber}</strong></td>
                    <td>₹${inv.amount.toLocaleString('en-IN')}</td>
                    <td>${inv.dueDate}</td>
                    <td><span class="badge-status badge-${inv.status}">${inv.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.app.showModal(modalHtml);
  }

  // Action helpers
  toggleSuspension(clientId) {
    try {
      const user = portalStore.toggleClientSuspension(clientId);
      this.app.showToast(`Client account ${user.status === 'suspended' ? 'suspended' : 'reactivated'}.`, 'info');
    } catch (err) {
      this.app.showToast(err.message, 'error');
    }
  }

  sendSetupLink(email) {
    const res = authManager.requestPasswordResetLink(email);
    const modalHtml = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Secure Account Setup / Reset Link</h3>
          <button class="btn-icon" onclick="window.app.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <p style="font-size: 0.88rem; margin-bottom: 1rem;">
            A secure link has been generated for <strong>${email}</strong>. In production, this is emailed automatically via Firebase Cloud Functions / Nodemailer.
          </p>
          <div class="form-group">
            <label>Setup Link URL (Single Use Token)</label>
            <input type="text" readonly class="form-control no-icon" value="${res.setupUrl}" id="copy-setup-link-input" style="font-family: monospace; font-size: 0.8rem;">
          </div>
          <button class="btn btn-outline-blue btn-block" onclick="navigator.clipboard.writeText('${res.setupUrl}'); window.app.showToast('Copied setup link to clipboard!', 'success');">
            <i data-lucide="copy"></i> Copy Link to Clipboard
          </button>
        </div>
      </div>
    `;
    this.app.showModal(modalHtml);
  }

  sendManualReminder(serviceId) {
    const service = portalStore.getItemById('clientServices', serviceId);
    if (!service) return;

    portalStore.createNotification({
      targetUserId: service.clientId,
      role: 'client',
      title: 'Manual Service Renewal Notice',
      message: `Your service "${service.serviceName}" is due for renewal on ${service.expiryDate}. Please contact admin or clear pending dues.`,
      type: 'warning'
    });

    portalStore.logActivity({
      action: 'MANUAL_REMINDER_SENT',
      targetType: 'clientService',
      targetId: serviceId,
      details: `Dispatched manual renewal reminder to ${service.clientName} (${service.clientEmail})`
    });

    this.app.showToast(`Renewal reminder dispatched to ${service.clientName}!`, 'success');
  }

  runManualCronCheck() {
    portalStore.recalculateAllExpiries();
    this.app.showToast('Service expiry check executed. All countdowns & statuses recalculated.', 'success');
    this.render();
  }
}
