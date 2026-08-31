import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, requiredRole }) {
  const { currentUser, userRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold text-slate-400">Authenticating workspace session...</span>
        </div>
      </div>
    );
  }

  // If not logged in, redirect to login
  if (!currentUser) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // SuperAdmin Role check: allow super_admin, owner, or platform admin email
  if (requiredRole === 'super_admin') {
    const isSuper = 
      userRole === 'super_admin' || 
      userRole === 'owner' || 
      currentUser?.role === 'super_admin' ||
      currentUser?.role === 'owner' ||
      currentUser?.email === 'interacai.int@gmail.com' ||
      currentUser?.email?.toLowerCase().includes('admin');

    if (!isSuper) {
      console.warn(`[Access Guard] Required role super_admin, current user has role ${userRole}`);
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
          <div className="max-w-md w-full bg-slate-900 p-8 rounded-3xl border border-slate-800 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20 font-black text-xl">
              ✕
            </div>
            <h2 className="text-xl font-bold text-white">SuperAdmin Access Required</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your account ({currentUser.email}) is currently authenticated with <strong className="text-slate-200 uppercase">{userRole || 'tenant'}</strong> permissions. SuperAdmin clearance is required for the InteracAI Control Center.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button 
                onClick={() => window.location.href = '/dashboard'}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition"
              >
                Return to Tenant Workspace
              </button>
              <button 
                onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
              >
                Log In as Platform Admin
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return children;
}
