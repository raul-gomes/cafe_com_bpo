import React from 'react';
import { cn } from '../lib/utils';

/** Names of the V4 kit sprite `icones-assinatura.svg` (see icones-manifesto.json). */
export type CafeIconName =
  | 'contrato' | 'nota' | 'pessoas' | 'rotina' | 'negocios' | 'direcao' | 'excluir'
  | 'processo' | 'inicio' | 'painel' | 'carteira' | 'saldo' | 'transferencia'
  | 'conciliacao' | 'contas' | 'recebimentos' | 'pagamentos' | 'banco' | 'cartao'
  | 'grafico' | 'relatorio' | 'proposta' | 'assinatura' | 'arquivo' | 'pasta' | 'anexo'
  | 'pesquisa' | 'filtro' | 'ajustes' | 'adicionar' | 'fechar' | 'voltar' | 'expandir'
  | 'recolher' | 'notificacoes' | 'seguranca' | 'suporte' | 'mensagem' | 'encontro'
  | 'tempo' | 'favorito' | 'sair' | 'xicara' | 'grao' | 'vapor' | 'coador'
  | 'pausa-cafe' | 'conversa-cafe'
  /* App extensions (outside the V4 sprite), same drawing: 24 grid, 1.6 stroke, opening in the stroke. */
  | 'coracao' | 'aula';

const SPRITE = '/brand/kit-v4/icones-assinatura.svg';

const EXTENSIONS: Partial<Record<CafeIconName, string>> = {
  // "Colabore" heart: the stroke stays open at the right end (the family's opening gesture).
  coracao: 'M12 20s-8-4.6-8-10.4A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 8 2.4c0 2.6-1.6 4.9-3.5 6.8',
  // Aulas: screen with a play mark; the border opens at the top-right corner, stand below.
  aula: 'M15 5H4v12h16V9M10 8.8l4.5 2.7-4.5 2.7zM8 20.5h8',
};

interface CafeIconProps {
  name: CafeIconName;
  className?: string;
  /** Without a label the icon is decorative; icon-only controls need a name on the button. */
  label?: string;
}

/**
 * Kit icon: 24 grid, 1.6 stroke, color inherited from the text.
 *
 * @returns The SVG icon.
 */
export const CafeIcon: React.FC<CafeIconProps> = ({ name, className, label }) => (
  <svg
    // Explicit size: this app's tailwind.config has its own spacing scale (size-5 = 36px).
    className={cn('size-[20px] shrink-0', className)}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    focusable="false"
  >
    {EXTENSIONS[name] ? <path d={EXTENSIONS[name]} /> : <use href={`${SPRITE}#${name}`} />}
  </svg>
);
