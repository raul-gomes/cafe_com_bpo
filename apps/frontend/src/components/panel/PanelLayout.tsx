import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PanelSidebar } from './PanelSidebar';
import { PanelTopBar } from './PanelTopBar';
import { Toaster } from '../ui/sonner';
import { NAV_SECTIONS, sectionForPath, type NavSection } from './navigation';

const NAV_KEY = 'cafe_bpo_sidebar_nav';
const MODULE_KEY = 'cafe_bpo_active_menu';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // armazenamento indisponível: vale só nesta sessão
  }
}

/** Estados do menu, na ordem em que a seta os percorre. */
type NavState = 'expanded' | 'collapsed' | 'hidden';
const NAV_CYCLE: NavState[] = ['expanded', 'collapsed', 'hidden'];
const NAV_TOGGLE_LABEL: Record<NavState, string> = {
  expanded: 'Recolher menu: deixar só os ícones',
  collapsed: 'Esconder o menu',
  hidden: 'Abrir o menu completo',
};

function sectionById(id: string | null): NavSection {
  return NAV_SECTIONS.find(section => section.id === id) ?? NAV_SECTIONS[0];
}

/**
 * Casca do painel (.cafe-workspace do kit V4).
 *
 * Módulo de trabalho: vem da rota quando ela pertence a um módulo; em telas
 * sem módulo (Início, perfil) fica o último escolhido. O módulo define o
 * data-cafe-module de toda a casca — menu, logo, seta, faixa do topo e linha
 * dos botões fichário vestem a cor dele.
 */
export const PanelLayout: React.FC = () => {
  const { pathname } = useLocation();
  const [nav, setNav] = useState<NavState>(() => {
    const stored = readStorage(NAV_KEY);
    return NAV_CYCLE.includes(stored as NavState) ? (stored as NavState) : 'expanded';
  });
  const [chosenId, setChosenId] = useState<string>(() => readStorage(MODULE_KEY) || NAV_SECTIONS[0].id);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);

  const routeSection = sectionForPath(pathname);
  const activeSection = routeSection ?? sectionById(chosenId);

  // Ao entrar numa rota de outro módulo (link, notificação…), ele vira o escolhido.
  useEffect(() => {
    if (routeSection && routeSection.id !== chosenId) {
      setChosenId(routeSection.id);
      writeStorage(MODULE_KEY, routeSection.id);
    }
  }, [routeSection, chosenId]);

  const selectSection = useCallback((section: NavSection) => {
    setChosenId(section.id);
    writeStorage(MODULE_KEY, section.id);
  }, []);

  // Seta: completo → só ícones → retraído → completo.
  const cycleNav = useCallback(() => {
    setNav(prev => {
      const next = NAV_CYCLE[(NAV_CYCLE.indexOf(prev) + 1) % NAV_CYCLE.length];
      writeStorage(NAV_KEY, next);
      return next;
    });
  }, []);

  // A cor do módulo vai no <body> para alcançar também menus e diálogos em portal.
  const moduleColor = routeSection?.module;
  useEffect(() => {
    if (moduleColor) document.body.dataset.cafeModule = moduleColor;
    else delete document.body.dataset.cafeModule;
    return () => {
      delete document.body.dataset.cafeModule;
    };
  }, [moduleColor]);

  // Gaveta do celular: <dialog> nativo (Escape e foco preso vêm do navegador).
  useEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;
    if (mobileNavOpen && !dialog.open) dialog.showModal?.();
    if (!mobileNavOpen && dialog.open) dialog.close?.();
  }, [mobileNavOpen]);

  return (
    <div
      // Linha única com altura da tela: sem isso a linha "auto" cresce com o menu e ele não rola.
      className="cafe-workspace app-shell h-screen w-screen grid-rows-[minmax(0,100vh)] overflow-hidden border-0"
      data-nav={nav}
    >
      {/* Retraído: largura 0 e visibility:hidden (CSS), o que também tira os links do Tab. */}
      <div className="panel-rail-slot min-w-0 overflow-hidden">
        <PanelSidebar activeSection={activeSection} inModule={Boolean(routeSection)} onSelectSection={selectSection} />
      </div>

      {/* Seta flutuante: fica na borda do menu e continua visível com ele retraído. */}
      <button
        type="button"
        onClick={cycleNav}
        className="cafe-floating-arrow panel-rail-toggle"
        aria-expanded={nav !== 'hidden'}
        aria-label={NAV_TOGGLE_LABEL[nav]}
        title={NAV_TOGGLE_LABEL[nav]}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </button>

      <div className="flex h-screen min-w-0 flex-col overflow-hidden">
        <PanelTopBar
          sectionLabel={routeSection?.label ?? null}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          mobileNavOpen={mobileNavOpen}
        />
        <main className="app-main panel-thin-scroll relative min-w-0 flex-1 overflow-y-auto bg-background px-[clamp(16px,3vw,40px)] py-[28px] text-foreground">
          {/* A chave muda só ao trocar de módulo: a ficha sobe ao entrar numa área nova. */}
          <div key={routeSection?.id ?? 'inicio'} className="panel-module-enter">
            <Outlet />
          </div>
        </main>
      </div>

      <dialog
        ref={drawerRef}
        id="painel-menu-celular"
        aria-label="Menu do painel"
        onClose={() => setMobileNavOpen(false)}
        className="m-0 h-dvh max-h-none w-[min(320px,86vw)] max-w-none border-0 bg-transparent p-0 backdrop:bg-black/50"
      >
        <div className="relative h-full">
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="absolute right-[12px] top-[12px] z-10 grid size-[44px] place-items-center rounded-full text-muted-foreground hover:bg-accent"
            aria-label="Fechar menu"
          >
            <svg className="size-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <PanelSidebar
            activeSection={activeSection}
            inModule={Boolean(routeSection)}
            onSelectSection={selectSection}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </div>
      </dialog>

      <Toaster />
    </div>
  );
};
