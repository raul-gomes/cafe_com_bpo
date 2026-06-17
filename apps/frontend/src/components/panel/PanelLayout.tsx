import React, { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { PanelSidebar } from './PanelSidebar';
import { NotificationBell } from './NotificationBell';
import { Toaster } from '../ui/sonner';

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

  return (
    <div className={`panel-shell${theme === 'light' ? ' light-theme' : ''}`}>
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
        <Toaster />
      </main>
    </div>
  );
};
