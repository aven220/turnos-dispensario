import { createContext, useContext, useState, ReactNode } from 'react';
import { api } from '../services/api';
import { disconnectSocket } from '../services/socket';
import type { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  windowId: string | null;
  login: (username: string, password: string, windowId?: string) => Promise<void>;
  setSessionUser: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [windowId, setWindowId] = useState<string | null>(localStorage.getItem('windowId'));

  async function login(username: string, password: string, winId?: string) {
    const res = await api<{ token: string; user: User; windowId?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, windowId: winId }),
    });
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    if (res.windowId) localStorage.setItem('windowId', res.windowId);
    setToken(res.token);
    setUser(res.user);
    setWindowId(res.windowId ?? null);
  }

  function setSessionUser(updated: User) {
    localStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  }

  function logout() {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('windowId');
    disconnectSocket();
    setToken(null);
    setUser(null);
    setWindowId(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, windowId, login, setSessionUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
