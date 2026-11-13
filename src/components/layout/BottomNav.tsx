import React from 'react';
import { motion } from 'framer-motion';
import { Coins, Fuel, Wrench, BarChart3, LayoutGrid } from 'lucide-react';
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
      className="shrink-0 fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/80 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-2 md:hidden"
    >
      <div className="grid grid-cols-5 items-center w-full">
        {navShortcuts.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <motion.button
              key={item.id}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => onSelectView(item.id)}
              className="relative flex flex-col items-center justify-center w-full min-h-[44px] transition-colors cursor-pointer select-none"
            >
              <div
                className={`flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-emerald-500/15 px-4 py-1 rounded-full'
                    : 'px-4 py-1'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive
                      ? 'text-emerald-400 stroke-[2.4]'
                      : 'text-zinc-400 stroke-[1.8]'
                  }`}
                />
              </div>
              <span
                className={`text-[10px] leading-tight mt-0.5 tracking-tight whitespace-nowrap text-center block ${
                  isActive
                    ? 'font-semibold text-emerald-400'
                    : 'font-medium text-zinc-400'
                }`}
              >
                {item.label}
              </span>
            </motion.button>
          );
        })}

        {/* 5º Item: Mais / Outras abas via Drawer */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={onOpenDrawer}
          className="relative flex flex-col items-center justify-center w-full min-h-[44px] transition-colors cursor-pointer select-none"
        >
          <div className="px-4 py-1 flex items-center justify-center">
            <LayoutGrid className="w-5 h-5 text-zinc-400 stroke-[1.8]" />
          </div>
          <span className="text-[10px] font-medium leading-tight mt-0.5 tracking-tight whitespace-nowrap text-zinc-400 text-center block">
            Mais
          </span>
        </motion.button>
      </div>
    </nav>
  );
};

