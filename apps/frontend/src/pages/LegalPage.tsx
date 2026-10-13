import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/ui/Navbar';
import { TERMS_OF_USE_HTML } from '../content/terms-of-use';
import { PRIVACY_POLICY_HTML } from '../content/privacy-policy';
import { usePageMeta } from '../lib/seo';
import { RichText } from '../components/ui/RichText';
import { PublicFooter } from '../components/home/PublicFooter';
import './home.css';

const DOCUMENTS = {
  terms: {
    title: 'Termos de Uso',
    html: TERMS_OF_USE_HTML,
    path: '/termos-de-uso',
    description: 'Termos de Uso do Café com BPO: planos, assinatura, programa Beta, comunidade, encontros e responsabilidades.',
  },
  privacy: {
    title: 'Política de Privacidade',
    html: PRIVACY_POLICY_HTML,
    path: '/politica-de-privacidade',
    description: 'Política de Privacidade do Café com BPO: quais dados tratamos, para quê, com quem compartilhamos e como exercer seus direitos (LGPD).',
  },
} as const;

interface LegalPageProps {
  document: keyof typeof DOCUMENTS;
}

/**
 * Terms of Use and Privacy Policy on their own page (they used to open in a
 * dialog that ended up behind the login). The header keeps the logo to go home.
 *
 * The HTML comes from bundled constants (src/content) and is rendered by
 * Raul's RichText, which builds React elements instead of using innerHTML.
 *
 * @param props.document Which document to show.
 * @returns The page.
 */
const LegalPage: React.FC<LegalPageProps> = ({ document: documentKey }) => {
  const { title, html, path, description } = DOCUMENTS[documentKey];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [documentKey]);
  usePageMeta({ title, description, path });

  return (
    <div className="hb-page">
      <Navbar />
      <main className="hb-legal">
        <p className="hb-kicker">Documento</p>
        <RichText html={html} className="hb-legal-text" />
        <nav className="hb-legal-others" aria-label="Outros documentos">
          {documentKey === 'terms' ? (
            <Link to="/politica-de-privacidade" className="hb-link">Ler a Política de Privacidade</Link>
          ) : (
            <Link to="/termos-de-uso" className="hb-link">Ler os Termos de Uso</Link>
          )}
          <Link to="/" className="hb-link">Voltar ao início</Link>
        </nav>
      </main>
      <PublicFooter />
    </div>
  );
};

export default LegalPage;
