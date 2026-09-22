import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ContractSection } from '../../api/contracts';
import { ContractSectionDialog } from './ContractSectionDialog';

export interface ContractSectionsEditorProps {
  sections: ContractSection[];
  readOnly?: boolean;
  onChange?: (sections: ContractSection[]) => void;
}

type DialogState = { mode: 'create' | 'edit'; index: number } | null;

export const ContractSectionsEditor: React.FC<ContractSectionsEditorProps> = ({
  sections,
  readOnly = false,
  onChange,
}) => {
  const [items, setItems] = useState<ContractSection[]>(sections);
  const [dialog, setDialog] = useState<DialogState>(null);

  useEffect(() => {
    setItems(sections);
  }, [sections]);

  const update = (next: ContractSection[], callback?: () => void) => {
    setItems(next);
    onChange?.(next);
    callback?.();
  };

  const handleSave = (title: string, content: string) => {
    if (!dialog) return;
    if (dialog.mode === 'create') {
      update([...items, { title, content }]);
    } else {
      update(items.map((s, i) => (i === dialog.index ? { title, content } : s)));
    }
    setDialog(null);
  };

  const removeAt = (index: number) => {
    update(items.filter((_, i) => i !== index));
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };

  const current = dialog ? items[dialog.index] : null;

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {readOnly
            ? 'Este contrato não possui seções.'
            : 'Nenhuma seção ainda. Clique em "Adicionar seção" para começar.'}
        </div>
      )}

      {items.map((section, index) => (
        <Card key={`${index}-${section.title}`} className="p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary-strong">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground" data-testid={`section-title-${index}`}>
                {section.title}
              </div>
              <div className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {section.content.length > 140
                  ? `${section.content.slice(0, 140)}...`
                  : section.content}
              </div>
            </div>
            {!readOnly && (
              <div className="flex shrink-0 items-center gap-1">
                <IconButton label="Mover para cima" onClick={() => move(index, -1)} disabled={index === 0}>
                  <ChevronUp className="size-4" />
                </IconButton>
                <IconButton label="Mover para baixo" onClick={() => move(index, 1)} disabled={index === items.length - 1}>
                  <ChevronDown className="size-4" />
                </IconButton>
                <IconButton label="Editar seção" onClick={() => setDialog({ mode: 'edit', index })}>
                  <Pencil className="size-4" />
                </IconButton>
                <IconButton label="Remover seção" onClick={() => removeAt(index)}>
                  <Trash2 className="size-4 text-destructive" />
                </IconButton>
              </div>
            )}
          </div>
        </Card>
      ))}

      {!readOnly && (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setDialog({ mode: 'create', index: items.length })}>
          <Plus className="size-4" /> Adicionar seção
        </Button>
      )}

      <ContractSectionDialog
        open={dialog !== null}
        mode={dialog?.mode ?? 'create'}
        initialTitle={current?.title}
        initialContent={current?.content}
        onSave={handleSave}
        onClose={() => setDialog(null)}
      />
    </div>
  );
};

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}