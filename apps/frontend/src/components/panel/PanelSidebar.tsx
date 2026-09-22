import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoSide from '../../assets/logo-side.png';
import { ModalNosAjude } from './ModalNosAjude';
import { ModalReportarErro } from './ModalReportarErro';
import { cn } from '../../lib/utils';

interface PanelSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

/* ── SVG icon components (kept as-is from original) ── */

const icons = {
  dashboard: (
    <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  clients: (
    <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
    </svg>
  ),
  routines: (
    <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  proposals: (
    <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  tasks: (
    <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  gallery: (
    <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  ),
  forum: (
    <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
    </svg>
  ),
  contracts: (
    <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  contacts: (
    <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  payments: (
    <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  teams: (
    <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  projects: (
    <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <path d="M3 7h18" />
    </svg>
  ),
  design: (
    <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 013.002 3.002L7.368 18.635a2 2 0 01-.855.506l-2.872.838a.5.5 0 01-.62-.62l.838-2.872a2 2 0 01.506-.854z" />
    </svg>
  ),
  menu: {
    operacional: (
      <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M17 16v4M15 18h4" />
      </svg>
    ),
    captar: (
      <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="9" />
      </svg>
    ),
    comunidade: (
      <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
    gestao: (
      <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M3 12h18M3 18h18" /><circle cx="8" cy="6" r="2" fill="var(--card)" /><circle cx="16" cy="12" r="2" fill="var(--card)" /><circle cx="12" cy="18" r="2" fill="var(--card)" />
      </svg>
    ),
    config: (
      <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
} as const;

/* ── Menu structure ──
   Dropdown abaixo de "Editar Perfil": o usuário escolhe o menu e a
   sidebar renderiza os submenus daquele menu. Config é admin-only. */

interface NavItem {
  path: string;
  icon: React.ReactNode;
  label: string;
}

interface MenuConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  items: NavItem[];
}

const NAV_MENUS: MenuConfig[] = [
  {
    id: 'operacional',
    label: 'Operacional',
    icon: icons.menu.operacional,
    items: [
      { path: '/painel/tarefas', icon: icons.tasks, label: 'Gestor de Tarefas' },
      { path: '/painel/templates-atividades', icon: icons.routines, label: 'Rotinas' },
      { path: '/painel/empresas', icon: icons.clients, label: 'Clientes' },
    ],
  },
  {
    id: 'captar',
    label: 'Captar',
    icon: icons.menu.captar,
    items: [
      { path: '/painel/orcamentos', icon: icons.proposals, label: 'Orçamentos' },
      { path: '/painel/contratos', icon: icons.contracts, label: 'Contratos' },
      { path: '/painel/contatos', icon: icons.contacts, label: 'Contatos' },
      { path: '/painel/pagamentos', icon: icons.payments, label: 'Pagamentos' },
    ],
  },
  {
    id: 'comunidade',
    label: 'Comunidade',
    icon: icons.menu.comunidade,
    items: [
      { path: '/painel/forum', icon: icons.forum, label: 'Forum' },
      { path: '/painel/galeria', icon: icons.gallery, label: 'Galeria de Arquivos' },
    ],
  },
  {
    id: 'gestao',
    label: 'Gestão',
    icon: icons.menu.gestao,
    items: [
      { path: '/painel/projetos', icon: icons.projects, label: 'Projetos' },
      { path: '/painel/gestao-equipes', icon: icons.teams, label: 'Gestão de equipes' },
    ],
  },
  {
    id: 'config',
    label: 'Config',
    icon: icons.menu.config,
    adminOnly: true,
    items: [
      { path: '/painel/design-system', icon: icons.design, label: 'Design System' },
    ],
  },
];

/* ─── Component ─── */

export const PanelSidebar: React.FC<PanelSidebarProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  collapsed = false,
  onToggleCollapsed,
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string>(() => {
    const saved = localStorage.getItem('cafe_bpo_active_menu');
    return saved || 'operacional';
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'admin';
  const visibleMenus = NAV_MENUS.filter((menu) => !menu.adminOnly || isAdmin);
  const activeMenu = visibleMenus.find((menu) => menu.id === activeMenuId) ?? visibleMenus[0];

  useEffect(() => {
    try {
      localStorage.setItem('cafe_bpo_active_menu', activeMenuId);
    } catch {
      // localStorage may be unavailable
    }
  }, [activeMenuId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleSelectMenu = (menu: MenuConfig) => {
    setActiveMenuId(menu.id);
    setMenuOpen(false);
    // Sempre seleciona (navega para) a primeira opção do submenu do menu escolhido
    if (menu.items.length > 0) {
      navigate(menu.items[0].path);
      onClose();
    }
  };

  const isActive = (path: string) => {
    if (path === '/painel' && (location.pathname === '/painel' || location.pathname === '/painel/')) return true;
    return path !== '/painel' && location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Overlay (mobile) */}
      <div
        className={cn(
          'fixed inset-0 z-40 hidden bg-black/50',
          isOpen && 'block md:hidden'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={cn(
          'flex h-screen shrink-0 flex-col overflow-y-auto border-r border-border bg-card',
          'fixed left-0 top-0 z-50 transition-[width,transform] duration-200 md:sticky md:z-auto md:translate-x-0',
          collapsed ? 'w-[72px]' : 'w-[260px]',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Scrollbar styles */}
        <style>{`
          .panel-sidebar-scroll::-webkit-scrollbar { width: 4px; }
          .panel-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
          .panel-sidebar-scroll::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 4px; }
        `}</style>

        {/* Brand + collapse toggle */}
        <div className={cn('relative flex items-center py-5', collapsed ? 'justify-center px-2' : 'justify-center px-6')}>
          <div className="flex cursor-pointer items-center justify-center" onClick={() => navigate('/')}>
            <img src={logoSide} alt="Café com BPO" className={cn('h-[50px] w-auto', collapsed && 'hidden')} />
            {collapsed && <span className="text-[20px] font-extrabold text-primary-strong">CB</span>}
          </div>
          <button
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className={cn(
              'absolute top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              collapsed ? 'right-[18px]' : '-right-3 border border-border bg-card shadow-sm'
            )}
          >
            {collapsed ? (
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            ) : (
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            )}
          </button>
        </div>

        <div className={cn('h-px bg-border', collapsed ? 'mx-2' : 'mx-6')} />

        {/* Profile */}
        <div className={cn('flex flex-col items-center text-center', collapsed ? 'px-2 py-3' : 'px-6 py-4')}>
          <div
            className="mb-2 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-[11px] font-extrabold text-primary-foreground ring-2 ring-background"
            style={user?.avatar_url ? {
              backgroundImage: `url(${user.avatar_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              color: 'transparent',
            } : {}}
          >
            {!user?.avatar_url && initials}
          </div>
          {!collapsed && (
            <>
              <div className="text-[13px] font-bold text-foreground">{user?.name || 'Usuário'}</div>
              <div className="max-w-[180px] truncate text-[11px] text-muted-foreground">{user?.email || ''}</div>
              <button
                className="mt-1 rounded-md px-3 py-1 text-[11px] font-semibold text-primary-strong transition-colors hover:bg-primary/10"
                onClick={() => handleNav('/painel/perfil')}
              >
                Editar Perfil
              </button>
            </>
          )}
        </div>

        <div className={cn('h-px bg-border', collapsed ? 'mx-2' : 'mx-6')} />

        {/* Menu selector (below Editar Perfil) */}
        <div className={cn('py-3', collapsed ? 'px-2' : 'px-3')} ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Selecionar menu"
            title={collapsed ? activeMenu.label : undefined}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-[12px] font-bold text-foreground transition-colors hover:bg-muted',
              collapsed && 'justify-center px-0'
            )}
          >
            {activeMenu.icon}
            {!collapsed && (
              <>
                <span className="flex-1 truncate">{activeMenu.label}</span>
                <svg className={cn('size-4 shrink-0 text-muted-foreground transition-transform', menuOpen && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </>
            )}
          </button>

          {/* Dropdown */}
          {menuOpen && !collapsed && (
            <div className="absolute z-50 mt-1 w-[236px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg ring-1 ring-foreground/10">
              {visibleMenus.map((menu) => (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => handleSelectMenu(menu)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors',
                    menu.id === activeMenu.id
                      ? 'bg-primary/10 text-primary-strong'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {menu.icon}
                  {menu.label}
                  {menu.id === activeMenu.id && (
                    <svg className="ml-auto size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={cn('h-px bg-border', collapsed ? 'mx-2' : 'mx-6')} />

        {/* Navigation — submenus of active menu */}
        <div className={cn('flex-1 py-4', collapsed ? 'px-2' : 'px-3')}>
          <nav className="flex flex-col gap-0.5">
            {activeMenu.items.map((item) => (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                title={collapsed ? item.label : undefined}
                aria-label={item.label}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors',
                  collapsed ? 'justify-center px-0' : '',
                  isActive(item.path)
                    ? 'bg-primary/10 text-primary-strong'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {item.icon}
                {!collapsed && item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-3 py-3">
          <div className="flex flex-col gap-1">
              <SidebarFooterButton
              collapsed={collapsed}
              icon={
                theme === 'light' ? (
                  <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.36" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                )
              }
              label={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
              onClick={() => onToggleTheme?.()}
            />
            <SidebarFooterButton
              collapsed={collapsed}
              icon={
                <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              }
              label="Reportar erro"
              onClick={() => setShowReportModal(true)}
            />
            <SidebarFooterButton
              collapsed={collapsed}
              icon={
                <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              }
              label="Nos Ajude"
              onClick={() => setShowDonateModal(true)}
            />
          </div>

          <div className={cn('mx-3 mt-2 h-px bg-border', collapsed && 'mx-0')} />

          <div className="mt-2 px-3">
            <button
              onClick={logout}
              title={collapsed ? 'Sair da conta' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10',
                collapsed && 'justify-center px-0'
              )}
            >
              <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {!collapsed && 'Sair da conta'}
            </button>
            {!collapsed && <div className="mt-1 text-[10px] text-muted-foreground">Café com BPO 2026</div>}
          </div>
        </div>
      </aside>

      <ModalNosAjude isOpen={showDonateModal} onClose={() => setShowDonateModal(false)} />
      <ModalReportarErro isOpen={showReportModal} onClose={() => setShowReportModal(false)} />
    </>
  );
};

/* ─── Footer button helper ─── */

function SidebarFooterButton({
  icon,
  label,
  onClick,
  collapsed = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  collapsed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        collapsed && 'justify-center px-0'
      )}
    >
      {icon}
      {!collapsed && label}
    </button>
  );
}