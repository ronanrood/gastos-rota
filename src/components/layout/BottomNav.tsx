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
      className="shrink-0 fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-800/80 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="grid grid-cols-5 h-16 items-center w-full px-0.5">
        {navShortcuts.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <motion.button
              key={item.id}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => onSelectView(item.id)}
              className={`relative flex flex-col items-center justify-center h-full min-h-[48px] w-full rounded-xl transition-colors cursor-pointer select-none px-0 ${
                isActive
                  ? 'text-emerald-400 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {/* Pílula ativa deslizante (layoutId) */}
              {isActive && (
                <motion.div
                  layoutId="bottomNavActiveTabIndicator"
                  className="absolute inset-x-0.5 inset-y-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}

              <motion.div
                animate={{ scale: isActive ? 1.06 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="p-1 rounded-lg"
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </motion.div>
              <span className="text-[10px] font-medium leading-tight mt-0.5 tracking-tight whitespace-nowrap w-full text-center block">
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
          className="flex flex-col items-center justify-center h-full min-h-[48px] w-full rounded-xl text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer select-none px-0"
        >
          <div className="p-1 rounded-lg bg-zinc-800/60 text-zinc-300">
            <Menu className="w-5 h-5 stroke-[2]" />
          </div>
          <span className="text-[10px] font-medium leading-tight mt-0.5 tracking-tight whitespace-nowrap w-full text-center block">
            Menu
          </span>
        </motion.button>
      </div>
    </nav>
  );
};

