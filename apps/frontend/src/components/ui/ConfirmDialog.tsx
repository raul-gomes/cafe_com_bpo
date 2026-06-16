import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────

type ConfirmVariant = 'danger' | 'warning';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: ConfirmVariant;
  resolve: ((value: boolean) => void) | null;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ─── Context ────────────────────────────────────────────────────

const ConfirmContext = createContext<ConfirmContextType | null>(null);

// ─── Provider ───────────────────────────────────────────────────

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: 'Confirmar',
    message: '',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    variant: 'danger',
    resolve: null,
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({
        isOpen: true,
        title: options.title ?? 'Confirmar',
        message: options.message,
        confirmLabel: options.confirmLabel ?? (options.variant === 'danger' ? 'Excluir' : 'Confirmar'),
        cancelLabel: options.cancelLabel ?? 'Cancelar',
        variant: options.variant ?? 'danger',
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const resolve = resolveRef.current;
    if (resolve) {
      resolve(true);
      resolveRef.current = null;
    }
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleCancel = useCallback(() => {
    const resolve = resolveRef.current;
    if (resolve) {
      resolve(false);
      resolveRef.current = null;
    }
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }, [handleCancel]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {state.isOpen && (
        <div className="panel-modal-overlay" onClick={handleOverlayClick}>
          <div className="panel-modal" style={{ maxWidth: '400px' }}>
            <div className="panel-modal__header">
              <div className={`panel-modal__icon panel-modal__icon--${state.variant === 'danger' ? 'danger' : 'warning'}`}>
                {state.variant === 'danger' ? (
                  <Trash2 size={24} />
                ) : (
                  <AlertTriangle size={24} />
                )}
              </div>
              <h2 className="panel-modal__title">{state.title}</h2>
            </div>

            <div className="panel-modal__body">
              <p>{state.message}</p>
            </div>

            <div className="panel-modal__footer">
              <button className="ds-btn ds-btn-ghost" onClick={handleCancel}>
                {state.cancelLabel}
              </button>
              <button
                className="ds-btn"
                style={{
                  background: state.variant === 'danger' ? 'var(--ds-error)' : 'var(--ds-primary)',
                  color: state.variant === 'danger' ? 'white' : 'var(--ds-primary-text)',
                }}
                onClick={handleConfirm}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
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
