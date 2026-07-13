import React, { useState, useRef, useCallback, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

export interface EmailChip {
  email: string;
  name?: string | null;
  avatar_url?: string | null;
}

interface EmailChipInputProps {
  value: EmailChip[];
  onChange: (chips: EmailChip[]) => void;
  placeholder?: string;
  className?: string;
  /** User lookup results to enrich chips — { email: { name, avatar_url } } */
  userData?: Map<string, { name?: string | null; avatar_url?: string | null }>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailChipInput({
  value,
  onChange,
  placeholder = 'Digite um email e pressione vírgula ou Enter',
  className,
  userData,
}: EmailChipInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Apply userData enrichment
  const chips = useMemo(() => {
    if (!userData) return value;
    return value.map((chip) => {
      const u = userData.get(chip.email);
      if (u) {
        return { ...chip, name: chip.name || u.name, avatar_url: chip.avatar_url || u.avatar_url };
      }
      return chip;
    });
  }, [value, userData]);

  const addChip = useCallback(
    (raw: string) => {
      const email = raw.trim().toLowerCase();
      if (!email) return false;
      if (!EMAIL_RE.test(email)) return false;
      // Prevent duplicates
      if (value.some((c) => c.email === email)) return false;
      onChange([...value, { email }]);
      return true;
    },
    [value, onChange]
  );

  const removeChip = useCallback(
    (email: string) => {
      onChange(value.filter((c) => c.email !== email));
    },
    [value, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === ',' || e.key === 'Enter') {
        e.preventDefault();
        if (inputValue) {
          addChip(inputValue);
          setInputValue('');
        }
      }
      if (e.key === 'Backspace' && !inputValue && chips.length > 0) {
        removeChip(chips[chips.length - 1].email);
      }
    },
    [inputValue, addChip, removeChip, chips]
  );

  const handleBlur = useCallback(() => {
    if (inputValue) {
      addChip(inputValue);
      setInputValue('');
    }
  }, [inputValue, addChip]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text');
      // Check if paste contains commas or newlines (batch paste)
      const parts = text.split(/[,\n\r]+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length > 1) {
        e.preventDefault();
        const newChips = [...value];
        for (const part of parts) {
          const email = part.toLowerCase();
          if (EMAIL_RE.test(email) && !newChips.some((c) => c.email === email)) {
            newChips.push({ email });
          }
        }
        onChange(newChips);
      }
    },
    [value, onChange]
  );

  return (
    <div
      className={cn(
        'flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 cursor-text',
        className
      )}
      onClick={focusInput}
    >
      {chips.map((chip) => (
        <span
          key={chip.email}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium animate-[fadeIn_0.15s_ease-out]',
            chip.name
              ? 'border-primary/30 bg-primary/8 text-foreground'
              : 'border-muted-foreground/20 bg-muted/50 text-muted-foreground'
          )}
        >
          {chip.name && (
            <span className="flex size-4 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary shrink-0">
              {(chip.name[0] || chip.email[0]).toUpperCase()}
            </span>
          )}
          <span className="truncate max-w-[160px]">
            {chip.name || chip.email}
          </span>
          {chip.name && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
              {chip.email}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeChip(chip.email);
            }}
            className="ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full text-muted-foreground/60 hover:bg-muted-foreground/20 hover:text-foreground transition-colors"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onPaste={handlePaste}
        placeholder={chips.length === 0 ? placeholder : ''}
        className="min-w-[80px] flex-1 border-none bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
