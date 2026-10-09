import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';
import { subscribePlanGate } from '../../api/planGate';

interface UpgradeContextType {
  open: () => void;
}

const UpgradeContext = createContext<UpgradeContextType | null>(null);

/**
 * Convidativo de assinatura exibido quando o write gate do plano bloqueia uma
 * ação (403 `"Seu plano não permite esta ação"`) — ver `src/api/planGate.ts`.
 *
 * O provider é o único assinante do aviso global e abre o modal no lugar do
 * erro genérico por página. Precisa estar DENTRO do Router — por isso vive na
 * raiz das rotas em `router.tsx`, envolvendo o `Outlet` — para que o botão
 * "Assinar" seja um `Link` client-side. Fora do Router o modal quebra com
 * `Cannot destructure property 'basename' of React.useContext(...)`.
 *
 * Um notify enquanto o modal já está aberto é ignorado (não duplica); fechar
 * com "Agora não" fecha o modal e um novo bloqueio (novo notify) reabre.
 */
export const UpgradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => subscribePlanGate(() => setIsOpen((prev) => prev || true)), []);

  const open = useCallback(() => setIsOpen(true), []);

  return (
    <UpgradeContext.Provider value={{ open }}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:!max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="text-primary-strong">
                <Sparkles size={24} />
              </span>
              <DialogTitle>Assine para liberar a escrita</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              Seu plano não permite esta ação. Assinar abre a escrita em captar e gestão — seus
              dados ficam preservados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Agora não
            </Button>
            <Link to="/painel/pagamentos">
              <Button>Assinar</Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UpgradeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useUpgrade(): UpgradeContextType {
  const ctx = useContext(UpgradeContext);
  if (!ctx) {
    throw new Error('useUpgrade must be used within an UpgradeProvider');
  }
  return ctx;
}