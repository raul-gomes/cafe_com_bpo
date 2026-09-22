import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

export interface ContractSectionDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialTitle?: string;
  initialContent?: string;
  onSave: (title: string, content: string) => void;
  onClose: () => void;
}

export const ContractSectionDialog: React.FC<ContractSectionDialogProps> = ({
  open,
  mode,
  initialTitle = '',
  initialContent = '',
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setContent(initialContent);
    }
  }, [open, initialTitle, initialContent]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(title.trim(), content);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nova seção' : 'Editar seção'}</DialogTitle>
          <DialogDescription>
            Dê um título à seção e escreva o conteúdo. Tokens como{' '}
            <code>{'{{nome}}'}</code> e <code>{'{{valor_mensal}}'}</code> são substituídos
            automaticamente quando um contrato é gerado.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="contract-section-title">
              Título da seção
            </label>
            <Input
              id="contract-section-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Das Partes"
              data-testid="contract-section-title"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="contract-section-content">
              Conteúdo
            </label>
            <Textarea
              id="contract-section-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Texto da cláusula..."
              rows={10}
              data-testid="contract-section-content"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!title.trim()}>Salvar seção</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};