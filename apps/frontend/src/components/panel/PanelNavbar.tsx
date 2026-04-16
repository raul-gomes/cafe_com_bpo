import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NotificationBell } from './NotificationBell';

interface PanelNavbarProps {
  title: string;
  onToggleSidebar: () => void;
}

export const PanelNavbar: React.FC<PanelNavbarProps> = ({ title, onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="panel-navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Mobile hamburger */}
        <button 
          className="panel-mobile-toggle" 
          onClick={onToggleSidebar}
          aria-label="Abrir menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="panel-navbar__title">{title}</h1>
      </div>

      <div className="panel-navbar__actions" style={{ display: 'flex', alignItems: 'center' }}>
        <NotificationBell />

        {/* User Avatar with Dropdown */}
        <div className="panel-navbar__user" ref={dropdownRef}>
          <button 
            className="panel-navbar__avatar-btn"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-label="Menu do usuário"
          >
            {initials}
          </button>

          {isDropdownOpen && (
            <div className="panel-navbar__dropdown">
              <div className="panel-navbar__dropdown-header">
                <div className="panel-navbar__dropdown-name">{user?.name}</div>
                <div className="panel-navbar__dropdown-email">{user?.email}</div>
              </div>
              <div className="panel-navbar__dropdown-divider" />
              <button 
                className="panel-navbar__dropdown-item"
                onClick={() => {
                  navigate('/painel/perfil');
                  setIsDropdownOpen(false);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Meu Perfil
              </button>
              <button 
                className="panel-navbar__dropdown-item panel-navbar__dropdown-item--logout"
                onClick={handleLogout}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sair da conta
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
