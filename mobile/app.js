// DANAPLAY mobile app bootstrap.
document.addEventListener('DOMContentLoaded', () => {
  // Load notification unread count periodically when logged in
  async function refreshUnread() {
    if (!API.getToken()) return;
    try {
      const data = await API.notifications.list();
      Store.setUnread(data.unread);
    } catch { /* ignore */ }
  }
  Store.subscribe(() => { /* could trigger re-renders here */ });
  Router.init();
  setInterval(refreshUnread, 60000);
  refreshUnread();
});
