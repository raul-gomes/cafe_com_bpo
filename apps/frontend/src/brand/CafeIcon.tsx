import React from 'react';
import { cn } from '../lib/utils';

/** Nomes do sprite `icones-assinatura.svg` do kit V4 (ver icones-manifesto.json). */
export type CafeIconName =
  | 'contrato' | 'nota' | 'pessoas' | 'rotina' | 'negocios' | 'direcao' | 'excluir'
  | 'processo' | 'inicio' | 'painel' | 'carteira' | 'saldo' | 'transferencia'
  | 'conciliacao' | 'contas' | 'recebimentos' | 'pagamentos' | 'banco' | 'cartao'
  | 'grafico' | 'relatorio' | 'proposta' | 'assinatura' | 'arquivo' | 'pasta' | 'anexo'
  | 'pesquisa' | 'filtro' | 'ajustes' | 'adicionar' | 'fechar' | 'voltar' | 'expandir'
  | 'recolher' | 'notificacoes' | 'seguranca' | 'suporte' | 'mensagem' | 'encontro'
  | 'tempo' | 'favorito' | 'sair' | 'xicara' | 'grao' | 'vapor' | 'coador'
  | 'pausa-cafe' | 'conversa-cafe';

const SPRITE = '/brand/kit-v4/icones-assinatura.svg';

interface CafeIconProps {
  name: CafeIconName;
  className?: string;
  /** Sem rótulo o ícone é decorativo; controles só com ícone precisam de nome no botão. */
  label?: string;
}

/** Ícone do kit: matriz 24, traço 1,6, cor herdada do texto. */
export const CafeIcon: React.FC<CafeIconProps> = ({ name, className, label }) => (
  <svg
    // Medida explícita: a escala de espaçamento do tailwind.config deste app é própria (size-5 = 36px).
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
    <use href={`${SPRITE}#${name}`} />
  </svg>
);
