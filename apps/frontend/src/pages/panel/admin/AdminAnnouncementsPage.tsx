import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminDeleteAnnouncement, adminListAnnouncements, adminSendAnnouncement } from '../../../api/platform';
import type { Audience } from '../../../schemas/platform';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader';
import { FolderTabButton } from '../../../components/ui/folder-tab-button';
import { apiErrorText, formatDateTime } from '../../../lib/adminFormat';
import { useConfirm } from '../../../components/ui/ConfirmDialog';

const AUDIENCE_LABELS: Record<Audience, string> = {
  all: 'Todos os usuários',
  paying: 'Só quem assina',
  free: 'Só quem não assina (gratuito, beta, cortesia)',
};

/**
 * Admin › Mensagens: sends a message to the notification bell of the chosen
 * audience and, optionally, as a post-it on everyone's home panel.
 *
 * @returns The page.
 */
export const AdminAnnouncementsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: announcements } = useQuery({ queryKey: ['admin', 'announcements'], queryFn: adminListAnnouncements });

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [showOnHome, setShowOnHome] = useState(true);
  const [expiresOn, setExpiresOn] = useState('');

  const send = useMutation({
    mutationFn: () =>
      adminSendAnnouncement({
        title,
        message,
        audience,
        show_on_home: showOnHome,
        // End of the chosen day, Brasília time.
        expires_at: expiresOn ? new Date(`${expiresOn}T23:59:59-03:00`).toISOString() : null,
      }),
    onSuccess: sent => {
      toast.success(`Mensagem enviada para ${sent.recipients_count} ${sent.recipients_count === 1 ? 'pessoa' : 'pessoas'}.`);
      setTitle('');
      setMessage('');
      setExpiresOn('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: error => toast.error(apiErrorText(error, 'Não foi possível enviar a mensagem.')),
  });

  const remove = useMutation({
    mutationFn: adminDeleteAnnouncement,
    onSuccess: () => {
      toast.success('Mensagem retirada.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  const onWithdraw = async (id: string) => {
    const ok = await confirm({
      title: 'Retirar esta mensagem?',
      message: 'Ela some do sininho de quem recebeu e do post-it da tela inicial.',
      confirmLabel: 'Retirar',
      cancelLabel: 'Manter',
      variant: 'danger',
    });
    if (ok) remove.mutate(id);
  };

  const canSend = title.trim().length >= 2 && message.trim().length >= 2 && !send.isPending;

  return (
    <div className="mx-auto max-w-[1080px]">
      <AdminPageHeader
        title="Mensagens"
        lead="Um aviso que chega no sininho de cada pessoa. Marque “post-it” para ele ficar também na tela inicial até a data que você escolher."
      />

      <form
        className="cafe-card mb-[28px] grid gap-[16px]"
        onSubmit={event => {
          event.preventDefault();
          if (canSend) send.mutate();
        }}
      >
        <label className="cafe-field">
          <span className="cafe-field-label">Título</span>
          <input className="cafe-input" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Café aberto nesta quarta" />
        </label>
        <label className="cafe-field">
          <span className="cafe-field-label">Mensagem</span>
          <textarea className="cafe-textarea" rows={4} value={message} maxLength={1000} onChange={e => setMessage(e.target.value)} placeholder="O que você quer que todos saibam?" />
          <span className="cafe-field-help">{message.length}/1000</span>
        </label>
        <div className="grid gap-[16px] sm:grid-cols-2">
          <label className="cafe-field">
            <span className="cafe-field-label">Para quem</span>
            <select className="cafe-select" value={audience} onChange={e => setAudience(e.target.value as Audience)}>
              {(Object.keys(AUDIENCE_LABELS) as Audience[]).map(key => (
                <option key={key} value={key}>{AUDIENCE_LABELS[key]}</option>
              ))}
            </select>
          </label>
          <label className="cafe-field">
            <span className="cafe-field-label">Post-it some em (opcional)</span>
            <input className="cafe-input" type="date" value={expiresOn} onChange={e => setExpiresOn(e.target.value)} />
          </label>
        </div>
        <label className="flex items-center gap-[10px] text-sm text-foreground">
          <input type="checkbox" checked={showOnHome} onChange={e => setShowOnHome(e.target.checked)} />
          Mostrar como post-it na tela inicial
        </label>
        <div>
          <FolderTabButton type="submit" disabled={!canSend}>
            {send.isPending ? 'Enviando…' : 'Enviar mensagem'}
          </FolderTabButton>
        </div>
      </form>

      <h2 className="mb-[12px] text-sm font-bold uppercase tracking-[0.11em] text-muted-foreground">Enviadas</h2>
      {announcements && announcements.length === 0 && (
        <p className="rounded-lg border border-dashed border-input bg-card p-[20px] text-muted-foreground">Nenhuma mensagem enviada ainda.</p>
      )}
      <ul className="grid gap-[12px]">
        {announcements?.map(item => (
          <li key={item.id} className="cafe-card flex flex-wrap items-start justify-between gap-[12px]">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">{item.title}</p>
              <p className="mt-[4px] whitespace-pre-line text-sm text-muted-foreground">{item.message}</p>
              <p className="mt-[8px] flex flex-wrap gap-[6px] text-xs">
                <span className="cafe-tag cafe-tag-module">{AUDIENCE_LABELS[item.audience as Audience] ?? item.audience}</span>
                <span className="cafe-tag">{item.recipients_count} {item.recipients_count === 1 ? 'pessoa' : 'pessoas'}</span>
                {item.show_on_home && <span className="cafe-tag">Post-it{item.expires_at ? ` até ${new Date(item.expires_at).toLocaleDateString('pt-BR')}` : ''}</span>}
                <span className="cafe-tag">{formatDateTime(item.created_at)}</span>
              </p>
            </div>
            <button type="button" className="cafe-button cafe-button-secondary cafe-button-sm" onClick={() => onWithdraw(item.id)}>
              Retirar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
