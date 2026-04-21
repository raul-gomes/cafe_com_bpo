import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './HomePage.css';

const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const targetPath = isAuthenticated ? '/painel' : '/login';

  useEffect(() => {
    // ── Nav scroll glass effect
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // ── Scroll reveal
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    reveals.forEach(el => observer.observe(el));

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="home-v2-container">
      {/* NAV */}
      <nav id="navbar" className={`v2-nav ${isScrolled ? 'scrolled' : ''}`}>
        <div className="nav-logo">
          CAFÉ COM BPO
          <div className="nav-dot"></div>
        </div>
        <div className="nav-links">
          <a href="https://www.youtube.com/@cafecombpo" target="_blank" rel="noopener noreferrer" className="nav-social" title="YouTube">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
              <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
            </svg>
          </a>
          <a href="https://www.linkedin.com/in/ghutoc/" target="_blank" rel="noopener noreferrer" className="nav-social" title="LinkedIn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
              <rect x="2" y="9" width="4" height="12"/>
              <circle cx="4" cy="4" r="2"/>
            </svg>
          </a>
          <Link to="/simulador" className="nav-link-text">Simulador</Link>
          <Link to={targetPath} className="nav-cta-btn">
            {isAuthenticated ? 'PAINEL' : 'QUERO ACESSO'}
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero">
        <div className="hero-grid"></div>
        <div className="hero-orb hero-orb-1"></div>
        <div className="hero-orb hero-orb-2"></div>

        <div className="hero-content">
          <p className="hero-eyebrow">
            <span className="hero-eyebrow-line"></span>
            Café com BPO — O movimento
          </p>
          <h1 className="hero-headline">
            BPO Financeiro<br />
            não é fácil.<br />
            <em>Nunca foi.</em>
          </h1>
          <p className="hero-sub">E quem te disse o contrário nunca colocou a mão na massa.</p>
          <div className="hero-actions">
            <Link to={targetPath} className="btn-primary-v2">
              {isAuthenticated ? 'ACESSAR PAINEL' : 'QUERO FAZER PARTE'}
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <a href="https://youtube.com/@cafecombpo" target="_blank" rel="noopener noreferrer" className="btn-ghost-v2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
              </svg>
              Ver no YouTube
            </a>
          </div>
        </div>

        <div className="hero-float-card">
          <div className="hero-float-stat">
            <div className="hero-float-number">+<span>1.000</span>h</div>
            <div className="hero-float-label">de mapeamento de operações BPO</div>
          </div>
          <div className="hero-float-divider"></div>
          <div className="hero-float-stat">
            <div className="hero-float-number"><span>0</span></div>
            <div className="hero-float-label">operações iguais encontradas</div>
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section id="problema">
        <div className="problema-grid">
          <div className="reveal">
            <p className="section-label">O problema</p>
            <h2 className="problema-headline">
              O mercado vende BPO<br />
              como se fosse<br />
              <strong>receita de bolo.</strong>
            </h2>
          </div>
          <div className="reveal reveal-delay-2">
            <div className="problema-body">
              <p>Guru que não opera há anos empacota método como se toda empresa fosse igual. Como se existisse um jeito certo. Como se bastasse seguir os passos.</p>
              <p>Não é. Nunca foi. Cada empresa tem seu próprio drama, sua própria lógica, suas próprias entranhas. E só quem ainda opera sabe disso.</p>
              <p>O Café com BPO existe porque o mercado precisava de alguém disposto a falar a verdade.</p>
            </div>
          </div>
        </div>
      </section>

      {/* MOVIMENTO */}
      <section id="movimento">
        <div className="movimento-bg-circle"></div>
        <div className="movimento-inner reveal">
          <div className="movimento-glass">
            <p className="section-label" style={{ justifyContent: 'center', color: 'rgba(255,255,255,0.25)' }}>O que é isso</p>
            <h2 className="movimento-headline">
              Um movimento.<br />
              Uma comunidade.<br />
              <em>Uma plataforma.</em>
            </h2>
            <p className="movimento-body">
              Construída por quem faz BPO de verdade — compartilhando erros, acertos e o que ninguém te conta nos cursos. Sem fórmula mágica. Sem palco. Com pé no chão.
            </p>
          </div>
        </div>
      </section>

      {/* FERRAMENTAS */}
      <section id="ferramentas">
        <div className="ferramentas-grid">
          <Link to="/simulador" className="ferramenta-card reveal reveal-delay-1" style={{ textDecoration: 'none' }}>
            <div className="ferramenta-glow"></div>
            <span className="ferramenta-number">01</span>
            <div className="ferramenta-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
              </svg>
            </div>
            <h3 className="ferramenta-title">Calculadora de Precificação</h3>
            <p className="ferramenta-desc">Precifique seus serviços BPO com lógica real. Sem chute, sem subvalorização.</p>
          </Link>

          <Link to="/painel/forum" className="ferramenta-card reveal reveal-delay-2" style={{ textDecoration: 'none' }}>
            <div className="ferramenta-glow"></div>
            <span className="ferramenta-number">02</span>
            <div className="ferramenta-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="ferramenta-title">Fórum de Profissionais</h3>
            <p className="ferramenta-desc">Conversas reais entre quem opera. Troca de experiência sem filtro de guru.</p>
          </Link>

          <div className="ferramenta-card reveal reveal-delay-3">
            <div className="ferramenta-glow"></div>
            <span className="ferramenta-number">03</span>
            <div className="ferramenta-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="ferramenta-title">Encontros</h3>
            <p className="ferramenta-desc">Momentos de conexão entre profissionais que constroem esse mercado juntos.</p>
          </div>
        </div>
      </section>

      {/* GHUTO */}
      <section id="ghuto">
        <div className="ghuto-inner">
          <div className="ghuto-photo-wrap reveal">
            <div className="ghuto-photo-area">
              <img 
                src="/ghuto_cesar.jpeg" 
                alt="Ghuto César" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div className="ghuto-photo-overlay"></div>
              <span className="ghuto-photo-name">Ghuto César</span>
            </div>
            <div className="ghuto-stat-float">
              <div className="ghuto-stat-float-number">+<em>1.000</em>h</div>
              <div className="ghuto-stat-float-label">mapeando operações BPO pelo Brasil</div>
            </div>
          </div>

          <div className="ghuto-content reveal reveal-delay-2">
            <p className="section-label">Quem está por trás</p>
            <h2 className="ghuto-quote">
              Mapeando pessoas e empresas BPO pelo Brasil.<br />
              <strong>Nenhuma operação igual à outra.</strong>
            </h2>
            <p className="ghuto-body">
              É disso que eu falo. Não de teoria. Não de método que funciona no papel. Falo do que vi, do que errei, do que aprendi operando de verdade — e da convicção de que esse mercado merece uma conversa mais honesta.
            </p>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section id="cta-final">
        <div className="cta-inner reveal">
          <div className="cta-glass">
            <h2 className="cta-headline">
              Chega de operar<br />
              <em>no escuro.</em>
            </h2>
            <p className="cta-sub">Entra. Usa. Colabora.</p>
            
            <div className="cta-action-wrapper">
              <Link to={targetPath} className="btn-primary-v2">
                {isAuthenticated ? 'ACESSAR PAINEL' : 'QUERO ACESSO'}
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <p className="cta-note">Acesso gratuito. Construindo junto.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: 'var(--black)', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '40px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          CAFÉ COM BPO <div className="nav-dot" style={{ width: '4px', height: '4px', opacity: 0.3 }}></div>
        </div>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.15)' }}>© 2025 Café com BPO. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default HomePage;
