import React, { useState } from 'react';
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
};

/* ── Navigation items ── */

const NAV_ITEMS = [
  { path: '/painel', icon: icons.dashboard, label: 'Início', matchExact: true },
  { path: '/painel/empresas', icon: icons.clients, label: 'Meus Clientes' },
  { path: '/painel/templates-atividades', icon: icons.routines, label: 'Rotinas' },
  { path: '/painel/orcamentos', icon: icons.proposals, label: 'Orçamentos' },
  { path: '/painel/tarefas', icon: icons.tasks, label: 'Gestão de Tarefas' },
  { path: '/painel/galeria', icon: icons.gallery, label: 'Galeria de Arquivos' },
  { path: '/painel/forum', icon: icons.forum, label: 'Fórum da Comunidade' },
];

/* ─── Component ─── */

export const PanelSidebar: React.FC<PanelSidebarProps> = ({ isOpen, onClose, theme, onToggleTheme }) => {
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
          'flex h-screen w-[260px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card',
          'fixed left-0 top-0 z-50 transition-transform md:sticky md:z-auto md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Scrollbar styles */}
        <style>{`
          .panel-sidebar-scroll::-webkit-scrollbar { width: 4px; }
          .panel-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
          .panel-sidebar-scroll::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 4px; }
        `}</style>

        {/* Brand */}
        <div
          className="flex cursor-pointer justify-center px-6 py-5"
          onClick={() => navigate('/')}
        >
          <img src={logoSide} alt="Café com BPO" className="h-[50px] w-auto" />
        </div>

        <div className="mx-6 h-px bg-border" />

        {/* Profile */}
        <div className="flex flex-col items-center px-6 py-4 text-center">
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
          <div className="text-[13px] font-bold text-foreground">{user?.name || 'Usuário'}</div>
          <div className="max-w-[180px] truncate text-[11px] text-muted-foreground">{user?.email || ''}</div>
          <button
            className="mt-1 rounded-md px-3 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
            onClick={() => handleNav('/painel/perfil')}
          >
            Editar Perfil
          </button>
        </div>

        <div className="mx-6 h-px bg-border" />

        {/* Navigation */}
        <div className="flex-1 px-3 py-4">
          <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Menu Principal
          </div>
          <nav className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors',
                  isActive(item.path)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-3 py-3">
          <div className="flex flex-col gap-1">
            {user?.role === 'admin' && (
              <SidebarFooterButton
                icon={
                  <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 013.002 3.002L7.368 18.635a2 2 0 01-.855.506l-2.872.838a.5.5 0 01-.62-.62l.838-2.872a2 2 0 01.506-.854z" />
                  </svg>
                }
                label="Design System"
                onClick={() => handleNav('/painel/design-system')}
              />
            )}
              <SidebarFooterButton
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
              icon={
                <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              }
              label="Nos Ajude"
              onClick={() => setShowDonateModal(true)}
            />
          </div>

          <div className="mx-3 mt-2 h-px bg-border" />

          <div className="mt-2 px-3">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <svg className="size-[18px] shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sair da conta
            </button>
            <div className="mt-1 text-[10px] text-muted-foreground">Café com BPO 2026</div>
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
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {icon}
      {label}
    </button>
  );
}
