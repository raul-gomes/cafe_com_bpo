import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { CafeIcon } from '../../brand/CafeIcon';
import { HORARIO_CAFE, proximoCafeAberto } from './cafes';

/*
 * Fechar o banner vale só enquanto a página está aberta: ao atualizar a página
 * ele volta, e clicar no logo do topo também o traz de volta (reabrirBannerCafe).
 */
let fechado = false;
const listeners = new Set<() => void>();
const avisar = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// eslint-disable-next-line react-refresh/only-export-components
export function reabrirBannerCafe(): void {
  fechado = false;
  avisar();
}

function fecharBanner(): void {
  fechado = true;
  avisar();
}

/** Banner flutuante (canto da tela) chamando para o próximo café aberto. */
export const CafeBanner: React.FC = () => {
  const estaFechado = useSyncExternalStore(subscribe, () => fechado, () => fechado);
  const [pronto, setPronto] = useState(false);

  // Entra um pouco depois da página, para não competir com a abertura.
  useEffect(() => {
    const timer = window.setTimeout(() => setPronto(true), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  if (!pronto || estaFechado) return null;

  const data = proximoCafeAberto(new Date()).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <aside className="cafe-banner" aria-label="Próximo café">
      <button type="button" className="cafe-banner-fechar" onClick={fecharBanner} aria-label="Fechar aviso">
        <CafeIcon name="fechar" className="size-[18px]" />
      </button>
      <span className="cafe-banner-icone" aria-hidden="true"><CafeIcon name="xicara" /></span>
      <div>
        <p className="cafe-banner-kicker">Participe do próximo café</p>
        <p className="cafe-banner-texto">
          Encontro aberto no Meet: <strong>{data}, às {HORARIO_CAFE}</strong>.
        </p>
        <Link to="/cafes" className="cafe-banner-link">
          Ver agenda dos cafés <CafeIcon name="expandir" className="size-[16px]" />
        </Link>
      </div>
    </aside>
  );
};
