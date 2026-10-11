import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PanelSidebar } from './PanelSidebar';
import { PanelTopBar } from './PanelTopBar';
import { Toaster } from '../ui/sonner';
import { sectionForPath } from './navigation';

const COLLAPSED_KEY = 'cafe_bpo_sidebar_collapsed';

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Casca do painel no padrão .cafe-workspace do kit V4. A área da rota atual
 * define o módulo (data-cafe-module): ao trocar de área, muda a cor de
 * orientação sem trocar a atmosfera escolhida pelo usuário.
 */
export const PanelLayout: React.FC = () => {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(getInitialCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const section = sectionForPath(pathname);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // armazenamento indisponível: vale só nesta sessão
      }
      return next;
    });
  }, []);

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
      className="cafe-workspace panel-shell h-screen w-screen grid-rows-[minmax(0,100vh)] overflow-hidden border-0"
      data-nav={collapsed ? 'collapsed' : 'expanded'}
      data-cafe-module={section?.module}
    >
      <PanelSidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

      <div className="flex h-screen min-w-0 flex-col overflow-hidden">
        <PanelTopBar
          sectionLabel={section?.label ?? null}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          mobileNavOpen={mobileNavOpen}
        />
        <main className="panel-main relative min-w-0 flex-1 overflow-y-auto bg-background px-[clamp(16px,3vw,40px)] py-[28px] text-foreground">
          {/* A chave muda só ao trocar de módulo: a ficha sobe ao entrar numa área nova. */}
          <div key={section?.id ?? 'inicio'} className="panel-module-enter">
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
        <div className="relative h-full" data-cafe-module={section?.module}>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="absolute right-[12px] top-[12px] z-10 grid size-[44px] place-items-center rounded-full text-muted-foreground hover:bg-accent"
            aria-label="Fechar menu"
          >
            <svg className="size-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <PanelSidebar variant="drawer" onNavigate={() => setMobileNavOpen(false)} />
        </div>
      </dialog>

      <Toaster />
    </div>
  );
};
