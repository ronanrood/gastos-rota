import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pencil,
  ChevronDown,
  ChevronUp,
  Share2,
  FileText,
  Package,
  Gauge,
  Check,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import type { DailyEarning, Profile, Vehicle, PaymentCycleRecord } from '../../types/database';
import {
  computePaymentCycles,
  type PaymentCycleInfo,
} from '../../utils/paymentCycles';
import { ConfirmPaymentModal } from './ConfirmPaymentModal';
import { ReportPrintModal } from '../export/ReportPrintModal';
import {
  copyToClipboard,
  openWhatsAppShare,
  generateWhatsAppEarningsText,
} from '../../utils/exportUtils';

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

const getInitialCurrentMonthStr = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const INITIAL_CURRENT_MONTH = getInitialCurrentMonthStr();

interface PaymentCyclesHistoryProps {
  earnings: DailyEarning[];
  profile: Profile | null;
  vehicle?: Vehicle | null;
  paymentRecords: PaymentCycleRecord[];
  onPaymentRecordUpdated?: (rec: PaymentCycleRecord) => void;
  onPaymentRecordReverted?: (refKey: string) => void;
}

export const PaymentCyclesHistory: React.FC<PaymentCyclesHistoryProps> = ({
  earnings,
  profile,
  vehicle,
  paymentRecords,
  onPaymentRecordUpdated,
  onPaymentRecordReverted,
}) => {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [cycleToConfirm, setCycleToConfirm] = useState<PaymentCycleInfo | null>(null);
  const [pdfCycle, setPdfCycle] = useState<PaymentCycleInfo | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Descobre todos os meses com movimentação ou registros salvos
  const allCycles = useMemo(() => {
    const monthSet = new Set<string>();

    // Mês atual
    monthSet.add(INITIAL_CURRENT_MONTH);

    // Meses com lançamentos
    earnings.forEach((e) => {
      if (e.data && e.data.length >= 7) {
        monthSet.add(e.data.substring(0, 7));
      }
    });

    // Meses com registros salvos em payment_cycles
    paymentRecords.forEach((r) => {
      if (r.referencia_chave && r.referencia_chave.length >= 7) {
        monthSet.add(r.referencia_chave.substring(0, 7));
      }
    });

    const months = Array.from(monthSet).sort().reverse();

    const result: PaymentCycleInfo[] = [];

    months.forEach((mStr) => {
      const { cycles } = computePaymentCycles(earnings, profile, mStr, paymentRecords);
      cycles.forEach((c) => {
        // Inclui se tem lançamentos OU se tem registro na tabela payment_cycles
        if (c.entries.length > 0 || c.paymentRecord) {
          result.push(c);
        }
      });
    });

    // Ordena pelo período mais recente primeiro
    result.sort((a, b) => b.periodoFim.localeCompare(a.periodoFim));

    return result;
  }, [earnings, profile, paymentRecords]);

  const handleCopyWhatsApp = async (cycle: PaymentCycleInfo) => {
    const text = generateWhatsAppEarningsText({
      profile,
      periodLabel: `${cycle.cycleName} (${cycle.corteLabel}) - Ref: ${cycle.referenceMonthYear}`,
      items: cycle.entries,
      paymentNotice: `Data Prevista: Dia ${cycle.diaPagamento} (${cycle.dataPagamentoPrevista.split('-').reverse().join('/')})`,
      vehicle,
    });

    const success = await copyToClipboard(text);
    if (success) {
      setCopiedKey(cycle.referenciaChave);
      setTimeout(() => setCopiedKey(null), 3000);
    }
  };

  const handleShareWhatsApp = (cycle: PaymentCycleInfo) => {
    const text = generateWhatsAppEarningsText({
      profile,
      periodLabel: `${cycle.cycleName} (${cycle.corteLabel}) - Ref: ${cycle.referenceMonthYear}`,
      items: cycle.entries,
      paymentNotice: `Data Prevista: Dia ${cycle.diaPagamento} (${cycle.dataPagamentoPrevista.split('-').reverse().join('/')})`,
      vehicle,
    });
    openWhatsAppShare(text);
  };

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Header da Seção */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Receipt className="w-5 h-5 stroke-[2.3]" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Meus Fechamentos (Holerites)
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {allCycles.length} {allCycles.length === 1 ? 'ciclo' : 'ciclos'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Histórico consolidado de quinzenas, status de recebimento na conta e comprovantes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="w-10 h-10 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-[0.95] cursor-pointer"
            title={isCollapsed ? 'Expandir seção' : 'Recolher seção'}
          >
            {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        </div>

        {/* Conteúdo da Lista de Fechamentos */}
        {!isCollapsed && (
          <div className="mt-4 space-y-3.5">
            {allCycles.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800/80">
                <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">
                  Nenhum fechamento registrado ainda
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Assim que você registrar os ganhos diários na sua rota, as quinzenas e meses
                  aparecerão aqui automaticamente para você acompanhar o pagamento.
                </p>
              </div>
            ) : (
              allCycles.map((cycle) => {
                const isPaid = cycle.status === 'pago';
                const isLate = cycle.status === 'atrasado';
                const rec = cycle.paymentRecord;
                const recValue = rec?.valor_recebido ?? cycle.totalFaturamento;
                const diff = isPaid && rec ? recValue - cycle.totalFaturamento : 0;
                const hasDiff = isPaid && rec && Math.abs(diff) >= 0.01;

                return (
                  <div
                    key={cycle.referenciaChave}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden backdrop-blur-xs flex flex-col justify-between gap-3 ${
                      isPaid
                        ? 'bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                        : isLate
                        ? 'bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Linha Superior: Nome do Ciclo + Badges de Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-emerald-400" />
                          {cycle.cycleName} ({cycle.corteLabel})
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">
                          {cycle.referenceMonthYear}
                        </span>
                      </div>

                      {/* Badge de Status */}
                      <div>
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>
                              Pago na Conta{' '}
                              {rec?.data_confirmacao && (
                                <span className="font-mono text-[11px] text-slate-300">
                                  ({formatDate(rec.data_confirmacao)})
                                </span>
                              )}
                            </span>
                          </span>
                        ) : isLate ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>Atrasado (Era dia {cycle.diaPagamento})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Aguardando (Dia {cycle.diaPagamento})</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bloco Central de Valores: Calculado vs. Recebido */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                          Valor Calculado (App)
                        </span>
                        <span className="text-base sm:text-lg font-black text-white font-mono mt-0.5 block">
                          {formatCurrency(cycle.totalFaturamento)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                          Valor Recebido (Conta)
                        </span>
                        {isPaid && rec ? (
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-base sm:text-lg font-black text-emerald-400 font-mono block">
                              {formatCurrency(recValue)}
                            </span>
                            {hasDiff && (
                              <span
                                className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md ${
                                  diff < 0
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-emerald-500/20 text-emerald-300'
                                }`}
                              >
                                {diff < 0 ? '-' : '+'}
                                {formatCurrency(Math.abs(diff))}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-slate-400 mt-1 block italic">
                            Aguardando confirmação
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                          Produção do Ciclo
                        </span>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-300 font-mono">
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3 text-blue-400" />
                            {cycle.totalPecas} un.
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Gauge className="w-3 h-3 text-amber-400" />
                            {cycle.totalKm.toFixed(0)} km
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Observações do Pagamento se houver */}
                    {rec?.observacoes && (
                      <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 italic">
                        <strong>Obs:</strong> &quot;{rec.observacoes}&quot;
                      </div>
                    )}

                    {/* Linha Inferior com Botões de Ação */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                      <div className="flex items-center gap-2">
                        {/* Botão de Confirmação / Edição */}
                        {isPaid ? (
                          <button
                            type="button"
                            onClick={() => setCycleToConfirm(cycle)}
                            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <Pencil className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Editar Recebimento</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCycleToConfirm(cycle)}
                            className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition active:scale-[0.98] cursor-pointer shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                            <span>Marcar como Recebido</span>
                          </button>
                        )}
                      </div>

                      {/* Botões de Exportação: WhatsApp e PDF do Holerite */}
                      <div className="flex items-center gap-2">
                        {/* Copiar / WhatsApp */}
                        <button
                          type="button"
                          onClick={() => handleCopyWhatsApp(cycle)}
                          className="flex-1 sm:flex-none min-h-[40px] px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                          title="Copiar texto do holerite"
                        >
                          {copiedKey === cycle.referenciaChave ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-300 font-bold">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleShareWhatsApp(cycle)}
                          className="flex-1 sm:flex-none min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                          title="Enviar holerite via WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>WhatsApp</span>
                        </button>

                        {/* Gerar PDF */}
                        <button
                          type="button"
                          onClick={() => setPdfCycle(cycle)}
                          className="flex-1 sm:flex-none min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                          title="Gerar e imprimir holerite em PDF"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Recebimento */}
      {cycleToConfirm && user && (
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

      {/* Modal de PDF do Holerite do Ciclo */}
      {pdfCycle && (
        <ReportPrintModal
          isOpen={Boolean(pdfCycle)}
          onClose={() => setPdfCycle(null)}
          reportType="earnings"
          profile={profile}
          vehicle={vehicle}
          periodLabel={`${pdfCycle.cycleName} (${pdfCycle.corteLabel}) - ${pdfCycle.referenceMonthYear}`}
          paymentNotice={`Data Prevista: Dia ${pdfCycle.diaPagamento} (${pdfCycle.dataPagamentoPrevista.split('-').reverse().join('/')})`}
          earningsItems={pdfCycle.entries}
        />
      )}
    </>
  );
};
