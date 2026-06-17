import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';

// ─── Types ──────────────────────────────────────────────────────

type ConfirmVariant = 'danger' | 'warning';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ─── Context ────────────────────────────────────────────────────

const ConfirmContext = createContext<ConfirmContextType | null>(null);

// ─── Provider ───────────────────────────────────────────────────

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('Confirmar');
  const [message, setMessage] = useState('');
  const [confirmLabel, setConfirmLabel] = useState('Confirmar');
  const [cancelLabel, setCancelLabel] = useState('Cancelar');
  const [variant, setVariant] = useState<ConfirmVariant>('danger');
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setTitle(options.title ?? 'Confirmar');
      setMessage(options.message);
      setConfirmLabel(options.confirmLabel ?? (options.variant === 'danger' ? 'Excluir' : 'Confirmar'));
      setCancelLabel(options.cancelLabel ?? 'Cancelar');
      setVariant(options.variant ?? 'danger');
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const resolve = resolveRef.current;
    if (resolve) {
      resolve(true);
      resolveRef.current = null;
    }
    setIsOpen(false);
  }, []);

  const handleCancel = useCallback(() => {
    const resolve = resolveRef.current;
    if (resolve) {
      resolve(false);
      resolveRef.current = null;
    }
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      const resolve = resolveRef.current;
      if (resolve) {
        resolve(false);
        resolveRef.current = null;
      }
      setIsOpen(false);
    }
  }, []);

  const confirmButtonVariant = variant === 'danger' ? 'destructive' : 'default';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className={variant === 'danger' ? 'text-destructive' : 'text-primary'}>
                {variant === 'danger' ? <Trash2 size={24} /> : <AlertTriangle size={24} />}
              </span>
              <DialogTitle>{title}</DialogTitle>
            </div>
            <DialogDescription className="pt-2">{message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              {cancelLabel}
            </Button>
            <Button variant={confirmButtonVariant} onClick={handleConfirm}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
};

// ─── Hook ───────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): ConfirmContextType['confirm'] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx.confirm;
}
