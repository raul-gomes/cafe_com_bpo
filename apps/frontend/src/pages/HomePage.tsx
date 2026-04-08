import React from 'react';
import { Navbar } from '../components/ui/Navbar';
import { Button } from '../components/ui/Button';
import { FadeIn } from '../components/ui/FadeIn';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div style={{ paddingBottom: '100px' }}>
      <Navbar />

      <main>
        {/* Section 1: Hero (Dark Mode) */}
        <section className="apple-section bg-black" style={{ minHeight: '100vh', paddingTop: '120px' }}>
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
                <a href="https://hotmart.com/pt-br/club/ocafe" target="_blank" rel="noreferrer">
                  <Button variant="primary" size="large">
                    FAZER PARTE DA REALIDADE
                  </Button>
                </a>
                <a href="#about">
                  <Button variant="outline" size="large">
                    Conhecer a verdade
                  </Button>
                </a>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Section 2: Statement (Light Mode) */}
        <section id="about" className="apple-section bg-light">
          <div className="apple-container" style={{ maxWidth: '700px' }}>
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

        {/* Section 3: The Author / Reality (Dark Mode) */}
        <section className="apple-section bg-black">
          <div className="apple-container" style={{ maxWidth: '700px' }}>
            <FadeIn delay={1}>
              <h2 className="apple-heading">A solidão do operador custa caro.</h2>
            </FadeIn>
            <FadeIn delay={2}>
              <p className="apple-body" style={{ color: 'var(--text-secondary-light)' }}>
                Ninguém te contou que crescer dói. Que a rotina operacional mastiga sonhos enquanto você resolve BO de cliente. Sozinho, você é uma ilha cercada por incertezas.
              </p>
              <p className="apple-body" style={{ color: 'var(--text-secondary-light)' }}>
                Eu sou Ghuto César. E não, não sou seu "mestre". Sou só o cara teimoso que decidiu questionar se o que os gurus vendem funciona no mundo real.
              </p>
              <p className="apple-body" style={{ color: 'var(--text-secondary-light)' }}>
                Ligo a câmera não para mostrar troféu, mas para mostrar a sujeira debaixo do tapete do BPO. Meus erros, meus testes, minhas teimosias. Se você procura um herói sem falhas, compre um gibi. Se procura um par de trincheira para trocar estratégia de guerra, bem-vindo.
              </p>
            </FadeIn>
            <FadeIn delay={3}>
              <div style={{ marginTop: '60px', padding: '40px', backgroundColor: 'var(--bg-dark-surface)', borderRadius: '12px' }}>
                <h3 className="apple-subheading" style={{ margin: 0 }}>
                  O Café não é um curso. É um laboratório de sobrevivência.
                </h3>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Section 4: Final CTA (Dark Mode) */}
        <section className="apple-section bg-black" style={{ paddingBottom: '60px' }}>
          <div className="apple-container">
            <FadeIn>
              <h2 className="apple-heading" style={{ fontSize: '42px' }}>A porta está destrancada.</h2>
              <p className="apple-body" style={{ color: 'var(--text-secondary-light)' }}>
                Sem contrato anual. Sem fidelidade.<br/>Você fica pela utilidade, não pela obrigação.
              </p>
              <div style={{ marginTop: '40px' }}>
                <a href="https://hotmart.com/pt-br/club/ocafe" target="_blank" rel="noreferrer">
                  <Button variant="primary" size="large">FAZER PARTE DA REALIDADE</Button>
                </a>
                <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-secondary-light)', fontWeight: 600 }}>
                  ACESSO IMEDIATO • CANCELE QUANDO QUISER
                </p>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '40px', textAlign: 'center' }}>
        <div className="apple-container">
          <p style={{ fontSize: '12px', color: 'var(--text-secondary-light)', marginBottom: '16px' }}>
            "Sê útil. Deixa rastro." São Josemaria Escrivá<br/>
            Sub Patrocinio Sancti Ioseph
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '12px', color: 'var(--text-secondary-light)' }}>
            <Link to="/em-construcao" style={{ color: 'var(--text-secondary-light)' }}>Contato</Link>
            <Link to="/em-construcao" style={{ color: 'var(--text-secondary-light)' }}>Mentoria</Link>
            <Link to="/em-construcao" style={{ color: 'var(--text-secondary-light)' }}>Residência em BPO</Link>
            <Link to="/em-construcao" style={{ color: 'var(--text-secondary-light)' }}>Encontros ao vivo</Link>
            <Link to="/em-construcao" style={{ color: 'var(--text-secondary-light)' }}>Parcerias</Link>
          </div>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '40px' }}>
            © 2025 Ghuto César.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
