import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getClients, ClientData } from '../../api/clients';
import logoSide from '../../assets/logo-side.png';

interface PanelSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PanelSidebar: React.FC<PanelSidebarProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(() => {
    return localStorage.getItem('activeCompanyId');
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const activeCompany = clients.find(c => c.id === activeCompanyId) || clients[0] || null;

  useEffect(() => {
    const loadClients = async () => {
      try {
        setLoadingClients(true);
        const data = await getClients();
        setClients(data);
        if (data.length > 0 && !activeCompanyId) {
          setActiveCompanyId(data[0].id);
        }
      } catch (err) {
        console.error('Erro ao carregar empresas:', err);
      } finally {
        setLoadingClients(false);
      }
    };
    loadClients();
  }, [activeCompanyId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeCompany) {
      localStorage.setItem('activeCompanyId', activeCompany.id);
    }
  }, [activeCompany]);

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleCompanySelect = (clientId: string) => {
    setActiveCompanyId(clientId);
    setDropdownOpen(false);
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

        <div className="panel-sidebar__company-selector" ref={dropdownRef}>
          <button 
            className="panel-sidebar__company-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            {loadingClients ? (
              <div className="panel-sidebar__company-loading" />
            ) : activeCompany ? (
              <>
                <div 
                  className="panel-sidebar__company-color" 
                  style={{ backgroundColor: activeCompany.color || '#4287f5' }} 
                />
                <span className="panel-sidebar__company-name">{activeCompany.name}</span>
              </>
            ) : (
              <span className="panel-sidebar__company-name">Nenhuma empresa</span>
            )}
            <svg 
              className={`panel-sidebar__company-arrow ${dropdownOpen ? 'open' : ''}`} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="panel-sidebar__company-dropdown">
              {clients.map(client => (
                <button
                  key={client.id}
                  className={`panel-sidebar__company-option ${client.id === activeCompany?.id ? 'active' : ''}`}
                  onClick={() => handleCompanySelect(client.id)}
                >
                  <div 
                    className="panel-sidebar__company-color" 
                    style={{ backgroundColor: client.color || '#4287f5' }} 
                  />
                  <span>{client.name}</span>
                  {client.id === activeCompany?.id && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
              <div className="panel-sidebar__company-divider" />
              <button 
                className="panel-sidebar__company-option panel-sidebar__company-new"
                onClick={() => { setDropdownOpen(false); handleNav('/painel/empresas'); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Nova Empresa
              </button>
            </div>
          )}
        </div>

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
              className={`panel-sidebar__nav-item ${isActive('/painel/roi-calculadora') || isActive('/painel/roi-historico') ? 'active' : ''}`}
              onClick={() => handleNav('/painel/roi-historico')}
            >
              <svg className="panel-sidebar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20V10M18 20V4M6 20v-4" />
              </svg>
              Calculadora ROI
            </button>

            <button
              className={`panel-sidebar__nav-item ${isActive('/painel/empresas') ? 'active' : ''}`}
              onClick={() => handleNav('/painel/empresas')}
            >
              <svg className="panel-sidebar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
              </svg>
              Minhas Empresas
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

            <button
              className={`panel-sidebar__nav-item ${isActive('/painel/ferramentas-ia') ? 'active' : ''}`}
              onClick={() => handleNav('/painel/ferramentas-ia')}
            >
              <svg className="panel-sidebar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                <path d="M12 2a10 10 0 0 1 10 10" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Ferramentas IA
            </button>
          </nav>
        </div>

        <div className="panel-sidebar__footer">
          <a href="https://youtube.com/@cafecombpo" target="_blank" rel="noopener noreferrer" className="panel-sidebar__social-link" title="YouTube">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
              <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
            </svg>
            YouTube
          </a>
          <button className="panel-sidebar__donate-btn" onClick={() => window.location.href = '/#nos-ajude'}>
            <svg className="panel-sidebar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            Nos Ajude
          </button>
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
