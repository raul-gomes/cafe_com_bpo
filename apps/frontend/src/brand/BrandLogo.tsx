import React from 'react';
import { logoFor, useAppearance } from './appearance';
import type { CafeModule } from '../components/panel/navigation';
import { cn } from '../lib/utils';

interface BrandLogoProps {
  /** Dentro de um módulo, o logo "veste" a cor dele; sem módulo, versão oficial. */
  module?: CafeModule;
  className?: string;
}

/**
 * Logo Café com BPO.
 *
 * Divergência consciente do MANUAL-DE-MARCA V4 ("não recolorir a versão
 * colorida pela família de UI"), pedida por Ghuto em 2026-10-11: ao entrar num
 * módulo, o logo oficial aparece primeiro e então a versão de uma tinta (preta,
 * como máscara) tingida pela cor do módulo surge por cima. O desenho é o mesmo;
 * fora dos módulos fica só a versão oficial.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ module, className }) => {
  const [{ mode }] = useAppearance();

  return (
    <span className={cn('relative block aspect-[1835/750]', className)}>
      <img src={logoFor(mode)} alt="Café com BPO" className="absolute inset-0 h-full w-full" />
      {module && (
        <span
          // A chave reinicia a animação a cada troca de módulo: original → cor do módulo.
          key={module}
          data-cafe-module={module}
          className="panel-logo-tinted panel-logo-veste absolute inset-0 bg-module"
          aria-hidden="true"
        />
      )}
    </span>
  );
};
