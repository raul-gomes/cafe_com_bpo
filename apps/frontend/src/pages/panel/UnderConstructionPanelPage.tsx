import React from 'react';
import { Link } from 'react-router-dom';
import { CafeIcon, type CafeIconName } from '../../brand/CafeIcon';

export type ConstructionArea = 'notas-fiscais' | 'certificados' | 'equipes';

interface AreaContent {
  title: string;
  icon: CafeIconName;
  /** What the module will do, in one sentence. */
  promise: string;
  /** How to do the job today with what already works. */
  today: string;
  action: { label: string; to: string };
}

/**
 * Copy of each unfinished module (AUD-040, owner decision 2026-10-12): what it
 * will be and a working path for today, instead of one generic message.
 */
const AREAS: Record<ConstructionArea, AreaContent> = {
  'notas-fiscais': {
    title: 'Notas Fiscais',
    icon: 'nota',
    promise: 'Emissão e acompanhamento das notas fiscais dos seus clientes, ligados às tarefas e às rotinas de cada empresa.',
    today: 'Enquanto isso, coloque a emissão como atividade na rotina mensal do cliente: ela vira card no quadro, com prazo e responsável.',
    action: { label: 'Montar a rotina de emissão', to: '/painel/templates-atividades' },
  },
  certificados: {
    title: 'Certificados Digitais',
    icon: 'seguranca',
    promise: 'Controle dos certificados digitais dos clientes, com aviso antes de cada vencimento.',
    today: 'Enquanto isso, crie uma rotina anual (ou de uma vez só) com a data de vencimento do certificado: o card aparece no quadro antes do prazo.',
    action: { label: 'Criar a rotina de vencimento', to: '/painel/templates-atividades' },
  },
  equipes: {
    title: 'Gestão de equipes',
    icon: 'pessoas',
    promise: 'Uma visão da equipe inteira: quem atende cada empresa, a carga de cada pessoa e as rotinas liberadas.',
    today: 'Enquanto isso, convide colaboradores e libere rotinas pela ficha de cada empresa, em Clientes.',
    action: { label: 'Ir para Clientes', to: '/painel/empresas' },
  },
};

/**
 * Panel page of a module that is not ready yet.
 *
 * @param props.area Which module.
 * @returns The page.
 */
export const UnderConstructionPanelPage: React.FC<{ area: ConstructionArea }> = ({ area }) => {
  const { title, icon, promise, today, action } = AREAS[area];
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[620px] flex-col justify-center">
      <span className="grid size-[52px] place-items-center rounded-lg bg-module-bg text-module">
        <CafeIcon name={icon} className="size-[26px]" />
      </span>
      <p className="mt-[18px] text-xs font-bold uppercase tracking-[0.11em] text-module">Em construção</p>
      <h1 className="mt-[6px] font-editorial text-[2.25rem] font-medium leading-tight tracking-[-0.02em] text-foreground">
        {title}
      </h1>
      <p className="mt-[10px] text-[0.9875rem] leading-relaxed text-foreground">{promise}</p>
      <p className="mt-[14px] text-[0.9375rem] leading-relaxed text-muted-foreground">{today}</p>
      <Link to={action.to} className="cafe-button cafe-button-secondary mt-[20px] self-start no-underline">
        {action.label}
      </Link>
    </div>
  );
};
