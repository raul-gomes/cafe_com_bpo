import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CafeIcon, type CafeIconName } from '../brand/CafeIcon';
import { logoFor, useAppearance } from '../brand/appearance';
import { ModalNosAjude } from '../components/panel/ModalNosAjude';
import { BetaSignupForm } from '../components/home/BetaSignupForm';
import './home.css';

/** O que estamos construindo: o formato do que dá para alcançar, sem dizer "onde". */
const CONSTRUINDO: { icon: CafeIconName; titulo: string; texto: string }[] = [
  {
    icon: 'tempo',
    titulo: 'Seu dia em horas, não em listas',
    texto: 'Cada atividade com o tempo que ela leva. Você abre e sabe se o dia cabe — e quando é hora de chamar alguém para ajudar.',
  },
  {
    icon: 'coador',
    titulo: 'Captar com estrutura',
    texto: 'Roteiro de reunião, mensagem certa, leitura do perfil do cliente. Vender sem deixar de ser financeiro.',
  },
  {
    icon: 'rotina',
    titulo: 'Processo que roda sozinho',
    texto: 'Rotinas, prazos de fechamento e entregas por cliente, sem depender da memória de ninguém.',
  },
  {
    icon: 'conversa-cafe',
    titulo: 'Seus dados conversando',
    texto: 'Integrações e dados prontos para a sua própria inteligência analisar. Você decide; a ferramenta organiza.',
  },
];

const BENEFICIOS: { icon: CafeIconName; titulo: string; texto: string }[] = [
  {
    icon: 'processo',
    titulo: 'Você constrói junto',
    texto: 'O que você testa e sugere vira funcionalidade. Beta aqui não é cobaia: é coautor.',
  },
  {
    icon: 'favorito',
    titulo: 'Benefícios de quem chegou primeiro',
    texto: 'Condições especiais para quem ajudou a fazer o Café funcionar desde o começo.',
  },
  {
    icon: 'xicara',
    titulo: 'Café toda quarta',
    texto: 'Um encontro semanal com quem está construindo. O bastidor é outra coisa — o café tem crema.',
  },
];

/** Seções entram como fichas saindo do arquivo, uma vez, ao aparecer na tela. */
function useFichasEntrando(root: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const fichas = root.current?.querySelectorAll<HTMLElement>('.hb-ficha') ?? [];
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduzir || typeof IntersectionObserver === 'undefined') {
      fichas.forEach(el => el.classList.add('is-in'));
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    fichas.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [root]);
}

const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [{ mode }] = useAppearance();
  const [colaboreOpen, setColaboreOpen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  useFichasEntrando(pageRef);

  const irParaInscricao = (event: React.MouseEvent) => {
    event.preventDefault();
    document.getElementById('quero-ser-beta')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div ref={pageRef} className="hb-page" data-testid="home-page">
      <header className="hb-nav">
        <Link to="/" className="hb-nav-brand" aria-label="Café com BPO">
          <img src={logoFor(mode)} alt="Café com BPO" />
        </Link>
        <nav className="hb-nav-links" aria-label="Principal">
          <Link to="/simulador">Simulador</Link>
          <Link to={isAuthenticated ? '/painel' : '/login'}>{isAuthenticated ? 'Painel' : 'Entrar'}</Link>
          <a href="#quero-ser-beta" onClick={irParaInscricao} className="hb-nav-cta">Quero ser Beta</a>
        </nav>
      </header>

      <main>
        {/* ── Abertura ── */}
        <section className="hb-hero">
          <p className="hb-kicker"><span className="hb-dot" aria-hidden="true" /> Fase beta · vagas abertas</p>
          <h1 className="hb-display">
            Inteligência de negócio não é IA.
            <em> É você com a realidade.</em>
          </h1>
          <p className="hb-lead">
            Estamos contratando Betas para testar, criar e fazer funcionar de um jeito que só o Café tem.
            Quatro anos de chão de BPO — e dois passos à frente.
          </p>
          <div className="hb-hero-actions">
            <a href="#quero-ser-beta" onClick={irParaInscricao} className="cafe-command cafe-command-tab hb-cta">
              <CafeIcon name="assinatura" />
              <span>Quero fazer parte desta construção</span>
            </a>
            <Link to="/simulador" className="hb-link">Ver o simulador de preço</Link>
          </div>
        </section>

        {/* ── Inscrição ── */}
        <section id="quero-ser-beta" className="hb-section hb-section-signup" aria-labelledby="inscricao-titulo">
          <div className="hb-signup">
            <div className="hb-signup-intro">
              <p className="hb-kicker">Inscrição Beta</p>
              <h2 id="inscricao-titulo" className="hb-headline">Quer fazer parte desta construção?</h2>
              <p className="hb-section-lead">
                Conta um pouco de você. A gente lê cada inscrição e chama os Betas aos poucos, para dar atenção de verdade.
              </p>
            </div>
            <BetaSignupForm />
          </div>
        </section>
        {/* ── O que estamos construindo ── */}
        <section className="hb-section" aria-labelledby="construindo-titulo">
          <div className="hb-section-head hb-ficha">
            <p className="hb-kicker">O que estamos construindo</p>
            <h2 id="construindo-titulo" className="hb-headline">Um escritório de BPO que cabe em um lugar só.</h2>
            <p className="hb-section-lead">
              Não é mais uma planilha bonita. É o jeito de trabalhar de quem opera de verdade, organizado para você
              ficar no que importa: analisar e garantir que está tudo certo.
            </p>
          </div>
          <div className="hb-grid">
            {CONSTRUINDO.map((item, index) => (
              <article key={item.titulo} className="hb-card hb-ficha" style={{ '--hb-delay': `${index * 90}ms` } as React.CSSProperties}>
                <span className="hb-card-icon"><CafeIcon name={item.icon} /></span>
                <h3>{item.titulo}</h3>
                <p>{item.texto}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Por que ser Beta ── */}
        <section className="hb-section hb-section-soft" aria-labelledby="beta-titulo">
          <div className="hb-section-head hb-ficha">
            <p className="hb-kicker">Por que ser Beta</p>
            <h2 id="beta-titulo" className="hb-headline">Quem constrói junto, chega junto.</h2>
          </div>
          <div className="hb-grid hb-grid-3">
            {BENEFICIOS.map((item, index) => (
              <article key={item.titulo} className="hb-card hb-ficha" style={{ '--hb-delay': `${index * 90}ms` } as React.CSSProperties}>
                <span className="hb-card-icon"><CafeIcon name={item.icon} /></span>
                <h3>{item.titulo}</h3>
                <p>{item.texto}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Quem está por trás ── */}
        <section className="hb-section" aria-labelledby="quem-titulo">
          <div className="hb-person hb-ficha">
            <img src="/ghuto_cesar.jpeg" alt="Ghuto César" className="hb-person-photo" />
            <div>
              <p className="hb-kicker">Quem está por trás</p>
              <h2 id="quem-titulo" className="hb-headline">Ghuto César</h2>
              <p className="hb-section-lead">
                Mais de mil horas mapeando operações de BPO financeiro pelo Brasil. Nenhuma era igual à outra —
                e é dessa diferença, vista de perto, que o Café nasce.
              </p>
            </div>
          </div>
        </section>

        {/* ── Chamado final: volta ao formulário lá em cima ── */}
        <section className="hb-section hb-section-closing" aria-labelledby="fechamento-titulo">
          <div className="hb-closing hb-ficha">
            <h2 id="fechamento-titulo" className="hb-headline">Bora construir junto?</h2>
            <a href="#quero-ser-beta" onClick={irParaInscricao} className="cafe-command cafe-command-tab hb-cta">
              <CafeIcon name="assinatura" />
              <span>Quero ser Beta</span>
            </a>
          </div>
        </section>
      </main>

      <footer className="hb-footer">
        <span>© {new Date().getFullYear()} Café com BPO</span>
        <button type="button" onClick={() => setColaboreOpen(true)} className="hb-footer-colabore">
          <CafeIcon name="coracao" className="size-[18px]" /> Colabore com o projeto
        </button>
      </footer>

      <ModalNosAjude isOpen={colaboreOpen} onClose={() => setColaboreOpen(false)} />
    </div>
  );
};

export default HomePage;
