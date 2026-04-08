import React from 'react';
import { Link } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 'var(--nav-height)',
    backgroundColor: 'var(--glass-bg)',
    backdropFilter: 'saturate(180%) blur(20px)',
    WebkitBackdropFilter: 'saturate(180%) blur(20px)',
    display: 'flex',
    alignItems: 'center',
    zIndex: 9999,
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  };

  const navContentStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 'var(--max-width)',
    margin: '0 auto',
    padding: '0 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const brandStyle: React.CSSProperties = {
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '17px',
    letterSpacing: '-0.3px',
    textDecoration: 'none'
  };

  return (
    <nav style={containerStyle}>
      <div style={navContentStyle}>
        <Link to="/" style={brandStyle}>Café com BPO</Link>
        <div style={{ display: 'flex', gap: '20px' }}>
          <Link to="/simulador" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>Simulador</Link>
          <Link to="/login" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>Login</Link>
        </div>
      </div>
    </nav>
  );
};
