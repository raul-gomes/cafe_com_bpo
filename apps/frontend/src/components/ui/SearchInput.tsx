import React from 'react';
import { Search, X } from 'lucide-react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from './input-group';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Nome acessível do campo — obrigatório para o filtro não ficar sem rótulo. */
  label: string;
  className?: string;
  autoFocus?: boolean;
}

/** Campo de busca padronizado do painel: lupa **dentro** do input (InputGroup),
 *  botão de limpar e rótulo acessível.
 *
 * É o filtro de busca de referência — qualquer tela que precise filtrar lista
 * deve usar este componente em vez de um `Input` com ícone ao lado.
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Buscar...',
  label,
  className,
  autoFocus,
}) => (
  <InputGroup className={className}>
    <InputGroupAddon align="inline-start">
      <Search aria-hidden="true" className="size-4" />
    </InputGroupAddon>
    <InputGroupInput
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      autoFocus={autoFocus}
    />
    {value ? (
      <InputGroupAddon align="inline-end">
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar busca"
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </InputGroupAddon>
    ) : null}
  </InputGroup>
);
