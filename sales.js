// Sales Management Functions

// Load products for sale dropdown
function loadProductsForSale() {
    const products = getProducts();
    const select = document.getElementById('saleProduct');
    
    select.innerHTML = '<option value="">Choose product...</option>';
    
    products.forEach(product => {
        if (product.stock > 0) {
            select.innerHTML += `
                <option value="${product.id}">
                    ${product.name} (Stock: ${product.stock} ${product.unitType})
                </option>
            `;
        }
    });
}

// Show sales modal
function showSalesSection() {
    loadProductsForSale();
    document.getElementById('salesForm').reset();
    document.getElementById('saleTotal').textContent = '₹0';
    document.getElementById('saleUnitPrice').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('salesModal'));
    modal.show();
}

// Update sale price when product or quantity changes
function updateSalePrice() {
    const productId = document.getElementById('saleProduct').value;
    const quantity = parseInt(document.getElementById('saleQuantity').value) || 0;
    
    if (!productId || quantity <= 0) {
        document.getElementById('saleTotal').textContent = '₹0';
        document.getElementById('saleUnitPrice').value = '';
        return;
    }
    
    const products = getProducts();
    const product = products.find(p => p.id === productId);
    
    if (!product) return;
    
    // Check if quantity exceeds stock
    if (quantity > product.stock) {
        alert(`❌ Only ${product.stock} ${product.unitType} available in stock!`);
        document.getElementById('saleQuantity').value = product.stock;
        return;
    }
    
    const total = product.price * quantity;
    document.getElementById('saleTotal').textContent = '₹' + total.toFixed(2);
    document.getElementById('saleUnitPrice').value = '₹' + product.price + '/' + product.unitType;
}

// Record sale
function recordSale() {
    const productId = document.getElementById('saleProduct').value;
    const quantity = parseInt(document.getElementById('saleQuantity').value);
    
    if (!productId || !quantity || quantity <= 0) {
        alert('❌ Please select product and enter quantity!');
        return;
    }
    
    const products = getProducts();
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
        alert('❌ Product not found!');
        return;
    }
    
    const product = products[productIndex];
    
    // Check stock
    if (quantity > product.stock) {
        alert(`❌ Insufficient stock! Only ${product.stock} available.`);
        return;
    }
    
    // Calculate total
    const total = product.price * quantity;
    
    // Create sale record
    const sale = {
        id: generateId(),
        productId: product.id,
        productName: product.name,
        quantity: quantity,
        unitType: product.unitType,
        unitPrice: product.price,
        totalAmount: total,
        date: new Date().toISOString()
    };
    
    // Save sale
    const sales = getSales();
    sales.unshift(sale); // Add to beginning of array
    saveSales(sales);
    
    // Update product stock
    products[productIndex].stock -= quantity;
    saveProducts(products);
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('salesModal'));
    modal.hide();
    
    // Refresh displays
    displayProducts();
    displaySales();
    updateSummary();
    
    alert(`✅ Sale recorded successfully!\nTotal: ₹${total.toFixed(2)}`);
}

// Display recent sales
function displaySales() {
    const sales = getSales();
    const salesList = document.getElementById('salesList');
    
    if (sales.length === 0) {
        salesList.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-4">
                    No sales recorded yet
                </td>
            </tr>
        `;
        return;
    }
    
    salesList.innerHTML = '';
    
    // Show last 10 sales
    const recentSales = sales.slice(0, 10);
    
    recentSales.forEach(sale => {
        const date = new Date(sale.date);
        const formattedDate = date.toLocaleDateString('en-IN') + ' ' + 
                             date.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'});
        
        const row = `
            <tr>
                <td>${formattedDate}</td>
                <td>${sale.productName}</td>
                <td>${sale.quantity}</td>
                <td>${sale.unitType}</td>
                <td class="text-success fw-bold">₹${sale.totalAmount.toFixed(2)}</td>
            </tr>
        `;
        
        salesList.innerHTML += row;
    });
}
