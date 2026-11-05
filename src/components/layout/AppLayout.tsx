import React, { useState } from 'react';
import { Header } from './Header';
import { Drawer, type ViewType } from './Drawer';

interface AppLayoutProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  children: React.ReactNode;
}

const VIEW_TITLES: Record<ViewType, string> = {
  earnings: 'Ganhos Diários',
  dashboard: 'Dashboard Financeiro',
  fuel: 'Combustível',
  maintenance: 'Oficina e Manutenção',
  vehicle: 'Meu Veículo',
  admin: 'Painel Admin',
};

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentView,
  onSelectView,
  children,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Header Fixo */}
      <Header
        onOpenDrawer={() => setDrawerOpen(true)}
        currentTitle={VIEW_TITLES[currentView] || 'Gastos Rota'}
      />

      {/* Gaveta Lateral (Menu Hambúrguer) */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentView={currentView}
        onSelectView={onSelectView}
      />

      {/* Conteúdo Principal com compensação da barra fixa */}
      <main className="flex-1 pt-18 sm:pt-20 pb-16 px-3.5 sm:px-6 max-w-5xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
};

