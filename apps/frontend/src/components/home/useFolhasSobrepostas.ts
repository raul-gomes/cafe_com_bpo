import { useEffect } from 'react';
import type React from 'react';

/**
 * Folha sobre folha: cada seção fica presa no topo (sticky) e a seguinte sobe
 * por cima dela, como uma folha colocada sobre outra. Seção mais alta que a
 * tela primeiro rola até o fim e só então fica presa (top negativo), para nada
 * ficar escondido. Só no computador e sem "reduzir movimento".
 */
export function useFolhasSobrepostas(root: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const page = root.current;
    const desktop = window.matchMedia?.('(min-width: 900px)');
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!page || !desktop || !reduzir) return;

    const folhas = () => Array.from(page.querySelectorAll<HTMLElement>('.hb-sheet'));
    const ajustar = () => {
      const ativo = desktop.matches && !reduzir.matches;
      page.classList.toggle('hb-sheets-on', ativo);
      const topo = document.querySelector<HTMLElement>('.pub-nav')?.offsetHeight ?? 0;
      folhas().forEach((folha, index) => {
        folha.style.zIndex = ativo ? String(index + 1) : '';
        folha.style.top = ativo ? `${Math.min(topo, window.innerHeight - folha.offsetHeight)}px` : '';
      });
    };

    ajustar();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ajustar) : null;
    folhas().forEach(folha => observer?.observe(folha));
    window.addEventListener('resize', ajustar);
    desktop.addEventListener?.('change', ajustar);
    reduzir.addEventListener?.('change', ajustar);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', ajustar);
      desktop.removeEventListener?.('change', ajustar);
      reduzir.removeEventListener?.('change', ajustar);
    };
  }, [root]);
}
