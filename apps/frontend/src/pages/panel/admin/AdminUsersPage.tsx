import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ADMIN_EXPORT_LIMIT, adminGrantCourtesy, adminListUsers, adminRevokeCourtesy } from '../../../api/platform';
import type { AdminUser } from '../../../schemas/platform';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader';
import { FolderTabButton } from '../../../components/ui/folder-tab-button';
import { apiErrorText, formatDay } from '../../../lib/adminFormat';
import { downloadSpreadsheet } from '../../../lib/spreadsheet';
import { CafeIcon } from '../../../brand/CafeIcon';

/** How each access state reads on the page. */
const ACCESS_LABELS: Record<string, string> = {
  admin: 'Administrador',
  beta: 'Beta',
  courtesy: 'Cortesia',
  active: 'Assinante',
  past_due: 'Pagamento pendente',
  free: 'Gratuito',
};

const ACCESS_TAGS: Record<string, string> = {
  admin: 'cafe-tag-module',
  beta: 'cafe-tag-module',
  courtesy: 'cafe-tag-success',
  active: 'cafe-tag-success',
  past_due: 'cafe-tag-warning',
  free: '',
};

const COURTESY_DAYS = [30, 60, 90, 180, 365];

/**
 * Admin › Usuários e cortesias: who uses the Café, on which plan, and the
 * courtesy — full access for a period without paying (partners, supporters,
 * support cases). Granting again replaces the running courtesy.
 *
 * @returns The page.
 */
export const AdminUsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [grantingFor, setGrantingFor] = useState<AdminUser | null>(null);
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState('');

  const { data: list, isLoading } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => adminListUsers(search.trim() || undefined),
  });
  const users = list?.items;
  const [exporting, setExporting] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });

  const grant = useMutation({
    mutationFn: () => adminGrantCourtesy(grantingFor!.id, days, reason.trim() || undefined),
    onSuccess: () => {
      toast.success(`Cortesia de ${days} dias liberada para ${grantingFor?.name || grantingFor?.email}.`);
      setGrantingFor(null);
      setReason('');
      refresh();
    },
    onError: error => toast.error(apiErrorText(error, 'Não foi possível liberar a cortesia.')),
  });

  const revoke = useMutation({
    mutationFn: adminRevokeCourtesy,
    onSuccess: () => {
      toast.success('Cortesia encerrada.');
      refresh();
    },
  });

  /** The Excel asks the server for every user of the search, not only the
   *  rows on screen: the list is cut at 300 (AUD-044). */
  const exportUsers = async () => {
    setExporting(true);
    try {
      const all = await adminListUsers(search.trim() || undefined, ADMIN_EXPORT_LIMIT);
      downloadSpreadsheet(
        'usuarios-cafe-com-bpo',
        ['Nome', 'E-mail', 'Acesso', 'Acesso até', 'Cortesia (motivo)', 'Desde'],
        all.items.map(u => [
          u.name,
          u.email,
          ACCESS_LABELS[u.access_state] ?? u.access_state,
          formatDay(u.access_expires_at),
          u.courtesy?.reason ?? '',
          formatDay(u.created_at),
        ])
      );
      if (all.total > all.items.length) {
        toast.warning(`A planilha traz ${all.items.length} de ${all.total} usuários (limite de uma exportação).`);
      }
    } catch (error) {
      toast.error(apiErrorText(error, 'Não foi possível gerar a planilha.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      <AdminPageHeader
        title="Usuários e cortesias"
        lead="Cortesia é acesso completo, sem cobrança, por um período: para parceiros, apoiadores ou um caso de suporte. Termina sozinha na data."
        actions={
          users && users.length > 0 && (
            <button
              type="button"
              className="cafe-button cafe-button-secondary cafe-button-sm"
              onClick={() => void exportUsers()}
              disabled={exporting}
            >
              <CafeIcon name="relatorio" className="size-[16px]" /> {exporting ? 'Gerando planilha…' : 'Baixar para Excel'}
            </button>
          )
        }
      />

      <input
        className="cafe-input mb-[16px] w-full max-w-[420px]"
        type="search"
        placeholder="Buscar por nome ou e-mail"
        value={search}
        onChange={e => setSearch(e.target.value)}
        aria-label="Buscar usuário"
      />

      {isLoading && <p className="text-muted-foreground">Carregando…</p>}

      {list && list.total > list.items.length && (
        <p className="mb-[12px] text-sm text-muted-foreground">
          Mostrando {list.items.length} de {list.total} usuários, os mais recentes. Use a busca para achar os demais; o
          Excel traz todos.
        </p>
      )}

      {grantingFor && (
        <form
          className="cafe-card cafe-card-module mb-[16px] grid gap-[12px]"
          onSubmit={event => {
            event.preventDefault();
            grant.mutate();
          }}
        >
          <p className="font-semibold text-foreground">Cortesia para {grantingFor.name || grantingFor.email}</p>
          <div className="grid gap-[12px] sm:grid-cols-[180px_1fr]">
            <label className="cafe-field">
              <span className="cafe-field-label">Por quanto tempo</span>
              <select className="cafe-select" value={days} onChange={e => setDays(Number(e.target.value))}>
                {COURTESY_DAYS.map(d => <option key={d} value={d}>{d} dias</option>)}
              </select>
            </label>
            <label className="cafe-field">
              <span className="cafe-field-label">Motivo (só a equipe vê)</span>
              <input className="cafe-input" maxLength={300} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex.: parceria, apoiador, suporte" />
            </label>
          </div>
          <div className="flex gap-[8px]">
            <FolderTabButton type="submit" disabled={grant.isPending}>Liberar cortesia</FolderTabButton>
            <button type="button" className="cafe-button cafe-button-secondary" onClick={() => setGrantingFor(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {users && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Usuários</caption>
            <thead className="bg-muted text-xs uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-[14px] py-[10px]">Pessoa</th>
                <th scope="col" className="px-[14px] py-[10px]">Acesso</th>
                <th scope="col" className="px-[14px] py-[10px]">Até</th>
                <th scope="col" className="px-[14px] py-[10px]">Desde</th>
                <th scope="col" className="px-[14px] py-[10px]"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-t border-border align-middle">
                  <td className="px-[14px] py-[12px]">
                    <div className="font-semibold text-foreground">{user.name || '—'}</div>
                    <div className="text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="px-[14px] py-[12px]">
                    <span className={`cafe-tag ${ACCESS_TAGS[user.access_state] ?? ''}`}>{ACCESS_LABELS[user.access_state] ?? user.access_state}</span>
                    {user.courtesy?.reason && <div className="mt-[4px] text-xs text-muted-foreground">{user.courtesy.reason}</div>}
                  </td>
                  <td className="whitespace-nowrap px-[14px] py-[12px] text-muted-foreground">{formatDay(user.access_expires_at)}</td>
                  <td className="whitespace-nowrap px-[14px] py-[12px] text-muted-foreground">{formatDay(user.created_at)}</td>
                  <td className="whitespace-nowrap px-[14px] py-[12px] text-right">
                    {user.role !== 'admin' && (
                      <button type="button" className="cafe-button cafe-button-secondary cafe-button-sm" onClick={() => { setGrantingFor(user); setDays(30); }}>
                        {user.courtesy ? 'Renovar cortesia' : 'Dar cortesia'}
                      </button>
                    )}
                    {user.courtesy && (
                      <button type="button" className="cafe-button cafe-button-text cafe-button-sm ml-[6px]" onClick={() => revoke.mutate(user.courtesy!.id)}>
                        Encerrar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
