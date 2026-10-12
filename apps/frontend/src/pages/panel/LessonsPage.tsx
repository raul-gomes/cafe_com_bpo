import React from 'react';
import { CafeIcon, type CafeIconName } from '../../brand/CafeIcon';

export type LessonSection = 'primeiros-passos' | 'bpo-primeiros-passos' | 'mentorias';

interface Lesson {
  title: string;
  summary: string;
}

interface SectionContent {
  title: string;
  lead: string;
  icon: CafeIconName;
  lessons?: Lesson[];
  emptyText?: string;
}

/** Copy of each section (shown in pt-BR). Videos are added as they are published. */
const CONTENT: Record<LessonSection, SectionContent> = {
  'primeiros-passos': {
    title: 'Primeiros passos',
    lead: 'Aulas curtas para tirar a ferramenta da caixa: do primeiro cliente à primeira rotina rodando.',
    icon: 'direcao',
    lessons: [
      { title: 'Conhecendo o painel e os módulos', summary: 'Onde fica cada coisa e como trocar de módulo sem se perder.' },
      { title: 'Cadastrando o primeiro cliente', summary: 'A ficha do cliente e o que vale registrar desde o início.' },
      { title: 'Montando rotinas e tempos', summary: 'Atividades com tempo estimado para o painel mostrar o seu dia.' },
      { title: 'Precificando com a calculadora', summary: 'Custo, tempo e margem para chegar ao preço justo.' },
    ],
  },
  'bpo-primeiros-passos': {
    title: 'BPO: primeiros passos',
    lead: 'Para quem está começando no BPO financeiro: a base da operação, do jeito que só quem opera ensina.',
    icon: 'aula',
    lessons: [
      { title: 'Aula de abertura', summary: 'Com Ghuto César. Em produção — entra aqui assim que estiver pronta.' },
    ],
  },
  mentorias: {
    title: 'Mentorias',
    lead: 'Aulas de mentoria dadas pelos próprios membros da comunidade.',
    icon: 'pessoas',
    emptyText: 'Este espaço está sendo preparado com calma. Em breve, membros da comunidade vão compartilhar aqui o que aprenderam operando.',
  },
};

/**
 * Aulas module: first steps in the tool, BPO for beginners and mentoring
 * (content in production).
 *
 * @param props.section Which section to show.
 * @returns The page.
 */
export const LessonsPage: React.FC<{ section: LessonSection }> = ({ section }) => {
  const { title, lead, icon, lessons, emptyText } = CONTENT[section];

  return (
    <div className="mx-auto max-w-[1080px]">
      <header className="mb-[28px]">
        <p className="text-xs font-bold uppercase tracking-[0.11em] text-module">Aulas</p>
        <h1 className="mt-[6px] font-editorial text-[2.25rem] font-medium leading-tight tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        <p className="mt-[8px] max-w-[60ch] text-[0.9875rem] text-muted-foreground">{lead}</p>
      </header>

      {lessons ? (
        <div className="grid gap-[20px] sm:grid-cols-2">
          {lessons.map((lesson, index) => (
            <article key={lesson.title} className="overflow-hidden rounded-lg border border-border bg-card">
              {/* Video frame: the lesson goes here once it is published. */}
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
                <h2 className="text-[1.0625rem] font-bold text-foreground">{lesson.title}</h2>
                <p className="mt-[6px] text-sm leading-relaxed text-muted-foreground">{lesson.summary}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex items-start gap-[16px] rounded-lg border border-dashed border-input bg-card p-[24px]">
          <span className="grid size-[48px] shrink-0 place-items-center rounded-lg bg-module-bg text-module">
            <CafeIcon name={icon} className="size-[24px]" />
          </span>
          <p className="max-w-[60ch] text-[0.9875rem] leading-relaxed text-muted-foreground">{emptyText}</p>
        </div>
      )}
    </div>
  );
};
