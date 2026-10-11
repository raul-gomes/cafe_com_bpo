import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLoginDialog } from '../auth/LoginDialogContext';

/**
 * Topo das páginas públicas (início, simulador, propostas, agenda dos cafés).
 *
 * - Faixa escura (--cafe-deep) atrás do logo colorido: o amarelo sobre o papel
 *   claro não tinha leitura.
 * - Fica no fluxo (sticky), não flutuando por cima: antes o conteúdo — a
 *   proposta impressa, o login — passava por baixo da barra.
 * - Três ações, na ordem pedida, cada uma num gesto do kit V4:
 *   Simulador (trilho) · Quero ser Beta (fichário) · Login (recorte).
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
        <Link to="/" className="pub-nav-brand" aria-label="Café com BPO — início">
          <img src="/brand/kit-v4/logo-cafe-colorida.svg" alt="Café com BPO" />
        </Link>

        <nav className="pub-nav-actions" aria-label="Principal">
          <Link to="/simulador" className="cafe-command cafe-command-rail pub-nav-rail">
            <span>Simulador</span>
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
