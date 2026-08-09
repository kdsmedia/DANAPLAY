// DANAPLAY mobile API client.
const API = (function () {
  const BASE = ''; // same origin; backend proxies /api
  let token = localStorage.getItem('dp_token') || null;

  function setToken(t) { token = t; if (t) localStorage.setItem('dp_token', t); else localStorage.removeItem('dp_token'); }
  function getToken() { return token; }

  async function call(method, path, { body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!res.ok) {
      const err = new Error(json.error || ('HTTP ' + res.status));
      err.status = res.status; err.body = json;
      throw err;
    }
    return json.data;
  }

  return {
    setToken, getToken,
    auth: {
      register: (b) => call('POST', '/api/auth/register', { body: b, auth: false }),
      login: (b) => call('POST', '/api/auth/login', { body: b, auth: false }),
      me: () => call('GET', '/api/auth/me'),
      logout: () => call('POST', '/api/auth/logout'),
    },
    user: {
      updateProfile: (name) => call('PUT', '/api/user/profile', { body: { name } }),
      changePassword: (b) => call('POST', '/api/user/change-password', { body: b }),
    },
    points: {
      balance: () => call('GET', '/api/points/balance'),
      transactions: (limit = 100, offset = 0, type = '') => call('GET', `/api/points/transactions?limit=${limit}&offset=${offset}&type=${type}`),
    },
    campaigns: {
      list: () => call('GET', '/api/campaigns'),
      get: (id) => call('GET', '/api/campaigns/' + id),
      click: (id) => call('POST', `/api/campaigns/${id}/click`),
      myActive: () => call('GET', '/api/campaigns/my/active'),
      myDetail: (id) => call('GET', '/api/campaigns/my/' + id),
    },
    withdrawals: {
      denominations: () => call('GET', '/api/withdrawals/denominations'),
      create: (b) => call('POST', '/api/withdrawals', { body: b }),
      list: (limit = 50, offset = 0) => call('GET', `/api/withdrawals?limit=${limit}&offset=${offset}`),
    },
    referrals: { list: () => call('GET', '/api/referrals') },
    notifications: { list: () => call('GET', '/api/notifications'), markRead: (id) => call('POST', '/api/notifications/' + id + '/read') },
  };
})();
