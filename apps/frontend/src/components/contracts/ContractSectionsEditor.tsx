import React, { useEffect, useState } from 'react';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { ChevronDown, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { ContractSection } from '../../api/contracts';
import { cn } from '../../lib/utils';

export interface ContractSectionsEditorProps {
  sections: ContractSection[];
  readOnly?: boolean;
  onChange?: (sections: ContractSection[]) => void;
}

export const ContractSectionsEditor: React.FC<ContractSectionsEditorProps> = ({
  sections,
  readOnly = false,
  onChange,
}) => {
  const [items, setItems] = useState<ContractSection[]>(sections);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');

  useEffect(() => {
    setItems(sections);
    setExpandedIndex((current) =>
      current !== null && current > sections.length ? null : current
    );
  }, [sections]);

  const update = (next: ContractSection[]) => {
    setItems(next);
    onChange?.(next);
  };

  const closeEditor = () => {
    setExpandedIndex(null);
    setCreating(false);
  };

  const removeAt = (index: number) => {
    update(items.filter((_, i) => i !== index));
    closeEditor();
  };

  const expand = (index: number, isCreating: boolean) => {
    setExpandedIndex(index);
    setCreating(isCreating);
    setDraftTitle(isCreating ? '' : items[index].title);
    setDraftContent(isCreating ? '' : items[index].content);
  };

  const handleSave = () => {
    if (!draftTitle.trim()) return;
    if (creating) {
      update([...items, { title: draftTitle.trim(), content: draftContent }]);
    } else if (expandedIndex !== null) {
      update(items.map((s, i) => (i === expandedIndex ? { title: draftTitle.trim(), content: draftContent } : s)));
    }
    closeEditor();
  };

  const handleDragEnd = (result: DropResult) => {
    closeEditor();
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    update(next);
  };

  const editorFor = (index: number) => (
    <form
      className="flex flex-col gap-3"
      data-testid={`section-editor-${index}`}
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted-foreground" htmlFor={`contract-section-title-${index}`}>
          Título da seção
        </label>
        <Input
          id={`contract-section-title-${index}`}
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="Ex.: Das Partes"
          autoFocus={creating}
          data-testid="contract-section-title"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted-foreground" htmlFor={`contract-section-content-${index}`}>
          Conteúdo
        </label>
        <Textarea
          id={`contract-section-content-${index}`}
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          placeholder="Texto da cláusula..."
          rows={6}
          data-testid="contract-section-content"
        />
        <p className="text-[11px] text-muted-foreground">
          Tokens como <code>{'{{nome}}'}</code> e <code>{'{{valor_mensal}}'}</code> são substituídos
          automaticamente quando um contrato é gerado.
        </p>
      </div>
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={closeEditor}>
          Cancelar
        </Button>
        <div className="flex items-center gap-2">
          {!creating && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => removeAt(index)}
            >
              <Trash2 className="size-3.5" /> Remover
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!draftTitle.trim()}>
            Salvar seção
          </Button>
        </div>
      </div>
    </form>
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="contract-sections">
        {(droppableProvided) => (
          <div
            {...droppableProvided.droppableProps}
            ref={droppableProvided.innerRef}
            className="flex flex-col gap-3"
          >
            {items.length === 0 && !creating && (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                {readOnly
                  ? 'Este contrato não possui seções.'
                  : 'Nenhuma seção ainda. Clique em "Adicionar seção" para começar.'}
              </div>
            )}

            {items.map((section, index) => (
              <Draggable
                key={index}
                draggableId={`contract-section-${index}`}
                index={index}
                isDragDisabled={readOnly}
              >
                {(itemProvided, snapshot) => (
                  <div
                    ref={itemProvided.innerRef}
                    {...itemProvided.draggableProps}
                    style={itemProvided.draggableProps.style as React.CSSProperties}
                  >
                    <SectionCard
                      section={section}
                      index={index}
                      expanded={expandedIndex === index}
                      readOnly={readOnly}
                      dragHandleProps={itemProvided.dragHandleProps}
                      dragging={snapshot.isDragging}
                      renderEditor={() => editorFor(index)}
                      onExpand={() => (expandedIndex === index ? closeEditor() : expand(index, false))}
                      onRemove={() => removeAt(index)}
                    />
                  </div>
                )}
              </Draggable>
            ))}

            {!readOnly && creating && (
              <div>
                <SectionCard
                  section={undefined}
                  index={items.length}
                  expanded
                  readOnly={readOnly}
                  dragHandleProps={undefined}
                  dragging={false}
                  renderEditor={() => editorFor(items.length)}
                  onExpand={closeEditor}
                  onRemove={() => {}}
                />
              </div>
            )}

            {!readOnly && !creating && (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => expand(items.length, true)}
              >
                <Plus className="size-3.5" /> Adicionar seção
              </Button>
            )}

            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

function SectionCard({
  section,
  index,
  expanded,
  readOnly,
  dragHandleProps,
  dragging,
  renderEditor,
  onExpand,
  onRemove,
}: {
  section: ContractSection | undefined;
  index: number;
  expanded: boolean;
  readOnly: boolean;
  dragHandleProps?: any;
  dragging: boolean;
  renderEditor: () => React.ReactNode;
  onExpand: () => void;
  onRemove: () => void;
}) {
  return (
    <Card className={cn('p-4 transition-shadow', dragging && 'shadow-lg ring-2 ring-primary/30')}>
      <div className="flex items-start gap-3">
        <span
          {...(readOnly ? {} : dragHandleProps)}
          className={cn(
            'mt-0.5 flex shrink-0 items-center gap-1 text-muted-foreground',
            !readOnly && 'cursor-grab active:cursor-grabbing'
          )}
        >
          {!readOnly && <GripVertical className="size-3.5" />}
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary-strong">
            {index + 1}
          </span>
        </span>

        <div className="min-w-0 flex-1">
          {!readOnly && expanded ? (
            renderEditor()
          ) : (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground" data-testid={`section-title-${index}`}>
                {section?.title || 'Sem título'}
              </div>
              <div className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {section && section.content.length > 140
                  ? `${section.content.slice(0, 140)}...`
                  : (section?.content ?? '')}
              </div>
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="flex shrink-0 items-center gap-1">
            <IconButton label={expanded ? 'Recolher seção' : 'Editar seção'} onClick={onExpand}>
              <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
            </IconButton>
            {!expanded && (
              <IconButton label="Remover seção" onClick={onRemove}>
                <Trash2 className="size-3.5 text-destructive" />
              </IconButton>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

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
      className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}