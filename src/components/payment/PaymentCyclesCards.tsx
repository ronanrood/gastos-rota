import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import type { DailyEarning, PaymentCycleRecord } from '../../types/database';
import { computePaymentCycles, type PaymentCycleInfo } from '../../utils/paymentCycles';
import { PaymentConfigModal } from './PaymentConfigModal';
import { ConfirmPaymentModal } from './ConfirmPaymentModal';
import { AnimatedCounter } from '../common/AnimatedCounter';
import {
  CalendarDays,
  Calendar,
  DollarSign,
  ChevronRight,
  Package,
  Gauge,
  SlidersHorizontal,
  X,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Clock,
  Pencil,
} from 'lucide-react';

const getCurrentMonthYear = (): string => new Date().toISOString().substring(0, 7);

interface PaymentCyclesCardsProps {
  earnings: DailyEarning[];
  referenceMonth?: string; // opcional 'YYYY-MM'
  title?: string;
  paymentRecords?: PaymentCycleRecord[];
  onRefresh?: () => void;
  onRecordUpdated?: (record: PaymentCycleRecord) => void;
  onRecordReverted?: (referenciaChave: string) => void;
}

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

export const PaymentCyclesCards: React.FC<PaymentCyclesCardsProps> = ({
  earnings,
  referenceMonth,
  title = 'Meus Recebimentos (Fechamento de Quinzena)',
  paymentRecords: externalRecords,
  onRefresh,
  onRecordUpdated,
  onRecordReverted,
}) => {
  const { user, profile } = useAuth();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedCycleDetails, setSelectedCycleDetails] = useState<PaymentCycleInfo | null>(null);
  const [cycleToConfirm, setCycleToConfirm] = useState<PaymentCycleInfo | null>(null);

  // Registros locais de ciclos de pagamento (caso não venham por props)
  const [internalRecords, setInternalRecords] = useState<PaymentCycleRecord[]>([]);

  useEffect(() => {
    if (externalRecords || !user) return;
    let ignore = false;

    supabase
      .from('payment_cycles')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (!ignore && !error && data) {
          setInternalRecords(data as PaymentCycleRecord[]);
        }
      });

    return () => {
      ignore = true;
    };
  }, [externalRecords, user]);

  const activeRecords = externalRecords ?? internalRecords;

  const [defaultMonth] = useState<string>(getCurrentMonthYear);

  // Mês de referência ativo
  const activeMonthStr = useMemo(() => {
    return referenceMonth || defaultMonth;
  }, [referenceMonth, defaultMonth]);

  // Nome do mês formatado em português (ex: "Novembro de 2026")
  const formattedMonthName = useMemo(() => {
    const [y, m] = activeMonthStr.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    const text = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }, [activeMonthStr]);

  // Calcula os ciclos com base nos ganhos, configurações do perfil e status de pagamento
  const { tipo, cycles } = useMemo(() => {
    return computePaymentCycles(earnings, profile, activeMonthStr, activeRecords);
  }, [earnings, profile, activeMonthStr, activeRecords]);

  const handleSavePaymentSuccess = (updatedRecord: PaymentCycleRecord) => {
    setInternalRecords((prev) => {
      const exists = prev.some((r) => r.referencia_chave === updatedRecord.referencia_chave);
      if (exists) {
        return prev.map((r) =>
          r.referencia_chave === updatedRecord.referencia_chave ? updatedRecord : r
        );
      }
      return [updatedRecord, ...prev];
    });

    if (onRecordUpdated) {
      onRecordUpdated(updatedRecord);
    }
    if (onRefresh) {
      onRefresh();
    }
  };

  const handleRevertPaymentSuccess = (referenciaChave: string) => {
    setInternalRecords((prev) =>
      prev.map((r) =>
        r.referencia_chave === referenciaChave
          ? { ...r, status: 'pendente', valor_recebido: null, data_confirmacao: null, observacoes: null }
          : r
      )
    );

    if (onRecordReverted) {
      onRecordReverted(referenciaChave);
    }
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <>
      <div className="space-y-3">
        {/* Header da Seção de Recebimentos */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-emerald-500/15 text-emerald-400">
              <CalendarDays className="w-4 h-4 stroke-[2.2]" />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-tight">
                {title}
              </h3>
              <span className="text-[11px] text-slate-400 block font-medium">
                Referência: <strong className="text-slate-300">{formattedMonthName}</strong> •{' '}
                {tipo === 'quinzenal' ? '2 Cortes' : '1 Corte'}
              </span>
            </div>
          </div>

          {/* Botão para Configurar Datas de Fechamento */}
          <button
            type="button"
            onClick={() => setIsConfigModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white text-xs font-semibold transition active:scale-[0.96] cursor-pointer shadow-xs"
            title="Ajustar dias de corte e pagamento"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Configurar Ciclos</span>
          </button>
        </div>

        {/* CARDS DOS CICLOS */}
        <div
          className={`grid gap-3 ${
            tipo === 'quinzenal' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {cycles.map((cycle, index) => {
            const isFirst = index === 0;
            const isPaid = cycle.status === 'pago';
            const isLate = cycle.status === 'atrasado';
            const rec = cycle.paymentRecord;

            return (
              <div
                key={cycle.referenciaChave}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCycleDetails(cycle)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedCycleDetails(cycle);
                  }
                }}
                className={`group text-left p-4 sm:p-5 rounded-3xl border transition-all duration-200 cursor-pointer relative overflow-hidden backdrop-blur-md shadow-lg hover:shadow-xl flex flex-col justify-between ${
                  isPaid
                    ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border-emerald-500/40 hover:border-emerald-500/60'
                    : isLate
                    ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/30 border-rose-500/40 hover:border-rose-500/60 ring-1 ring-rose-500/20'
                    : cycle.isCurrent || (isFirst && tipo === 'quinzenal')
                    ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border-emerald-500/40 hover:border-emerald-500/60 ring-1 ring-emerald-500/20'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Glow decorativo suave */}
                {cycle.isCurrent && (
                  <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                )}

                <div>
                  {/* Topo do Card: Badge do Ciclo + Badge de Status de Pagamento */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          cycle.isCurrent
                            ? 'bg-emerald-500 text-slate-950 shadow-xs font-black'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {cycle.cycleName}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {cycle.corteLabel}
                      </span>
                    </div>

                    {/* Badge de Status de Recebimento */}
                    {isPaid ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold shadow-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Pago / Na Conta</span>
                      </span>
                    ) : isLate ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold animate-pulse">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Pagamento Atrasado (Era dia {cycle.diaPagamento})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Aguardando Pagamento (Dia {cycle.diaPagamento})</span>
                      </span>
                    )}
                  </div>

                  {/* Título do Pagamento e Previsão */}
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      Receber no Dia {cycle.diaPagamento}
                    </h4>

                    {/* Seta indicador de detalhe */}
                    <div className="w-7 h-7 rounded-xl bg-slate-800/80 group-hover:bg-emerald-500 group-hover:text-slate-950 text-slate-400 flex items-center justify-center transition shrink-0">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Valor Total Acumulado */}
                  <div className="mt-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Faturamento Calculado no Período
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-0.5 tracking-tight font-mono">
                      <AnimatedCounter value={cycle.totalFaturamento} formatAsCurrency />
                    </div>
                  </div>

                  {/* Detalhe de Confirmação quando já está Pago */}
                  {isPaid && rec && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          Confirmado em:{' '}
                          <strong className="text-white">
                            {formatDate(rec.data_confirmacao || '')}
                          </strong>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Caiu na conta:</span>
                        <span className="font-mono font-bold text-emerald-400 text-xs">
                          {formatCurrency(rec.valor_recebido ?? cycle.totalFaturamento)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Métricas do Ciclo: Peças, KM e Dias */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <span className="bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800/80 font-mono text-[11px] flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-teal-400" />
                      <strong>{cycle.totalPecas}</strong> peças
                    </span>
                    <span className="bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800/80 font-mono text-[11px] flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-teal-400" />
                      <strong>{cycle.totalKm.toFixed(0)}</strong> km
                    </span>
                    <span className="bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-400">
                      {cycle.entries.length}{' '}
                      {cycle.entries.length === 1 ? 'dia lançado' : 'dias lançados'}
                    </span>
                  </div>
                </div>

                {/* Botão de Ação Rápida de Confirmação */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="text-[10px] text-slate-400 group-hover:text-emerald-300 transition flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Toque no card para ver dia a dia</span>
                  </div>

                  {isPaid ? (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCycleToConfirm(cycle);
                      }}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700/80 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                      title="Editar dados do recebimento"
                    >
                      <Pencil className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Editar Recebimento</span>
                    </motion.button>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCycleToConfirm(cycle);
                      }}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
                      title="Confirmar que o pagamento caiu na conta"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Marcar como Recebido</span>
                    </motion.button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL DE DETALHAMENTO DO CICLO AO CLICAR NO CARD */}
      {selectedCycleDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-5 sm:p-7 shadow-2xl relative max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Detalhamento do Pagamento (Dia {selectedCycleDetails.diaPagamento})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Corte: <strong>{selectedCycleDetails.corteLabel}</strong> • {formattedMonthName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCycleDetails(null)}
                className="w-10 h-10 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-[0.95] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status e Resumo do Fechamento */}
            <div className="mb-4 shrink-0 space-y-2">
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="text-slate-400 font-medium">Status do Recebimento:</span>
                {selectedCycleDetails.status === 'pago' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Pago / Na Conta
                  </span>
                ) : selectedCycleDetails.status === 'atrasado' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    Pagamento Atrasado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    Aguardando Pagamento
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Total a Receber
                  </span>
                  <span className="text-base sm:text-lg font-black text-emerald-400 font-mono block mt-0.5">
                    {formatCurrency(selectedCycleDetails.totalFaturamento)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Peças Entregues
                  </span>
                  <span className="text-base sm:text-lg font-black text-white font-mono block mt-0.5">
                    {selectedCycleDetails.totalPecas} un.
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Quilômetros
                  </span>
                  <span className="text-base sm:text-lg font-black text-teal-300 font-mono block mt-0.5">
                    {selectedCycleDetails.totalKm.toFixed(0)} km
                  </span>
                </div>
              </div>
            </div>

            {/* Lista dos dias que compõem o fechamento */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1 mb-1">
                Lançamentos deste Fechamento ({selectedCycleDetails.entries.length})
              </div>

              {selectedCycleDetails.entries.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/50 rounded-2xl border border-slate-800/80">
                  <Info className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-white">
                    Nenhum lançamento registrado neste corte
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Os lançamentos diários com data entre os{' '}
                    {selectedCycleDetails.corteLabel.toLowerCase()} aparecerão aqui
                    automaticamente.
                  </p>
                </div>
              ) : (
                selectedCycleDetails.entries.map((item) => {
                  const faturamento =
                    typeof item.faturamento_bruto === 'number'
                      ? item.faturamento_bruto
                      : item.qtd_pecas * item.valor_unitario_peca + item.valor_extra_bonus;

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono">
                            {formatDate(item.data)}
                          </span>
                          {item.valor_extra_bonus > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                              + Bônus {formatCurrency(item.valor_extra_bonus)}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>
                            {item.qtd_pecas} peças × {formatCurrency(item.valor_unitario_peca)}
                          </span>
                          <span>•</span>
                          <span>{item.km_rodado} km</span>
                        </div>

                        {item.observacoes && (
                          <p className="text-[10px] text-slate-400 italic mt-0.5">
                            &quot;{item.observacoes}&quot;
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-emerald-400 font-mono block">
                          {formatCurrency(faturamento)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Modal com botão de ação rápida */}
            <div className="pt-4 mt-3 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCycleDetails(null)}
                className="w-full sm:w-auto h-12 min-h-[48px] px-6 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white text-xs font-bold transition active:scale-[0.98] cursor-pointer"
              >
                Fechar
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = selectedCycleDetails;
                  setSelectedCycleDetails(null);
                  setCycleToConfirm(target);
                }}
                className="w-full sm:w-auto h-12 min-h-[48px] px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition active:scale-[0.98] cursor-pointer shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                {selectedCycleDetails.status === 'pago' ? (
                  <>
                    <Pencil className="w-4 h-4" />
                    <span>Editar Recebimento</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Marcar como Recebido na Conta</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE RECEBIMENTO */}
      <ConfirmPaymentModal
        isOpen={Boolean(cycleToConfirm)}
        onClose={() => setCycleToConfirm(null)}
        cycle={cycleToConfirm}
        userId={user?.id || ''}
        onSaveSuccess={handleSavePaymentSuccess}
        onRevertSuccess={handleRevertPaymentSuccess}
      />

      {/* MODAL DE CONFIGURAÇÃO DE RECEBIMENTO */}
      <PaymentConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
      />
    </>
  );
};
