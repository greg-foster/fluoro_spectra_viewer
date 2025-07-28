import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ToolLayout.css';

/**
 * ToolLayout - Wrapper component for individual tools
 * Provides consistent navigation and layout for all tools in the portal
 */
export default function ToolLayout({ children, toolName, onLogout, darkMode, toggleDarkMode }) {
  const navigate = useNavigate();

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className={`tool-layout${darkMode ? ' dark' : ''}`}>
      {/* Tool Navigation Header */}
      <header className="tool-header">
        <div className="tool-nav">
          <button 
            onClick={handleBackToHome}
            className="back-button"
          >
            ← Back to Portal
          </button>
          <div className="tool-breadcrumb">
            <span className="breadcrumb-home" onClick={handleBackToHome}>
              Lab Tools Portal
            </span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{toolName}</span>
          </div>
        </div>
        <div className="tool-header-buttons">
          <button 
            onClick={toggleDarkMode}
            className="tool-dark-mode-button"
          >
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button 
            onClick={onLogout}
            className="tool-logout-button"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Tool Content */}
      <main className="tool-content">
        {children}
      </main>
    </div>
  );
}
