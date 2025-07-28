import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Homepage.css';

/**
 * Homepage Portal - Main landing page after login
 * Displays available tools/apps that users can access
 */
export default function Homepage({ onLogout, darkMode, toggleDarkMode }) {
  const navigate = useNavigate();

  // Available tools/apps in the portal
  const tools = [
    {
      id: 'dye-spectra-viewer',
      name: 'Fluorescent Dye Spectra Viewer',
      description: 'Visualize excitation/emission spectra of fluorescent dyes and manage optical filters',
      icon: '🔬',
      color: '#E31E24',
      path: '/tools/dye-spectra-viewer'
    },
    {
      id: 'dpcr-calculator',
      name: 'dPCR Resolution & Capability Calculator',
      description: 'Calculate digital PCR resolution and capability parameters for optimal assay design (Coming Soon)',
      icon: '🧬',
      color: '#B71C1C',
      path: null,
      comingSoon: true
    }
  ];

  const handleToolClick = (tool) => {
    if (tool.comingSoon) {
      alert(`${tool.name} is coming soon! Stay tuned for updates.`);
      return;
    }
    navigate(tool.path);
  };

  return (
    <div className={`homepage-container${darkMode ? ' dark' : ''}`}>
      {/* Header */}
      <header className="homepage-header">
        <div className="header-content">
          <h1 className="homepage-title">
            <span className="title-icon">🔬</span>
            qPCR Tools Portal
          </h1>
          <p className="homepage-subtitle">
            Advanced scientific solutions for laboratory excellence
          </p>
        </div>
        <div className="header-buttons">
          <button 
            onClick={toggleDarkMode}
            className="dark-mode-button"
          >
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button 
            onClick={onLogout}
            className="logout-button"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Tools Grid */}
      <main className="tools-grid">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className={`tool-card${tool.comingSoon ? ' coming-soon' : ''}`}
            onClick={() => handleToolClick(tool)}
            style={{ '--tool-color': tool.color }}
          >
            <div className="tool-icon">{tool.icon}</div>
            <h3 className="tool-name">{tool.name}</h3>
            <p className="tool-description">{tool.description}</p>
            {tool.comingSoon && (
              <div className="coming-soon-badge">Coming Soon</div>
            )}
            {!tool.comingSoon && (
              <div className="tool-action">
                <span>Launch Tool →</span>
              </div>
            )}
          </div>
        ))}
      </main>

      {/* Footer */}
      <footer className="homepage-footer">
        <p>Select a tool above to get started with your analysis</p>
      </footer>
    </div>
  );
}
