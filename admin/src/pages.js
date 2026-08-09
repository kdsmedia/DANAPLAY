// Admin panel pages.
const AdminPages = {};

// ============ Login ============
AdminPages.login = {
  render: () => `<div class="login-screen"><div class="login-box">
    <h1>🎮 DANAPLAY Admin</h1><div class="sub">Panel administrasi reward platform</div>
    <form id="adminLoginForm">
      <div class="field"><label>Username</label><input name="username" required value="admin" /></div>
      <div class="field"><label>Password</label><input type="password" name="password" required value="admin123" /></div>
      <button class="btn btn-primary" style="width:100%;padding:11px">MASUK</button>
    </form>
    <div class="warn-box" style="margin-top:14px">DEMO: admin / admin123. Ganti password di production!</div>
  </div></div>`,
  mount: () => {
    document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        const data = await AdminAPI.auth.login({ username: f.get('username'), password: f.get('password') });
        AdminAPI.setToken(data.token);
        AdminApp.go('/admin/dashboard');
      } catch (err) { AUI.toast(err.message, 'error'); }
    });
  }
};

// ============ Dashboard ============
AdminPages.dashboard = {
  render: () => `<div class="main" id="dash-main">${AUI.loading()}</div>`,
  mount: async () => {
    const el = document.getElementById('dash-main');
    try {
      const d = await AdminAPI.dashboard();
      const providers = await AdminAPI.providers();
      el.innerHTML = `
        <div class="tophead"><div><h1>Dashboard</h1><div class="sub">Ringkasan platform DANAPLAY</div></div>
          <div>Attribution: ${AUI.providerTag(providers.attribution.mode)} &nbsp; Payout: ${AUI.providerTag(providers.payout.mode)}</div></div>
        <div class="card"><div class="card-title">Users</div>
          <div class="grid grid-4">
            <div class="stat"><div class="label">Total User</div><div class="value">${d.totalUsers}</div></div>
            <div class="stat"><div class="label">User Aktif</div><div class="value pos">${d.activeUsers}</div></div>
            <div class="stat"><div class="label">Campaign Aktif</div><div class="value">${d.activeCampaigns}</div></div>
            <div class="stat"><div class="label">Campaign Selesai</div><div class="value pos">${d.completedCampaigns}</div></div>
          </div></div>
        <div class="card"><div class="card-title">Poin</div>
          <div class="grid grid-3">
            <div class="stat"><div class="label">Poin Beredar</div><div class="value">${AUI.fmtPts(d.pointsInCirculation)}</div></div>
            <div class="stat"><div class="label">Poin Diperoleh</div><div class="value pos">${AUI.fmtPts(d.pointsEarned)}</div></div>
            <div class="stat"><div class="label">Poin Ditukar</div><div class="value warn">${AUI.fmtPts(d.pointsRedeemed)}</div></div>
          </div></div>
        <div class="card"><div class="card-title">Withdrawal</div>
          <div class="grid grid-4">
            <div class="stat"><div class="label">Total</div><div class="value">${d.totalWithdrawals}</div></div>
            <div class="stat"><div class="label">Pending</div><div class="value warn">${d.withdrawalsPending}</div></div>
            <div class="stat"><div class="label">Selesai</div><div class="value pos">${d.withdrawalsCompleted}</div></div>
            <div class="stat"><div class="label">Gagal</div><div class="value neg">${d.withdrawalsFailed}</div></div>
          </div></div>
        <div class="card"><div class="card-title">Fraud & Konfigurasi</div>
          <div class="grid grid-2">
            <div class="stat"><div class="label">Fraud Flag Open</div><div class="value ${d.fraudOpen ? 'neg' : ''}">${d.fraudOpen}</div></div>
            <div class="stat"><div class="label">Kurs (Poin/Rp)</div><div class="value">${d.pointsPerRupiah}</div></div>
          </div></div>
        <div class="warn-box">⚠️ Provider saat ini: ${providers.attribution.description}<br>${providers.payout.description}</div>`;
    } catch (err) { el.innerHTML = AUI.empty(err.message); }
  }
};

// ============ Users ============
AdminPages.users = {
  render: () => `<div class="main" id="users-main">${AUI.loading()}</div>`,
  mount: async () => {
    const el = document.getElementById('users-main');
    try {
      const data = await AdminAPI.users(100, 0);
      el.innerHTML = `
        <div class="tophead"><h1>Users</h1><div class="sub">${data.items.length} pengguna</div></div>
        <div class="card" style="overflow-x:auto"><table>
          <thead><tr><th>Nama</th><th>HP</th><th>Referral</th><th>Saldo</th><th>Campaign</th><th>Status</th><th>Dibuat</th><th>Aksi</th></tr></thead>
          <tbody>${data.items.map(u => `<tr>
            <td><b>${AUI.esc(u.name)}</b><br><span class="small muted">${u.id.slice(0,12)}</span></td>
            <td>${AUI.esc(u.phone)}</td>
            <td class="nowrap">${AUI.esc(u.referral_code)}</td>
            <td>${AUI.fmtPts(u.points_balance)}</td>
            <td>${u.active_campaigns} aktif / ${u.completed_campaigns} selesai</td>
            <td>${AUI.statusBadge(u.status)}</td>
            <td class="small">${AUI.fmtDate(u.created_at)}</td>
            <td class="nowrap">
              <button class="btn btn-outline btn-sm" onclick="AdminApp.viewUser('${u.id}')">Detail</button>
              <button class="btn btn-outline btn-sm" onclick="AdminApp.adjustPoints('${u.id}')">Adjust</button>
              ${u.status !== 'BANNED' ? `<button class="btn btn-danger btn-sm" onclick="AdminPages.users.ban('${u.id}')">Ban</button>` : `<button class="btn btn-success btn-sm" onclick="AdminPages.users.activate('${u.id}')">Activate</button>`}
            </td></tr>`).join('')}</tbody></table></div>`;
    } catch (err) { el.innerHTML = AUI.empty(err.message); }
  },
  ban: async (id) => {
    if (!await AUI.confirm('Ban user', 'Yakin banned user ini?')) return;
    try { await AdminAPI.setUserStatus(id, 'BANNED'); AUI.toast('User banned', 'success'); AdminApp.refresh(); }
    catch (e) { AUI.toast(e.message, 'error'); }
  },
  activate: async (id) => {
    try { await AdminAPI.setUserStatus(id, 'ACTIVE'); AUI.toast('User activated', 'success'); AdminApp.refresh(); }
    catch (e) { AUI.toast(e.message, 'error'); }
  }
};

// ============ Campaigns ============
AdminPages.campaigns = {
  render: () => `<div class="main" id="camp-main">${AUI.loading()}</div>`,
  mount: async () => {
    const el = document.getElementById('camp-main');
    try {
      const data = await AdminAPI.campaigns();
      el.innerHTML = `
        <div class="tophead"><div><h1>Campaigns</h1><div class="sub">${data.items.length} campaign</div></div>
          <button class="btn btn-primary" onclick="AdminApp.editCampaign()">+ Buat Campaign</button></div>
        <div class="card" style="overflow-x:auto"><table>
          <thead><tr><th>Title</th><th>Package</th><th>Required Days</th><th>Total Reward</th><th>Milestones</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>${data.items.map(c => `<tr>
            <td><b>${AUI.esc(c.title)}</b></td>
            <td class="small">${AUI.esc(c.package_name)}</td>
            <td>${c.required_days}</td>
            <td>${AUI.fmtPts(c.reward_total)}</td>
            <td>${c.milestones.length}</td>
            <td>${AUI.statusBadge(c.status)}</td>
            <td class="nowrap">
              <button class="btn btn-outline btn-sm" onclick="AdminApp.editCampaign('${c.id}')">Edit</button>
              ${c.status === 'ACTIVE' ? `<button class="btn btn-outline btn-sm" onclick="AdminPages.campaigns.status('${c.id}','PAUSED')">Pause</button>` : `<button class="btn btn-success btn-sm" onclick="AdminPages.campaigns.status('${c.id}','ACTIVE')">Activate</button>`}
              <button class="btn btn-outline btn-sm" onclick="AdminPages.campaigns.status('${c.id}','ARCHIVED')">Archive</button>
            </td></tr>`).join('')}</tbody></table></div>`;
    } catch (err) { el.innerHTML = AUI.empty(err.message); }
  },
  status: async (id, status) => {
    try { await AdminAPI.setCampaignStatus(id, status); AUI.toast('Status diubah', 'success'); AdminApp.refresh(); }
    catch (e) { AUI.toast(e.message, 'error'); }
  }
};

// ============ Campaign Users ============
AdminPages['campaign-users'] = {
  render: () => `<div class="main" id="cu-main">${AUI.loading()}</div>`,
  mount: async () => {
    const el = document.getElementById('cu-main');
    try {
      const data = await AdminAPI.campaignUsers(100, 0);
      el.innerHTML = `
        <div class="tophead"><h1>Campaign Users</h1><div class="sub">${data.items.length} enrollment</div></div>
        <div class="card" style="overflow-x:auto"><table>
          <thead><tr><th>User</th><th>Campaign</th><th>Status</th><th>Active Days</th><th>Install</th><th>First Open</th><th>Last Event</th><th>Tracking</th></tr></thead>
          <tbody>${data.items.map(c => `<tr>
            <td><b>${AUI.esc(c.user_name)}</b><br><span class="small muted">${c.user_phone}</span></td>
            <td>${AUI.esc(c.campaign_title)}</td>
            <td>${AUI.statusBadge(c.status)}</td>
            <td>${c.active_days}</td>
            <td class="small">${c.install_at ? AUI.fmtDate(c.install_at) : '-'}</td>
            <td class="small">${c.first_open_at ? AUI.fmtDate(c.first_open_at) : '-'}</td>
            <td class="small">${c.last_event_at ? AUI.fmtDate(c.last_event_at) : '-'}</td>
            <td class="small muted">${c.tracking_session_id.slice(0, 14)}…</td>
          </tr>`).join('')}</tbody></table></div>`;
    } catch (err) { el.innerHTML = AUI.empty(err.message); }
  }
};

// ============ Points ============
AdminPages.points = {
  render: () => `<div class="main" id="pt-main">${AUI.loading()}</div>`,
  mount: async () => {
    const el = document.getElementById('pt-main');
    try {
      const data = await AdminAPI.points(200, 0);
      el.innerHTML = `
        <div class="tophead"><h1>Point Transactions</h1><div class="sub">${data.items.length} transaksi (ledger)</div></div>
        <div class="warn-box">🔒 Transaksi tidak dapat dihapus permanen (audit trail). Adjust points via detail user.</div>
        <div class="card" style="overflow-x:auto"><table>
          <thead><tr><th>User</th><th>Type</th><th>Amount</th><th>Before</th><th>After</th><th>Description</th><th>Reference</th><th>Date</th></tr></thead>
          <tbody>${data.items.map(t => `<tr>
            <td><b>${AUI.esc(t.user_name)}</b><br><span class="small muted">${t.user_phone}</span></td>
            <td><span class="badge ${t.amount > 0 ? 'badge-active' : 'badge-failed'}">${t.type}</span></td>
            <td style="color:${t.amount > 0 ? 'var(--success)' : 'var(--danger)'};font-weight:700">${t.amount > 0 ? '+' : ''}${AUI.fmtPts(t.amount)}</td>
            <td>${AUI.fmtPts(t.balance_before)}</td>
            <td>${AUI.fmtPts(t.balance_after)}</td>
            <td class="small">${AUI.esc(t.description)}</td>
            <td class="small muted">${t.reference_type || '-'}</td>
            <td class="small">${AUI.fmtDate(t.created_at)}</td>
          </tr>`).join('')}</tbody></table></div>`;
    } catch (err) { el.innerHTML = AUI.empty(err.message); }
  }
};

// ============ Withdrawals ============
AdminPages.withdrawals = {
  render: () => `<div class="main" id="wd-main">${AUI.loading()}</div>`,
  mount: async () => {
    const el = document.getElementById('wd-main');
    try {
      const data = await AdminAPI.withdrawals(100, 0);
      el.innerHTML = `
        <div class="tophead"><h1>Withdrawals</h1><div class="sub">${data.items.length} penarikan</div></div>
        <div class="card" style="overflow:x:auto"><table>
          <thead><tr><th>User</th><th>Amount</th><th>Points</th><th>DANA</th><th>Status</th><th>Provider Ref</th><th>Failure</th><th>Date</th><th>Aksi</th></tr></thead>
          <tbody>${data.items.map(w => `<tr>
            <td><b>${AUI.esc(w.user_name)}</b><br><span class="small muted">${w.user_phone}</span></td>
            <td><b>${AUI.fmtRp(w.amount)}</b></td>
            <td>${AUI.fmtPts(w.points)}</td>
            <td class="small">${AUI.esc(w.destination)}</td>
            <td>${AUI.statusBadge(w.status)}</td>
            <td class="small muted">${AUI.esc(w.provider_reference || '-')}</td>
            <td class="small" style="color:var(--danger)">${AUI.esc(w.failure_reason || '')}</td>
            <td class="small">${AUI.fmtDate(w.created_at)}</td>
            <td class="nowrap">
              ${w.status === 'PENDING' || w.status === 'PROCESSING' ? `<button class="btn btn-success btn-sm" onclick="AdminPages.withdrawals.mark('${w.id}','COMPLETED')">Selesai</button><button class="btn btn-danger btn-sm" onclick="AdminPages.withdrawals.mark('${w.id}','FAILED')">Gagal</button>` : '-'}
            </td>
          </tr>`).join('')}</tbody></table></div>`;
    } catch (err) { el.innerHTML = AUI.empty(err.message); }
  },
  mark: async (id, status) => {
    const reason = status === 'FAILED' ? (prompt('Alasan kegagalan:', 'Manual admin mark failed') || '') : null;
    try {
      await AdminAPI.setWithdrawalStatus(id, status, reason);
      AUI.toast('Status diupdate. ' + (status === 'FAILED' ? 'Poin direfund.' : ''), 'success');
      AdminApp.refresh();
    } catch (e) { AUI.toast(e.message, 'error'); }
  }
};

// ============ Referrals ============
AdminPages.referrals = {
  render: () => `<div class="main" id="ref-main">${AUI.loading()}</div>`,
  mount: async () => {
    const el = document.getElementById('ref-main');
    try {
      const data = await AdminAPI.referrals();
      el.innerHTML = `
        <div class="tophead"><h1>Referrals</h1><div class="sub">${data.items.length} referral</div></div>
        <div class="warn-box">🎁 Bonus referral dibayar SETELAH invitee menyelesaikan campaign pertama. Anti self-referral & multi-account aktif.</div>
        <div class="card" style="overflow-x:auto"><table>
          <thead><tr><th>Inviter</th><th>Invitee</th><th>Code</th><th>Status</th><th>Bonus Inviter</th><th>Bonus Invitee</th><th>Date</th></tr></thead>
          <tbody>${data.items.map(r => `<tr>
            <td><b>${AUI.esc(r.inviter_name)}</b><br><span class="small muted">${r.inviter_phone}</span></td>
            <td><b>${AUI.esc(r.invitee_name)}</b><br><span class="small muted">${r.invitee_phone}</span></td>
            <td class="small">${AUI.esc(r.referral_code_used)}</td>
            <td>${AUI.statusBadge(r.status === 'BONUS_PAID' ? 'BONUS_PAID' : r.status)}</td>
            <td>${r.bonus_paid_at ? AUI.fmtPts(r.inviter_bonus) : '-'}</td>
            <td>${r.bonus_paid_at ? AUI.fmtPts(r.invitee_bonus) : '-'}</td>
            <td class="small">${AUI.fmtDate(r.created_at)}</td>
          </tr>`).join('')}</tbody></table></div>`;
    } catch (err) { el.innerHTML = AUI.empty(err.message); }
  }
};

// ============ Fraud ============
AdminPages.fraud = {
  render: () => `<div class="main" id="fr-main">${AUI.loading()}</div>`,
  mount: async () => {
    const el = document.getElementById('fr-main');
    try {
      const data = await AdminAPI.fraud();
      el.innerHTML = `
        <div class="tophead"><h1>Fraud Detection</h1><div class="sub">${data.items.length} flag</div></div>
        <div class="card" style="overflow-x:auto"><table>
          <thead><tr><th>User</th><th>Category</th><th>Severity</th><th>Details</th><th>Status</th><th>Date</th><th>Aksi</th></tr></thead>
          <tbody>${data.items.map(f => `<tr>
            <td class="small muted">${f.user_id ? f.user_id.slice(0,14) : '-'}</td>
            <td><b>${AUI.esc(f.category)}</b></td>
            <td>${AUI.statusBadge(f.severity === 'HIGH' ? 'FAILED' : f.severity === 'MEDIUM' ? 'PENDING' : 'COMPLETED')}</td>
            <td class="small">${AUI.esc(f.details ? JSON.stringify(f.details).slice(0,80) : '')}</td>
            <td>${AUI.statusBadge(f.status)}</td>
            <td class="small">${AUI.fmtDate(f.created_at)}</td>
            <td class="nowrap">
              ${f.status === 'OPEN' || f.status === 'REVIEWING' ? `
              <button class="btn btn-success btn-sm" onclick="AdminPages.fraud.set('${f.id}','RESOLVED')">Resolve</button>
              <button class="btn btn-outline btn-sm" onclick="AdminPages.fraud.set('${f.id}','DISMISSED')">Dismiss</button>` : '-'}
            </td>
          </tr>`).join('')}</tbody></table></div>`;
    } catch (err) { el.innerHTML = AUI.empty(err.message); }
  },
  set: async (id, status) => {
    try { await AdminAPI.setFraudStatus(id, status); AUI.toast('Updated', 'success'); AdminApp.refresh(); }
    catch (e) { AUI.toast(e.message, 'error'); }
  }
};

// ============ Audit Logs ============
AdminPages['audit-logs'] = {
  render: () => `<div class="main" id="al-main">${AUI.loading()}</div>`,
  mount: async () => {
    const el = document.getElementById('al-main');
    try {
      const data = await AdminAPI.auditLogs();
      el.innerHTML = `
        <div class="tophead"><h1>Audit Logs</h1><div class="sub">${data.items.length} entries (append-only)</div></div>
        <div class="warn-box">📋 Audit log tidak dapat dihapus. Semua aksi admin & sistem tercatat.</div>
        <div class="card" style="overflow-x:auto"><table>
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th><th>IP</th></tr></thead>
          <tbody>${data.items.map(a => `<tr>
            <td class="small nowrap">${AUI.fmtDate(a.created_at)}</td>
            <td class="small">${AUI.esc(a.actor_type)} ${a.actor_id ? a.actor_id.slice(0,10) : ''}</td>
            <td><b>${AUI.esc(a.action)}</b></td>
            <td class="small">${AUI.esc(a.target_type || '')} ${a.target_id ? a.target_id.slice(0,10) : ''}</td>
            <td class="small muted">${AUI.esc(a.details ? String(JSON.stringify(a.details)).slice(0, 100) : '')}</td>
            <td class="small muted">${AUI.esc(a.ip || '')}</td>
          </tr>`).join('')}</tbody></table></div>`;
    } catch (err) { el.innerHTML = AUI.empty(err.message); }
  }
};

// ============ Settings ============
AdminPages.settings = {
  render: () => `<div class="main" id="set-main">${AUI.loading()}</div>`,
  mount: async () => {
    const el = document.getElementById('set-main');
    try {
      const [data, providers] = await Promise.all([AdminAPI.settings(), AdminAPI.providers()]);
      const s = data.settings;
      el.innerHTML = `
        <div class="tophead"><h1>Settings</h1><div class="sub">Konfigurasi platform</div></div>
        <div class="card">
          <div class="card-title">Provider Integrasi</div>
          <div class="row between"><div>Attribution</div><div>${AUI.providerTag(providers.attribution.mode)} ${providers.attribution.name}</div></div>
          <div class="row between" style="margin-top:8px"><div>Payout (DANA)</div><div>${AUI.providerTag(providers.payout.mode)} ${providers.payout.name}</div></div>
          <div class="small muted" style="margin-top:8px">${providers.attribution.description}</div>
          <div class="small muted">${providers.payout.description}</div>
        </div>
        <div class="card">
          <div class="card-title">Kurs & Nominal</div>
          <div class="row between"><b>Points per Rupiah</b><span>${data.pointsPerRupiah} (1 Rp = ${data.pointsPerRupiah} poin)</span></div>
          <div class="row between" style="margin-top:6px"><b>Withdrawal Denominations</b><span>${data.withdrawalDenominations.map(AUI.fmtRp).join(', ')}</span></div>
          <div class="small muted" style="margin-top:8px">Diatur via env var POINTS_PER_RUPIAH & WITHDRAWAL_DENOMINATIONS. Restart untuk apply.</div>
        </div>
        <div class="card">
          <div class="card-title">Referral Settings</div>
          ${['referral_bonus_inviter', 'referral_bonus_invitee', 'referral_qualify_first_campaign', 'campaign_timezone', 'withdrawal_min_points'].map(k => `
            <div class="field"><label>${k}</label><input id="set-${k}" value="${AUI.esc(s[k] || '')}" /></div>`).join('')}
          <button class="btn btn-primary" onclick="AdminPages.settings.save()">Simpan</button>
        </div>`;
    } catch (err) { el.innerHTML = AUI.empty(err.message); }
  },
  save: async () => {
    try {
      for (const k of ['referral_bonus_inviter', 'referral_bonus_invitee', 'referral_qualify_first_campaign', 'campaign_timezone', 'withdrawal_min_points']) {
        await AdminAPI.setSetting(k, document.getElementById('set-' + k).value);
      }
      AUI.toast('Settings disimpan', 'success');
    } catch (e) { AUI.toast(e.message, 'error'); }
  }
};
