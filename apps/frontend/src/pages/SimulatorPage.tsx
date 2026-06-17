import React from 'react';
import { Navbar } from '../components/ui/Navbar';
import { FadeIn } from '../components/ui/FadeIn';
import { PublicPricingSimulator } from '../components/pricing/PublicPricingSimulator';

const SimulatorPage: React.FC = () => {
  return (
    <div className="simulator-landing-page pb-[100px] bg-[var(--bg)]">
      <Navbar />

      <main className="pt-[100px]">
        <FadeIn delay={1}>
          <div className="app-header mb-10 border-none bg-transparent">
            <h1 className="text-4xl font-extrabold">Simulador de Precificação BPO</h1>
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
