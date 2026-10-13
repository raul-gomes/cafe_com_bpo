import React, { useState } from 'react';
import { confirmCafePresence } from '../../api/platform';
import type { CafeRsvpAccepted } from '../../schemas/platform';
import { CafeIcon } from '../../brand/CafeIcon';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { useNextCafe } from './useNextCafe';

/** Google Calendar dates are written as UTC "YYYYMMDDTHHMMSSZ". */
function calendarStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Link that opens Google Calendar with the meeting filled in, ready to save.
 *
 * @param meeting Title, start, duration and (when known) the Meet link.
 * @returns The Google Calendar URL.
 */
function googleCalendarUrl(meeting: Pick<CafeRsvpAccepted, 'title' | 'starts_at' | 'duration_minutes' | 'meet_url'>): string {
  const start = new Date(meeting.starts_at);
  const end = new Date(start.getTime() + meeting.duration_minutes * 60_000);
  const details = meeting.meet_url
    ? `Link do encontro: ${meeting.meet_url}\n\nCafé com BPO · https://cafecombpo.cloud/cafes`
    : 'O link do encontro chega pelo canal do Café com BPO antes do horário.\n\nhttps://cafecombpo.cloud/cafes';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: meeting.title,
    dates: `${calendarStamp(start)}/${calendarStamp(end)}`,
    details,
    location: meeting.meet_url ?? 'Google Meet',
    ctz: 'America/Sao_Paulo',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** "Quarta-feira, 28 de outubro, 14:00" — Brasília time, first letter up. */
function formatMeeting(iso: string): string {
  const text = new Date(iso).toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Strip of the agenda page: the next open café, with "confirm presence". The
 * person leaves a name and the contact they prefer (e-mail, phone or both);
 * after confirming they get the Meet link (once the team has set it in Admin)
 * and a button that saves the meeting in their own Google Calendar.
 *
 * @returns The strip and its dialog.
 */
export const CafeRsvpStrip: React.FC = () => {
  const next = useNextCafe();
  const startsAt = next.startsAt.toISOString();
  const title = next.title;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmed, setConfirmed] = useState<CafeRsvpAccepted | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError('Conta pra gente como você se chama.');
    if (!email.trim() && !phone.trim()) return setError('Deixe um e-mail ou um telefone, o que preferir.');
    setSending(true);
    try {
      setConfirmed(await confirmCafePresence({ name, email: email || undefined, phone: phone || undefined, website: website || undefined }));
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 429 ? 'Muitas tentativas. Espere um minuto e tente de novo.' : 'Confira o e-mail ou o telefone (com DDD) e tente de novo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="hb-rsvp-strip" role="region" aria-label="Próximo café aberto">
        <span className="hb-rsvp-icon"><CafeIcon name="encontro" /></span>
        <div className="hb-rsvp-text">
          <p className="hb-rsvp-kicker">Participe do próximo</p>
          <p className="hb-rsvp-when">{title} · <strong>{formatMeeting(startsAt)}</strong> · Google Meet</p>
        </div>
        <button type="button" className="cafe-command cafe-command-tab hb-cta" onClick={() => setOpen(true)}>
          Confirmar presença e obter o link
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:!max-w-[460px]">
          {confirmed ? (
            <div className="grid gap-[14px]">
              <DialogHeader>
                <DialogTitle>Presença confirmada. Até lá!</DialogTitle>
                <DialogDescription>{confirmed.title} · {formatMeeting(confirmed.starts_at)}</DialogDescription>
              </DialogHeader>
              {confirmed.meet_url ? (
                <p className="text-sm text-foreground">
                  Link do encontro:{' '}
                  <a href={confirmed.meet_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-strong break-all">
                    {confirmed.meet_url}
                  </a>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Assim que o link do Meet estiver pronto, disponibilizaremos para você pelo contato que deixou.
                </p>
              )}
              <a href={googleCalendarUrl(confirmed)} target="_blank" rel="noopener noreferrer" className="cafe-button cafe-button-primary no-underline">
                <CafeIcon name="tempo" className="size-[18px]" /> Salvar na minha agenda Google
              </a>
            </div>
          ) : (
            <form className="grid gap-[14px]" onSubmit={submit} noValidate>
              <DialogHeader>
                <DialogTitle>Confirme sua presença</DialogTitle>
                <DialogDescription>Deixe o contato que preferir: e-mail, telefone ou os dois.</DialogDescription>
              </DialogHeader>
              <label className="cafe-field">
                <span className="cafe-field-label">Nome</span>
                <input className="cafe-input" value={name} maxLength={120} onChange={e => setName(e.target.value)} autoComplete="name" />
              </label>
              <label className="cafe-field">
                <span className="cafe-field-label">E-mail</span>
                <input className="cafe-input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </label>
              <label className="cafe-field">
                <span className="cafe-field-label">Telefone / WhatsApp</span>
                <input className="cafe-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="(11) 98765-4321" />
              </label>
              {/* Honeypot: hidden from people, filled by bots. */}
              <div className="hb-trap" aria-hidden="true">
                <input tabIndex={-1} value={website} onChange={e => setWebsite(e.target.value)} autoComplete="off" />
              </div>
              {error && <p className="cafe-field-error" role="alert">{error}</p>}
              <p className="text-xs text-muted-foreground">Usamos seu contato só para avisar sobre este encontro.</p>
              <button type="submit" className="cafe-button cafe-button-primary" disabled={sending}>
                {sending ? 'Confirmando…' : 'Confirmar presença'}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
