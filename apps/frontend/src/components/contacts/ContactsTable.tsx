import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { maskPhone } from '../../lib/formatters';
import type { ContactResponse, OrigemContato } from '../../api/contacts';

export interface ContactsTableProps {
  contacts: ContactResponse[];
  onEdit: (contact: ContactResponse) => void;
  onDelete: (contact: ContactResponse) => void;
}

const VAZIO = '—';

const ORIGEM_LABEL: Record<OrigemContato, string> = {
  livre: 'Cadastro próprio',
  prospecto: 'Prospecto',
  cliente: 'Cliente',
};

const celula = (valor: string | null) => (
  <span className={valor ? undefined : 'text-muted-foreground'}>{valor || VAZIO}</span>
);

const telefone = (valor: string | null) =>
  valor ? maskPhone(valor) : <span className="text-muted-foreground">{VAZIO}</span>;

/** Tabela da agenda: nome, telefone, e-mail e empresa.
 *
 * A coluna de origem diz de onde vem a linha: `Cadastro próprio` (contato livre,
 * que pode ser excluído), `Prospecto` (em aberto) ou `Cliente` (convertido) —
 * nestas duas o contato é corrigido no cadastro da empresa, por isso não há
 * botão de excluir. Empresa sem representante nomeado aparece com o contato
 * dela e fica somente leitura (a pessoa é cadastrada no cadastro da empresa).
 */
export function ContactsTable({ contacts, onEdit, onDelete }: ContactsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
            Nome
          </TableHead>
          <TableHead className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
            Telefone
          </TableHead>
          <TableHead className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
            E-mail
          </TableHead>
          <TableHead className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
            Empresa
          </TableHead>
          <TableHead className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
            Origem
          </TableHead>
          <TableHead className="px-6 py-4 text-right text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
            Ações
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map((contato) => {
          const doProprioCadastro = contato.origem === 'livre';
          return (
            <TableRow key={contato.id}>
              <TableCell className="px-6 py-4">
                <div className="font-medium text-foreground">{contato.nome}</div>
                {contato.tem_pessoa ? null : (
                  <div className="text-[12px] text-muted-foreground">
                    sem pessoa cadastrada
                  </div>
                )}
              </TableCell>
              <TableCell className="px-6 py-4 text-muted-foreground">
                {telefone(contato.telefone)}
              </TableCell>
              <TableCell className="px-6 py-4 text-muted-foreground">
                {celula(contato.email)}
              </TableCell>
              <TableCell className="px-6 py-4 text-muted-foreground">
                {celula(contato.empresa)}
              </TableCell>
              <TableCell className="px-6 py-4">
                <Badge variant={doProprioCadastro ? 'outline' : 'default'}>
                  {ORIGEM_LABEL[contato.origem]}
                </Badge>
              </TableCell>
              <TableCell className="px-6 py-4">
                <div className="flex justify-end gap-1">
                  {contato.tem_pessoa ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${contato.nome}`}
                      onClick={() => onEdit(contato)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {doProprioCadastro ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir ${contato.nome}`}
                      onClick={() => onDelete(contato)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
