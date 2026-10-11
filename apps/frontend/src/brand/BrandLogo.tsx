import React from 'react';
import { logoFor, useAppearance } from './appearance';
import type { CafeModule } from '../components/panel/navigation';
import { cn } from '../lib/utils';

interface BrandLogoProps {
  /** Dentro de um módulo, o logo veste a cor dele; sem módulo, versão oficial. */
  module?: CafeModule;
  className?: string;
}

/**
 * Logo Café com BPO.
 *
 * Divergência consciente do MANUAL-DE-MARCA V4 ("não recolorir a versão
 * colorida pela família de UI"), pedida por Ghuto em 2026-10-11: dentro de
 * um módulo usamos a versão de uma tinta (preta) como máscara, tingida com a
 * cor do módulo — o desenho é o mesmo, só a tinta muda. A versão colorida
 * original continua sendo a de assinatura fora dos módulos.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ module, className }) => {
  const [{ mode }] = useAppearance();

  if (!module) {
    return <img src={logoFor(mode)} alt="Café com BPO" className={cn('h-auto', className)} />;
  }

  return (
    <span
      role="img"
      aria-label="Café com BPO"
      data-cafe-module={module}
      className={cn('panel-logo-tinted block aspect-[1835/750] bg-module', className)}
    />
  );
};
