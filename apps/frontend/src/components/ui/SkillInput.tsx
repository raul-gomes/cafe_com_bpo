import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { X, Plus, Search, Check } from 'lucide-react';
import { searchSkills, type Skill } from '../../api/network';

interface SkillInputProps {
  value: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function SkillInput({
  value,
  onChange,
  placeholder = 'Digite uma habilidade e pressione Tab ou Enter',
  className,
}: SkillInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Skill[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch catalog suggestions with debounce
  useEffect(() => {
    const query = inputValue.trim();
    if (!query) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchSkills(query);
        setSuggestions(results ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [inputValue]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestions([]);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset keyboard highlight when the list or text changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions, inputValue]);

  const alreadySelected = useCallback(
    (name: string) =>
      value.some((v) => v.toLowerCase() === name.trim().toLowerCase()),
    [value]
  );

  const enabledSuggestions = useMemo(
    () => suggestions.filter((s) => !alreadySelected(s.name)),
    [suggestions, alreadySelected]
  );

  const showDuplicateError = useCallback(() => {
    setError('Esta habilidade já foi adicionada.');
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(''), 2500);
  }, []);

  const addSkill = useCallback(
    (raw: string) => {
      const name = raw.trim();
      if (!name) return false;
      if (alreadySelected(name)) {
        setInputValue('');
        setSuggestions([]);
        setActiveIndex(-1);
        showDuplicateError();
        return false;
      }
      onChange([...value, name]);
      setInputValue('');
      setSuggestions([]);
      setActiveIndex(-1);
      setError('');
      return true;
    },
    [value, alreadySelected, onChange, showDuplicateError]
  );

  const removeSkill = useCallback(
    (name: string) => {
      onChange(value.filter((v) => v !== name));
    },
    [value, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => {
          if (enabledSuggestions.length === 0) return -1;
          return i >= enabledSuggestions.length - 1 ? enabledSuggestions.length - 1 : i + 1;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => {
          if (enabledSuggestions.length === 0) return -1;
          return i <= 0 ? 0 : i - 1;
        });
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        const activeSkill = activeIndex >= 0 ? enabledSuggestions[activeIndex] : undefined;
        const target = activeSkill ?? enabledSuggestions[0];
        if (target) {
          e.preventDefault();
          addSkill(target.name);
        } else if (inputValue.trim()) {
          e.preventDefault();
          if (suggestions.length > 0) {
            // Só há correspondências já adicionadas
            setInputValue('');
            setSuggestions([]);
            setActiveIndex(-1);
            showDuplicateError();
          } else {
            addSkill(inputValue);
          }
        }
      }
      if (e.key === 'Backspace' && !inputValue && value.length > 0) {
        removeSkill(value[value.length - 1]);
      }
    },
    [activeIndex, enabledSuggestions, suggestions.length, inputValue, addSkill, value, removeSkill, showDuplicateError]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // Only add on blur if focus moves outside the container (not to a suggestion)
      if (!containerRef.current?.contains(e.relatedTarget as Node) && inputValue.trim()) {
        if (suggestions.length > 0 && enabledSuggestions.length === 0) return; // matches only already-added skills
        addSkill(enabledSuggestions.length > 0 ? enabledSuggestions[0].name : inputValue);
      }
    },
    [inputValue, suggestions.length, enabledSuggestions, addSkill]
  );

  const activeSkill = activeIndex >= 0 ? enabledSuggestions[activeIndex] : undefined;
  const showPlus = inputValue.trim().length > 0;
  const shouldShowDropdown = suggestions.length > 0;

  return (
    <div>
      <div
        ref={containerRef}
        aria-invalid={!!error}
        className={cn(
          'relative rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
          error && 'border-destructive',
          className
        )}
      >
        <div
          className="flex min-h-[42px] flex-wrap items-center gap-1.5 px-2.5 py-1.5 cursor-text"
          onClick={focusInput}
        >
          {value.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/8 px-2 py-0.5 text-xs font-medium text-foreground animate-[fadeIn_0.15s_ease-out]"
            >
              {name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSkill(name);
                }}
                className="inline-flex size-3.5 items-center justify-center rounded-full text-muted-foreground/60 hover:bg-muted-foreground/20 hover:text-foreground transition-colors"
                aria-label={`Remover ${name}`}
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
            placeholder={value.length === 0 ? placeholder : ''}
            aria-label="Habilidades"
            className="min-w-[80px] flex-1 border-none bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          {showPlus && (
            <button
              type="button"
              title="Adicionar como nova habilidade"
              onClick={(e) => {
                e.stopPropagation();
                addSkill(inputValue);
              }}
              className="inline-flex size-5 items-center justify-center rounded-md border border-input text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        {shouldShowDropdown && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md">
            <div className="max-h-64 overflow-y-auto overscroll-contain">
              {suggestions.map((skill) => {
                const isAdded = alreadySelected(skill.name);
                const isActive = !!activeSkill && activeSkill.id === skill.id;
                return (
                  <button
                    key={skill.id}
                    type="button"
                    disabled={isAdded}
                    aria-label={skill.name}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => {
                      if (!isAdded) {
                        const idx = enabledSuggestions.findIndex((s) => s.id === skill.id);
                        setActiveIndex(idx);
                      }
                    }}
                    onClick={() => addSkill(skill.name)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                      isActive ? 'bg-muted' : 'hover:bg-muted',
                      isAdded && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    <Search size={13} className="shrink-0 text-muted-foreground" />
                    <span className="flex-1">{skill.name}</span>
                    {isAdded && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Check size={11} /> adicionada
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}