import React from 'react';
import { logoFor, useAppearance } from './appearance';
import type { CafeModule } from '../components/panel/navigation';
import { cn } from '../lib/utils';

interface BrandLogoProps {
  /** Inside a module the logo takes on its color; outside, the official version. */
  module?: CafeModule;
  className?: string;
}

/**
 * Café com BPO logo.
 *
 * Deliberate departure from the V4 brand manual ("do not recolor the colored
 * version by UI family"), requested by Ghuto on 2026-10-11: on entering a
 * module, the official logo shows first and then the one-ink version (black,
 * used as a mask) tinted with the module color fades in on top. Same drawing;
 * outside modules only the official version shows.
 *
 * @returns The logo.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ module, className }) => {
  const [{ mode }] = useAppearance();

  return (
    <span className={cn('relative block aspect-[1835/750]', className)}>
      <img src={logoFor(mode)} alt="Café com BPO" className="absolute inset-0 h-full w-full" />
      {module && (
        <span
          // The key restarts the animation on every module change: original → module color.
          key={module}
          data-cafe-module={module}
          className="panel-logo-tinted panel-logo-tint-in absolute inset-0 bg-module"
          aria-hidden="true"
        />
      )}
    </span>
  );
};
