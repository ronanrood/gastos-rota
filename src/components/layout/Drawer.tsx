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
  CalendarDays,
  Calculator,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { PaymentConfigModal } from '../payment/PaymentConfigModal';
import { InstallPwaBanner } from '../pwa/InstallPwaBanner';
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
              className="fixed inset-y-0 left-0 z-50 w-[85vw] sm:w-80 sm:max-w-xs bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col"
            >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/20">
              <Truck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="font-extrabold text-white text-base tracking-tight leading-tight">
                Gastos Rota
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">
                Menu de Navegação
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile Card inside Drawer - Clicável para abrir Perfil */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800/80">
          <a
            href="#perfil"
            onClick={(e) => {
              e.preventDefault();
              handleItemClick('profile');
            }}
            title="Acessar Meu Perfil"
            className="w-full flex items-center gap-3 text-left p-2 rounded-2xl hover:bg-slate-800/80 transition group cursor-pointer block border border-transparent hover:border-slate-700/60"
          >
            {/* Avatar com Foto ou Iniciais */}
            <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-emerald-500/40 group-hover:border-emerald-400 flex items-center justify-center text-emerald-400 shrink-0 font-bold shadow-sm overflow-hidden cursor-pointer transition-colors">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.nome || 'Avatar'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm">{getInitials(profile?.nome)}</span>
              )}
            </div>

            <div className="overflow-hidden flex-1 min-w-0 cursor-pointer">
              <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition truncate">
                {profile?.nome || 'Motorista'}
              </h3>
              <p className="text-xs text-slate-400 truncate">
                {profile?.transportadora || profile?.rota
                  ? `${profile.transportadora || ''}${profile.transportadora && profile.rota ? ' • ' : ''}${profile.rota || ''}`
                  : profile?.email}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                    isAdmin
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isAdmin ? <ShieldCheck className="w-3 h-3" /> : null}
                  {isAdmin ? 'Administrador' : 'Motorista'}
                </span>
                <span className="text-[10px] text-emerald-400/90 font-medium group-hover:underline">
                  Ver Perfil →
                </span>
              </div>
            </div>
          </a>

          {/* Botão de Atalho para Configurar Pagamento */}
          <button
            type="button"
            onClick={() => setIsPaymentConfigOpen(true)}
            className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-700 transition cursor-pointer"
          >
            <span className="flex items-center gap-2 font-medium">
              <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
              Ciclos de Pagamento
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-semibold capitalize">
              {profile?.tipo_recebimento || 'Quinzenal'}
            </span>
          </button>
        </div>

        {/* Botão de Instalar Aplicativo no Celular (PWA) */}
        <InstallPwaBanner inDrawer onActionComplete={onClose} />

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-3 py-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
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
                whileHover={{ scale: 1.01 }}
                onClick={() => handleItemClick(item.id)}
                className={`w-full min-h-[48px] text-left flex items-center justify-between p-3 rounded-2xl transition-colors group cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isActive
                        ? 'bg-slate-950/20 text-slate-950'
                        : item.adminOnly
                        ? 'bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20'
                        : 'bg-slate-800 text-slate-300 group-hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate leading-tight">
                      {item.label}
                    </div>
                    <div
                      className={`text-[11px] truncate leading-tight mt-0.5 ${
                        isActive ? 'text-slate-900/80 font-medium' : 'text-slate-400'
                      }`}
                    >
                      {item.subtitle}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {item.badge && !isActive && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${
                      isActive ? 'text-slate-950' : 'text-slate-500 group-hover:translate-x-0.5'
                    }`}
                  />
                </div>
              </motion.button>
            );
          })}
        </nav>

        {/* Drawer Footer with Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <button
            type="button"
            onClick={async () => {
              onClose();
              await signOut();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-300 font-semibold text-sm transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Encerrar Sessão
          </button>
          <p className="mt-2 text-center text-[10px] text-slate-400">
            Gastos Rota v1.0 • Mobile-First
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
