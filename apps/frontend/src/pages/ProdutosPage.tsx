import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/ui/Navbar';
import { CafeIcon, type CafeIconName } from '../brand/CafeIcon';
import { useFolhasSobrepostas } from '../components/home/useFolhasSobrepostas';
import './home.css';

interface Produto {
  icon: CafeIconName;
  etiqueta: string;
  nome: string;
  texto: string;
  acao?: { rotulo: string; para: string };
}

/** Vitrine do que o Café oferece. Conteúdo detalhado de cada produto vem depois. */
const PRODUTOS: Produto[] = [
  {
    icon: 'carteira',
    etiqueta: 'Disponível',
    nome: 'Precificação',
    texto: 'A calculadora de preço do Café: custo real da operação, tempo de cada serviço e margem — sem chute e sem subvalorizar o seu trabalho.',
    acao: { rotulo: 'Calcular agora', para: '/precificacao' },
  },
  {
    icon: 'encontro',
    etiqueta: 'Documentário',
    nome: 'Residência em BPO',
    texto: 'Uma jornada documentada de ponta a ponta: a transição de carreira e a criação de uma empresa de BPO com um cliente real. Na Hotmart.',
  },
  {
    icon: 'xicara',
    etiqueta: 'Em construção · Beta',
    nome: 'Ferramenta Café com BPO',
    texto: 'O escritório de BPO em um lugar só: tempo de cada atividade, captação com estrutura, rotinas por cliente e comunidade.',
    acao: { rotulo: 'Quero ser Beta', para: '/#quero-ser-beta' },
  },
];

const ProdutosPage: React.FC = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  useFolhasSobrepostas(pageRef);
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
          {PRODUTOS.map(produto => (
            <article key={produto.nome} className="hb-card hb-produto">
              <span className="hb-card-icon"><CafeIcon name={produto.icon} /></span>
              <p className="hb-produto-etiqueta">{produto.etiqueta}</p>
              <h3>{produto.nome}</h3>
              <p>{produto.texto}</p>
              {produto.acao && (
                <Link to={produto.acao.para} className="hb-link hb-produto-acao">
                  {produto.acao.rotulo}
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>

    <footer className="hb-footer">
      <span>© {new Date().getFullYear()} Café com BPO</span>
      <Link to="/" className="hb-footer-link">Voltar ao início</Link>
    </footer>
  </div>
  );
};

export default ProdutosPage;
