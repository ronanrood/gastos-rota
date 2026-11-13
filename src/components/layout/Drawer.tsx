import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins,
  BarChart3,
  Fuel,
  Wrench,
  Car,
  ShieldCheck,
  LogOut,
  X,
  Truck,
  ChevronRight,
  User,
  Calculator,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { PaymentConfigModal } from '../payment/PaymentConfigModal';
import { getInitials } from '../../utils/formatters';

export type ViewType =
  | 'earnings'
  | 'dashboard'
  | 'fuel'
  | 'maintenance'
  | 'vehicle'
  | 'tools'
  | 'profile'
  | 'admin';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  currentView,
  onSelectView,
}) => {
  const { profile, signOut } = useAuth();
  const [isPaymentConfigOpen, setIsPaymentConfigOpen] = useState(false);
  const isAdmin = profile?.role === 'admin';

  // Fechar ao pressionar ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const navItems = [
    {
      id: 'earnings' as ViewType,
      label: 'Início (Ganhos Diários)',
      subtitle: 'Lançamentos e faturamento diário',
      icon: Coins,
      badge: 'Principal',
    },
    {
      id: 'dashboard' as ViewType,
      label: 'Dashboard Financeiro',
      subtitle: 'Gráficos, lucro líquido e médias',
      icon: BarChart3,
    },
    {
      id: 'fuel' as ViewType,
      label: 'Combustível',
      subtitle: 'Abastecimentos e médias de consumo',
      icon: Fuel,
    },
    {
      id: 'maintenance' as ViewType,
      label: 'Oficina e Manutenção',
      subtitle: 'Serviços, peças e comprovantes',
      icon: Wrench,
    },
    {
      id: 'vehicle' as ViewType,
      label: 'Meu Veículo',
      subtitle: 'Dados do carro e quilometragem',
      icon: Car,
    },
    {
      id: 'tools' as ViewType,
      label: 'Tools (Ferramentas)',
      subtitle: 'Calculadoras, rotas e custos',
      icon: Calculator,
      badge: 'Novo',
    },
    {
      id: 'profile' as ViewType,
      label: 'Meu Perfil',
      subtitle: 'Dados cadastrais, PIX e rota',
      icon: User,
    },
    // Condicional: Painel Admin
    ...(isAdmin
      ? [
          {
            id: 'admin' as ViewType,
            label: 'Painel Admin',
            subtitle: 'Gestão de frotas e motoristas',
            icon: ShieldCheck,
            adminOnly: true,
          },
        ]
      : []),
  ];

  const handleItemClick = (id: ViewType) => {
    onClose();
    onSelectView(id);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop com fade-in e blur */}
            <motion.div
              role="presentation"
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm cursor-pointer"
            />

            {/* Drawer Panel com física de mola */}
            <motion.aside
              aria-label="Menu principal"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="fixed inset-y-0 left-0 z-50 w-[85vw] sm:w-80 sm:max-w-xs bg-zinc-950 border-r border-zinc-800/90 shadow-2xl flex flex-col h-dvh pt-[max(3rem,env(safe-area-inset-top))]"
            >
              {/* Drawer Header */}
              <div className="px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-zinc-950 font-bold shadow-sm">
                    <Truck className="w-4 h-4 stroke-[2.4]" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-white text-sm tracking-tight leading-tight">
                      Gastos Rota
                    </h2>
                    <span className="text-[10px] text-zinc-400 font-medium">
                      Menu de Navegação
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar menu"
                  className="w-9 h-9 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Profile Card inside Drawer - Clicável para abrir Perfil */}
              <div className="p-3 bg-zinc-900/40 border-b border-zinc-800/80 shrink-0">
                <a
                  href="#perfil"
                  onClick={(e) => {
                    e.preventDefault();
                    handleItemClick('profile');
                  }}
                  title="Acessar Meu Perfil"
                  className="w-full flex items-center gap-3 text-left p-1.5 rounded-xl hover:bg-zinc-850/80 transition group cursor-pointer block border border-transparent hover:border-zinc-700/60"
                >
                  {/* Avatar com Foto ou Iniciais */}
                  <div className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-emerald-500/40 group-hover:border-emerald-400 flex items-center justify-center text-emerald-400 shrink-0 font-bold shadow-sm overflow-hidden cursor-pointer transition-colors text-xs">
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

                  <div className="overflow-hidden flex-1 min-w-0 cursor-pointer">
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition truncate">
                      {profile?.nome || 'Motorista'}
                    </h3>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {profile?.transportadora || profile?.rota
                        ? `${profile.transportadora || ''}${profile.transportadora && profile.rota ? ' • ' : ''}${profile.rota || ''}`
                        : profile?.email}
                    </p>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold group-hover:underline shrink-0">
                    Perfil →
                  </span>
                </a>
              </div>

              {/* Navigation list compacta */}
              <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                  Navegação
                </div>

                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;

                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleItemClick(item.id)}
                      className={`w-full text-left flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors group cursor-pointer ${
                        isActive
                          ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/20'
                          : 'text-zinc-300 hover:bg-zinc-850 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isActive
                              ? 'bg-zinc-950/20 text-zinc-950'
                              : item.adminOnly
                              ? 'bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20'
                              : 'bg-zinc-850 text-zinc-300 group-hover:bg-zinc-800'
                          }`}
                        >
                          <Icon className="w-4 h-4 stroke-[2]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate leading-tight">
                            {item.label}
                          </div>
                          <div
                            className={`text-[10px] truncate leading-tight mt-0.5 ${
                              isActive ? 'text-zinc-950/80 font-medium' : 'text-zinc-400'
                            }`}
                          >
                            {item.subtitle}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {item.badge && !isActive && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            {item.badge}
                          </span>
                        )}
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform ${
                            isActive ? 'text-zinc-950' : 'text-zinc-500 group-hover:translate-x-0.5'
                          }`}
                        />
                      </div>
                    </motion.button>
                  );
                })}
              </nav>

              {/* Drawer Footer with Logout fixo na base com safe area */}
              <div className="shrink-0 p-4 border-t border-zinc-800/80 bg-zinc-950 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={async () => {
                    onClose();
                    await signOut();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-300 font-semibold text-xs transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Encerrar Sessão
                </button>
                <p className="mt-2 text-center text-[10px] text-zinc-500">
                  Gastos Rota • iOS Native
                </p>
              </div>
            </motion.aside>
    </>
  )}
</AnimatePresence>

      {/* Modal de Configuração de Recebimento */}
      <PaymentConfigModal
        isOpen={isPaymentConfigOpen}
        onClose={() => setIsPaymentConfigOpen(false)}
      />
    </>
  );
};
