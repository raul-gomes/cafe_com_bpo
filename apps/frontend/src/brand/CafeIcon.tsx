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
  | 'pausa-cafe' | 'conversa-cafe'
  /* Extensões do app (fora do sprite V4), no mesmo desenho: matriz 24, traço 1,6, abertura no traço. */
  | 'coracao' | 'aula';

const SPRITE = '/brand/kit-v4/icones-assinatura.svg';

const EXTENSIONS: Partial<Record<CafeIconName, string>> = {
  // Coração do "Colabore": o traço não fecha na ponta direita (gesto de abertura da família).
  coracao: 'M12 20s-8-4.6-8-10.4A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 8 2.4c0 2.6-1.6 4.9-3.5 6.8',
  // Aulas: tela com play; a borda abre no canto superior direito, base da tela embaixo.
  aula: 'M15 5H4v12h16V9M10 8.8l4.5 2.7-4.5 2.7zM8 20.5h8',
};

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
    {EXTENSIONS[name] ? <path d={EXTENSIONS[name]} /> : <use href={`${SPRITE}#${name}`} />}
  </svg>
);
