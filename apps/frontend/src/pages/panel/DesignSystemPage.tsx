import React, { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectGroup,
  SelectValue,
  SelectItem,
  SelectLabel,
} from '../../components/ui/select'
import { Checkbox } from '../../components/ui/checkbox'
import { Carousel } from '../../components/dashboard/Carousel'
import { ContactsTable } from '../../components/contacts/ContactsTable'
import { ContactFormDialog } from '../../components/contacts/ContactFormDialog'
import { SearchInput } from '../../components/ui/SearchInput'
import type { ContactResponse } from '../../api/contacts'
import { Switch } from '../../components/ui/switch'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from '../../components/ui/input-group'
import { MaskedInput } from '../../components/ui/MaskedInput'
import { Badge } from '../../components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '../../components/ui/table'
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
} from '../../components/ui/avatar'
import { Skeleton } from '../../components/ui/skeleton'
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/alert'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '../../components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '../../components/ui/dropdown-menu'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from '../../components/ui/popover'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from '../../components/ui/sheet'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator as CmdSeparator,
} from '../../components/ui/command'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../../components/ui/tabs'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '../../components/ui/pagination'
import { Separator } from '../../components/ui/separator'
import { SkillInput } from '../../components/ui/SkillInput'
import { ProjectCard } from '../../components/network/ProjectCard'
import { ProjectApplicationsPanel } from '../../components/projetos/ProjectApplicationsPanel'
import { ProjetosCard } from '../../components/projetos/ProjetosCard'
import { ProjetoIndicadores } from '../../components/projetos/ProjetoIndicadores'
import { ProjetoFormDialog } from '../../components/projetos/ProjetoFormDialog'
import { ProjetoEquipePanel } from '../../components/projetos/ProjetoEquipePanel'
import { ProjetoTopicoPanel } from '../../components/projetos/ProjetoTopicoPanel'
import { GroupPostCard } from '../../components/network/GroupPostCard'
import { ThreadReplies } from '../../components/network/ThreadReplies'
import { ContractSectionsEditor } from '../../components/contracts/ContractSectionsEditor'
import { ContractDocument } from '../../components/contracts/ContractDocument'
import { DealCard } from '../../components/governanca/DealCard'
import { DealTimeline } from '../../components/governanca/DealTimeline'
import { MemberProfileView } from '../../components/network/MemberProfileView'
import { MemberLink } from '../../components/network/MemberLink'
import { NewIndicator } from '../../components/network/NewIndicator'
import type { Deal } from '../../api/governanca'

import './DesignSystemPage.css'

// ─── Navigation sections ──────────────────────────────────────────────
const sections = [
  { id: 'form', icon: '⌨️', label: 'Formulários' },
  { id: 'display', icon: '🖼️', label: 'Exibição' },
  { id: 'feedback', icon: '💬', label: 'Feedback' },
  { id: 'overlay', icon: '📦', label: 'Sobreposições' },
  { id: 'contratos', icon: '📄', label: 'Contratos' },
  { id: 'contatos', icon: '📇', label: 'Contatos' },
  { id: 'governanca', icon: '📈', label: 'Governança' },
  { id: 'navigation', icon: '🧭', label: 'Navegação' },
  { id: 'comunidade', icon: '👥', label: 'Comunidade' },
  { id: 'modes', icon: '🎨', label: 'Modos' },
]

// ─── Section wrapper ──────────────────────────────────────────────────
const Section = ({
  id,
  icon,
  title,
  children,
}: {
  id: string
  icon: string
  title: string
  children: React.ReactNode
}) => (
  <section id={id} className="ds-section">
    <div className="ds-section-header">
      <span className="ds-section-icon">{icon}</span>
      <h2>{title}</h2>
    </div>
    <div className="ds-section-grid">{children}</div>
  </section>
)

// ─── Component preview card ───────────────────────────────────────────
const ComponentCard = ({
  name,
  description,
  children,
  howToUse,
}: {
  name: string
  description: string
  children: React.ReactNode
  howToUse: string
}) => (
  <div className="ds-card">
    <div className="ds-card-header">
      <span className="ds-card-name">{name}</span>
      <p className="ds-card-desc">{description}</p>
    </div>
    <div className="ds-card-body">{children}</div>
    <div className="ds-card-footer">
      <details>
        <summary>Como implementar</summary>
        <pre className="ds-code-block">{howToUse}</pre>
      </details>
    </div>
  </div>
)

// ─── Demo data: Perfil do membro ───────────────────────────────────────
const DEMO_MEMBER_PROFILE = {
  id: 'user-demo',
  name: 'Marina Souza',
  avatar_url: null,
  biografia:
    'BPO financeiro para clinicas medicas ha 6 anos. Specialist em fechamento mensal e rotinas de contas a pagar.',
  company_name: 'Marina Souza Contabilidade',
  company_segment: 'Contabilidade',
  company_city: 'Belo Horizonte',
  company_state: 'MG',
  created_at: '2026-03-10T12:00:00Z',
  skills: [
    { id: 's1', name: 'Contabilidade', slug: 'contabilidade', is_active: true },
    { id: 's2', name: 'BPO Financeiro', slug: 'bpo-financeiro', is_active: true },
    { id: 's3', name: 'Rotinas Fiscais', slug: 'rotinas-fiscais', is_active: true },
  ],
  comments_count: 2,
  is_owner: false,
  can_comment: true,
}

const DEMO_MEMBER_COMMENTS = [
  {
    id: 'c1',
    user_id: 'user-demo',
    author_id: 'user-2',
    author: { id: 'user-2', name: 'Bruno Lima', avatar_url: null },
    message:
      'Entreguei tres clientes para a Marina e o resultado do fechamento mensal foi excelente.',
    created_at: '2026-09-20T14:00:00Z',
    can_delete: false,
  },
  {
    id: 'c2',
    user_id: 'user-demo',
    author_id: 'user-3',
    author: { id: 'user-3', name: 'Ana Souza', avatar_url: null },
    message: 'Muito serio e pontual nos entregas.',
    created_at: '2026-09-21T09:00:00Z',
    can_delete: true,
  },
]

const CONTATOS_DEMO: ContactResponse[] = [
  {
    id: 'p-1',
    nome: 'Marina Reis',
    telefone: '11988771234',
    email: 'marina@alfa.com.br',
    empresa: 'Contabilidade Alfa',
    origem: 'cliente',
    tem_pessoa: true,
  },
  {
    id: 'p-2',
    nome: 'Nina Prospecto',
    telefone: '2132221111',
    email: 'nina@aberto.com.br',
    empresa: 'Lead Aberto Ltda',
    origem: 'prospecto',
    tem_pessoa: true,
  },
  {
    id: 'c-2',
    nome: 'João Batista',
    telefone: '21998761122',
    email: 'joao@empresa.com.br',
    empresa: 'Empresa Beta',
    origem: 'livre',
    tem_pessoa: true,
  },
  {
    id: 'cl-3',
    nome: 'Pedro Alencar',
    telefone: null,
    email: null,
    empresa: 'Pedro Alencar ME',
    origem: 'cliente',
    tem_pessoa: false,
  },
]

const MemberProfileDemo = () => (
  <MemberProfileView
    profile={DEMO_MEMBER_PROFILE}
    comments={DEMO_MEMBER_COMMENTS}
    currentUserId="user-2"
  />
)

// ─── Demo data: Governança ──────────────────────────────────────────────
const DEMO_GOVERNANCA: Deal[] = [
  {
    id: 'deal-conquistado',
    name: 'TechFinance BPOS',
    status: 'conquistado',
    reference_date: '2026-09-15T10:00:00',
    segment: 'Gestão financeira',
    cnpj: '39123456000180',
    city: 'São Paulo',
    state: 'SP',
    email: 'contato@techfinance.example',
    phone: '1134567890',
    color: '#10b981',
    representante_nome: 'Mariana Costa',
    representante_cargo: 'CFO',
    proposal: { id: 'p-1', final_price: 8990, created_at: '2026-09-02T09:00:00' },
    contract: { id: 'c-1', number: 12, status: 'ativo', finalized_at: '2026-09-15T10:00:00', created_at: '2026-09-15T09:00:00' },
    timeline: [
      { type: 'created', label: 'Prospecção iniciada', date: '2026-08-20T09:00:00' },
      { type: 'sent', label: 'Proposta enviada', date: '2026-09-02T09:00:00' },
      { type: 'approved', label: 'Proposta aprovada / Contrato assinado', date: '2026-09-15T10:00:00' },
    ],
  },
  {
    id: 'deal-negociacao',
    name: 'Contabilidade Souza',
    status: 'em_negociacao',
    reference_date: '2026-09-18T14:00:00',
    segment: 'Contabilidade',
    cnpj: '18222333000177',
    city: 'Belo Horizonte',
    state: 'MG',
    email: 'comercial@souza.example',
    color: '#4287f5',
    proposal: { id: 'p-2', final_price: 5400, created_at: '2026-09-18T14:00:00' },
    timeline: [
      { type: 'created', label: 'Prospecção iniciada', date: '2026-09-05T10:00:00' },
      { type: 'sent', label: 'Proposta enviada', date: '2026-09-18T14:00:00' },
      { type: 'pending', label: 'Aguardando aprovação', mock: true },
    ],
  },
  {
    id: 'deal-perdido',
    name: 'Café Exportadora',
    status: 'perdido',
    reference_date: '2026-09-10T11:30:00',
    segment: 'Agronegócio',
    cnpj: '27444555000100',
    city: 'Uberlândia',
    state: 'MG',
    email: 'propostas@cafeexport.example',
    color: '#ef4444',
    proposal: { id: 'p-3', final_price: 12500, created_at: '2026-09-08T15:00:00' },
    timeline: [
      { type: 'created', label: 'Prospecção iniciada', date: '2026-08-27T09:00:00' },
      { type: 'sent', label: 'Proposta enviada', date: '2026-09-08T15:00:00' },
      { type: 'rejected', label: 'Proposta recusada', date: '2026-09-10T11:30:00' },
    ],
  },
]

// ═══════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════
export default function DesignSystemPage() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [contatoDialogOpen, setContatoDialogOpen] = useState(false)
  const [projetoDialogOpen, setProjetoDialogOpen] = useState(false)
  const [searchDemo, setSearchDemo] = useState('contabilidade')

  // Controlled state for Checkbox examples
  const [chkTerms, setChkTerms] = useState(true)
  const [chkOption, setChkOption] = useState(false)

  // Controlled state for Switch examples
  const [swNotify, setSwNotify] = useState(true)
  const [swDark, setSwDark] = useState(false)
  const [swSound, setSwSound] = useState(false)

  return (
    <div className="ds-page">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <header className="ds-header">
        <h1>Design System</h1>
        <p>
          Catálogo visual de todos os componentes do Café com BPO.
          Cada card mostra exemplos de uso e o trecho de código para implementar.
        </p>
        <nav className="ds-nav">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.icon} {s.label}
            </a>
          ))}
        </nav>
      </header>

      {/* ═══════════ 1. FORMULÁRIOS ═══════════ */}
      <Section id="form" icon="⌨️" title="Formulários">
        {/* ── Button ── */}
        <ComponentCard
          name="Button"
          description="6 variantes · 5 tamanhos · suporta ícones e disabled"
          howToUse={`import { Button } from '../../components/ui/button'

<Button>Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="destructive">Excluir</Button>
<Button variant="secondary">Secundário</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button size="sm">Pequeno</Button>
<Button size="lg">Grande</Button>
<Button disabled>Desabilitado</Button>`}
        >
          <div className="ds-row">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
          <Separator className="my-1 opacity-30" />
          <div className="ds-row">
            <Button size="xs">XS</Button>
            <Button size="sm">SM</Button>
            <Button size="default">MD</Button>
            <Button size="lg">LG</Button>
            <Button disabled>Disabled</Button>
          </div>
        </ComponentCard>

        {/* ── Input ── */}
        <ComponentCard
          name="Input"
          description="Texto, email, password, number · suporta disabled e aria-invalid"
          howToUse={`import { Input } from '../../components/ui/input'

<Input placeholder="Digite algo..." />
<Input type="email" defaultValue="user@email.com" />
<Input disabled placeholder="Desabilitado" />
<Input placeholder="Com erro" aria-invalid />`}
        >
          <div className="ds-col">
            <Input placeholder="Placeholder padrão" />
            <Input type="email" defaultValue="usuario@exemplo.com" />
            <Input placeholder="Campo com erro" aria-invalid />
            <Input disabled value="Campo desabilitado" />
          </div>
        </ComponentCard>

        {/* ── Textarea ── */}
        <ComponentCard
          name="Textarea"
          description="Área multilinha para descrições e conteúdo longo"
          howToUse={`import { Textarea } from '../../components/ui/textarea'

<Textarea placeholder="Descreva..." rows={4} />
<Textarea disabled value="Desabilitado" rows={3} />`}
        >
          <div className="ds-col">
            <Textarea placeholder="Digite uma descrição longa..." rows={3} />
            <Textarea disabled value="Área desabilitada" rows={2} />
          </div>
        </ComponentCard>

        {/* ── Select ── */}
        <ComponentCard
          name="Select"
          description="Menu de seleção com grupos, labels e busca integrada"
          howToUse={`import {
  Select, SelectTrigger, SelectContent,
  SelectGroup, SelectValue, SelectItem, SelectLabel,
} from '../../components/ui/select'

<Select defaultValue="op1">
  <SelectTrigger>
    <SelectValue placeholder="Escolha..." />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Categoria</SelectLabel>
      <SelectItem value="op1">Opção 1</SelectItem>
      <SelectItem value="op2">Opção 2</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>`}
        >
          <div className="ds-col" style={{ maxWidth: 280 }}>
            <Select defaultValue="fiscal">
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Segmentos</SelectLabel>
                  <SelectItem value="fiscal">Fiscal</SelectItem>
                  <SelectItem value="contabil">Contábil</SelectItem>
                  <SelectItem value="pessoal">Pessoal</SelectItem>
                  <SelectItem value="juridico">Jurídico</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </ComponentCard>

        {/* ── Checkbox ── */}
        <ComponentCard
          name="Checkbox"
          description="Seleção múltipla · suporta checked, disabled e controlled"
          howToUse={`import { Checkbox } from '../../components/ui/checkbox'

<Checkbox defaultChecked />
<Checkbox onCheckedChange={(v) => console.log(v)} />
<Checkbox disabled />`}
        >
          <div className="ds-col">
            <label className="ds-label">
              <Checkbox id="chk-terms" checked={chkTerms} onCheckedChange={(v) => setChkTerms(v)} />
              Aceito os termos
            </label>
            <label className="ds-label">
              <Checkbox id="chk-option" checked={chkOption} onCheckedChange={(v) => setChkOption(v)} />
              Opção secundária
            </label>
            <label className="ds-label">
              <Checkbox id="chk-disabled" disabled />
              Desabilitado
            </label>
          </div>
        </ComponentCard>

        {/* ── Switch ── */}
        <ComponentCard
          name="Switch"
          description="Toggle liga/desliga · 2 tamanhos · ideal para configurações"
          howToUse={`import { Switch } from '../../components/ui/switch'

<Switch defaultChecked />
<Switch size="sm" />
<Switch onCheckedChange={(v) => setEnabled(v)} />`}
        >
          <div className="ds-col">
            <label className="ds-label">
              <Switch id="sw-notify" checked={swNotify} onCheckedChange={(v) => setSwNotify(v)} />
              Notificações
            </label>
            <label className="ds-label">
              <Switch id="sw-dark" checked={swDark} onCheckedChange={(v) => setSwDark(v)} />
              Modo escuro
            </label>
            <label className="ds-label">
              <Switch id="sw-sound" size="sm" checked={swSound} onCheckedChange={(v) => setSwSound(v)} />
              Som (sm)
            </label>
          </div>
        </ComponentCard>

        {/* ── InputGroup ── */}
        <ComponentCard
          name="InputGroup"
          description="Input com addons · R$, CNPJ/CPF/Telefone com máscara, textarea e botões"
          howToUse={`import {
  InputGroup, InputGroupAddon,
  InputGroupInput, InputGroupButton, InputGroupText,
} from '../../components/ui/input-group'

<InputGroup>
  <InputGroupAddon align="inline-start">R$</InputGroupAddon>
  <InputGroupInput placeholder="Valor" />
  <InputGroupButton>Aplicar</InputGroupButton>
</InputGroup>

<InputGroup>
  <InputGroupAddon align="inline-start">CNPJ</InputGroupAddon>
  <InputGroupInput placeholder="00.000.000/0001-00" />
</InputGroup>`}
        >
          <div className="ds-col">
            <InputGroup>
              <InputGroupAddon align="inline-start">R$</InputGroupAddon>
              <InputGroupInput placeholder="Valor" />
              <InputGroupButton>Aplicar</InputGroupButton>
            </InputGroup>
            <InputGroup>
              <InputGroupAddon align="inline-start">CNPJ</InputGroupAddon>
              <MaskedInput tipo="cnpj" />
            </InputGroup>
            <InputGroup>
              <InputGroupAddon align="inline-start">CPF</InputGroupAddon>
              <MaskedInput tipo="cpf" />
            </InputGroup>
<InputGroup>
              <InputGroupAddon align="inline-start">Telefone</InputGroupAddon>
              <MaskedInput tipo="phone" />
            </InputGroup>

            <InputGroup>
              <InputGroupText>Bio</InputGroupText>
              <InputGroupTextarea placeholder="Descreva seu perfil..." rows={2} />
            </InputGroup>
          </div>
        </ComponentCard>

        {/* ── SearchInput ── */}
        <ComponentCard
          name="SearchInput"
          description="Campo de busca padronizado do painel: lupa dentro do input + botão de limpar · é o filtro de busca de referência das listas"
          howToUse={`import { SearchInput } from '../../components/ui/SearchInput'

<SearchInput
  value={termo}
  onChange={setTermo}
  label="Buscar clientes"
  placeholder="Buscar por nome, empresa, telefone ou e-mail"
/>`}
        >
          <div className="ds-col">
            <SearchInput
              value={searchDemo}
              onChange={setSearchDemo}
              label="Buscar contatos (exemplo)"
              placeholder="Buscar por nome, empresa, telefone ou e-mail"
            />
            <SearchInput
              value=""
              onChange={() => {}}
              label="Buscar vazio (exemplo)"
              placeholder="Sem termo: sem botão de limpar"
            />
          </div>
        </ComponentCard>

        {/* ── SkillInput ── */}
        <ComponentCard
          name="SkillInput"
          description="Chips de habilidades com autocomplete do catálogo; Tab/Enter/vírgula adiciona, '+' cria nova"
          howToUse={`import { SkillInput } from '../../components/ui/SkillInput'

const [skills, setSkills] = useState<string[]>([])

<SkillInput
  value={skills}
  onChange={setSkills}
  placeholder="Digite uma habilidade e pressione Tab ou Enter"
/>`}
        >
          <div className="ds-col">
            <SkillInput
              value={['Análise de Dados']}
              onChange={() => undefined}
              placeholder="Digite uma habilidade e pressione Tab ou Enter"
            />
          </div>
        </ComponentCard>
      </Section>
      {/* ═══════════ 2. EXIBIÇÃO ═══════════ */}
      <Section id="display" icon="🖼️" title="Exibição de Dados">
        {/* ── Badge ── */}
        <ComponentCard
          name="Badge"
          description="6 variantes: default, secondary, outline, destructive, ghost, link"
          howToUse={`import { Badge } from '../../components/ui/badge'

<Badge>Novo</Badge>
<Badge variant="destructive">Erro</Badge>
<Badge variant="outline">Rascunho</Badge>
<Badge variant="secondary">Info</Badge>`}
        >
          <div className="ds-row">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Erro</Badge>
            <Badge variant="ghost">Ghost</Badge>
            <Badge variant="link">Link</Badge>
          </div>
        </ComponentCard>

        {/* ── ProjectCard ── */}
        <ComponentCard
          name="ProjectCard"
          description="Card do mural de projetos no fórum: título, autor, descrição resumida e skills · vitrine sem gestão — o dono recebe o atalho para Gestão › Projetos e o resto do perfil se candidata"
          howToUse={`import { ProjectCard } from '../../components/network/ProjectCard'

<ProjectCard project={project} />

// Sem currentUserId/onSave/onDelete: no fórum ninguém cria, edita nem
// exclui projeto. Criar/editar/avaliar/arquivar é de Gestão › Projetos.`}
        >
          <div className="ds-col">
            <ProjectCard
              project={{
                id: 'demo-1',
                owner_id: 'user-1',
                owner: { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
                title: 'Automação de fluxo fiscal',
                description:
                  'Projeto para automatizar o fluxo fiscal dos clientes do escritório.',
                status: 'open',
                team_size: 2,
                remote_type: 'remote',
                published_at: null,
                created_at: '2026-09-08T00:00:00Z',
                updated_at: '2026-09-08T00:00:00Z',
                skills: [
                  { id: 's1', name: 'Python', slug: 'python', is_active: true },
                  { id: 's2', name: 'Excel', slug: 'excel', is_active: true },
                ],
                group_id: 'demo-group-1',
                is_group_member: true,
                is_owner: false,
                application_count: 0,
                applications_closed: false,
              }}
            />
          </div>
        </ComponentCard>

        {/* ── ProjectApplicationsPanel ── */}
        <ComponentCard
          name="ProjectApplicationsPanel"
          description="Aba Propostas do detalhe do projeto: o dono aceita/recusa candidatos, abre/fecha novas propostas e salta para a conversa do aceito"
          howToUse={`import { ProjectApplicationsPanel } from '../../components/projetos/ProjectApplicationsPanel'

<ProjectApplicationsPanel
  project={project}
  onUpdated={(p) => setProjects(ps => ps.map(x => x.id === p.id ? p : x))}
/>`}
        >
          <div className="ds-col">
            <ProjectApplicationsPanel
              project={{
                id: 'demo-apps-1',
                owner_id: 'user-1',
                owner: { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
                title: 'Automação de fluxo fiscal',
                description: 'Projeto para automatizar o fluxo fiscal dos clientes.',
                status: 'open',
                team_size: 2,
                remote_type: 'remote',
                published_at: null,
                created_at: '2026-09-08T00:00:00Z',
                updated_at: '2026-09-08T00:00:00Z',
                skills: [],
                group_id: 'demo-group-1',
                is_group_member: true,
                is_owner: true,
                application_count: 1,
                applications_closed: false,
              }}
              onUpdated={() => undefined}
            />
          </div>
        </ComponentCard>

        {/* ── GroupPostCard ── */}
        <ComponentCard
          name="GroupPostCard"
          description="Post do tópico do projeto: autor, data e corpo preservando quebras de linha"
          howToUse={`import { GroupPostCard } from '../../components/network/GroupPostCard'

<GroupPostCard post={post} />`}
        >
          <div className="ds-col">
            <GroupPostCard
              post={{
                id: 'post-1',
                group_id: 'demo-group-1',
                author_id: 'user-1',
                author: { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
                body: 'Equipe, alinhemos o escopo do primeiro entregável do fluxo fiscal.',
                created_at: '2026-09-09T10:00:00Z',
              }}
            />
          </div>
        </ComponentCard>

        {/* ── ThreadReplies ── */}
        <ComponentCard
          name="ThreadReplies"
          description="Estrutura de fórum: envolve as respostas de um tópico com indentação e trilho lateral, deixando claro que fazem parte do tópico principal."
          howToUse={`import { ThreadReplies } from '../../components/network/ThreadReplies'

<Card>Tópico principal…</Card>
<ThreadReplies>
  <Card>Resposta 1…</Card>
  <Card>Resposta 2…</Card>
</ThreadReplies>`}
        >
          <div className="ds-col">
            <div className="ds-card" style={{ padding: '16px' }}>
              Tópico principal — sem indentação, no topo.
            </div>
            <ThreadReplies>
              <div className="ds-card" style={{ padding: '16px' }}>
                Resposta 1 — indentada, parte do tópico.
              </div>
              <div className="ds-card" style={{ padding: '16px' }}>
                Resposta 2 — indentada, parte do tópico.
              </div>
            </ThreadReplies>
          </div>
        </ComponentCard>

        {/* ── Table ── */}
        <ComponentCard
          name="Table"
          description="Tabela responsiva com header, body, caption e hover nas linhas"
          howToUse={`import {
  Table, TableHeader, TableBody,
  TableHead, TableRow, TableCell, TableCaption,
} from '../../components/ui/table'

<Table>
  <TableCaption>Legenda</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Nome</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>João</TableCell>
      <TableCell><Badge>Ativo</Badge></TableCell>
    </TableRow>
  </TableBody>
</Table>`}
        >
          <Table>
            <TableCaption>Clientes (exemplo)</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Tarefas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Tech Solutions</TableCell>
                <TableCell>Fiscal</TableCell>
                <TableCell><Badge>Ativo</Badge></TableCell>
                <TableCell className="text-right">12</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Consultoria ABC</TableCell>
                <TableCell>Contábil</TableCell>
                <TableCell><Badge variant="secondary">Pendente</Badge></TableCell>
                <TableCell className="text-right">5</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Grupo XYZ</TableCell>
                <TableCell>Pessoal</TableCell>
                <TableCell><Badge variant="outline">Inativo</Badge></TableCell>
                <TableCell className="text-right">0</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </ComponentCard>

        {/* ── Avatar ── */}
        <ComponentCard
          name="Avatar"
          description="Foto com fallback de iniciais · suporta badge de status e grupos"
          howToUse={`import {
  Avatar, AvatarImage, AvatarFallback,
  AvatarBadge, AvatarGroup, AvatarGroupCount,
} from '../../components/ui/avatar'

<Avatar>
  <AvatarImage src="/foto.jpg" alt="Nome" />
  <AvatarFallback>AB</AvatarFallback>
  <AvatarBadge />
</Avatar>

<AvatarGroup>
  <Avatar size="sm"><AvatarFallback>AB</AvatarFallback></Avatar>
  <AvatarGroupCount>+3</AvatarGroupCount>
</AvatarGroup>`}
        >
          <div className="ds-row">
            <Avatar>
              <AvatarImage src="" alt="" />
              <AvatarFallback>AB</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarImage src="" alt="" />
              <AvatarFallback>CD</AvatarFallback>
              <AvatarBadge />
            </Avatar>
            <Avatar size="lg">
              <AvatarImage src="" alt="" />
              <AvatarFallback>EF</AvatarFallback>
            </Avatar>
            <Avatar size="sm">
              <AvatarImage src="" alt="" />
              <AvatarFallback>GH</AvatarFallback>
            </Avatar>
            <AvatarGroup>
              <Avatar size="sm"><AvatarFallback>AB</AvatarFallback></Avatar>
              <Avatar size="sm"><AvatarFallback>CD</AvatarFallback></Avatar>
              <Avatar size="sm"><AvatarFallback>EF</AvatarFallback></Avatar>
              <AvatarGroupCount>+3</AvatarGroupCount>
            </AvatarGroup>
          </div>
        </ComponentCard>

        {/* ── Skeleton ── */}
        <ComponentCard
          name="Skeleton"
          description="Placeholder animado para loading · simule o layout enquanto dados carregam"
          howToUse={`import { Skeleton } from '../../components/ui/skeleton'

<Skeleton className="h-4 w-48" />
<Skeleton className="h-10 w-full rounded-md" />`}
        >
          <div className="ds-col" style={{ maxWidth: 280 }}>
            <div className="ds-row" style={{ alignItems: 'center' }}>
              <Skeleton className="size-10 rounded-full" />
              <div className="ds-col" style={{ gap: 6 }}>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        </ComponentCard>
      </Section>

      {/* ═══════════ 3. FEEDBACK ═══════════ */}
      <Section id="feedback" icon="💬" title="Feedback">
        {/* ── Alert ── */}
        <ComponentCard
          name="Alert"
          description="Mensagens contextuais: informação, erro, aviso · 2 variantes"
          howToUse={`import { Alert, AlertTitle, AlertDescription } from '../../components/ui/alert'

<Alert>
  <AlertTitle>Informação</AlertTitle>
  <AlertDescription>Mensagem aqui.</AlertDescription>
</Alert>

<Alert variant="destructive">
  <AlertTitle>Erro</AlertTitle>
  <AlertDescription>Algo deu errado.</AlertDescription>
</Alert>`}
        >
          <div className="ds-col">
            <Alert>
              <AlertTitle>Informação</AlertTitle>
              <AlertDescription>
                Seu perfil está 80% completo. Complete os dados.
              </AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertTitle>Erro ao salvar</AlertTitle>
              <AlertDescription>
                Verifique sua conexão e tente novamente.
              </AlertDescription>
            </Alert>
          </div>
        </ComponentCard>

        {/* ── Dialog ── */}
        <ComponentCard
          name="Dialog"
          description="Modal que bloqueia interação com o fundo · confirmações e formulários"
          howToUse={`import {
  Dialog, DialogTrigger, DialogContent,
  DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '../../components/ui/dialog'

<Dialog>
  <DialogTrigger render={<Button>Abrir</Button>} />
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirmar</DialogTitle>
      <DialogDescription>Deseja prosseguir?</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline">Cancelar</Button>
      <Button>Confirmar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`}
        >
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button>Abrir modal</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmação</DialogTitle>
                <DialogDescription>
                  Esta ação não poderá ser desfeita. Deseja continuar?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => setDialogOpen(false)}>Confirmar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </ComponentCard>

        {/* ── Tooltip ── */}
        <ComponentCard
          name="Tooltip"
          description="Dica de contexto ao passar o mouse · suporta posicionamento (top, right, etc)"
          howToUse={`import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '../../components/ui/tooltip'

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger render={<Button>Hover</Button>} />
    <TooltipContent side="top">Texto</TooltipContent>
  </Tooltip>
</TooltipProvider>`}
        >
          <TooltipProvider>
            <div className="ds-row">
              <Tooltip>
                <TooltipTrigger render={<Button variant="outline" size="sm">Hover me</Button>} />
                <TooltipContent>Dica útil aqui</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button size="icon-sm" aria-label="Ajuda">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                    </Button>
                  }
                />
                <TooltipContent side="right">Central de ajuda</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </ComponentCard>

        {/* ── Sonner ── */}
        <ComponentCard
          name="Sonner (Toast)"
          description="Notificações temporárias no canto · success(), error(), promise()"
          howToUse={`import { Toaster } from '../../components/ui/sonner'
import { toast } from 'sonner'

{/* Coloque <Toaster /> uma vez no layout */}
<Toaster />

toast.success('Salvo!')
toast.error('Erro!')
toast('Mensagem')
toast.promise(fetchData(), {
  loading: 'Carregando...',
  success: 'Pronto!',
  error: 'Falhou',
})`}
        >
          <div className="ds-row">
            <Button variant="outline" size="sm" onClick={() => toast.success('Ação concluída com sucesso!')}>
              toast.success()
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.error('Erro simulado ao processar.')}>
              toast.error()
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast('Notificação simples.')}>
              toast()
            </Button>
          </div>
          <p className="ds-note">
            O <code>{'<Toaster />'}</code> já está configurado no layout do painel.
          </p>
        </ComponentCard>
      </Section>

      {/* ═══════════ 4. SOBREPOSIÇÕES ═══════════ */}
      <Section id="overlay" icon="📦" title="Sobreposições">
        {/* ── DropdownMenu ── */}
        <ComponentCard
          name="DropdownMenu"
          description="Menu suspenso com itens, checkboxes, atalhos e variante destrutiva"
          howToUse={`import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuCheckboxItem, DropdownMenuShortcut,
} from '../../components/ui/dropdown-menu'

<DropdownMenu>
  <DropdownMenuTrigger render={<Button>Menu</Button>} />
  <DropdownMenuContent>
    <DropdownMenuItem>Perfil</DropdownMenuItem>
    <DropdownMenuItem variant="destructive">Excluir</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuCheckboxItem checked>
      Modo escuro
    </DropdownMenuCheckboxItem>
  </DropdownMenuContent>
</DropdownMenu>`}
        >
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline">Abrir menu</Button>} />
            <DropdownMenuContent className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel inset>Minha Conta</DropdownMenuLabel>
                <DropdownMenuItem inset>
                  Perfil
                  <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem inset>
                  Configurações
                  <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked inset>
                Modo escuro
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem inset variant="destructive">
                Sair da conta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ComponentCard>

        {/* ── Popover ── */}
        <ComponentCard
          name="Popover"
          description="Card flutuante contextual · filtros, detalhes, formulários rápidos"
          howToUse={`import {
  Popover, PopoverTrigger, PopoverContent,
  PopoverHeader, PopoverTitle, PopoverDescription,
} from '../../components/ui/popover'

<Popover>
  <PopoverTrigger render={<Button>Abrir</Button>} />
  <PopoverContent side="bottom">
    <PopoverHeader>
      <PopoverTitle>Título</PopoverTitle>
      <PopoverDescription>Conteúdo</PopoverDescription>
    </PopoverHeader>
  </PopoverContent>
</Popover>`}
        >
          <Popover>
            <PopoverTrigger render={<Button variant="outline">Abrir popover</Button>} />
            <PopoverContent className="w-72">
              <PopoverHeader>
                <PopoverTitle>Detalhes do Cliente</PopoverTitle>
                <PopoverDescription>
                  Última atividade: 2 dias atrás. Total de tarefas: 15.
                </PopoverDescription>
              </PopoverHeader>
              <div style={{ padding: '8px 0' }}>
                <Button size="sm" className="w-full">
                  Ver completo
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </ComponentCard>

        {/* ── Sheet ── */}
        <ComponentCard
          name="Sheet"
          description="Painel lateral deslizante · 4 posições: left, right, top, bottom"
          howToUse={`import {
  Sheet, SheetTrigger, SheetContent,
  SheetHeader, SheetFooter, SheetTitle, SheetDescription,
} from '../../components/ui/sheet'

<Sheet>
  <SheetTrigger render={<Button>Abrir</Button>} />
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Título</SheetTitle>
      <SheetDescription>Descrição</SheetDescription>
    </SheetHeader>
    Conteúdo...
    <SheetFooter>
      <Button>Salvar</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>`}
        >
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger render={<Button variant="outline">Abrir sheet</Button>} />
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Preferências</SheetTitle>
                <SheetDescription>
                  Ajuste as configurações do seu painel.
                </SheetDescription>
              </SheetHeader>
              <div className="ds-col" style={{ padding: '16px 0' }}>
                <label className="ds-label">
                  <Switch checked={swNotify} onCheckedChange={(v) => setSwNotify(v)} /> Notificações por email
                </label>
                <label className="ds-label">
                  <Switch checked={swDark} onCheckedChange={(v) => setSwDark(v)} /> Relatórios automáticos
                </label>
              </div>
              <SheetFooter>
                <Button onClick={() => setSheetOpen(false)}>Salvar</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </ComponentCard>

        {/* ── Command ── */}
        <ComponentCard
          name="Command (Palette)"
          description="Paleta de comandos ⌘K · busca, atalhos, navegação rápida"
          howToUse={`import {
  Command, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandShortcut,
} from '../../components/ui/command'

<Command>
  <CommandInput placeholder="Buscar..." />
  <CommandList>
    <CommandEmpty>Nada encontrado.</CommandEmpty>
    <CommandGroup heading="Navegação">
      <CommandItem>
        Perfil <CommandShortcut>⌘P</CommandShortcut>
      </CommandItem>
    </CommandGroup>
  </CommandList>
</Command>

{/* Para overlay use CommandDialog */}
<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Comando..." />
  ...
</CommandDialog>`}
        >
          <Command className="ds-command-box">
            <CommandInput placeholder="Buscar comandos..." />
            <CommandList>
              <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
              <CommandGroup heading="Navegação">
                <CommandItem>
                  <span>Painel</span>
                  <CommandShortcut>⌘1</CommandShortcut>
                </CommandItem>
                <CommandItem>
                  <span>Tarefas</span>
                  <CommandShortcut>⌘2</CommandShortcut>
                </CommandItem>
                <CommandItem>
                  <span>Clientes</span>
                  <CommandShortcut>⌘3</CommandShortcut>
                </CommandItem>
              </CommandGroup>
              <CmdSeparator />
              <CommandGroup heading="Ações">
                <CommandItem>
                  <span>Nova tarefa</span>
                  <CommandShortcut>⌘N</CommandShortcut>
                </CommandItem>
                <CommandItem>
                  <span>Exportar relatório</span>
                  <CommandShortcut>⌘E</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </ComponentCard>
      </Section>

      {/* ═══════════ 5. NAVEGAÇÃO ═══════════ */}
      <Section id="navigation" icon="🧭" title="Navegação">
        {/* ── Tabs ── */}
        <ComponentCard
          name="Tabs"
          description="Abas horizontal e vertical · 2 variantes: default (fundo) e line (linha)"
          howToUse={`import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'

<Tabs defaultValue="a">
  <TabsList>
    <TabsTrigger value="a">Primeira</TabsTrigger>
    <TabsTrigger value="b">Segunda</TabsTrigger>
  </TabsList>
  <TabsContent value="a">Conteúdo A</TabsContent>
  <TabsContent value="b">Conteúdo B</TabsContent>
</Tabs>`}
        >
          <div className="ds-col">
            <Tabs defaultValue="a">
              <TabsList>
                <TabsTrigger value="a">Clientes</TabsTrigger>
                <TabsTrigger value="b">Tarefas</TabsTrigger>
                <TabsTrigger value="c">Relatórios</TabsTrigger>
              </TabsList>
              <TabsContent value="a" className="ds-tab-demo">
                Lista de clientes...
              </TabsContent>
              <TabsContent value="b" className="ds-tab-demo">
                Suas tarefas pendentes...
              </TabsContent>
              <TabsContent value="c" className="ds-tab-demo">
                Relatórios mensais...
              </TabsContent>
            </Tabs>

            <Separator className="my-1 opacity-30" />

            <Tabs defaultValue="x" orientation="vertical">
              <TabsList variant="line">
                <TabsTrigger value="x">Geral</TabsTrigger>
                <TabsTrigger value="y">Avançado</TabsTrigger>
              </TabsList>
              <TabsContent value="x" className="ds-tab-demo">
                Configurações gerais...
              </TabsContent>
              <TabsContent value="y" className="ds-tab-demo">
                Configurações avançadas...
              </TabsContent>
            </Tabs>
          </div>
        </ComponentCard>

        {/* ── Pagination ── */}
        <ComponentCard
          name="Pagination"
          description="Navegação entre páginas · link ativo, ellipsis, previous/next com texto"
          howToUse={`import {
  Pagination, PaginationContent, PaginationItem,
  PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis,
} from '../../components/ui/pagination'

<Pagination>
  <PaginationContent>
    <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
    <PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem>
    <PaginationItem><PaginationLink href="#">2</PaginationLink></PaginationItem>
    <PaginationItem><PaginationEllipsis /></PaginationItem>
    <PaginationItem><PaginationNext href="#" /></PaginationItem>
  </PaginationContent>
</Pagination>`}
        >
          <Pagination>
            <PaginationContent>
              <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
              <PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem>
              <PaginationItem><PaginationLink href="#">2</PaginationLink></PaginationItem>
              <PaginationItem><PaginationLink href="#">3</PaginationLink></PaginationItem>
              <PaginationItem><PaginationEllipsis /></PaginationItem>
              <PaginationItem><PaginationLink href="#">8</PaginationLink></PaginationItem>
              <PaginationItem><PaginationNext href="#" /></PaginationItem>
            </PaginationContent>
          </Pagination>
        </ComponentCard>

        {/* ── Separator ── */}
        <ComponentCard
          name="Separator"
          description="Linha divisória horizontal ou vertical entre seções"
          howToUse={`import { Separator } from '../../components/ui/separator'

<Separator />
<Separator orientation="vertical" className="h-8" />`}
        >
          <div className="ds-col">
            <p className="ds-text-sm">Conteúdo acima</p>
            <Separator />
            <p className="ds-text-sm">Conteúdo abaixo</p>
          </div>
          <div className="ds-row" style={{ height: 32, marginTop: 8 }}>
            <span className="ds-text-sm">Esquerda</span>
            <Separator orientation="vertical" />
            <span className="ds-text-sm">Direita</span>
          </div>
        </ComponentCard>

        {/* ── Carousel ── */}
        <ComponentCard
          name="Carousel"
          description="Rolagem horizontal com setas · desabilita nas bordas · sem dependências"
          howToUse={`import { Carousel } from '../../components/dashboard/Carousel'

<Carousel ariaLabel="Exemplo">
  {items.map((i) => (
    <div key={i} className="min-w-[280px]">Card {i}</div>
  ))}
</Carousel>`}
        >
          <Carousel ariaLabel="Exemplo de carrossel" className="-mx-1 px-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="flex min-w-[240px] flex-col justify-center rounded-lg border border-border bg-white/[0.03] p-5"
              >
                <div className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">
                  Exemplo
                </div>
                <div className="text-[15px] font-bold text-foreground">Card {n}</div>
              </div>
            ))}
          </Carousel>
        </ComponentCard>
      </Section>

      <Section id="contatos" icon="📇" title="Contatos">
        <ComponentCard
          name="ContactsTable"
          description="Tabela da agenda: nome, telefone (com máscara), e-mail, empresa e origem · Cadastro próprio / Prospecto / Cliente · empresa sem pessoa mostra 'sem pessoa cadastrada' e fica somente leitura · só o contato próprio é excluível"
          howToUse={`import { ContactsTable } from '../../components/contacts/ContactsTable'

<ContactsTable
  contacts={contatos}
  onEdit={(c) => abrirDialogo(c)}
  onDelete={(c) => confirmarExclusao(c)}
/>

// 'livre'     = contato do próprio cadastro (edita e exclui aqui)
// 'prospecto' = contato do prospecto em aberto (edita no cadastro do prospecto)
// 'cliente'   = contato do cliente (edita no cadastro do cliente)
// tem_pessoa = false => empresa sem representante: linha somente leitura`}
        >
          <ContactsTable
            contacts={CONTATOS_DEMO}
            onEdit={() => toast.info('Editar contato')}
            onDelete={() => toast.info('Excluir contato')}
          />
        </ComponentCard>

        <ComponentCard
          name="ContactFormDialog"
          description="Diálogo de cadastro/edição · telefone com a máscara do design system (MaskedInput) · nas linhas de empresa o campo Empresa vem desabilitado, porque a empresa tem uma fonte só: o cadastro dela"
          howToUse={`import { ContactFormDialog } from '../../components/contacts/ContactFormDialog'

<ContactFormDialog
  open={aberto}
  contact={emEdicao}
  onClose={() => setAberto(false)}
  onSubmit={async (dados) => {
    await salvar(dados)
    setAberto(false)
  }}
/>

// Fase 4: contato de empresa (origem 'cliente'/'prospecto') => PATCH /contacts/{contactId} (a pessoa é um Contact)
// caso contrário                                            => POST/PATCH /contacts (contato do próprio cadastro)`}
        >
          <div className="ds-row">
            <Button variant="secondary" onClick={() => setContatoDialogOpen(true)}>
              Abrir formulário de contato
            </Button>
          </div>
          <ContactFormDialog
            open={contatoDialogOpen}
            contact={CONTATOS_DEMO[0]}
            onClose={() => setContatoDialogOpen(false)}
            onSubmit={async (dados) => {
              toast.success(`Salvar: ${JSON.stringify(dados)}`)
              setContatoDialogOpen(false)
            }}
          />
        </ComponentCard>
      </Section>

      {/* ═══════════ CONTRATOS ═══════════ */}
      <Section id="contratos" icon="📄" title="Contratos">
        <ComponentCard
          name="ContractSectionsEditor"
          description="Editor de seções de contratos por acordeom · clique na seta para expandir e editar inline (título + conteúdo) · reordenação por drag & drop · adicionar/remover · modo readOnly para contratos finalizados"
          howToUse={`import { ContractSectionsEditor } from '../../components/contracts/ContractSectionsEditor'

const [sections, setSections] = useState([
  { title: 'Das Partes', content: 'Contratante: {{nome}}' },
])

// Editável (rascunho):
<ContractSectionsEditor sections={sections} onChange={setSections} />

// Somente leitura (finalizado):
<ContractSectionsEditor sections={sections} readOnly />`}
        >
          <div className="ds-col">
            <ContractSectionsEditor
              sections={[
                { title: 'Das Partes', content: 'Contratante: {{nome}}, inscrito sob CNPJ {{cnpj}}.' },
                { title: 'Do Objeto', content: 'Prestação de serviços de BPO financeiro pelo valor mensal de {{valor_mensal}}.' },
                { title: 'Da Vigência', content: 'O presente contrato terá vigência de 12 meses.' },
              ]}
              onChange={() => {}}
            />
          </div>
        </ComponentCard>

        <ComponentCard
          name="ContractDocument"
          description="Renderização do contrato completo em formato de documento para leitura: folha estilizada, título, seções com cabeçalhos e tokens pendentes {{...}} destacados em âmbar + legenda de preenchimento manual"
          howToUse={`import { ContractDocument } from '../../components/contracts/ContractDocument'

<ContractDocument
  clientName="Alpha Consultoria"
  sections={[
    { title: 'Das Partes', content: 'Contratante: {{nome}}' },
    { title: 'Do Objeto', content: 'Serviços de BPO financeiro.' },
  ]}
/>`}
        >
          <div className="ds-col">
            <ContractDocument
              clientName="Alpha Consultoria"
              sections={[
                { title: 'Das Partes', content: 'Contratante: {{nome}}, inscrito sob CNPJ {{cnpj}}.' },
                { title: 'Do Objeto', content: 'Prestação de serviços de BPO financeiro pelo valor mensal de {{valor_mensal}}.' },
                { title: 'Da Vigência', content: 'O presente contrato terá vigência de 12 meses.' },
              ]}
            />
          </div>
        </ComponentCard>

        <ComponentCard
          name="ContractFieldsModal"
          description="Formulário dinâmico para dados do contrato sem fonte no banco · campos agrupados por grupo · kinds text/number/date/select/boolean/money/list · submit filtra vazios"
          howToUse={`import { ContractFieldsModal } from '../../components/contracts/ContractFieldsModal'
import { ContractFieldDescriptor } from '../../api/contracts'

const descriptors: ContractFieldDescriptor[] = [
  { key: 'sistema_gestao', label: 'Sistema de gestão', kind: 'text', group: 'Operação' },
  { key: 'dia_vencimento', label: 'Dia de vencimento', kind: 'number', default: '10', group: 'Financeiro' },
]

<ContractFieldsModal
  open={open}
  title="Dados do contrato"
  descriptors={descriptors}
  submitLabel="Gerar contrato"
  onClose={() => setOpen(false)}
  onSubmit={async (fields) => { console.log(fields) }}
/>`}
        >
          <div className="ds-col">
            <p className="text-sm text-muted-foreground">
              Abre em diálogo. Veja a page Contrato Detalhe / Novo Contrato para uso real.
            </p>
          </div>
        </ComponentCard>
      </Section>

      {/* ═══════════ 6. GOVERNANÇA ═══════════ */}
      <Section id="governanca" icon="📈" title="Governança">
        <ComponentCard
          name="DealCard"
          description="Card de negócio da Governança: nome, status, segmento/CNPJ/cidade, valor da proposta e detalhe expansível com dados, links e timeline."
          howToUse={`import { DealCard } from '../../components/governanca/DealCard'
import type { Deal } from '../../api/governanca'

<DealCard deal={deal.conquistado} />

// Deal: { id, name, status: 'conquistado'|'em_negociacao'|'perdido',
//   reference_date, proposal: {id, final_price}, contract: {id, number},
//   timeline: [{type: 'created'|'sent'|'approved'|'rejected'|'pending', label, date, mock?}] }`}
        >
          <div className="ds-col gap-3">
            {DEMO_GOVERNANCA.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        </ComponentCard>

        <ComponentCard
          name="DealTimeline"
          description="Timeline visual do negócio. Eventos mockados (sem data) exibem 'Aguardando decisão do prospecto'."
          howToUse={`import { DealTimeline } from '../../components/governanca/DealTimeline'

<DealTimeline events={deal.timeline} />

// Tipos: created (cinza), sent (primary), approved (verde),
//        rejected (vermelho), pending (âmbar, mock sem data)`}
        >
          <div className="ds-col gap-3">
            {DEMO_GOVERNANCA.map((deal) => (
              <div key={deal.id} className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="mb-2 text-[13px] font-semibold text-foreground">{deal.name}</div>
                <DealTimeline events={deal.timeline} />
              </div>
            ))}
          </div>
        </ComponentCard>
      </Section>

      {/* ═══════════ 7. COMUNIDADE ═══════════ */}
      <Section id="comunidade" icon="👥" title="Comunidade">
        <ComponentCard
          name="NewIndicator"
          description="Contador de novidades de uma área (Privados, Públicos, Projetos). Uma notificação não lida = um item sinalizado; o número some sozinho quando o usuário abre o item, porque o backend marca a notificação como lida. Some com 0 e mostra '99+' acima de 99."
          howToUse={`import { NewIndicator } from '../../components/network/NewIndicator'

<NewIndicator category="private" />   // botão Privados
<NewIndicator category="public" />    // botão Públicos
<NewIndicator category="projects" />  // gestão de projetos (a vitrine do fórum não sinaliza)

// props: category ('private' | 'public' | 'projects' | 'profile'), className`}
        >
          <div className="ds-col gap-3 text-[14px] text-foreground">
            <p className="flex items-center gap-2">
              Privados <NewIndicator category="private" />
            </p>
            <p className="flex items-center gap-2">
              Públicos <NewIndicator category="public" />
            </p>
            <p className="flex items-center gap-2">
              Projetos <NewIndicator category="projects" />
            </p>
          </div>
        </ComponentCard>

        <ComponentCard
          name="MemberLink"
          description="Nome de qualquer pessoa da Comunidade sempre clicável para o perfil (/painel/membros/:userId). Sem stopPropagation de quebra de card: em cards clicáveis o clique no nome abre o perfil, não o card. Sem memberId, degrada para texto puro."
          howToUse={`import { MemberLink } from '../../components/network/MemberLink'

<MemberLink memberId={post.author.id} name={post.author.name} email={post.author.email} />

// props: memberId (obrigatório p/ link), name, email, fallback='Usuário',
//        className, stopPropagation=true`}
        >
          <div className="ds-col gap-2 text-[14px] text-foreground">
            <p>
              Postado por{' '}
              <MemberLink memberId="user-demo" name="Marina Souza" />
            </p>
            <p>
              Convite de{' '}
              <MemberLink memberId="user-2" name="Bruno Lima" />
            </p>
            <p>
              Sem id (degrada para texto):{' '}
              <MemberLink memberId={null} name="Convite pendente" />
            </p>
          </div>
        </ComponentCard>

        <ComponentCard
          name="MemberProfilePage"
          description="Perfil público interno do membro: avatar, nome, empresa própria, bio, skills e comentários sobre o trabalho. Nunca exibe e-mail, telefone, CPF ou CNPJ."
          howToUse={`// Rota protegida (lazy) em src/router.tsx
{ path: 'membros/:userId', element: <SuspenseWrapper><MemberProfilePage /></SuspenseWrapper> }

// Nome do autor clicável no fórum:
<Link to={\`/painel/membros/\${post.author.id}\`} onClick={e => e.stopPropagation()}>
  {post.author.name}
</Link>

// Notificações abrem o perfil (NotificationBell):
notif.type === 'profile_comment' -> navigate(\`/painel/membros/\${notif.related_entity_id}\`)`}
        >
          <div className="ds-col gap-3">
            <MemberProfileDemo />
          </div>
        </ComponentCard>
      </Section>

      {/* ═══════════ 8. PROJETOS ═══════════ */}
      <Section id="projetos" icon="📁" title="Projetos">
        <ComponentCard
          name="ProjetoIndicadores"
          description="Topo da gestão de projetos: quanto o usuário criou, quanto participa e quantas propostas estão paradas esperando ele"
          howToUse={`import { ProjetoIndicadores } from '../../components/projetos/ProjetoIndicadores'

<ProjetoIndicadores criados={2} participa={1} aguardando={3} />

// criados  = projetos com owner_id === user.id
// participa = projetos com grupo aceito (is_group_member)
// aguardando = soma de application_count dos projetos que ele cria`}
        >
          <ProjetoIndicadores criados={2} participa={1} aguardando={3} />
        </ComponentCard>

        <ComponentCard
          name="ProjetosCard"
          description="Card da lista de Gestão › Projetos: dono, estado das propostas, contagem de candidatos e atalhos para o detalhe, o tópico e o arquivamento"
          howToUse={`import { ProjetosCard } from '../../components/projetos/ProjetosCard'

<ProjetosCard project={projeto} onArchive={(p) => confirmarArquivar(p)} />

// O arquivamento é is_active=false, não delete: some do mural do fórum
// (que lê a mesma tabela) e o projeto volta a aparecer se for reativado.`}
        >
          <ProjetosCard
            project={{
              id: 'demo-gestao-1',
              owner_id: 'user-1',
              owner: { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
              title: 'Automação de fluxo fiscal',
              description: 'Projeto para automatizar o fluxo fiscal dos clientes.',
              status: 'open',
              team_size: 2,
              remote_type: 'remote',
              published_at: null,
              created_at: '2026-09-08T00:00:00Z',
              updated_at: '2026-09-10T00:00:00Z',
              skills: [
                { id: 's1', name: 'Python', slug: 'python', is_active: true },
              ],
              group_id: 'demo-group-1',
              is_group_member: true,
              is_owner: true,
              application_count: 3,
              applications_closed: false,
            }}
            onArchive={() => toast.info('Arquivar projeto')}
          />
        </ComponentCard>

        <ComponentCard
          name="ProjetoFormDialog"
          description="Cadastro e edição de projeto: os mesmos campos para os dois casos (novo = project null). Convidar gente não mora aqui — é a aba Equipe"
          howToUse={`import { ProjetoFormDialog } from '../../components/projetos/ProjetoFormDialog'

<ProjetoFormDialog
  open={aberto}
  project={emEdicao}          // null = novo projeto
  onClose={() => setAberto(false)}
  onSubmit={async (dados) => {
    const payload = toProjetoPayload(dados)
    emEdicao ? await updateProject(emEdicao.id, payload) : await createProject(payload)
    setAberto(false)
  }}
/>`}
        >
          <div className="ds-row">
            <Button variant="secondary" onClick={() => setProjetoDialogOpen(true)}>
              Abrir cadastro de projeto
            </Button>
          </div>
          <ProjetoFormDialog
            open={projetoDialogOpen}
            project={null}
            onClose={() => setProjetoDialogOpen(false)}
            onSubmit={async (dados) => {
              toast.success(`Salvar: ${JSON.stringify(dados)}`)
              setProjetoDialogOpen(false)
            }}
          />
        </ComponentCard>

        <ComponentCard
          name="ProjetoEquipePanel"
          description="Aba Equipe do detalhe: quem já entrou e o convite por busca de habilidade. O convite tem mensagem personalizada e a pessoa entra no grupo só quando aceita. Só o dono convida e ninguém é removido"
          howToUse={`import { ProjetoEquipePanel } from '../../components/projetos/ProjetoEquipePanel'

<ProjetoEquipePanel
  project={projeto}      // is_owner decide se o formulário de convite aparece
  group={grupo}
  onReload={() => recarregarGrupo()}
/>

// Abaixo da linha do convite: convites pendentes (aguardando/aceitou/recusou).
// A lista de espera vem da aba Propostas, não da Equipe.`}
        >
          <ProjetoEquipePanel
            project={{
              id: 'demo-equipe-1',
              owner_id: 'user-1',
              owner: { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
              title: 'Automação de fluxo fiscal',
              description: 'Projeto para automatizar o fluxo fiscal dos clientes.',
              status: 'open',
              team_size: 2,
              remote_type: 'remote',
              published_at: null,
              created_at: '2026-09-08T00:00:00Z',
              updated_at: '2026-09-10T00:00:00Z',
              skills: [],
              group_id: 'demo-group-1',
              is_group_member: true,
              is_owner: false,
              application_count: 0,
              applications_closed: false,
            }}
            group={{
              id: 'demo-group-1',
              project_id: 'demo-equipe-1',
              project_title: 'Automação de fluxo fiscal',
              is_member: true,
              members: [
                { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
                { id: 'user-2', name: 'Ana Souza', email: 'ana@cafe.com' },
              ],
              posts: [],
              created_at: '2026-09-08T00:00:00Z',
            }}
            onReload={() => undefined}
          />
        </ComponentCard>

        <ComponentCard
          name="ProjetoTopicoPanel"
          description="Aba Tópico do detalhe: as cinco publicações mais recentes do fórum do projeto e o atalho para a página completa do grupo"
          howToUse={`import { ProjetoTopicoPanel } from '../../components/projetos/ProjetoTopicoPanel'

<ProjetoTopicoPanel project={projeto} group={grupo} />

// O corpo do post vem como texto puro do backend (bleach no repositório),
// então é renderizado como text node — nunca innerHTML.`}
        >
          <ProjetoTopicoPanel
            project={{
              id: 'demo-topico-1',
              owner_id: 'user-1',
              owner: { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
              title: 'Automação de fluxo fiscal',
              description: 'Projeto para automatizar o fluxo fiscal dos clientes.',
              status: 'open',
              team_size: 2,
              remote_type: 'remote',
              published_at: null,
              created_at: '2026-09-08T00:00:00Z',
              updated_at: '2026-09-10T00:00:00Z',
              skills: [],
              group_id: 'demo-group-1',
              is_group_member: true,
              is_owner: true,
              application_count: 0,
              applications_closed: false,
            }}
            group={{
              id: 'demo-group-1',
              project_id: 'demo-topico-1',
              project_title: 'Automação de fluxo fiscal',
              is_member: true,
              members: [
                { id: 'user-1', name: 'Raul Gomes', email: 'raul@cafe.com' },
              ],
              posts: [
                {
                  id: 'post-1',
                  group_id: 'demo-group-1',
                  author_id: 'user-2',
                  author: { id: 'user-2', name: 'Ana Souza', email: 'ana@cafe.com' },
                  body: 'Alinhemos o escopo do primeiro entregável do fluxo fiscal.',
                  created_at: '2026-09-09T10:00:00Z',
                },
              ],
              created_at: '2026-09-08T00:00:00Z',
            }}
          />
        </ComponentCard>
      </Section>

      {/* ═══════════ 8. MODOS ═══════════ */}
      <Section id="modes" icon="🎨" title="Modos de Trabalho">
        <ComponentCard
          name="Modos"
          description="Cada modo do painel (sidebar) aplica um acento próprio via data-mode no wrapper do painel — muda a percepção de 'modo de trabalho'. Operacional mantém o dourado da marca."
          howToUse={`// PanelLayout aplica data-mode derivado do menu ativo:
<div data-mode="captar">…painel…</div>

// CSS (globals.css): sobrescreve os tokens de acento por modo:
[data-mode="captar"] { --primary: 152 62% 45%; … }
.light-theme [data-mode="captar"] { --primary: 152 65% 38%; … }`}
        >
          <div className="ds-col">
            {[
              { mode: 'operacional', label: 'Operacional', desc: 'Tarefas · Rotinas · Clientes' },
              { mode: 'captar', label: 'Captar', desc: 'Orçamentos · Contratos · Contatos · Pagamentos' },
              { mode: 'comunidade', label: 'Comunidade', desc: 'Fórum · Galeria' },
              { mode: 'gestao', label: 'Gestão', desc: 'Projetos · Equipes' },
              { mode: 'config', label: 'Config', desc: 'Design System' },
            ].map((m) => (
              <div
                key={m.mode}
                data-mode={m.mode}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <span className="size-4 shrink-0 rounded-full" style={{ background: 'hsl(var(--primary))' }} />
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-foreground">{m.label}</div>
                  <div className="text-[11px] text-muted-foreground">{m.desc}</div>
                </div>
                <span className="text-[11px] font-semibold text-primary-strong">hsl(var(--primary))</span>
              </div>
            ))}
          </div>
        </ComponentCard>
      </Section>
    </div>
  )
}
