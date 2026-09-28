import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { MaskedInput } from '../ui/MaskedInput';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  contactFormSchema,
  EMPTY_CONTACT_FORM,
  type ContactFormData,
} from '../../schemas/contacts';
import type { ContactResponse } from '../../api/contacts';

export interface ContactFormDialogProps {
  open: boolean;
  /** Contato em edição; `null` = novo contato do próprio cadastro. */
  contact: ContactResponse | null;
  onClose: () => void;
  onSubmit: (data: ContactFormData) => Promise<void>;
}

/** Formulário de contato (novo ou edição).
 *
 * O telefone usa a máscara do design system (`MaskedInput tipo="phone"`): o que
 * o BPO digita é "(21) 99876-1122" e o formulário guarda só os dígitos, que é
 * o que a API valida.
 *
 * Na linha que vem do cadastro da empresa (`origem` `prospecto` ou `cliente`) a
 * empresa continua visível — é a coluna da tabela — mas não é editável aqui: o
 * nome da empresa tem uma fonte só, o cadastro da empresa.
 */
export function ContactFormDialog({
  open,
  contact,
  onClose,
  onSubmit,
}: ContactFormDialogProps) {
  const [form, setForm] = useState<ContactFormData>(EMPTY_CONTACT_FORM);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const daEmpresa = contact?.origem === 'cliente' || contact?.origem === 'prospecto';

  useEffect(() => {
    if (!open) {
      return;
    }
    setForm(
      contact
        ? {
            nome: contact.nome,
            telefone: contact.telefone ?? '',
            email: contact.email ?? '',
            empresa: contact.empresa ?? '',
          }
        : EMPTY_CONTACT_FORM
    );
    setErro('');
  }, [open, contact]);

  const set = (campo: keyof ContactFormData) => (valor: string) =>
    setForm((atual) => ({ ...atual, [campo]: valor }));

  const handleSubmit = async () => {
    const resultado = contactFormSchema.safeParse(form);
    if (!resultado.success) {
      setErro(resultado.error.issues[0]?.message ?? 'Revise os dados');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      await onSubmit(resultado.data);
    } finally {
      setSalvando(false);
    }
  };

  const titulo = !contact
    ? 'Novo contato'
    : contact.origem === 'cliente'
      ? 'Editar contato do cliente'
      : contact.origem === 'prospecto'
        ? 'Editar contato do prospecto'
        : 'Editar contato';

  return (
    <Dialog open={open} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="sm:!max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {contact?.origem === 'cliente'
              ? 'As alterações são salvas no cadastro do cliente. O nome da empresa é mantido lá.'
              : contact?.origem === 'prospecto'
                ? 'As alterações são salvas no cadastro do prospecto. O nome da empresa é mantido lá.'
                : 'Nome, telefone, e-mail e empresa. O que você deixar em branco não aparece na tabela.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="contato-nome">Nome</Label>
            <Input
              id="contato-nome"
              value={form.nome}
              onChange={(e) => set('nome')(e.target.value)}
              placeholder="Quem é o contato"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="contato-telefone">Telefone</Label>
            <MaskedInput
              id="contato-telefone"
              tipo="phone"
              value={form.telefone}
              onChange={set('telefone')}
              className="h-9 text-[14px] md:text-[14px]"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="contato-email">E-mail</Label>
            <Input
              id="contato-email"
              type="email"
              value={form.email}
              onChange={(e) => set('email')(e.target.value)}
              placeholder="contato@empresa.com.br"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="contato-empresa">Empresa</Label>
            <Input
              id="contato-empresa"
              value={form.empresa}
              onChange={(e) => set('empresa')(e.target.value)}
              disabled={daEmpresa}
              placeholder={daEmpresa ? 'Definida no cadastro da empresa' : 'Nome da empresa'}
            />
          </div>

          {erro ? (
            <p role="alert" className="text-[13px] font-medium text-destructive">
              {erro}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
