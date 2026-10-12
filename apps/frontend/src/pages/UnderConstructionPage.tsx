import React from 'react';
import { Navbar } from '../components/ui/Navbar';
import { Button } from '../components/ui/button';
import { FadeIn } from '../components/ui/FadeIn';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../lib/seo';

const UnderConstructionPage: React.FC = () => {
  // Own tags and out of Google: an empty area is no search result, and without
  // this the page kept the tags of the one seen before (AUD-041).
  usePageMeta({
    title: 'Em construção',
    description: 'Esta área do Café com BPO está sendo construída. Enquanto isso, conheça a comunidade e a calculadora de precificação.',
    path: '/em-construcao',
    noindex: true,
  });

  return (
    <div className="pb-[100px]">
      <Navbar />

      <main className="pt-[48px]">
        <section className="min-h-[80vh] bg-background text-foreground flex flex-col items-center justify-center text-center w-full py-[100px]">
          <div className="max-w-[1024px] mx-auto px-5">
            <FadeIn delay={1}>
              <div className="text-6xl mb-6">🚧</div>
              <h1 className="text-5xl font-extrabold leading-[1.1] mb-6">Em Construção</h1>
            </FadeIn>
            <FadeIn delay={2}>
              <p className="text-base leading-[1.5] max-w-[650px] mx-auto mb-6 text-muted-foreground">
                Nós não vendemos atalhos e processos de qualidade levam tempo. Esta área está sendo construída sob as fundações corretas.
              </p>
            </FadeIn>
            <FadeIn delay={3}>
              <Link to="/">
                <Button variant="outline">
                  Voltar para a base
                </Button>
              </Link>
            </FadeIn>
          </div>
        </section>
      </main>
    </div>
  );
};

export default UnderConstructionPage;
