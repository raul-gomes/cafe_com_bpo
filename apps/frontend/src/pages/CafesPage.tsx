import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/ui/Navbar';
import { CafeIcon } from '../brand/CafeIcon';
import { CAFE_CHANNELS, CAFE_TIME, nextOpenCafe } from '../components/home/cafes';
import { useStackedSheets } from '../components/home/useStackedSheets';
import { PublicFooter } from '../components/home/PublicFooter';
import { CafeRsvpStrip } from '../components/home/CafeRsvp';
import { usePageMeta } from '../lib/seo';
import './home.css';

/**
 * Cafés schedule: open café (last Wednesday of the month) and the Betas café
 * (every Wednesday), with the channels that announce the meeting link.
 *
 * @returns The page.
 */
const CafesPage: React.FC = () => {
  usePageMeta({
    title: 'Agenda dos cafés',
    description: 'Encontros do Café com BPO: café aberto na última quarta do mês, às 14h, no Meet, e café dos Betas toda quarta. Veja como participar.',
    path: '/cafes',
  });
  const pageRef = useRef<HTMLDivElement>(null);
  useStackedSheets(pageRef);

  const next = nextOpenCafe(new Date()).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return (
    <div ref={pageRef} className="hb-page">
      <Navbar />
      <main>
        <section className="hb-sheet hb-hero-sheet"><div className="hb-hero">
          <p className="hb-kicker"><span className="hb-dot" aria-hidden="true" /> Agenda dos cafés</p>
          <h1 className="hb-display">
            O que nos une não é o nicho.
            <em> É o desejo de escalar sem endoidar.</em>
          </h1>
          <p className="hb-lead">
            Os encontros são frequentes, sempre com um tema e pensados para um movimento específico do BPO.
            Puxa uma cadeira: o café já está passado.
          </p>
          <CafeRsvpStrip />
        </div></section>

        <section className="hb-sheet hb-section hb-section-soft" aria-label="Encontros">
          <div className="hb-grid hb-grid-3 hb-cafes-grid">
            <article className="hb-card">
              <span className="hb-card-icon"><CafeIcon name="encontro" /></span>
              <h3>Café aberto · última quarta do mês, às {CAFE_TIME}</h3>
              <p>
                Encontro aberto a toda a comunidade, no Google Meet. O próximo é <strong>{next}, às {CAFE_TIME}</strong>.
                O link sai nos nossos canais — entre em um deles para receber.
              </p>
            </article>
            <article className="hb-card">
              <span className="hb-card-icon"><CafeIcon name="conversa-cafe" /></span>
              <h3>Café dos Betas · toda quarta, às {CAFE_TIME}</h3>
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

        <section className="hb-sheet hb-section" aria-labelledby="channels-title">
          <div className="hb-section-head">
            <p className="hb-kicker">Onde sai o link do encontro</p>
            <h2 id="channels-title" className="hb-headline">Entre em um dos canais e não perca o próximo.</h2>
          </div>
          <div className="hb-grid hb-grid-3">
            {CAFE_CHANNELS.map(channel => (
              <a
                key={channel.name}
                href={channel.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hb-card hb-channel"
              >
                <span className="hb-card-icon"><CafeIcon name={channel.icon} /></span>
                <h3>{channel.name}</h3>
                <p>{channel.description}</p>
                <span className="hb-channel-open">Abrir <CafeIcon name="expandir" className="size-[16px]" /></span>
              </a>
            ))}
          </div>
          <p className="hb-cafes-note">Não deixe de nos acompanhar.</p>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};

export default CafesPage;
