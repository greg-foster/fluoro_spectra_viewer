import React, { useState } from 'react';

const Login = ({ onLogin, darkMode }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Simple password input handler without animation pausing
  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate a brief loading state for better UX
    setTimeout(() => {
      if (password === 'limitbreak') {
        onLogin();
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className={`login-container ${darkMode ? 'dark' : ''}`}>
      {/* SVG qPCR Curves Animation */}
      <svg className="qpcr-curves" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="gridGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        <g className="grid-lines">
          {[...Array(9)].map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 50} x2="800" y2={i * 50} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          ))}
          {[...Array(17)].map((_, i) => (
            <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="400" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          ))}
        </g>
        
        {/* qPCR Curves - Realistic S-curve amplification patterns */}
        <g className="curves">
          {/* Curve 1 - FAM (Green) - 100k Counts - Earliest amplification - Smooth Bezier curve */}
          <path 
            className="qpcr-curve fam-curve"
            d="M50,350 C75,350 100,350 125,349.5 C150,349 165,348 175,345 C185,342 195,335 205,325 C215,315 225,300 235,280 C245,260 255,235 265,210 C275,185 285,160 295,140 C305,120 315,105 325,95 C335,85 350,85 375,85 C400,85 450,85 500,85 C550,85 600,85 650,85 C700,85 725,85 750,85"
            fill="none"
            stroke="#00ff00"
            strokeWidth="2.5"
            opacity="0.9"
          />
          
          {/* Curve 2 - HEX (Yellow) - 10k Counts - Second earliest - Smooth Bezier curve */}
          <path 
            className="qpcr-curve hex-curve"
            d="M50,350 C75,350 100,350 125,350 C150,350 175,350 190,349.5 C205,349 215,348 225,345 C235,342 245,335 255,325 C265,315 275,300 285,280 C295,260 305,235 315,210 C325,185 335,160 345,140 C355,120 365,105 375,95 C385,85 400,85 425,85 C450,85 500,85 550,85 C600,85 650,85 700,85 C725,85 737.5,85 750,85"
            fill="none"
            stroke="#ffff00"
            strokeWidth="2.5"
            opacity="0.9"
          />
          
          {/* Curve 3 - Texas Red (Red) - 1k Counts - Middle amplification - Smooth Bezier curve */}
          <path 
            className="qpcr-curve texasred-curve"
            d="M50,350 C75,350 100,350 125,350 C150,350 175,350 200,350 C225,350 250,350 265,349.5 C280,349 290,348 300,345 C310,342 320,335 330,325 C340,315 350,300 360,280 C370,260 380,235 390,210 C400,185 410,160 420,140 C430,120 440,105 450,95 C460,85 475,85 500,85 C525,85 550,85 600,85 C650,85 700,85 725,85 C737.5,85 743.75,85 750,85"
            fill="none"
            stroke="#ff0000"
            strokeWidth="2.5"
            opacity="0.9"
          />
          
          {/* Curve 4 - Cy5 (Blue) - 100 Counts - Late amplification - Smooth Bezier curve */}
          <path 
            className="qpcr-curve cy5-curve"
            d="M50,350 C75,350 100,350 125,350 C150,350 175,350 200,350 C225,350 250,350 275,350 C300,350 325,350 340,349.5 C355,349 365,348 375,345 C385,342 395,335 405,325 C415,315 425,300 435,280 C445,260 455,235 465,210 C475,185 485,160 495,140 C505,120 515,105 525,95 C535,85 550,85 575,85 C600,85 625,85 650,85 C675,85 700,85 725,85 C737.5,85 743.75,85 750,85"
            fill="none"
            stroke="#0080ff"
            strokeWidth="2.5"
            opacity="0.9"
          />
          
          {/* Curve 5 - ROX (Orange) - 50 Counts - Latest amplification - Smooth Bezier curve */}
          <path 
            className="qpcr-curve rox-curve"
            d="M50,350 C75,350 100,350 125,350 C150,350 175,350 200,350 C225,350 250,350 275,350 C300,350 325,350 350,350 C375,350 400,350 415,349.5 C430,349 440,348 450,345 C460,342 470,335 480,325 C490,315 500,300 510,280 C520,260 530,235 540,210 C550,185 560,160 570,140 C580,120 590,105 600,95 C610,85 625,85 650,85 C675,85 700,85 725,85 C737.5,85 743.75,85 750,85"
            fill="none"
            stroke="#ff8000"
            strokeWidth="2.5"
            opacity="0.9"
          />
        </g>
      </svg>
      
      <div className="login-box">
        <div className="login-header">
          <h1>qPCR Tools</h1>
          <p>Please enter the password to access the application</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="Enter password"
              disabled={isLoading}
              autoFocus
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button 
            type="submit" 
            disabled={isLoading || !password.trim()}
            className="login-button"
          >
            {isLoading ? 'Authenticating...' : 'Access Application'}
          </button>
        </form>
        
        <div className="login-footer">
          <p>© 2025 Foster's Foundries</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
