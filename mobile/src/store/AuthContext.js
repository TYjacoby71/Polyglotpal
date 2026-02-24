import React, { createContext, useContext, useState, useEffect } from 'react';
import { authStorage } from '../store/storage';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session on launch
    const stored = authStorage.getUser();
    const token = authStorage.getToken();
    if (stored && token) setUser(stored);
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await authAPI.login(email, password);
    authStorage.setToken(data.token);
    authStorage.setUser(data.user);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password) => {
    const data = await authAPI.register(email, password);
    authStorage.setToken(data.token);
    authStorage.setUser(data.user);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    authStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
