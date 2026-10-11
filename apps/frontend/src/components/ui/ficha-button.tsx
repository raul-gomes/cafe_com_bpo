import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

type FichaButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Ação principal da tela no gesto de fichário do kit V4
 * (`cafe-command cafe-command-tab`): papel, aba no alto e linha de 3 px embaixo
 * — dentro de um módulo, a linha veste a cor dele (globals.css).
 * Uma por contexto; ações secundárias continuam no <Button>.
 *
 * Não reaproveita buttonVariants de propósito: as classes utilitárias de lá
 * (borda, raio, altura) ficam fora de camada e anulariam o desenho do kit.
 */
export const FichaButton = forwardRef<HTMLButtonElement, FichaButtonProps>(
  ({ className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn('cafe-command cafe-command-tab panel-ficha', className)}
      {...props}
    />
  )
);
FichaButton.displayName = 'FichaButton';
