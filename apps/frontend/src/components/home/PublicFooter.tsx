import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Shared footer of the public pages.
 *
 * The seal of Saint Joseph, patron of Café com BPO, sits centered and small
 * (about the size of the text) before the footer information — present but
 * discreet. It is painted with the text color through a CSS mask, so it
 * follows light and dark mode.
 *
 * @returns The footer element.
 */
export const PublicFooter: React.FC = () => (
  <footer className="pub-footer">
    <span className="pub-footer-seal" role="img" aria-label="São José, patrono do Café com BPO" title="São José, patrono do Café" />
    <nav className="pub-footer-links" aria-label="Rodapé">
      <Link to="/cafes">Agenda dos cafés</Link>
      <Link to="/produtos">Produtos</Link>
      <Link to="/termos-de-uso">Termos de Uso</Link>
      <Link to="/politica-de-privacidade">Política de Privacidade</Link>
    </nav>
    <p className="pub-footer-legal">
      © {new Date().getFullYear()} Café com BPO · Castellum Financial Soluções Integradas Ltda. · CNPJ 52.317.042/0001-54 ·
      São Paulo/SP · <a href="mailto:falarcom@cafecombpo.com">falarcom@cafecombpo.com</a>
    </p>
  </footer>
);
