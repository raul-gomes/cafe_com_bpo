import React from 'react';

interface AdminPageHeaderProps {
  title: string;
  lead: React.ReactNode;
  /** Buttons on the right (e.g. "Baixar para Excel"). */
  actions?: React.ReactNode;
}

/**
 * Header shared by the Admin pages: module kicker, title, one line of context.
 *
 * @returns The header.
 */
export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({ title, lead, actions }) => (
  <header className="mb-[24px] flex flex-wrap items-end justify-between gap-[16px]">
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-[0.11em] text-module">Admin</p>
      <h1 className="mt-[6px] font-editorial text-[2.25rem] font-medium leading-tight tracking-[-0.02em] text-foreground">
        {title}
      </h1>
      <p className="mt-[6px] max-w-[70ch] text-[0.9375rem] text-muted-foreground">{lead}</p>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-[8px]">{actions}</div>}
  </header>
);
