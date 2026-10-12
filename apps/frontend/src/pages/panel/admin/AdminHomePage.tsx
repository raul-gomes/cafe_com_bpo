import React from 'react';
import { Link } from 'react-router-dom';
import { CafeIcon, type CafeIconName } from '../../../brand/CafeIcon';

interface AdminTool {
  path: string;
  icon: CafeIconName;
  title: string;
  description: string;
}

/** What an administrator does here, in the order of a normal week. */
const TOOLS: AdminTool[] = [
  {
    path: '/painel/admin/mensagens',
    icon: 'mensagem',
    title: 'Mensagens',
    description: 'Avisos no sininho de todos (ou só de quem assina) e o post-it da tela inicial.',
  },
  {
    path: '/painel/admin/aulas',
    icon: 'aula',
    title: 'Aulas',
    description: 'Vídeos do YouTube nas trilhas do módulo Aulas: publicar, ordenar, guardar rascunho.',
  },
  {
    path: '/painel/admin/site',
    icon: 'encontro',
    title: 'Site e encontros',
    description: 'Recado da janela de login, link do Meet do próximo café e quem confirmou presença.',
  },
  {
    path: '/painel/admin/usuarios',
    icon: 'pessoas',
    title: 'Usuários e cortesias',
    description: 'Quem usa o Café, em que plano está, e acesso completo de cortesia por um período.',
  },
  {
    path: '/painel/inscricoes-beta',
    icon: 'relatorio',
    title: 'Inscrições Beta',
    description: 'Respostas do formulário do site, com download para Excel.',
  },
  {
    path: '/painel/planos',
    icon: 'carteira',
    title: 'Planos',
    description: 'Preço e descrição da assinatura.',
  },
];

/**
 * Admin › Visão geral: the compass of the team (why we do it) and the tools.
 *
 * @returns The page.
 */
export const AdminHomePage: React.FC = () => (
  <div className="mx-auto max-w-[1080px]">
    <p className="text-xs font-bold uppercase tracking-[0.11em] text-module">Admin</p>

    {/* The team's compass: depth of love over breadth of reach. */}
    <figure className="admin-compass">
      <CafeIcon name="coracao" className="admin-compass-icon" />
      <blockquote>Melhor ter 100 pessoas que amam a ferramenta do Café do que 1 mil que gostam.</blockquote>
      <figcaption>Cada decisão daqui passa por esta pergunta: isso faz alguém amar o Café?</figcaption>
    </figure>

    <div className="grid gap-[16px] sm:grid-cols-2 lg:grid-cols-3">
      {TOOLS.map(tool => (
        <Link key={tool.path} to={tool.path} className="cafe-card cafe-card-module admin-tool no-underline">
          <CafeIcon name={tool.icon} className="size-[24px] text-module" />
          <h2 className="cafe-card-heading mt-[12px] text-foreground">{tool.title}</h2>
          <p className="cafe-card-subtitle mt-[4px]">{tool.description}</p>
        </Link>
      ))}
    </div>
  </div>
);
