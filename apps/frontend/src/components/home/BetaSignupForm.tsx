import React, { useState } from 'react';
import { isAxiosError } from 'axios';
import { createBetaSignup, type BetaFaixaClientes, type BetaPerfil } from '../../api/beta';
import { CafeIcon } from '../../brand/CafeIcon';

const PERFIS: { value: BetaPerfil; label: string }[] = [
  { value: 'comecando', label: 'Estou começando no BPO financeiro' },
  { value: 'crescendo', label: 'Já tenho clientes e estou crescendo' },
  { value: 'escritorio_contabil', label: 'Tenho escritório de contabilidade' },
  { value: 'outro', label: 'Outro' },
];

const FAIXAS: { value: BetaFaixaClientes; label: string }[] = [
  { value: '0', label: 'Nenhum ainda' },
  { value: '1-5', label: '1 a 5' },
  { value: '6-15', label: '6 a 15' },
  { value: '16-30', label: '16 a 30' },
  { value: '30+', label: 'Mais de 30' },
];

type Status = 'idle' | 'sending' | 'done' | 'error';

/** Formulário de inscrição Beta da página inicial (POST público /beta/inscricoes). */
export const BetaSignupForm: React.FC = () => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [perfil, setPerfil] = useState<BetaPerfil | ''>('');
  const [faixa, setFaixa] = useState<BetaFaixaClientes | ''>('');
  const [desafio, setDesafio] = useState('');
  const [consentimento, setConsentimento] = useState(false);
  const [website, setWebsite] = useState(''); // campo-armadilha
  const [status, setStatus] = useState<Status>('idle');
  const [erro, setErro] = useState<string | null>(null);

  const valido =
    nome.trim().length >= 2 && /\S+@\S+\.\S+/.test(email) && perfil !== '' && faixa !== '' && consentimento;

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valido || status === 'sending') return;
    setStatus('sending');
    setErro(null);
    try {
      await createBetaSignup({
        nome: nome.trim(),
        email: email.trim(),
        whatsapp: whatsapp.trim() || undefined,
        perfil: perfil as BetaPerfil,
        faixa_clientes: faixa as BetaFaixaClientes,
        desafio: desafio.trim() || undefined,
        origem: 'home',
        consentimento_lgpd: consentimento,
        website: website || undefined,
      });
      setStatus('done');
    } catch (error) {
      setStatus('error');
      if (isAxiosError(error) && error.response?.status === 429) {
        setErro('Muitas tentativas seguidas. Espere um minuto e tente de novo.');
      } else if (isAxiosError(error) && error.response?.status === 422) {
        setErro('Confira os dados: e-mail válido e WhatsApp com DDD.');
      } else {
        setErro('Não conseguimos enviar agora. Tente de novo em instantes.');
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
    <form className="hb-form" onSubmit={enviar} noValidate>
      <div className="hb-field">
        <label htmlFor="beta-nome">Nome</label>
        <input id="beta-nome" value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" maxLength={120} required />
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
        <label htmlFor="beta-perfil">Como você atua hoje</label>
        <select id="beta-perfil" value={perfil} onChange={e => setPerfil(e.target.value as BetaPerfil)} required>
          <option value="" disabled>Escolha uma opção</option>
          {PERFIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      <div className="hb-field">
        <span className="hb-field-label" id="beta-faixa-label">Quantos clientes você atende</span>
        <div className="hb-chips" role="radiogroup" aria-labelledby="beta-faixa-label">
          {FAIXAS.map(f => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={faixa === f.value}
              onClick={() => setFaixa(f.value)}
              className="hb-chip"
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="hb-field">
        <label htmlFor="beta-desafio">O que você mais quer resolver <span>(opcional)</span></label>
        <textarea id="beta-desafio" value={desafio} onChange={e => setDesafio(e.target.value)} rows={3} maxLength={1000} placeholder="Ex.: perco tempo demais no fechamento do dia 10" />
      </div>

      {/* Armadilha para robôs: fora da tela e fora do Tab; pessoas não veem. */}
      <div className="hb-trap" aria-hidden="true">
        <label htmlFor="beta-website">Site</label>
        <input id="beta-website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
      </div>

      <label className="hb-consent">
        <input type="checkbox" checked={consentimento} onChange={e => setConsentimento(e.target.checked)} />
        <span>
          Autorizo o Café com BPO a usar estes dados para me convidar e falar comigo sobre o programa Beta (LGPD).
          Posso pedir a exclusão a qualquer momento.
        </span>
      </label>

      {erro && <p className="hb-form-error" role="alert">{erro}</p>}

      <button
        type="submit"
        className="cafe-command cafe-command-tab hb-cta hb-submit"
        disabled={!valido || status === 'sending'}
        aria-busy={status === 'sending' || undefined}
      >
        <CafeIcon name="assinatura" />
        <span>{status === 'sending' ? 'Enviando…' : 'Quero ser Beta'}</span>
      </button>
    </form>
  );
};
