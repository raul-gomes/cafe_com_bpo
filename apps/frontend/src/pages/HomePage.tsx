import React from 'react';
import { Navbar } from '../components/ui/Navbar';
import { Button } from '../components/ui/Button';
import { FadeIn } from '../components/ui/FadeIn';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const targetPath = isAuthenticated ? '/painel' : '/login';

  return (
    <div style={{ paddingBottom: '100px' }} data-testid="home-page">
      <Navbar />

      <main>
        {/* Section 1: Hero (Dark Mode) */}
        <section className="apple-section bg-black" style={{ 
          minHeight: '100vh', 
          paddingTop: '120px',
          backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,1)), url("/hero-bg.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}>
          <div className="apple-container">
            <FadeIn delay={1}>
              <h1 className="apple-display" style={{ maxWidth: '800px', margin: '0 auto 24px auto' }}>
                A terceirização do financeiro não é um palco.
              </h1>
            </FadeIn>
            <FadeIn delay={2}>
              <p className="apple-body" style={{ color: 'var(--text-secondary-light)' }}>
                Para quem cansou da estética do sucesso e procura a ética do trabalho real.
              </p>
              
            </FadeIn>
            <FadeIn delay={3}>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '40px' }}>
                <Link to={targetPath}>
                  <Button variant="primary" size="lg">
                    FAZER PARTE DA REALIDADE
                  </Button>
                </Link>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Section 2: Statement (Light Mode) */}
        <section id="about" className="apple-section bg-light" style={{ position: 'relative', overflow: 'hidden' }}>
          <div className="watermark-text">PROCESSO</div>
          
          <div className="apple-container content-relative" style={{ maxWidth: '700px' }}>
            <FadeIn>
              <h2 className="apple-heading">Se procura atalhos, está no lugar errado.</h2>
              <p className="apple-body" style={{ color: 'var(--text-primary-dark)' }}>
                Não vendemos pílulas mágicas. Não celebramos a facilidade. O Café com BPO é uma zona livre de gurus e de vendedores de milagres.
              </p>
              <p className="apple-body" style={{ color: 'var(--text-secondary-dark)' }}>
                Aqui, a moeda de troca não é o "hype", é a cicatriz. Se você quer o caminho mastigado, volte para o feed das redes sociais. Se você quer a verdade do processo, com toda a complexidade que ele exige, continue.
              </p>
              <h3 className="apple-subheading" style={{ marginTop: '40px', fontStyle: 'italic', color: 'var(--text-primary-dark)' }}>
                "O amador procura o brilho da superfície. O profissional procura a segurança da fundação."
              </h3>
            </FadeIn>
          </div>
        </section>

        {/* Section 3: The Reality & Laboratório (Combined Bento Grid) */}
        <section className="apple-section bg-black">
          <div className="apple-container" style={{ maxWidth: 'var(--max-width)' }}>
            <FadeIn delay={1}>
              <h2 className="apple-heading">A solidão do operador custa caro.</h2>
            </FadeIn>
            <FadeIn delay={2}>
              <p className="apple-body" style={{ color: 'var(--text-secondary-light)' }}>
                O BPO contábil não aceita amadores. Ninguém te contou que crescer dói. Que a rotina operacional mastiga sonhos enquanto você resolve B.O de cliente.
              </p>
            </FadeIn>
            
            <FadeIn delay={3}>
              <div className="bento-grid">
                
                {/* Row 1 */}
                <div className="bento-item bento-wide">
                  <div>
                    <h3 className="apple-subheading" style={{ margin: 0, color: 'var(--text-light)' }}>Simulador de Precificação</h3>
                    <p style={{ color: 'var(--text-secondary-light)', marginTop: '12px', fontSize: '15px', lineHeight: '1.5' }}>
                      Nós desenvolvemos uma engine conectada diretamente a um complexo motor Python. 
                      Acesse regras matemáticas rígidas que impedem você de vender seu serviço de BPO e terminar pagando para trabalhar.
                    </p>
                  </div>
                  <div style={{ marginTop: '40px' }}>
                    <Link to="/simulador" style={{ fontSize: '14px', fontWeight: 600 }}>Acessar motor {'->'}</Link>
                  </div>
                </div>

                <div className="bento-item bento-square" style={{ 
                  backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.9)), url("/networking-bg.png")', 
                  backgroundSize: 'cover', 
                  backgroundPosition: 'center',
                  border: '1px solid rgba(246, 184, 40, 0.3)'
                }}>
                  <div>
                    <h3 className="apple-subheading" style={{ margin: 0, color: 'var(--premium-yellow)' }}>Networking Bruto</h3>
                    <p style={{ color: 'var(--text-light)', marginTop: '12px', fontSize: '15px', lineHeight: '1.5' }}>
                      Pares de trincheira para trocar estratégia de guerra. Sem ilusão.
                    </p>
                  </div>
                </div>

                {/* Row 2: Copywriting Mosaic Integration */}
                <div className="bento-item bento-square" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <h4 style={{ color: 'var(--premium-yellow)', fontSize: '20px', marginBottom: '12px' }}>Margem Mutilada</h4>
                  <p style={{ color: 'var(--text-secondary-light)', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                    Sua agência cresceu, mas o dinheiro não sobra. Você trabalha 14 horas por dia e o fluxo sangra todo dia 5.
                  </p>
                </div>

                <div className="bento-item bento-square" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <h4 style={{ color: 'var(--premium-yellow)', fontSize: '20px', marginBottom: '12px' }}>Escalada Torta</h4>
                  <p style={{ color: 'var(--text-secondary-light)', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                    Planilhas resolvem problemas de 10 clientes, mas quebram a sua empresa aos 50. Pare de depender da memória titular.
                  </p>
                </div>

                <div className="bento-item bento-square" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <h4 style={{ color: 'var(--premium-yellow)', fontSize: '20px', marginBottom: '12px' }}>Caos Tributário</h4>
                  <p style={{ color: 'var(--text-secondary-light)', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                    Multas por esquecimento não são acidentes. São defeitos gritantes na sua linha de montagem e no manuseio de DARFs.
                  </p>
                </div>

                {/* Row 3: Glass Banner */}
                <div className="bento-item bento-wide glass-panel" style={{ border: 'none', gridColumn: 'span 12' }}>
                  <h3 className="apple-subheading" style={{ margin: 0, color: 'var(--premium-yellow)', fontSize: '24px' }}>
                    O Café não é um curso. É um laboratório de sobrevivência.
                  </h3>
                </div>

              </div>
            </FadeIn>
          </div>
        </section>

        {/* Section 5: The Final CTA */}
        <section className="apple-section bg-black" style={{ paddingBottom: '60px' }}>
          <div className="apple-container">
            <FadeIn>
              <h2 className="apple-heading" style={{ fontSize: '42px' }}>A porta está destrancada.</h2>
              <p className="apple-body" style={{ color: 'var(--text-secondary-light)' }}>
                Sem contrato anual. Sem fidelidade.<br/>Você fica pela utilidade, não pela obrigação.
              </p>
              <div style={{ marginTop: '40px' }}>
                 <Link to={targetPath}>
                  <Button variant="primary" size="lg">
                    ACESSO IMEDIATO
                  </Button>
                </Link>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>

      {/* Footer Restructured */}
      <footer className="bg-black" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '60px 40px' }}>
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '40px' }}>
          <div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary-light)', marginBottom: '8px', fontStyle: 'italic' }}>
              "Sê útil. Deixa rastro." São Josemaria Escrivá
            </p>
            <p style={{ fontFamily: 'Times New Roman, serif', fontStyle: 'italic', fontSize: '14px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              Sub Patrocinio Sancti Ioseph
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px' }}>
            <Link to="/em-construcao" style={{ color: 'var(--text-secondary-light)', transition: 'color 0.2s ease' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-light)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary-light)'}>Contato</Link>
            <Link to="/em-construcao" style={{ color: 'var(--text-secondary-light)', transition: 'color 0.2s ease' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-light)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary-light)'}>Mentoria</Link>
            <Link to="/em-construcao" style={{ color: 'var(--text-secondary-light)', transition: 'color 0.2s ease' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-light)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary-light)'}>Residência em BPO</Link>
            <Link to="/em-construcao" style={{ color: 'var(--text-secondary-light)', transition: 'color 0.2s ease' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-light)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary-light)'}>Encontros ao Vivo</Link>
            <Link to="/em-construcao" style={{ color: 'var(--text-secondary-light)', transition: 'color 0.2s ease' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-light)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary-light)'}>Parcerias</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
