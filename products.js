/* js/products.js
   Product listing & UI helpers for Tile Inventory App
   - Renders products table in products.html
   - Adds search box, category filter, and sort control
   - Hooks into tiaStorage and tiaUtils
   - Exposes window.tiaProducts API with refresh/render functions
   - Save as: tile-inventory-app/js/products.js
*/

(() => {
  // small wait helper for libs to be available
  function waitFor(testFn, timeout = 3000, interval = 50) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      (function poll() {
        try {
          if (testFn()) return resolve();
        } catch (e) {
          // ignore
        }
        if (Date.now() - start > timeout) return reject(new Error('Timeout waiting for resource'));
        setTimeout(poll, interval);
      })();
    });
  }

  // DOM helpers
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (!c) return;
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    });
    return node;
  }

  // High-level state for UI
  const state = {
    products: [],
    filtered: [],
    query: '',
    category: 'All',
    sortBy: 'name_asc', // name_asc | name_desc | stock_desc | price_asc | price_desc
    page: 1,
    pageSize: 1000 // large by default; pagination can be added later
  };

  // Render helpers
  function formatPrice(v) {
    try {
      if (window.tiaUtils && typeof window.tiaUtils.formatCurrency === 'function') {
        return window.tiaUtils.formatCurrency(v);
      }
    } catch (e) {}
    return (v || 0).toFixed ? (Number(v).toFixed(2)) : v;
  }

  function normalizeText(s) {
    return (s || '').toString().toLowerCase();
  }

  function applyFilters() {
    const q = normalizeText(state.query);
    const cat = state.category;
    let list = Array.isArray(state.products) ? state.products.slice() : [];

    if (cat && cat !== 'All') {
      list = list.filter(p => (p.category || '') === cat);
    }
    if (q) {
      list = list.filter(p => {
        return normalizeText(p.name).includes(q) ||
               normalizeText(p.sku).includes(q) ||
               normalizeText(p.brand).includes(q);
      });
    }

    // sorting
    list.sort((a, b) => {
      switch (state.sortBy) {
        case 'name_asc': return normalizeText(a.name).localeCompare(normalizeText(b.name));
        case 'name_desc': return normalizeText(b.name).localeCompare(normalizeText(a.name));
        case 'stock_desc': {
          const sa = Number((a.currentStock && (a.currentStock.boxes || a.currentStock.pieces || a.currentStock.sft)) || 0);
          const sb = Number((b.currentStock && (b.currentStock.boxes || b.currentStock.pieces || b.currentStock.sft)) || 0);
          return sb - sa;
        }
        case 'price_asc': return (Number(a.sellingPricePerUnit) || 0) - (Number(b.sellingPricePerUnit) || 0);
        case 'price_desc': return (Number(b.sellingPricePerUnit) || 0) - (Number(a.sellingPricePerUnit) || 0);
        default: return 0;
      }
    });

    state.filtered = list;
  }

  // Render product rows into table body
  function renderTable() {
    const tbody = document.querySelector('#productTable tbody');
    const emptyNotice = document.getElementById('emptyNotice');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!state.filtered || state.filtered.length === 0) {
      emptyNotice.style.display = 'block';
      return;
    } else {
      emptyNotice.style.display = 'none';
    }

    // simple pagination (if pageSize smaller)
    const start = (state.page - 1) * state.pageSize;
    const end = start + state.pageSize;
    const pageItems = state.filtered.slice(start, end);

    pageItems.forEach((p, i) => {
      const tr = document.createElement('tr');

      const indexCell = el('td', { html: (start + i + 1) });
      const nameCell = el('td', {}, [
        el('div', { class: 'fw-semibold ellipsis', text: p.name || '' }),
        el('div', { class: 'text-muted small', text: p.sku || '' })
      ]);
      const catCell = el('td', { class: 'ellipsis', text: p.category || '' });

      const boxes = (p.currentStock && (p.currentStock.boxes != null)) ? p.currentStock.boxes : 0;
      const pieces = (p.currentStock && (p.currentStock.pieces != null)) ? p.currentStock.pieces : 0;
      const sft = (p.currentStock && (p.currentStock.sft != null)) ? p.currentStock.sft : 0;

      const boxesCell = el('td', { text: boxes });
      const piecesCell = el('td', { text: pieces });
      const sftCell = el('td', { text: sft });

      const priceCell = el('td', { text: formatPrice(p.sellingPricePerUnit || 0) });

      const actionsCell = el('td');
      const editBtn = el('button', { class: 'btn btn-sm btn-outline-primary btn-edit', text: 'Edit' });
      const delBtn = el('button', { class: 'btn btn-sm btn-outline-danger btn-delete ms-1', text: 'Delete' });
      editBtn.dataset.id = p.id;
      delBtn.dataset.id = p.id;
      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(delBtn);

      tr.appendChild(indexCell);
      tr.appendChild(nameCell);
      tr.appendChild(catCell);
      tr.appendChild(boxesCell);
      tr.appendChild(piecesCell);
      tr.appendChild(sftCell);
      tr.appendChild(priceCell);
      tr.appendChild(actionsCell);

      tbody.appendChild(tr);
    });

    // attach handlers
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const id = ev.currentTarget.dataset.id;
        window.location.href = `edit-product.html?id=${encodeURIComponent(id)}`;
      });
    });

    tbody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        const id = ev.currentTarget.dataset.id;
        if (!confirm('Delete product? This action cannot be undone.')) return;
        try {
          await window.tiaStorage.deleteProduct(id);
          await refreshProducts();
        } catch (err) {
          alert('Delete failed: ' + (err.message || err));
        }
      });
    });
  }

  // UI top toolbar injection (search, category filter, sort)
  function ensureToolbar() {
    // Insert toolbar above table if not present
    const cardBody = document.querySelector('.card .card-body');
    if (!cardBody) return;

    if (document.getElementById('prodToolbar')) return; // already injected

    const toolbar = el('div', { id: 'prodToolbar', class: 'mb-3 d-flex flex-wrap align-items-center gap-2' });

    // Search
    const searchWrap = el('div', { class: 'input-group w-100 w-md-50' });
    const searchInput = el('input', { id: 'prodSearch', class: 'form-control', placeholder: 'Search name, SKU, brand...' });
    const searchBtn = el('button', { class: 'btn btn-outline-secondary', type: 'button', text: 'Search' });
    searchWrap.appendChild(searchInput);
    searchWrap.appendChild(searchBtn);

    // Category filter
    const categories = ['All']; // we'll populate dynamically later
    const catSelect = el('select', { id: 'prodCategory', class: 'form-select ms-2' });
    categories.forEach(c => {
      const o = el('option', { value: c, text: c });
      catSelect.appendChild(o);
    });

    // Sort select
    const sortSelect = el('select', { id: 'prodSort', class: 'form-select ms-2' });
    [
      { v: 'name_asc', t: 'Name ↑' },
      { v: 'name_desc', t: 'Name ↓' },
      { v: 'stock_desc', t: 'Stock ↓' },
      { v: 'price_asc', t: 'Price ↑' },
      { v: 'price_desc', t: 'Price ↓' }
    ].forEach(opt => {
      sortSelect.appendChild(el('option', { value: opt.v, text: opt.t }));
    });

    // Compact controls wrapper
    const rightWrap = el('div', { style: 'margin-left:auto; display:flex; gap:.5rem; align-items:center;' }, [
      catSelect, sortSelect
    ]);

    toolbar.appendChild(searchWrap);
    toolbar.appendChild(rightWrap);

    // insert before table
    const table = document.getElementById('productTable');
    if (table) cardBody.insertBefore(toolbar, table.parentElement); // insert before .table-responsive
    else cardBody.appendChild(toolbar);

    // Event bindings
    searchBtn.addEventListener('click', () => {
      state.query = document.getElementById('prodSearch').value.trim();
      state.page = 1;
      refreshRender();
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        state.query = searchInput.value.trim();
        state.page = 1;
        refreshRender();
      } else if (e.key === 'Escape') {
        searchInput.value = '';
        state.query = '';
        refreshRender();
      }
    });

    catSelect.addEventListener('change', (e) => {
      state.category = e.target.value;
      state.page = 1;
      refreshRender();
    });

    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      state.page = 1;
      refreshRender();
    });
  }

  // Fetch products from storage and update state
  async function refreshProducts() {
    try {
      const products = await window.tiaStorage.getAllProducts();
      state.products = Array.isArray(products) ? products : [];
      // populate category options dynamically
      const cats = new Set(['All']);
      state.products.forEach(p => { if (p.category) cats.add(p.category); });
      const catSelect = document.getElementById('prodCategory');
      if (catSelect) {
        const current = state.category || 'All';
        catSelect.innerHTML = '';
        Array.from(cats).sort().forEach(c => catSelect.appendChild(el('option', { value: c, text: c })));
        // reselect previous
        try { catSelect.value = current; } catch(e) {}
      }

      return state.products;
    } catch (e) {
      console.error('Failed to load products', e);
      state.products = [];
      return [];
    }
  }

  function refreshRender() {
    applyFilters();
    renderTable();
  }

  // Public init called on DOMContentLoaded
  async function init() {
    // Wait for required libs
    try {
      await waitFor(() => window.tiaStorage && window.tiaUtils && window.tiaAuth, 4000);
    } catch (err) {
      console.warn('Some dependencies not available within wait timeout, continuing anyway:', err);
    }

    ensureToolbar();

    // initial load
    await refreshProducts();
    refreshRender();

    // Subscribe to DB changes
    if (window.tiaStorage && typeof window.tiaStorage.onChange === 'function') {
      try {
        window.tiaStorage.onChange(async (db) => {
          // small debounce: do a microtask delay so multiple changes merge
          await new Promise(r => setTimeout(r, 50));
          await refreshProducts();
          refreshRender();
        });
      } catch (e) {
        console.warn('onChange subscription failed', e);
      }
    }

    // Expose a manual refresh hook
    window.tiaProducts = {
      refresh: async () => {
        await refreshProducts();
        refreshRender();
        return true;
      },
      renderProducts: (arr) => {
        state.products = arr || [];
        refreshRender();
      },
      state
    };
  }

  // Auto-run init when DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    init().catch(e => console.error('tiaProducts init error', e));
  });

})();
