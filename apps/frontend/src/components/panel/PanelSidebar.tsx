import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ModalNosAjude } from './ModalNosAjude';
import { ModalReportarErro } from './ModalReportarErro';
import { CafeIcon } from '../../brand/CafeIcon';
import { BrandLogo } from '../../brand/BrandLogo';
import { HOME_ITEM, NAV_SECTIONS, isItemActive, type NavItem, type NavSection } from './navigation';
import { cn } from '../../lib/utils';

interface PanelSidebarProps {
  /** Módulo de trabalho em que a pessoa está (define itens e cor do menu). */
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  /** Chamado ao navegar (fecha a gaveta no celular). */
  onNavigate?: () => void;
}

/**
 * Menu do painel: um módulo de trabalho por vez. As abas de fichário no topo
 * trocam o módulo; tudo abaixo (cabeçalho, itens, tom de fundo) passa a ser
 * daquele módulo. A largura (aberto/retraído) é do .cafe-workspace no PanelLayout.
 */
export const PanelSidebar: React.FC<PanelSidebarProps> = ({ activeSection, onSelectSection, onNavigate }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const isAdmin = user?.role === 'admin';
  const sections = NAV_SECTIONS.filter(section => !section.adminOnly || isAdmin);
  const homeActive = isItemActive(HOME_ITEM, pathname);

  const selectSection = (section: NavSection) => {
    onSelectSection(section);
    // Entrar num módulo leva à primeira área dele.
    if (section.items.length > 0) {
      navigate(section.items[0].path);
      onNavigate?.();
    }
  };

  const renderLink = (item: NavItem) => {
    const active = isItemActive(item, pathname);
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'cafe-rail-link panel-rail-link min-h-[42px] py-[9px] text-[0.9375rem] no-underline',
          !active && 'text-muted-foreground hover:text-foreground'
        )}
      >
        <CafeIcon name={item.icon} className={cn(active ? 'text-module' : 'opacity-80')} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      <aside
        className="cafe-rail panel-rail flex h-full min-h-0 flex-col"
        data-cafe-module={activeSection.module}
        aria-label="Menu do painel"
      >
        <Link
          to={HOME_ITEM.path}
          onClick={onNavigate}
          className="cafe-rail-brand mb-[20px] px-[8px] no-underline"
          aria-label="Café com BPO — início do painel"
        >
          <BrandLogo module={activeSection.module} className="w-[132px]" />
        </Link>

        {/* Abas de fichário: um módulo de trabalho por vez. */}
        <div className="panel-module-tabs" role="tablist" aria-label="Módulo de trabalho">
          {sections.map(section => {
            const selected = section.id === activeSection.id;
            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={section.label}
                title={section.label}
                data-cafe-module={section.module}
                onClick={() => selectSection(section)}
                className="panel-module-tab"
              >
                <CafeIcon name={section.icon} className="size-[20px]" />
              </button>
            );
          })}
        </div>

        {/* "Você está em…": o nome do módulo dá o norte de onde se trabalha agora. */}
        <div className="panel-module-heading" role="tabpanel" aria-label={activeSection.label}>
          <div className="text-xs font-bold uppercase tracking-[0.11em] text-module">Módulo</div>
          <div className="font-editorial text-[1.625rem] font-medium leading-tight tracking-[-0.02em] text-foreground">
            {activeSection.label}
          </div>
          <div className="mt-[2px] text-[0.8125rem] leading-snug text-muted-foreground">{activeSection.tagline}</div>
        </div>

        <nav className="panel-thin-scroll -mx-[4px] min-h-0 flex-1 overflow-y-auto px-[4px] pt-[8px]" aria-label={`Áreas de ${activeSection.label}`}>
          <div className="flex flex-col gap-[2px]">{activeSection.items.map(renderLink)}</div>

          <div className="mt-[16px] border-t border-border/70 pt-[10px]">
            <Link
              to={HOME_ITEM.path}
              onClick={onNavigate}
              aria-current={homeActive ? 'page' : undefined}
              className={cn(
                'cafe-rail-link panel-rail-link min-h-[42px] py-[9px] text-[0.9375rem] no-underline',
                !homeActive && 'text-muted-foreground hover:text-foreground'
              )}
            >
              <CafeIcon name="inicio" className={cn(homeActive ? 'text-module' : 'opacity-80')} />
              <span>Início · meu dia</span>
            </Link>
          </div>
        </nav>

        <div className="mt-[10px] border-t border-border/70 pt-[10px]">
          <FooterButton icon="suporte" label="Reportar erro" onClick={() => setShowReportModal(true)} />
          <FooterButton icon="favorito" label="Nos Ajude" onClick={() => setShowDonateModal(true)} />
          <FooterButton icon="sair" label="Sair da conta" onClick={logout} />
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
}: {
  icon: 'suporte' | 'favorito' | 'sair';
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[38px] w-full items-center gap-[12px] rounded-lg px-[12px] text-left text-sm text-muted-foreground transition-colors hover:bg-card/70 hover:text-foreground"
    >
      <CafeIcon name={icon} className="size-[18px] opacity-80" />
      {label}
    </button>
  );
}
