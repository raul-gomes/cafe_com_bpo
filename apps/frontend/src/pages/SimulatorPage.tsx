import React from 'react';
import { Navbar } from '../components/ui/Navbar';
import { FadeIn } from '../components/ui/FadeIn';
import { PublicPricingSimulator } from '../components/pricing/PublicPricingSimulator';

const SimulatorPage: React.FC = () => {
  return (
    <div className="simulator-landing-page" style={{ paddingBottom: '100px', background: 'var(--bg)' }}>
      <Navbar />

      <main style={{ paddingTop: '100px' }}>
        <FadeIn delay={1}>
          <div className="app-header" style={{ marginBottom: '40px', border: 'none', background: 'transparent' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800 }}>Simulador de Precificação BPO</h1>
            <p style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '12px auto' }}>
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
