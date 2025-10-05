/* js/app.js
   Main Tile Inventory App Core
   - Initializes app environment
   - Provides global helpers (logging, toast, navigation)
   - No login, no session checks
*/

(() => {
  console.info('Tile Inventory App initializing (no login mode)...');

  // ---------- Toast Helper ----------
  function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.position = 'fixed';
      container.style.bottom = '1rem';
      container.style.right = '1rem';
      container.style.zIndex = '9999';
      document.body.appendChild(container);
    }

    const div = document.createElement('div');
    div.className = `alert alert-${type} shadow-sm fade show`;
    div.textContent = message;
    container.appendChild(div);

    setTimeout(() => {
      div.classList.remove('show');
      div.classList.add('hide');
      setTimeout(() => div.remove(), 300);
    }, duration);
  }

  // ---------- Simple Router ----------
  function navigateTo(page) {
    console.log('Navigating to:', page);
    window.location.href = page;
  }

  // ---------- App Boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    console.log('App ready.');
    showToast('Welcome to Tile Inventory', 'primary', 1500);
  });

  // ---------- Expose Globals ----------
  window.tiaApp = {
    showToast,
    navigateTo
  };
})();
