import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { API_BASE_URL } from '../config';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  function signup(email, password, businessName = "New Business") {
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
        // Automatically login the newly created user
        return login(email, password);
    });
  }

  function login(email, password) {
    return fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    }).then(async res => {
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Login failed");
        }
        const data = await res.json();
        // Set user immediately
        const user = data.user;
        user.uid = user.id; // Map SQL ID to expected uid
        setCurrentUser(user);
        setUserRole(user.role);
        localStorage.setItem('interact_user', JSON.stringify(user));
        return user;
    });
  }

  function logout() {
    setCurrentUser(null);
    setUserRole(null);
    localStorage.removeItem('interact_user');
    return Promise.resolve();
  }

  function forgotPassword(email) {
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
  }

  function resetPassword(token, newPassword) {
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
  }

  useEffect(() => {
    // Check localStorage on load
    const stored = localStorage.getItem('interact_user');
    if (stored) {
        try {
            const user = JSON.parse(stored);
            setCurrentUser(user);
            setUserRole(user.role);
        } catch (e) {
        }
    }
    setLoading(false);
  }, []);

  const value = {
    currentUser,
    userRole,
    login,
    signup,
    logout,
    forgotPassword,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
