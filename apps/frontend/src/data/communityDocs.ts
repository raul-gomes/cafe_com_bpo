export interface CommunityDoc {
  id: string;
  fileName: string;
  path: string;
  title: string;
  description: string;
  file_size: number;
}

export const communityDocs: CommunityDoc[] = [
  {
    id: 'busineplan-bpo',
    fileName: 'Business Plan BPO Financeiro - Template.xlsx',
    path: '/docs/comunidade/business-plan-bpo-template.xlsx',
    title: 'Business Plan BPO Financeiro (Template)',
    description:
      'Modelo de plano de negócios para operações de BPO financeiro.',
    file_size: 447246,
  },
  {
    id: 'cfp-vol1',
    fileName: 'CFP Vol I - Planejamento Financeiro.pdf',
    path: '/docs/comunidade/cfp-vol1-planejamento-financeiro.pdf',
    title: 'CFP Vol I — Planejamento Financeiro',
    description: 'Volume I da série de planejamento financeiro do CFP.',
    file_size: 2141477,
  },
  {
    id: 'contrato-lgpd',
    fileName: 'Contrato de Prestação de Serviços + LGPD.docx',
    path: '/docs/comunidade/contrato-prestacao-servicos-lgpd.docx',
    title: 'Contrato de Prestação de Serviços + LGPD',
    description:
      'Modelo de contrato de prestação de serviços com cláusulas de LGPD.',
    file_size: 3521767,
  },
  {
    id: 'livro-orcamento',
    fileName: 'Livro Orçamento.pdf',
    path: '/docs/comunidade/livro-orcamento.pdf',
    title: 'Livro Orçamento',
    description: 'Guia completo de elaboração e controle do orçamento.',
    file_size: 4051533,
  },
  {
    id: 'orcamento-pessoal',
    fileName: 'Orçamento Pessoal Inteligente 2021-2025.xlsm',
    path: '/docs/comunidade/orcamento-pessoal-inteligente.xlsm',
    title: 'Orçamento Pessoal Inteligente 2021-2025',
    description:
      'Planilha de orçamento pessoal inteligente com projeções até 2025.',
    file_size: 2218838,
  },
  {
    id: 'precificacao-servicos',
    fileName: 'Precificação de Serviços (Em Branco).xlsx',
    path: '/docs/comunidade/precificacao-servicos-em-branco.xlsx',
    title: 'Precificação de Serviços (Em Branco)',
    description: 'Planilha de precificação de serviços financeiros.',
    file_size: 57946,
  },
  {
    id: 'proposta-comercial',
    fileName: 'Proposta Comercial.docx',
    path: '/docs/comunidade/proposta-comercial.docx',
    title: 'Proposta Comercial',
    description: 'Modelo de proposta comercial para novos clientes.',
    file_size: 538326,
  },
];