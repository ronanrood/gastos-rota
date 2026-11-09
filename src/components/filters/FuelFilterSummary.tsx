import React, { useState } from 'react';
import { Fuel, DollarSign, Droplets, TrendingUp } from 'lucide-react';
import type { FuelLog, Profile, Vehicle } from '../../types/database';
import { calculateFilterDateRange, type HistoryFilterState } from '../../utils/filterUtils';
import { FilterShareActions } from '../export/FilterShareActions';
import { ReportPrintModal } from '../export/ReportPrintModal';
import { generateWhatsAppFuelText } from '../../utils/exportUtils';

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

interface FuelFilterSummaryProps {
  items: FuelLog[];
  filterState: HistoryFilterState;
  profile: Profile | null;
  vehicle?: Vehicle | null;
}

export const FuelFilterSummary: React.FC<FuelFilterSummaryProps> = ({
  items,
  filterState,
  profile,
  vehicle,
}) => {
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const { periodLabel } = calculateFilterDateRange(filterState, profile);

  const totalGasto = items.reduce((acc, curr) => acc + (curr.valor_total_abastecido || 0), 0);

  const totalLitros = items.reduce((acc, curr) => {
    const l =
      typeof curr.litros_calculados === 'number'
        ? curr.litros_calculados
        : (curr.valor_total_abastecido || 0) / (curr.preco_por_litro_ou_m3 || 1);
    return acc + (isNaN(l) ? 0 : l);
  }, 0);

  const precoMedioLitro = totalLitros > 0 ? totalGasto / totalLitros : 0;

  return (
    <>
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Resumo de Combustível • {periodLabel}
              </h4>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {items.length === 0
                ? 'Nenhum abastecimento no período'
                : `${items.length} ${items.length === 1 ? 'abastecimento realizado' : 'abastecimentos realizados'}`}
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold shrink-0">
            <Fuel className="w-3.5 h-3.5" />
            <span>Controle de Tanque</span>
          </div>
        </div>

        {/* Grid de Totais */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total Gasto */}
          <div className="sm:col-span-2 bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-400">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" />
                Total Gasto em Combustível
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                Despesa Real
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight font-mono">
              {formatCurrency(totalGasto)}
            </div>
          </div>

          {/* Litros / m³ Totais */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-blue-400" />
              Volume Total Abastecido
            </span>
            <div className="text-lg sm:text-xl font-bold text-slate-200 mt-1 font-mono">
              {totalLitros.toFixed(2)} L/m³
            </div>
          </div>

          {/* Preço Médio por Litro */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Preço Médio por Litro/m³
            </span>
            <div className="text-lg sm:text-xl font-bold text-emerald-300 mt-1 font-mono">
              {formatCurrency(precoMedioLitro)}
            </div>
          </div>
        </div>

        {/* Ações de Compartilhamento e Exportação */}
        <FilterShareActions
          getWhatsAppText={() =>
            generateWhatsAppFuelText({
              profile,
              periodLabel,
              items,
              vehicle,
            })
          }
          onOpenPdfModal={() => setIsPdfModalOpen(true)}
          accentColor="amber"
        />
      </div>

      {/* Modal de Pré-visualização e Impressão do Relatório */}
      <ReportPrintModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        reportType="fuel"
        profile={profile}
        vehicle={vehicle}
        periodLabel={periodLabel}
        fuelItems={items}
      />
    </>
  );
};
