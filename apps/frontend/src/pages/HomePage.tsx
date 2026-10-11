import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CafeIcon, type CafeIconName } from '../brand/CafeIcon';
import { ModalNosAjude } from '../components/panel/ModalNosAjude';
import { BetaSignupForm } from '../components/home/BetaSignupForm';
import { CafeBanner } from '../components/home/CafeBanner';
import { Navbar } from '../components/ui/Navbar';
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


/**
 * Folha sobre folha: cada seção fica presa no topo (sticky) e a seguinte sobe
 * por cima dela, como uma folha colocada sobre outra. Seção mais alta que a
 * tela primeiro rola até o fim e só então fica presa (top negativo), para nada
 * ficar escondido. Só no computador e sem "reduzir movimento".
 */
function useFolhasSobrepostas(root: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const page = root.current;
    const desktop = window.matchMedia?.('(min-width: 900px)');
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!page || !desktop || !reduzir) return;

    const folhas = () => Array.from(page.querySelectorAll<HTMLElement>('.hb-sheet'));
    const ajustar = () => {
      const ativo = desktop.matches && !reduzir.matches;
      page.classList.toggle('hb-sheets-on', ativo);
      const topo = document.querySelector<HTMLElement>('.pub-nav')?.offsetHeight ?? 0;
      folhas().forEach((folha, index) => {
        folha.style.zIndex = ativo ? String(index + 1) : '';
        folha.style.top = ativo ? `${Math.min(topo, window.innerHeight - folha.offsetHeight)}px` : '';
      });
    };

    ajustar();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ajustar) : null;
    folhas().forEach(folha => observer?.observe(folha));
    window.addEventListener('resize', ajustar);
    desktop.addEventListener?.('change', ajustar);
    reduzir.addEventListener?.('change', ajustar);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', ajustar);
      desktop.removeEventListener?.('change', ajustar);
      reduzir.removeEventListener?.('change', ajustar);
    };
  }, [root]);
}

const HomePage: React.FC = () => {
  const [colaboreOpen, setColaboreOpen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();
  useFolhasSobrepostas(pageRef);

  // Vindo de outra página pelo "Quero ser Beta" do topo (/#quero-ser-beta).
  useEffect(() => {
    if (hash === '#quero-ser-beta') {
      document.getElementById('quero-ser-beta')?.scrollIntoView({ block: 'start' });
    }
  }, [hash]);

  const irParaInscricao = (event: React.MouseEvent) => {
    event.preventDefault();
    document.getElementById('quero-ser-beta')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div ref={pageRef} className="hb-page" data-testid="home-page">
      <Navbar />

      <main>
        {/* ── Abertura ── */}
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
              <a href="#quero-ser-beta" onClick={irParaInscricao} className="cafe-command cafe-command-tab hb-cta">
                <CafeIcon name="assinatura" />
                <span>Quero fazer parte desta construção</span>
              </a>
              <Link to="/precificacao" className="hb-link">Calcular o preço do meu BPO</Link>
            </div>
          </div>
        </section>

        {/* ── Inscrição ── */}
        <section id="quero-ser-beta" className="hb-sheet hb-section hb-section-signup" aria-labelledby="inscricao-titulo">
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
        <section className="hb-sheet hb-section" aria-labelledby="construindo-titulo">
          <div className="hb-section-head">
            <p className="hb-kicker">O que estamos construindo</p>
            <h2 id="construindo-titulo" className="hb-headline">Um escritório de BPO que cabe em um lugar só.</h2>
            <p className="hb-section-lead">
              Não é mais uma planilha bonita. É o jeito de trabalhar de quem opera de verdade, organizado para você
              ficar no que importa: analisar e garantir que está tudo certo.
            </p>
          </div>
          <div className="hb-grid">
            {CONSTRUINDO.map(item => (
              <article key={item.titulo} className="hb-card">
                <span className="hb-card-icon"><CafeIcon name={item.icon} /></span>
                <h3>{item.titulo}</h3>
                <p>{item.texto}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Por que ser Beta ── */}
        <section className="hb-sheet hb-section hb-section-soft" aria-labelledby="beta-titulo">
          <div className="hb-section-head">
            <p className="hb-kicker">Por que ser Beta</p>
            <h2 id="beta-titulo" className="hb-headline">Quem constrói junto, chega junto.</h2>
          </div>
          <div className="hb-grid hb-grid-3">
            {BENEFICIOS.map(item => (
              <article key={item.titulo} className="hb-card">
                <span className="hb-card-icon"><CafeIcon name={item.icon} /></span>
                <h3>{item.titulo}</h3>
                <p>{item.texto}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Quem está por trás ── */}
        <section className="hb-sheet hb-section" aria-labelledby="quem-titulo">
          <div className="hb-person">
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

        {/* ── Colabore ── */}
        <section className="hb-sheet hb-section hb-section-soft" aria-labelledby="colabore-secao-titulo">
          <div className="hb-colabore">
            <span className="hb-card-icon hb-colabore-icon"><CafeIcon name="coracao" /></span>
            <div>
              <p className="hb-kicker">Colabore</p>
              <h2 id="colabore-secao-titulo" className="hb-headline">Sem você, isso não seria possível.</h2>
              <p className="hb-section-lead">
                Este projeto é maior do que cada um de nós. Quando todo mundo coloca um pouco, chegar lá fica mais
                leve e mais rápido — e o que a gente constrói segue aberto para quem precisa.
              </p>
            </div>
            <button type="button" onClick={() => setColaboreOpen(true)} className="cafe-command cafe-command-tab hb-cta">
              <CafeIcon name="coracao" />
              <span>Quero contribuir</span>
            </button>
          </div>
        </section>

        {/* ── Chamado final: volta ao formulário lá em cima ── */}
        <section className="hb-sheet hb-section hb-section-closing" aria-labelledby="fechamento-titulo">
          <div className="hb-closing">
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
        <Link to="/cafes" className="hb-footer-link">Agenda dos cafés</Link>
      </footer>

      <CafeBanner />
      <ModalNosAjude isOpen={colaboreOpen} onClose={() => setColaboreOpen(false)} />
    </div>
  );
};

export default HomePage;
