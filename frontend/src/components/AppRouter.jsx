import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Homepage from './Homepage';
import ToolLayout from './ToolLayout';
import DyeSpectraViewer from '../DyeSpectraViewer'; // We'll rename App.jsx to this
import EDSParser from './EDSParser';

/**
 * AppRouter - Main routing component for the portal
 * Handles navigation between homepage and individual tools
 */
export default function AppRouter({ onLogout }) {
  // Dark mode state (shared across all components)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('darkMode');
      return stored === 'true';
    }
    return false;
  });

  // Toggle dark mode function
  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const newMode = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('darkMode', newMode);
      }
      return newMode;
    });
  };

  return (
    <Router>
      <Routes>
        {/* Homepage Portal */}
        <Route 
          path="/" 
          element={
            <Homepage 
              onLogout={onLogout} 
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
            />
          } 
        />
        
        {/* Dye Spectra Viewer Tool */}
        <Route 
          path="/tools/dye-spectra-viewer" 
          element={
            <ToolLayout 
              toolName="Fluorescent Dye Spectra Viewer"
              onLogout={onLogout}
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
            >
              <DyeSpectraViewer 
                darkMode={darkMode}
                toggleDarkMode={toggleDarkMode}
              />
            </ToolLayout>
          } 
        />
        
        {/* EDS Parser Tool */}
        <Route 
          path="/tools/eds-parser" 
          element={
            <ToolLayout 
              toolName="EDS File Parser"
              onLogout={onLogout}
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
            >
              <EDSParser 
                darkMode={darkMode}
              />
            </ToolLayout>
          } 
        />
        
        {/* Redirect any unknown routes to homepage */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
