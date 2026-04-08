import React from 'react';
import { Navbar } from '../components/ui/Navbar';
import { FadeIn } from '../components/ui/FadeIn';

const SimulatorPage: React.FC = () => {
  return (
    <div style={{ paddingBottom: '100px' }}>
      <Navbar />

      <main style={{ paddingTop: '120px' }}>
        <section className="apple-section bg-black" style={{ minHeight: '80vh' }}>
          <div className="apple-container">
            <FadeIn delay={1}>
              <h1 className="apple-display">Simulador de Precificação</h1>
            </FadeIn>
            <FadeIn delay={2}>
              <p className="apple-body" style={{ color: 'var(--text-secondary-light)' }}>
                Esta área servirá como motor de comunicação com a nossa API Python para o cálculo estrutural de honorários.
              </p>
            </FadeIn>
          </div>
        </section>
      </main>
    </div>
  );
};

export default SimulatorPage;
