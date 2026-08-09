// Global app store / state.
const Store = (function () {
  const state = { user: null, balance: null, notificationsUnread: 0 };
  const listeners = new Set();
  function emit() { listeners.forEach(fn => fn(state)); }
  return {
    get: () => state,
    setUser: (u) => { state.user = u; emit(); },
    setBalance: (b) => { state.balance = b; emit(); },
    setUnread: (n) => { state.notificationsUnread = n; emit(); },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    reset: () => { state.user = null; state.balance = null; API.setToken(null); emit(); },
  };
})();
