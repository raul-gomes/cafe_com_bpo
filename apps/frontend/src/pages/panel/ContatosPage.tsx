import { useCallback, useEffect, useRef, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { SearchInput } from '../../components/ui/SearchInput';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ContactsTable } from '../../components/contacts/ContactsTable';
import { ContactFormDialog } from '../../components/contacts/ContactFormDialog';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import {
  createContact,
  deleteContact,
  listContacts,
  updateContact,
  type ContactPayload,
  type ContactResponse,
  type OrigemContato,
} from '../../api/contacts';
import { toContactPayload, type ContactFormData } from '../../schemas/contacts';

const VAZIO = '—';

const FILTROS: { value: OrigemContato | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'livre', label: 'Cadastro próprio' },
  { value: 'prospecto', label: 'Prospectos' },
  { value: 'cliente', label: 'Clientes' },
];

/** Gestão › Contatos: a agenda de contatos do BPO.
 *
 * A lista junta três fontes: o que foi cadastrado aqui, o contato de cada
 * prospecto (inclusive o que ainda não virou cliente) e o contato de cada
 * cliente. O contato de prospecto/cliente pertence ao cadastro da empresa, por
 * isso a edição vai para lá e o botão de excluir só existe nas linhas de
 * cadastro próprio. Empresa sem pessoa cadastrada aparece com o contato dela e
 * fica somente leitura.
 */
export function ContatosPage() {
  const confirm = useConfirm();
  const [contatos, setContatos] = useState<ContactResponse[]>([]);
  const [busca, setBusca] = useState('');
  const [origem, setOrigem] = useState<OrigemContato | 'todos'>('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<ContactResponse | null>(null);
  const primeiraCarga = useRef(true);
  const requisicaoAtual = useRef(0);

  const carregar = useCallback(async (termo: string, filtro: OrigemContato | 'todos') => {
    requisicaoAtual.current += 1;
    const idRequisicao = requisicaoAtual.current;
    setCarregando(true);
    try {
      const params: { q?: string; origem?: OrigemContato } = {};
      if (termo) {
        params.q = termo;
      }
      if (filtro !== 'todos') {
        params.origem = filtro;
      }
      const lista = await listContacts(params);
      // resposta antiga não pode sobrescrever a mais recente
      if (idRequisicao !== requisicaoAtual.current) {
        return;
      }
      setContatos(lista);
      setErro('');
    } catch {
      if (idRequisicao !== requisicaoAtual.current) {
        return;
      }
      setErro('Não foi possível carregar os contatos. Tente novamente.');
    } finally {
      if (idRequisicao === requisicaoAtual.current) {
        setCarregando(false);
      }
    }
  }, []);

  useEffect(() => {
    // primeira carga na hora (a página não pode piscar esperando o timer);
    // as buscas seguintes esperam 300ms sem digitar, para não virar uma
    // request por tecla
    if (primeiraCarga.current) {
      primeiraCarga.current = false;
      void carregar(busca, origem);
      return;
    }
    const timer = setTimeout(() => {
      void carregar(busca, origem);
    }, 300);
    return () => clearTimeout(timer);
  }, [carregar, busca, origem]);

  const abrirNovo = () => {
    setEmEdicao(null);
    setFormAberto(true);
  };

  const abrirEdicao = (contato: ContactResponse) => {
    setEmEdicao(contato);
    setFormAberto(true);
  };

  const fechar = () => {
    setFormAberto(false);
    setEmEdicao(null);
  };

  const salvar = async (dados: ContactFormData) => {
    const payload = toContactPayload(dados);
    const daEmpresa =
      emEdicao?.origem === 'cliente' || emEdicao?.origem === 'prospecto';
    try {
      if (emEdicao) {
        // A linha da empresa É o contato (fase 4): a edição vai por `id` do
        // contato. `empresa` só vale em contato livre — no cadastro da empresa
        // o nome tem uma fonte só e não é enviado.
        const daPessoa: Partial<ContactPayload> = daEmpresa
          ? { nome: payload.nome, telefone: payload.telefone, email: payload.email }
          : payload;
        await updateContact(emEdicao.id, daPessoa);
        toast.success(
          emEdicao.origem === 'cliente'
            ? 'Contato do cliente atualizado.'
            : emEdicao.origem === 'prospecto'
              ? 'Contato do prospecto atualizado.'
              : 'Contato atualizado.'
        );
      } else {
        await createContact(payload);
        toast.success('Contato salvo.');
      }
      fechar();
      await carregar(busca, origem);
    } catch {
      toast.error('Não foi possível salvar o contato.');
    }
  };

  const excluir = async (contato: ContactResponse) => {
    const ok = await confirm({
      title: 'Excluir contato',
      message: 'O contato sai da lista. Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
    });
    if (!ok) {
      return;
    }
    try {
      await deleteContact(contato.id);
      toast.success('Contato excluído.');
      await carregar(busca, origem);
    } catch {
      toast.error('Não foi possível excluir o contato.');
    }
  };

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Contatos' }]} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-foreground">Contatos</h1>
          <p className="text-[14px] text-muted-foreground">
            Encontre os contatos das empresas e salve os novos.
          </p>
        </div>
        <Button onClick={abrirNovo}>
          <UserPlus className="h-4 w-4" />
          Novo contato
        </Button>
      </div>

      <Card className="mb-4 p-4">
        <SearchInput
          value={busca}
          onChange={setBusca}
          label="Buscar contatos"
          placeholder="Buscar por nome, empresa, telefone ou e-mail"
        />
      </Card>

      <Tabs
        value={origem}
        onValueChange={(valor) => setOrigem(valor as OrigemContato | 'todos')}
        className="mb-4"
      >
        <TabsList variant="line">
          {FILTROS.map((filtro) => (
            <TabsTrigger key={filtro.value} value={filtro.value}>
              {filtro.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {erro ? (
        <Card className="p-12 text-center text-[14px] text-destructive">{erro}</Card>
      ) : null}

      {!erro && carregando ? (
        <Card className="p-12 text-center text-[14px] text-muted-foreground">
          Carregando contatos...
        </Card>
      ) : null}

      {!erro && !carregando && contatos.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-[16px] font-semibold text-foreground">
            Nenhum contato ainda
          </p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {busca || origem !== 'todos'
              ? 'Nenhum contato encontrado para este filtro.'
              : 'Salve um contato ou cadastre um prospecto/cliente para o contato aparecer aqui.'}
          </p>
        </Card>
      ) : null}

      {!erro && !carregando && contatos.length > 0 ? (
        <Card className="overflow-hidden">
          <ContactsTable
            contacts={contatos}
            onEdit={abrirEdicao}
            onDelete={(contato) => {
              void excluir(contato);
            }}
          />
        </Card>
      ) : null}

      {!erro && contatos.length > 0 ? (
        <p className="mt-3 text-[12px] text-muted-foreground">
          {contatos.length} {contatos.length === 1 ? 'contato' : 'contatos'} — campo vazio aparece como {VAZIO}
        </p>
      ) : null}

      <ContactFormDialog
        open={formAberto}
        contact={emEdicao}
        onClose={fechar}
        onSubmit={salvar}
      />
    </div>
  );
}
