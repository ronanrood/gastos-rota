import React, { useState, useMemo } from 'react';
import {
  Package,
  Gauge,
  Gift,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import type { DailyEarning, Profile, Vehicle, PaymentCycleRecord } from '../../types/database';
import { calculateFilterDateRange, type HistoryFilterState } from '../../utils/filterUtils';
import {
  computePaymentStatus,
  calculatePaymentDueDate,
  getEffectivePaymentConfig,
  type PaymentCycleInfo,
} from '../../utils/paymentCycles';
import { FilterShareActions } from '../export/FilterShareActions';
import { ReportPrintModal } from '../export/ReportPrintModal';
import { ConfirmPaymentModal } from '../payment/ConfirmPaymentModal';
import { generateWhatsAppEarningsText } from '../../utils/exportUtils';

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

interface EarningsFilterSummaryProps {
  items: DailyEarning[];
  filterState: HistoryFilterState;
  profile: Profile | null;
  vehicle?: Vehicle | null;
  paymentRecords?: PaymentCycleRecord[];
  onPaymentRecordUpdated?: (rec: PaymentCycleRecord) => void;
  onPaymentRecordReverted?: (refKey: string) => void;
}

export const EarningsFilterSummary: React.FC<EarningsFilterSummaryProps> = ({
  items,
  filterState,
  profile,
  vehicle,
  paymentRecords = [],
  onPaymentRecordUpdated,
  onPaymentRecordReverted,
}) => {
  const { user } = useAuth();
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [cycleToConfirm, setCycleToConfirm] = useState<PaymentCycleInfo | null>(null);

  const { periodLabel, paymentNotice, startDate, endDate } = calculateFilterDateRange(
    filterState,
    profile
  );

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

  // Determina se o filtro atual corresponde a um ciclo de fechamento passível de confirmação
  const activeCycleInfo: PaymentCycleInfo | null = useMemo(() => {
    const chip = filterState.periodChip;
    if (chip !== 'quinzena_1' && chip !== 'quinzena_2' && chip !== 'month') {
      return null;
    }

    const config = getEffectivePaymentConfig(profile);
    const monthYear = filterState.monthYear;
    const [yStr, mStr] = monthYear.split('-');
    const lastDayOfMonth = new Date(parseInt(yStr, 10), parseInt(mStr, 10), 0).getDate();

    let id = 'cycle_filter';
    let cycleName = 'Período Filtrado';
    let refKey = '';
    let diaPagamento = config.dia_pagamento_1;
    let corteInicio = 1;
    let corteFim = lastDayOfMonth;

    if (chip === 'quinzena_1') {
      id = 'cycle_q1';
      cycleName = '1ª Quinzena';
      refKey = `${monthYear}-Q1`;
      diaPagamento = config.dia_pagamento_2;
      corteInicio = config.corte_2_inicio;
      corteFim = Math.min(config.corte_2_fim, lastDayOfMonth);
    } else if (chip === 'quinzena_2') {
      id = 'cycle_q2';
      cycleName = '2ª Quinzena';
      refKey = `${monthYear}-Q2`;
      diaPagamento = config.dia_pagamento_1;
      corteInicio = config.corte_1_inicio;
      corteFim = Math.min(config.corte_1_fim, lastDayOfMonth);
    } else if (chip === 'month') {
      id = 'cycle_mensal';
      cycleName = 'Fechamento Mensal';
      refKey = `${monthYear}-MENSAL`;
      diaPagamento = config.dia_pagamento_1;
      corteInicio = 1;
      corteFim = lastDayOfMonth;
    }

    const dataPagamentoPrevista = calculatePaymentDueDate(monthYear, corteFim, diaPagamento);
    const matchedRecord = paymentRecords.find((r) => r.referencia_chave === refKey) || null;
    const { status, statusLabel } = computePaymentStatus(
      dataPagamentoPrevista,
      diaPagamento,
      matchedRecord
    );

    return {
      id,
      cycleName,
      referenciaChave: refKey,
      diaPagamento,
      corteInicio,
      corteFim,
      corteLabel: `Dias ${corteInicio} a ${corteFim}`,
      periodoInicio: startDate || `${monthYear}-${String(corteInicio).padStart(2, '0')}`,
      periodoFim: endDate || `${monthYear}-${String(corteFim).padStart(2, '0')}`,
      dataPagamentoPrevista,
      entries: items,
      totalFaturamento,
      totalPecas,
      totalKm,
      isCurrent: false,
      referenceMonthYear: monthYear,
      paymentRecord: matchedRecord,
      status,
      statusLabel,
    };
  }, [
    filterState.periodChip,
    filterState.monthYear,
    profile,
    paymentRecords,
    items,
    startDate,
    endDate,
    totalFaturamento,
    totalPecas,
    totalKm,
  ]);

  return (
    <>
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-emerald-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        {/* Luz de fundo decorativa */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Cabeçalho do Resumo com Lote de Pagamento e Status do Ciclo */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-3 border-b border-slate-800">
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

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {paymentNotice && !activeCycleInfo && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                <CreditCard className="w-3.5 h-3.5" />
                <span>{paymentNotice}</span>
              </div>
            )}

            {/* Badge de Status de Recebimento da Quinzena Ativa */}
            {activeCycleInfo && (
              <div className="flex items-center gap-2">
                {activeCycleInfo.status === 'pago' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      Pago / Na Conta{' '}
                      {activeCycleInfo.paymentRecord?.data_confirmacao && (
                        <span className="text-slate-300 font-mono text-[11px]">
                          ({formatDate(activeCycleInfo.paymentRecord.data_confirmacao)})
                        </span>
                      )}
                    </span>
                  </span>
                ) : activeCycleInfo.status === 'atrasado' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold animate-pulse">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Pagamento Atrasado (Dia {activeCycleInfo.diaPagamento})</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Aguardando Pagamento (Dia {activeCycleInfo.diaPagamento})</span>
                  </span>
                )}

                {/* Botão de Ação Rápida */}
                {activeCycleInfo.status === 'pago' ? (
                  <button
                    type="button"
                    onClick={() => setCycleToConfirm(activeCycleInfo)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition active:scale-[0.97] cursor-pointer"
                    title="Editar informações do recebimento"
                  >
                    <Pencil className="w-3 h-3 text-emerald-400" />
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCycleToConfirm(activeCycleInfo)}
                    className="inline-flex items-center gap-1 px-3 py-1 min-h-[36px] rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition active:scale-[0.97] cursor-pointer shadow-md shadow-emerald-500/20"
                    title="Confirmar que o pagamento deste fechamento caiu na conta"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Marcar Recebido</span>
                  </button>
                )}
              </div>
            )}
          </div>
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

        {/* Botões de Ação: WhatsApp, Copiar Texto e Gerar PDF */}
        <FilterShareActions
          getWhatsAppText={() =>
            generateWhatsAppEarningsText({
              profile,
              periodLabel,
              items,
              paymentNotice,
              vehicle,
            })
          }
          onOpenPdfModal={() => setIsPdfModalOpen(true)}
          accentColor="emerald"
        />
      </div>

      {/* Modal de Confirmação de Recebimento */}
      {activeCycleInfo && user && (
        <ConfirmPaymentModal
          isOpen={Boolean(cycleToConfirm)}
          onClose={() => setCycleToConfirm(null)}
          cycle={cycleToConfirm}
          userId={user.id}
          onSaveSuccess={(rec) => {
            if (onPaymentRecordUpdated) {
              onPaymentRecordUpdated(rec);
            }
          }}
          onRevertSuccess={(ref) => {
            if (onPaymentRecordReverted) {
              onPaymentRecordReverted(ref);
            }
          }}
        />
      )}

      {/* Modal de Pré-visualização e Impressão do Relatório */}
      <ReportPrintModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        reportType="earnings"
        profile={profile}
        vehicle={vehicle}
        periodLabel={periodLabel}
        paymentNotice={paymentNotice}
        earningsItems={items}
      />
    </>
  );
};
