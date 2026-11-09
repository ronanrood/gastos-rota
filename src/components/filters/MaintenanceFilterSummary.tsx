import React, { useState } from 'react';
import { Wrench, ClipboardList } from 'lucide-react';
import type { MaintenanceLog, Profile, Vehicle } from '../../types/database';
import { calculateFilterDateRange, type HistoryFilterState } from '../../utils/filterUtils';
import { FilterShareActions } from '../export/FilterShareActions';
import { ReportPrintModal } from '../export/ReportPrintModal';
import { generateWhatsAppMaintenanceText } from '../../utils/exportUtils';

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

interface MaintenanceFilterSummaryProps {
  items: MaintenanceLog[];
  filterState: HistoryFilterState;
  profile: Profile | null;
  vehicle?: Vehicle | null;
}

export const MaintenanceFilterSummary: React.FC<MaintenanceFilterSummaryProps> = ({
  items,
  filterState,
  profile,
  vehicle,
}) => {
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const { periodLabel } = calculateFilterDateRange(filterState, profile);

  const realizados = items.filter((m) => m.status !== 'orcamento');
  const orcamentos = items.filter((m) => m.status === 'orcamento');

  const totalRealizados = realizados.reduce((acc, curr) => {
    const val =
      typeof curr.valor_total === 'number'
        ? curr.valor_total
        : (curr.valor_pecas || 0) + (curr.valor_mao_de_obra || 0);
    return acc + val;
  }, 0);

  const totalOrcamentos = orcamentos.reduce((acc, curr) => {
    const val =
      typeof curr.valor_total === 'number'
        ? curr.valor_total
        : (curr.valor_pecas || 0) + (curr.valor_mao_de_obra || 0);
    return acc + val;
  }, 0);

  return (
    <>
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-blue-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Resumo da Oficina • {periodLabel}
              </h4>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {items.length === 0
                ? 'Nenhum lançamento no período'
                : `${realizados.length} ${realizados.length === 1 ? 'serviço realizado' : 'serviços realizados'} • ${orcamentos.length} ${orcamentos.length === 1 ? 'orçamento pendente' : 'orçamentos pendentes'}`}
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold shrink-0">
            <Wrench className="w-3.5 h-3.5" />
            <span>Gestão de Oficina</span>
          </div>
        </div>

        {/* Grid de Totais */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Total Gasto em Serviços Realizados */}
          <div className="bg-slate-950/80 border border-blue-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-400">
              <span className="flex items-center gap-1.5">
                <Wrench className="w-4 h-4" />
                Serviços Concluídos (Pago)
              </span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold">
                {realizados.length} {realizados.length === 1 ? 'serviço' : 'serviços'}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight font-mono">
              {formatCurrency(totalRealizados)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Impacta diretamente o lucro líquido real do período
            </p>
          </div>

          {/* Total em Orçamentos Pendentes */}
          <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-400">
              <span className="flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4" />
                Orçamentos Pendentes (Previsto)
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                {orcamentos.length} {orcamentos.length === 1 ? 'pendente' : 'pendentes'}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-300 mt-1 tracking-tight font-mono">
              {formatCurrency(totalOrcamentos)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Não abate do lucro até ser aprovado e concluído
            </p>
          </div>
        </div>

        {/* Ações de Compartilhamento e Exportação */}
        <FilterShareActions
          getWhatsAppText={() =>
            generateWhatsAppMaintenanceText({
              profile,
              periodLabel,
              items,
              vehicle,
            })
          }
          onOpenPdfModal={() => setIsPdfModalOpen(true)}
          accentColor="blue"
        />
      </div>

      {/* Modal de Pré-visualização e Impressão do Relatório */}
      <ReportPrintModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        reportType="maintenance"
        profile={profile}
        vehicle={vehicle}
        periodLabel={periodLabel}
        maintenanceItems={items}
      />
    </>
  );
};
