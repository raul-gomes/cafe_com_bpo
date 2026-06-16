import React, { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { PanelSidebar } from './PanelSidebar';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../../context/AuthContext';

function getInitialTheme(): 'light' | 'dark' {
    try {
      const stored = localStorage.getItem('cafe_bpo_theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // localStorage may be unavailable
    }
  return 'dark';
}

export const PanelLayout: React.FC = () => {
  const { user } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  useEffect(() => {
    try {
      localStorage.setItem('cafe_bpo_theme', theme);
    } catch {
      // localStorage may be unavailable
    }
    document.documentElement.classList.toggle('light-theme', theme === 'light');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const primaryColor = user?.company_color_code || '#FBBF24';
  const secondaryColor = user?.company_color_secondary || '#000000';

  return (
    <div className={`panel-shell${theme === 'light' ? ' light-theme' : ''}`}
      style={{
        '--ds-primary': primaryColor,
        '--ds-primary-low': `${primaryColor}22`,
        '--ds-primary-text': '#000000',
        '--ds-secondary': secondaryColor,
      } as React.CSSProperties}
    >
      <PanelSidebar 
        isOpen={false} 
        onClose={() => {}}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="panel-content">
        <div style={{
          position: 'fixed', top: 0, right: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 24px',
        }}>
          <NotificationBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
};
