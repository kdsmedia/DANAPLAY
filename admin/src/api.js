// Admin API client.
const AdminAPI = (function () {
  let token = localStorage.getItem('dp_admin_token') || null;
  function setToken(t) { token = t; if (t) localStorage.setItem('dp_admin_token', t); else localStorage.removeItem('dp_admin_token'); }
  function getToken() { return token; }
  async function call(method, path, { body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!res.ok) { const e = new Error(json.error || ('HTTP ' + res.status)); e.status = res.status; e.body = json; throw e; }
    return json.data;
  }
  return {
    setToken, getToken,
    auth: { login: (b) => call('POST', '/api/admin/auth/login', { body: b, }), me: () => call('GET', '/api/admin/auth/me') },
    dashboard: () => call('GET', '/api/admin/dashboard'),
    users: (limit = 50, offset = 0) => call('GET', `/api/admin/users?limit=${limit}&offset=${offset}`),
    user: (id) => call('GET', '/api/admin/users/' + id),
    setUserStatus: (id, status) => call('PATCH', '/api/admin/users/' + id + '/status', { body: { status } }),
    adjustPoints: (id, amount, description) => call('POST', '/api/admin/users/' + id + '/adjust-points', { body: { amount, description } }),
    campaigns: () => call('GET', '/api/admin/campaigns'),
    createCampaign: (b) => call('POST', '/api/admin/campaigns', { body: b }),
    updateCampaign: (id, b) => call('PUT', '/api/admin/campaigns/' + id, { body: b }),
    setCampaignStatus: (id, status) => call('PATCH', '/api/admin/campaigns/' + id + '/status', { body: { status } }),
    campaignUsers: (limit = 50, offset = 0) => call('GET', `/api/admin/campaign-users?limit=${limit}&offset=${offset}`),
    points: (limit = 100, offset = 0) => call('GET', `/api/admin/points?limit=${limit}&offset=${offset}`),
    withdrawals: (limit = 100, offset = 0) => call('GET', `/api/admin/withdrawals?limit=${limit}&offset=${offset}`),
    setWithdrawalStatus: (id, status, failureReason) => call('PATCH', '/api/admin/withdrawals/' + id + '/status', { body: { status, failureReason } }),
    referrals: () => call('GET', '/api/admin/referrals'),
    fraud: (status, category) => call('GET', `/api/admin/fraud?status=${status || ''}&category=${category || ''}`),
    setFraudStatus: (id, status) => call('PATCH', '/api/admin/fraud/' + id, { body: { status } }),
    auditLogs: (action, targetType) => call('GET', `/api/admin/audit-logs?action=${action || ''}&targetType=${targetType || ''}`),
    settings: () => call('GET', '/api/admin/settings'),
    setSetting: (key, value) => call('PUT', '/api/admin/settings', { body: { key, value } }),
    providers: () => call('GET', '/api/admin/providers'),
  };
})();
