import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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

        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link to="/simulador" style={{
            color: 'var(--ds-text-muted)', fontSize: '13px', fontWeight: 500,
            padding: '6px 12px', borderRadius: 'var(--radius-md)',
            transition: 'color 0.15s',
            textDecoration: 'none'
          }}
            onMouseOver={e => e.currentTarget.style.color = '#fff'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--ds-text-muted)'}
          >
            Simulador
          </Link>

          {isAuthenticated ? (
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.2s',
                  fontFamily: 'inherit'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                <span>Olá, {user?.name?.split(' ')[0] || 'Usuário'}</span>
                <span style={{ fontSize: '10px', opacity: 0.6 }}>{isMenuOpen ? '▲' : '▼'}</span>
              </button>

              {isMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '160px',
                  background: 'rgba(28,28,30,0.98)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '6px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  zIndex: 10000
                }}>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      color: '#ff453a', // Estilo "Destructive" do iOS/Premium
                      fontSize: '13px',
                      fontWeight: 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,69,58,0.1)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>🚪</span> Sair da conta
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="ds-btn ds-btn-primary ds-btn-sm" style={{ textDecoration: 'none' }}>
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </nav>
  );
};
