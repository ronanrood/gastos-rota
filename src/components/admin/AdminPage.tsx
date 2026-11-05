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
} from 'lucide-react';

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
    <div className="space-y-6 max-w-4xl mx-auto">
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            Cadastrar Novo Motorista
          </button>

          <button
            type="button"
            onClick={() => loadAdminData(true)}
            disabled={loading}
            title="Atualizar lista"
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
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

      {/* CARDS DE VISÃO GERAL */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Card 1: Total de Motoristas */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-3xl p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total de Cadastros
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-3 tracking-tight font-mono">
            {totalMotoristas}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            Usuários registrados no banco
          </span>
        </div>

        {/* Card 2: Motoristas Ativos */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-3xl p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Motoristas Ativos
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-3 tracking-tight font-mono">
            {motoristasAtivos}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            {totalMotoristas > 0
              ? `${((motoristasAtivos / totalMotoristas) * 100).toFixed(0)}% com acesso liberado`
              : 'Nenhum ativo'}
          </span>
        </div>

        {/* Card 3: Faturamento Total da Frota */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-3xl p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Faturamento Global
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-3 tracking-tight font-mono">
            {formatCurrency(totalPlatformRevenue)}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
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
              Usuários Cadastrados (`profiles`)
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
              className="w-full pl-9 pr-3.5 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3">Motorista</th>
                  <th className="py-3 px-3">E-mail</th>
                  <th className="py-3 px-3 text-center">Função</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Cadastrado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProfiles.map((p) => {
                  const isCurrentUser = p.id === user?.id;
                  const isUpdating = updatingId === p.id;

                  return (
                    <tr key={p.id} className="hover:bg-slate-950/40 transition">
                      {/* Nome */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs shrink-0">
                            {p.nome ? p.nome.charAt(0).toUpperCase() : 'M'}
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
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={modalNome}
                    onChange={(e) => setModalNome(e.target.value)}
                    placeholder="Ex: Pedro Henrique Silva"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  E-mail de Acesso
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={modalEmail}
                    onChange={(e) => setModalEmail(e.target.value)}
                    placeholder="motorista@email.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Senha Provisória
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={modalPassword}
                    onChange={(e) => setModalPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="w-1/2 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
    </div>
  );
};
