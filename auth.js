/* js/auth.js — No-login friendly (handles enterBtn / enterApp) */
(() => {
  const redirectPath = 'products.html';

  function createDevSessionAndGo() {
    try {
      if (!sessionStorage.getItem('tia_session')) {
        const devUser = { id: 'dev_admin_' + Date.now(), username: 'dev-admin', role: 'admin', createdAt: new Date().toISOString() };
        sessionStorage.setItem('tia_session', JSON.stringify(devUser));
        localStorage.setItem('tia_remember', devUser.username);
      }
    } catch (e) {
      console.warn('createDevSessionAndGo error', e);
    }
    window.location.href = redirectPath;
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Wire either button id if present
    const b1 = document.getElementById('enterBtn');
    const b2 = document.getElementById('enterApp');
    if (b1) b1.addEventListener('click', createDevSessionAndGo);
    if (b2) b2.addEventListener('click', createDevSessionAndGo);

    // Expose minimal tiaAuth for pages that call it
    window.tiaAuth = {
      isAuthenticated: () => true,
      getSession: () => {
        try {
          const raw = sessionStorage.getItem('tia_session');
          if (raw) return JSON.parse(raw);
        } catch(e){}
        return { id:'guest', username:'Guest', role:'viewer', createdAt:new Date().toISOString() };
      },
      logout: () => { sessionStorage.removeItem('tia_session'); window.location.href = 'index.html'; }
    };
  });
})();
