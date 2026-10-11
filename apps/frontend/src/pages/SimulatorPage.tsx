import React from 'react';
import { Navbar } from '../components/ui/Navbar';
import { FadeIn } from '../components/ui/FadeIn';
import { PublicPricingSimulator } from '../components/pricing/PublicPricingSimulator';
import { usePageMeta } from '../lib/seo';

const SimulatorPage: React.FC = () => {
  usePageMeta({
    title: 'Precificação de BPO financeiro',
    description: 'Calcule o preço justo dos seus serviços de BPO financeiro: custo real da operação, tempo de cada serviço e margem. Grátis, sem cadastro.',
    path: '/precificacao',
  });
  return (
    <div className="simulator-landing-page pb-[100px] bg-[var(--bg)]">
      <Navbar />

      <main className="pt-[40px]">
        <FadeIn delay={1}>
          <div className="app-header mb-10 border-none bg-transparent">
            <h1 className="font-editorial text-[2.75rem] font-medium leading-tight tracking-[-0.02em]">Precificação do seu BPO</h1>
            <p className="text-lg max-w-[600px] mx-auto mt-3">
              Descubra o valor justo gerado dinamicamente para sua operação com a metodologia Café com BPO.
            </p>
          </div>
        </FadeIn>
        
        <FadeIn delay={2}>
          <PublicPricingSimulator />
        </FadeIn>
      </main>
    </div>
  );
};

export default SimulatorPage;
