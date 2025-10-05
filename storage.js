// LocalStorage Operations for Tile Inventory App

// Get products from localStorage
function getProducts() {
    const products = localStorage.getItem('products');
    return products ? JSON.parse(products) : [];
}

// Save products to localStorage
function saveProducts(products) {
    localStorage.setItem('products', JSON.stringify(products));
}

// Get sales from localStorage
function getSales() {
    const sales = localStorage.getItem('sales');
    return sales ? JSON.parse(sales) : [];
}

// Save sales to localStorage
function saveSales(sales) {
    localStorage.setItem('sales', JSON.stringify(sales));
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Export data as JSON file
function exportData() {
    const data = {
        products: getProducts(),
        sales: getSales(),
        exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    alert('✅ Backup downloaded successfully!');
}

// Import data from JSON file
function importData() {
    document.getElementById('fileInput').click();
}

// Handle file import
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.products) {
                localStorage.setItem('products', JSON.stringify(data.products));
            }
            if (data.sales) {
                localStorage.setItem('sales', JSON.stringify(data.sales));
            }
            
            alert('✅ Data restored successfully!');
            location.reload();
        } catch (error) {
            alert('❌ Error: Invalid backup file!');
        }
    };
    reader.readAsText(file);
}
