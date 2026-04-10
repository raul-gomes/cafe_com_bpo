import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../../assets/logo.png';

export const Navbar: React.FC = () => {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      height: 'var(--nav-height)',
      backgroundColor: 'rgba(0,0,0,0.92)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', alignItems: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        width: '100%', maxWidth: 'var(--max-width)',
        margin: '0 auto', padding: '0 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <img src={logo} alt="Café com BPO" style={{ height: '28px', width: 'auto' }} />
          <span style={{
            color: '#fff', fontWeight: 700, fontSize: '15px',
            letterSpacing: '-0.3px', fontFamily: 'Inter, sans-serif',
          }}>
            Café com <span style={{ color: 'var(--ds-primary)' }}>BPO</span>
          </span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Link to="/simulador" style={{
            color: 'var(--ds-text-muted)', fontSize: '13px', fontWeight: 500,
            padding: '6px 12px', borderRadius: 'var(--radius-md)',
            transition: 'color 0.15s',
          }}
            onMouseOver={e => e.currentTarget.style.color = '#fff'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--ds-text-muted)'}
          >
            Simulador
          </Link>
          <Link to="/login" className="ds-btn ds-btn-primary ds-btn-sm">
            Entrar
          </Link>
        </nav>
      </div>
    </nav>
  );
};
