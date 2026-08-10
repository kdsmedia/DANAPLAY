import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { API, loadToken, setToken as storeToken, getToken } from './api';

type User = {
  id: string; name: string; phone: string; referral_code: string;
  points_balance: number; status: string; referred_by: string | null;
};

type Balance = { points: number; rupiah: number };

type Ctx = {
  user: User | null;
  balance: Balance | null;
  unread: number;
  loading: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
  refreshBalance: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  setUser: (u: User) => void;
};

const AuthContext = createContext<Ctx>({} as any);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const signIn = useCallback((token: string, u: User) => {
    storeToken(token);
    setUserState(u);
    setBalance({ points: u.points_balance, rupiah: Math.floor(u.points_balance / 1000) });
  }, []);

  const signOut = useCallback(async () => {
    try { await API.auth.logout(); } catch {}
    storeToken(null);
    setUserState(null);
    setBalance(null);
    setUnread(0);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!getToken()) return;
    try {
      const b = await API.points.balance();
      setBalance({ points: b.points, rupiah: b.rupiah });
    } catch {}
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!getToken()) return;
    try {
      const data = await API.notifications.list();
      setUnread(data.unread || 0);
    } catch {}
  }, []);

  const setUser = useCallback((u: User) => setUserState(u), []);

  useEffect(() => {
    (async () => {
      const t = await loadToken();
      if (t) {
        try {
          const me = await API.auth.me();
          setUserState(me.user);
          setBalance({ points: me.user.points_balance, rupiah: Math.floor(me.user.points_balance / 1000) });
          refreshUnread();
        } catch {
          storeToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  return (
    <AuthContext.Provider value={{ user, balance, unread, loading, signIn, signOut, refreshBalance, refreshUnread, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
