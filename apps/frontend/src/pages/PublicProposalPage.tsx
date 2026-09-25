import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Navbar } from '../components/ui/Navbar';
import { Button } from '../components/ui/button';
import { ProposalPreview } from '../components/proposal/ProposalPreview';
import { PricingFormData } from '../schemas/pricing';
import { PricingResult } from '../lib/pricingEngine';
import {
  getPublicProposal,
  submitClientDecision,
  ClientDecision,
  PublicProposal,
  CLIENT_DECISION_LABELS,
} from '../api/proposals';
import { toast } from 'sonner';

const DECISION_OPTIONS: { value: ClientDecision; label: string }[] = [
  { value: 'approved', label: 'Aprovado' },
  { value: 'changes', label: 'Com alterações' },
  { value: 'rejected', label: 'Reprovado' },
];

export const PublicProposalPage: React.FC = () => {
  const { hash } = useParams<{ hash: string }>();
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [decision, setDecision] = useState<ClientDecision | null>(null);
  const [observation, setObservation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!hash) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    getPublicProposal(hash)
      .then(data => {
        setProposal(data);
        setDecision(data.client_decision);
        setObservation(data.client_observation || '');
        if (data.client_decision) setSubmitted(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [hash]);

  const handleSubmit = async () => {
    if (!proposal || !decision) return;
    try {
      setSubmitting(true);
      const updated = await submitClientDecision(hash!, decision, observation || null);
      setProposal(updated);
      setSubmitted(true);
      toast.success('Parecer enviado com sucesso! Obrigado pela avaliação.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Não foi possível enviar seu parecer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeDecision = () => {
    setSubmitted(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto flex max-w-[1024px] items-center justify-center px-5 py-24">
          <span className="text-muted-foreground">Carregando orçamento...</span>
        </div>
      </div>
    );
  }

  if (notFound || !proposal) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto flex max-w-[1024px] flex-col items-center justify-center gap-4 px-5 py-24 text-center">
          <h2 className="text-[22px] font-bold text-foreground">Link inválido ou expirado</h2>
          <p className="text-[14px] text-muted-foreground">
            Este link de orçamento não é válido ou já expirou (24 horas). Solicite um novo link
            ao responsável pelo Café com BPO.
          </p>
        </div>
      </div>
    );
  }

  const generatedAt = new Date(proposal.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-[1024px] px-5 py-10">
        {/* Painel de parecer */}
        <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-[18px] font-bold text-foreground">
            Seu orçamento está pronto!
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Revise os detalhes abaixo e informe seu parecer para{' '}
            <span className="font-semibold text-foreground">{proposal.client_name}</span>.
          </p>

          {submitted && proposal.client_decision ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="text-[14px] font-bold text-emerald-700 dark:text-emerald-400">
                Parecer registrado: {CLIENT_DECISION_LABELS[proposal.client_decision]}
              </p>
              {proposal.client_observation && (
                <p className="mt-1 text-[13px] text-emerald-800 dark:text-emerald-300">
                  Observação: {proposal.client_observation}
                </p>
              )}
              <Button variant="outline" size="sm" className="mt-3" onClick={handleChangeDecision}>
                Alterar meu parecer
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                {DECISION_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDecision(option.value)}
                    aria-pressed={decision === option.value}
                    className={`flex-1 rounded-xl border px-4 py-3 text-[14px] font-semibold transition-colors ${
                      decision === option.value
                        ? 'border-primary bg-primary/10 text-primary-strong'
                        : 'border-border bg-background text-foreground hover:border-primary/50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <textarea
                value={observation}
                onChange={e => setObservation(e.target.value)}
                placeholder="Observações (opcional) — ex.: solicitar alteração de escopo, valores, prazo..."
                maxLength={2000}
                aria-label="Observação sobre o orçamento"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-[13px] text-foreground outline-none transition-colors focus:border-primary"
                rows={3}
              />

              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-muted-foreground">
                  O link expira em 24 horas a partir do envio.
                </span>
                <Button onClick={handleSubmit} disabled={!decision || submitting}>
                  {submitting ? 'Enviando...' : 'Enviar parecer'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Proposta renderizada */}
        <ProposalPreview
          form={proposal.input_payload as PricingFormData}
          pricing={proposal.result_payload as PricingResult}
          clientName={proposal.client_name}
          generatedAt={generatedAt}
          hideDownload
        />
      </div>
    </div>
  );
};

export default PublicProposalPage;