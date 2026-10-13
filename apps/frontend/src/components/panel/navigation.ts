import type { CafeIconName } from '../../brand/CafeIcon';

/** V4 kit module that gives each area its orientation color (data-cafe-module). */
export type CafeModule = 'gestao' | 'captacao' | 'tarefas' | 'comunidade' | 'negocios' | 'notas' | 'aulas';

export interface NavItem {
  path: string;
  icon: CafeIconName;
  label: string;
  /** Other routes that count as "inside" this item (detail, edit...). */
  matches?: string[];
  /** Write gate module when it differs from the section's (e.g. "pagamentos" inside Gestão). */
  gate?: string;
}

export interface NavSection {
  id: string;
  label: string;
  module: CafeModule;
  /** Icon of the module tab at the top of the menu. */
  icon: CafeIconName;
  /** Short line telling "you are in this environment" (kept for future use). */
  tagline: string;
  adminOnly?: boolean;
  items: NavItem[];
}

/** Home sits outside the modules: it is where the day starts. */
export const HOME_ITEM: NavItem = { path: '/painel', icon: 'inicio', label: 'Início' };

/**
 * Work modules. The menu shows one module at a time: whoever is in Captar
 * sees only Captar, with Captar's color around. Section ids match the write
 * gate module names of `GET /access` (`captar`, `gestao`...).
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'operacional',
    label: 'Operacional',
    module: 'tarefas',
    icon: 'rotina',
    tagline: 'Rotinas e entregas dos clientes',
    items: [
      { path: '/painel/tarefas', icon: 'processo', label: 'Gestor de Tarefas' },
      { path: '/painel/templates-atividades', icon: 'rotina', label: 'Rotinas' },
      { path: '/painel/empresas', icon: 'pasta', label: 'Clientes' },
    ],
  },
  {
    id: 'captar',
    label: 'Captar',
    module: 'captacao',
    icon: 'coador',
    tagline: 'Do primeiro contato ao contrato',
    items: [
      { path: '/painel/prospectos', icon: 'direcao', label: 'Prospectos' },
      {
        path: '/painel/orcamentos',
        icon: 'proposta',
        label: 'Orçamentos',
        matches: ['/painel/orcamento/', '/painel/novo-orcamento', '/painel/editar-orcamento'],
      },
      { path: '/painel/contratos', icon: 'contrato', label: 'Contratos', matches: ['/painel/contrato/'] },
      { path: '/painel/governanca', icon: 'grafico', label: 'Governança' },
    ],
  },
  {
    id: 'comunidade',
    label: 'Comunidade',
    module: 'comunidade',
    icon: 'xicara',
    tagline: 'Conversa, projetos e troca',
    items: [
      {
        path: '/painel/forum',
        icon: 'conversa-cafe',
        label: 'Fórum',
        matches: ['/painel/membros/', '/painel/conversas/', '/painel/grupos/'],
      },
      { path: '/painel/galeria', icon: 'arquivo', label: 'Galeria de Arquivos' },
    ],
  },
  {
    id: 'gestao',
    label: 'Gestão',
    module: 'gestao',
    icon: 'negocios',
    tagline: 'Equipe, contatos e o escritório',
    items: [
      { path: '/painel/projetos', icon: 'negocios', label: 'Projetos' },
      { path: '/painel/gestao-equipes', icon: 'pessoas', label: 'Gestão de equipes' },
      { path: '/painel/contatos', icon: 'mensagem', label: 'Contatos' },
      { path: '/painel/pagamentos', icon: 'pagamentos', label: 'Pagamentos', gate: 'pagamentos' },
      { path: '/painel/configuracoes', icon: 'ajustes', label: 'Configurações' },
    ],
  },
  {
    id: 'aulas',
    label: 'Aulas',
    module: 'aulas',
    icon: 'aula',
    tagline: 'Aprender a usar e aprender o BPO',
    items: [
      { path: '/painel/aulas/primeiros-passos', icon: 'direcao', label: 'Primeiros passos' },
      { path: '/painel/aulas/bpo-primeiros-passos', icon: 'aula', label: 'BPO: primeiros passos' },
      { path: '/painel/aulas/mentorias', icon: 'pessoas', label: 'Mentorias' },
    ],
  },
  // Placeholder modules (under construction) to see the tabs wrapping.
  {
    id: 'notas-fiscais',
    label: 'Notas Fiscais',
    module: 'notas',
    icon: 'nota',
    tagline: 'Emissão e acompanhamento de NF',
    items: [
      { path: '/painel/notas-fiscais', icon: 'nota', label: 'Notas emitidas' },
      { path: '/painel/notas-fiscais/emitir', icon: 'adicionar', label: 'Emitir nota' },
    ],
  },
  {
    id: 'certificados',
    label: 'Certificados Digitais',
    module: 'negocios',
    icon: 'seguranca',
    tagline: 'Validade e renovação dos certificados',
    items: [
      { path: '/painel/certificados', icon: 'seguranca', label: 'Certificados' },
      { path: '/painel/certificados/vencimentos', icon: 'tempo', label: 'Vencimentos' },
    ],
  },
  {
    id: 'config',
    label: 'Admin',
    module: 'gestao',
    icon: 'ajustes',
    tagline: 'Ferramentas de administração',
    adminOnly: true,
    items: [
      { path: '/painel/admin', icon: 'painel', label: 'Visão geral' },
      { path: '/painel/admin/mensagens', icon: 'mensagem', label: 'Mensagens' },
      { path: '/painel/admin/aulas', icon: 'aula', label: 'Aulas' },
      { path: '/painel/admin/site', icon: 'encontro', label: 'Site e encontros' },
      { path: '/painel/admin/usuarios', icon: 'pessoas', label: 'Usuários e cortesias' },
      { path: '/painel/inscricoes-beta', icon: 'relatorio', label: 'Inscrições Beta' },
      { path: '/painel/planos', icon: 'carteira', label: 'Planos' },
    ],
  },
];

/**
 * Whether a menu item matches the current route.
 *
 * @param item Menu item.
 * @param pathname Current path.
 * @returns `true` when the route is the item or one of its sub-routes.
 */
export function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.path === HOME_ITEM.path) return pathname === '/painel' || pathname === '/painel/';
  if (pathname.startsWith(item.path)) return true;
  return (item.matches ?? []).some(prefix => pathname.startsWith(prefix));
}

/**
 * Active item of a list: the most specific path among the matching ones.
 *
 * @param items Menu items of a section.
 * @param pathname Current path.
 * @returns The path of the active item, or `null`.
 */
export function activeItemPath(items: NavItem[], pathname: string): string | null {
  const matching = items.filter(item => isItemActive(item, pathname));
  if (matching.length === 0) return null;
  return matching.reduce((best, item) => (item.path.length > best.path.length ? item : best)).path;
}

/**
 * Section (and therefore module color) of the current route.
 *
 * @param pathname Current path.
 * @param sections Sections to search.
 * @returns The section, or `null` on Home and on the profile.
 */
export function sectionForPath(pathname: string, sections: NavSection[] = NAV_SECTIONS): NavSection | null {
  return sections.find(section => section.items.some(item => isItemActive(item, pathname))) ?? null;
}
