export const theme = {
  primary: '#0B5FFF',
  primaryDark: '#0040C7',
  primaryLight: '#E8F0FF',
  accent: '#00C2A8',
  bg: '#F4F6FB',
  surface: '#FFFFFF',
  text: '#0E1726',
  muted: '#6B7894',
  faint: '#9AA5BC',
  border: '#E6EAF2',
  success: '#16A34A',
  successBg: '#E8F8EF',
  warning: '#D97706',
  warningBg: '#FFF4E5',
  danger: '#DC2626',
  dangerBg: '#FDECEC',
  dark: '#0E1726',
  dark2: '#1B2A4A',
  radius: 16,
  radiusSm: 10,
  radiusLg: 22,
};

export function fmtRp(n: number): string {
  return 'Rp' + Number(n).toLocaleString('id-ID');
}

export function fmtPts(n: number): string {
  return Number(n).toLocaleString('id-ID');
}

export function fmtDate(s?: string): string {
  if (!s) return '-';
  const d = new Date(s);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(s?: string): string {
  if (!s) return '-';
  const d = new Date(s);
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(s?: string): string {
  if (!s) return '-';
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return m + ' mnt lalu';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' jam lalu';
  const d = Math.floor(h / 24);
  return d + ' hari lalu';
}

export const statusInfo: Record<string, { label: string; bg: string; color: string }> = {
  CLICKED: { label: 'Klik', bg: '#EEF0F6', color: '#6B7894' },
  INSTALLED: { label: 'Terinstall', bg: '#FFF4E5', color: '#D97706' },
  ACTIVE: { label: '🔥 Aktif', bg: '#E8F8EF', color: '#16A34A' },
  COMPLETED: { label: '✓ Selesai', bg: '#E8F0FF', color: '#0B5FFF' },
  FAILED: { label: 'Gagal', bg: '#FDECEC', color: '#DC2626' },
  EXPIRED: { label: 'Kedaluwarsa', bg: '#FDECEC', color: '#DC2626' },
  CANCELLED: { label: 'Dibatalkan', bg: '#EEF0F6', color: '#6B7894' },
  PENDING: { label: 'Pending', bg: '#FFF4E5', color: '#D97706' },
  PROCESSING: { label: 'Diproses', bg: '#FFF4E5', color: '#D97706' },
};
