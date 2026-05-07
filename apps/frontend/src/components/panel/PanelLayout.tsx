import React from 'react';
import { Outlet } from 'react-router-dom';
import { PanelSidebar } from './PanelSidebar';
import { NotificationBell } from './NotificationBell';

export const PanelLayout: React.FC = () => {
  return (
    <div className="panel-shell">
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
