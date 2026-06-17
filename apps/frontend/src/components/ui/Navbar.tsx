import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';
import { Button, buttonVariants } from './button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './dropdown-menu';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-[9999] flex h-14 items-center border-b border-white/10 bg-black/92 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-[1024px] items-center justify-between px-5">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <img src={logo} alt="Café com BPO" className="h-7 w-auto" />
          <span className="text-[15px] font-bold tracking-tight text-white">
            Café com <span className="text-primary">BPO</span>
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <Link
            to="/simulador"
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
          >
            Simulador
          </Link>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
                Olá, {user?.name?.split(' ')[0] || 'Usuário'}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                  <span>📊</span> Minhas Propostas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <span>🚪</span> Sair da conta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login" className={buttonVariants({ variant: "default", size: "sm", className: "no-underline" })}>
              Entrar
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};
