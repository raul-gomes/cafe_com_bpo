import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/ui/Navbar';
import { TERMOS_USO_HTML } from '../content/termos-uso';
import { POLITICA_PRIVACIDADE_HTML } from '../content/politica-privacidade';
import { usePageMeta } from '../lib/seo';
import './home.css';

const DOCUMENTOS = {
  termos: { titulo: 'Termos de Uso', html: TERMOS_USO_HTML },
  privacidade: { titulo: 'Política de Privacidade', html: POLITICA_PRIVACIDADE_HTML },
} as const;

interface LegalPageProps {
  documento: keyof typeof DOCUMENTOS;
}

/**
 * Termos de Uso e Política de Privacidade em página própria (antes abriam numa
 * janela que ficava atrás do login). O topo mantém o logo para voltar ao início.
 *
 * O HTML vem de constantes do próprio código (src/content), nunca da API ou do
 * usuário — por isso pode ser renderizado como HTML.
 */
const LegalPage: React.FC<LegalPageProps> = ({ documento }) => {
  const { titulo, html } = DOCUMENTOS[documento];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [documento]);
  usePageMeta({
    title: titulo,
    description:
      documento === 'termos'
        ? 'Termos de Uso do Café com BPO: planos, assinatura, programa Beta, comunidade, encontros e responsabilidades.'
        : 'Política de Privacidade do Café com BPO: quais dados tratamos, para quê, com quem compartilhamos e como exercer seus direitos (LGPD).',
    path: documento === 'termos' ? '/termos-de-uso' : '/politica-de-privacidade',
  });

  return (
    <div className="hb-page">
      <Navbar />
      <main className="hb-legal">
        <p className="hb-kicker">Documento</p>
        <div className="hb-legal-texto" dangerouslySetInnerHTML={{ __html: html }} />
        <nav className="hb-legal-outros" aria-label="Outros documentos">
          {documento === 'termos' ? (
            <Link to="/politica-de-privacidade" className="hb-link">Ler a Política de Privacidade</Link>
          ) : (
            <Link to="/termos-de-uso" className="hb-link">Ler os Termos de Uso</Link>
          )}
          <Link to="/" className="hb-link">Voltar ao início</Link>
        </nav>
      </main>
    </div>
  );
};

export default LegalPage;
