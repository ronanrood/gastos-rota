import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import type { Profile, UserRole, UserStatus } from '../../types/database';
import { createClient } from '@supabase/supabase-js';
import {
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  UserPlus,
  TrendingUp,
  Search,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  User,
  X,
  Check,
  Eye,
  Copy,
  ExternalLink,
  MapPin,
  Phone,
  CreditCard,
  Truck,
  Navigation,
  CalendarDays,
} from 'lucide-react';
import {
  formatCpfCnpj,
  formatPhone,
  formatCep,
  getInitials,
} from '../../utils/formatters';

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR');
};

export const AdminPage: React.FC = () => {
  const { user } = useAuth();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [totalPlatformRevenue, setTotalPlatformRevenue] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados do Modal "Cadastrar Novo Motorista"
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalNome, setModalNome] = useState('');
  const [modalEmail, setModalEmail] = useState('');
  const [modalPassword, setModalPassword] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  // Feedback geral da tela
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modal "Detalhes do Motorista"
  const [selectedDriver, setSelectedDriver] = useState<Profile | null>(null);
  const [copiedAdminPix, setCopiedAdminPix] = useState(false);

  const handleCopyAdminPix = async (pixKey: string) => {
    if (!pixKey) return;
    try {
      await navigator.clipboard.writeText(pixKey);
      setCopiedAdminPix(true);
      setTimeout(() => setCopiedAdminPix(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar PIX:', err);
    }
  };

  // Busca dados de usuários e faturamento global da plataforma
  const loadAdminData = useCallback(async (showLoading = false) => {
    if (!user) return;
    if (showLoading) setLoading(true);

    try {
      // 1. Lista de todos os perfis
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;
      if (profilesData) setProfiles(profilesData as Profile[]);

      // 2. Faturamento geral da plataforma (soma de faturamento_bruto em daily_earnings)
      const { data: earningsData, error: earningsError } = await supabase
        .from('daily_earnings')
        .select('faturamento_bruto, qtd_pecas, valor_unitario_peca, valor_extra_bonus');

      if (!earningsError && earningsData) {
        const total = earningsData.reduce((acc, curr) => {
          const val =
            typeof curr.faturamento_bruto === 'number'
              ? curr.faturamento_bruto
              : (curr.qtd_pecas || 0) * (curr.valor_unitario_peca || 0) + (curr.valor_extra_bonus || 0);
          return acc + val;
        }, 0);
        setTotalPlatformRevenue(total);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do painel admin:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let ignore = false;

    const init = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const [profilesRes, earningsRes] = await Promise.all([
          supabase.from('profiles').select('*').order('created_at', { ascending: false }),
          supabase.from('daily_earnings').select('faturamento_bruto, qtd_pecas, valor_unitario_peca, valor_extra_bonus'),
        ]);

        if (!ignore) {
          if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
          if (earningsRes.data) {
            const total = earningsRes.data.reduce((acc, curr) => {
              const val =
                typeof curr.faturamento_bruto === 'number'
                  ? curr.faturamento_bruto
                  : (curr.qtd_pecas || 0) * (curr.valor_unitario_peca || 0) + (curr.valor_extra_bonus || 0);
              return acc + val;
            }, 0);
            setTotalPlatformRevenue(total);
          }
        }
      } catch (err) {
        if (!ignore) console.error('Erro ao inicializar painel admin:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    init();

    return () => {
      ignore = true;
    };
  }, [user]);

  // Estatísticas calculadas
  const totalMotoristas = profiles.length;
  const motoristasAtivos = useMemo(() => {
    return profiles.filter((p) => p.status === 'active').length;
  }, [profiles]);

  // Lista filtrada por busca (nome ou email)
  const filteredProfiles = useMemo(() => {
    if (!searchTerm.trim()) return profiles;
    const term = searchTerm.toLowerCase();
    return profiles.filter(
      (p) =>
        (p.nome && p.nome.toLowerCase().includes(term)) ||
        (p.email && p.email.toLowerCase().includes(term))
    );
  }, [profiles, searchTerm]);

  // Alterar Status diretamente
  const handleToggleStatus = async (targetProfile: Profile) => {
    const newStatus: UserStatus = targetProfile.status === 'active' ? 'inactive' : 'active';
    setUpdatingId(targetProfile.id);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', targetProfile.id);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) => (p.id === targetProfile.id ? { ...p, status: newStatus } : p))
      );

      setFeedbackSuccess(
        `Status de "${targetProfile.nome}" alterado para ${newStatus === 'active' ? 'Ativo' : 'Inativo'}.`
      );
      setTimeout(() => setFeedbackSuccess(null), 3500);
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      alert('Não foi possível alterar o status do usuário.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Alterar Role diretamente
  const handleToggleRole = async (targetProfile: Profile) => {
    // Evitar que o próprio admin logado remova seu próprio papel de admin por acidente
    if (targetProfile.id === user?.id) {
      alert('Você não pode alterar sua própria função de Administrador.');
      return;
    }

    const newRole: UserRole = targetProfile.role === 'admin' ? 'driver' : 'admin';
    setUpdatingId(targetProfile.id);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetProfile.id);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) => (p.id === targetProfile.id ? { ...p, role: newRole } : p))
      );

      setFeedbackSuccess(
        `Função de "${targetProfile.nome}" alterada para ${newRole === 'admin' ? 'Administrador' : 'Motorista'}.`
      );
      setTimeout(() => setFeedbackSuccess(null), 3500);
    } catch (err) {
      console.error('Erro ao atualizar papel do usuário:', err);
      alert('Não foi possível alterar o papel do usuário.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Criação de Novo Motorista usando cliente temporário com persistSession: false
  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSuccess(null);

    const trimmedNome = modalNome.trim();
    const trimmedEmail = modalEmail.trim();
    const trimmedPassword = modalPassword.trim();

    if (!trimmedNome || !trimmedEmail || !trimmedPassword) {
      setModalError('Todos os campos são obrigatórios.');
      return;
    }

    if (trimmedPassword.length < 6) {
      setModalError('A senha provisória deve conter pelo menos 6 caracteres.');
      return;
    }

    setModalLoading(true);

    try {
      /**
       * REGRA DE SEGURANÇA CRÍTICA:
       * NUNCA use chave service_role ou sb_secret no navegador.
       * Para criar uma conta de motorista sem deslogar o Admin da sessão atual,
       * instanciamos um cliente temporário isolado do Supabase com { persistSession: false, autoRefreshToken: false }.
       */
      const rawUrl = import.meta.env.VITE_SUPABASE_URL;
      const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const tempClient = createClient(rawUrl, rawAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        options: {
          data: {
            nome: trimmedNome,
            role: 'driver',
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      // Garante que o perfil esteja inserido/atualizado na tabela profiles via cliente autenticado do Admin
      if (signUpData.user) {
        const newProf: Profile = {
          id: signUpData.user.id,
          nome: trimmedNome,
          email: trimmedEmail,
          role: 'driver',
          status: 'active',
          created_at: new Date().toISOString(),
        };

        const { data: upsertedProf, error: profError } = await supabase
          .from('profiles')
          .upsert(newProf)
          .select('*')
          .single();

        if (!profError && upsertedProf) {
          setProfiles((prev) => [upsertedProf as Profile, ...prev]);
        } else {
          setProfiles((prev) => [newProf, ...prev]);
        }
      }

      setModalSuccess(`Motorista "${trimmedNome}" cadastrado com sucesso!`);
      setModalNome('');
      setModalEmail('');
      setModalPassword('');

      setTimeout(() => {
        setIsModalOpen(false);
        setModalSuccess(null);
      }, 2000);
    } catch (err: unknown) {
      console.error('Erro ao cadastrar motorista:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao cadastrar motorista.';
      setModalError(msg);
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header do Painel Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Painel do Administrador
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestão operacional de motoristas, permissões e visão geral da plataforma
          </p>
        </div>

        {/* Botão de Cadastrar Motorista */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsModalOpen(true);
              setModalError(null);
              setModalSuccess(null);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 h-12 min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition active:scale-[0.98] cursor-pointer"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            Cadastrar Novo Motorista
          </button>

          <button
            type="button"
            onClick={() => loadAdminData(true)}
            disabled={loading}
            title="Atualizar lista"
            className="w-12 h-12 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-[0.96] cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* FEEDBACK DE AÇÃO */}
      {feedbackSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5 shadow-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <span className="font-semibold">{feedbackSuccess}</span>
        </div>
      )}

      {/* CARDS DE VISÃO GERAL (Bento Grid no Mobile / 3 colunas no Desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        {/* Card 1: Total de Motoristas */}
        <div className="w-full bg-slate-900 border border-slate-800/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-lg backdrop-blur-md min-w-0 flex flex-col justify-between">
          <div className="flex items-center justify-between min-w-0">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
              Cadastros
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-white mt-2 tracking-tight font-mono tabular-nums truncate">
            {totalMotoristas}
          </div>
          <span className="text-[10px] sm:text-xs text-slate-400 mt-0.5 block truncate">
            Total de usuários
          </span>
        </div>

        {/* Card 2: Motoristas Ativos */}
        <div className="w-full bg-slate-900 border border-slate-800/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-lg backdrop-blur-md min-w-0 flex flex-col justify-between">
          <div className="flex items-center justify-between min-w-0">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
              Ativos
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-emerald-400 mt-2 tracking-tight font-mono tabular-nums truncate">
            {motoristasAtivos}
          </div>
          <span className="text-[10px] sm:text-xs text-slate-400 mt-0.5 block truncate">
            {totalMotoristas > 0
              ? `${((motoristasAtivos / totalMotoristas) * 100).toFixed(0)}% liberados`
              : 'Nenhum ativo'}
          </span>
        </div>

        {/* Card 3: Faturamento Total da Frota */}
        <div className="col-span-2 sm:col-span-1 w-full bg-slate-900 border border-slate-800/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-lg backdrop-blur-md min-w-0 flex flex-col justify-between">
          <div className="flex items-center justify-between min-w-0">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
              Faturamento Global
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-amber-400 mt-2 tracking-tight font-mono tabular-nums truncate">
            {formatCurrency(totalPlatformRevenue)}
          </div>
          <span className="text-[10px] sm:text-xs text-slate-400 mt-0.5 block truncate">
            Movimentado em toda a plataforma
          </span>
        </div>
      </div>

      {/* TABELA DE MOTORISTAS / USUÁRIOS */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-4 mb-5">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Usuários Cadastrados 
            </h3>
            <p className="text-xs text-slate-400">
              Gerencie permissões de acesso e status de ativação
            </p>
          </div>

          {/* Campo de Busca */}
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="w-full pl-9 pr-3.5 py-3 sm:py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-base sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Lista / Tabela */}
        {filteredProfiles.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            {searchTerm
              ? 'Nenhum usuário encontrado correspondente à busca.'
              : 'Nenhum usuário cadastrado na tabela profiles.'}
          </div>
        ) : (
          <>
            {/* VISÃO MOBILE: CARDS VERTICAIS EMPILHADOS (block md:hidden) */}
            <div className="block md:hidden space-y-3">
              {filteredProfiles.map((p) => {
                const isCurrentUser = p.id === user?.id;
                const isUpdating = updatingId === p.id;

                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs shrink-0 overflow-hidden">
                          {p.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              alt={p.nome}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            getInitials(p.nome)
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white text-sm truncate">
                              {p.nome || 'Sem nome'}
                            </span>
                            {isCurrentUser && (
                              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">
                                Você
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 font-mono block truncate mt-0.5">
                            {p.email}
                          </span>
                          {(p.transportadora || p.rota) && (
                            <span className="text-[10px] text-emerald-400 block truncate mt-0.5 font-medium">
                              🚚 {p.transportadora} {p.rota ? `• ${p.rota}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono shrink-0">
                        {formatDate(p.created_at)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                      {/* Toggle Função */}
                      <button
                        type="button"
                        disabled={isUpdating || isCurrentUser}
                        onClick={() => handleToggleRole(p)}
                        className={`h-11 min-h-[44px] rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          p.role === 'admin'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {p.role === 'admin' ? (
                          <>
                            <ShieldCheck className="w-4 h-4 text-amber-400" />
                            Admin
                          </>
                        ) : (
                          'Motorista'
                        )}
                      </button>

                      {/* Toggle Status */}
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleToggleStatus(p)}
                        className={`h-11 min-h-[44px] rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer disabled:opacity-50 ${
                          p.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {p.status === 'active' ? (
                          <>
                            <UserCheck className="w-4 h-4 text-emerald-400" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <UserX className="w-4 h-4 text-rose-400" />
                            Inativo
                          </>
                        )}
                      </button>
                    </div>

                    {/* Botão Ver Detalhes e PIX no Mobile */}
                    <button
                      type="button"
                      onClick={() => setSelectedDriver(p)}
                      className="w-full h-10 min-h-[40px] rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-emerald-400" />
                      Ver Ficha, Rota e PIX
                    </button>
                  </div>
                );
              })}
            </div>

            {/* VISÃO TABLET E DESKTOP: TABELA TRADICIONAL (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3">Motorista</th>
                    <th className="py-3 px-3">E-mail</th>
                    <th className="py-3 px-3">Rota / Empresa</th>
                    <th className="py-3 px-3 text-center">Função</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Ficha</th>
                    <th className="py-3 px-3 text-right">Cadastrado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredProfiles.map((p) => {
                    const isCurrentUser = p.id === user?.id;
                    const isUpdating = updatingId === p.id;

                    return (
                      <tr key={p.id} className="hover:bg-slate-950/40 transition">
                        {/* Nome + Avatar */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs shrink-0 overflow-hidden">
                              {p.avatar_url ? (
                                <img
                                  src={p.avatar_url}
                                  alt={p.nome}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                getInitials(p.nome)
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-white block">
                                {p.nome || 'Sem nome'}
                              </span>
                              {isCurrentUser && (
                                <span className="text-[10px] text-emerald-400 font-semibold">
                                  (Você)
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* E-mail */}
                        <td className="py-3.5 px-3 text-slate-300 font-mono text-[11px]">
                          {p.email}
                        </td>

                        {/* Rota / Transportadora */}
                        <td className="py-3.5 px-3 text-slate-300 text-[11px]">
                          {p.transportadora || p.rota ? (
                            <span className="truncate max-w-[150px] block">
                              {p.transportadora} {p.rota ? `• ${p.rota}` : ''}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">-</span>
                          )}
                        </td>

                        {/* Role Toggle */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            disabled={isUpdating || isCurrentUser}
                            onClick={() => handleToggleRole(p)}
                            title={
                              isCurrentUser
                                ? 'Você não pode alterar sua própria função'
                                : 'Clique para alternar entre Motorista e Administrador'
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                              p.role === 'admin'
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                            }`}
                          >
                            {p.role === 'admin' ? (
                              <>
                                <ShieldCheck className="w-3 h-3 text-amber-400" />
                                Admin
                              </>
                            ) : (
                              'Motorista'
                            )}
                          </button>
                        </td>

                        {/* Status Toggle */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleToggleStatus(p)}
                            title="Clique para alternar entre Ativo e Inativo"
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider transition cursor-pointer disabled:opacity-50 ${
                              p.status === 'active'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                            }`}
                          >
                            {p.status === 'active' ? (
                              <>
                                <UserCheck className="w-3 h-3 text-emerald-400" />
                                Ativo
                              </>
                            ) : (
                              <>
                                <UserX className="w-3 h-3 text-rose-400" />
                                Inativo
                              </>
                            )}
                          </button>
                        </td>

                        {/* Ver Ficha / Detalhes */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedDriver(p)}
                            title="Ver Ficha Completa e PIX do Motorista"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-bold uppercase transition active:scale-[0.96] cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-emerald-400" />
                            Ficha
                          </button>
                        </td>

                        {/* Data */}
                        <td className="py-3.5 px-3 text-right text-slate-400 font-mono text-[11px]">
                          {formatDate(p.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* MODAL: CADASTRAR NOVO MOTORISTA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Novo Motorista</h3>
                  <p className="text-xs text-slate-400">Criar credenciais de acesso</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Alertas */}
            {modalError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{modalSuccess}</span>
              </div>
            )}

            {/* Formulário do Modal */}
            <form onSubmit={handleCreateDriver} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={modalNome}
                    onChange={(e) => setModalNome(e.target.value)}
                    placeholder="Ex: Pedro Henrique Silva"
                    className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-base sm:text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  E-mail de Acesso
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={modalEmail}
                    onChange={(e) => setModalEmail(e.target.value)}
                    placeholder="motorista@email.com"
                    className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-base sm:text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Senha Provisória
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={modalPassword}
                    onChange={(e) => setModalPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-base sm:text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                🛡️ <strong>Segurança:</strong> A conta será criada sem interferir na sua sessão atual de Administrador. O motorista poderá alterar a senha após o primeiro acesso.
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 h-12 min-h-[48px] rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm sm:text-xs font-semibold transition active:scale-[0.98] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="w-1/2 h-12 min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 text-sm sm:text-xs font-bold shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
                >
                  {modalLoading ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Criar Conta
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES DO MOTORISTA (FICHA CADASTRAL, PIX E ROTA) */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-5 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-lg shrink-0 overflow-hidden shadow-md">
                  {selectedDriver.avatar_url ? (
                    <img
                      src={selectedDriver.avatar_url}
                      alt={selectedDriver.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getInitials(selectedDriver.nome)
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white truncate">
                    {selectedDriver.nome || 'Motorista'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono truncate">{selectedDriver.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        selectedDriver.role === 'admin'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {selectedDriver.role === 'admin' ? 'Administrador' : 'Motorista'}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        selectedDriver.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {selectedDriver.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDriver(null)}
                className="w-10 h-10 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-[0.95] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo da Ficha */}
            <div className="space-y-4">
              {/* Destaque CHAVE PIX */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    Chave PIX para Pagamento
                  </span>
                  {selectedDriver.chave_pix && (
                    <button
                      type="button"
                      onClick={() => handleCopyAdminPix(selectedDriver.chave_pix || '')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-xs transition active:scale-[0.96] cursor-pointer shadow-xs"
                    >
                      {copiedAdminPix ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar Chave
                        </>
                      )}
                    </button>
                  )}
                </div>
                <p className="text-sm font-mono font-bold text-white break-all mt-1">
                  {selectedDriver.chave_pix || 'Chave PIX ainda não cadastrada pelo motorista'}
                </p>
              </div>

              {/* Informações Pessoais e Operacionais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                    CPF ou CNPJ
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    {selectedDriver.cpf_cnpj ? formatCpfCnpj(selectedDriver.cpf_cnpj) : 'Não informado'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-400" />
                      Telefone / WhatsApp
                    </span>
                    {selectedDriver.telefone && (
                      <a
                        href={`https://wa.me/55${selectedDriver.telefone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-0.5"
                      >
                        WhatsApp <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <span className="text-xs font-mono font-bold text-white">
                    {selectedDriver.telefone ? formatPhone(selectedDriver.telefone) : 'Não informado'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                    <Truck className="w-3 h-3 text-teal-400" />
                    Transportadora
                  </span>
                  <span className="text-xs font-bold text-white">
                    {selectedDriver.transportadora || 'Não informada'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-teal-400" />
                    Rota de Entrega
                  </span>
                  <span className="text-xs font-bold text-white">
                    {selectedDriver.rota || 'Não informada'}
                  </span>
                </div>
              </div>

              {/* Endereço */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  Endereço Cadastrado
                </span>
                {selectedDriver.endereco || selectedDriver.cidade ? (
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {selectedDriver.endereco ? `${selectedDriver.endereco}, ` : ''}
                    {selectedDriver.numero ? `nº ${selectedDriver.numero} - ` : ''}
                    {selectedDriver.bairro ? `${selectedDriver.bairro}, ` : ''}
                    {selectedDriver.cidade ? `${selectedDriver.cidade}` : ''}
                    {selectedDriver.estado ? ` - ${selectedDriver.estado}` : ''}
                    {selectedDriver.cep ? ` (CEP: ${formatCep(selectedDriver.cep)})` : ''}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 italic">Endereço ainda não preenchido.</p>
                )}
              </div>

              {/* Configuração de Ciclo */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1 flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
                  Ciclo de Recebimento
                </span>
                <p className="text-slate-300">
                  Frequência: <strong className="text-white capitalize">{selectedDriver.tipo_recebimento || 'Quinzenal'}</strong>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  • Pagamento 1: dia {selectedDriver.dia_pagamento_1 || 17} (Corte {selectedDriver.corte_1_inicio || 16} a {selectedDriver.corte_1_fim || 31})
                </p>
                {selectedDriver.tipo_recebimento !== 'mensal' && (
                  <p className="text-[11px] text-slate-400">
                    • Pagamento 2: dia {selectedDriver.dia_pagamento_2 || 2} (Corte {selectedDriver.corte_2_inicio || 1} a {selectedDriver.corte_2_fim || 15})
                  </p>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="pt-4 mt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDriver(null)}
                className="w-full sm:w-auto h-11 min-h-[44px] px-6 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white font-bold text-xs transition active:scale-[0.98] cursor-pointer"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
