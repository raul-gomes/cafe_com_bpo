import React from 'react';
import { Navbar } from '../components/ui/Navbar';
import { Button } from '../components/ui/Button';
import { FadeIn } from '../components/ui/FadeIn';
import { Link } from 'react-router-dom';

const UnderConstructionPage: React.FC = () => {
  return (
    <div style={{ paddingBottom: '100px' }}>
      <Navbar />

      <main style={{ paddingTop: '120px' }}>
        <section className="apple-section bg-black" style={{ minHeight: '80vh' }}>
          <div className="apple-container">
            <FadeIn delay={1}>
              <div style={{ fontSize: '64px', marginBottom: '24px' }}>🚧</div>
              <h1 className="apple-display">Em Construção</h1>
            </FadeIn>
            <FadeIn delay={2}>
              <p className="apple-body" style={{ color: 'var(--text-secondary-light)' }}>
                Nós não vendemos atalhos e processos de qualidade levam tempo. Esta área está sendo construída sob as fundações corretas.
              </p>
            </FadeIn>
            <FadeIn delay={3}>
              <Link to="/">
                <Button variant="outline" size="md">
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
