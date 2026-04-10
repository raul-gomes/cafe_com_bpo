import React from 'react';
import { Navbar } from '../components/ui/Navbar';
import { FadeIn } from '../components/ui/FadeIn';
import { PricingCalculatorLayout } from '../components/pricing/PricingCalculatorLayout';

const SimulatorPage: React.FC = () => {
  return (
    <div style={{ paddingBottom: '100px' }}>
      <Navbar />

      <main style={{ paddingTop: '80px', background: 'var(--bg)' }}>
        <FadeIn delay={1}>
          <div className="app-header">
            <h1 style={{color: '#000'}}>Calculadora Open BPO</h1>
            <p style={{color: '#333'}}>Preencha com a realidade da sua operação e descubra o valor justo gerado dinamicamente pela API de Python.</p>
          </div>
        </FadeIn>
        
        <FadeIn delay={2}>
          <div style={{marginTop: '20px'}}>
            <PricingCalculatorLayout />
          </div>
        </FadeIn>
      </main>
    </div>
  );
};

export default SimulatorPage;
