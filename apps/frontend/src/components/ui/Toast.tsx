import React, { createContext, useContext, useState, useCallback, useRef, type ComponentType } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X, type LucideProps } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────────

const TOAST_DURATION = 4000;
let nextId = 1;

const ICON_MAP: Record<ToastType, ComponentType<LucideProps>> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLOR_MAP: Record<ToastType, string> = {
  success: 'var(--ds-primary)',
  error: 'var(--ds-error)',
  warning: 'var(--ds-primary)',
  info: 'var(--ds-info)',
};

// ─── Context ────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | null>(null);

// ─── Provider ───────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);

    const timer = setTimeout(() => {
      removeToast(id);
    }, TOAST_DURATION);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  const success = useCallback((message: string) => addToast(message, 'success'), [addToast]);
  const error = useCallback((message: string) => addToast(message, 'error'), [addToast]);
  const warning = useCallback((message: string) => addToast(message, 'warning'), [addToast]);
  const info = useCallback((message: string) => addToast(message, 'info'), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error, warning, info }}>
      {children}

      <div className="ds-toast-container">
        {toasts.map((toast) => {
          const Icon = ICON_MAP[toast.type];
          return (
            <div
              key={toast.id}
              className={`ds-toast ds-toast--${toast.type}`}
              style={{
                borderLeftColor: COLOR_MAP[toast.type],
              }}
            >
              <span className="ds-toast__icon">
                <Icon size={20} color={COLOR_MAP[toast.type]} />
              </span>
              <span className="ds-toast__content">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  color: 'var(--ds-text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

// ─── Hook ───────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
