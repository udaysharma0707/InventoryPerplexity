/* js/sales.js
   Behavior for create-sale.html (and helper utilities for sales pages)
   - Product selection, unit handling, line calculations
   - Cart management (in-memory until save)
   - Persists sale via tiaStorage.addSale
   - Uses tiaUtils for unit conversions & currency formatting
   - Save as: tile-inventory-app/js/sales.js
*/

(() => {
  // small helper to wait for deps
  function waitFor(testFn, timeout = 4000, interval = 40) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      (function poll() {
        try { if (testFn()) return resolve(); } catch(e) {}
        if (Date.now() - start > timeout) return reject(new Error('waitFor timeout'));
        setTimeout(poll, interval);
      })();
    });
  }

  // currency formatter
  function fmt(v) {
    try {
      return window.tiaUtils.formatCurrency(v);
    } catch (e) {
      return '₹' + (Number(v) || 0).toFixed(2);
    }
  }

  // get elements
  function $id(id) { return document.getElementById(id); }

  // in-memory cart
  const cart = [];

  // find product in local product list by id
  let allProducts = [];

  async function loadProducts() {
    try {
      allProducts = await window.tiaStorage.getAllProducts();
      if (!Array.isArray(allProducts)) allProducts = [];
    } catch (e) {
      console.error('Failed to load products', e);
      allProducts = [];
    }
  }

  // populate product select options (use a simple search to filter)
  function populateProductSelect(filter = '') {
    const sel = $id('selectProduct');
    sel.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select a product';
    sel.appendChild(placeholder);

    const q = (filter || '').toString().trim().toLowerCase();
    const filtered = allProducts.filter(p => {
      if (!q) return true;
      return ((p.name||'').toLowerCase().includes(q) ||
              (p.sku||'').toLowerCase().includes(q) ||
              (p.brand||'').toLowerCase().includes(q));
    });

    filtered.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} ${p.sku ? '— ' + p.sku : ''} (${p.category || ''})`;
      sel.appendChild(opt);
    });
  }

  function findProductById(id) {
    return allProducts.find(p => p.id === id) || null;
  }

  // calculate line total (quantity * unit price). For SFT unit we assume unitPrice refers to per SFT.
  function calcLineTotal(qty, unitPrice) {
    const q = Number(qty) || 0;
    const up = Number(unitPrice) || 0;
    const total = q * up;
    // round to 2 decimals
    return Math.round((total + Number.EPSILON) * 100) / 100;
  }

  // update line total UI when qty or unit price changes
  function updateLineTotalUI() {
    const qty = Number($id('inputQty').value) || 0;
    const up = Number($id('inputUnitPrice').value) || 0;
    $id('inputLineTotal').value = fmt(calcLineTotal(qty, up));
  }

  // add item to cart
  function addToCart(productId, unit, qty, unitPrice) {
    const product = findProductById(productId);
    if (!product) throw new Error('Product not found');

    // compute numeric values
    const quantity = Number(qty) || 0;
    const price = Number(unitPrice) || 0;
    if (quantity <= 0) throw new Error('Quantity must be > 0');

    const lineTotal = calcLineTotal(quantity, price);

    const item = {
      id: `${productId}_${Date.now()}_${Math.floor(Math.random()*9999)}`,
      productId: productId,
      productName: product.name || '',
      unitType: unit,
      quantity,
      unitPrice: price,
      totalAmount: lineTotal,
      productSnapshot: {
        piecesPerBox: product.piecesPerBox || 0,
        sftPerBox: product.sftPerBox || 0,
        currentStock: product.currentStock || {}
      }
    };

    cart.push(item);
    renderCart();
  }

  // remove item
  function removeFromCart(itemId) {
    const idx = cart.findIndex(c => c.id === itemId);
    if (idx !== -1) cart.splice(idx, 1);
    renderCart();
  }

  // render cart rows
  function renderCart() {
    const tbody = document.querySelector('#cartTable tbody');
    tbody.innerHTML = '';
    if (cart.length === 0) {
      $id('cartEmpty').style.display = 'block';
    } else {
      $id('cartEmpty').style.display = 'none';
      cart.forEach((it, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${i+1}</td>
          <td>
            <div class="fw-semibold">${it.productName}</div>
            <div class="small text-muted">${it.productId}</div>
          </td>
          <td>${it.unitType}</td>
          <td>${it.quantity}</td>
          <td>${fmt(it.unitPrice)}</td>
          <td>${fmt(it.totalAmount)}</td>
          <td>
            <button class="btn btn-sm btn-outline-danger btn-remove" data-id="${it.id}">Remove</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // attach remove handlers
      tbody.querySelectorAll('.btn-remove').forEach(b => {
        b.addEventListener('click', (ev) => {
          const id = ev.currentTarget.dataset.id;
          removeFromCart(id);
        });
      });
    }

    // update summary
    const subtotal = cart.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);
    $id('subtotal').textContent = fmt(subtotal);
    $id('totalItems').textContent = cart.length;
  }

  // save sale: builds sale object and calls tiaStorage.addSale
  async function saveSale(opts = { print: false }) {
    if (cart.length === 0) {
      alert('Cart is empty. Add items before saving.');
      return;
    }

    // gather customer/payment
    const customerName = ($id('custName').value || '').trim();
    const customerPhone = ($id('custPhone').value || '').trim();
    const paymentMethod = $id('paymentMethod').value || 'Cash';
    const paymentStatus = $id('paymentStatus').value || 'Paid';
    const notes = ($id('saleNotes').value || '').trim();

    const totalAmount = cart.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);

    // Compose sale items in the shape expected by storage
    const saleItems = cart.map(it => ({
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unitType: it.unitType,
      unitPrice: it.unitPrice,
      totalAmount: it.totalAmount
    }));

    const saleData = {
      dateTime: new Date().toISOString(),
      items: saleItems,
      totalAmount,
      customerName,
      customerPhone,
      paymentMethod,
      paymentStatus,
      notes
    };

    try {
      const added = await window.tiaStorage.addSale(saleData);
      // success
      if (opts.print) {
        // simple print: open new window with invoice-like content
        const win = window.open('', '_blank', 'toolbar=0,location=0,menubar=0');
        if (win) {
          const html = invoiceHtml(added);
          win.document.open();
          win.document.write(html);
          win.document.close();
          // wait a tick then print
          setTimeout(() => {
            win.print();
            // optionally close after printing:
            // win.close();
          }, 300);
        } else {
          alert('Popup blocked — allow popups to print invoice.');
        }
      }
      alert('Sale saved successfully.');
      // clear cart & go to sales page
      cart.splice(0, cart.length);
      renderCart();
      window.location.href = 'sales.html';
      return added;
    } catch (e) {
      console.error('Failed to save sale', e);
      alert('Failed to save sale: ' + (e.message || e));
      throw e;
    }
  }

  // small invoice HTML generator
  function invoiceHtml(sale) {
    const lines = [];
    lines.push('<!doctype html><html><head><meta charset="utf-8"><title>Invoice</title>');
    lines.push('<style>body{font-family:Arial,Helvetica,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #eee}</style>');
    lines.push('</head><body>');
    lines.push(`<h2>Tile Inventory — Invoice</h2>`);
    lines.push(`<div>Transaction: ${sale.id}</div>`);
    lines.push(`<div>Date: ${new Date(sale.dateTime || sale.createdAt).toLocaleString()}</div>`);
    lines.push('<hr>');
    lines.push('<table>');
    lines.push('<thead><tr><th>Product</th><th>Unit</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>');
    (sale.items || []).forEach(it => {
      lines.push(`<tr><td>${it.productName}</td><td>${it.unitType}</td><td>${it.quantity}</td><td>${fmt(it.unitPrice)}</td><td>${fmt(it.totalAmount)}</td></tr>`);
    });
    lines.push('</tbody></table>');
    lines.push(`<h3>Total: ${fmt(sale.totalAmount || 0)}</h3>`);
    if (sale.customerName) lines.push(`<div>Customer: ${sale.customerName} ${sale.customerPhone ? '('+sale.customerPhone+')' : ''}</div>`);
    if (sale.notes) lines.push(`<div>Notes: ${sale.notes}</div>`);
    lines.push('</body></html>');
    return lines.join('');
  }

  // initialize page & bind events
  async function init() {
    try {
      await waitFor(() => window.tiaStorage && window.tiaUtils && window.tiaAuth, 4000);
    } catch (e) {
      console.warn('sales.js dependencies not fully available within timeout', e);
    }

    // Auth guard
    try {
      if (!window.tiaAuth || !window.tiaAuth.getSession || !window.tiaAuth.isAuthenticated() ) {
        window.location.href = 'index.html';
        return;
      }
    } catch (e) {
      // continue
    }

    // load products
    await loadProducts();
    populateProductSelect();

    // DOM refs
    const searchProduct = $id('searchProduct');
    const btnSearch = $id('btnSearch');
    const selectProduct = $id('selectProduct');
    const selectUnit = $id('selectUnit');
    const inputQty = $id('inputQty');
    const inputUnitPrice = $id('inputUnitPrice');
    const inputLineTotal = $id('inputLineTotal');
    const btnAddToCart = $id('btnAddToCart');
    const btnClearItem = $id('btnClearItem');
    const btnCancel = $id('btnCancel');
    const btnCancel2 = $id('btnCancel2');
    const btnSaveSale = $id('btnSaveSale');
    const btnSavePrint = $id('btnSavePrint');

    // search behavior
    btnSearch.addEventListener('click', () => {
      populateProductSelect(searchProduct.value);
    });
    searchProduct.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') populateProductSelect(searchProduct.value);
    });

    // when product selected, fill unit price default from product.sellingPricePerUnit
    selectProduct.addEventListener('change', () => {
      const pid = selectProduct.value;
      if (!pid) {
        inputUnitPrice.value = '';
        return;
      }
      const p = findProductById(pid);
      if (!p) return;
      // prefer sellingPricePerUnit; caller may change based on unit
      inputUnitPrice.value = Number(p.sellingPricePerUnit || 0);
      // also set default unit based on product.unitType
      selectUnit.value = p.unitType || 'Box';
      updateLineTotalUI();
    });

    // qty and price changes update line total
    inputQty.addEventListener('input', updateLineTotalUI);
    inputUnitPrice.addEventListener('input', updateLineTotalUI);

    // Add to cart button
    btnAddToCart.addEventListener('click', (ev) => {
      ev.preventDefault();
      try {
        const pid = selectProduct.value;
        const unit = selectUnit.value;
        const qty = Number(inputQty.value) || 0;
        const up = Number(inputUnitPrice.value) || 0;
        if (!pid) { alert('Select a product'); return; }
        if (qty <= 0) { alert('Enter quantity greater than zero'); return; }
        addToCart(pid, unit, qty, up);
        // clear fields for next item but keep selectProduct for quick repeat
        inputQty.value = 1;
        inputUnitPrice.value = 0;
        inputLineTotal.value = fmt(0);
      } catch (e) {
        alert('Could not add to cart: ' + (e.message || e));
      }
    });

    btnClearItem.addEventListener('click', (ev) => {
      ev.preventDefault();
      selectProduct.value = '';
      selectUnit.value = 'Box';
      inputQty.value = 1;
      inputUnitPrice.value = '';
      inputLineTotal.value = '';
    });

    // Cancel / navigation
    [btnCancel, btnCancel2].forEach(b => {
      b.addEventListener('click', (ev) => {
        ev.preventDefault();
        if (!confirm('Discard sale and return to products?')) return;
        window.location.href = 'products.html';
      });
    });

    // Save sale
    btnSaveSale.addEventListener('click', async (ev) => {
      ev.preventDefault();
      await saveSale({ print: false });
    });

    btnSavePrint.addEventListener('click', async (ev) => {
      ev.preventDefault();
      await saveSale({ print: true });
    });

    // subscribe to product DB changes to refresh product list
    if (window.tiaStorage && typeof window.tiaStorage.onChange === 'function') {
      window.tiaStorage.onChange(async () => {
        await loadProducts();
        populateProductSelect($id('searchProduct').value);
      });
    }

    // initial render
    renderCart();
  }

  // expose minimal API for debugging
  window.tiaSales = {
    cart,
    addToCart,
    removeFromCart,
    saveSale
  };

  // kick off when DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    init().catch(e => console.error('sales init error', e));
  });

})();
