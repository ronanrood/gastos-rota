import React, { useState } from 'react';
import { Header } from './Header';
import { Drawer, type ViewType } from './Drawer';
import { BottomNav } from './BottomNav';
import { InstallPwaBanner } from '../pwa/InstallPwaBanner';

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950 overflow-x-hidden">
      {/* Header Fixo / Sticky */}
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

      {/* Conteúdo Principal: Com compensação superior para o Header e inferior para a BottomNav */}
      <main className="flex-1 pt-18 sm:pt-20 pb-24 md:pb-12 px-3 sm:px-6 max-w-6xl w-full mx-auto overflow-x-hidden">
        {/* Banner discreto de instalação PWA (oculta automaticamente se standalone) */}
        <InstallPwaBanner />
        {children}
      </main>

      {/* Barra de Navegação Rápida Inferior (apenas celular md:hidden) */}
      <BottomNav
        currentView={currentView}
        onSelectView={onSelectView}
        onOpenDrawer={() => setDrawerOpen(true)}
      />
    </div>
  );
};
