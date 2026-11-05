import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import type { DailyEarning } from '../../types/database';
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
  ChevronUp,
  Eye,
  EyeOff,
  Pencil,
} from 'lucide-react';
import { PaymentCyclesCards } from '../payment/PaymentCyclesCards';
import { EditEarningModal } from './EditEarningModal';

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
  const { user } = useAuth();

  // Formulário - inicialização pura
  const [data, setData] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [qtdPecas, setQtdPecas] = useState<string>('');
  const [valorUnitarioPeca, setValorUnitarioPeca] = useState<string>('');
  const [valorExtraBonus, setValorExtraBonus] = useState<string>('0');
  const [kmRodado, setKmRodado] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');

  // Estados de controle
  const [submitting, setSubmitting] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [earningsList, setEarningsList] = useState<DailyEarning[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingEarning, setEditingEarning] = useState<DailyEarning | null>(null);

  const handleEditSuccess = (updated: DailyEarning) => {
    setEarningsList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setFormSuccess('Lançamento atualizado com sucesso!');
    setTimeout(() => {
      setFormSuccess(null);
    }, 4000);
  };

  // Controle de recolhimento da seção Últimos Lançamentos (com persistência local)
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gastos_rota_earnings_history_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleHistoryCollapsed = () => {
    setIsHistoryCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('gastos_rota_earnings_history_collapsed', String(next));
      } catch {
        // ignora se localStorage não disponível
      }
      return next;
    });
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

  // Carregar lançamentos sob demanda (ex: ao clicar em recarregar ou após inserção)
  const refreshEarnings = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);
    try {
      const { data: rows, error } = await supabase
        .from('daily_earnings')
        .select('*')
        .eq('user_id', user.id)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar ganhos:', error.message);
      } else if (rows) {
        setEarningsList(rows as DailyEarning[]);
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
        const { data: rows, error } = await supabase
          .from('daily_earnings')
          .select('*')
          .eq('user_id', user.id)
          .order('data', { ascending: false })
          .order('created_at', { ascending: false });

        if (!ignore) {
          if (error) {
            console.error('Erro ao carregar ganhos:', error.message);
          } else if (rows) {
            setEarningsList(rows as DailyEarning[]);
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
  }, [user]);

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

      // Atualiza a lista local com o registro retornado do banco e desrecolhe para visualização
      if (inserted) {
        setEarningsList((prev) => [inserted as DailyEarning, ...prev]);
        setIsHistoryCollapsed(false);
        try {
          localStorage.setItem('gastos_rota_earnings_history_collapsed', 'false');
        } catch {
          // ignora se localStorage não disponível
        }
      } else {
        await refreshEarnings();
        setIsHistoryCollapsed(false);
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

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Cards de Resumo Rápido */}
      {earningsList.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Faturado
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-emerald-400 mt-1 block">
              {formatCurrency(totalFaturadoAcumulado)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {earningsList.length} dias lançados
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Peças Entregues
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-white mt-1 block">
              {totalPecasEntregues.toLocaleString('pt-BR')} un.
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Média {(totalPecasEntregues / earningsList.length).toFixed(0)}/dia
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Km & Rentabilidade
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-teal-400 mt-1 block">
              {totalKmAcumulado.toFixed(0)} km
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {totalKmAcumulado > 0
                ? `${formatCurrency(totalFaturadoAcumulado / totalKmAcumulado)}/km`
                : 'Média/km'}
            </span>
          </div>
        </div>
      )}

      {/* CARDS DE RECEBIMENTOS (FECHAMENTO DE QUINZENA/MÊS) */}
      <PaymentCyclesCards
        earnings={earningsList}
        title="Meus Recebimentos (Fechamento de Quinzena)"
      />

      {/* CARD PRINCIPAL: ENCARTE DE LANÇAMENTO DIÁRIO */}
      <section className="bg-slate-900 border border-slate-800/90 rounded-3xl shadow-2xl p-5 sm:p-7 relative overflow-hidden backdrop-blur-md">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header do Card */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center shadow-md shadow-emerald-500/20 font-bold">
              <PlusCircle className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Encarte de Lançamento Diário
              </h2>
              <p className="text-xs text-slate-400">
                Registre os dados da sua rota de hoje
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Cálculo em tempo real
          </span>
        </div>

        {/* FEEDBACKS (ERRO / SUCESSO) */}
        {formError && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Erro ao salvar</p>
              <p className="text-rose-300/90">{formError}</p>
            </div>
          </div>
        )}

        {formSuccess && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-semibold">{formSuccess}</div>
          </div>
        )}

        {/* VISOR DE TOTAL BRUTO ESTIMADO (Destaque Principal) */}
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border-2 border-emerald-500/40 p-4 sm:p-5 relative shadow-inner">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <TrendingUp className="w-4 h-4" />
                Total Bruto Estimado
              </div>
              <div className="text-3xl sm:text-4xl font-black text-white mt-1 tracking-tight">
                {formatCurrency(totalBrutoEstimado)}
              </div>
            </div>

            {/* Badges explicativos do cálculo */}
            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800 text-[11px] text-slate-300">
              <span className="bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                {numPecas} un. × {formatCurrency(numValorUnit)}
              </span>
              <span className="text-slate-500">+</span>
              <span className="bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                {formatCurrency(numBonus)} bônus
              </span>
              {rendimentoPorKmEstimado > 0 && (
                <span className="bg-emerald-500/15 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/30 font-semibold font-mono">
                  {formatCurrency(rendimentoPorKmEstimado)}/km
                </span>
              )}
            </div>
          </div>
        </div>

        {/* FORMULÁRIO DE LANÇAMENTO */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
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
                  inputMode="numeric"
                  required
                  min="0"
                  step="1"
                  value={qtdPecas}
                  onChange={(e) => setQtdPecas(e.target.value)}
                  placeholder="Ex: 50"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-mono"
                />
              </div>
            </div>

            {/* Campo: Valor Pago por Peça */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Valor Pago por Peça 
              </label>
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
                  value={valorUnitarioPeca}
                  onChange={(e) => setValorUnitarioPeca(e.target.value)}
                  placeholder="Ex: 3.50"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-mono"
                />
              </div>
            </div>

            {/* Campo: Bônus Extra */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Bônus Extra / Adicional 
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
                  value={valorExtraBonus}
                  onChange={(e) => setValorExtraBonus(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-mono"
                />
              </div>
            </div>

            {/* Campo: KM Rodado no dia */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                KM Rodado no Dia 
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Gauge className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  required
                  min="0"
                  step="0.1"
                  value={kmRodado}
                  onChange={(e) => setKmRodado(e.target.value)}
                  placeholder="Ex: 85.5"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-mono"
                />
              </div>
            </div>

            {/* Campo: Observações */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Observações (Opcional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <FileText className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Rota centro / chuva"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          {/* Botão de Envio */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 min-h-[48px] px-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
            </button>
          </div>
        </form>
      </section>

      {/* LISTAGEM: ÚLTIMOS LANÇAMENTOS DO MOTORISTA (RECOLHÍVEL) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1 gap-2">
          <button
            type="button"
            onClick={toggleHistoryCollapsed}
            className="flex items-center gap-2.5 text-left group cursor-pointer py-1 -my-1 rounded-xl focus:outline-none"
            aria-expanded={!isHistoryCollapsed}
            aria-label={isHistoryCollapsed ? 'Expandir últimos lançamentos' : 'Recolher últimos lançamentos'}
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight group-hover:text-emerald-400 transition-colors">
                  Últimos Lançamentos
                </h3>
                {earningsList.length > 0 && (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                    {earningsList.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                {isHistoryCollapsed
                  ? 'Lançamentos recolhidos • Toque para visualizar'
                  : 'Histórico diário de produção e ganhos'}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isHistoryCollapsed && (
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
            )}

            <button
              type="button"
              onClick={toggleHistoryCollapsed}
              title={isHistoryCollapsed ? 'Expandir lançamentos' : 'Ocultar lançamentos'}
              aria-label={isHistoryCollapsed ? 'Mostrar últimos lançamentos' : 'Ocultar últimos lançamentos'}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/70 active:scale-[0.97] transition cursor-pointer select-none"
            >
              {isHistoryCollapsed ? (
                <>
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Mostrar</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-slate-400" />
                  <span className="hidden sm:inline">Ocultar</span>
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card quando recolhido */}
        {isHistoryCollapsed && (
          <button
            type="button"
            onClick={toggleHistoryCollapsed}
            className="w-full py-3.5 px-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer flex items-center justify-between group active:scale-[0.99]"
          >
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>
                {earningsList.length > 0
                  ? `${earningsList.length} lançamento${earningsList.length > 1 ? 's' : ''} oculto${earningsList.length > 1 ? 's' : ''}`
                  : 'Nenhum lançamento exibido'}
              </span>
            </span>
            <span className="text-emerald-400 font-semibold group-hover:underline flex items-center gap-1">
              Toque para exibir
              <ChevronDown className="w-3.5 h-3.5" />
            </span>
          </button>
        )}

        {/* Conteúdo exibido apenas quando NÃO recolhido */}
        {!isHistoryCollapsed && (
          <>
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

            {/* Empty State */}
            {!loadingList && earningsList.length === 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Info className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">Nenhum lançamento encontrado</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Use o formulário acima para registrar sua primeira rota. Os valores calculados aparecerão aqui em ordem cronológica.
                </p>
              </div>
            )}

            {/* Lista de Registros */}
            <div className="space-y-3">
              {earningsList.map((item) => {
                const faturamento =
                  typeof item.faturamento_bruto === 'number'
                    ? item.faturamento_bruto
                    : item.qtd_pecas * item.valor_unitario_peca + item.valor_extra_bonus;

                const rendimentoKm = item.km_rodado > 0 ? faturamento / item.km_rodado : 0;
                const isConfirming = confirmDeleteId === item.id;
                const isDeleting = deletingId === item.id;

                return (
                  <div
                    key={item.id}
                    className="bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 transition shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Informações da Data e Faturamento */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono">
                            {formatDate(item.data)}
                          </span>
                          {item.valor_extra_bonus > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              + Bônus {formatCurrency(item.valor_extra_bonus)}
                            </span>
                          )}
                        </div>

                        <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1.5">
                          {formatCurrency(faturamento)}
                        </div>
                      </div>

                      {/* Ações: Editar e Excluir */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isConfirming && (
                          <button
                            type="button"
                            onClick={() => setEditingEarning(item)}
                            aria-label="Editar lançamento"
                            title="Editar este lançamento"
                            className="h-10 min-h-[40px] px-2.5 sm:px-3 flex items-center justify-center gap-1.5 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 active:bg-emerald-500/20 active:scale-[0.95] transition cursor-pointer text-xs font-semibold"
                          >
                            <Pencil className="w-4 h-4" />
                            <span className="hidden sm:inline">Editar</span>
                          </button>
                        )}

                        {isConfirming ? (
                          <div className="flex items-center gap-1.5 bg-rose-950/80 border border-rose-600/50 p-1.5 rounded-xl">
                            <span className="text-[11px] font-semibold text-rose-300 px-1">
                              Excluir?
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              disabled={isDeleting}
                              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition active:scale-[0.96] cursor-pointer"
                            >
                              {isDeleting ? '...' : 'Sim'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition active:scale-[0.96] cursor-pointer"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            aria-label="Excluir lançamento"
                            title="Excluir este lançamento"
                            className="w-10 h-10 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 active:bg-rose-500/20 active:scale-[0.95] transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Detalhes operacionais em Badges */}
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                      <span className="bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 font-mono">
                        <strong className="text-white">{item.qtd_pecas}</strong> peças
                      </span>
                      <span className="bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 font-mono">
                        {formatCurrency(item.valor_unitario_peca)} / un.
                      </span>
                      <span className="bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 font-mono">
                        <strong className="text-white">{item.km_rodado}</strong> km
                      </span>
                      {rendimentoKm > 0 && (
                        <span className="bg-emerald-500/10 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-mono font-semibold">
                          {formatCurrency(rendimentoKm)}/km
                        </span>
                      )}
                    </div>

                    {/* Observações, se houver */}
                    {item.observacoes && (
                      <div className="mt-2 text-xs text-slate-400 italic bg-slate-950/40 p-2 rounded-lg border border-slate-800/40">
                        &quot;{item.observacoes}&quot;
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

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
    </div>
  );
};
