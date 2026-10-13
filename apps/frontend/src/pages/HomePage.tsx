import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CafeIcon, type CafeIconName } from '../brand/CafeIcon';
import { ModalNosAjude } from '../components/panel/ModalNosAjude';
import { BetaSignupForm } from '../components/home/BetaSignupForm';
import { CafeBanner } from '../components/home/CafeBanner';
import { Navbar } from '../components/ui/Navbar';
import { useStackedSheets } from '../components/home/useStackedSheets';
import './home.css';
import { usePageMeta } from '../lib/seo';
import { PublicFooter } from '../components/home/PublicFooter';

interface Highlight {
  icon: CafeIconName;
  title: string;
  text: string;
}

/** What we are building: the shape of what can be achieved, without saying "where". */
const BUILDING: Highlight[] = [
  {
    icon: 'tempo',
    title: 'Seu dia em horas, não em listas',
    text: 'Cada atividade com o tempo que ela leva. Você abre e sabe se o dia cabe — e quando é hora de chamar alguém para ajudar.',
  },
  {
    icon: 'coador',
    title: 'Captar com estrutura',
    text: 'Roteiro de reunião, mensagem certa, leitura do perfil do cliente. Vender sem deixar de ser financeiro.',
  },
  {
    icon: 'rotina',
    title: 'Processo que roda sozinho',
    text: 'Rotinas, prazos de fechamento e entregas por cliente, sem depender da memória de ninguém.',
  },
  {
    icon: 'conversa-cafe',
    title: 'Seus dados conversando',
    text: 'Integrações e dados prontos para a sua própria inteligência analisar. Você decide; a ferramenta organiza.',
  },
];

/** Why be a Beta tester. */
const BENEFITS: Highlight[] = [
  {
    icon: 'processo',
    title: 'Você constrói junto',
    text: 'O que você testa e sugere vira funcionalidade. Beta aqui não é cobaia: é coautor.',
  },
  {
    icon: 'favorito',
    title: 'Benefícios de quem chegou primeiro',
    text: 'Condições especiais para quem ajudou a fazer o Café funcionar desde o começo.',
  },
  {
    icon: 'xicara',
    title: 'Café toda quarta',
    text: 'Um encontro semanal com quem está construindo. O bastidor é outra coisa — o café tem crema.',
  },
];

/**
 * Landing page (beta phase): hero, Beta signup right after it, then what we
 * build, why be a Beta, who is behind it, how to contribute and a closing call.
 *
 * @returns The page.
 */
const HomePage: React.FC = () => {
  usePageMeta({
    title: 'Café com BPO',
    description: 'Comunidade, ferramenta e precificação para quem opera BPO financeiro. Inteligência de negócio não é IA: é você com a realidade. Seja Beta.',
    path: '/',
  });
  const [contributeOpen, setContributeOpen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();
  useStackedSheets(pageRef);

  // Coming from another page through the header "Quero ser Beta" (/#quero-ser-beta).
  useEffect(() => {
    if (hash === '#quero-ser-beta') {
      document.getElementById('quero-ser-beta')?.scrollIntoView({ block: 'start' });
    }
  }, [hash]);

  const scrollToSignup = (event: React.MouseEvent) => {
    event.preventDefault();
    document.getElementById('quero-ser-beta')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div ref={pageRef} className="hb-page" data-testid="home-page">
      <Navbar />

      <main>
        {/* ── Hero ── */}
        <section className="hb-sheet hb-hero-sheet">
          <div className="hb-hero">
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
              <a href="#quero-ser-beta" onClick={scrollToSignup} className="cafe-command cafe-command-tab hb-cta">
                <CafeIcon name="assinatura" />
                <span>Quero fazer parte desta construção</span>
              </a>
              <Link to="/precificacao" className="hb-link">Calcular o preço do meu BPO</Link>
            </div>
          </div>
        </section>

        {/* ── Beta signup ── */}
        <section id="quero-ser-beta" className="hb-sheet hb-section hb-section-signup" aria-labelledby="signup-title">
          <div className="hb-signup">
            <div className="hb-signup-intro">
              <p className="hb-kicker">Inscrição Beta</p>
              <h2 id="signup-title" className="hb-headline">Quer fazer parte desta construção?</h2>
              <p className="hb-section-lead">
                Conta um pouco de você. A gente lê cada inscrição e chama os Betas aos poucos, para dar atenção de verdade.
              </p>
            </div>
            <BetaSignupForm />
          </div>
        </section>

        {/* ── What we are building ── */}
        <section className="hb-sheet hb-section" aria-labelledby="building-title">
          <div className="hb-section-head">
            <p className="hb-kicker">O que estamos construindo</p>
            <h2 id="building-title" className="hb-headline">Um escritório de BPO que cabe em um lugar só.</h2>
            <p className="hb-section-lead">
              Não é mais uma planilha bonita. É o jeito de trabalhar de quem opera de verdade, organizado para você
              ficar no que importa: analisar e garantir que está tudo certo.
            </p>
          </div>
          <div className="hb-grid">
            {BUILDING.map(item => (
              <article key={item.title} className="hb-card">
                <span className="hb-card-icon"><CafeIcon name={item.icon} /></span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Why be a Beta ── */}
        <section className="hb-sheet hb-section hb-section-soft" aria-labelledby="beta-title">
          <div className="hb-section-head">
            <p className="hb-kicker">Por que ser Beta</p>
            <h2 id="beta-title" className="hb-headline">Quem constrói junto, chega junto.</h2>
          </div>
          <div className="hb-grid hb-grid-3">
            {BENEFITS.map(item => (
              <article key={item.title} className="hb-card">
                <span className="hb-card-icon"><CafeIcon name={item.icon} /></span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Who is behind it ── */}
        <section className="hb-sheet hb-section" aria-labelledby="about-title">
          <div className="hb-person">
            <img src="/ghuto_cesar.jpeg" alt="Ghuto César" className="hb-person-photo" />
            <div>
              <p className="hb-kicker">Quem está por trás</p>
              <h2 id="about-title" className="hb-headline">Ghuto César</h2>
              <p className="hb-section-lead">
                Mais de mil horas mapeando operações de BPO financeiro pelo Brasil. Nenhuma era igual à outra —
                e é dessa diferença, vista de perto, que o Café nasce.
              </p>
            </div>
          </div>
        </section>

        {/* ── Contribute ── */}
        <section className="hb-sheet hb-section hb-section-soft" aria-labelledby="contribute-title">
          <div className="hb-contribute">
            <span className="hb-card-icon hb-contribute-icon"><CafeIcon name="coracao" /></span>
            <div>
              <p className="hb-kicker">Colabore</p>
              <h2 id="contribute-title" className="hb-headline">Sem você, isso não seria possível.</h2>
              <p className="hb-section-lead">
                Este projeto é maior do que cada um de nós. Quando todo mundo coloca um pouco, chegar lá fica mais
                leve e mais rápido — e o que a gente constrói segue aberto para quem precisa.
              </p>
            </div>
            <button type="button" onClick={() => setContributeOpen(true)} className="cafe-command cafe-command-tab hb-cta">
              <CafeIcon name="coracao" />
              <span>Quero contribuir</span>
            </button>
          </div>
        </section>

        {/* ── Closing call: back to the signup form ── */}
        <section className="hb-sheet hb-section hb-section-closing" aria-labelledby="closing-title">
          <div className="hb-closing">
            <h2 id="closing-title" className="hb-headline">Bora construir junto?</h2>
            <a href="#quero-ser-beta" onClick={scrollToSignup} className="cafe-command cafe-command-tab hb-cta">
              <CafeIcon name="assinatura" />
              <span>Quero ser Beta</span>
            </a>
          </div>
        </section>
      </main>

      <PublicFooter />

      <CafeBanner />
      <ModalNosAjude isOpen={contributeOpen} onClose={() => setContributeOpen(false)} />
    </div>
  );
};

export default HomePage;
