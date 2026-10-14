import React, { createContext, useEffect, useState } from 'react';
import client from '../api/client';
import { hasDashboardWidgetPermission, hasViewPermission } from '../config/permissions';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [tenant, setTenant] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(localStorage.getItem('branchId'));
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
        const branchesResponse = await client.get('/branches');
        setBranches(branchesResponse.data || []);
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
    // A login may switch companies; never carry a branch UUID across tenants.
    localStorage.removeItem('branchId');
    setBranchId(null);
    setToken(tokens.accessToken);
    setUser(nextUser);
    setTenant(nextTenant ?? null);
    localStorage.setItem('token', tokens.accessToken);
    if (tokens.refreshToken) localStorage.setItem('refreshToken', tokens.refreshToken);
    if (nextTenant?.id) client.get('/branches').then(response => setBranches(response.data || [])).catch(() => {});
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
    localStorage.removeItem('branchId');
  };

  const refreshUser = async () => {
    const response = await client.get('/auth/me');
    setUser(response.data.user);
    return response.data.user;
  };

  const selectBranch = nextBranchId => {
    setBranchId(nextBranchId);
    if (nextBranchId) localStorage.setItem('branchId', nextBranchId);
    else localStorage.removeItem('branchId');
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      tenant,
      branches,
      branchId,
      selectBranch,
      isAuthenticated: !!token,
      loading,
      login,
      register,
      logout,
      refreshUser,
      canView: permission => hasViewPermission(user, permission),
      canViewWidget: widget => hasDashboardWidgetPermission(user, widget),
    }}>
      {children}
    </AuthContext.Provider>
  );
};
