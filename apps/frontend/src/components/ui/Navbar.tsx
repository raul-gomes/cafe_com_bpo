import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLoginDialog } from '../auth/LoginDialogContext';
import { CafeIcon } from '../../brand/CafeIcon';
import { reabrirBannerCafe } from '../home/CafeBanner';
import { useAppearance } from '../../brand/appearance';

/**
 * Topo das páginas públicas (início, simulador, propostas, agenda dos cafés).
 *
 * - Faixa escura (--cafe-deep) atrás do logo colorido: o amarelo sobre o papel
 *   claro não tinha leitura.
 * - Fica no fluxo (sticky), não flutuando por cima: antes o conteúdo — a
 *   proposta impressa, o login — passava por baixo da barra.
 * - Atalhos com ícone: agenda dos cafés (conversa com café), produtos (negócios)
 *   e o único ajuste de aparência do site: claro ou escuro.
 * - Três ações, na ordem pedida, cada uma num gesto do kit V4:
 *   Precificação (trilho) · Quero ser Beta (fichário) · Login (recorte).
 * - O logo volta ao início e traz de volta o aviso do próximo café.
 */
export const Navbar: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { openLogin } = useLoginDialog();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [{ mode }, setAppearance] = useAppearance();
  const escuro = mode === 'dark';

  const irParaBeta = (event: React.MouseEvent) => {
    if (pathname === '/') {
      const alvo = document.getElementById('quero-ser-beta');
      if (alvo) {
        event.preventDefault();
        alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <header className="pub-nav print:hidden">
      <div className="pub-nav-inner">
        <Link to="/" className="pub-nav-brand" aria-label="Café com BPO — início" onClick={reabrirBannerCafe}>
          <img src="/brand/kit-v4/logo-cafe-colorida.svg" alt="Café com BPO" />
        </Link>

        <div className="pub-nav-shortcuts">
          <Link to="/cafes" className="pub-nav-icon" aria-label="Agenda dos cafés" title="Agenda dos cafés">
            <CafeIcon name="conversa-cafe" />
          </Link>
          <Link to="/produtos" className="pub-nav-icon" aria-label="Produtos do Café" title="Produtos do Café">
            <CafeIcon name="negocios" />
          </Link>
          <button
            type="button"
            onClick={() => setAppearance({ mode: escuro ? 'light' : 'dark' })}
            className="pub-nav-icon"
            aria-label={escuro ? 'Usar modo claro' : 'Usar modo escuro'}
            title={escuro ? 'Modo claro' : 'Modo escuro'}
          >
            {escuro ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
              </svg>
            )}
          </button>
        </div>

        <nav className="pub-nav-actions" aria-label="Principal">
          <Link to="/precificacao" className="cafe-command cafe-command-rail pub-nav-rail">
            <span>Precificação</span>
          </Link>
          <Link to="/#quero-ser-beta" onClick={irParaBeta} className="cafe-command cafe-command-tab pub-nav-tab">
            <span>Quero ser Beta</span>
          </Link>
          {isAuthenticated ? (
            <button type="button" onClick={() => navigate('/painel')} className="cafe-command cafe-command-cut pub-nav-cut">
              <span>Painel</span>
            </button>
          ) : (
            <button type="button" onClick={openLogin} className="cafe-command cafe-command-cut pub-nav-cut">
              <span>Login</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};
