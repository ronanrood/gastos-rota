import React from 'react';
import { Menu, Truck, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { getInitials } from '../../utils/formatters';

interface HeaderProps {
  onOpenDrawer: () => void;
  currentTitle: string;
  onOpenProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenDrawer, currentTitle, onOpenProfile }) => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Subtítulo do usuário: Transportadora • Rota ou papel
  const userSubtitle =
    profile?.transportadora || profile?.rota
      ? `${profile.transportadora || ''}${profile.transportadora && profile.rota ? ' • ' : ''}${profile.rota || ''}`
      : isAdmin
      ? 'Administrador'
      : 'Motorista';

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between">
        {/* Left: Hamburger & Brand */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Abrir menu de navegação"
            className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700 active:scale-[0.95] transition cursor-pointer"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 shadow-sm shadow-emerald-500/20 shrink-0">
              <Truck className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-base tracking-tight text-white block leading-tight">
                Gastos Rota
              </span>
              <span className="text-[10px] text-emerald-400 font-medium block leading-tight truncate max-w-[130px] sm:max-w-none">
                {currentTitle}
              </span>
            </div>
          </div>
        </div>

        {/* Right: User pill clicável levando para /perfil */}
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin
            </span>
          )}

          <a
            href="#perfil"
            onClick={(e) => {
              e.preventDefault();
              onOpenProfile();
            }}
            title="Acessar Meu Perfil"
            aria-label="Acessar Meu Perfil"
            className="flex items-center gap-2.5 pl-2 py-1 pr-1 sm:pr-2.5 rounded-2xl hover:bg-slate-800/80 border border-transparent hover:border-slate-700/80 transition active:scale-[0.97] cursor-pointer text-right group min-h-[44px] select-none"
          >
            <div className="hidden sm:block text-xs cursor-pointer">
              <div className="font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors truncate max-w-[150px]">
                {profile?.nome || 'Motorista'}
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                {userSubtitle}
              </div>
            </div>

            {/* Foto de Perfil ou Iniciais */}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-800 border-2 border-emerald-500/40 group-hover:border-emerald-400 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0 overflow-hidden shadow-sm transition-colors cursor-pointer">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.nome || 'Avatar'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{getInitials(profile?.nome)}</span>
              )}
            </div>
          </a>
        </div>
      </div>
    </header>
  );
};
