import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { listBetaSignups, type BetaSignup } from '../../api/beta';
import { CafeIcon } from '../../brand/CafeIcon';
import { CLIENT_RANGE_LABELS, PROFILE_LABELS } from '../../components/home/BetaSignupForm';
import type { BetaClientRange, BetaProfile } from '../../schemas/beta';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { formatDay } from '../../lib/adminFormat';
import { downloadSpreadsheet } from '../../lib/spreadsheet';

/** Downloads every signup as a spreadsheet Excel opens. */
function exportSignups(signups: BetaSignup[]): void {
  downloadSpreadsheet(
    'inscricoes-beta-cafe-com-bpo',
    ['Nome', 'E-mail', 'WhatsApp', 'Como atua', 'Clientes', 'Quer resolver', 'Data'],
    signups.map(s => [
      s.name,
      s.email,
      s.whatsapp,
      PROFILE_LABELS[s.profile as BetaProfile] ?? s.profile,
      CLIENT_RANGE_LABELS[s.client_range as BetaClientRange] ?? s.client_range,
      s.challenge,
      formatDay(s.signed_up_at),
    ])
  );
}

/**
 * Admin › Inscrições Beta: the waiting list collected by the landing page.
 *
 * @returns The page.
 */
export const BetaSignupsPage: React.FC = () => {
  const { data: signups, isLoading, isError } = useQuery({ queryKey: ['beta-signups'], queryFn: listBetaSignups });

  return (
    <div className="mx-auto max-w-[1180px]">
      <AdminPageHeader
        title="Inscrições Beta"
        lead={
          <>
            Respostas do formulário “Quero ser Beta” do site, das mais recentes para as mais antigas.
            {signups && ` ${signups.length} ${signups.length === 1 ? 'inscrição' : 'inscrições'}.`}
          </>
        }
        actions={
          signups && signups.length > 0 && (
            <button type="button" className="cafe-button cafe-button-secondary cafe-button-sm" onClick={() => exportSignups(signups)}>
              <CafeIcon name="relatorio" className="size-[16px]" /> Baixar para Excel
            </button>
          )
        }
      />

      {isLoading && <p className="text-muted-foreground">Carregando inscrições…</p>}
      {isError && <p role="alert" className="text-destructive">Não foi possível carregar as inscrições.</p>}
      {signups && signups.length === 0 && (
        <p className="rounded-lg border border-dashed border-input bg-card p-[24px] text-muted-foreground">
          Nenhuma inscrição ainda. Quando alguém preencher o formulário da página inicial, aparece aqui.
        </p>
      )}

      {signups && signups.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Inscrições Beta</caption>
            <thead className="bg-muted text-xs uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-[14px] py-[10px]">Nome</th>
                <th scope="col" className="px-[14px] py-[10px]">Contato</th>
                <th scope="col" className="px-[14px] py-[10px]">Como atua</th>
                <th scope="col" className="px-[14px] py-[10px]">Clientes</th>
                <th scope="col" className="px-[14px] py-[10px]">Quer resolver</th>
                <th scope="col" className="px-[14px] py-[10px]">Data</th>
              </tr>
            </thead>
            <tbody>
              {signups.map(signup => (
                <tr key={signup.email} className="border-t border-border align-top">
                  <td className="px-[14px] py-[12px] font-semibold text-foreground">{signup.name}</td>
                  <td className="px-[14px] py-[12px]">
                    <a href={`mailto:${signup.email}`} className="text-primary-strong">{signup.email}</a>
                    {signup.whatsapp && <div className="text-muted-foreground">{signup.whatsapp}</div>}
                  </td>
                  <td className="px-[14px] py-[12px]">{PROFILE_LABELS[signup.profile as BetaProfile] ?? signup.profile}</td>
                  <td className="px-[14px] py-[12px] whitespace-nowrap">{CLIENT_RANGE_LABELS[signup.client_range as BetaClientRange] ?? signup.client_range}</td>
                  <td className="max-w-[320px] px-[14px] py-[12px] text-muted-foreground">{signup.challenge ?? '—'}</td>
                  <td className="px-[14px] py-[12px] whitespace-nowrap text-muted-foreground">
                    {new Date(signup.signed_up_at).toLocaleDateString('pt-BR')}
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
