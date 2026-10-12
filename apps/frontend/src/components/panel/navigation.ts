import type { CafeIconName } from '../../brand/CafeIcon';

/** Módulo do kit V4 que dá a cor de orientação de cada área (data-cafe-module). */
export type CafeModule = 'gestao' | 'captacao' | 'tarefas' | 'comunidade' | 'negocios' | 'notas' | 'aulas';

export interface NavItem {
  path: string;
  icon: CafeIconName;
  label: string;
  /** Outras rotas que contam como "dentro" deste item (detalhe, edição...). */
  matches?: string[];
  /** Módulo do write gate quando difere do da seção (ex.: "pagamentos" dentro de Gestão). */
  gate?: string;
}

export interface NavSection {
  id: string;
  label: string;
  module: CafeModule;
  /** Ícone da aba do módulo no topo do menu. */
  icon: CafeIconName;
  /** Frase curta que orienta "você está neste ambiente". */
  tagline: string;
  adminOnly?: boolean;
  items: NavItem[];
}


/** Início fica fora dos módulos: é o ponto de partida do dia. */
export const HOME_ITEM: NavItem = { path: '/painel', icon: 'inicio', label: 'Início' };

/**
 * Módulos de trabalho. O menu mostra um módulo por vez: quem está em Captar
 * vê só Captar, com a cor de Captar em volta.
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
  // Módulos de exemplo (em construção) para ver as abas se reorganizando.
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
      { path: '/painel/design-system', icon: 'nota', label: 'Design System' },
      { path: '/painel/planos', icon: 'carteira', label: 'Planos' },
    ],
  },
];

export function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.path === HOME_ITEM.path) return pathname === '/painel' || pathname === '/painel/';
  if (pathname.startsWith(item.path)) return true;
  return (item.matches ?? []).some(prefix => pathname.startsWith(prefix));
}

/** Item ativo de uma lista: o de caminho mais específico entre os que casam. */
export function activeItemPath(items: NavItem[], pathname: string): string | null {
  const matching = items.filter(item => isItemActive(item, pathname));
  if (matching.length === 0) return null;
  return matching.reduce((best, item) => (item.path.length > best.path.length ? item : best)).path;
}

/** Seção (e portanto módulo/atmosfera) da rota atual; null no Início e no perfil. */
export function sectionForPath(pathname: string, sections: NavSection[] = NAV_SECTIONS): NavSection | null {
  return sections.find(section => section.items.some(item => isItemActive(item, pathname))) ?? null;
}
