import { useState, useCallback, useEffect } from 'react';
import { api } from '../api';
import { AuthContext } from './auth';

function readUser() {
  try { return JSON.parse(localStorage.getItem('hd_user')); } catch { return null; }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('hd_token'));
  const [user, setUser] = useState(readUser);
  const [expired, setExpired] = useState(false);

  const login = useCallback((newToken, newUser) => {
    localStorage.setItem('hd_token', newToken);
    localStorage.setItem('hd_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setExpired(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hd_token');
    localStorage.removeItem('hd_user');
    setToken(null);
    setUser(null);
  }, []);

  // Any 401 from the API (expired token) logs the user out.
  useEffect(() => {
    const onExpired = () => { logout(); setExpired(true); };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [logout]);

  // Re-check a saved token once on load (role may have changed).
  useEffect(() => {
    if (token) api.me(token).then(({ user: u }) => { setUser(u); localStorage.setItem('hd_user', JSON.stringify(u)); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isStaff = !!user && (user.role === 'technician' || user.role === 'admin');
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ token, user, isStaff, isAdmin, login, logout, expired }}>
      {children}
    </AuthContext.Provider>
  );
}

