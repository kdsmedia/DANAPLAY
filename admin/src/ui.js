// Admin UI helpers.
const AUI = (function () {
  function toast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg; el.className = 'toast show ' + type;
    clearTimeout(el._t); el._t = setTimeout(() => { el.className = 'toast ' + type; }, 2600);
  }
  function modal(html) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
    const close = () => { root.innerHTML = ''; };
    root.querySelector('.modal-backdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });
    return { close, el: root.querySelector('.modal') };
  }
  function confirm(title, body, okText = 'Konfirmasi', danger = false) {
    return new Promise((resolve) => {
      const { close, el } = modal(`<h3>${title}</h3><p class="muted" style="margin:8px 0 16px">${body}</p><div class="row" style="justify-content:flex-end"><button class="btn btn-outline" data-c>Batal</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-o>${okText}</button></div>`);
      el.querySelector('[data-c]').onclick = () => { close(); resolve(false); };
      el.querySelector('[data-o]').onclick = () => { close(); resolve(true); };
    });
  }
  function fmtRp(n) { return 'Rp' + Number(n).toLocaleString('id-ID'); }
  function fmtPts(n) { return Number(n).toLocaleString('id-ID'); }
  function fmtDate(s) { if (!s) return '-'; return new Date(s).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function statusBadge(s) {
    const m = { ACTIVE: ['badge-active', 'Aktif'], SUSPENDED: ['badge-pending', 'Suspend'], BANNED: ['badge-failed', 'Banned'],
      CLICKED: ['badge-clicked', 'Klik'], INSTALLED: ['badge-pending', 'Terinstall'], COMPLETED: ['badge-completed', 'Selesai'],
      FAILED: ['badge-failed', 'Gagal'], EXPIRED: ['badge-failed', 'Kedaluwarsa'], CANCELLED: ['badge-clicked', 'Batal'],
      PENDING: ['badge-pending', 'Pending'], PROCESSING: ['badge-pending', 'Diproses'], PAUSED: ['badge-paused', 'Pause'],
      ARCHIVED: ['badge-clicked', 'Arsip'], DRAFT: ['badge-clicked', 'Draft'],
      PENDING_REF: ['badge-pending', 'Pending'], QUALIFIED: ['badge-pending', 'Qualified'], BONUS_PAID: ['badge-completed', 'Dibayar'], REJECTED: ['badge-failed', 'Ditolak'],
      OPEN: ['badge-failed', 'Open'], REVIEWING: ['badge-pending', 'Review'], RESOLVED: ['badge-completed', 'Resolved'], DISMISSED: ['badge-clicked', 'Dismissed'],
    };
    const [cls, label] = m[s] || ['badge-clicked', s]; return `<span class="badge ${cls}">${label}</span>`;
  }
  function loading() { return `<div class="spinner"></div>`; }
  function empty(msg) { return `<div class="empty">${msg || 'Tidak ada data'}</div>`; }
  function providerTag(mode) { const cls = mode && mode.includes('PRODUCTION') ? 'provider-prod' : 'provider-mock'; return `<span class="provider-tag ${cls}">${esc(mode || 'MOCK')}</span>`; }
  return { toast, modal, confirm, fmtRp, fmtPts, fmtDate, esc, statusBadge, loading, empty, providerTag };
})();
