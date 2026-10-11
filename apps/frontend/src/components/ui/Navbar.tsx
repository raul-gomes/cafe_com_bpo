import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLoginDialog } from '../auth/LoginDialogContext';
import { CafeIcon } from '../../brand/CafeIcon';
import { reabrirBannerCafe } from '../home/CafeBanner';

/**
 * Topo das páginas públicas (início, simulador, propostas, agenda dos cafés).
 *
 * - Faixa escura (--cafe-deep) atrás do logo colorido: o amarelo sobre o papel
 *   claro não tinha leitura.
 * - Fica no fluxo (sticky), não flutuando por cima: antes o conteúdo — a
 *   proposta impressa, o login — passava por baixo da barra.
 * - Atalhos com ícone: agenda dos cafés (calendário) e produtos (carteira).
 * - Três ações, na ordem pedida, cada uma num gesto do kit V4:
 *   Precificação (trilho) · Quero ser Beta (fichário) · Login (recorte).
 * - O logo volta ao início e traz de volta o aviso do próximo café.
 */
export const Navbar: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { openLogin } = useLoginDialog();
  const navigate = useNavigate();
  const { pathname } = useLocation();

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
            <CafeIcon name="rotina" />
          </Link>
          <Link to="/produtos" className="pub-nav-icon" aria-label="Produtos do Café" title="Produtos do Café">
            <CafeIcon name="carteira" />
          </Link>
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
