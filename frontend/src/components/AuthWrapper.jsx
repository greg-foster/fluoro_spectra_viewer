import React, { useState } from 'react';
import Login from './Login';
import AppRouter from './AppRouter';

/**
 * AuthWrapper component that handles authentication state and conditionally renders
 * either the Login component or the AppRouter (portal) component.
 * This approach prevents React hooks count mismatches by keeping authentication
 * logic separate from the main app components.
 */
export default function AuthWrapper() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check if user was previously authenticated (session storage)
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('isAuthenticated') === 'true';
    }
    return false;
  });

  // Handle login
  const handleLogin = () => {
    setIsAuthenticated(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('isAuthenticated', 'true');
    }
  };

  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('isAuthenticated');
    }
  };

  // If not authenticated, show login screen
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} darkMode={false} />;
  }

  // If authenticated, render the portal with logout handler
  return <AppRouter onLogout={handleLogout} />;
}
