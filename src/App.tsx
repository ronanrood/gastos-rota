import React, { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import { AuthPage } from './components/auth/AuthPage';
import { AppLayout } from './components/layout/AppLayout';
import { type ViewType } from './components/layout/Drawer';
import { DailyEarningsPage } from './components/earnings/DailyEarningsPage';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { VehiclePage } from './components/vehicle/VehiclePage';
import { FuelPage } from './components/fuel/FuelPage';
import { MaintenancePage } from './components/maintenance/MaintenancePage';
import { ProfilePage } from './components/profile/ProfilePage';
import { ToolsPage } from './components/tools/ToolsPage';
import { AdminPage } from './components/admin/AdminPage';
import { Truck, ShieldAlert, LogOut } from 'lucide-react';

const VIEW_TO_HASH: Record<ViewType, string> = {
  earnings: '#ganhos',
  dashboard: '#dashboard',
  fuel: '#combustivel',
  maintenance: '#manutencao',
  vehicle: '#veiculo',
  tools: '#tools',
  profile: '#perfil',
  admin: '#admin',
};

// Reconhece tanto a hash da URL (#perfil, #/perfil) quanto o pathname (/perfil)
const resolveViewFromLocation = (): ViewType => {
  if (typeof window === 'undefined') return 'earnings';

  const rawHash = window.location.hash.toLowerCase().replace(/^#\/?/, '').trim();
  const rawPath = window.location.pathname.toLowerCase().replace(/^\/?/, '').replace(/\/$/, '').trim();

  const route = rawHash || rawPath;

  switch (route) {
    case 'perfil':
    case 'profile':
      return 'profile';
    case 'dashboard':
    case 'painel':
      return 'dashboard';
    case 'combustivel':
    case 'fuel':
      return 'fuel';
    case 'manutencao':
    case 'maintenance':
    case 'oficina':
      return 'maintenance';
    case 'veiculo':
    case 'vehicle':
      return 'vehicle';
    case 'tools':
    case 'ferramentas':
    case 'calculadoras':
      return 'tools';
    case 'admin':
      return 'admin';
    case 'ganhos':
    case 'earnings':
    case 'inicio':
    default:
      return 'earnings';
  }
};

const MainContent: React.FC = () => {
  const { user, profile, loading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>(() => resolveViewFromLocation());

  // Sincroniza estado da visualização com a hash e histórico de navegação da URL
  useEffect(() => {
    const handleLocationChange = () => {
      const resolved = resolveViewFromLocation();
      setCurrentView(resolved);
    };

    handleLocationChange();
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const handleSelectView = (view: ViewType) => {
    if (view === 'admin' && profile?.role !== 'admin') {
      setCurrentView('earnings');
      window.location.hash = VIEW_TO_HASH.earnings;
      return;
    }
    setCurrentView(view);
    const targetHash = VIEW_TO_HASH[view] || '#ganhos';
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  };

  // Se o usuário não for admin mas a rota atual for admin, renderiza earnings
  const effectiveView: ViewType =
    currentView === 'admin' && profile && profile.role !== 'admin'
      ? 'earnings'
      : currentView;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white px-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center shadow-xl shadow-emerald-500/20 mb-4 animate-pulse">
          <Truck className="w-8 h-8 stroke-[2.2]" />
        </div>
        <div className="text-lg font-bold tracking-tight">Gastos Rota</div>
        <p className="text-xs text-slate-400 mt-1">Carregando seus dados...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  // Se o motorista estiver inativo, bloqueia o acesso às telas internas
  if (profile?.status === 'inactive') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white px-4">
        <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl backdrop-blur-md">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Conta Desativada pelo Administrador
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
            Seu acesso ao sistema foi suspenso temporariamente. Entre em contato com o suporte ou com a administração da frota para reativar seu cadastro.
          </p>
          <div className="mt-6 pt-5 border-t border-slate-800">
            <button
              type="button"
              onClick={signOut}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-300 font-semibold text-xs transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Encerrar Sessão
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppLayout currentView={effectiveView} onSelectView={handleSelectView}>
      {effectiveView === 'earnings' && <DailyEarningsPage />}
      {effectiveView === 'dashboard' && <DashboardPage />}
      {effectiveView === 'fuel' && <FuelPage />}
      {effectiveView === 'maintenance' && <MaintenancePage />}
      {effectiveView === 'vehicle' && <VehiclePage />}
      {effectiveView === 'tools' && <ToolsPage />}
      {effectiveView === 'profile' && <ProfilePage />}
      {effectiveView === 'admin' && <AdminPage />}
    </AppLayout>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

export default App;
