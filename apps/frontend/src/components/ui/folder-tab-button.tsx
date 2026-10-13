import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

type FolderTabButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Main action of a screen in the V4 kit folder-tab gesture
 * (`cafe-command cafe-command-tab`): paper, tab on top and a 3 px bottom line
 * — inside a module the line takes on its color (globals.css).
 * One per context; secondary actions stay on <Button>.
 *
 * It does not reuse buttonVariants on purpose: those utility classes (border,
 * radius, height) are unlayered and would override the kit drawing.
 */
export const FolderTabButton = forwardRef<HTMLButtonElement, FolderTabButtonProps>(
  ({ className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn('cafe-command cafe-command-tab panel-folder-tab', className)}
      {...props}
    />
  )
);
FolderTabButton.displayName = 'FolderTabButton';
