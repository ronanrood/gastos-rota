import React, { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import { AuthPage } from './components/auth/AuthPage';
import { AppLayout } from './components/layout/AppLayout';
import { type ViewType } from './components/layout/Drawer';
import { DailyEarningsPage } from './components/earnings/DailyEarningsPage';
import { PlaceholderView } from './components/views/PlaceholderView';
import { Truck } from 'lucide-react';

const HASH_TO_VIEW: Record<string, ViewType> = {
  '#ganhos': 'earnings',
  '#dashboard': 'dashboard',
  '#combustivel': 'fuel',
  '#manutencao': 'maintenance',
  '#veiculo': 'vehicle',
  '#admin': 'admin',
};

const VIEW_TO_HASH: Record<ViewType, string> = {
  earnings: '#ganhos',
  dashboard: '#dashboard',
  fuel: '#combustivel',
  maintenance: '#manutencao',
  vehicle: '#veiculo',
  admin: '#admin',
};

const MainContent: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('earnings');

  // Sincroniza estado da visualização com a hash da URL
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash && HASH_TO_VIEW[hash]) {
        setCurrentView(HASH_TO_VIEW[hash]);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSelectView = (view: ViewType) => {
    if (view === 'admin' && profile?.role !== 'admin') {
      setCurrentView('earnings');
      window.location.hash = VIEW_TO_HASH.earnings;
      return;
    }
    setCurrentView(view);
    window.location.hash = VIEW_TO_HASH[view] || '#ganhos';
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

  return (
    <AppLayout currentView={effectiveView} onSelectView={handleSelectView}>
      {effectiveView === 'earnings' ? (
        <DailyEarningsPage />
      ) : (
        <PlaceholderView
          view={effectiveView}
          onGoToEarnings={() => handleSelectView('earnings')}
        />
      )}
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
