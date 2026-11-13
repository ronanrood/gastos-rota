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
  tools: 'Tools & Calculadoras',
  profile: 'Meu Perfil',
  admin: 'Painel Admin',
};

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentView,
  onSelectView,
  children,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const handleOpenProfile = () => {
    setDrawerOpen(false);
    onSelectView('profile');
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500 selection:text-zinc-950 overflow-hidden">
      {/* Header Fixo no Topo do Shell Nativo com Suporte a Safe Area */}
      <Header
        onOpenDrawer={() => setDrawerOpen(true)}
        currentTitle={VIEW_TITLES[currentView] || 'Gastos Rota'}
        onOpenProfile={handleOpenProfile}
      />

      {/* Gaveta Lateral (Menu Hambúrguer) */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentView={currentView}
        onSelectView={onSelectView}
      />

      {/* Conteúdo Principal Rolável (Miolo do Shell Nativo) */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden w-full overscroll-none">
        <div className="w-full max-w-7xl mx-auto px-4 pt-4 pb-28 md:pb-8 md:px-8">
          {/* Banner discreto de instalação PWA (oculta automaticamente se standalone) */}
          <InstallPwaBanner />
          {children}
        </div>
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
