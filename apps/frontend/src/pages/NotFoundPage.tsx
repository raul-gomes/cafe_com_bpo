import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../lib/seo';

/**
 * Fallback for unknown addresses. It sets its own tags and stays out of Google:
 * without them it kept the title, canonical and "index, follow" of the page
 * seen before (AUD-041).
 *
 * @returns The page.
 */
const NotFoundPage: React.FC = () => {
  usePageMeta({
    title: 'Página não encontrada',
    description: 'O endereço não existe no Café com BPO. Volte para a página inicial.',
    path: '/404',
    noindex: true,
  });

  return (
    <div data-testid="not-found" className="flex min-h-[60vh] flex-col items-center justify-center gap-[12px] text-center">
      <p className="text-lg font-semibold text-foreground">Página não encontrada</p>
      <Link to="/" className="text-primary underline">
        Voltar para o início
      </Link>
    </div>
  );
};

export default NotFoundPage;
