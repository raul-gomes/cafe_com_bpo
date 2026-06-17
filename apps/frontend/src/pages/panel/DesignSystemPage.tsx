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

import './DesignSystemPage.css'

// ─── Navigation sections ──────────────────────────────────────────────
const sections = [
  { id: 'form', icon: '⌨️', label: 'Formulários' },
  { id: 'display', icon: '🖼️', label: 'Exibição' },
  { id: 'feedback', icon: '💬', label: 'Feedback' },
  { id: 'overlay', icon: '📦', label: 'Sobreposições' },
  { id: 'navigation', icon: '🧭', label: 'Navegação' },
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

// ═══════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════
export default function DesignSystemPage() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

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
      </Section>
    </div>
  )
}
