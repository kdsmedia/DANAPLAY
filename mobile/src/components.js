// Reusable UI components & helpers.
const UI = (function () {
  function toast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = 'toast ' + type; }, 2600);
  }
  function modal(contentHtml, { onClose } = {}) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal"><div class="modal-handle"></div>${contentHtml}</div></div>`;
    const close = () => { root.innerHTML = ''; if (onClose) onClose(); };
    root.querySelector('.modal-backdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });
    return { close, root: root.querySelector('.modal') };
  }
  function confirm({ title, body, confirmText = 'Konfirmasi', cancelText = 'Batal', danger = false }) {
    return new Promise((resolve) => {
      const { close } = modal(`
        <h3>${title}</h3>
        <div class="modal-sub">${body}</div>
        <div class="row">
          <button class="btn btn-outline btn-block" data-act="cancel">${cancelText}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-block" data-act="ok">${confirmText}</button>
        </div>`);
      close; // noop ref
      const modalEl = document.getElementById('modal-root').querySelector('.modal');
      modalEl.querySelector('[data-act="cancel"]').onclick = () => { close(); resolve(false); };
      modalEl.querySelector('[data-act="ok"]').onclick = () => { close(); resolve(true); };
    });
  }
  function fmtRp(n) { return 'Rp' + Number(n).toLocaleString('id-ID'); }
  function fmtPts(n) { return Number(n).toLocaleString('id-ID'); }
  function fmtDate(s) { if (!s) return '-'; const d = new Date(s); return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function fmtDateTime(s) { if (!s) return '-'; const d = new Date(s); return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function timeAgo(s) { if (!s) return '-'; const diff = Date.now() - new Date(s).getTime(); const m = Math.floor(diff / 60000); if (m < 1) return 'baru saja'; if (m < 60) return m + ' mnt lalu'; const h = Math.floor(m / 60); if (h < 24) return h + ' jam lalu'; const d = Math.floor(h / 24); return d + ' hari lalu'; }

  function statusBadge(status) {
    const map = {
      CLICKED: ['badge-clicked', 'Klik'],
      INSTALLED: ['badge-pending', 'Terinstall'],
      ACTIVE: ['badge-active', '🔥 Aktif'],
      COMPLETED: ['badge-completed', '✓ Selesai'],
      FAILED: ['badge-failed', 'Gagal'],
      EXPIRED: ['badge-failed', 'Kedaluwarsa'],
      CANCELLED: ['badge-clicked', 'Dibatalkan'],
      PENDING: ['badge-pending', 'Pending'],
      PROCESSING: ['badge-pending', 'Diproses'],
    };
    const [cls, label] = map[status] || ['badge-clicked', status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function skeleton(n = 3) {
    let html = '';
    for (let i = 0; i < n; i++) html += `<div class="card skeleton sk-card"></div>`;
    return html;
  }
  function empty(icon, title, sub = '') {
    return `<div class="empty"><div class="em-ic">${icon}</div><div class="em-t">${title}</div><div class="em-s">${sub}</div></div>`;
  }
  function loading(text = 'Memuat...') {
    return `<div class="loading-screen"><div class="spinner"></div><div class="muted small">${text}</div></div>`;
  }
  function escape(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  return { toast, modal, confirm, fmtRp, fmtPts, fmtDate, fmtDateTime, timeAgo, statusBadge, skeleton, empty, loading, escape };
})();
