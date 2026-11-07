import React from 'react';
import {
  Package,
  Gauge,
  Gift,
  TrendingUp,
  CreditCard,
} from 'lucide-react';
import type { DailyEarning, Profile } from '../../types/database';
import { calculateFilterDateRange, type HistoryFilterState } from '../../utils/filterUtils';

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

interface EarningsFilterSummaryProps {
  items: DailyEarning[];
  filterState: HistoryFilterState;
  profile: Profile | null;
}

export const EarningsFilterSummary: React.FC<EarningsFilterSummaryProps> = ({
  items,
  filterState,
  profile,
}) => {
  const { periodLabel, paymentNotice } = calculateFilterDateRange(filterState, profile);

  // Cálculos dinâmicos
  const totalFaturamento = items.reduce((acc, curr) => {
    const val =
      typeof curr.faturamento_bruto === 'number'
        ? curr.faturamento_bruto
        : (curr.qtd_pecas || 0) * (curr.valor_unitario_peca || 0) + (curr.valor_extra_bonus || 0);
    return acc + val;
  }, 0);

  const totalPecas = items.reduce((acc, curr) => acc + (curr.qtd_pecas || 0), 0);
  const totalKm = items.reduce((acc, curr) => acc + (curr.km_rodado || 0), 0);
  const totalBonus = items.reduce((acc, curr) => acc + (curr.valor_extra_bonus || 0), 0);
  const uniqueDays = new Set(items.map((i) => i.data)).size;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-emerald-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
      {/* Luz de fundo decorativa */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cabeçalho do Resumo com Lote de Pagamento */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Resumo do Filtro Ativo • {periodLabel}
            </h4>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {items.length === 0
              ? 'Nenhum lançamento encontrado para o período'
              : `${uniqueDays} ${uniqueDays === 1 ? 'dia trabalhado' : 'dias trabalhados'} • ${items.length} ${items.length === 1 ? 'lançamento' : 'lançamentos'}`}
          </p>
        </div>

        {paymentNotice && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold shrink-0">
            <CreditCard className="w-3.5 h-3.5" />
            <span>{paymentNotice}</span>
          </div>
        )}
      </div>

      {/* Totalizador Principal e Submétricas */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total a Receber no Período */}
        <div className="sm:col-span-2 bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              Total a Receber no Período
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
              Líquido Estimado
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight font-mono">
            {formatCurrency(totalFaturamento)}
          </div>
        </div>

        {/* Peças Entregues */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-blue-400" />
            Peças Entregues
          </span>
          <div className="text-lg sm:text-xl font-bold text-slate-200 mt-1 font-mono">
            {totalPecas} un.
          </div>
        </div>

        {/* KM Rodado */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
            KM Total Rodado
          </span>
          <div className="text-lg sm:text-xl font-bold text-slate-200 mt-1 font-mono">
            {totalKm.toLocaleString('pt-BR')} km
          </div>
        </div>

        {/* Bônus */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5 text-purple-400" />
            Bônus Recebidos
          </span>
          <div className="text-lg sm:text-xl font-bold text-purple-300 mt-1 font-mono">
            {formatCurrency(totalBonus)}
          </div>
        </div>
      </div>
    </div>
  );
};
