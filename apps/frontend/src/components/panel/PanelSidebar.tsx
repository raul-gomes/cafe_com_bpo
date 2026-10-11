import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ModalNosAjude } from './ModalNosAjude';
import { ModalReportarErro } from './ModalReportarErro';
import { CafeIcon } from '../../brand/CafeIcon';
import { logoFor, useAppearance } from '../../brand/appearance';
import { HOME_ITEM, NAV_SECTIONS, isItemActive, type NavItem } from './navigation';
import { cn } from '../../lib/utils';

interface PanelSidebarProps {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Chamado ao navegar (fecha a gaveta no celular). */
  onNavigate?: () => void;
  /** Na gaveta do celular o menu é sempre expandido e sem a seta de recolher. */
  variant?: 'rail' | 'drawer';
}

/**
 * Menu lateral do painel no padrão de navegação do kit V4: todas as áreas
 * visíveis, agrupadas por módulo; 240 px aberto / 76 px recolhido (largura
 * controlada pelo .cafe-workspace do PanelLayout) e seta flutuante de 44 px.
 */
export const PanelSidebar: React.FC<PanelSidebarProps> = ({
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
  variant = 'rail',
}) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [{ mode }] = useAppearance();
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const isAdmin = user?.role === 'admin';
  const sections = NAV_SECTIONS.filter(section => !section.adminOnly || isAdmin);
  const compact = variant === 'rail' && collapsed;

  const renderLink = (item: NavItem) => {
    const active = isItemActive(item, pathname);
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        title={compact ? item.label : undefined}
        className={cn(
          'cafe-rail-link min-h-[40px] py-[8px] text-[0.9375rem] no-underline',
          !active && 'text-muted-foreground hover:text-foreground'
        )}
      >
        <CafeIcon name={item.icon} className={cn(active ? 'text-module' : 'opacity-80')} />
        <span className="cafe-rail-label truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      <aside
        className={cn(
          'cafe-rail flex h-screen min-h-0 flex-col overflow-visible',
          // O kit esconde o trilho no celular; o utilitário flex anularia isso.
          variant === 'rail' && 'max-[760px]:hidden'
        )}
        aria-label="Menu do painel"
      >
        {variant === 'rail' && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="cafe-floating-arrow cafe-rail-toggle"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        )}

        {/* Marca: sem símbolo compacto oficial no kit, então some no modo recolhido. */}
        <Link
          to="/painel"
          onClick={onNavigate}
          className="cafe-rail-brand px-[12px] no-underline"
          aria-label="Café com BPO — início do painel"
        >
          <img src={logoFor(mode)} alt="" className="h-auto w-[140px]" />
        </Link>

        <nav className="-mx-[4px] min-h-0 flex-1 overflow-y-auto px-[4px]" aria-label="Áreas">
          <div className="mb-[16px]">{renderLink(HOME_ITEM)}</div>

          {sections.map(section => (
            <div key={section.id} data-cafe-module={section.module} className="mb-[20px]">
              {compact ? (
                <div className="mx-auto mb-[6px] h-[2px] w-[24px] rounded-full bg-module/60" aria-hidden="true" />
              ) : (
                <div className="mb-[6px] flex items-center gap-[8px] px-[12px] text-xs font-bold uppercase tracking-[0.11em] text-muted-foreground">
                  <span className="size-[8px] rounded-full bg-module" aria-hidden="true" />
                  {section.label}
                </div>
              )}
              <div className="flex flex-col gap-[2px]" role="group" aria-label={section.label}>
                {section.items.map(renderLink)}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-[12px] border-t border-border pt-[12px]">
          <FooterButton compact={compact} icon="suporte" label="Reportar erro" onClick={() => setShowReportModal(true)} />
          <FooterButton compact={compact} icon="favorito" label="Nos Ajude" onClick={() => setShowDonateModal(true)} />
          <FooterButton compact={compact} icon="sair" label="Sair da conta" onClick={logout} />
        </div>
      </aside>

      <ModalNosAjude isOpen={showDonateModal} onClose={() => setShowDonateModal(false)} />
      <ModalReportarErro isOpen={showReportModal} onClose={() => setShowReportModal(false)} />
    </>
  );
};

function FooterButton({
  icon,
  label,
  onClick,
  compact,
}: {
  icon: 'suporte' | 'favorito' | 'sair';
  label: string;
  onClick: () => void;
  compact: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      className={cn(
        'flex min-h-[40px] w-full items-center gap-[12px] rounded-lg px-[12px] text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        compact && 'justify-center px-0'
      )}
    >
      <CafeIcon name={icon} className="size-[18px] opacity-80" />
      {!compact && label}
    </button>
  );
}
