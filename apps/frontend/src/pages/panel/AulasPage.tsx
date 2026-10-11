import React from 'react';
import { CafeIcon, type CafeIconName } from '../../brand/CafeIcon';

type Secao = 'primeiros-passos' | 'bpo-primeiros-passos' | 'mentorias';

interface Aula {
  titulo: string;
  resumo: string;
}

const CONTEUDO: Record<Secao, { titulo: string; lead: string; icon: CafeIconName; aulas?: Aula[]; vazio?: string }> = {
  'primeiros-passos': {
    titulo: 'Primeiros passos',
    lead: 'Aulas curtas para tirar a ferramenta da caixa: do primeiro cliente à primeira rotina rodando.',
    icon: 'direcao',
    aulas: [
      { titulo: 'Conhecendo o painel e os módulos', resumo: 'Onde fica cada coisa e como trocar de módulo sem se perder.' },
      { titulo: 'Cadastrando o primeiro cliente', resumo: 'A ficha do cliente e o que vale registrar desde o início.' },
      { titulo: 'Montando rotinas e tempos', resumo: 'Atividades com tempo estimado para o painel mostrar o seu dia.' },
      { titulo: 'Precificando com a calculadora', resumo: 'Custo, tempo e margem para chegar ao preço justo.' },
    ],
  },
  'bpo-primeiros-passos': {
    titulo: 'BPO: primeiros passos',
    lead: 'Para quem está começando no BPO financeiro: a base da operação, do jeito que só quem opera ensina.',
    icon: 'aula',
    aulas: [
      { titulo: 'Aula de abertura', resumo: 'Com Ghuto César. Em produção — entra aqui assim que estiver pronta.' },
    ],
  },
  mentorias: {
    titulo: 'Mentorias',
    lead: 'Aulas de mentoria dadas pelos próprios membros da comunidade.',
    icon: 'pessoas',
    vazio: 'Este espaço está sendo preparado com calma. Em breve, membros da comunidade vão compartilhar aqui o que aprenderam operando.',
  },
};

/** Aulas › Primeiros passos / BPO: primeiros passos / Mentorias (conteúdo em produção). */
export const AulasPage: React.FC<{ secao: Secao }> = ({ secao }) => {
  const { titulo, lead, icon, aulas, vazio } = CONTEUDO[secao];

  return (
    <div className="mx-auto max-w-[1080px]">
      <header className="mb-[28px]">
        <p className="text-xs font-bold uppercase tracking-[0.11em] text-module">Aulas</p>
        <h1 className="mt-[6px] font-editorial text-[2.25rem] font-medium leading-tight tracking-[-0.02em] text-foreground">
          {titulo}
        </h1>
        <p className="mt-[8px] max-w-[60ch] text-[0.9875rem] text-muted-foreground">{lead}</p>
      </header>

      {aulas ? (
        <div className="grid gap-[20px] sm:grid-cols-2">
          {aulas.map((aula, index) => (
            <article key={aula.titulo} className="overflow-hidden rounded-lg border border-border bg-card">
              {/* Moldura do vídeo: a aula entra aqui quando for publicada. */}
              <div className="relative grid aspect-video place-items-center bg-module-bg text-module">
                <CafeIcon name="aula" className="size-[44px]" />
                <span className="absolute left-[12px] top-[12px] rounded-sm bg-card px-[8px] py-[3px] text-xs font-bold text-muted-foreground">
                  Aula {index + 1}
                </span>
                <span className="absolute bottom-[12px] right-[12px] rounded-sm bg-card px-[8px] py-[3px] text-xs font-semibold text-muted-foreground">
                  Em breve
                </span>
              </div>
              <div className="p-[18px]">
                <h2 className="text-[1.0625rem] font-bold text-foreground">{aula.titulo}</h2>
                <p className="mt-[6px] text-sm leading-relaxed text-muted-foreground">{aula.resumo}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex items-start gap-[16px] rounded-lg border border-dashed border-input bg-card p-[24px]">
          <span className="grid size-[48px] shrink-0 place-items-center rounded-lg bg-module-bg text-module">
            <CafeIcon name={icon} className="size-[24px]" />
          </span>
          <p className="max-w-[60ch] text-[0.9875rem] leading-relaxed text-muted-foreground">{vazio}</p>
        </div>
      )}
    </div>
  );
};
