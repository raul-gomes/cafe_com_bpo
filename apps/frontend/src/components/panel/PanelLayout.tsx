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

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem('cafe_bpo_sidebar_collapsed') === '1';
  } catch {
    return false;
  }
}

export const PanelLayout: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [collapsed, setCollapsed] = useState<boolean>(getInitialCollapsed);

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

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('cafe_bpo_sidebar_collapsed', next ? '1' : '0');
      } catch {
        // localStorage may be unavailable
      }
      return next;
    });
  }, []);

  return (
    <div className={`grid h-screen w-screen overflow-hidden${theme === 'light' ? ' light-theme' : ''}`}
      style={{ gridTemplateColumns: collapsed ? '72px 1fr' : '260px 1fr', gridTemplateRows: '1fr' }}>
      <aside className="col-start-1 row-start-1">
        <PanelSidebar 
          isOpen={false} 
          onClose={() => {}}
          theme={theme}
          onToggleTheme={toggleTheme}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>
      <main className="panel-main relative col-start-2 row-start-1 overflow-y-auto bg-background p-7 text-foreground">
        <div className="fixed right-0 top-0 z-100 flex items-center gap-2 px-6 py-3">
          <NotificationBell />
        </div>
        <Outlet />
        <Toaster />
      </main>
    </div>
  );
};
