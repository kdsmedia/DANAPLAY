// Hash-based router for DANAPLAY mobile.
const Router = (function () {
  function parseHash() {
    const h = location.hash.replace(/^#/, '') || '/home';
    const parts = h.split('/').filter(Boolean); // ['campaign', ':id']
    return h;
  }
  function matchRoute(hash) {
    const routes = [
      { p: '/splash', page: 'splash' },
      { p: '/login', page: 'login' },
      { p: '/register', page: 'register' },
      { p: '/home', page: 'home' },
      { p: '/campaigns', page: 'campaigns' },
      { p: '/campaign/:id/progress', page: 'campaign/:id/progress' },
      { p: '/campaign/:id', page: 'campaign/:id' },
      { p: '/my-campaigns', page: 'my-campaigns' },
      { p: '/redeem', page: 'redeem' },
      { p: '/history', page: 'history' },
      { p: '/referral', page: 'referral' },
      { p: '/notifications', page: 'notifications' },
      { p: '/profile', page: 'profile' },
      { p: '/change-password', page: 'change-password' },
    ];
    for (const r of routes) {
      const params = matchSegments(r.p, hash);
      if (params) return { page: r.page, params };
    }
    return { page: 'home', params: {} };
  }
  function matchSegments(pattern, hash) {
    const pp = pattern.split('/').filter(Boolean);
    const hp = hash.split('/').filter(Boolean);
    if (pp.length !== hp.length) return null;
    const params = {};
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(hp[i]);
      else if (pp[i] !== hp[i]) return null;
    }
    return params;
  }

  const AUTH_PAGES = ['/login', '/register', '/splash'];
  function render() {
    const hash = parseHash();
    const { page, params } = matchRoute(hash);
    const app = document.getElementById('app');
    // Auth guard
    const isAuth = !!API.getToken();
    if (!isAuth && !AUTH_PAGES.includes(hash) && page !== 'splash') {
      location.hash = '/login'; return;
    }
    if (isAuth && AUTH_PAGES.includes(hash) && page !== 'splash') {
      location.hash = '/home'; return;
    }
    const P = Pages[page];
    if (!P) { app.innerHTML = UI.empty('❌', '404', 'Halaman tidak ditemukan'); return; }
    app.innerHTML = P.render(params);
    window.scrollTo(0, 0);
    if (P.mount) P.mount(params);
    // bottom nav links use href="#/path" — hashchange handles the rest
  }

  return {
    init: () => { window.addEventListener('hashchange', render); render(); },
    go: (path) => { if (location.hash === '#' + path) { render(); } else location.hash = path; },
    refresh: () => render(),
  };
})();
