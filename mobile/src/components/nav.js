// Bottom navigation.
function BottomNav(active) {
  const items = [
    { key: 'home', ic: '🏠', label: 'HOME', path: '/home' },
    { key: 'campaign', ic: '🎯', label: 'CAMPAIGN', path: '/campaigns' },
    { key: 'history', ic: '📋', label: 'RIWAYAT', path: '/history' },
    { key: 'referral', ic: '🎁', label: 'REFERRAL', path: '/referral' },
    { key: 'profile', ic: '👤', label: 'PROFIL', path: '/profile' },
  ];
  return `<nav class="bottom-nav">${items.map(i => `
    <a href="#${i.path}" class="${active === i.key ? 'active' : ''}"><span class="ic">${i.ic}</span><span>${i.label}</span></a>`).join('')}</nav>`;
}
