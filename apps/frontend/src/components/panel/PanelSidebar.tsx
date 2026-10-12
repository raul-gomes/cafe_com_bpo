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
  /** Módulo de trabalho mostrado no menu (o último escolhido, também no Início). */
  activeSection: NavSection;
  /** Se a tela atual pertence a um módulo (fora dele, o logo fica na cor oficial). */
  inModule: boolean;
  onSelectSection: (section: NavSection) => void;
  /** Chamado ao navegar (fecha a gaveta no celular). */
  onNavigate?: () => void;
}

/**
 * Menu do painel: um módulo de trabalho por vez. As abas no topo trocam o
 * módulo e se reorganizam em linhas quando houver mais módulos; a lista abaixo
 * é só daquele módulo e termina com as ações de conta, rolando junto.
 * Largura (completo / só ícones / retraído) vem do PanelLayout.
 */
export const PanelSidebar: React.FC<PanelSidebarProps> = ({ activeSection, inModule, onSelectSection, onNavigate }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const { data: access } = useAccess();
  // Write gate do plano (GET /access): no gratuito, "captar" e "gestao" ficam só para ver.
  // O cadeado é informativo — navegar continua livre; o servidor bloqueia a escrita.
  const readOnly = new Set(access?.read_only_modules ?? []);
  const isAdmin = user?.role === 'admin';
  const sections = NAV_SECTIONS.filter(section => !section.adminOnly || isAdmin);

  const selectSection = (section: NavSection) => {
    onSelectSection(section);
    // Entrar num módulo leva à primeira área dele.
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
        {/* O café leva ao painel principal: a visão macro do dia e da empresa. */}
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

        {/* Abas dos módulos: quebram em linhas sozinhas quando entrarem novos. */}
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

          {/* Ações de conta no fim da lista (rolam junto, sem comer espaço fixo). */}
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
