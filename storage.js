/* js/storage.js
   Storage layer for Tile Inventory App
   - Default storage adapter: localStorage (browser)
   - Supports exporting/importing full DB as JSON (for JSON backend or backup)
   - Provides CRUD for: products, sales (transactions), purchases, alerts
   - Uses a single top-level DB object stored under key 'tia_db_v1' in localStorage
   - Designed to be synchronous-ish (LocalStorage) but API is async to allow future adapters (Google Sheets, server) to be async.
   - Save as: tile-inventory-app/js/storage.js
*/

(() => {
  const DB_KEY = 'tia_db_v1';
  const DB_VERSION = 1;

  // Default DB schema
  const emptyDB = () => ({
    meta: {
      version: DB_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    products: [],      // product objects
    sales: [],         // transaction objects
    purchases: [],     // purchase orders
    alerts: [],        // low stock alerts
    users: []          // optional user store (auth uses its own USERS_KEY)
  });

  // ---------- Utilities ----------
  function generateId(prefix = 'id') {
    // compact unique string: prefix + timestamp + random 3 hex
    const t = Date.now().toString(36);
    const r = Math.floor(Math.random() * 0xFFF).toString(16).padStart(3, '0');
    return `${prefix}_${t}${r}`;
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function nowISO() {
    return new Date().toISOString();
  }

  // ---------- LocalStorage Adapter (default) ----------
  const LocalStorageAdapter = {
    async load() {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) {
        const db = emptyDB();
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        return deepClone(db);
      }
      try {
        const parsed = JSON.parse(raw);
        // Basic migration check
        if (!parsed.meta || parsed.meta.version !== DB_VERSION) {
          // Simple migration: if older or missing, wrap in new schema preserving lists if possible
          const migrated = emptyDB();
          if (parsed.products) migrated.products = parsed.products;
          if (parsed.sales) migrated.sales = parsed.sales;
          if (parsed.purchases) migrated.purchases = parsed.purchases;
          migrated.meta.updatedAt = nowISO();
          localStorage.setItem(DB_KEY, JSON.stringify(migrated));
          return deepClone(migrated);
        }
        return deepClone(parsed);
      } catch (e) {
        console.error('Failed to parse DB from localStorage, resetting DB:', e);
        const db = emptyDB();
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        return deepClone(db);
      }
    },

    async save(dbObj) {
      const toSave = deepClone(dbObj);
      toSave.meta = toSave.meta || {};
      toSave.meta.updatedAt = nowISO();
      localStorage.setItem(DB_KEY, JSON.stringify(toSave));
      return true;
    },

    async clear() {
      localStorage.removeItem(DB_KEY);
      return true;
    }
  };

  // Placeholder adapter for future Google Sheets / server-based storage
  // NOTE: These functions should be replaced with real network calls in production.
  const DummyRemoteAdapter = {
    async load() {
      // throw or fallback to LocalStorage
      throw new Error('Remote adapter not implemented. Use LocalStorage adapter or implement remote sync.');
    },
    async save() {
      throw new Error('Remote adapter not implemented.');
    },
    async clear() {
      throw new Error('Remote adapter not implemented.');
    }
  };

  // ---------- Main Storage Controller ----------
  let adapter = LocalStorageAdapter; // default; can be switched via setAdapter()
  let _dbCache = null;               // in-memory cache of last loaded DB
  let _watchers = [];                // listeners for changes

  async function loadDB(force = false) {
    if (_dbCache && !force) return deepClone(_dbCache);
    _dbCache = await adapter.load();
    return deepClone(_dbCache);
  }

  async function saveDB(dbObj) {
    await adapter.save(dbObj);
    _dbCache = deepClone(dbObj);
    // Notify watchers
    _watchers.forEach(fn => {
      try { fn(deepClone(_dbCache)); } catch (e) { console.error('watcher error', e); }
    });
    return true;
  }

  function setAdapter(newAdapterNameOrObj) {
    if (!newAdapterNameOrObj || newAdapterNameOrObj === 'local') {
      adapter = LocalStorageAdapter;
      return;
    }
    if (typeof newAdapterNameOrObj === 'object') {
      adapter = newAdapterNameOrObj;
      return;
    }
    // For string names we don't have other adapters here
    throw new Error('Unknown adapter. Provide "local" or an adapter object with load/save/clear methods.');
  }

  function onChange(callback) {
    if (typeof callback === 'function') _watchers.push(callback);
    // Return unsubscribe
    return () => {
      _watchers = _watchers.filter(fn => fn !== callback);
    };
  }

  // ---------- CRUD Helpers for collections ----------
  async function _getCollection(name) {
    const db = await loadDB();
    if (!db[name]) db[name] = [];
    return db[name];
  }

  async function _saveCollection(name, collection) {
    const db = await loadDB();
    db[name] = collection;
    return saveDB(db);
  }

  // ---------- Products API ----------
  async function getAllProducts() {
    return await _getCollection('products');
  }

  async function getProductById(productId) {
    const list = await _getCollection('products');
    return list.find(p => p.id === productId) || null;
  }

  /**
   * productData expected keys:
   * name, category, brand, sku, size, unitType, piecesPerBox, sftPerBox,
   * costPrice, sellingPricePerUnit, currentStock (object {boxes, pieces, sft}),
   * minStock, supplierName, supplierContact, location, imageUrl, dateAdded
   */
  async function addProduct(productData = {}) {
    const list = await _getCollection('products');
    const product = Object.assign({
      id: generateId('prod'),
      name: '',
      category: '',
      brand: '',
      sku: '',
      size: '',
      unitType: 'Box', // default
      piecesPerBox: 0,
      sftPerBox: 0,
      costPrice: 0,
      sellingPricePerUnit: 0,
      currentStock: { boxes: 0, pieces: 0, sft: 0 },
      minStock: 0,
      supplierName: '',
      supplierContact: '',
      location: '',
      imageUrl: '',
      dateAdded: nowISO(),
      notes: ''
    }, productData);

    list.push(product);
    await _saveCollection('products', list);
    return product;
  }

  async function updateProduct(productId, updates = {}) {
    const list = await _getCollection('products');
    const idx = list.findIndex(p => p.id === productId);
    if (idx === -1) throw new Error('Product not found');
    list[idx] = Object.assign({}, list[idx], updates, { dateUpdated: nowISO() });
    await _saveCollection('products', list);
    return list[idx];
  }

  async function deleteProduct(productId) {
    let list = await _getCollection('products');
    const existing = list.find(p => p.id === productId);
    if (!existing) throw new Error('Product not found');
    list = list.filter(p => p.id !== productId);
    await _saveCollection('products', list);
    return true;
  }

  // ---------- Sales (Transactions) API ----------
  /**
   * saleData expected:
   * dateTime, items: [{ productId, productName, quantity, unitType, unitPrice, totalAmount }],
   * customerName, customerPhone, paymentMethod, paymentStatus, notes
   */
  async function addSale(saleData = {}) {
    const list = await _getCollection('sales');
    const sale = Object.assign({
      id: generateId('sale'),
      dateTime: nowISO(),
      items: [],
      totalAmount: 0,
      customerName: '',
      customerPhone: '',
      paymentMethod: 'Cash',
      paymentStatus: 'Paid',
      notes: ''
    }, saleData);

    // append and persist
    list.push(sale);
    await _saveCollection('sales', list);

    // After saving sale, auto-update stock (reduce stock based on items)
    try {
      await _applyStockChangesFromSale(sale);
    } catch (e) {
      console.warn('Stock update after sale failed:', e);
    }

    return sale;
  }

  async function getAllSales() {
    return await _getCollection('sales');
  }

  async function getSaleById(saleId) {
    const list = await _getCollection('sales');
    return list.find(s => s.id === saleId) || null;
  }

  // ---------- Purchases API ----------
  /**
   * purchaseData expected:
   * dateTime, productId, quantity, unitType, costPerUnit, totalCost, supplierName, paymentStatus, notes
   * or items array similar to sales (multi-line purchase)
   */
  async function addPurchase(purchaseData = {}) {
    const list = await _getCollection('purchases');
    const purchase = Object.assign({
      id: generateId('pur'),
      dateTime: nowISO(),
      items: [], // allow multi-item purchases
      totalCost: 0,
      paymentStatus: 'Pending',
      supplierName: '',
      notes: ''
    }, purchaseData);

    list.push(purchase);
    await _saveCollection('purchases', list);

    // After saving purchase, auto-add stock
    try {
      await _applyStockChangesFromPurchase(purchase);
    } catch (e) {
      console.warn('Stock update after purchase failed:', e);
    }

    return purchase;
  }

  async function getAllPurchases() {
    return await _getCollection('purchases');
  }

  async function getPurchaseById(purchaseId) {
    const list = await _getCollection('purchases');
    return list.find(p => p.id === purchaseId) || null;
  }

  // ---------- Low Stock Alerts ----------
  async function getAllAlerts() {
    return await _getCollection('alerts');
  }

  async function addAlert(alertData = {}) {
    const list = await _getCollection('alerts');
    const alert = Object.assign({
      id: generateId('alert'),
      productId: alertData.productId || null,
      productName: alertData.productName || '',
      currentStock: alertData.currentStock || 0,
      minRequired: alertData.minRequired || 0,
      alertDate: nowISO(),
      resolved: false,
      notes: alertData.notes || ''
    }, alertData);
    list.push(alert);
    await _saveCollection('alerts', list);
    return alert;
  }

  async function resolveAlert(alertId) {
    const list = await _getCollection('alerts');
    const idx = list.findIndex(a => a.id === alertId);
    if (idx === -1) throw new Error('Alert not found');
    list[idx].resolved = true;
    list[idx].resolvedAt = nowISO();
    await _saveCollection('alerts', list);
    return list[idx];
  }

  // ---------- Stock adjustment helpers ----------
  // NOTE: unit conversions (box <-> pieces <-> sft) are best handled by utils.js.
  // Here we accept item.unitType (Box|Piece|SFT) and quantity, and apply to product.currentStock accordingly,
  // expecting calling code to convert when appropriate for atomic update.
  async function _applyStockChangesFromSale(sale) {
    if (!sale || !Array.isArray(sale.items)) return;
    const products = await _getCollection('products');

    // For each item reduce stock
    for (const item of sale.items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        console.warn('Product not found for sale item', item);
        continue;
      }
      // Default expectation: item has fields { quantity, unitType }.
      const qty = Number(item.quantity) || 0;
      const unitType = (item.unitType || '').toLowerCase();

      // Mutate product.currentStock safely
      product.currentStock = product.currentStock || { boxes: 0, pieces: 0, sft: 0 };
      if (unitType === 'box' || unitType === 'boxes') {
        product.currentStock.boxes = (Number(product.currentStock.boxes) || 0) - qty;
      } else if (unitType === 'piece' || unitType === 'pieces') {
        product.currentStock.pieces = (Number(product.currentStock.pieces) || 0) - qty;
      } else if (unitType === 'sft' || unitType === 's.f.t' || unitType === 'squarefeet' || unitType === 'square feet') {
        product.currentStock.sft = (Number(product.currentStock.sft) || 0) - qty;
      } else {
        // Unknown unit — try to apply to pieces
        product.currentStock.pieces = (Number(product.currentStock.pieces) || 0) - qty;
      }

      // Ensure no negative floats due to arithmetic
      product.currentStock.boxes = Math.round((Number(product.currentStock.boxes) || 0) * 1000) / 1000;
      product.currentStock.pieces = Math.round((Number(product.currentStock.pieces) || 0) * 1000) / 1000;
      product.currentStock.sft = Math.round((Number(product.currentStock.sft) || 0) * 1000) / 1000;

      // If below minStock, create an alert (non-duplicative)
      const min = Number(product.minStock) || 0;
      // Here minStock is interpreted in product.unitType context — calling code should standardize.
      // Create simple alert when any tracked value <= minStock
      if ((product.currentStock.boxes <= min && min > 0) ||
          (product.currentStock.pieces <= min && min > 0) ||
          (product.currentStock.sft <= min && min > 0)) {
        // Check existing unresolved alert for this product
        const alerts = await _getCollection('alerts');
        const existing = alerts.find(a => a.productId === product.id && !a.resolved);
        if (!existing) {
          alerts.push({
            id: generateId('alert'),
            productId: product.id,
            productName: product.name,
            currentStock: deepClone(product.currentStock),
            minRequired: min,
            alertDate: nowISO(),
            resolved: false
          });
          await _saveCollection('alerts', alerts);
        }
      }
    }

    // Persist product changes
    await _saveCollection('products', products);
  }

  async function _applyStockChangesFromPurchase(purchase) {
    if (!purchase || !Array.isArray(purchase.items)) return;
    const products = await _getCollection('products');

    for (const item of purchase.items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        console.warn('Product not found for purchase item', item);
        continue;
      }
      const qty = Number(item.quantity) || 0;
      const unitType = (item.unitType || '').toLowerCase();

      product.currentStock = product.currentStock || { boxes: 0, pieces: 0, sft: 0 };
      if (unitType === 'box' || unitType === 'boxes') {
        product.currentStock.boxes = (Number(product.currentStock.boxes) || 0) + qty;
      } else if (unitType === 'piece' || unitType === 'pieces') {
        product.currentStock.pieces = (Number(product.currentStock.pieces) || 0) + qty;
      } else if (unitType === 'sft' || unitType === 'squarefeet' || unitType === 'square feet') {
        product.currentStock.sft = (Number(product.currentStock.sft) || 0) + qty;
      } else {
        product.currentStock.pieces = (Number(product.currentStock.pieces) || 0) + qty;
      }

      product.currentStock.boxes = Math.round((Number(product.currentStock.boxes) || 0) * 1000) / 1000;
      product.currentStock.pieces = Math.round((Number(product.currentStock.pieces) || 0) * 1000) / 1000;
      product.currentStock.sft = Math.round((Number(product.currentStock.sft) || 0) * 1000) / 1000;

      // If stock is now above min and an alert exists, resolve it automatically
      const min = Number(product.minStock) || 0;
      if ((product.currentStock.boxes >= min && min > 0) ||
          (product.currentStock.pieces >= min && min > 0) ||
          (product.currentStock.sft >= min && min > 0)) {
        const alerts = await _getCollection('alerts');
        let changed = false;
        alerts.forEach(a => {
          if (a.productId === product.id && !a.resolved) {
            a.resolved = true;
            a.resolvedAt = nowISO();
            changed = true;
          }
        });
        if (changed) await _saveCollection('alerts', alerts);
      }
    }

    await _saveCollection('products', products);
  }

  // ---------- Export / Import (JSON) ----------
  async function exportDB() {
    const db = await loadDB();
    const json = JSON.stringify(db, null, 2);
    // Create a downloadable blob and trigger download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const filename = `tile-inventory-db-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;

    // Create a temporary anchor to download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { filename, json };
  }

  async function importDB(jsonString, merge = false) {
    if (!jsonString) throw new Error('No JSON provided for import');
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      throw new Error('Invalid JSON provided');
    }

    if (!merge) {
      // Replace DB completely
      const base = emptyDB();
      // Merge parsed if it has collections
      base.products = Array.isArray(parsed.products) ? parsed.products : base.products;
      base.sales = Array.isArray(parsed.sales) ? parsed.sales : base.sales;
      base.purchases = Array.isArray(parsed.purchases) ? parsed.purchases : base.purchases;
      base.alerts = Array.isArray(parsed.alerts) ? parsed.alerts : base.alerts;
      base.users = Array.isArray(parsed.users) ? parsed.users : base.users;
      base.meta = base.meta || {};
      base.meta.importedAt = nowISO();
      await saveDB(base);
      return base;
    } else {
      // Merge: append new items while preserving ids; avoid duplicates by id
      const db = await loadDB();
      const mergeArray = (targetArr, incomingArr) => {
        if (!Array.isArray(incomingArr)) return targetArr;
        const existingIds = new Set(targetArr.map(i => i.id));
        incomingArr.forEach(it => {
          if (!it.id || existingIds.has(it.id)) return; // skip duplicates or invalid ids
          targetArr.push(it);
        });
        return targetArr;
      };
      db.products = mergeArray(db.products, parsed.products);
      db.sales = mergeArray(db.sales, parsed.sales);
      db.purchases = mergeArray(db.purchases, parsed.purchases);
      db.alerts = mergeArray(db.alerts, parsed.alerts);
      db.users = mergeArray(db.users, parsed.users);
      await saveDB(db);
      return db;
    }
  }

  // ---------- Debug / Utility ----------
  async function clearDB() {
    await adapter.clear();
    _dbCache = null;
    // Reinitialize
    const db = await loadDB(true);
    return db;
  }

  // ---------- Public API export ----------
  window.tiaStorage = {
    // adapter control
    setAdapter,
    onChange,

    // DB-level
    loadDB,
    saveDB,       // advanced use: pass full DB object
    exportDB,
    importDB,
    clearDB,

    // products
    getAllProducts,
    getProductById,
    addProduct,
    updateProduct,
    deleteProduct,

    // sales
    addSale,
    getAllSales,
    getSaleById,

    // purchases
    addPurchase,
    getAllPurchases,
    getPurchaseById,

    // alerts
    getAllAlerts,
    addAlert,
    resolveAlert,

    // helpers
    generateId
  };

  // Auto-initialize cache on script load so pages can call tiaStorage.* right away.
  (async () => {
    try {
      _dbCache = await loadDB();
    } catch (e) {
      console.error('Failed to initialize storage layer:', e);
      _dbCache = emptyDB();
      await LocalStorageAdapter.save(_dbCache);
    }
  })();

})();
