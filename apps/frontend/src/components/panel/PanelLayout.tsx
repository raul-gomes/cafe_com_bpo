import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PanelSidebar } from './PanelSidebar';
import { PanelTopBar } from './PanelTopBar';
import { Toaster } from '../ui/sonner';
import { BetaEndingBanner } from './BetaEndingBanner';
import { useAccess } from '../../api/hooks/useAccess';
import { useAuth } from '../../context/AuthContext';
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
    // storage unavailable: applies to this session only
  }
}

/** Menu states, in the order the arrow cycles through them. */
type NavState = 'expanded' | 'collapsed' | 'hidden';
const NAV_CYCLE: NavState[] = ['expanded', 'collapsed', 'hidden'];
const NAV_TOGGLE_LABEL: Record<NavState, string> = {
  expanded: 'Recolher menu: deixar só os ícones',
  collapsed: 'Esconder o menu',
  hidden: 'Abrir o menu completo',
};

/**
 * Section by id, restricted to the sections the user may see.
 *
 * @param id Stored section id (may be absent or blocked).
 * @param sections Sections visible to the user.
 * @returns The matching section, or the first visible one.
 */
function sectionById(id: string | null, sections: NavSection[] = NAV_SECTIONS): NavSection {
  return sections.find(section => section.id === id) ?? sections[0];
}

/**
 * Panel shell (.cafe-workspace of the V4 kit).
 *
 * Work module: comes from the route when it belongs to a module; on screens
 * outside modules (Home, profile) the last chosen one stays. The module sets
 * data-cafe-module for the whole shell — menu, logo, arrow, top stripe and the
 * folder-tab buttons take on its color.
 *
 * @returns The shell.
 */
export const PanelLayout: React.FC = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { data: access } = useAccess();
  const [nav, setNav] = useState<NavState>(() => {
    const stored = readStorage(NAV_KEY);
    return NAV_CYCLE.includes(stored as NavState) ? (stored as NavState) : 'expanded';
  });
  const [chosenId, setChosenId] = useState<string>(() => readStorage(MODULE_KEY) || NAV_SECTIONS[0].id);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);

  // Admin-only sections (Admin, Notas Fiscais, Certificados Digitais) never
  // reach a non-admin — not through the route, not through the stored module.
  const isAdmin = user?.role === 'admin';
  const visibleSections = useMemo(
    () => NAV_SECTIONS.filter(section => !section.adminOnly || isAdmin),
    [isAdmin]
  );
  const matchedSection = sectionForPath(pathname);
  const routeSection = matchedSection && (!matchedSection.adminOnly || isAdmin) ? matchedSection : null;
  const activeSection = routeSection ?? sectionById(chosenId, visibleSections);

  // Landing on a route of another module (link, notification…) makes it the chosen one.
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

  // Arrow: full → icons only → hidden → full.
  const cycleNav = useCallback(() => {
    setNav(prev => {
      const next = NAV_CYCLE[(NAV_CYCLE.indexOf(prev) + 1) % NAV_CYCLE.length];
      writeStorage(NAV_KEY, next);
      return next;
    });
  }, []);

  // The module color goes on <body> so portal menus and dialogs get it too.
  const moduleColor = routeSection?.module;
  useEffect(() => {
    if (moduleColor) document.body.dataset.cafeModule = moduleColor;
    else delete document.body.dataset.cafeModule;
    return () => {
      delete document.body.dataset.cafeModule;
    };
  }, [moduleColor]);

  // Mobile drawer: native <dialog> (Escape and focus trap come from the browser).
  useEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;
    if (mobileNavOpen && !dialog.open) dialog.showModal?.();
    if (!mobileNavOpen && dialog.open) dialog.close?.();
  }, [mobileNavOpen]);

  return (
    <div
      // Single screen-high row: otherwise the "auto" row grows with the menu and it never scrolls.
      className="cafe-workspace app-shell h-screen w-screen grid-rows-[minmax(0,100vh)] overflow-hidden border-0"
      data-nav={nav}
    >
      {/* Hidden: width 0 and visibility:hidden (CSS), which also removes the links from Tab order. */}
      <div className="panel-rail-slot min-w-0 overflow-hidden">
        <PanelSidebar activeSection={activeSection} inModule={Boolean(routeSection)} onSelectSection={selectSection} />
      </div>

      {/* Floating arrow: sits on the menu edge and stays visible when the menu is hidden. */}
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
          {access?.shows_beta_banner && access.expires_at && (
            <BetaEndingBanner expiresAt={access.expires_at} />
          )}
          {/* The key only changes with the module: the sheet rises when entering a new area. */}
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
