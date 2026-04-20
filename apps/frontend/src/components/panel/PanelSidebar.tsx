import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoSide from '../../assets/logo-side.png';

interface PanelSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PanelSidebar: React.FC<PanelSidebarProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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

        <div className="panel-sidebar__profile">
          <div className="panel-sidebar__avatar">{initials}</div>
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
              className={`panel-sidebar__nav-item ${isActive('/painel') && !isActive('/painel/perfil') && !isActive('/painel/galeria') && !isActive('/painel/novo-orcamento') && !isActive('/painel/tarefas') && !isActive('/painel/orcamentos') ? 'active' : ''}`}
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
              className={`panel-sidebar__nav-item ${isActive('/painel/orcamentos') ? 'active' : ''}`}
              onClick={() => handleNav('/painel/orcamentos')}
            >
              <svg className="panel-sidebar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
              Orçamentos
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
    </>
  );
};
