import React, { useState } from 'react';
import { isAxiosError } from 'axios';
import { createBetaSignup, type BetaClientRange, type BetaProfile } from '../../api/beta';
import { CafeIcon } from '../../brand/CafeIcon';

/** Profile options, in the words the landing page shows. */
// eslint-disable-next-line react-refresh/only-export-components
export const PROFILE_LABELS: Record<BetaProfile, string> = {
  starting: 'Estou começando no BPO financeiro',
  growing: 'Já tenho clientes e estou crescendo',
  accounting_office: 'Tenho escritório de contabilidade',
  other: 'Outro',
};

/** Client range options, in the words the landing page shows. */
// eslint-disable-next-line react-refresh/only-export-components
export const CLIENT_RANGE_LABELS: Record<BetaClientRange, string> = {
  '0': 'Nenhum ainda',
  '1-5': '1 a 5',
  '6-15': '6 a 15',
  '16-30': '16 a 30',
  '30+': 'Mais de 30',
};

type Status = 'idle' | 'sending' | 'done' | 'error';

/**
 * Beta signup form of the landing page (public `POST /beta/signups`).
 *
 * @returns The form, or the thank-you note once sent.
 */
export const BetaSignupForm: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [profile, setProfile] = useState<BetaProfile | ''>('');
  const [clientRange, setClientRange] = useState<BetaClientRange | ''>('');
  const [challenge, setChallenge] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const valid =
    name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email) && profile !== '' && clientRange !== '' && consent;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || status === 'sending') return;
    setStatus('sending');
    setError(null);
    try {
      await createBetaSignup({
        name: name.trim(),
        email: email.trim(),
        whatsapp: whatsapp.trim() || undefined,
        profile: profile as BetaProfile,
        client_range: clientRange as BetaClientRange,
        challenge: challenge.trim() || undefined,
        source: 'home',
        lgpd_consent: consent,
        website: website || undefined,
      });
      setStatus('done');
    } catch (caught) {
      setStatus('error');
      if (isAxiosError(caught) && caught.response?.status === 429) {
        setError('Muitas tentativas seguidas. Espere um minuto e tente de novo.');
      } else if (isAxiosError(caught) && caught.response?.status === 422) {
        setError('Confira os dados: e-mail válido e WhatsApp com DDD.');
      } else {
        setError('Não conseguimos enviar agora. Tente de novo em instantes.');
      }
    }
  };

  if (status === 'done') {
    return (
      <div className="hb-form hb-form-done" role="status">
        <span className="hb-card-icon"><CafeIcon name="xicara" /></span>
        <h3>Inscrição recebida.</h3>
        <p>Obrigado por querer construir com a gente. Em breve chamamos você para um café.</p>
      </div>
    );
  }

  return (
    <form className="hb-form" onSubmit={submit} noValidate>
      <div className="hb-field">
        <label htmlFor="beta-name">Nome</label>
        <input id="beta-name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={120} required />
      </div>
      <div className="hb-field-row">
        <div className="hb-field">
          <label htmlFor="beta-email">E-mail</label>
          <input id="beta-email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" maxLength={255} required />
        </div>
        <div className="hb-field">
          <label htmlFor="beta-whatsapp">WhatsApp <span>(opcional)</span></label>
          <input id="beta-whatsapp" type="tel" inputMode="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} autoComplete="tel" placeholder="(11) 90000-0000" maxLength={30} />
        </div>
      </div>
      <div className="hb-field">
        <label htmlFor="beta-profile">Como você atua hoje</label>
        <select id="beta-profile" value={profile} onChange={e => setProfile(e.target.value as BetaProfile)} required>
          <option value="" disabled>Escolha uma opção</option>
          {(Object.keys(PROFILE_LABELS) as BetaProfile[]).map(value => (
            <option key={value} value={value}>{PROFILE_LABELS[value]}</option>
          ))}
        </select>
      </div>
      <div className="hb-field">
        <span className="hb-field-label" id="beta-range-label">Quantos clientes você atende</span>
        <div className="hb-chips" role="radiogroup" aria-labelledby="beta-range-label">
          {(Object.keys(CLIENT_RANGE_LABELS) as BetaClientRange[]).map(value => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={clientRange === value}
              onClick={() => setClientRange(value)}
              className="hb-chip"
            >
              {CLIENT_RANGE_LABELS[value]}
            </button>
          ))}
        </div>
      </div>
      <div className="hb-field">
        <label htmlFor="beta-challenge">O que você mais quer resolver <span>(opcional)</span></label>
        <textarea id="beta-challenge" value={challenge} onChange={e => setChallenge(e.target.value)} rows={3} maxLength={1000} placeholder="Ex.: perco tempo demais no fechamento do dia 10" />
      </div>

      {/* Bot trap: off-screen and out of the tab order; people never see it. */}
      <div className="hb-trap" aria-hidden="true">
        <label htmlFor="beta-website">Site</label>
        <input id="beta-website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
      </div>

      <label className="hb-consent">
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <span>
          Autorizo o Café com BPO a usar estes dados para me convidar e falar comigo sobre o programa Beta (LGPD).
          Posso pedir a exclusão a qualquer momento.
        </span>
      </label>

      {error && <p className="hb-form-error" role="alert">{error}</p>}

      <button
        type="submit"
        className="cafe-command cafe-command-tab hb-cta hb-submit"
        disabled={!valid || status === 'sending'}
        aria-busy={status === 'sending' || undefined}
      >
        <CafeIcon name="assinatura" />
        <span>{status === 'sending' ? 'Enviando…' : 'Quero ser Beta'}</span>
      </button>
    </form>
  );
};
