import React, { createContext, useEffect, useState } from 'react';
import client from '../api/client';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await client.get('/auth/me');
        setUser(response.data.user);
      } catch {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, [token]);

  const saveSession = ({ user: nextUser, tenant: nextTenant, tokens }) => {
    setToken(tokens.accessToken);
    setUser(nextUser);
    setTenant(nextTenant ?? null);
    localStorage.setItem('token', tokens.accessToken);
    if (tokens.refreshToken) localStorage.setItem('refreshToken', tokens.refreshToken);
  };

  const login = async (email, password) => {
    const response = await client.post('/auth/login', { email, password });
    saveSession(response.data);
    return response.data;
  };

  const register = async (data) => {
    const response = await client.post('/auth/register', data);
    saveSession(response.data);
    return response.data;
  };

  const logout = async () => {
    try {
      await client.post('/auth/logout', { refreshToken: localStorage.getItem('refreshToken') });
    } catch {
      // Local logout still completes if the API is unavailable.
    }
    setToken(null);
    setUser(null);
    setTenant(null);
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  };

  return (
    <AuthContext.Provider value={{
      user, token, tenant, isAuthenticated: !!token, loading, login, register, logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};
