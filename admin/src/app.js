// Admin app bootstrap + router + helpers.
const AdminApp = (function () {
  const NAV = [
    { key: 'dashboard', ic: '📊', label: 'Dashboard', path: '/admin/dashboard' },
    { key: 'users', ic: '👥', label: 'Users', path: '/admin/users' },
    { key: 'campaigns', ic: '🎯', label: 'Campaigns', path: '/admin/campaigns' },
    { key: 'campaign-users', ic: '🔗', label: 'Campaign User', path: '/admin/campaign-users' },
    { key: 'points', ic: '💰', label: 'Point Transactions', path: '/admin/points' },
    { key: 'withdrawals', ic: '💸', label: 'Withdrawals', path: '/admin/withdrawals' },
    { key: 'referrals', ic: '🎁', label: 'Referrals', path: '/admin/referrals' },
    { key: 'fraud', ic: '🛡️', label: 'Fraud Detection', path: '/admin/fraud' },
    { key: 'audit-logs', ic: '📋', label: 'Audit Logs', path: '/admin/audit-logs' },
    { key: 'settings', ic: '⚙️', label: 'Settings', path: '/admin/settings' },
  ];

  function currentPath() { return location.hash.replace(/^#/, '') || '/admin/dashboard'; }

  function render() {
    const path = currentPath();
    const app = document.getElementById('app');
    const isAuth = !!AdminAPI.getToken();
    if (!isAuth || path === '/admin' || path === '/admin/login') {
      if (isAuth) { location.hash = '/admin/dashboard'; return; }
      app.innerHTML = AdminPages.login.render();
      AdminPages.login.mount();
      return;
    }
    const page = NAV.find(n => n.path === path);
    if (!page) { app.innerHTML = `<div class="main"><h1>404</h1><p class="muted">Halaman tidak ditemukan. <a href="#/admin/dashboard">Dashboard</a></p></div>`; return; }
    const sidebar = `<aside class="sidebar">
      <div class="brand">🎮 DANAPLAY<small>Admin Panel</small></div>
      ${NAV.map(n => `<a href="#${n.path}" class="${n.key === page.key ? 'active' : ''}"><span class="ic">${n.ic}</span><span>${n.label}</span></a>`).join('')}
      <div style="margin-top:auto;padding:12px 20px;border-top:1px solid rgba(255,255,255,.1);margin-top:24px">
        <button class="btn btn-outline" style="width:100%;color:#fff;border-color:rgba(255,255,255,.3)" onclick="AdminApp.logout()">Logout</button>
      </div>
    </aside>`;
    app.innerHTML = `<div class="layout">${sidebar}<div id="page-host"></div></div>`;
    const host = document.getElementById('page-host');
    const P = AdminPages[page.key];
    host.innerHTML = P.render();
    P.mount();
  }

  return {
    init: () => { window.addEventListener('hashchange', render); render(); },
    go: (p) => { location.hash = p; },
    refresh: () => render(),
    logout: () => { AdminAPI.setToken(null); location.hash = '/admin/login'; render(); },
    viewUser: async (id) => {
      try {
        const data = await AdminAPI.user(id);
        const { close, el } = AUI.modal(`
          <h3>${AUI.esc(data.user.name)}</h3>
          <div class="muted small" style="margin-bottom:14px">${AUI.esc(data.user.phone)} · ${AUI.esc(data.user.referral_code)}</div>
          <div class="grid grid-2">
            <div class="stat"><div class="label">Saldo</div><div class="value">${AUI.fmtPts(data.user.points_balance)}</div></div>
            <div class="stat"><div class="label">Status</div><div class="value">${AUI.statusBadge(data.user.status)}</div></div>
          </div>
          <div style="margin-top:12px"><b>Point Ledger (recent ${data.transactions.length})</b></div>
          <table style="margin-top:6px"><thead><tr><th>Type</th><th>Amount</th><th>After</th><th>Date</th></tr></thead>
          <tbody>${data.transactions.slice(0,20).map(t => `<tr><td>${t.type}</td><td>${t.amount>0?'+':''}${AUI.fmtPts(t.amount)}</td><td>${AUI.fmtPts(t.balance_after)}</td><td class="small">${AUI.fmtDate(t.created_at)}</td></tr>`).join('')}</tbody></table>
          <div style="margin-top:12px"><b>Campaigns (${data.campaigns.length})</b></div>
          <table style="margin-top:6px"><thead><tr><th>Campaign</th><th>Status</th><th>Days</th></tr></thead>
          <tbody>${data.campaigns.slice(0,15).map(c => `<tr><td>${AUI.esc(c.title)}</td><td>${AUI.statusBadge(c.status)}</td><td>${c.active_days}/${c.required_days}</td></tr>`).join('')}</tbody></table>`);
      } catch (e) { AUI.toast(e.message, 'error'); }
    },
    adjustPoints: async (id) => {
      const { close, el } = AUI.modal(`
        <h3>Adjust Points</h3>
        <div class="muted small" style="margin-bottom:14px">User: ${id.slice(0,14)}…</div>
        <div class="field"><label>Amount (+/-)</label><input type="number" id="adj-amt" placeholder="e.g. 50000 atau -50000" /></div>
        <div class="field"><label>Description</label><input id="adj-desc" placeholder="Alasan adjustment" /></div>
        <div class="row" style="justify-content:flex-end">
          <button class="btn btn-outline" data-c>Batal</button>
          <button class="btn btn-primary" data-o>Adjust</button>
        </div>`);
      el.querySelector('[data-c]').onclick = close;
      el.querySelector('[data-o]').onclick = async () => {
        const amt = Number(el.querySelector('#adj-amt').value);
        const desc = el.querySelector('#adj-desc').value;
        if (!amt || !desc) { AUI.toast('Isi amount & description', 'error'); return; }
        try { await AdminAPI.adjustPoints(id, amt, desc); close(); AUI.toast('Points adjusted', 'success'); AdminApp.refresh(); }
        catch (e) { AUI.toast(e.message, 'error'); }
      };
    },
    editCampaign: async (id) => {
      let campaign = null;
      if (id) {
        const data = await AdminAPI.campaigns();
        campaign = data.items.find(c => c.id === id);
      }
      const ms = campaign ? campaign.milestones : [];
      const { close, el } = AUI.modal(`
        <h3>${id ? 'Edit Campaign' : 'Buat Campaign'}</h3>
        <div class="field"><label>Title</label><input id="c-title" value="${campaign ? AUI.esc(campaign.title) : ''}" /></div>
        <div class="field"><label>Description</label><textarea id="c-desc" rows="3">${campaign ? AUI.esc(campaign.description) : ''}</textarea></div>
        <div class="grid grid-2">
          <div class="field"><label>Icon (emoji)</label><input id="c-icon" value="${campaign ? AUI.esc(campaign.icon) : '🎮'}" /></div>
          <div class="field"><label>Package Name</label><input id="c-pkg" value="${campaign ? AUI.esc(campaign.package_name) : ''}" /></div>
        </div>
        <div class="field"><label>Store URL (Google Play)</label><input id="c-store" value="${campaign ? AUI.esc(campaign.store_url) : ''}" /></div>
        <div class="field"><label>Tracking URL</label><input id="c-track" value="${campaign ? AUI.esc(campaign.tracking_url) : ''}" /></div>
        <div class="grid grid-3">
          <div class="field"><label>Required Days</label><input type="number" id="c-days" value="${campaign ? campaign.required_days : 15}" /></div>
          <div class="field"><label>Reward Total</label><input type="number" id="c-reward" value="${campaign ? campaign.reward_total : 0}" /></div>
          <div class="field"><label>Status</label><select id="c-status">
            ${['ACTIVE','PAUSED','DRAFT','ARCHIVED'].map(s => `<option ${campaign && campaign.status===s?'selected':''}>${s}</option>`).join('')}
          </select></div>
        </div>
        <div class="card-title" style="margin-top:8px">Milestones</div>
        <div id="ms-list"></div>
        <button class="btn btn-outline btn-sm" onclick="AdminApp.addMilestoneRow()">+ Tambah Milestone</button>
        <div class="row" style="justify-content:flex-end;margin-top:16px">
          <button class="btn btn-outline" data-c>Batal</button>
          <button class="btn btn-primary" data-o>${id ? 'Update' : 'Buat'}</button>
        </div>`);
      const msList = el.querySelector('#ms-list');
      function addMs(m = {}) {
        const row = document.createElement('div');
        row.className = 'row'; row.style.marginBottom = '6px';
        row.innerHTML = `<input placeholder="ID (INSTALL)" data-ms="id" value="${m.milestone_id||''}" style="flex:1">
          <input placeholder="Label" data-ms="label" value="${AUI.esc(m.label||'')}" style="flex:1.5">
          <input type="number" placeholder="Day" data-ms="day" value="${m.day??0}" style="width:80px">
          <input type="number" placeholder="Reward" data-ms="reward" value="${m.reward_points??0}" style="width:100px">
          <button class="btn btn-outline btn-sm" onclick="this.parentElement.remove()">✕</button>`;
        msList.appendChild(row);
      }
      window.AdminApp.addMilestoneRow = () => addMs();
      ms.forEach(m => addMs(m));
      el.querySelector('[data-c]').onclick = close;
      el.querySelector('[data-o]').onclick = async () => {
        const milestones = [...msList.querySelectorAll('.row')].map((r, i) => ({
          milestone_id: r.querySelector('[data-ms="id"]').value,
          label: r.querySelector('[data-ms="label"]').value,
          day: Number(r.querySelector('[data-ms="day"]').value),
          reward_points: Number(r.querySelector('[data-ms="reward"]').value),
          sort_order: i,
        })).filter(m => m.milestone_id && m.label);
        const body = {
          title: el.querySelector('#c-title').value,
          description: el.querySelector('#c-desc').value,
          icon: el.querySelector('#c-icon').value,
          package_name: el.querySelector('#c-pkg').value,
          store_url: el.querySelector('#c-store').value,
          tracking_url: el.querySelector('#c-track').value,
          required_days: Number(el.querySelector('#c-days').value),
          reward_total: Number(el.querySelector('#c-reward').value),
          status: el.querySelector('#c-status').value,
          milestones,
        };
        try {
          if (id) await AdminAPI.updateCampaign(id, body); else await AdminAPI.createCampaign(body);
          close(); AUI.toast('Campaign disimpan', 'success'); AdminApp.refresh();
        } catch (e) { AUI.toast(e.message, 'error'); }
      };
    },
  };
})();

document.addEventListener('DOMContentLoaded', () => AdminApp.init());
