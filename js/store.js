/* ==========================================================================
   VMC TECH INDIA - REACTIVE DATA STORE & CLOUD FIRESTORE ENGINE
   Full 2-Way Realtime Synchronization across all devices with Firestore onSnapshot
   ========================================================================== */

import { initializeFirebaseServices, isFirebaseConfigured } from './firebase-config.js';

// Keys for persistence
const STORAGE_KEY = 'vmc_portal_db_v4';
const BROADCAST_CHANNEL_NAME = 'vmc_portal_realtime_sync';

// Default initial state
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
    this.firebaseAuth = null;
    this.firestoreUnsubscribers = [];
    this.isSyncing = false;
    
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
    if (this.isLiveFirebase && this.firebaseDb) {
      return true;
    }

    try {
      const { isLive, db, auth } = await initializeFirebaseServices();
      this.isLiveFirebase = isLive;
      this.firebaseDb = db;
      this.firebaseAuth = auth;

      if (isLive && db) {
        console.info('[VMC Portal] Cloud Firestore active. Initializing multi-device sync...');
        
        // 1. Ensure initial admin, services, and any local client records exist in Firestore
        await this.syncLocalAndFirestore();

        // 2. Attach live onSnapshot listeners so any changes on other devices sync instantly
        this.attachFirestoreListeners();
      }
      return isLive;
    } catch (err) {
      console.warn('[VMC Portal] Firebase init failed, operating with local engine:', err);
      return false;
    }
  }

  // Ensure collections exist in Firestore and upload any local records
  async syncLocalAndFirestore() {
    if (!this.firebaseDb) return;

    try {
      // 1. Ensure admin_1 exists in Firestore
      const adminRef = this.firebaseDb.collection('users').doc('admin_1');
      const adminSnap = await adminRef.get();
      if (!adminSnap.exists) {
        await adminRef.set(INITIAL_SEED_DATA.users[0]);
        console.info('[VMC Portal] Initialized admin_1 in Firestore.');
      }

      // 2. Ensure services catalog exists in Firestore
      const servicesSnap = await this.firebaseDb.collection('services').limit(1).get();
      if (servicesSnap.empty) {
        const batch = this.firebaseDb.batch();
        INITIAL_SEED_DATA.services.forEach(srv => {
          batch.set(this.firebaseDb.collection('services').doc(srv.id), srv);
        });
        await batch.commit();
        console.info('[VMC Portal] Initialized services catalog in Firestore.');
      }

      // 3. Migrate any locally created clients to Firestore so they sync immediately
      const localData = this.getRawData();
      if (localData.users && localData.users.length > 0) {
        for (const user of localData.users) {
          if (user.id !== 'admin_1') {
            const uRef = this.firebaseDb.collection('users').doc(user.id);
            const uSnap = await uRef.get();
            if (!uSnap.exists) {
              await uRef.set(user);
              console.info(`[VMC Portal] Synced local client ${user.email} to Firestore.`);
            }
          }
        }
      }

      // 4. Migrate local client services if not yet in Firestore
      if (localData.clientServices && localData.clientServices.length > 0) {
        for (const s of localData.clientServices) {
          const sRef = this.firebaseDb.collection('clientServices').doc(s.id);
          const sSnap = await sRef.get();
          if (!sSnap.exists) {
            await sRef.set(s);
          }
        }
      }

      // 5. Migrate local invoices if not yet in Firestore
      if (localData.invoices && localData.invoices.length > 0) {
        for (const inv of localData.invoices) {
          const iRef = this.firebaseDb.collection('invoices').doc(inv.id);
          const iSnap = await iRef.get();
          if (!iSnap.exists) {
            await iRef.set(inv);
          }
        }
      }

      // 6. Migrate local payments if not yet in Firestore
      if (localData.payments && localData.payments.length > 0) {
        for (const pay of localData.payments) {
          const pRef = this.firebaseDb.collection('payments').doc(pay.id);
          const pSnap = await pRef.get();
          if (!pSnap.exists) {
            await pRef.set(pay);
          }
        }
      }
    } catch (err) {
      console.warn('[VMC Portal] syncLocalAndFirestore notice:', err.message);
    }
  }

  // Real-time Firestore onSnapshot listeners for 2-way device synchronization
  attachFirestoreListeners() {
    if (!this.firebaseDb) return;

    // Unsubscribe any previous listeners
    this.firestoreUnsubscribers.forEach(unsub => {
      try { unsub(); } catch (e) {}
    });
    this.firestoreUnsubscribers = [];

    const collections = [
      'users',
      'services',
      'clientServices',
      'invoices',
      'payments',
      'notifications',
      'activityLogs',
      'reminderLogs'
    ];

    collections.forEach(colName => {
      try {
        const unsub = this.firebaseDb.collection(colName).onSnapshot(
          snapshot => {
            const items = [];
            snapshot.forEach(doc => {
              items.push({ id: doc.id, ...doc.data() });
            });

            // Sort chronologically if applicable
            if (colName === 'activityLogs' || colName === 'notifications') {
              items.sort((a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0));
            } else if (colName === 'invoices' || colName === 'payments') {
              items.sort((a, b) => new Date(b.createdAt || b.issueDate || b.paymentDate || 0) - new Date(a.createdAt || a.issueDate || a.paymentDate || 0));
            }

            // Update local storage without looping
            const data = this.getRawData();
            data[colName] = items;
            this.saveRawDataLocally(data);

            // Notify UI subscribers
            this.notifySubscribers(colName, items, false);
          },
          err => {
            console.error(`[VMC Portal] Firestore listener error on '${colName}':`, err);
          }
        );
        this.firestoreUnsubscribers.push(unsub);
      } catch (err) {
        console.error(`[VMC Portal] Failed to attach listener for ${colName}:`, err);
      }
    });
  }

  initData() {
    try {
      localStorage.removeItem('vmc_portal_db_v1');
      localStorage.removeItem('vmc_portal_db_v2');
      localStorage.removeItem('vmc_portal_db_v3');
      
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED_DATA));
      } else {
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

  saveRawDataLocally(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }

  saveRawData(data, changedCollection = null) {
    this.saveRawDataLocally(data);
    if (changedCollection) {
      this.notifySubscribers(changedCollection, data[changedCollection] || [], true);
    }
  }

  // Real-time Subscription method
  subscribe(collectionName, callback) {
    if (!this.subscribers.has(collectionName)) {
      this.subscribers.set(collectionName, new Set());
    }
    this.subscribers.get(collectionName).add(callback);

    // Immediate initial dispatch with current state
    const currentData = this.getCollection(collectionName);
    callback(currentData);

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
      try {
        this.broadcastChannel.postMessage({ collection: collectionName, data });
      } catch (e) {}
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

  // =========================================================================
  // CRUD ACTIONS (Optimistic local updates + Firestore cloud persistence)
  // =========================================================================

  // 1. Client Management
  createClient({ displayName, email, company, phone, password }) {
    const data = this.getRawData();
    const cleanEmail = (email || '').trim().toLowerCase();
    const existing = (data.users || []).find(u => u.email && u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error(`A client with email ${email} already exists.`);
    }

    const newClient = {
      id: `client_${Date.now()}`,
      email: cleanEmail,
      displayName: displayName.trim(),
      company: (company || 'Individual Client').trim(),
      phone: phone ? phone.trim() : '',
      role: 'client',
      status: 'active',
      password: password || 'Client@1234',
      tempPassword: password || 'Client@1234',
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    };

    data.users = data.users || [];
    data.users.push(newClient);
    this.saveRawData(data, 'users');

    // Asynchronously persist to Cloud Firestore
    if (this.firebaseDb) {
      this.firebaseDb.collection('users').doc(newClient.id).set(newClient)
        .then(() => console.info(`[VMC Portal] Client ${newClient.email} saved to Firestore.`))
        .catch(err => console.error('[VMC Portal] Firestore createClient error:', err));
    }

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
    const index = (data.users || []).findIndex(u => u.id === clientId);
    if (index === -1) throw new Error('Client not found');

    const updatedUser = { ...data.users[index], ...updates, updatedAt: new Date().toISOString() };
    data.users[index] = updatedUser;
    this.saveRawData(data, 'users');

    if (this.firebaseDb) {
      this.firebaseDb.collection('users').doc(clientId).update({
        ...updates,
        updatedAt: updatedUser.updatedAt
      }).catch(err => console.error('[VMC Portal] Firestore updateClient error:', err));
    }

    this.logActivity({
      action: 'CLIENT_UPDATED',
      targetType: 'user',
      targetId: clientId,
      details: `Updated profile details for client ${updatedUser.displayName}`
    });

    return updatedUser;
  }

  toggleClientSuspension(clientId) {
    const data = this.getRawData();
    const user = (data.users || []).find(u => u.id === clientId);
    if (!user) throw new Error('Client not found');

    user.status = user.status === 'suspended' ? 'active' : 'suspended';
    user.updatedAt = new Date().toISOString();
    this.saveRawData(data, 'users');

    if (this.firebaseDb) {
      this.firebaseDb.collection('users').doc(clientId).update({
        status: user.status,
        updatedAt: user.updatedAt
      }).catch(err => console.error('[VMC Portal] Firestore toggleClientSuspension error:', err));
    }

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
    const client = (data.users || []).find(u => u.id === serviceData.clientId);
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
      renewalHistory: [],
      createdAt: new Date().toISOString()
    };

    data.clientServices = data.clientServices || [];
    data.clientServices.push(newSubscription);
    this.saveRawData(data, 'clientServices');

    if (this.firebaseDb) {
      this.firebaseDb.collection('clientServices').doc(newSubscription.id).set(newSubscription)
        .then(() => console.info(`[VMC Portal] Service ${newSubscription.serviceName} assigned in Firestore.`))
        .catch(err => console.error('[VMC Portal] Firestore assignClientService error:', err));
    }

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

  // LIVE SERVICE USAGE UPDATE (Instant real-time sync across devices!)
  updateServiceMetric(serviceId, metricUpdates, note = '') {
    const data = this.getRawData();
    const service = (data.clientServices || []).find(s => s.id === serviceId);
    if (!service) throw new Error('Client service not found');

    const previousVal = service.metric.current;
    service.metric = {
      ...service.metric,
      ...metricUpdates
    };

    if (note) {
      service.adminNotes = note;
    }
    service.updatedAt = new Date().toISOString();

    this.saveRawData(data, 'clientServices');

    if (this.firebaseDb) {
      const updateData = {
        metric: service.metric,
        updatedAt: service.updatedAt
      };
      if (note) updateData.adminNotes = note;

      this.firebaseDb.collection('clientServices').doc(serviceId).update(updateData)
        .then(() => console.info(`[VMC Portal] Metric updated in Firestore for ${service.serviceName}.`))
        .catch(err => console.error('[VMC Portal] Firestore updateServiceMetric error:', err));
    }

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
    const service = (data.clientServices || []).find(s => s.id === serviceId);
    if (!service) throw new Error('Service subscription not found');

    const previousExpiry = service.expiryDate;
    service.expiryDate = newExpiryDate;
    service.status = this.calculateExpiryInfo(newExpiryDate).status;
    service.updatedAt = new Date().toISOString();

    if (!service.renewalHistory) service.renewalHistory = [];
    service.renewalHistory.push({
      renewedAt: new Date().toISOString(),
      previousExpiry,
      newExpiry: newExpiryDate,
      amount: Number(renewalAmount) || service.billingAmount,
      notes: notes || 'Service extended by administrator'
    });

    this.saveRawData(data, 'clientServices');

    if (this.firebaseDb) {
      this.firebaseDb.collection('clientServices').doc(serviceId).update({
        expiryDate: service.expiryDate,
        status: service.status,
        renewalHistory: service.renewalHistory,
        updatedAt: service.updatedAt
      }).catch(err => console.error('[VMC Portal] Firestore renewClientService error:', err));
    }

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
    const client = (data.users || []).find(u => u.id === clientId);
    if (!client) throw new Error('Client not found');

    const invoiceNum = `INV-2026-${String((data.invoices || []).length + 1).padStart(3, '0')}`;
    const parsedAmount = Number(amount) || 0;
    
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
      paidAt: null,
      createdAt: new Date().toISOString()
    };

    data.invoices = data.invoices || [];
    data.invoices.unshift(newInvoice);
    this.saveRawData(data, 'invoices');

    if (this.firebaseDb) {
      this.firebaseDb.collection('invoices').doc(newInvoice.id).set(newInvoice)
        .then(() => console.info(`[VMC Portal] Invoice ${newInvoice.invoiceNumber} saved to Firestore.`))
        .catch(err => console.error('[VMC Portal] Firestore createInvoice error:', err));
    }

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
    const invoice = (data.invoices || []).find(inv => inv.id === invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    invoice.status = 'paid';
    invoice.paidAt = new Date().toISOString();
    invoice.paymentMethod = method;

    const paymentRecord = {
      id: `pay_${Date.now()}`,
      paymentNumber: `PAY-2026-${String((data.payments || []).length + 1).padStart(3, '0')}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      amount: Number(amount) || invoice.amount,
      paymentDate: paymentDate || new Date().toISOString().split('T')[0],
      method: method || 'bank_transfer',
      referenceNo: referenceNo || 'REF-OFFLINE',
      recordedBy: 'Admin',
      notes: notes || 'Verified and marked paid by admin',
      createdAt: new Date().toISOString()
    };

    data.payments = data.payments || [];
    data.payments.unshift(paymentRecord);
    this.saveRawData(data, 'invoices');
    this.saveRawData(data, 'payments');

    if (this.firebaseDb) {
      const batch = this.firebaseDb.batch();
      batch.update(this.firebaseDb.collection('invoices').doc(invoice.id), {
        status: 'paid',
        paidAt: invoice.paidAt,
        paymentMethod: method
      });
      batch.set(this.firebaseDb.collection('payments').doc(paymentRecord.id), paymentRecord);
      batch.commit()
        .then(() => console.info(`[VMC Portal] Payment ${paymentRecord.paymentNumber} saved to Firestore.`))
        .catch(err => console.error('[VMC Portal] Firestore recordPayment error:', err));
    }

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
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      targetUserId,
      role,
      title,
      message,
      type,
      isRead: false,
      link,
      createdAt: new Date().toISOString()
    };

    data.notifications = data.notifications || [];
    data.notifications.unshift(notif);
    this.saveRawData(data, 'notifications');

    if (this.firebaseDb) {
      this.firebaseDb.collection('notifications').doc(notif.id).set(notif)
        .catch(err => console.error('[VMC Portal] Firestore createNotification error:', err));
    }

    return notif;
  }

  markNotificationRead(notifId) {
    const data = this.getRawData();
    const notif = (data.notifications || []).find(n => n.id === notifId);
    if (notif) {
      notif.isRead = true;
      this.saveRawData(data, 'notifications');

      if (this.firebaseDb) {
        this.firebaseDb.collection('notifications').doc(notifId).update({ isRead: true })
          .catch(err => console.error('[VMC Portal] Firestore markNotificationRead error:', err));
      }
    }
  }

  markAllNotificationsRead(userId) {
    const data = this.getRawData();
    const toUpdate = [];
    data.notifications = (data.notifications || []).map(n => {
      if ((n.targetUserId === userId || n.role === 'all') && !n.isRead) {
        n.isRead = true;
        toUpdate.push(n.id);
      }
      return n;
    });
    this.saveRawData(data, 'notifications');

    if (this.firebaseDb && toUpdate.length > 0) {
      const batch = this.firebaseDb.batch();
      toUpdate.forEach(id => {
        batch.update(this.firebaseDb.collection('notifications').doc(id), { isRead: true });
      });
      batch.commit().catch(err => console.error('[VMC Portal] Firestore markAllNotificationsRead error:', err));
    }
  }

  // 5. Activity Audit Logger
  logActivity({ action, targetType, targetId, details, actorId = 'admin_1', actorName = 'Admin', actorRole = 'admin' }) {
    const data = this.getRawData();
    const log = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      actorId,
      actorName,
      actorRole,
      action,
      targetType,
      targetId,
      details,
      timestamp: new Date().toISOString()
    };

    data.activityLogs = data.activityLogs || [];
    data.activityLogs.unshift(log);
    if (data.activityLogs.length > 150) {
      data.activityLogs = data.activityLogs.slice(0, 150);
    }
    this.saveRawData(data, 'activityLogs');

    if (this.firebaseDb) {
      this.firebaseDb.collection('activityLogs').doc(log.id).set(log)
        .catch(err => console.error('[VMC Portal] Firestore logActivity error:', err));
    }
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
