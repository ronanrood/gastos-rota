import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import type { DailyEarning, FuelLog, MaintenanceLog, Vehicle, PaymentCycleRecord } from '../../types/database';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Gauge,
  RotateCw,
  PieChart as PieIcon,
  BarChart3,
  Sparkles,
  ClipboardList,
  CreditCard,
} from 'lucide-react';
import { PaymentCyclesCards } from '../payment/PaymentCyclesCards';
import { PaymentCyclesHistory } from '../payment/PaymentCyclesHistory';
import { HistoryFilterBar } from '../filters/HistoryFilterBar';
import { FilterShareActions } from '../export/FilterShareActions';
import { ReportPrintModal } from '../export/ReportPrintModal';
import { generateWhatsAppDashboardText } from '../../utils/exportUtils';
import {
  type HistoryFilterState,
  getDefaultFilterState,
  calculateFilterDateRange,
} from '../../utils/filterUtils';
import {
  isServiceParcelado,
  calculatePeriodMaintenanceExpenses,
  getInstallmentDate,
} from '../../utils/maintenanceInstallments';

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
};

export const DashboardPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [filterState, setFilterState] = useState<HistoryFilterState>(getDefaultFilterState);
  const [loading, setLoading] = useState(true);

  // Dados brutos
  const [earnings, setEarnings] = useState<DailyEarning[]>([]);
  const [fullEarnings, setFullEarnings] = useState<DailyEarning[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<PaymentCycleRecord[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

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

  // Carregamento dos dados com base no período selecionado
  const fetchData = useCallback(
    async (showLoading = false) => {
      if (!user) return;
      if (showLoading) setLoading(true);

      const { startDate, endDate } = calculateFilterDateRange(filterState, profile);

      try {
        let eQuery = supabase.from('daily_earnings').select('*').eq('user_id', user.id);
        let fQuery = supabase.from('fuel_logs').select('*').eq('user_id', user.id);

        if (startDate) {
          eQuery = eQuery.gte('data', startDate);
          fQuery = fQuery.gte('data', startDate);
        }
        if (endDate) {
          eQuery = eQuery.lte('data', endDate);
          fQuery = fQuery.lte('data', endDate);
        }

        const [eRes, fRes, mRes, allERes, pRes] = await Promise.all([
          eQuery.order('data', { ascending: true }),
          fQuery.order('data', { ascending: true }),
          supabase.from('maintenance_logs').select('*').eq('user_id', user.id).order('data', { ascending: false }),
          supabase.from('daily_earnings').select('*').eq('user_id', user.id).order('data', { ascending: false }),
          supabase.from('payment_cycles').select('*').eq('user_id', user.id),
        ]);

        if (eRes.data) setEarnings(eRes.data as DailyEarning[]);
        if (fRes.data) setFuelLogs(fRes.data as FuelLog[]);
        if (mRes.data) setMaintenanceLogs(mRes.data as MaintenanceLog[]);
        if (allERes.data) setFullEarnings(allERes.data as DailyEarning[]);
        if (pRes.data) setPaymentRecords(pRes.data as PaymentCycleRecord[]);
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard financeiro:', err);
      } finally {
        setLoading(false);
      }
    },
    [user, filterState, profile]
  );

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      const { startDate, endDate } = calculateFilterDateRange(filterState, profile);

      try {
        let eQuery = supabase.from('daily_earnings').select('*').eq('user_id', user.id);
        let fQuery = supabase.from('fuel_logs').select('*').eq('user_id', user.id);

        if (startDate) {
          eQuery = eQuery.gte('data', startDate);
          fQuery = fQuery.gte('data', startDate);
        }
        if (endDate) {
          eQuery = eQuery.lte('data', endDate);
          fQuery = fQuery.lte('data', endDate);
        }

        const [eRes, fRes, mRes, vRes, allERes, pRes] = await Promise.all([
          eQuery.order('data', { ascending: true }),
          fQuery.order('data', { ascending: true }),
          supabase.from('maintenance_logs').select('*').eq('user_id', user.id).order('data', { ascending: false }),
          supabase.from('vehicles').select('*').eq('user_id', user.id).maybeSingle(),
          supabase.from('daily_earnings').select('*').eq('user_id', user.id).order('data', { ascending: false }),
          supabase.from('payment_cycles').select('*').eq('user_id', user.id),
        ]);

        if (!ignore) {
          if (eRes.data) setEarnings(eRes.data as DailyEarning[]);
          if (fRes.data) setFuelLogs(fRes.data as FuelLog[]);
          if (mRes.data) setMaintenanceLogs(mRes.data as MaintenanceLog[]);
          if (vRes.data) setVehicle(vRes.data as Vehicle);
          if (allERes.data) setFullEarnings(allERes.data as DailyEarning[]);
          if (pRes.data) setPaymentRecords(pRes.data as PaymentCycleRecord[]);
        }
      } catch (err) {
        if (!ignore) console.error('Erro ao carregar dados do dashboard:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, [user, filterState, profile]);

  const { periodLabel, paymentNotice, startDate, endDate } = calculateFilterDateRange(filterState, profile);

  // Cálculos consolidados dos 4 Cards Principais
  // a) Faturamento Bruto
  const faturamentoBruto = useMemo(() => {
    return earnings.reduce((acc, curr) => {
      const valor =
        typeof curr.faturamento_bruto === 'number'
          ? curr.faturamento_bruto
          : curr.qtd_pecas * curr.valor_unitario_peca + curr.valor_extra_bonus;
      return acc + valor;
    }, 0);
  }, [earnings]);

  // Filtra manutenções: SOMENTE 'realizado' entra nas despesas oficiais e abatimento do lucro
  const maintenanceRealizados = useMemo(() => {
    return maintenanceLogs.filter((m) => m.status !== 'orcamento');
  }, [maintenanceLogs]);

  // Orçamentos pendentes do período filtrado
  const orcamentosPendentes = useMemo(() => {
    const { startDate, endDate } = calculateFilterDateRange(filterState, profile);
    return maintenanceLogs.filter((m) => {
      if (m.status !== 'orcamento') return false;
      if (startDate && m.data < startDate) return false;
      if (endDate && m.data > endDate) return false;
      return true;
    });
  }, [maintenanceLogs, filterState, profile]);

  const totalOrcamentosPendentes = useMemo(() => {
    return orcamentosPendentes.reduce((acc, curr) => {
      const valor =
        typeof curr.valor_total === 'number'
          ? curr.valor_total
          : curr.valor_pecas + curr.valor_mao_de_obra;
      return acc + valor;
    }, 0);
  }, [orcamentosPendentes]);

  // b) Despesas Totais
  const despesasCombustivel = useMemo(() => {
    return fuelLogs.reduce((acc, curr) => acc + (curr.valor_total_abastecido || 0), 0);
  }, [fuelLogs]);

  // Cálculo inteligente das despesas de oficina: distribui parcelamentos ao longo dos meses
  const maintenanceExpensesSummary = useMemo(() => {
    const { startDate, endDate } = calculateFilterDateRange(filterState, profile);
    return calculatePeriodMaintenanceExpenses(maintenanceLogs, {
      monthYear: filterState.periodChip === 'month' ? filterState.monthYear : undefined,
      startDate,
      endDate,
    });
  }, [maintenanceLogs, filterState, profile]);

  const despesasOficina = maintenanceExpensesSummary.totalExpenses;

  const despesasTotais = useMemo(() => {
    return despesasCombustivel + despesasOficina;
  }, [despesasCombustivel, despesasOficina]);

  // c) Lucro Líquido Real
  const lucroLiquidoReal = useMemo(() => {
    return faturamentoBruto - despesasTotais;
  }, [faturamentoBruto, despesasTotais]);

  const margemLucro = useMemo(() => {
    if (faturamentoBruto > 0) {
      return (lucroLiquidoReal / faturamentoBruto) * 100;
    }
    return 0;
  }, [lucroLiquidoReal, faturamentoBruto]);

  // d) Indicadores por KM
  const totalKmRodados = useMemo(() => {
    return earnings.reduce((acc, curr) => acc + (curr.km_rodado || 0), 0);
  }, [earnings]);

  const ganhoBrutoPorKm = useMemo(() => {
    if (totalKmRodados > 0 && faturamentoBruto > 0) {
      return faturamentoBruto / totalKmRodados;
    }
    return 0;
  }, [faturamentoBruto, totalKmRodados]);

  const lucroLiquidoPorKm = useMemo(() => {
    if (totalKmRodados > 0 && lucroLiquidoReal !== 0) {
      return lucroLiquidoReal / totalKmRodados;
    }
    return 0;
  }, [lucroLiquidoReal, totalKmRodados]);

  // Agrupamento diário para o Gráfico de Barras
  const dailyBarData = useMemo(() => {
    const map = new Map<string, { faturamento: number; despesas: number }>();

    // Soma faturamento por data
    earnings.forEach((e) => {
      const d = e.data;
      if (!d) return;
      const prev = map.get(d) || { faturamento: 0, despesas: 0 };
      const val =
        typeof e.faturamento_bruto === 'number'
          ? e.faturamento_bruto
          : e.qtd_pecas * e.valor_unitario_peca + e.valor_extra_bonus;
      map.set(d, { ...prev, faturamento: prev.faturamento + val });
    });

    // Soma combustível por data
    fuelLogs.forEach((f) => {
      const d = f.data;
      if (!d) return;
      const prev = map.get(d) || { faturamento: 0, despesas: 0 };
      map.set(d, { ...prev, despesas: prev.despesas + (f.valor_total_abastecido || 0) });
    });

    // Soma oficina realizada por data: à vista na data do serviço e parcelado no dia de cada parcela
    const { startDate, endDate } = calculateFilterDateRange(filterState, profile);

    maintenanceRealizados.forEach((m) => {
      const isParcel = isServiceParcelado(m);
      if (!isParcel) {
        const d = m.data;
        if (!d) return;
        if (startDate && d < startDate) return;
        if (endDate && d > endDate) return;
        const prev = map.get(d) || { faturamento: 0, despesas: 0 };
        const val =
          typeof m.valor_total === 'number'
            ? m.valor_total
            : m.valor_pecas + m.valor_mao_de_obra;
        map.set(d, { ...prev, despesas: prev.despesas + val });
      } else {
        const totalParcelas = Math.max(m.qtd_parcelas || 1, 1);
        const valorTotalServico =
          typeof m.valor_total === 'number'
            ? m.valor_total
            : m.valor_pecas + m.valor_mao_de_obra;
        const valorParcela =
          typeof m.valor_parcela === 'number' && m.valor_parcela > 0
            ? m.valor_parcela
            : valorTotalServico / totalParcelas;

        const firstDate = m.mes_primeira_parcela || m.data || '';

        for (let i = 0; i < totalParcelas; i++) {
          const instDate = getInstallmentDate(firstDate, i);
          if (startDate && instDate < startDate) continue;
          if (endDate && instDate > endDate) continue;

          const prev = map.get(instDate) || { faturamento: 0, despesas: 0 };
          map.set(instDate, { ...prev, despesas: prev.despesas + valorParcela });
        }
      }
    });

    const sortedDates = Array.from(map.keys()).sort();

    return sortedDates.map((date) => {
      const item = map.get(date)!;
      return {
        dateRaw: date,
        data: formatDateShort(date),
        faturamento: Number(item.faturamento.toFixed(2)),
        despesas: Number(item.despesas.toFixed(2)),
        lucro: Number((item.faturamento - item.despesas).toFixed(2)),
      };
    });
  }, [earnings, fuelLogs, maintenanceRealizados, filterState, profile]);

  // Dados para o Gráfico de Rosca (Proporção de Despesas)
  const donutData = useMemo(() => {
    const list = [];
    if (despesasCombustivel > 0) {
      list.push({
        name: 'Combustível',
        value: Number(despesasCombustivel.toFixed(2)),
        color: '#f59e0b', // amber-500
      });
    }
    if (despesasOficina > 0) {
      list.push({
        name: 'Oficina (Serviços Realizados + Parcelas do Mês)',
        value: Number(despesasOficina.toFixed(2)),
        color: '#3b82f6', // blue-500
      });
    }
    return list;
  }, [despesasCombustivel, despesasOficina]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header: Título e Atualização */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
              <BarChart3 className="w-5 h-5 stroke-[2.2]" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Dashboard Financeiro
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Consolidado de receitas, custos operacionais e margem de lucro
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchData(true)}
          disabled={loading}
          title="Atualizar dados"
          className="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition active:scale-[0.95] cursor-pointer"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* NAVEGADOR DE MÊS/ANO E CHIPS DE QUINZENA/PERÍODO */}
      <HistoryFilterBar
        filterState={filterState}
        onFilterChange={setFilterState}
        profile={profile}
        hideSearchAndSort={true}
      />

      {/* RESUMO DO FILTRO ATIVO E AÇÕES DE EXPORTAÇÃO */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-emerald-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Resumo do Fechamento • {periodLabel}
              </h4>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {earnings.length} {earnings.length === 1 ? 'dia de produção' : 'dias de produção'} • {fuelLogs.length} abastecimentos • {maintenanceRealizados.length} manutenções concluídas
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold shrink-0">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Lucro Líquido: {formatCurrency(lucroLiquidoReal)}</span>
          </div>
        </div>

        {/* Ações de Compartilhamento e Exportação */}
        <FilterShareActions
          getWhatsAppText={() =>
            generateWhatsAppDashboardText({
              profile,
              periodLabel,
              faturamentoBruto,
              despesasCombustivel,
              despesasOficina,
              despesasTotais,
              lucroLiquidoReal,
              totalKmRodados,
              diasProducao: earnings.length,
              vehicle,
            })
          }
          onOpenPdfModal={() => setIsPdfModalOpen(true)}
          accentColor="emerald"
        />
      </div>

      {/* 4 CARDS PRINCIPAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card A: Faturamento Bruto */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-3xl p-5 shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Faturamento Bruto
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-3 tracking-tight">
            {formatCurrency(faturamentoBruto)}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
            <span className="text-emerald-400 font-semibold">{earnings.length}</span> dias de produção
          </div>
        </div>

        {/* Card B: Despesas Totais */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-3xl p-5 shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Despesas Totais
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-3 tracking-tight">
            {formatCurrency(despesasTotais)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2">
            <span className="text-amber-400 font-medium">⛽ {formatCurrency(despesasCombustivel)}</span>
            <span className="text-slate-600">•</span>
            <span className="text-blue-400 font-medium" title="Despesa de Oficina no Mês (Parcelas + À vista)">
              🔧 {formatCurrency(despesasOficina)}
            </span>
          </div>
          {maintenanceExpensesSummary.parcelasTotal > 0 && (
            <div className="mt-1 text-[10px] text-blue-300/80">
              (inclui {formatCurrency(maintenanceExpensesSummary.parcelasTotal)} em parcelas)
            </div>
          )}
          {maintenanceExpensesSummary.futureCommittedTotal > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-400 flex items-center gap-1.5">
              <CreditCard className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>
                Comprometimento futuro em parcelas:{' '}
                <strong className="text-cyan-300 font-mono">
                  {formatCurrency(maintenanceExpensesSummary.futureCommittedTotal)}
                </strong>
              </span>
            </div>
          )}
        </div>

        {/* Card C: Lucro Líquido Real (Destaque Verde se >= 0, Vermelho se < 0) */}
        <div
          className={`border rounded-3xl p-5 shadow-xl relative overflow-hidden backdrop-blur-md ${
            lucroLiquidoReal >= 0
              ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border-emerald-500/40 ring-1 ring-emerald-500/20'
              : 'bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/40 border-rose-500/40 ring-1 ring-rose-500/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Lucro Líquido Real
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                lucroLiquidoReal >= 0
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              <DollarSign className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-black mt-3 tracking-tight ${
              lucroLiquidoReal >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatCurrency(lucroLiquidoReal)}
          </div>
          <div className="mt-2 text-xs flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                lucroLiquidoReal >= 0
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              Margem: {margemLucro.toFixed(1)}%
            </span>
            <span className="text-[11px] text-slate-400">
              {lucroLiquidoReal >= 0 ? 'Lucro positivo' : 'Déficit no período'}
            </span>
          </div>
        </div>

        {/* Card D: Indicadores por KM */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-3xl p-5 shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Indicadores por KM
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center">
              <Gauge className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-3 tracking-tight font-mono">
            {totalKmRodados.toLocaleString('pt-BR')} <span className="text-sm font-normal text-slate-400">km</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-300 flex flex-wrap gap-x-2">
            <span>
              Bruto: <strong className="text-emerald-400 font-mono">{formatCurrency(ganhoBrutoPorKm)}/km</strong>
            </span>
            <span className="text-slate-600">•</span>
            <span>
              Líquido: <strong className={`${lucroLiquidoPorKm >= 0 ? 'text-teal-400' : 'text-rose-400'} font-mono`}>{formatCurrency(lucroLiquidoPorKm)}/km</strong>
            </span>
          </div>
        </div>
      </div>

      {/* AVISO INFORMATIVO: ORÇAMENTOS PENDENTES (Não abatem do Lucro Líquido) */}
      {orcamentosPendentes.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900 border border-amber-500/30 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                Você possui <span className="text-amber-400 font-mono">{formatCurrency(totalOrcamentosPendentes)}</span> em {orcamentosPendentes.length} {orcamentosPendentes.length === 1 ? 'orçamento pendente' : 'orçamentos pendentes'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Esses orçamentos aguardam aprovação e não abatem das Despesas Totais nem do Lucro Líquido Real.
              </p>
            </div>
          </div>
          <a
            href="#manutencao"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 active:bg-amber-500/40 text-amber-300 font-bold text-xs transition active:scale-[0.98] self-start sm:self-center shrink-0 border border-amber-500/30 cursor-pointer"
          >
            <span>Ver Orçamentos</span>
            <span>→</span>
          </a>
        </div>
      )}

      {/* CARDS DE FECHAMENTO DE RECEBIMENTOS */}
      <PaymentCyclesCards
        earnings={fullEarnings.length > 0 ? fullEarnings : earnings}
        referenceMonth={filterState.monthYear}
        title="Fechamento de Pagamentos por Ciclo"
        paymentRecords={paymentRecords}
        onRecordUpdated={handlePaymentRecordUpdated}
        onRecordReverted={handlePaymentRecordReverted}
      />

      {/* GRÁFICO DE BARRAS RESPONSIVO: FATURAMENTO VS DESPESAS VS LUCRO LÍQUIDO */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-4 mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              Evolução Diária: Faturamento vs. Despesas vs. Lucro
            </h3>
            <p className="text-xs text-slate-400">
              Comparativo dia a dia dos ganhos operacionais e custos
            </p>
          </div>
        </div>

        {dailyBarData.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Nenhum lançamento no período selecionado para exibição do gráfico.
          </div>
        ) : (
          <div className="h-[280px] sm:h-80 w-full -ml-2 sm:ml-0">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis
                  dataKey="data"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => `R$${val}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-2xl text-xs space-y-1.5">
                          <p className="font-bold text-slate-300 border-b border-slate-800 pb-1">
                            Dia: {label}
                          </p>
                          {payload.map((entry, index) => (
                            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
                              <span style={{ color: entry.color }} className="font-medium">
                                {entry.name}:
                              </span>
                              <span className="font-mono font-bold text-white">
                                {formatCurrency(entry.value as number)}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }}
                  iconType="circle"
                />
                <Bar dataKey="faturamento" name="Faturamento Bruto" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro" name="Lucro Líquido" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* GRÁFICO DE ROSCA: PROPORÇÃO DE GASTOS (COMBUSTÍVEL VS OFICINA) */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl backdrop-blur-md">
        <div className="border-b border-slate-800/80 pb-4 mb-6">
          <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-amber-400" />
            Composição das Despesas (Combustível vs. Oficina)
          </h3>
          <p className="text-xs text-slate-400">
            Distribuição percentual entre gastos de abastecimento e manutenção veicular
          </p>
        </div>

        {donutData.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            Nenhuma despesa registrada no período selecionado.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Gráfico */}
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={3} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const dataItem = payload[0];
                        const val = dataItem.value as number;
                        const pct = despesasTotais > 0 ? ((val / despesasTotais) * 100).toFixed(1) : 0;
                        return (
                          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-2xl text-xs space-y-1">
                            <p className="font-bold text-white">{dataItem.name}</p>
                            <p className="font-mono text-emerald-400">{formatCurrency(val)} ({pct}%)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Detalhes da Proporção em Lista */}
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white">Combustível</p>
                    <p className="text-[11px] text-slate-400">{fuelLogs.length} abastecimentos</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-amber-400 font-mono">
                    {formatCurrency(despesasCombustivel)}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {despesasTotais > 0 ? ((despesasCombustivel / despesasTotais) * 100).toFixed(1) : 0}% do total
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-blue-500 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white">Oficina & Manutenção</p>
                    <p className="text-[11px] text-slate-400">
                      {maintenanceExpensesSummary.parcelasTotal > 0
                        ? `À vista + parcelas ativas no mês`
                        : `${maintenanceLogs.length} serviços realizados`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-blue-400 font-mono">
                    {formatCurrency(despesasOficina)}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {despesasTotais > 0 ? ((despesasOficina / despesasTotais) * 100).toFixed(1) : 0}% do total
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Despesa Total consolidada: <strong>{formatCurrency(despesasTotais)}</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* SEÇÃO HISTÓRICA: MEUS FECHAMENTOS (HOLERITES) */}
      <PaymentCyclesHistory
        earnings={fullEarnings.length > 0 ? fullEarnings : earnings}
        profile={profile}
        vehicle={vehicle}
        paymentRecords={paymentRecords}
        onPaymentRecordUpdated={handlePaymentRecordUpdated}
        onPaymentRecordReverted={handlePaymentRecordReverted}
      />

      {/* Modal de Pré-visualização e Impressão do Relatório */}
      <ReportPrintModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        reportType="dashboard"
        profile={profile}
        vehicle={vehicle}
        periodLabel={periodLabel}
        paymentNotice={paymentNotice}
        earningsItems={earnings}
        fuelItems={fuelLogs}
        maintenanceItems={maintenanceLogs}
        startDate={startDate}
        endDate={endDate}
        dashboardData={{
          faturamentoBruto,
          despesasCombustivel,
          despesasOficina,
          despesasTotais,
          lucroLiquidoReal,
          totalKmRodados,
          diasProducao: earnings.length,
          margemLucro,
          dailyData: dailyBarData,
        }}
      />
    </div>
  );
};
