import React from 'react';
import { Menu, Truck, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

interface HeaderProps {
  onOpenDrawer: () => void;
  currentTitle: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenDrawer, currentTitle }) => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left: Hamburger & Brand */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Abrir menu de navegação"
            className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700 active:scale-[0.95] transition cursor-pointer"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 shadow-sm shadow-emerald-500/20">
              <Truck className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white block leading-tight">
                Gastos Rota
              </span>
              <span className="text-[10px] text-emerald-400 font-medium block leading-tight truncate max-w-[140px] sm:max-w-none">
                {currentTitle}
              </span>
            </div>
          </div>
        </div>

        {/* Right: User pill */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin
            </span>
          )}

          <div className="flex items-center gap-2 pl-2 text-right">
            <div className="hidden sm:block text-xs">
              <div className="font-semibold text-slate-200 truncate max-w-[140px]">
                {profile?.nome || 'Motorista'}
              </div>
              <div className="text-[11px] text-slate-400">
                {isAdmin ? 'Administrador' : 'Motorista'}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <User className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
