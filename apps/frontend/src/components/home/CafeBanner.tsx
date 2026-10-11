import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CafeIcon } from '../../brand/CafeIcon';
import { proximoCafeAberto } from './cafes';

const DISMISS_KEY = 'cafe-banner-fechado';

/** Banner flutuante (canto da tela) chamando para o próximo café aberto. */
export const CafeBanner: React.FC = () => {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    let fechado = false;
    try {
      fechado = sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // armazenamento indisponível: mostra normalmente
    }
    if (fechado) return;
    // Entra um pouco depois da página, para não competir com a abertura.
    const timer = window.setTimeout(() => setVisivel(true), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visivel) return null;

  const fechar = () => {
    setVisivel(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // sem armazenamento: volta a aparecer na próxima visita
    }
  };

  const data = proximoCafeAberto(new Date()).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <aside className="cafe-banner" aria-label="Próximo café">
      <button type="button" className="cafe-banner-fechar" onClick={fechar} aria-label="Fechar aviso">
        <CafeIcon name="fechar" className="size-[18px]" />
      </button>
      <span className="cafe-banner-icone" aria-hidden="true"><CafeIcon name="xicara" /></span>
      <div>
        <p className="cafe-banner-kicker">Participe do próximo café</p>
        <p className="cafe-banner-texto">
          Encontro aberto no Meet: <strong>{data}</strong>.
        </p>
        <Link to="/cafes" className="cafe-banner-link" onClick={fechar}>
          Ver agenda dos cafés <CafeIcon name="expandir" className="size-[16px]" />
        </Link>
      </div>
    </aside>
  );
};
