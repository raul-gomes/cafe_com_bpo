import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface MemberLinkProps {
  memberId?: string | null;
  name?: string | null;
  email?: string | null;
  fallback?: string;
  className?: string;
  stopPropagation?: boolean;
}

/**
 * Nome de uma pessoa da Comunidade sempre clicável para o perfil
 * (`/painel/membros/:userId`). Sem `memberId` (ex.: registro órfão ou
 * invitation pendente de id), degrada para texto puro.
 *
 * `stopPropagation` vem ligado por padrão porque a maioria dos cards do fórum
 * é clicável — sem isso, clicar no nome abriria o card em vez do perfil.
 */
export const MemberLink: React.FC<MemberLinkProps> = ({
  memberId,
  name,
  email,
  fallback = 'Usuário',
  className,
  stopPropagation = true,
}) => {
  const label = name || email || fallback;

  if (!memberId) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Link
      to={`/painel/membros/${memberId}`}
      className={cn('font-medium underline-offset-2 hover:underline', className)}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      {label}
    </Link>
  );
};
