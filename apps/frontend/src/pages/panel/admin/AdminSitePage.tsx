import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminGetSite, adminListRsvps, adminSaveCafeMeeting, adminSaveLoginNotice } from '../../../api/platform';
import type { CafeMeeting, LoginNotice } from '../../../schemas/platform';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader';
import { FolderTabButton } from '../../../components/ui/folder-tab-button';
import { apiErrorText, formatDateTime } from '../../../lib/adminFormat';
import { downloadSpreadsheet } from '../../../lib/spreadsheet';
import { CafeIcon } from '../../../brand/CafeIcon';

/** ISO instant → value of a datetime-local input, in Brasília time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const local = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

/** Value of a datetime-local input (Brasília time) → ISO instant. */
function fromLocalInput(value: string): string | null {
  return value ? new Date(`${value}:00-03:00`).toISOString() : null;
}

/**
 * Admin › Site e encontros: the message of the login window (a good place for
 * notices and promotions), the open café (Meet link, date) and who confirmed
 * presence on the public agenda page.
 *
 * @returns The page.
 */
export const AdminSitePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: site } = useQuery({ queryKey: ['admin', 'site'], queryFn: adminGetSite });
  const { data: rsvps } = useQuery({ queryKey: ['admin', 'rsvps'], queryFn: adminListRsvps });

  const [notice, setNotice] = useState<LoginNotice>({ title: '', message: '', link_label: null, link_url: null });
  const [meeting, setMeeting] = useState<CafeMeeting>({ title: '', meet_url: null, starts_at: null, duration_minutes: 60 });

  useEffect(() => {
    if (site) {
      setNotice(site.login_notice);
      setMeeting(site.cafe_meeting);
    }
  }, [site]);

  const onSaved = (message: string) => () => {
    toast.success(message);
    queryClient.invalidateQueries({ queryKey: ['admin', 'site'] });
    queryClient.invalidateQueries({ queryKey: ['public-site'] });
  };

  const saveNotice = useMutation({
    mutationFn: () => adminSaveLoginNotice({ ...notice, link_label: notice.link_label || null, link_url: notice.link_url || null }),
    onSuccess: onSaved('Recado do login atualizado.'),
    onError: error => toast.error(apiErrorText(error, 'Não foi possível salvar o recado.')),
  });
  const saveMeeting = useMutation({
    mutationFn: () => adminSaveCafeMeeting({ ...meeting, meet_url: meeting.meet_url || null }),
    onSuccess: onSaved('Encontro atualizado.'),
    onError: error => toast.error(apiErrorText(error, 'Não foi possível salvar o encontro.')),
  });

  const exportRsvps = () =>
    downloadSpreadsheet(
      'presencas-cafe-aberto',
      ['Nome', 'E-mail', 'Telefone', 'Encontro', 'Confirmou em'],
      (rsvps ?? []).map(r => [r.name, r.email, r.phone, formatDateTime(r.meeting_starts_at), formatDateTime(r.created_at)])
    );

  return (
    <div className="mx-auto max-w-[1080px]">
      <AdminPageHeader title="Site e encontros" lead="O que muda no site sem precisar de programador." />

      <div className="grid gap-[20px] lg:grid-cols-2">
        <form
          className="cafe-card grid content-start gap-[14px]"
          onSubmit={event => {
            event.preventDefault();
            saveNotice.mutate();
          }}
        >
          <h2 className="cafe-card-heading">Recado da janela de login</h2>
          <p className="cafe-card-subtitle -mt-[8px]">Aparece ao lado do formulário de entrar. Bom para avisos e promoções.</p>
          <label className="cafe-field">
            <span className="cafe-field-label">Título</span>
            <input className="cafe-input" maxLength={80} value={notice.title} onChange={e => setNotice({ ...notice, title: e.target.value })} />
          </label>
          <label className="cafe-field">
            <span className="cafe-field-label">Texto</span>
            <textarea className="cafe-textarea" rows={3} maxLength={280} value={notice.message} onChange={e => setNotice({ ...notice, message: e.target.value })} />
          </label>
          <div className="grid gap-[12px] sm:grid-cols-[1fr_2fr]">
            <label className="cafe-field">
              <span className="cafe-field-label">Texto do link (opcional)</span>
              <input className="cafe-input" maxLength={40} value={notice.link_label ?? ''} onChange={e => setNotice({ ...notice, link_label: e.target.value })} placeholder="Ver planos" />
            </label>
            <label className="cafe-field">
              <span className="cafe-field-label">Endereço do link</span>
              <input className="cafe-input" value={notice.link_url ?? ''} onChange={e => setNotice({ ...notice, link_url: e.target.value })} placeholder="https://" />
            </label>
          </div>
          <div>
            <FolderTabButton type="submit" disabled={saveNotice.isPending}>Salvar recado</FolderTabButton>
          </div>
        </form>

        <form
          className="cafe-card grid content-start gap-[14px]"
          onSubmit={event => {
            event.preventDefault();
            saveMeeting.mutate();
          }}
        >
          <h2 className="cafe-card-heading">Próximo café aberto</h2>
          <p className="cafe-card-subtitle -mt-[8px]">
            {site && <>Próximo: <strong>{formatDateTime(site.next_meeting_starts_at)}</strong>. </>}
            O link só aparece para quem confirma presença na página Agenda.
          </p>
          <label className="cafe-field">
            <span className="cafe-field-label">Nome do encontro</span>
            <input className="cafe-input" maxLength={120} value={meeting.title} onChange={e => setMeeting({ ...meeting, title: e.target.value })} />
          </label>
          <label className="cafe-field">
            <span className="cafe-field-label">Link do Google Meet</span>
            <input className="cafe-input" value={meeting.meet_url ?? ''} onChange={e => setMeeting({ ...meeting, meet_url: e.target.value })} placeholder="https://meet.google.com/…" />
          </label>
          <div className="grid gap-[12px] sm:grid-cols-[2fr_1fr]">
            <label className="cafe-field">
              <span className="cafe-field-label">Data e hora (opcional)</span>
              <input className="cafe-input" type="datetime-local" value={toLocalInput(meeting.starts_at)} onChange={e => setMeeting({ ...meeting, starts_at: fromLocalInput(e.target.value) })} />
              <span className="cafe-field-help">Vazio = última quarta do mês, 14h.</span>
            </label>
            <label className="cafe-field">
              <span className="cafe-field-label">Duração (min)</span>
              <input className="cafe-input" type="number" min={15} max={240} value={meeting.duration_minutes} onChange={e => setMeeting({ ...meeting, duration_minutes: Number(e.target.value) || 60 })} />
            </label>
          </div>
          <div>
            <FolderTabButton type="submit" disabled={saveMeeting.isPending}>Salvar encontro</FolderTabButton>
          </div>
        </form>
      </div>

      <section className="mt-[28px]">
        <div className="mb-[12px] flex flex-wrap items-center justify-between gap-[12px]">
          <h2 className="text-sm font-bold uppercase tracking-[0.11em] text-muted-foreground">
            Presenças confirmadas {rsvps ? `(${rsvps.length})` : ''}
          </h2>
          {rsvps && rsvps.length > 0 && (
            <button type="button" className="cafe-button cafe-button-secondary cafe-button-sm" onClick={exportRsvps}>
              <CafeIcon name="relatorio" className="size-[16px]" /> Baixar para Excel
            </button>
          )}
        </div>
        {rsvps && rsvps.length === 0 && (
          <p className="rounded-lg border border-dashed border-input bg-card p-[20px] text-muted-foreground">Ninguém confirmou ainda.</p>
        )}
        {rsvps && rsvps.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Presenças confirmadas</caption>
              <thead className="bg-muted text-xs uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-[14px] py-[10px]">Nome</th>
                  <th scope="col" className="px-[14px] py-[10px]">Contato</th>
                  <th scope="col" className="px-[14px] py-[10px]">Encontro</th>
                  <th scope="col" className="px-[14px] py-[10px]">Confirmou em</th>
                </tr>
              </thead>
              <tbody>
                {rsvps.map(r => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-[14px] py-[10px] font-semibold text-foreground">{r.name}</td>
                    <td className="px-[14px] py-[10px] text-muted-foreground">{[r.email, r.phone].filter(Boolean).join(' · ')}</td>
                    <td className="whitespace-nowrap px-[14px] py-[10px] text-muted-foreground">{formatDateTime(r.meeting_starts_at)}</td>
                    <td className="whitespace-nowrap px-[14px] py-[10px] text-muted-foreground">{formatDateTime(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
