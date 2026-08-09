// DANAPLAY mobile pages. Each page exports a render function returning HTML,
// and an optional mount() for event binding / data loading.

const Pages = {};

// ============ Splash ============
Pages.splash = {
  render: () => `<div class="splash"><div class="logo">🎮</div><div class="title">DANAPLAY</div><div class="tag">Dapatkan reward, tukar ke DANA</div></div>`,
  mount: async () => {
    await new Promise(r => setTimeout(r, 900));
    if (API.getToken()) {
      try { const me = await API.auth.me(); Store.setUser(me.user); Router.go('/home'); return; }
      catch { Store.reset(); }
    }
    Router.go('/login');
  }
};

// ============ Login ============
Pages.login = {
  render: () => `
    <div class="screen" style="padding-top: 60px;">
      <div class="center" style="margin-bottom: 32px;">
        <div style="font-size:48px">🎮</div>
        <h1 style="font-size:26px;font-weight:800;margin-top:8px">DANAPLAY</h1>
        <p class="muted small">Masuk untuk mulai dapatkan reward</p>
      </div>
      <div class="card">
        <form id="loginForm">
          <div class="field"><label>Nomor HP</label><input type="tel" name="phone" placeholder="08xxxxxxxxxx" inputmode="numeric" required /></div>
          <div class="field"><label>Password</label><input type="password" name="password" placeholder="Password" required /></div>
          <button type="submit" class="btn btn-primary btn-block btn-lg">MASUK</button>
        </form>
        <div class="divider"></div>
        <div class="center small muted">Belum punya akun? <a class="link" href="#/register">Daftar sekarang</a></div>
      </div>
      <div class="center" style="margin-top:24px"><span class="badge badge-pending">DEMO · 081234567890 / password123</span></div>
    </div>`,
  mount: () => {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        const data = await API.auth.login({ phone: f.get('phone'), password: f.get('password') });
        API.setToken(data.token); Store.setUser(data.user);
        UI.toast('Selamat datang, ' + data.user.name + '!', 'success');
        Router.go('/home');
      } catch (err) { UI.toast(err.message, 'error'); }
    });
  }
};

// ============ Register ============
Pages.register = {
  render: () => `
    <div class="screen" style="padding-top: 40px;">
      <div class="center" style="margin-bottom: 24px;">
        <div style="font-size:40px">🎮</div>
        <h1 style="font-size:22px;font-weight:800;margin-top:6px">Buat Akun Baru</h1>
        <p class="muted small">Daftar untuk mulai kumpulkan poin</p>
      </div>
      <div class="card">
        <form id="regForm">
          <div class="field"><label>Nama Lengkap</label><input type="text" name="name" placeholder="Nama Anda" required /></div>
          <div class="field"><label>Nomor HP</label><input type="tel" name="phone" placeholder="08xxxxxxxxxx" inputmode="numeric" required /><div class="hint">Format: 08xxxxxxxxxx</div></div>
          <div class="field"><label>Password</label><input type="password" name="password" placeholder="Min. 8 karakter" required /><div class="hint">Minimal 8 karakter</div></div>
          <div class="field"><label>Kode Referral <span class="muted small">(opsional)</span></label><input type="text" name="referralCode" placeholder="Contoh: ABC1234" style="text-transform:uppercase" /></div>
          <button type="submit" class="btn btn-primary btn-block btn-lg">DAFTAR</button>
        </form>
        <div class="divider"></div>
        <div class="center small muted">Sudah punya akun? <a class="link" href="#/login">Masuk</a></div>
      </div>
    </div>`,
  mount: () => {
    document.getElementById('regForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const body = { name: f.get('name'), phone: f.get('phone'), password: f.get('password') };
      const rc = (f.get('referralCode') || '').trim().toUpperCase();
      if (rc) body.referralCode = rc;
      try {
        const data = await API.auth.register(body);
        API.setToken(data.token); Store.setUser(data.user);
        UI.toast('Pendaftaran berhasil!', 'success');
        Router.go('/home');
      } catch (err) { UI.toast(err.message, 'error'); }
    });
  }
};

// ============ Home ============
Pages.home = {
  render: () => {
    const u = Store.get().user;
    const b = Store.get().balance;
    const pts = b ? b.points : (u ? u.points_balance : 0);
    const rp = b ? b.rupiah : (u ? Math.floor(u.points_balance / 1000) : 0);
    return `
    <div class="topbar">
      <div class="topbar-row">
        <div><h1>Halo, ${UI.escape((u && u.name) || 'User')}</h1><div class="sub">Selamat datang di DANAPLAY 🎮</div></div>
        <button class="bell" onclick="Router.go('/notifications')">${Store.get().notificationsUnread ? '<span class="dot"></span>' : ''}🔔</button>
      </div>
      <div class="balance-card">
        <div class="label">Saldo Poin</div>
        <div class="points"><span class="star">⭐</span> ${UI.fmtPts(pts)} <span style="font-size:16px;opacity:.7">Poin</span></div>
        <div class="rupiah">Nilai: ${UI.fmtRp(rp)}</div>
        <div class="actions">
          <button class="btn btn-ghost btn-block" onclick="Router.go('/redeem')">TUKAR</button>
          <button class="btn btn-primary btn-block" onclick="Router.go('/campaigns')">CAMPAIGN</button>
        </div>
      </div>
    </div>
    <div class="screen">
      <div class="section-head"><h2>Campaign Aktif</h2><a href="#/my-campaigns">Lihat semua</a></div>
      <div id="home-active"></div>
      <div class="section-head"><h2>Campaign Tersedia</h2><a href="#/campaigns">Lihat semua</a></div>
      <div id="home-available"></div>
    </div>${BottomNav('home')}`;
  },
  mount: async () => {
    loadBalance();
    // active campaigns
    const actEl = document.getElementById('home-active');
    const availEl = document.getElementById('home-available');
    actEl.innerHTML = UI.skeleton(1); availEl.innerHTML = UI.skeleton(2);
    try {
      const [active, campaigns] = await Promise.all([API.campaigns.myActive(), API.campaigns.list()]);
      const activeList = active.items.filter(c => ['CLICKED', 'INSTALLED', 'ACTIVE'].includes(c.status)).slice(0, 2);
      actEl.innerHTML = activeList.length ? activeList.map(activeCampaignCard).join('') : UI.empty('📭', 'Belum ada campaign aktif', 'Mulai campaign untuk kumpulkan poin');
      const enrolledIds = new Set(active.items.map(c => c.campaign_id));
      const avail = campaigns.items.filter(c => !enrolledIds.has(c.id)).slice(0, 3);
      availEl.innerHTML = avail.length ? avail.map(campaignCard).join('') : UI.empty('🎉', 'Semua campaign sudah diikuti', 'Kerjakan untuk dapat reward');
    } catch (err) { UI.toast(err.message, 'error'); }
  }
};

function campaignCard(c) {
  return `<div class="card campaign-card" onclick="Router.go('/campaign/${c.id}')">
    <div class="icon">${c.icon || '🎮'}</div>
    <div class="info"><h3>${UI.escape(c.title)}</h3><div class="meta">${c.required_days} hari · ${c.milestones.length} milestone</div></div>
    <div class="reward">${UI.fmtPts(c.reward_total)}<small>Total Reward</small></div>
  </div>`;
}
function activeCampaignCard(c) {
  const pct = Math.min(100, Math.round((c.active_days / c.required_days) * 100));
  return `<div class="card" onclick="Router.go('/campaign/${c.id}/progress')">
    <div class="row between" style="align-items:flex-start">
      <div class="row" style="align-items:center"><div class="campaign-card icon" style="width:42px;height:42px;font-size:20px">${c.icon || '🎮'}</div>
      <div><div style="font-weight:700;font-size:15px">${UI.escape(c.title)}</div>${UI.statusBadge(c.status)}</div></div>
    </div>
    <div style="margin-top:12px">
      <div class="progress-label"><span>Progress</span><span>${c.active_days} / ${c.required_days} hari</span></div>
      <div class="progress"><div style="width:${pct}%"></div></div>
    </div>
  </div>`;
}

async function loadBalance() {
  try {
    const b = await API.points.balance();
    Store.setBalance(b);
    if (!Store.get().user) Store.setUser({ points_balance: b.points });
  } catch { /* ignore */ }
}

// ============ Campaigns list ============
Pages.campaigns = {
  render: () => `
    <div class="topbar"><div class="topbar-row"><div><h1>Campaign</h1><div class="sub">Pilih campaign & dapatkan reward</div></div></div></div>
    <div class="screen">
      <div class="list-tabs"><button data-tab="available" class="active">Tersedia</button><button data-tab="active">Aktif Saya</button></div>
      <div id="camp-list">${UI.skeleton(3)}</div>
    </div>${BottomNav('campaign')}`,
  mount: async () => {
    let tab = 'available';
    const el = document.getElementById('camp-list');
    document.querySelectorAll('.list-tabs button').forEach(btn => btn.onclick = () => {
      tab = btn.dataset.tab;
      document.querySelectorAll('.list-tabs button').forEach(b => b.classList.toggle('active', b === btn));
      render();
    });
    async function render() {
      el.innerHTML = UI.skeleton(2);
      try {
        if (tab === 'available') {
          const [camps, active] = await Promise.all([API.campaigns.list(), API.campaigns.myActive()]);
          const enrolledIds = new Set(active.items.map(c => c.campaign_id));
          const list = camps.items.filter(c => !enrolledIds.has(c.id));
          el.innerHTML = list.length ? list.map(campaignCard).join('') : UI.empty('🎉', 'Tidak ada campaign tersedia', 'Coba lagi nanti');
        } else {
          const active = await API.campaigns.myActive();
          const list = active.items.filter(c => ['CLICKED', 'INSTALLED', 'ACTIVE'].includes(c.status));
          el.innerHTML = list.length ? list.map(activeCampaignCard).join('') : UI.empty('📭', 'Belum ada campaign aktif', 'Mulai dari tab Tersedia');
        }
      } catch (err) { UI.toast(err.message, 'error'); }
    }
    render();
  }
};

// ============ Campaign detail ============
Pages['campaign/:id'] = {
  render: (params) => `<div class="screen" id="camp-detail">${UI.loading()}</div>`,
  mount: async (params) => {
    const el = document.getElementById('camp-detail');
    try {
      const { campaign, enrollment } = await API.campaigns.get(params.id);
      const milestones = campaign.milestones;
      const total = campaign.reward_total;
      const reqs = [
        { label: 'Install aplikasi', done: enrollment && ['INSTALLED', 'ACTIVE', 'COMPLETED'].includes(enrollment.status) },
        { label: 'Buka aplikasi (first open)', done: enrollment && enrollment.first_open_at },
        { label: `Main selama ${campaign.required_days} hari`, done: enrollment && enrollment.active_days >= campaign.required_days },
        { label: 'Jangan uninstall sebelum selesai', done: false },
      ];
      el.innerHTML = `
        <div class="card" style="text-align:center;padding:24px">
          <div style="font-size:64px;margin-bottom:8px">${campaign.icon || '🎮'}</div>
          <h1 style="font-size:22px;font-weight:800">${UI.escape(campaign.title)}</h1>
          <p class="muted small" style="margin-top:6px">${UI.escape(campaign.description)}</p>
        </div>
        <div class="card balance-card" style="background:linear-gradient(135deg,#0B5FFF,#00C2A8)">
          <div class="label">⭐ Total Reward</div>
          <div class="points" style="font-size:28px">${UI.fmtPts(total)} Poin</div>
        </div>
        <div class="card">
          <div class="card-title">Persyaratan</div>
          ${reqs.map(r => `<div class="requirement"><div class="chk ${r.done ? 'done' : 'pending'}">${r.done ? '✓' : '○'}</div><div>${r.label}</div></div>`).join('')}
        </div>
        <div class="card">
          <div class="card-title">Durasi</div>
          <div style="font-size:24px;font-weight:800">${campaign.required_days} Hari</div>
        </div>
        <div class="card">
          <div class="card-title">Reward Bertahap</div>
          ${milestones.map(m => `<div class="tx-item"><div class="tx-ic" style="background:var(--primary-light);color:var(--primary)">${m.day === 0 ? '📥' : '📅'}</div><div class="tx-info"><div class="t">${UI.escape(m.label)}</div><div class="d">${m.day === 0 ? 'Install' : 'Hari ke-' + m.day}</div></div><div class="tx-amt pos">+${UI.fmtPts(m.reward_points)}</div></div>`).join('')}
        </div>
        <div class="warn-box">⚠️ <b>PENTING:</b> Anda harus mempertahankan aktivitas sesuai persyaratan sampai hari ke-${campaign.required_days}. Jika campaign dinyatakan gagal oleh sistem attribution, reward penyelesaian tidak diberikan.</div>
        ${enrollment && ['ACTIVE', 'COMPLETED', 'FAILED'].includes(enrollment.status)
          ? `<button class="btn btn-primary btn-block btn-lg" onclick="Router.go('/campaign/${campaign.id}/progress')">Lihat Progress</button>`
          : `<button class="btn btn-primary btn-block btn-lg" id="dlBtn">DOWNLOAD</button>`}
        ${enrollment ? `<div class="center muted small" style="margin-top:10px">Status: ${UI.statusBadge(enrollment.status)}</div>` : ''}
        <p class="center muted small" style="margin-top:10px">Reward tidak diberikan hanya karena klik download. Install & aktivitas diverifikasi via attribution.</p>`;
      const dlBtn = document.getElementById('dlBtn');
      if (dlBtn) dlBtn.onclick = async () => {
        try {
          const data = await API.campaigns.click(campaign.id);
          const { close } = UI.modal(`
            <h3>📱 Lanjut ke Google Play</h3>
            <div class="modal-sub">Klik tombol di bawah untuk diarahkan ke Google Play. Install aplikasi dan buka untuk mulai campaign.</div>
            <div class="warn-box" style="margin-bottom:14px">Tracking session aktif. Jangan uninstall sebelum campaign selesai.</div>
            <a class="btn btn-primary btn-block btn-lg" href="${UI.escape(data.redirectUrl)}" target="_blank" rel="noopener">Buka Google Play →</a>
            <button class="btn btn-outline btn-block" style="margin-top:10px" onclick="this.closest('.modal-backdrop').remove(); Router.go('/campaign/${campaign.id}/progress')">Lihat Progress</button>`);
        } catch (err) { UI.toast(err.message, 'error'); }
      };
    } catch (err) { el.innerHTML = UI.empty('❌', 'Campaign tidak ditemukan', err.message); }
  }
};

// ============ Campaign progress ============
Pages['campaign/:id/progress'] = {
  render: () => `<div class="screen" id="prog-detail">${UI.loading()}</div>`,
  mount: async (params) => {
    const el = document.getElementById('prog-detail');
    try {
      const data = await API.campaigns.myDetail(params.id);
      const { enrollment, campaign, milestones, earnedRewards, activeDays } = data;
      const pct = Math.min(100, Math.round((enrollment.active_days / campaign.required_days) * 100));
      const earnedMap = new Map(earnedRewards.map(e => [e.milestone_id, e]));
      el.innerHTML = `
        <div class="topbar" style="border-radius:0">
          <div class="topbar-row"><button class="bell" onclick="history.back()">←</button><div><h1 style="font-size:18px">${UI.escape(campaign.title)}</h1><div class="sub">${UI.statusBadge(enrollment.status)}</div></div></div>
        </div>
        <div style="padding:16px">
        <div class="card">
          <div class="progress-label"><span>Progress Aktif</span><span>${enrollment.active_days} / ${campaign.required_days} hari</span></div>
          <div class="progress"><div style="width:${pct}%"></div></div>
          ${enrollment.status === 'ACTIVE' ? `<div class="muted small" style="margin-top:10px">Sisa: ${Math.max(0, campaign.required_days - enrollment.active_days)} hari</div>` : ''}
        </div>
        <div class="card">
          <div class="card-title">Milestone & Reward</div>
          ${milestones.map(m => {
            const earned = earnedMap.get(m.milestone_id);
            const done = !!earned || (m.day === 0 && ['INSTALLED','ACTIVE','COMPLETED'].includes(enrollment.status)) || (m.day > 0 && enrollment.active_days >= m.day);
            return `<div class="tx-item"><div class="tx-ic" style="background:${done ? 'var(--success-bg)' : 'var(--border)'};color:${done ? 'var(--success)' : 'var(--text-faint)'}">${done ? '✓' : '○'}</div><div class="tx-info"><div class="t">${UI.escape(m.label)}</div><div class="d">${m.day === 0 ? 'Install' : 'Hari ke-' + m.day}</div></div><div class="tx-amt ${earned ? 'pos' : ''}" style="${earned ? '' : 'color:var(--text-faint)'}">${earned ? '+' + UI.fmtPts(earned.points_awarded) : UI.fmtPts(m.reward_points)}</div></div>`;
          }).join('')}
        </div>
        ${activeDays.length ? `<div class="card"><div class="card-title">Hari Aktif Tercatat</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">${Array.from({ length: campaign.required_days }, (_, i) => {
          const day = i + 1; const has = activeDays.some(a => a.day_index >= day || a.day_index === day);
          return `<div style="text-align:center;padding:8px;border-radius:8px;background:${has ? 'var(--success-bg)' : 'var(--bg)'};font-size:11px;font-weight:600;color:${has ? 'var(--success)' : 'var(--text-faint)'}">H${day}</div>`;
        }).join('')}</div></div>` : ''}
        ${enrollment.status === 'FAILED' ? `<div class="warn-box">⚠️ Campaign dinyatakan gagal: ${UI.escape(enrollment.fail_reason || 'tidak memenuhi syarat')}. Reward penyelesaian tidak diberikan.</div>` : ''}
        ${enrollment.status === 'COMPLETED' ? `<div class="card center" style="background:var(--success-bg);color:var(--success)"><div style="font-size:32px">🎉</div><div style="font-weight:700;margin-top:6px">Campaign Selesai!</div><div class="small">Semua reward telah ditambahkan ke saldo</div></div>` : ''}
        </div>`;
    } catch (err) { el.innerHTML = UI.empty('❌', 'Tidak ditemukan', err.message); }
  }
};

// ============ My campaigns ============
Pages['my-campaigns'] = {
  render: () => `
    <div class="topbar"><div class="topbar-row"><button class="bell" onclick="history.back()">←</button><div><h1 style="font-size:18px">Campaign Saya</h1></div></div></div>
    <div class="screen" id="my-camp">${UI.skeleton(3)}</div>`,
  mount: async () => {
    const el = document.getElementById('my-camp');
    try {
      const data = await API.campaigns.myActive();
      const list = data.items;
      el.innerHTML = list.length ? list.map(c => {
        if (['CLICKED', 'INSTALLED', 'ACTIVE'].includes(c.status)) return activeCampaignCard(c);
        const pct = Math.min(100, Math.round((c.active_days / c.required_days) * 100));
        return `<div class="card" onclick="Router.go('/campaign/${c.id}/progress')">
          <div class="row between"><div style="font-weight:700">${UI.escape(c.title)}</div>${UI.statusBadge(c.status)}</div>
          <div class="progress-label" style="margin-top:10px"><span>Progress</span><span>${c.active_days}/${c.required_days}</span></div>
          <div class="progress"><div style="width:${pct}%"></div></div></div>`;
      }).join('') : UI.empty('📭', 'Belum ada campaign', 'Mulai dari daftar campaign');
    } catch (err) { UI.toast(err.message, 'error'); }
  }
};

// ============ Redeem ============
Pages.redeem = {
  render: () => `
    <div class="topbar"><div class="topbar-row"><button class="bell" onclick="history.back()">←</button><div><h1 style="font-size:18px">Tukar Poin</h1></div></div></div>
    <div class="screen" id="redeem-screen">${UI.loading()}</div>`,
  mount: async () => {
    const el = document.getElementById('redeem-screen');
    try {
      const data = await API.withdrawals.denominations();
      const { denominations, balance, pointsPerRupiah } = data;
      el.innerHTML = `
        <div class="card balance-card" style="background:linear-gradient(135deg,#0E1726,#1B2A4A)">
          <div class="label">Saldo Anda</div>
          <div class="points"><span class="star">⭐</span> ${UI.fmtPts(balance)}</div>
          <div class="rupiah">= ${UI.fmtRp(Math.floor(balance / pointsPerRupiah))}</div>
        </div>
        <div class="card">
          <div class="card-title">Pilih Nominal Penukaran</div>
          <div class="denom-grid" id="denomGrid">
            ${denominations.map(d => `<div class="denom ${d.enabled ? '' : 'disabled'}" data-amount="${d.amount}" data-points="${d.points}" data-enabled="${d.enabled}"><div class="rp">${UI.fmtRp(d.amount)}</div><div class="pt">${UI.fmtPts(d.points)} poin</div></div>`).join('')}
          </div>
          <div class="divider"></div>
          <div class="field"><label>Nomor DANA</label><input type="tel" id="danaNum" placeholder="08xxxxxxxxxx" inputmode="numeric" /></div>
        </div>
        <button class="btn btn-primary btn-block btn-lg" id="confirmBtn" disabled>KONFIRMASI PENUKARAN</button>
        <p class="center muted small" style="margin-top:10px">Nominal tetap. Penukaran diproses via DANA. Jika gagal, poin dikembalikan.</p>`;
      let selected = null;
      document.querySelectorAll('.denom').forEach(d => d.onclick = () => {
        if (d.dataset.enabled === 'false') return;
        document.querySelectorAll('.denom').forEach(x => x.classList.remove('active'));
        d.classList.add('active');
        selected = { amount: Number(d.dataset.amount), points: Number(d.dataset.points) };
        updateBtn();
      });
      const danaInput = document.getElementById('danaNum');
      function updateBtn() {
        const danaOk = /^08[0-9]{8,11}$/.test(danaInput.value);
        document.getElementById('confirmBtn').disabled = !(selected && danaOk);
      }
      danaInput.oninput = updateBtn;
      document.getElementById('confirmBtn').onclick = async () => {
        const ok = await UI.confirm({
          title: 'Konfirmasi Penukaran',
          body: `Nominal: <b>${UI.fmtRp(selected.amount)}</b><br>Poin: <b>${UI.fmtPts(selected.points)}</b><br>DANA: <b>${UI.escape(danaInput.value)}</b><br><br>Apakah Anda yakin?`,
          confirmText: 'TUKAR', danger: false
        });
        if (!ok) return;
        try {
          const res = await API.withdrawals.create({ amount: selected.amount, destination: danaInput.value });
          if (res.status === 'COMPLETED') {
            UI.modal(`<h3>✅ Berhasil</h3><div class="modal-sub">Penukaran ${UI.fmtRp(selected.amount)} ke DANA ${UI.escape(danaInput.value)} berhasil diproses.</div><button class="btn btn-primary btn-block btn-lg" onclick="this.closest('.modal-backdrop').remove();Router.go('/home')">Selesai</button>`);
          } else if (res.status === 'PROCESSING') {
            UI.modal(`<h3>⏳ Diproses</h3><div class="modal-sub">Penukaran sedang diproses. Anda akan dinotifikasi saat selesai.</div><button class="btn btn-primary btn-block btn-lg" onclick="this.closest('.modal-backdrop').remove();Router.go('/history')">Lihat Riwayat</button>`);
          } else {
            UI.modal(`<h3>❌ Gagal</h3><div class="modal-sub">Penukaran gagal: ${UI.escape(res.reason || '')}.<br>Poin telah dikembalikan ke saldo Anda.</div><button class="btn btn-primary btn-block btn-lg" onclick="this.closest('.modal-backdrop').remove();Router.go('/home')">Tutup</button>`);
          }
          loadBalance();
        } catch (err) { UI.toast(err.message, 'error'); }
      };
    } catch (err) { el.innerHTML = UI.empty('❌', 'Gagal memuat', err.message); }
  }
};

// ============ History ============
Pages.history = {
  render: () => `
    <div class="topbar"><div class="topbar-row"><div><h1 style="font-size:18px">Riwayat</h1></div></div></div>
    <div class="screen">
      <div class="list-tabs"><button data-tab="points" class="active">Riwayat Poin</button><button data-tab="withdrawals">Penarikan</button></div>
      <div id="hist-list">${UI.skeleton(3)}</div>
    </div>${BottomNav('history')}`,
  mount: () => {
    let tab = 'points';
    const el = document.getElementById('hist-list');
    document.querySelectorAll('.list-tabs button').forEach(btn => btn.onclick = () => {
      tab = btn.dataset.tab;
      document.querySelectorAll('.list-tabs button').forEach(b => b.classList.toggle('active', b === btn));
      render();
    });
    async function render() {
      el.innerHTML = UI.skeleton(2);
      try {
        if (tab === 'points') {
          const data = await API.points.transactions(100);
          el.innerHTML = data.items.length ? `<div class="card">${data.items.map(txItem).join('')}</div>` : UI.empty('📋', 'Belum ada riwayat poin');
        } else {
          const data = await API.withdrawals.list(50);
          el.innerHTML = data.items.length ? `<div class="card">${data.items.map(wdItem).join('')}</div>` : UI.empty('💸', 'Belum ada penarikan');
        }
      } catch (err) { UI.toast(err.message, 'error'); }
    }
    render();
  }
};
function txItem(t) {
  const pos = t.amount > 0;
  const icons = { EARN: '⭐', BONUS: '🎁', REFERRAL: '👥', REDEEM: '💸', REFUND: '↩️', ADJUSTMENT: '⚙️', EXPIRED: '⌛' };
  return `<div class="tx-item"><div class="tx-ic" style="background:${pos ? 'var(--success-bg)' : 'var(--danger-bg)'};color:${pos ? 'var(--success)' : 'var(--danger)'}">${icons[t.type] || '•'}</div><div class="tx-info"><div class="t">${UI.escape(t.description)}</div><div class="d">${UI.fmtDateTime(t.created_at)} · ${t.type}</div></div><div class="tx-amt ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${UI.fmtPts(t.amount)}</div></div>`;
}
function wdItem(w) {
  return `<div class="tx-item"><div class="tx-ic" style="background:var(--primary-light);color:var(--primary)">💸</div><div class="tx-info"><div class="t">${UI.fmtRp(w.amount)} · DANA</div><div class="d">${UI.fmtPts(w.points)} poin · ${UI.fmtDateTime(w.created_at)}</div>${w.failure_reason ? `<div class="d" style="color:var(--danger)">${UI.escape(w.failure_reason)}</div>` : ''}</div><div>${UI.statusBadge(w.status)}</div></div>`;
}

// ============ Referral ============
Pages.referral = {
  render: () => `<div class="screen" id="ref-screen">${UI.loading()}</div>${BottomNav('referral')}`,
  mount: async () => {
    const el = document.getElementById('ref-screen');
    try {
      const [data, b] = await Promise.all([API.referrals.list(), API.points.balance().catch(() => null)]);
      const code = Store.get().user ? Store.get().user.referral_code : '';
      const shareText = `Gabung DANAPLAY dengan kode referral saya: ${code}`;
      el.innerHTML = `
        <div class="topbar" style="border-radius:0 0 var(--radius-lg) var(--radius-lg)">
          <h1>Referral</h1><div class="sub">Ajak teman, dapat bonus</div>
        </div>
        <div style="padding:16px">
        <div class="card center" style="padding:24px">
          <div class="muted small">Kode Referral Anda</div>
          <div style="font-size:32px;font-weight:800;letter-spacing:2px;color:var(--primary);margin:8px 0">${code}</div>
          <div class="row" style="justify-content:center">
            <button class="btn btn-outline" onclick="navigator.clipboard.writeText('${code}').then(()=>UI.toast('Kode disalin','success'))">Salin Kode</button>
            <button class="btn btn-primary" onclick="navigator.share?.({title:'DANAPLAY',text:'${shareText}'})||UI.toast('Salin manual: ${code}','success')">Bagikan</button>
          </div>
        </div>
        <div class="warn-box">Bonus referral <b>hanya diberikan</b> setelah teman yang Anda ajak menyelesaikan campaign pertama mereka. Sistem mencegah self-referral & akun ganda.</div>
        <div class="card">
          <div class="card-title">Statistik</div>
          <div class="row" style="text-align:center">
            <div style="flex:1"><div style="font-size:22px;font-weight:800">${data.stats.total}</div><div class="muted small">Total</div></div>
            <div style="flex:1"><div style="font-size:22px;font-weight:800;color:var(--success)">${data.stats.paid}</div><div class="muted small">Berbayar</div></div>
            <div style="flex:1"><div style="font-size:22px;font-weight:800;color:var(--warning)">${data.stats.pending + data.stats.qualified}</div><div class="muted small">Pending</div></div>
          </div>
        </div>
        <div class="section-head"><h2>Teman yang Diajak</h2></div>
        ${data.referrals.length ? `<div class="card">${data.referrals.map(r => `<div class="tx-item"><div class="tx-ic" style="background:var(--primary-light);color:var(--primary)">👤</div><div class="tx-info"><div class="t">${UI.escape(r.invitee_name)}</div><div class="d">${UI.fmtDate(r.created_at)}</div></div><div>${UI.statusBadge(r.status === 'BONUS_PAID' ? 'COMPLETED' : 'PENDING')}</div></div>`).join('')}</div>` : UI.empty('👥', 'Belum ada referral', 'Bagikan kode Anda untuk mulai')}
        </div>`;
    } catch (err) { el.innerHTML = UI.empty('❌', 'Gagal memuat', err.message); }
  }
};

// ============ Notifications ============
Pages.notifications = {
  render: () => `<div class="screen" id="notif-screen">${UI.loading()}</div>`,
  mount: async () => {
    const el = document.getElementById('notif-screen');
    try {
      const data = await API.notifications.list();
      el.innerHTML = `
        <div class="topbar" style="border-radius:0 0 var(--radius-lg) var(--radius-lg)"><div class="topbar-row"><button class="bell" onclick="history.back()">←</button><div><h1 style="font-size:18px">Notifikasi</h1></div></div></div>
        <div style="padding:16px">
        ${data.items.length ? `<div class="card">${data.items.map(n => `<div class="tx-item" style="align-items:flex-start"><div class="tx-ic" style="background:var(--primary-light);color:var(--primary)">${n.type.includes('FAIL') ? '❌' : n.type.includes('REWARD') || n.type.includes('COMPLETED') ? '🎉' : '🔔'}</div><div class="tx-info"><div class="t">${UI.escape(n.title)}</div><div class="d">${UI.escape(n.body)}</div><div class="d" style="margin-top:4px">${UI.timeAgo(n.created_at)}</div></div></div>`).join('')}</div>` : UI.empty('🔔', 'Tidak ada notifikasi', '')}
        </div>`;
      Store.setUnread(0);
    } catch (err) { el.innerHTML = UI.empty('❌', 'Gagal memuat', err.message); }
  }
};

// ============ Profile ============
Pages.profile = {
  render: () => {
    const u = Store.get().user || {};
    return `<div class="screen" id="profile-screen">
      <div class="topbar" style="border-radius:0 0 var(--radius-lg) var(--radius-lg)"><h1>Profil</h1></div>
      <div style="padding:16px">
      <div class="card center" style="padding:24px">
        <div style="font-size:48px">👤</div>
        <div style="font-size:18px;font-weight:700;margin-top:6px">${UI.escape(u.name || '')}</div>
        <div class="muted small">${UI.escape(u.phone || '')}</div>
        <div class="badge badge-completed" style="margin-top:8px">Kode: ${u.referral_code || ''}</div>
      </div>
      <div class="card">
        <div class="requirement" onclick="Router.go('/change-password')" style="cursor:pointer"><div class="chk pending">🔒</div><div>Ganti Password</div><div style="margin-left:auto">›</div></div>
        <div class="divider"></div>
        <div class="requirement" onclick="editProfile()" style="cursor:pointer"><div class="chk pending">✏️</div><div>Edit Profil</div><div style="margin-left:auto">›</div></div>
      </div>
      <button class="btn btn-danger btn-block btn-lg" onclick="logout()">LOGOUT</button>
      </div>${BottomNav('profile')}`;
  },
  mount: () => {}
};
window.editProfile = async () => {
  const u = Store.get().user;
  const { close, root } = UI.modal(`
    <h3>Edit Profil</h3>
    <div class="modal-sub">Ubah nama Anda</div>
    <div class="field"><label>Nama</label><input id="edName" value="${UI.escape(u.name)}" /></div>
    <button class="btn btn-primary btn-block btn-lg" id="saveName">SIMPAN</button>`);
  root.querySelector('#saveName').onclick = async () => {
    try {
      const data = await API.user.updateProfile(root.querySelector('#edName').value);
      Store.setUser(data.user);
      close(); UI.toast('Profil diperbarui', 'success'); Router.refresh();
    } catch (err) { UI.toast(err.message, 'error'); }
  };
};
window.logout = async () => {
  const ok = await UI.confirm({ title: 'Logout', body: 'Yakin ingin keluar?', confirmText: 'LOGOUT', danger: true });
  if (!ok) return;
  try { await API.auth.logout(); } catch {}
  Store.reset();
  Router.go('/login');
};

// ============ Change password ============
Pages['change-password'] = {
  render: () => `
    <div class="topbar"><div class="topbar-row"><button class="bell" onclick="history.back()">←</button><div><h1 style="font-size:18px">Ganti Password</h1></div></div></div>
    <div class="screen">
      <div class="card">
        <form id="pwForm">
          <div class="field"><label>Password Saat Ini</label><input type="password" name="current" required /></div>
          <div class="field"><label>Password Baru</label><input type="password" name="new" required /><div class="hint">Minimal 8 karakter</div></div>
          <button type="submit" class="btn btn-primary btn-block btn-lg">UBAH PASSWORD</button>
        </form>
      </div>
    </div>`,
  mount: () => {
    document.getElementById('pwForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await API.user.changePassword({ currentPassword: f.get('current'), newPassword: f.get('new') });
        UI.toast('Password berhasil diubah', 'success'); Router.go('/profile');
      } catch (err) { UI.toast(err.message, 'error'); }
    });
  }
};
