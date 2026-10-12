import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { listBetaSignups } from '../../api/beta';
import { CLIENT_RANGE_LABELS, PROFILE_LABELS } from '../../components/home/BetaSignupForm';
import type { BetaClientRange, BetaProfile } from '../../schemas/beta';

/**
 * Admin › Inscrições Beta: the waiting list collected by the landing page.
 *
 * @returns The page.
 */
export const BetaSignupsPage: React.FC = () => {
  const { data: signups, isLoading, isError } = useQuery({ queryKey: ['beta-signups'], queryFn: listBetaSignups });

  return (
    <div className="mx-auto max-w-[1180px]">
      <header className="mb-[24px]">
        <p className="text-xs font-bold uppercase tracking-[0.11em] text-module">Admin</p>
        <h1 className="mt-[6px] font-editorial text-[2.25rem] font-medium leading-tight tracking-[-0.02em] text-foreground">
          Inscrições Beta
        </h1>
        <p className="mt-[6px] text-[0.9375rem] text-muted-foreground">
          Quem se inscreveu pela página inicial, das mais recentes para as mais antigas.
          {signups && ` ${signups.length} ${signups.length === 1 ? 'inscrição' : 'inscrições'}.`}
        </p>
      </header>

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
