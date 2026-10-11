import type { CafeIconName } from '../../brand/CafeIcon';

/** Módulo do kit V4 que dá a cor de orientação de cada área (data-cafe-module). */
export type CafeModule = 'gestao' | 'captacao' | 'tarefas' | 'comunidade' | 'negocios' | 'notas';

export interface NavItem {
  path: string;
  icon: CafeIconName;
  label: string;
  /** Outras rotas que contam como "dentro" deste item (detalhe, edição...). */
  matches?: string[];
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
    icon: 'direcao',
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
    icon: 'painel',
    tagline: 'Equipe, contatos e o escritório',
    items: [
      { path: '/painel/projetos', icon: 'negocios', label: 'Projetos' },
      { path: '/painel/gestao-equipes', icon: 'pessoas', label: 'Gestão de equipes' },
      { path: '/painel/contatos', icon: 'mensagem', label: 'Contatos' },
      { path: '/painel/pagamentos', icon: 'pagamentos', label: 'Pagamentos' },
      { path: '/painel/configuracoes', icon: 'ajustes', label: 'Configurações' },
    ],
  },
  {
    id: 'config',
    label: 'Admin',
    module: 'notas',
    icon: 'ajustes',
    tagline: 'Ferramentas de administração',
    adminOnly: true,
    items: [{ path: '/painel/design-system', icon: 'nota', label: 'Design System' }],
  },
];

export function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.path === HOME_ITEM.path) return pathname === '/painel' || pathname === '/painel/';
  if (pathname.startsWith(item.path)) return true;
  return (item.matches ?? []).some(prefix => pathname.startsWith(prefix));
}

/** Seção (e portanto módulo/atmosfera) da rota atual; null no Início e no perfil. */
export function sectionForPath(pathname: string, sections: NavSection[] = NAV_SECTIONS): NavSection | null {
  return sections.find(section => section.items.some(item => isItemActive(item, pathname))) ?? null;
}
