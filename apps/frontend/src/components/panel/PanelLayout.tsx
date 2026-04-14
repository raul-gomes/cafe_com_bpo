import React from 'react';
import { Outlet } from 'react-router-dom';
import { PanelSidebar } from './PanelSidebar';

export const PanelLayout: React.FC = () => {
  return (
    <div className="panel-shell">
      <PanelSidebar 
        isOpen={false} 
        onClose={() => {}} 
      />
      <main className="panel-content">
        <Outlet />
      </main>
    </div>
  );
};
