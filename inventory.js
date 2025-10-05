/* js/inventory.js
   Product Inventory Storage
   - Uses localStorage for data persistence
   - No authentication or external APIs
   - Exposes functions for other pages (products, add/edit)
*/

(() => {
  const STORAGE_KEY = 'tile_inventory_products';

  function loadAll() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse products:', e);
      return [];
    }
  }

  function saveAll(products) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }

  function addProduct(product) {
    const products = loadAll();
    product.id = `prod_${Date.now()}`;
    product.createdAt = new Date().toISOString();
    products.push(product);
    saveAll(products);
    return product;
  }

  function updateProduct(id, updates) {
    const products = loadAll();
    const index = products.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Product not found');
    products[index] = { ...products[index], ...updates, updatedAt: new Date().toISOString() };
    saveAll(products);
  }

  function deleteProduct(id) {
    const products = loadAll().filter(p => p.id !== id);
    saveAll(products);
  }

  function getProduct(id) {
    return loadAll().find(p => p.id === id) || null;
  }

  // Export globally
  window.tiaInventory = {
    loadAll,
    addProduct,
    updateProduct,
    deleteProduct,
    getProduct
  };

  console.info('Inventory module loaded (no login, localStorage mode)');
})();
