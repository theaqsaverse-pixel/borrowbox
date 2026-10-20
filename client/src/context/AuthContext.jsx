import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api';
import { TOKEN_KEY } from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!localStorage.getItem(TOKEN_KEY)); // true while we verify a saved token
  // true after the user clicked "Log out" (as opposed to a session that expired).
  // Route guards use it to send an explicit logout home instead of to /login.
  const [loggedOut, setLoggedOut] = useState(false);

  // On first load: if a token is saved, ask the API who we are.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    let cancelled = false;
    authApi
      .me()
      .then((res) => !cancelled && setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // The axios interceptor fires this when the API says the token is no longer valid.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('borrowbox:unauthorized', onUnauthorized);
    return () => window.removeEventListener('borrowbox:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setLoggedOut(false);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await authApi.register(payload);
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setLoggedOut(false);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setLoggedOut(true);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, loggedOut, isAuthenticated: !!user, isAdmin: user?.role === 'admin', login, register, logout, setUser }),
    [user, loading, loggedOut, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
