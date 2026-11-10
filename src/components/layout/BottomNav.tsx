import React from 'react';
import { motion } from 'framer-motion';
import { Coins, Fuel, Wrench, BarChart3, Menu } from 'lucide-react';
import type { ViewType } from './Drawer';

interface BottomNavProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  onOpenDrawer: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onSelectView,
  onOpenDrawer,
}) => {
  const navShortcuts = [
    {
      id: 'earnings' as ViewType,
      label: 'Ganhos',
      icon: Coins,
    },
    {
      id: 'fuel' as ViewType,
      label: 'Combustível',
      icon: Fuel,
    },
    {
      id: 'maintenance' as ViewType,
      label: 'Oficina',
      icon: Wrench,
    },
    {
      id: 'dashboard' as ViewType,
      label: 'Dashboard',
      icon: BarChart3,
    },
  ];

  return (
    <nav
      aria-label="Navegação rápida inferior"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/90 pb-safe shadow-[0_-8px_20px_rgba(0,0,0,0.4)]"
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1 items-center">
        {navShortcuts.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <motion.button
              key={item.id}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => onSelectView(item.id)}
              className={`relative flex flex-col items-center justify-center h-full min-h-[48px] w-full rounded-2xl transition-colors cursor-pointer select-none ${
                isActive
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Pílula ativa deslizante (layoutId) */}
              {isActive && (
                <motion.div
                  layoutId="bottomNavActiveTabIndicator"
                  className="absolute inset-x-1.5 inset-y-1.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}

              <motion.div
                animate={{ scale: isActive ? 1.08 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="p-1 rounded-xl"
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </motion.div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[56px] text-center">
                {item.label}
              </span>
            </motion.button>
          );
        })}

        {/* Botão para abrir gaveta completa */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={onOpenDrawer}
          className="flex flex-col items-center justify-center h-full min-h-[48px] w-full rounded-2xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer select-none"
        >
          <div className="p-1 rounded-xl bg-slate-800/60 text-slate-300">
            <Menu className="w-5 h-5 stroke-[2]" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[56px] text-center font-medium">
            Menu
          </span>
        </motion.button>
      </div>
    </nav>
  );
};

