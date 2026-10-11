import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NotificationBell } from './NotificationBell';
import { CafeIcon } from '../../brand/CafeIcon';
import { useAppearance } from '../../brand/appearance';
import { AtmosphereQuickPicker } from '../../brand/AtmospherePicker';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface PanelTopBarProps {
  /** Nome da área atual (null no Início). */
  sectionLabel: string | null;
  onOpenMobileNav: () => void;
  mobileNavOpen: boolean;
}

/** Barra fina do topo: onde estou, avisos e conta — o perfil saiu da lateral. */
export const PanelTopBar: React.FC<PanelTopBarProps> = ({ sectionLabel, onOpenMobileNav, mobileNavOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [{ mode }] = useAppearance();

  const firstName = user?.name?.split(' ')[0] || 'Usuário';
  const initials = user?.name
    ? user.name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <header className="relative flex h-[60px] shrink-0 items-center gap-[12px] border-b border-border bg-card px-[clamp(16px,3vw,40px)]">
      {/* Faixa do módulo: corre da esquerda para a direita a cada troca de área. */}
      <span
        key={sectionLabel ?? 'inicio'}
        className="panel-module-stripe pointer-events-none absolute inset-x-0 -bottom-px h-[3px] bg-module"
        aria-hidden="true"
      />
      <button
        type="button"
        className="cafe-floating-arrow cafe-mobile-nav-trigger"
        onClick={onOpenMobileNav}
        aria-expanded={mobileNavOpen}
        aria-controls="painel-menu-celular"
        aria-label="Abrir menu"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
      </button>

      <div className="flex min-w-0 items-center gap-[10px]">
        <span className="h-[20px] w-[4px] rounded-full bg-module" aria-hidden="true" />
        <span className="truncate text-xs font-bold uppercase tracking-[0.11em] text-muted-foreground">
          {sectionLabel ?? 'Início'}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-[8px]">
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="grid size-[40px] place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Atmosfera: cor e luz"
                title="Atmosfera"
              />
            }
          >
          {mode === 'dark' ? (
            <svg className="size-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg className="size-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
            </svg>
          )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[280px] p-[14px]">
            <AtmosphereQuickPicker />
            <button
              type="button"
              onClick={() => navigate('/painel/configuracoes')}
              className="text-left text-xs font-semibold text-primary-strong hover:underline"
            >
              Ver as seis atmosferas
            </button>
          </PopoverContent>
        </Popover>

        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex items-center gap-[8px] rounded-full py-[4px] pl-[4px] pr-[12px] transition-colors hover:bg-accent"
                aria-label={`Conta de ${firstName}`}
              />
            }
          >
            <span
              className="grid size-[32px] place-items-center rounded-full bg-primary bg-cover bg-center text-xs font-bold text-primary-foreground"
              style={user?.avatar_url ? { backgroundImage: `url(${user.avatar_url})` } : undefined}
              aria-hidden="true"
            >
              {!user?.avatar_url && initials}
            </span>
            <span className="hidden text-sm font-semibold text-foreground sm:inline">{firstName}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px]">
            <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/painel/perfil')}>
              <CafeIcon name="pessoas" className="size-[18px]" /> Meu perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/painel/configuracoes')}>
              <CafeIcon name="ajustes" className="size-[18px]" /> Aparência e configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={logout}>
              <CafeIcon name="sair" className="size-[18px]" /> Sair da conta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
