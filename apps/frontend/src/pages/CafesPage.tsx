import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/ui/Navbar';
import { CafeIcon, type CafeIconName } from '../brand/CafeIcon';
import { CANAIS_CAFE, proximoCafeAberto } from '../components/home/cafes';
import './home.css';

/** Agenda dos cafés: encontros abertos (última quarta do mês) e o café dos Betas (toda quarta). */
const CafesPage: React.FC = () => {
  const proximo = proximoCafeAberto(new Date()).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return (
    <div className="hb-page">
      <Navbar />
      <main>
        <section className="hb-hero">
          <p className="hb-kicker"><span className="hb-dot" aria-hidden="true" /> Agenda dos cafés</p>
          <h1 className="hb-display">
            O que nos une não é o nicho.
            <em> É o desejo de escalar sem endoidar.</em>
          </h1>
          <p className="hb-lead">
            Os encontros são frequentes, sempre com um tema e pensados para um movimento específico do BPO.
            Puxa uma cadeira: o café já está passado.
          </p>
        </section>

        <section className="hb-section hb-section-soft" aria-label="Encontros">
          <div className="hb-grid hb-grid-3 hb-cafes-grid">
            <article className="hb-card">
              <span className="hb-card-icon"><CafeIcon name="encontro" /></span>
              <h3>Café aberto · última quarta do mês</h3>
              <p>
                Encontro aberto a toda a comunidade, no Google Meet. O próximo é <strong>{proximo}</strong>.
                O link sai nos nossos canais — entre em um deles para receber.
              </p>
            </article>
            <article className="hb-card">
              <span className="hb-card-icon"><CafeIcon name="conversa-cafe" /></span>
              <h3>Café dos Betas · toda quarta</h3>
              <p>
                Para quem é Beta: toda semana a gente discute a ferramenta, com muitos insights, ideias e a construção
                da nossa ferramenta perfeita.
              </p>
              <Link to="/#quero-ser-beta" className="hb-link">Quero ser Beta</Link>
            </article>
            <article className="hb-card">
              <span className="hb-card-icon"><CafeIcon name="arquivo" /></span>
              <h3>Gravações e materiais</h3>
              <p>
                Os encontros ficam gravados, com materiais voltados para os membros do canal no YouTube. Temos também o
                documentário <em>Residência em BPO</em> na Hotmart — e muito mais vindo por aí.
              </p>
            </article>
          </div>
        </section>

        <section className="hb-section" aria-labelledby="canais-titulo">
          <div className="hb-section-head">
            <p className="hb-kicker">Onde sai o link do encontro</p>
            <h2 id="canais-titulo" className="hb-headline">Entre em um dos canais e não perca o próximo.</h2>
          </div>
          <div className="hb-grid hb-grid-3">
            {CANAIS_CAFE.map(canal => (
              <a
                key={canal.nome}
                href={canal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hb-card hb-canal"
              >
                <span className="hb-card-icon"><CafeIcon name={canal.icone as CafeIconName} /></span>
                <h3>{canal.nome}</h3>
                <p>{canal.descricao}</p>
                <span className="hb-canal-abrir">Abrir <CafeIcon name="expandir" className="size-[16px]" /></span>
              </a>
            ))}
          </div>
          <p className="hb-cafes-nota">Não deixe de nos acompanhar.</p>
        </section>
      </main>

      <footer className="hb-footer">
        <span>© {new Date().getFullYear()} Café com BPO</span>
        <Link to="/" className="hb-footer-link">Voltar ao início</Link>
      </footer>
    </div>
  );
};

export default CafesPage;
