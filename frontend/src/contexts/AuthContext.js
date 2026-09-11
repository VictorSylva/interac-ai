import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { API_BASE_URL } from '../config';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewRole, setPreviewRole] = useState(localStorage.getItem('interact_preview_role') || null);
  const [previewDept, setPreviewDept] = useState(localStorage.getItem('interact_preview_dept') || null);

  const activeRole = previewRole || currentUser?.role || null;
  const activeDept = previewDept || currentUser?.department || 'general';

  const setLocalPreview = useCallback((dept, role) => {
    setPreviewDept(dept);
    setPreviewRole(role);
    localStorage.setItem('interact_preview_dept', dept);
    localStorage.setItem('interact_preview_role', role);
  }, []);

  const clearLocalPreview = useCallback(() => {
    setPreviewDept(null);
    setPreviewRole(null);
    localStorage.removeItem('interact_preview_dept');
    localStorage.removeItem('interact_preview_role');
  }, []);

  const login = useCallback((email, password) => {
    return fetchWithRetry(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    }).then(async res => {
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: "Login failed" }));
            throw new Error(err.detail || "Login failed");
        }
        const data = await res.json();
        const user = { ...data.user, uid: data.user.id, token: data.token };
        setCurrentUser(user);
        localStorage.setItem('interact_user', JSON.stringify(user));
        return user;
    });
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    clearLocalPreview();
    localStorage.removeItem('interact_user');
    return Promise.resolve();
  }, [clearLocalPreview]);

  const signup = useCallback((email, password, businessName = "New Business") => {
    return fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, business_name: businessName })
    }).then(async res => {
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Registration failed");
        }
        await res.json();
        return login(email, password);
    });
  }, [login]);

  async function fetchWithRetry(url, options, retries = 2, delayMs = 2500) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (retries > 0) {
        console.warn(`[Auth] Backend cold start detected. Retrying request to ${url} in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return fetchWithRetry(url, options, retries - 1, delayMs);
      }
      throw err;
    }
  }

  const forgotPassword = useCallback((email) => {
    return fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    }).then(async res => {
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Request failed");
        }
        return res.json();
    });
  }, []);

  const resetPassword = useCallback((token, newPassword) => {
    return fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword })
    }).then(async res => {
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Reset failed");
        }
        return res.json();
    });
  }, []);

  useEffect(() => {
    // Check localStorage on load
    const stored = localStorage.getItem('interact_user');
    if (stored) {
        try {
            const user = JSON.parse(stored);
            setCurrentUser(user);

            // Fetch fresh status to ensure business_id and plan_tier are up-to-date
            const bid = user.business_id || user.email;
            if (bid) {
                fetch(`${API_BASE_URL}/api/business-status?business_id=${encodeURIComponent(bid)}`)
                    .then(res => res.ok ? res.json() : null)
                    .then(statusData => {
                        if (statusData && statusData.id) {
                            const updatedUser = { 
                                ...user, 
                                business_id: statusData.id, 
                                plan_tier: statusData.plan_name,
                                business_name: statusData.name || user.business_name
                            };
                            setCurrentUser(updatedUser);
                            localStorage.setItem('interact_user', JSON.stringify(updatedUser));
                        }
                    })
                    .catch(err => console.error("Error refreshing business status:", err));
            }
        } catch (e) {
            console.error("AuthContext parse error:", e);
        }
    }
    setLoading(false);
  }, []);


  function updateProfile(userId, department, role, phone = null, receive_operational_alerts = null, notification_preference = null) {
    return fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            user_id: userId, 
            department, 
            role,
            phone,
            receive_operational_alerts,
            notification_preference
        })
    }).then(async res => {
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to update profile");
        }
        const data = await res.json();
        const updatedUser = { 
            ...currentUser, 
            role: data.user.role, 
            department: data.user.department,
            phone: data.user.phone,
            receive_operational_alerts: data.user.receive_operational_alerts,
            notification_preference: data.user.notification_preference,
            permissions: data.user.permissions || currentUser.permissions
        };
        setCurrentUser(updatedUser);
        localStorage.setItem('interact_user', JSON.stringify(updatedUser));
        return updatedUser;
    });
  }

  function acceptInvitation(token, password) {
    return fetch(`${API_BASE_URL}/api/auth/accept-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
    }).then(async res => {
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to accept invitation");
        }
        const data = await res.json();
        const user = { ...data.user, uid: data.user.id, token: data.token };
        setCurrentUser(user);
        localStorage.setItem('interact_user', JSON.stringify(user));
        return user;
    });
  }

  function hasPermission(permission) {
    const role = activeRole?.toLowerCase();
    if (role === 'owner' || role === 'super_admin') {
      return true;
    }
    const permissions = currentUser?.permissions || [];
    return permissions.includes(permission);
  }

  const value = {
    currentUser,
    userRole: activeRole, // Map preview role seamlessly
    activeDept,
    activeRole,
    setLocalPreview,
    clearLocalPreview,
    login,
    signup,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    acceptInvitation,
    hasPermission,
    permissions: currentUser?.permissions || []
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
