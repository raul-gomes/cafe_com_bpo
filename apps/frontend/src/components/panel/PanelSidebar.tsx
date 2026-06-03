import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoSide from '../../assets/logo-side.png';
import { ModalNosAjude } from './ModalNosAjude';
import { ModalReportarErro } from './ModalReportarErro';

interface PanelSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PanelSidebar: React.FC<PanelSidebarProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  const isActive = (path: string) => {
    if (path === '/painel' && (location.pathname === '/painel' || location.pathname === '/painel/')) return true;
    if (path !== '/painel' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      <div 
        className={`panel-sidebar-overlay ${isOpen ? 'visible' : ''}`} 
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`panel-sidebar ${isOpen ? 'open' : ''}`}>
        <div 
          className="panel-sidebar__brand" 
          style={{ justifyContent: 'center', padding: '20px 0', cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          <img src={logoSide} alt="Café com BPO" style={{ height: '50px', width: 'auto' }} />
        </div>

        <div className="panel-sidebar__divider" />

        <div className="panel-sidebar__profile">
          <div 
            className="panel-sidebar__avatar"
            style={user?.avatar_url ? { 
              backgroundImage: `url(${user.avatar_url})`, 
              backgroundSize: 'cover', 
              backgroundPosition: 'center', 
              color: 'transparent',
              border: '1px solid var(--ds-border)'
            } : {}}
          >
            {!user?.avatar_url && initials}
          </div>
          <div className="panel-sidebar__user-info">
            <div className="panel-sidebar__user-name">{user?.name || 'Usuário'}</div>
            <div className="panel-sidebar__user-email">{user?.email || ''}</div>
          </div>
          <button 
            className="panel-sidebar__edit-btn"
            onClick={() => handleNav('/painel/perfil')}
          >
            Editar Perfil
          </button>
        </div>

        <div className="panel-sidebar__section">
          <div className="panel-sidebar__section-title">Menu Principal</div>
          <nav className="panel-sidebar__nav">
            <button
              className={`panel-sidebar__nav-item ${isActive('/painel') && !isActive('/painel/perfil') && !isActive('/painel/galeria') && !isActive('/painel/novo-orcamento') && !isActive('/painel/tarefas') && !isActive('/painel/orcamentos') && !isActive('/painel/templates-atividades') ? 'active' : ''}`}
              onClick={() => handleNav('/painel')}
            >
              <svg className="panel-sidebar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              Início
            </button>

            <button
              className={`panel-sidebar__nav-item ${isActive('/painel/empresas') ? 'active' : ''}`}
              onClick={() => handleNav('/painel/empresas')}
            >
              <svg className="panel-sidebar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
              </svg>
              Meus Clientes
            </button>

            <button
              className={`panel-sidebar__nav-item ${isActive('/painel/templates-atividades') ? 'active' : ''}`}
              onClick={() => handleNav('/painel/templates-atividades')}
            >
              <svg className="panel-sidebar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Rotinas
            </button>

            <button
              className={`panel-sidebar__nav-item ${isActive('/painel/orcamentos') ? 'active' : ''}`}
              onClick={() => handleNav('/painel/orcamentos')}
            >
              <svg className="panel-sidebar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
              Orçamentos
            </button>

            <button
              className={`panel-sidebar__nav-item ${isActive('/painel/tarefas') ? 'active' : ''}`}
              onClick={() => handleNav('/painel/tarefas')}
            >
              <svg className="panel-sidebar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
              Gestão de Tarefas
            </button>

            <button
              className={`panel-sidebar__nav-item ${isActive('/painel/galeria') ? 'active' : ''}`}
              onClick={() => handleNav('/painel/galeria')}
            >
              <svg className="panel-sidebar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              Galeria de Arquivos
            </button>

            <button
              className={`panel-sidebar__nav-item ${isActive('/painel/forum') ? 'active' : ''}`}
              onClick={() => handleNav('/painel/forum')}
            >
              <svg className="panel-sidebar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
              </svg>
              Fórum da Comunidade
            </button>
          </nav>
        </div>

        <div className="panel-sidebar__donate-section">
          <button className="panel-sidebar__donate-btn" onClick={() => setShowReportModal(true)}>
            <svg className="panel-sidebar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Reportar erro
          </button>
          <button className="panel-sidebar__donate-btn" onClick={() => setShowDonateModal(true)}>
            <svg className="panel-sidebar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            Nos Ajude
          </button>
        </div>

        <div className="panel-sidebar__divider" />

        <div className="panel-sidebar__footer">
          <button className="panel-sidebar__logout-btn" onClick={logout}>
            <svg className="panel-sidebar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair da conta
          </button>
          <div className="panel-sidebar__footer-copy">Café com BPO 2026</div>
        </div>
      </aside>

      <ModalNosAjude isOpen={showDonateModal} onClose={() => setShowDonateModal(false)} />
      <ModalReportarErro isOpen={showReportModal} onClose={() => setShowReportModal(false)} />
    </>
  );
};
