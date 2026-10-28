/* ==========================================================================
   VMC TECH INDIA - REACTIVE DATA STORE & FIRESTORE ABSTRACTION
   Full schema implementation with Realtime Broadcast Channel & onSnapshot
   ========================================================================== */

import { initializeFirebaseServices, isFirebaseConfigured } from './firebase-config.js';

// Keys for persistence
const STORAGE_KEY = 'vmc_portal_db_v4';
const BROADCAST_CHANNEL_NAME = 'vmc_portal_realtime_sync';

// Default initial state: Clean system with zero demo records
const INITIAL_SEED_DATA = {
  users: [
    {
      id: 'admin_1',
      email: 'admin@vmctechindia.in',
      displayName: 'VMC Administrator',
      company: 'VMC Tech India HQ',
      role: 'admin',
      phone: '+91 98201 12345',
      status: 'active',
      password: 'swastikdps2009S',
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    }
  ],
  services: [
    { id: 'srv_hosting', name: 'Website Hosting (NVMe SSD)', category: 'Hosting', defaultUnit: 'GB', defaultMax: 50, description: 'High-speed cloud hosting with cPanel, auto-backups, and 99.9% uptime SLA.' },
    { id: 'srv_domain', name: 'Domain Management & DNS', category: 'Domain', defaultUnit: 'Days Left', defaultMax: 365, description: 'Domain registration, DNS clustering, WHOIS privacy protection, and automated renewals.' },
    { id: 'srv_maintenance', name: 'Monthly Website Maintenance', category: 'Maintenance', defaultUnit: 'Tasks / Mo', defaultMax: 10, description: 'Security hardening, WordPress core & plugin updates, speed optimizations, bug fixes.' },
    { id: 'srv_development', name: 'Custom Website Development', category: 'Development', defaultUnit: '% Complete', defaultMax: 100, description: 'Frontend & backend milestone delivery, custom web apps, and feature rollouts.' },
    { id: 'srv_ssl', name: 'SSL Certificate (Wildcard)', category: 'Security', defaultUnit: 'Days Left', defaultMax: 365, description: '256-bit encryption SSL certificate with auto-renewal and padlock trust badge.' },
    { id: 'srv_email', name: 'Google Workspace Business Email', category: 'Email', defaultUnit: 'GB', defaultMax: 30, description: 'Enterprise Google Workspace email accounts with custom domain integration.' },
    { id: 'srv_custom', name: 'Custom Cloud Infrastructure', category: 'Custom', defaultUnit: 'Units', defaultMax: 100, description: 'Tailored microservices, API integrations, and dedicated VPS hosting.' }
  ],
  clientServices: [],
  invoices: [],
  payments: [],
  notifications: [],
  reminderLogs: [],
  activityLogs: []
};

// Realtime Store Class
class RealtimePortalStore {
  constructor() {
    this.subscribers = new Map();
    this.broadcastChannel = null;
    this.isLiveFirebase = false;
    this.firebaseDb = null;
    
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          const { collection, data } = event.data;
          this.notifySubscribers(collection, data, false);
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported in this environment');
      }
    }
    
    this.initData();
  }

  async initBackend() {
    const { isLive, db } = await initializeFirebaseServices();
    this.isLiveFirebase = isLive;
    this.firebaseDb = db;
    return isLive;
  }

  initData() {
    try {
      // Purge legacy demo caches from previous sessions
      localStorage.removeItem('vmc_portal_db_v1');
      localStorage.removeItem('vmc_portal_db_v2');
      localStorage.removeItem('vmc_portal_db_v3');
      
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED_DATA));
      } else {
        // Auto-run expiry updater to keep dates accurate on load
        this.recalculateAllExpiries();
      }
    } catch (e) {
      console.error('Error reading localStorage data', e);
    }
  }

  getRawData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : INITIAL_SEED_DATA;
    } catch (e) {
      return INITIAL_SEED_DATA;
    }
  }

  saveRawData(data, changedCollection = null) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      if (changedCollection) {
        this.notifySubscribers(changedCollection, data[changedCollection] || [], true);
      }
    } catch (e) {
      console.error('Failed to save to store', e);
    }
  }

  // Real-time Subscription method (Identical developer signature to Firestore onSnapshot)
  subscribe(collectionName, callback) {
    if (!this.subscribers.has(collectionName)) {
      this.subscribers.set(collectionName, new Set());
    }
    this.subscribers.get(collectionName).add(callback);

    // Immediate initial dispatch with current state
    const currentData = this.getCollection(collectionName);
    callback(currentData);

    // Unsubscribe handle
    return () => {
      const colSubs = this.subscribers.get(collectionName);
      if (colSubs) {
        colSubs.delete(callback);
      }
    };
  }

  notifySubscribers(collectionName, data, shouldBroadcast = true) {
    const colSubs = this.subscribers.get(collectionName);
    if (colSubs) {
      colSubs.forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in listener for ${collectionName}:`, err);
        }
      });
    }

    if (shouldBroadcast && this.broadcastChannel) {
      this.broadcastChannel.postMessage({ collection: collectionName, data });
    }
  }

  // Collection Readers
  getCollection(name) {
    const data = this.getRawData();
    return data[name] || [];
  }

  getItemById(collectionName, id) {
    const col = this.getCollection(collectionName);
    return col.find(item => item.id === id) || null;
  }

  // Automated Expiry & Days Calculation Logic
  calculateExpiryInfo(expiryDateStr) {
    if (!expiryDateStr) return { daysLeft: 0, status: 'expired', label: 'No expiry date' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDateStr);
    expiry.setHours(0, 0, 0, 0);

    const diffTime = expiry.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status = 'active';
    let label = `${daysLeft} days remaining`;

    if (daysLeft < 0) {
      status = 'expired';
      label = `Expired ${Math.abs(daysLeft)} days ago`;
    } else if (daysLeft === 0) {
      status = 'expiring_soon';
      label = 'Expires Today';
    } else if (daysLeft === 1) {
      status = 'expiring_soon';
      label = 'Expires Tomorrow';
    } else if (daysLeft <= 7) {
      status = 'expiring_soon';
      label = `${daysLeft} days remaining`;
    }

    return { daysLeft, status, label };
  }

  recalculateAllExpiries() {
    const data = this.getRawData();
    let hasChanges = false;

    data.clientServices = (data.clientServices || []).map(service => {
      if (service.status === 'suspended') return service;
      const { status } = this.calculateExpiryInfo(service.expiryDate);
      if (service.status !== status) {
        service.status = status;
        hasChanges = true;
      }
      return service;
    });

    if (hasChanges) {
      this.saveRawData(data, 'clientServices');
    }
  }

  // --- CRUD ACTIONS ---

  // 1. Client Management
  createClient({ displayName, email, company, phone, password }) {
    const data = this.getRawData();
    const existing = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error(`A client with email ${email} already exists.`);
    }

    const newClient = {
      id: `client_${Date.now()}`,
      email: email.trim().toLowerCase(),
      displayName: displayName.trim(),
      company: (company || 'Individual Client').trim(),
      phone: phone ? phone.trim() : '',
      role: 'client',
      status: 'active',
      tempPassword: password || null,
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    };

    data.users.push(newClient);
    this.saveRawData(data, 'users');

    // Create welcoming notification
    this.createNotification({
      targetUserId: newClient.id,
      role: 'client',
      title: 'Welcome to VMC Tech India Portal',
      message: `Welcome aboard ${newClient.displayName}! Your client portal is configured and ready.`,
      type: 'success'
    });

    this.logActivity({
      action: 'CLIENT_CREATED',
      targetType: 'user',
      targetId: newClient.id,
      details: `Created new client account for ${newClient.displayName} (${newClient.email})`
    });

    return newClient;
  }

  updateClient(clientId, updates) {
    const data = this.getRawData();
    const index = data.users.findIndex(u => u.id === clientId);
    if (index === -1) throw new Error('Client not found');

    data.users[index] = { ...data.users[index], ...updates, updatedAt: new Date().toISOString() };
    this.saveRawData(data, 'users');

    this.logActivity({
      action: 'CLIENT_UPDATED',
      targetType: 'user',
      targetId: clientId,
      details: `Updated profile details for client ${data.users[index].displayName}`
    });

    return data.users[index];
  }

  toggleClientSuspension(clientId) {
    const data = this.getRawData();
    const user = data.users.find(u => u.id === clientId);
    if (!user) throw new Error('Client not found');

    user.status = user.status === 'suspended' ? 'active' : 'suspended';
    this.saveRawData(data, 'users');

    this.logActivity({
      action: user.status === 'suspended' ? 'CLIENT_SUSPENDED' : 'CLIENT_ACTIVATED',
      targetType: 'user',
      targetId: clientId,
      details: `${user.status === 'suspended' ? 'Suspended' : 'Reactivated'} account for ${user.displayName}`
    });

    return user;
  }

  // 2. Service Subscriptions
  assignClientService(serviceData) {
    const data = this.getRawData();
    const client = data.users.find(u => u.id === serviceData.clientId);
    if (!client) throw new Error('Client does not exist');

    const { status } = this.calculateExpiryInfo(serviceData.expiryDate);

    const newSubscription = {
      id: `cs_${Date.now()}`,
      clientId: client.id,
      clientName: client.displayName,
      clientEmail: client.email,
      serviceId: serviceData.serviceId,
      serviceName: serviceData.serviceName,
      description: serviceData.description || `${serviceData.serviceName} plan`,
      billingAmount: Number(serviceData.billingAmount) || 0,
      billingCycle: serviceData.billingCycle || 'yearly',
      startDate: serviceData.startDate || new Date().toISOString().split('T')[0],
      expiryDate: serviceData.expiryDate,
      status: status,
      metric: {
        label: serviceData.metricLabel || 'Service Usage',
        current: Number(serviceData.metricCurrent) || 0,
        max: Number(serviceData.metricMax) || 100,
        unit: serviceData.metricUnit || '%',
        thresholdWarning: Number(serviceData.thresholdWarning) || 80,
        isPercentage: serviceData.metricUnit === '%'
      },
      adminNotes: serviceData.adminNotes || '',
      renewalHistory: []
    };

    data.clientServices.push(newSubscription);
    this.saveRawData(data, 'clientServices');

    // Notify client of new service activation
    this.createNotification({
      targetUserId: client.id,
      role: 'client',
      title: 'New Service Activated',
      message: `Your service "${newSubscription.serviceName}" has been provisioned and is now live.`,
      type: 'info'
    });

    this.logActivity({
      action: 'SERVICE_ASSIGNED',
      targetType: 'clientService',
      targetId: newSubscription.id,
      details: `Assigned "${newSubscription.serviceName}" to ${client.displayName}`
    });

    return newSubscription;
  }

  // LIVE SERVICE USAGE UPDATE (Requirement 3: Instant updates without page refresh!)
  updateServiceMetric(serviceId, metricUpdates, note = '') {
    const data = this.getRawData();
    const service = data.clientServices.find(s => s.id === serviceId);
    if (!service) throw new Error('Client service not found');

    const previousVal = service.metric.current;
    service.metric = {
      ...service.metric,
      ...metricUpdates
    };

    if (note) {
      service.adminNotes = note;
    }

    this.saveRawData(data, 'clientServices');

    // Record activity
    this.logActivity({
      action: 'SERVICE_METRIC_UPDATE',
      targetType: 'clientService',
      targetId: serviceId,
      details: `Updated ${service.serviceName} metric (${service.metric.label}): ${previousVal} → ${service.metric.current} ${service.metric.unit}`
    });

    return service;
  }

  renewClientService(serviceId, newExpiryDate, renewalAmount, notes = '') {
    const data = this.getRawData();
    const service = data.clientServices.find(s => s.id === serviceId);
    if (!service) throw new Error('Service subscription not found');

    const previousExpiry = service.expiryDate;
    service.expiryDate = newExpiryDate;
    service.status = this.calculateExpiryInfo(newExpiryDate).status;

    if (!service.renewalHistory) service.renewalHistory = [];
    service.renewalHistory.push({
      renewedAt: new Date().toISOString(),
      previousExpiry,
      newExpiry: newExpiryDate,
      amount: Number(renewalAmount) || service.billingAmount,
      notes: notes || 'Service extended by administrator'
    });

    this.saveRawData(data, 'clientServices');

    // Notify client
    this.createNotification({
      targetUserId: service.clientId,
      role: 'client',
      title: 'Service Renewed Successfully',
      message: `Your service "${service.serviceName}" has been renewed until ${newExpiryDate}.`,
      type: 'success'
    });

    this.logActivity({
      action: 'SERVICE_RENEWED',
      targetType: 'clientService',
      targetId: serviceId,
      details: `Renewed ${service.serviceName} for ${service.clientName} to ${newExpiryDate}`
    });

    return service;
  }

  // 3. Invoice & Payment Management
  createInvoice({ clientId, clientServiceId, serviceName, amount, dueDate, items = [] }) {
    const data = this.getRawData();
    const client = data.users.find(u => u.id === clientId);
    if (!client) throw new Error('Client not found');

    const invoiceNum = `INV-2026-${String(data.invoices.length + 1).padStart(3, '0')}`;
    const parsedAmount = Number(amount) || 0;
    
    // Default single item if not explicitly supplied
    const invoiceItems = items.length > 0 ? items : [
      { description: serviceName || 'VMC Tech India Service', amount: (parsedAmount / 1.18).toFixed(2) },
      { description: 'GST (18%)', amount: (parsedAmount - (parsedAmount / 1.18)).toFixed(2) }
    ];

    const newInvoice = {
      id: `inv_${Date.now()}`,
      invoiceNumber: invoiceNum,
      clientId: client.id,
      clientName: client.displayName,
      clientEmail: client.email,
      clientServiceId: clientServiceId || null,
      serviceName: serviceName,
      amount: parsedAmount,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: dueDate || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
      status: 'pending',
      items: invoiceItems,
      paymentMethod: null,
      paidAt: null
    };

    data.invoices.unshift(newInvoice);
    this.saveRawData(data, 'invoices');

    this.createNotification({
      targetUserId: client.id,
      role: 'client',
      title: `New Invoice Generated: ${newInvoice.invoiceNumber}`,
      message: `An invoice for ₹${newInvoice.amount.toLocaleString('en-IN')} has been generated. Due date: ${newInvoice.dueDate}.`,
      type: 'info'
    });

    this.logActivity({
      action: 'INVOICE_GENERATED',
      targetType: 'invoice',
      targetId: newInvoice.id,
      details: `Generated invoice ${newInvoice.invoiceNumber} (₹${newInvoice.amount}) for ${client.displayName}`
    });

    return newInvoice;
  }

  recordPayment({ invoiceId, amount, paymentDate, method, referenceNo, notes }) {
    const data = this.getRawData();
    const invoice = data.invoices.find(inv => inv.id === invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    invoice.status = 'paid';
    invoice.paidAt = new Date().toISOString();
    invoice.paymentMethod = method;

    const paymentRecord = {
      id: `pay_${Date.now()}`,
      paymentNumber: `PAY-2026-${String(data.payments.length + 1).padStart(3, '0')}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      amount: Number(amount) || invoice.amount,
      paymentDate: paymentDate || new Date().toISOString().split('T')[0],
      method: method || 'bank_transfer',
      referenceNo: referenceNo || 'REF-OFFLINE',
      recordedBy: 'Admin',
      notes: notes || 'Verified and marked paid by admin'
    };

    data.payments.unshift(paymentRecord);
    this.saveRawData(data, 'invoices');
    this.saveRawData(data, 'payments');

    // Notify client of successful payment receipt
    this.createNotification({
      targetUserId: invoice.clientId,
      role: 'client',
      title: 'Payment Received & Confirmed',
      message: `Payment of ₹${paymentRecord.amount.toLocaleString('en-IN')} for ${invoice.invoiceNumber} has been received with thanks.`,
      type: 'success'
    });

    this.logActivity({
      action: 'PAYMENT_RECORDED',
      targetType: 'payment',
      targetId: paymentRecord.id,
      details: `Recorded payment of ₹${paymentRecord.amount} for ${invoice.invoiceNumber} (Ref: ${paymentRecord.referenceNo})`
    });

    return { invoice, paymentRecord };
  }

  // 4. Notifications Hub
  createNotification({ targetUserId, role = 'client', title, message, type = 'info', link = '' }) {
    const data = this.getRawData();
    const notif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      targetUserId,
      role,
      title,
      message,
      type,
      isRead: false,
      link,
      createdAt: new Date().toISOString()
    };

    data.notifications.unshift(notif);
    this.saveRawData(data, 'notifications');
    return notif;
  }

  markNotificationRead(notifId) {
    const data = this.getRawData();
    const notif = data.notifications.find(n => n.id === notifId);
    if (notif) {
      notif.isRead = true;
      this.saveRawData(data, 'notifications');
    }
  }

  markAllNotificationsRead(userId) {
    const data = this.getRawData();
    data.notifications = data.notifications.map(n => {
      if (n.targetUserId === userId || n.role === 'all') {
        n.isRead = true;
      }
      return n;
    });
    this.saveRawData(data, 'notifications');
  }

  // 5. Activity Audit Logger
  logActivity({ action, targetType, targetId, details, actorId = 'admin_1', actorName = 'Admin', actorRole = 'admin' }) {
    const data = this.getRawData();
    const log = {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      actorId,
      actorName,
      actorRole,
      action,
      targetType,
      targetId,
      details,
      timestamp: new Date().toISOString()
    };

    data.activityLogs.unshift(log);
    // Keep max 150 logs in storage
    if (data.activityLogs.length > 150) {
      data.activityLogs = data.activityLogs.slice(0, 150);
    }
    this.saveRawData(data, 'activityLogs');
  }

  // Reset to initial demo data anytime
  resetToSampleData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED_DATA));
    ['users', 'clientServices', 'invoices', 'payments', 'notifications', 'activityLogs'].forEach(col => {
      this.notifySubscribers(col, INITIAL_SEED_DATA[col] || [], true);
    });
  }
}

export const portalStore = new RealtimePortalStore();
