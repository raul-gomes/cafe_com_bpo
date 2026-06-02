import React from 'react';
import { Outlet } from 'react-router-dom';
import { PanelSidebar } from './PanelSidebar';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../../context/AuthContext';

export const PanelLayout: React.FC = () => {
  const { user } = useAuth();

  const primaryColor = user?.company_color_code || '#FBBF24';
  const secondaryColor = user?.company_color_secondary || '#000000';

  return (
    <div className="panel-shell"
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
