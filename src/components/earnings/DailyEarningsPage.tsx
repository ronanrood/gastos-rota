import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import type { DailyEarning, Vehicle, PaymentCycleRecord } from '../../types/database';
import { AnimatedCounter } from '../common/AnimatedCounter';
import { staggerContainerVariants, staggerItemVariants } from '../common/MotionVariants';
import {
  Calendar,
  Package,
  DollarSign,
  Gift,
  Gauge,
  PlusCircle,
  Trash2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  RotateCw,
  FileText,
  Sparkles,
  Info,
  ChevronDown,
  Pencil,
  RotateCcw,
  Plus,
} from 'lucide-react';
import { BottomSheetModal } from '../common/BottomSheetModal';
import { PaymentCyclesCards } from '../payment/PaymentCyclesCards';
import { PaymentCyclesHistory } from '../payment/PaymentCyclesHistory';
import { EditEarningModal } from './EditEarningModal';
import { HistoryFilterBar } from '../filters/HistoryFilterBar';
import { EarningsFilterSummary } from '../filters/EarningsFilterSummary';
import { getMostUrgentMaintenanceAlert } from '../../utils/vehicleHealth';
import {
  type HistoryFilterState,
  getDefaultFilterState,
  calculateFilterDateRange,
  formatCardDateBadge,
} from '../../utils/filterUtils';

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
};

export const DailyEarningsPage: React.FC = () => {
  const { user, profile } = useAuth();

  // Formulário - inicialização pura
  const [data, setData] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [qtdPecas, setQtdPecas] = useState<string>('');
  const [valorUnitarioPeca, setValorUnitarioPeca] = useState<string>(() =>
    profile?.valor_padrao_peca ? profile.valor_padrao_peca.toString() : ''
  );
  const [valorExtraBonus, setValorExtraBonus] = useState<string>('0');
  const [kmRodado, setKmRodado] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');

  // Estados de controle
  const [submitting, setSubmitting] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [earningsList, setEarningsList] = useState<DailyEarning[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [paymentRecords, setPaymentRecords] = useState<PaymentCycleRecord[]>([]);
  const [filterState, setFilterState] = useState<HistoryFilterState>(getDefaultFilterState);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingEarning, setEditingEarning] = useState<DailyEarning | null>(null);

  // Estados para expansão inteligente tipo Accordion nos cards de histórico
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAllExpanded, setIsAllExpanded] = useState<boolean>(false);

  // Controle da Gaveta Inferior (Bottom Sheet) no Mobile
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);

  const toggleItemExpand = useCallback((id: string) => {
    setIsAllExpanded(false);
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const toggleAllExpanded = useCallback(() => {
    setIsAllExpanded((prev) => !prev);
    setExpandedId(null);
  }, []);

  const handleOpenNewForm = useCallback(() => {
    setData(new Date().toISOString().split('T')[0]);
    setQtdPecas('');
    if (profile?.valor_padrao_peca) {
      setValorUnitarioPeca(profile.valor_padrao_peca.toString());
    }
    setValorExtraBonus('0');
    setKmRodado('');
    setObservacoes('');
    setFormError(null);
    setIsFormOpen(true);

    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      const el = document.getElementById('daily-earnings-form-section');
      el?.scrollIntoView({ behavior: 'smooth' });
      const firstInput = el?.querySelector('input');
      firstInput?.focus();
    }
  }, [profile]);

  const handleEditSuccess = (updated: DailyEarning) => {
    setEarningsList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setFormSuccess('Lançamento atualizado com sucesso!');
    setTimeout(() => {
      setFormSuccess(null);
    }, 4000);
  };

  const handlePaymentRecordUpdated = (updatedRecord: PaymentCycleRecord) => {
    setPaymentRecords((prev) => {
      const exists = prev.some((r) => r.referencia_chave === updatedRecord.referencia_chave);
      if (exists) {
        return prev.map((r) =>
          r.referencia_chave === updatedRecord.referencia_chave ? updatedRecord : r
        );
      }
      return [updatedRecord, ...prev];
    });
  };

  const handlePaymentRecordReverted = (refKey: string) => {
    setPaymentRecords((prev) =>
      prev.map((r) =>
        r.referencia_chave === refKey
          ? { ...r, status: 'pendente', valor_recebido: null, data_confirmacao: null, observacoes: null }
          : r
      )
    );
  };

  // Visor em tempo real do Total Bruto Estimado
  const numPecas = parseFloat(qtdPecas) || 0;
  const numValorUnit = parseFloat(valorUnitarioPeca) || 0;
  const numBonus = parseFloat(valorExtraBonus) || 0;
  const numKm = parseFloat(kmRodado) || 0;

  const totalBrutoEstimado = useMemo(() => {
    return numPecas * numValorUnit + numBonus;
  }, [numPecas, numValorUnit, numBonus]);

  const rendimentoPorKmEstimado = useMemo(() => {
    if (numKm > 0 && totalBrutoEstimado > 0) {
      return totalBrutoEstimado / numKm;
    }
    return 0;
  }, [totalBrutoEstimado, numKm]);

  // Filtragem e Ordenação avançada dos lançamentos
  const filteredEarningsList = useMemo(() => {
    const { startDate, endDate } = calculateFilterDateRange(filterState, profile);
    const q = filterState.searchQuery.trim().toLowerCase();

    return earningsList
      .filter((item) => {
        // Filtro por Data
        if (startDate && item.data < startDate) return false;
        if (endDate && item.data > endDate) return false;

        // Filtro por Busca Instantânea (observação, data, peças, bônus, faturamento)
        if (q) {
          const obs = (item.observacoes || '').toLowerCase();
          const dStr = (item.data || '').toLowerCase();
          const dFormatted = formatDate(item.data).toLowerCase();
          const pecas = (item.qtd_pecas || '').toString();
          const bonus = (item.valor_extra_bonus || '').toString();
          const faturamento = (
            typeof item.faturamento_bruto === 'number'
              ? item.faturamento_bruto
              : item.qtd_pecas * item.valor_unitario_peca + item.valor_extra_bonus
          ).toFixed(2);

          const matches =
            obs.includes(q) ||
            dStr.includes(q) ||
            dFormatted.includes(q) ||
            pecas.includes(q) ||
            bonus.includes(q) ||
            faturamento.includes(q);

          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const fatA =
          typeof a.faturamento_bruto === 'number'
            ? a.faturamento_bruto
            : a.qtd_pecas * a.valor_unitario_peca + a.valor_extra_bonus;
        const fatB =
          typeof b.faturamento_bruto === 'number'
            ? b.faturamento_bruto
            : b.qtd_pecas * b.valor_unitario_peca + b.valor_extra_bonus;

        if (filterState.sortBy === 'oldest') {
          return (a.data || '').localeCompare(b.data || '') || (a.created_at || '').localeCompare(b.created_at || '');
        }
        if (filterState.sortBy === 'highest_value') {
          return fatB - fatA;
        }
        if (filterState.sortBy === 'lowest_value') {
          return fatA - fatB;
        }
        // padrão: 'recent'
        return (b.data || '').localeCompare(a.data || '') || (b.created_at || '').localeCompare(a.created_at || '');
      });
  }, [earningsList, filterState, profile]);

  // Carregar lançamentos sob demanda (ex: ao clicar em recarregar ou após inserção)
  const refreshEarnings = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);
    try {
      const [earningsRes, paymentRes] = await Promise.all([
        supabase
          .from('daily_earnings')
          .select('*')
          .eq('user_id', user.id)
          .order('data', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('payment_cycles')
          .select('*')
          .eq('user_id', user.id),
      ]);

      if (earningsRes.error) {
        console.error('Erro ao carregar ganhos:', earningsRes.error.message);
      } else if (earningsRes.data) {
        setEarningsList(earningsRes.data as DailyEarning[]);
      }
      if (paymentRes.data) {
        setPaymentRecords(paymentRes.data as PaymentCycleRecord[]);
      }
    } catch (err) {
      console.error('Falha na requisição de ganhos:', err);
    } finally {
      setLoadingList(false);
    }
  }, [user]);

  // Carregamento inicial sincronizado
  useEffect(() => {
    let ignore = false;

    const loadData = async () => {
      if (!user) {
        setLoadingList(false);
        return;
      }
      try {
        const [earningsRes, vehicleRes, paymentCyclesRes] = await Promise.all([
          supabase
            .from('daily_earnings')
            .select('*')
            .eq('user_id', user.id)
            .order('data', { ascending: false })
            .order('created_at', { ascending: false }),
          supabase
            .from('vehicles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('payment_cycles')
            .select('*')
            .eq('user_id', user.id),
        ]);

        if (!ignore) {
          if (earningsRes.error) {
            console.error('Erro ao carregar ganhos:', earningsRes.error.message);
          } else if (earningsRes.data) {
            setEarningsList(earningsRes.data as DailyEarning[]);
          }
          if (vehicleRes.data) {
            setVehicle(vehicleRes.data as Vehicle);
          }
          if (paymentCyclesRes.data) {
            setPaymentRecords(paymentCyclesRes.data as PaymentCycleRecord[]);
          }
          if (profile?.valor_padrao_peca) {
            setValorUnitarioPeca((curr) => curr || profile.valor_padrao_peca!.toString());
          }
        }
      } catch (err) {
        if (!ignore) console.error('Falha na requisição de ganhos:', err);
      } finally {
        if (!ignore) setLoadingList(false);
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, [user, profile?.valor_padrao_peca]);

  // Submissão do lançamento diário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!user) {
      setFormError('Sessão expirada. Por favor faça login novamente.');
      return;
    }

    if (!data) {
      setFormError('Informe a data do lançamento.');
      return;
    }

    if (numPecas <= 0) {
      setFormError('A quantidade de peças deve ser maior que zero.');
      return;
    }

    if (numValorUnit < 0) {
      setFormError('O valor por peça não pode ser negativo.');
      return;
    }

    if (numBonus < 0) {
      setFormError('O valor de bônus não pode ser negativo.');
      return;
    }

    if (numKm < 0) {
      setFormError('O KM rodado não pode ser negativo.');
      return;
    }

    setSubmitting(true);

    try {
      /**
       * IMPORTANTE: No INSERT para 'daily_earnings', NÃO envie a coluna 'faturamento_bruto',
       * pois ela é gerada automaticamente pelo PostgreSQL (GENERATED ALWAYS).
       */
      const payload = {
        user_id: user.id,
        data,
        qtd_pecas: Math.floor(numPecas),
        valor_unitario_peca: Number(numValorUnit.toFixed(2)),
        valor_extra_bonus: Number(numBonus.toFixed(2)),
        km_rodado: Number(numKm.toFixed(1)),
        observacoes: observacoes.trim() ? observacoes.trim() : null,
      };

      const { data: inserted, error } = await supabase
        .from('daily_earnings')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      setFormSuccess('Lançamento registrado com sucesso!');
      setIsFormOpen(false);

      // Atualiza a lista local com o registro retornado do banco
      if (inserted) {
        setEarningsList((prev) => [inserted as DailyEarning, ...prev]);

        // Soma automaticamente o KM rodado ao odômetro atual do veículo
        if (numKm > 0) {
          try {
            const currentVehKm = vehicle?.km_atual || 0;
            const updatedKm = Number((currentVehKm + numKm).toFixed(1));

            // Atualiza estado local imediatamente
            setVehicle((prev) => (prev ? { ...prev, km_atual: updatedKm } : null));

            // Salva no banco de dados
            if (vehicle?.id) {
              await supabase
                .from('vehicles')
                .update({ km_atual: updatedKm })
                .eq('id', vehicle.id);
            } else {
              // Fallback se id não estava em memória
              const { data: v } = await supabase
                .from('vehicles')
                .select('id, km_atual')
                .eq('user_id', user.id)
                .maybeSingle();

              if (v) {
                const newKm = Number(((v.km_atual || 0) + numKm).toFixed(1));
                await supabase
                  .from('vehicles')
                  .update({ km_atual: newKm })
                  .eq('id', v.id);
                setVehicle((prev) => (prev ? { ...prev, km_atual: newKm } : (v as Vehicle)));
              }
            }
          } catch (vehErr) {
            console.warn('Erro ao atualizar odômetro do veículo:', vehErr);
          }
        }
      } else {
        await refreshEarnings();
      }

      // Limpa os campos para o próximo lançamento mantendo a data e opcionalmente o valor da peça
      setQtdPecas('');
      setValorExtraBonus('0');
      setKmRodado('');
      setObservacoes('');

      // Auto ocultar mensagem de sucesso após 4s
      setTimeout(() => {
        setFormSuccess(null);
      }, 4000);
    } catch (err: unknown) {
      console.error('Erro ao salvar lançamento:', err);
      const msg = err instanceof Error ? err.message : 'Erro ao salvar lançamento.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Exclusão de lançamento
  const handleDelete = async (id: string) => {
    if (!user) return;
    setDeletingId(id);

    try {
      const { error } = await supabase
        .from('daily_earnings')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setEarningsList((prev) => prev.filter((item) => item.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Erro ao excluir lançamento:', err);
      alert('Não foi possível excluir o lançamento. Tente novamente.');
    } finally {
      setDeletingId(null);
    }
  };

  // Totais rápidos acumulados dos lançamentos listados
  const totalFaturadoAcumulado = useMemo(() => {
    return earningsList.reduce((acc, curr) => {
      // faturamento_bruto gerado pelo banco ou fallback de cálculo
      const valor =
        typeof curr.faturamento_bruto === 'number'
          ? curr.faturamento_bruto
          : curr.qtd_pecas * curr.valor_unitario_peca + curr.valor_extra_bonus;
      return acc + valor;
    }, 0);
  }, [earningsList]);

  const totalPecasEntregues = useMemo(() => {
    return earningsList.reduce((acc, curr) => acc + (curr.qtd_pecas || 0), 0);
  }, [earningsList]);

  const totalKmAcumulado = useMemo(() => {
    return earningsList.reduce((acc, curr) => acc + (curr.km_rodado || 0), 0);
  }, [earningsList]);

  // Alerta mais urgente de manutenção preventiva do veículo
  const healthAlert = useMemo(() => {
    if (!vehicle) return null;
    return getMostUrgentMaintenanceAlert(vehicle, vehicle.km_atual || 0);
  }, [vehicle]);

  // Renderiza o formulário de ganho diário (compartilhado entre a coluna lateral desktop e o Bottom Sheet mobile)
  const renderEarningsForm = (isModal: boolean = false) => (
    <div
      className={`space-y-4 ${
        isModal
          ? ''
          : 'bg-slate-900 border border-slate-800/90 rounded-3xl shadow-2xl p-5 sm:p-7 relative overflow-hidden backdrop-blur-md'
      }`}
    >
      {!isModal && (
        <>
          {/* Decorative corner glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header do Card Desktop */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center shadow-md shadow-emerald-500/20 font-bold">
                <PlusCircle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  Novo Lançamento Diário
                </h2>
                <p className="text-xs text-slate-400">
                  Registre os dados da sua rota de hoje
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Tempo real
            </span>
          </div>
        </>
      )}

      {/* FEEDBACKS (ERRO / SUCESSO) */}
      {formError && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Erro ao salvar</p>
            <p className="text-rose-300/90">{formError}</p>
          </div>
        </div>
      )}

      {formSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold">{formSuccess}</div>
        </div>
      )}

      {/* VISOR DE TOTAL BRUTO ESTIMADO (Destaque Principal) */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border-2 border-emerald-500/40 p-4 sm:p-5 relative shadow-inner">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <TrendingUp className="w-4 h-4" />
              Total Bruto Estimado
            </div>
            {rendimentoPorKmEstimado > 0 && (
              <span className="bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30 font-semibold font-mono text-[11px]">
                {formatCurrency(rendimentoPorKmEstimado)}/km
              </span>
            )}
          </div>
          <div className="text-3xl sm:text-4xl font-black text-white tracking-tight font-mono">
            <AnimatedCounter value={totalBrutoEstimado} formatAsCurrency />
          </div>

          {/* Badges explicativos do cálculo */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800 text-[11px] text-slate-300 font-mono">
            <span className="bg-slate-800/90 px-2 py-0.5 rounded-md border border-slate-700/60">
              {numPecas} un. × {formatCurrency(numValorUnit)}
            </span>
            {numBonus > 0 && (
              <>
                <span className="text-slate-500">+</span>
                <span className="bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30">
                  {formatCurrency(numBonus)} bônus
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* FORMULÁRIO DE LANÇAMENTO */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Campo: Data */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Data do Lançamento
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Campo: Quantidade de Peças */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Quantidade de Peças
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Package className="w-4 h-4" />
              </div>
              <input
                type="number"
                inputMode="decimal"
                required
                min="0"
                step="1"
                placeholder="Ex: 85"
                value={qtdPecas}
                onChange={(e) => setQtdPecas(e.target.value)}
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-mono"
              />
            </div>
          </div>

          {/* Campo: Valor Unitário por Peça */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Valor por Peça (R$)
              </label>
              {profile?.valor_padrao_peca && (
                <button
                  type="button"
                  onClick={() => setValorUnitarioPeca(profile.valor_padrao_peca!.toString())}
                  className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  title="Usar valor padrão cadastrado no perfil"
                >
                  <Sparkles className="w-3 h-3" />
                  Padrão ({formatCurrency(profile.valor_padrao_peca)})
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <input
                type="number"
                inputMode="decimal"
                required
                min="0"
                step="0.01"
                placeholder="Ex: 4.50"
                value={valorUnitarioPeca}
                onChange={(e) => setValorUnitarioPeca(e.target.value)}
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-mono"
              />
            </div>
          </div>

          {/* Campo: Bônus Extra */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Bônus / Extra (R$)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Gift className="w-4 h-4" />
              </div>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={valorExtraBonus}
                onChange={(e) => setValorExtraBonus(e.target.value)}
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-mono"
              />
            </div>
          </div>

          {/* Campo: KM Rodado */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              KM Rodado na Rota (Opcional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Gauge className="w-4 h-4" />
              </div>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                placeholder="Ex: 120"
                value={kmRodado}
                onChange={(e) => setKmRodado(e.target.value)}
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-mono"
              />
            </div>
          </div>

          {/* Campo: Observações */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Observações / Nome da Rota (Opcional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 pt-3 pointer-events-none text-slate-400">
                <FileText className="w-4 h-4" />
              </div>
              <textarea
                rows={2}
                placeholder="Ex: Rota centro + 2 coletas extras..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
              />
            </div>
          </div>
        </div>

        {/* Botão de Salvar */}
        <div className="pt-2">
          <motion.button
            type="submit"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.96 }}
            disabled={submitting}
            className="w-full h-12 min-h-[48px] px-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-500/25 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Salvando Lançamento...
              </>
            ) : (
              <>
                <PlusCircle className="w-5 h-5 stroke-[2.2]" />
                Salvar Lançamento do Dia
              </>
            )}
          </motion.button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="w-full space-y-6">
      {/* ALERTA DISCRETO DE MANUTENÇÃO PREVENTIVA */}
      {healthAlert && (
        <motion.a
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          href="#saude"
          className={`p-3 sm:p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs transition cursor-pointer shadow-md ${
            healthAlert.status === 'vencido'
              ? 'bg-rose-950/80 border-rose-500/60 text-rose-200 hover:bg-rose-950 ring-1 ring-rose-500/40'
              : 'bg-amber-950/70 border-amber-500/50 text-amber-200 hover:bg-amber-950/90 ring-1 ring-amber-500/30'
          }`}
          title="Toque para abrir a Saúde do Veículo em Tools"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-base shrink-0">
              {healthAlert.status === 'vencido' ? '🚨' : '⚠️'}
            </span>
            <div className="min-w-0">
              <p className="font-extrabold truncate text-xs sm:text-sm">
                {healthAlert.status === 'vencido'
                  ? `Alerta de Manutenção: Troca de ${healthAlert.nome} está vencida!`
                  : `Atenção ao veículo: Faltam apenas ${healthAlert.kmRestante.toLocaleString('pt-BR')} km para a troca de ${healthAlert.nome}.`}
              </p>
              <p className="text-[11px] opacity-80 truncate">
                Toque para ver a Saúde do Veículo em Tools & Calculadoras →
              </p>
            </div>
          </div>
          <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-black/40 border border-white/10 hover:bg-black/60 transition whitespace-nowrap">
            Ver em Tools
          </span>
        </motion.a>
      )}

      {/* Cards de Resumo Rápido (Bento Grid Assimétrico no Mobile / 3 Colunas no Desktop) */}
      {earningsList.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {/* Linha 1: TOTAL FATURADO (Destaque Principal col-span-2 no mobile) */}
          <div className="col-span-2 md:col-span-1 w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 min-w-0 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Total Faturado
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {earningsList.length} {earningsList.length === 1 ? 'dia lançado' : 'dias lançados'}
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black text-emerald-400 font-mono tabular-nums tracking-tight">
              {formatCurrency(totalFaturadoAcumulado)}
            </div>
          </div>

          {/* Linha 2 (Esquerda): PEÇAS ENTREGUES */}
          <div className="col-span-1 w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3.5 sm:p-4 min-w-0 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block truncate">
              Peças Entregues
            </span>
            <span className="text-lg sm:text-xl font-black text-white mt-1.5 block font-mono tabular-nums">
              {totalPecasEntregues.toLocaleString('pt-BR')} <span className="text-xs font-normal text-zinc-400">un.</span>
            </span>
            <span className="text-[11px] text-zinc-400 mt-1 block truncate">
              ~{(totalPecasEntregues / earningsList.length).toFixed(0)} peças/dia
            </span>
          </div>

          {/* Linha 2 (Direita): KM RODADO */}
          <div className="col-span-1 w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3.5 sm:p-4 min-w-0 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block truncate">
              KM Rodado
            </span>
            <span className="text-lg sm:text-xl font-black text-teal-400 mt-1.5 block font-mono tabular-nums">
              {totalKmAcumulado.toFixed(0)} <span className="text-xs font-normal text-zinc-400">km</span>
            </span>
            <span className="text-[11px] text-zinc-400 mt-1 block truncate">
              {totalKmAcumulado > 0
                ? `${formatCurrency(totalFaturadoAcumulado / totalKmAcumulado)}/km`
                : 'R$ 0,00/km'}
            </span>
          </div>
        </div>
      )}

      {/* BOTÃO DE DESTAQUE INTEGRADO: + LANÇAR GANHO DO DIA (Mobile First - Logo abaixo dos KPIs) */}
      <div className="lg:hidden">
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={handleOpenNewForm}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 font-bold text-sm rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition cursor-pointer select-none"
        >
          <PlusCircle className="w-5 h-5 stroke-[2.5]" />
          <span>+ Lançar Ganho do Dia</span>
        </motion.button>
      </div>

      {/* CARDS DE RECEBIMENTOS (FECHAMENTO DE QUINZENA/MÊS) */}
      <PaymentCyclesCards
        earnings={earningsList}
        referenceMonth={filterState.monthYear}
        title="Meus Recebimentos (Fechamento de Quinzena)"
        paymentRecords={paymentRecords}
        onRecordUpdated={handlePaymentRecordUpdated}
        onRecordReverted={handlePaymentRecordReverted}
        onRefresh={refreshEarnings}
      />

      {/* LAYOUT PRINCIPAL: No desktop, exibe o formulário na coluna lateral aberta (lg:grid) e o histórico na direita */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-6 items-start">
        {/* FORMULÁRIO LATERAL NO DESKTOP (Aberto e fixo na visão desktop) */}
        <div id="daily-earnings-form-section" className="hidden lg:block lg:col-span-5 sticky top-24">
          {renderEarningsForm(false)}
        </div>

        {/* COLUNA DO HISTÓRICO (Largura total no mobile, coluna direita no desktop) */}
        <div className="lg:col-span-7 space-y-4">
          {/* BARRA DE FILTRAGEM AVANÇADA (MÊS, QUINZENA, BUSCA E ORDENAÇÃO) */}
          <HistoryFilterBar
            filterState={filterState}
            onFilterChange={setFilterState}
            profile={profile}
            searchPlaceholder="Buscar por observação, data (ex: 30/10), peças, bônus..."
            totalFilteredCount={filteredEarningsList.length}
          />

          {/* RESUMO DO FILTRO ATIVO (TOTALIZADOR DINÂMICO) */}
          <EarningsFilterSummary
            items={filteredEarningsList}
            filterState={filterState}
            profile={profile}
            vehicle={vehicle}
            paymentRecords={paymentRecords}
            onPaymentRecordUpdated={handlePaymentRecordUpdated}
            onPaymentRecordReverted={handlePaymentRecordReverted}
          />

          {/* LISTAGEM: ÚLTIMOS LANÇAMENTOS DO MOTORISTA */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1 gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Últimos Lançamentos
                  </h3>
                  {earningsList.length > 0 && (
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                      {earningsList.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Histórico diário de produção e ganhos
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                {/* Botão de Ação Rápida no Cabeçalho da Lista */}
                <button
                  type="button"
                  onClick={handleOpenNewForm}
                  className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 shadow-md shadow-emerald-500/20 active:scale-95 transition cursor-pointer select-none shrink-0"
                  aria-label="Novo Lançamento de Ganho"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span className="hidden xs:inline">+ Novo Lançamento</span>
                  <span className="xs:hidden">+ Novo</span>
                </button>

                {filteredEarningsList.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAllExpanded}
                    title={isAllExpanded ? 'Recolher todos os lançamentos' : 'Expandir todos os lançamentos'}
                    aria-label={isAllExpanded ? 'Recolher todos os lançamentos' : 'Expandir todos os lançamentos'}
                    className="flex items-center gap-1.5 px-2.5 py-2 min-h-[44px] rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/70 active:scale-[0.97] transition cursor-pointer select-none"
                  >
                    <span className="text-[11px] font-medium hidden sm:inline">
                      {isAllExpanded ? 'Recolher todos' : 'Expandir todos'}
                    </span>
                    <span className="text-[11px] font-medium sm:hidden">
                      {isAllExpanded ? 'Recolher' : 'Expandir'}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                        isAllExpanded ? 'rotate-180 text-emerald-400' : ''
                      }`}
                    />
                  </button>
                )}

                <button
                  type="button"
                  onClick={refreshEarnings}
                  disabled={loadingList}
                  title="Atualizar lista"
                  aria-label="Atualizar lista de lançamentos"
                  className="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition cursor-pointer"
                >
                  <RotateCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Loading Skeleton */}
            {loadingList && earningsList.length === 0 && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-24 bg-slate-900/60 rounded-2xl border border-slate-800 animate-pulse"
                  />
                ))}
              </div>
            )}

            {/* Empty State Sem Registros Totais */}
            {!loadingList && earningsList.length === 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Info className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">Nenhum lançamento encontrado</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Toque em &quot;+ Novo Lançamento&quot; ou no botão flutuante para registrar sua primeira rota.
                </p>
                <button
                  type="button"
                  onClick={handleOpenNewForm}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  Novo Lançamento Diário
                </button>
              </div>
            )}

            {/* Empty State do Filtro (quando há dados gerais mas nada no filtro selecionado) */}
            {!loadingList && earningsList.length > 0 && filteredEarningsList.length === 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Info className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Nenhum lançamento encontrado neste período</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Não há registros para o mês ou filtros aplicados. Alterne o mês, selecione outro chip ou limpe os filtros.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterState(getDefaultFilterState())}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold transition active:scale-95 cursor-pointer border border-slate-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Limpar Filtros e Ver Todos
                </button>
              </div>
            )}

            {/* Lista de Registros com Stagger e Animação de Layout (Cards Compactos Expansíveis) */}
            <motion.div
              key={`${filterState.monthYear}-${filterState.periodChip}`}
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-2.5"
            >
              <AnimatePresence>
                {filteredEarningsList.map((item) => {
                  const faturamento =
                    typeof item.faturamento_bruto === 'number'
                      ? item.faturamento_bruto
                      : item.qtd_pecas * item.valor_unitario_peca + item.valor_extra_bonus;

                  const rendimentoKm = item.km_rodado > 0 ? faturamento / item.km_rodado : 0;
                  const isConfirming = confirmDeleteId === item.id;
                  const isDeleting = deletingId === item.id;
                  const { fullBadge, formattedDate, weekday, paymentCycleBadge } = formatCardDateBadge(item.data, profile);

                  const dateParts = formattedDate ? formattedDate.split(' ') : [];
                  const dayAndMonth = dateParts.length >= 2 ? `${dateParts[0]} ${dateParts[1]}` : item.data;
                  const compactDate = weekday ? `${dayAndMonth} • ${weekday}` : dayAndMonth;
                  const isExpanded = isAllExpanded || expandedId === item.id;

                  return (
                    <motion.div
                      key={item.id}
                      layout
                      variants={staggerItemVariants}
                      className="w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/70 shadow-sm transition-colors mb-2"
                    >
                      {/* Linha Compacta (1 Linha - Estado Fechado por Padrão) */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleItemExpand(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleItemExpand(item.id);
                          }
                        }}
                        aria-expanded={isExpanded}
                        className="w-full flex items-center justify-between gap-3 min-w-0 p-3.5 text-left cursor-pointer hover:bg-slate-800/40 active:bg-slate-800/60 transition select-none min-h-[48px]"
                      >
                        {/* Esquerda: Data Compacta + Qtd Peças + Mini-ícones */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono tracking-tight shrink-0 border border-slate-700/50">
                            {compactDate}
                          </span>
                          <span className="text-xs font-bold text-white font-mono flex items-center gap-1 shrink-0">
                            <Package className="w-3.5 h-3.5 text-slate-400" />
                            {item.qtd_pecas}{' '}
                            <span className="text-[11px] font-normal text-slate-400">pçs</span>
                          </span>
                          {item.valor_extra_bonus > 0 && (
                            <span
                              title={`+ Bônus ${formatCurrency(item.valor_extra_bonus)}`}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0"
                            >
                              <Gift className="w-3 h-3 text-amber-400" />
                              <span className="hidden xs:inline">+{formatCurrency(item.valor_extra_bonus)}</span>
                            </span>
                          )}
                          {item.observacoes && (
                            <span
                              title={`Observação: "${item.observacoes}"`}
                              className="inline-flex items-center text-slate-400 shrink-0"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                            </span>
                          )}
                        </div>

                        {/* Direita: Valor Total Bruto + ChevronDown que gira 180deg */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm sm:text-base font-black text-emerald-400 font-mono tabular-nums whitespace-nowrap">
                            {formatCurrency(faturamento)}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                              isExpanded ? 'rotate-180 text-emerald-400' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Expansão Suave ao Tocar */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className="overflow-hidden border-t border-slate-800/80 bg-zinc-900/50 p-3.5 space-y-3"
                          >
                            {/* Grid Completo de Detalhes */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 min-w-0">
                                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider truncate">
                                  Valor Unitário
                                </span>
                                <span className="font-mono font-bold text-white text-xs sm:text-sm mt-0.5 block truncate">
                                  {formatCurrency(item.valor_unitario_peca)} / un.
                                </span>
                              </div>

                              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 min-w-0">
                                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider truncate">
                                  Bônus Extra
                                </span>
                                <span
                                  className={`font-mono font-bold text-xs sm:text-sm mt-0.5 block truncate ${
                                    item.valor_extra_bonus > 0 ? 'text-amber-400' : 'text-slate-400'
                                  }`}
                                >
                                  {item.valor_extra_bonus > 0 ? formatCurrency(item.valor_extra_bonus) : 'R$ 0,00'}
                                </span>
                              </div>

                              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 min-w-0">
                                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider truncate">
                                  KM Rodado
                                </span>
                                <span className="font-mono font-bold text-white text-xs sm:text-sm mt-0.5 block truncate">
                                  {item.km_rodado > 0 ? `${item.km_rodado.toLocaleString('pt-BR')} km` : '0 km'}
                                </span>
                              </div>

                              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 min-w-0">
                                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider truncate">
                                  Ganho Bruto / KM
                                </span>
                                <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm mt-0.5 block truncate">
                                  {rendimentoKm > 0 ? `${formatCurrency(rendimentoKm)}/km` : '---'}
                                </span>
                              </div>
                            </div>

                            {/* Referência da Quinzena / Ciclo */}
                            <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-950/40 px-3 py-2 rounded-xl border border-slate-800/40 flex-wrap gap-2">
                              <span className="flex items-center gap-1.5 font-medium truncate">
                                <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span className="truncate">{fullBadge}</span>
                              </span>
                              <span className="text-[11px] font-mono text-slate-400 shrink-0">
                                Ref: {paymentCycleBadge}
                              </span>
                            </div>

                            {/* Observação Completa */}
                            {item.observacoes && (
                              <div className="text-xs text-slate-300 italic bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 flex items-start gap-2">
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                <span className="break-words">&quot;{item.observacoes}&quot;</span>
                              </div>
                            )}

                            {/* Barra de Ações Rápidas no Rodapé */}
                            <div
                              className="pt-2 border-t border-slate-800/80 w-full"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {!isConfirming ? (
                                <div className="grid grid-cols-2 gap-2 w-full">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingEarning(item);
                                    }}
                                    className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-800 hover:text-emerald-400 border border-slate-700/60 active:scale-[0.96] transition cursor-pointer w-full"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span>Editar Lançamento</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteId(item.id);
                                    }}
                                    className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 active:scale-[0.96] transition cursor-pointer w-full"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Excluir</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-rose-950/90 border border-rose-600/50 p-2 rounded-xl w-full">
                                  <span className="text-xs font-semibold text-rose-300 px-1 text-center sm:text-left">
                                    Confirmar exclusão?
                                  </span>
                                  <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(item.id);
                                      }}
                                      disabled={isDeleting}
                                      className="h-9 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition active:scale-[0.96] cursor-pointer"
                                    >
                                      {isDeleting ? '...' : 'Sim, Excluir'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteId(null);
                                      }}
                                      className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition active:scale-[0.96] cursor-pointer"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </section>
        </div>
      </div>

      {/* SEÇÃO HISTÓRICA: MEUS FECHAMENTOS (HOLERITES) */}
      <PaymentCyclesHistory
        earnings={earningsList}
        profile={profile}
        vehicle={vehicle}
        paymentRecords={paymentRecords}
        onPaymentRecordUpdated={handlePaymentRecordUpdated}
        onPaymentRecordReverted={handlePaymentRecordReverted}
      />

      {/* Modal Responsivo de Edição de Lançamento */}
      {editingEarning && (
        <EditEarningModal
          key={editingEarning.id}
          isOpen={!!editingEarning}
          earning={editingEarning}
          onClose={() => setEditingEarning(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Gaveta Inferior Deslizante (Bottom Sheet) no Mobile */}
      <BottomSheetModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Novo Lançamento Diário"
        subtitle="Registre os dados da sua rota de hoje"
        icon={
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
            <PlusCircle className="w-5 h-5 stroke-[2.5]" />
          </div>
        }
      >
        {renderEarningsForm(true)}
      </BottomSheetModal>
    </div>
  );
};
