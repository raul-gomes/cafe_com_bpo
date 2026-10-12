import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAccess } from '../../api/hooks/useAccess';
import { ModalNosAjude } from './ModalNosAjude';
import { ModalReportarErro } from './ModalReportarErro';
import { CafeIcon, type CafeIconName } from '../../brand/CafeIcon';
import { BrandLogo } from '../../brand/BrandLogo';
import { HOME_ITEM, NAV_SECTIONS, activeItemPath, type NavItem, type NavSection } from './navigation';
import { cn } from '../../lib/utils';

interface PanelSidebarProps {
  /** Work module shown in the menu (the last one chosen, also on Home). */
  activeSection: NavSection;
  /** Whether the current screen belongs to a module (outside one, the logo keeps its official color). */
  inModule: boolean;
  onSelectSection: (section: NavSection) => void;
  /** Called on navigation (closes the mobile drawer). */
  onNavigate?: () => void;
}

/**
 * Panel menu: one work module at a time. The tabs on top switch the module and
 * wrap into rows as more modules arrive; the list below belongs to that module
 * only and ends with the account actions, scrolling along. Width (full / icons
 * only / hidden) comes from PanelLayout.
 *
 * @returns The menu.
 */
export const PanelSidebar: React.FC<PanelSidebarProps> = ({ activeSection, inModule, onSelectSection, onNavigate }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const { data: access } = useAccess();
  // Plan write gate (GET /access): on the free plan "captar" and "gestao" are view-only.
  // The lock is informative — navigation stays open; the server blocks the write.
  const readOnly = new Set(access?.read_only_modules ?? []);
  const isAdmin = user?.role === 'admin';
  const sections = NAV_SECTIONS.filter(section => !section.adminOnly || isAdmin);

  const selectSection = (section: NavSection) => {
    onSelectSection(section);
    // Entering a module opens its first area.
    if (section.items.length > 0) {
      navigate(section.items[0].path);
      onNavigate?.();
    }
  };

  const activePath = activeItemPath(activeSection.items, pathname);

  const renderLink = (item: NavItem) => {
    const active = item.path === activePath;
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        title={item.label}
        className={cn('cafe-rail-link panel-rail-link no-underline', !active && 'text-muted-foreground hover:text-foreground')}
      >
        <CafeIcon name={item.icon} className={active ? 'text-module' : 'opacity-80'} />
        <span className="cafe-rail-label flex-1 truncate">{item.label}</span>
        {item.gate && readOnly.has(item.gate) && (
          <span className="panel-item-lock cafe-rail-label" aria-label="Somente leitura no plano gratuito" />
        )}
      </Link>
    );
  };

  return (
    <>
      <aside className="cafe-rail panel-rail flex h-full min-h-0 flex-col" aria-label="Menu do painel">
        {/* The café logo opens the main panel: the macro view of the day and the business. */}
        <Link
          to={HOME_ITEM.path}
          onClick={onNavigate}
          className="panel-rail-brand no-underline"
          title="Painel principal"
          aria-label="Café com BPO — painel principal"
        >
          <BrandLogo module={inModule ? activeSection.module : undefined} className="panel-brand-full w-[124px]" />
          <span className="panel-brand-compact" aria-hidden="true">
            <CafeIcon name="xicara" className="size-[22px]" />
          </span>
        </Link>

        {/* Module tabs: they wrap into rows on their own when new modules arrive. */}
        <div className="panel-module-tabs" role="tablist" aria-label="Módulo de trabalho">
          {sections.map(section => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={section.id === activeSection.id}
              aria-label={readOnly.has(section.id) ? `${section.label} (assinatura para criar e enviar)` : section.label}
              title={readOnly.has(section.id) ? `${section.label} · criar e enviar exige assinatura` : section.label}
              data-cafe-module={section.module}
              onClick={() => selectSection(section)}
              className="panel-module-tab"
            >
              <CafeIcon name={section.icon} className="size-[20px]" />
              {readOnly.has(section.id) && <span className="panel-module-tab-lock" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <div className="panel-module-name cafe-rail-label" data-cafe-module={activeSection.module}>
          {activeSection.label}
        </div>

        <nav className="panel-thin-scroll -mx-[4px] min-h-0 flex-1 overflow-y-auto px-[4px]" aria-label={`Áreas de ${activeSection.label}`}>
          <div className="flex flex-col gap-[2px]">{activeSection.items.map(renderLink)}</div>

          {/* Account actions at the end of the list (scroll along, no fixed space taken). */}
          <div className="mt-[12px] flex flex-col gap-[2px] border-t border-border/70 pt-[10px]">
            <ActionRow icon="suporte" label="Reportar erro" onClick={() => setShowReportModal(true)} />
            <ActionRow icon="coracao" label="Colabore" onClick={() => setShowDonateModal(true)} />
            <ActionRow icon="sair" label="Sair da conta" onClick={logout} />
          </div>
        </nav>
      </aside>

      <ModalNosAjude isOpen={showDonateModal} onClose={() => setShowDonateModal(false)} />
      <ModalReportarErro isOpen={showReportModal} onClose={() => setShowReportModal(false)} />
    </>
  );
};

function ActionRow({ icon, label, onClick }: { icon: CafeIconName; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="cafe-rail-link panel-rail-link w-full border-0 bg-transparent text-left text-muted-foreground hover:text-foreground"
    >
      <CafeIcon name={icon} className="opacity-80" />
      <span className="cafe-rail-label truncate">{label}</span>
    </button>
  );
}
