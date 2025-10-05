// Product Management Functions

let editingProductId = null;
// Prepare modal for adding new product
function prepareAddProduct() {
    editingProductId = null;
    document.getElementById('modalTitle').textContent = 'Add New Product';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
}


// Display all products
function displayProducts() {
    const products = getProducts();
    const productsList = document.getElementById('productsList');
    
    if (products.length === 0) {
        productsList.innerHTML = `
            <div class="col-12">
                <div class="empty-state">
                    <i class="bi bi-inbox"></i>
                    <h4>No Products Yet</h4>
                    <p>Click "Add Product" to add your first item</p>
                </div>
            </div>
        `;
        return;
    }
    
    productsList.innerHTML = '';
    
    products.forEach(product => {
        const stockClass = product.stock > product.minStock ? 'stock-good' : 
                          product.stock > 0 ? 'stock-low' : 'stock-out';
        
        const stockText = product.stock > product.minStock ? 'In Stock' : 
                         product.stock > 0 ? 'Low Stock' : 'Out of Stock';
        
        const imageUrl = product.imageUrl || 'https://via.placeholder.com/300x200?text=' + encodeURIComponent(product.name);
        
        const card = `
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="card product-card">
                    <img src="${imageUrl}" class="product-image" alt="${product.name}" 
                         onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
                    <div class="card-body">
                        <h5 class="card-title">${product.name}</h5>
                        <p class="card-text text-muted mb-2">
                            <small>${product.category} ${product.brand ? '• ' + product.brand : ''}</small>
                        </p>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge stock-badge ${stockClass}">${stockText}</span>
                            <h5 class="mb-0">Stock: ${product.stock}</h5>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span>Price: <strong>₹${product.price}</strong>/${product.unitType}</span>
                        </div>
                        <div class="card-actions">
                            <button class="btn btn-primary btn-action" onclick="editProduct('${product.id}')">
                                <i class="bi bi-pencil"></i> Edit
                            </button>
                            <button class="btn btn-danger btn-action" onclick="deleteProduct('${product.id}')">
                                <i class="bi bi-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        productsList.innerHTML += card;
    });
}

// Show add product modal
function showAddProduct() {
    editingProductId = null;
    document.getElementById('modalTitle').textContent = 'Add New Product';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('productModal'));
    modal.show();
}

// Edit product
function editProduct(id) {
    const products = getProducts();
    const product = products.find(p => p.id === id);
    
    if (!product) return;
    
    editingProductId = id;
    document.getElementById('modalTitle').textContent = 'Edit Product';
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('category').value = product.category;
    document.getElementById('brand').value = product.brand || '';
    document.getElementById('size').value = product.size || '';
    document.getElementById('unitType').value = product.unitType;
    document.getElementById('piecesPerBox').value = product.piecesPerBox || 1;
    document.getElementById('sftPerBox').value = product.sftPerBox || '';
    document.getElementById('price').value = product.price;
    document.getElementById('stock').value = product.stock;
    document.getElementById('minStock').value = product.minStock;
    document.getElementById('imageUrl').value = product.imageUrl || '';
    
    const modal = new bootstrap.Modal(document.getElementById('productModal'));
    modal.show();
}

// Save product (add or update)
function saveProduct() {
    const name = document.getElementById('productName').value.trim();
    const category = document.getElementById('category').value;
    const brand = document.getElementById('brand').value.trim();
    const size = document.getElementById('size').value.trim();
    const unitType = document.getElementById('unitType').value;
    const piecesPerBox = parseInt(document.getElementById('piecesPerBox').value) || 1;
    const sftPerBox = parseFloat(document.getElementById('sftPerBox').value) || 0;
    const price = parseFloat(document.getElementById('price').value);
    const stock = parseInt(document.getElementById('stock').value);
    const minStock = parseInt(document.getElementById('minStock').value) || 5;
    const imageUrl = document.getElementById('imageUrl').value.trim();
    
    if (!name || !category || !price || stock < 0) {
        alert('❌ Please fill all required fields!');
        return;
    }
    
    const products = getProducts();
    
    if (editingProductId) {
        // Update existing product
        const index = products.findIndex(p => p.id === editingProductId);
        if (index !== -1) {
            products[index] = {
                ...products[index],
                name, category, brand, size, unitType,
                piecesPerBox, sftPerBox, price, stock, minStock, imageUrl,
                updatedAt: new Date().toISOString()
            };
        }
    } else {
        // Add new product
        const newProduct = {
            id: generateId(),
            name, category, brand, size, unitType,
            piecesPerBox, sftPerBox, price, stock, minStock, imageUrl,
            createdAt: new Date().toISOString()
        };
        products.push(newProduct);
    }
    
    saveProducts(products);
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
    modal.hide();
    
    // Refresh display
    displayProducts();
    updateSummary();
    loadProductsForSale();
    
    alert('✅ Product saved successfully!');
}

// Delete product
function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    let products = getProducts();
    products = products.filter(p => p.id !== id);
    saveProducts(products);
    
    displayProducts();
    updateSummary();
    loadProductsForSale();
    
    alert('✅ Product deleted successfully!');
}

// Search products
function searchProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const products = getProducts();
    
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        p.brand.toLowerCase().includes(searchTerm) ||
        p.category.toLowerCase().includes(searchTerm)
    );
    
    const productsList = document.getElementById('productsList');
    
    if (filtered.length === 0) {
        productsList.innerHTML = `
            <div class="col-12">
                <div class="empty-state">
                    <i class="bi bi-search"></i>
                    <h4>No Results Found</h4>
                    <p>Try different search terms</p>
                </div>
            </div>
        `;
        return;
    }
    
    productsList.innerHTML = '';
    
    filtered.forEach(product => {
        const stockClass = product.stock > product.minStock ? 'stock-good' : 
                          product.stock > 0 ? 'stock-low' : 'stock-out';
        
        const stockText = product.stock > product.minStock ? 'In Stock' : 
                         product.stock > 0 ? 'Low Stock' : 'Out of Stock';
        
        const imageUrl = product.imageUrl || 'https://via.placeholder.com/300x200?text=' + encodeURIComponent(product.name);
        
        const card = `
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="card product-card">
                    <img src="${imageUrl}" class="product-image" alt="${product.name}"
                         onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
                    <div class="card-body">
                        <h5 class="card-title">${product.name}</h5>
                        <p class="card-text text-muted mb-2">
                            <small>${product.category} ${product.brand ? '• ' + product.brand : ''}</small>
                        </p>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge stock-badge ${stockClass}">${stockText}</span>
                            <h5 class="mb-0">Stock: ${product.stock}</h5>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span>Price: <strong>₹${product.price}</strong>/${product.unitType}</span>
                        </div>
                        <div class="card-actions">
                            <button class="btn btn-primary btn-action" onclick="editProduct('${product.id}')">
                                <i class="bi bi-pencil"></i> Edit
                            </button>
                            <button class="btn btn-danger btn-action" onclick="deleteProduct('${product.id}')">
                                <i class="bi bi-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        productsList.innerHTML += card;
    });
}

