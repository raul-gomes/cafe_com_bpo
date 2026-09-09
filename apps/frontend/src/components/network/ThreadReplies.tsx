import React from 'react';
import { cn } from '../../lib/utils';

interface ThreadRepliesProps {
  children: React.ReactNode;
  className?: string;
}

export function ThreadReplies({ children, className }: ThreadRepliesProps) {
  return (
    <div
      className={cn(
        'ml-8 flex flex-col gap-3 border-l-2 border-primary/15 pl-5 sm:ml-10 sm:pl-6',
        className
      )}
    >
      {children}
    </div>
  );
}