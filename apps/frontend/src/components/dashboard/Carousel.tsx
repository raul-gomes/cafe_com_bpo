import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CarouselProps {
  children: React.ReactNode;
  className?: string;
  /** Accessible label for the region */
  ariaLabel?: string;
}

/**
 * Carousel horizontal leve (sem dependências): setas laterais, rolagem
 * suave por "páginas" e estados de borda desabilitados automaticamente.
 */
export const Carousel: React.FC<CarouselProps> = ({ children, className, ariaLabel }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateArrows]);

  const scrollByPage = (direction: 'left' | 'right') => {
    const el = trackRef.current;
    if (!el) return;
    const page = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === 'left' ? -page : page, behavior: 'smooth' });
  };

  return (
    <div className={cn('group/carousel relative', className)} aria-label={ariaLabel} role="region">
      {/* Botão esquerdo */}
      <button
        type="button"
        onClick={() => scrollByPage('left')}
        disabled={!canScrollLeft}
        aria-label="Anterior"
        className={cn(
          'absolute left-0 top-1/2 z-10 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-md transition-all',
          canScrollLeft ? 'cursor-pointer opacity-100 hover:bg-accent' : 'pointer-events-none opacity-0'
        )}
      >
        <ChevronLeft size={18} />
      </button>

      {/* Trilha rolável */}
      <div
        ref={trackRef}
        onScroll={updateArrows}
        className="flex gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      {/* Botão direito */}
      <button
        type="button"
        onClick={() => scrollByPage('right')}
        disabled={!canScrollRight}
        aria-label="Próximo"
        className={cn(
          'absolute right-0 top-1/2 z-10 flex size-9 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-border bg-card shadow-md transition-all',
          canScrollRight ? 'cursor-pointer opacity-100 hover:bg-accent' : 'pointer-events-none opacity-0'
        )}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
};
