import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, requiredRole }) {
  const { currentUser, userRole, loading } = useAuth();
  const [redirect, setRedirect] = React.useState(null);

  React.useEffect(() => {
    if (loading) return; // Wait for auth to resolve

    // If not logged in, redirect to login
    if (!currentUser) {
        setRedirect('/login');
        return;
    }

    // Role check
    if (requiredRole && userRole !== requiredRole) {
        console.error(`Access denied: Required role ${requiredRole}, got ${userRole}`);
        setRedirect('/'); // Redirect to landing or business dashboard
    } else {
        setRedirect(null); // Clear any previous redirect
    }
  }, [currentUser, userRole, requiredRole, loading]);

  if (redirect) {
      return <Navigate to={redirect} />;
  }

  return children;
}
