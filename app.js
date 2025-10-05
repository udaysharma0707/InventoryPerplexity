// Main Application Logic

// Update summary cards
function updateSummary() {
    const products = getProducts();
    const sales = getSales();
    
    // Total products
    document.getElementById('totalProducts').textContent = products.length;
    
    // Sales today
    const today = new Date().toDateString();
    const todaySales = sales.filter(sale => {
        const saleDate = new Date(sale.date).toDateString();
        return saleDate === today;
    });
    
    const totalSalesToday = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    document.getElementById('salesToday').textContent = '₹' + totalSalesToday.toFixed(2);
    
    // Low stock items
    const lowStockItems = products.filter(p => p.stock <= p.minStock && p.stock > 0);
    document.getElementById('lowStock').textContent = lowStockItems.length;
}

// Initialize app when page loads
window.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Tile & Sanitaryware Inventory App Loaded');
    
    // Display all data
    displayProducts();
    displaySales();
    updateSummary();
    loadProductsForSale();
    
    // Add sample data if no products exist (for first time users)
    const products = getProducts();
    if (products.length === 0) {
        addSampleData();
    }
});

// Add sample data for demo
function addSampleData() {
    const sampleProducts = [
        {
            id: generateId(),
            name: 'Glossy Floor Tile',
            category: 'Tiles',
            brand: 'Kajaria',
            size: '2x2 feet',
            unitType: 'Box',
            piecesPerBox: 4,
            sftPerBox: 16,
            price: 800,
            stock: 50,
            minStock: 10,
            imageUrl: '',
            createdAt: new Date().toISOString()
        },
        {
            id: generateId(),
            name: 'Wall Mounted Basin',
            category: 'Sanitaryware',
            brand: 'Hindware',
            size: 'Standard',
            unitType: 'Piece',
            piecesPerBox: 1,
            sftPerBox: 0,
            price: 3500,
            stock: 15,
            minStock: 5,
            imageUrl: '',
            createdAt: new Date().toISOString()
        },
        {
            id: generateId(),
            name: 'Bathroom Faucet',
            category: 'Accessories',
            brand: 'Jaquar',
            size: 'Medium',
            unitType: 'Piece',
            piecesPerBox: 1,
            sftPerBox: 0,
            price: 1200,
            stock: 8,
            minStock: 5,
            imageUrl: '',
            createdAt: new Date().toISOString()
        }
    ];
    
    saveProducts(sampleProducts);
    displayProducts();
    updateSummary();
    loadProductsForSale();
    
    console.log('✅ Sample data added');
}
