import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/ui/Navbar';
import { CafeIcon, type CafeIconName } from '../brand/CafeIcon';
import { useStackedSheets } from '../components/home/useStackedSheets';
import { PublicFooter } from '../components/home/PublicFooter';
import { usePageMeta } from '../lib/seo';
import './home.css';

interface Product {
  icon: CafeIconName;
  tag: string;
  name: string;
  text: string;
  action?: { label: string; to: string };
}

/** Showcase of what Café com BPO offers; each product gets its own page later. */
const PRODUCTS: Product[] = [
  {
    icon: 'carteira',
    tag: 'Disponível',
    name: 'Precificação',
    text: 'A calculadora de preço do Café: custo real da operação, tempo de cada serviço e margem — sem chute e sem subvalorizar o seu trabalho.',
    action: { label: 'Calcular agora', to: '/precificacao' },
  },
  {
    icon: 'encontro',
    tag: 'Documentário',
    name: 'Residência em BPO',
    text: 'Uma jornada documentada de ponta a ponta: a transição de carreira e a criação de uma empresa de BPO com um cliente real. Na Hotmart.',
  },
  {
    icon: 'xicara',
    tag: 'Em construção · Beta',
    name: 'Ferramenta Café com BPO',
    text: 'O escritório de BPO em um lugar só: tempo de cada atividade, captação com estrutura, rotinas por cliente e comunidade.',
    action: { label: 'Quero ser Beta', to: '/#quero-ser-beta' },
  },
];

/**
 * Products page (public).
 *
 * @returns The page.
 */
const ProductsPage: React.FC = () => {
  usePageMeta({
    title: 'Produtos',
    description: 'Precificação, Residência em BPO e a ferramenta do Café com BPO: feito por quem opera, para quem quer escalar o BPO financeiro sem endoidar.',
    path: '/produtos',
  });
  const pageRef = useRef<HTMLDivElement>(null);
  useStackedSheets(pageRef);

  return (
    <div ref={pageRef} className="hb-page">
      <Navbar />
      <main>
        <section className="hb-sheet hb-hero-sheet"><div className="hb-hero">
          <p className="hb-kicker"><span className="hb-dot" aria-hidden="true" /> Produtos do Café</p>
          <h1 className="hb-display">
            Feito por quem opera.
            <em> Para quem quer escalar sem endoidar.</em>
          </h1>
          <p className="hb-lead">
            Ferramentas, conteúdo e a jornada de quem vive o BPO de verdade. E tem muito mais vindo por aí.
          </p>
        </div></section>

        <section className="hb-sheet hb-section hb-section-soft" aria-label="Produtos">
          <div className="hb-grid hb-grid-3">
            {PRODUCTS.map(product => (
              <article key={product.name} className="hb-card hb-product">
                <span className="hb-card-icon"><CafeIcon name={product.icon} /></span>
                <p className="hb-product-tag">{product.tag}</p>
                <h3>{product.name}</h3>
                <p>{product.text}</p>
                {product.action && (
                  <Link to={product.action.to} className="hb-link hb-product-action">
                    {product.action.label}
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};

export default ProductsPage;
