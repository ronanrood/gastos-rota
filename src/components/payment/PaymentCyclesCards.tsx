import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/useAuth';
import type { DailyEarning } from '../../types/database';
import { computePaymentCycles, type PaymentCycleInfo } from '../../utils/paymentCycles';
import { PaymentConfigModal } from './PaymentConfigModal';
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
} from 'lucide-react';

const getCurrentMonthYear = (): string => new Date().toISOString().substring(0, 7);

interface PaymentCyclesCardsProps {
  earnings: DailyEarning[];
  referenceMonth?: string; // opcional 'YYYY-MM'
  title?: string;
  onRefresh?: () => void;
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
}) => {
  const { profile } = useAuth();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedCycleDetails, setSelectedCycleDetails] = useState<PaymentCycleInfo | null>(null);

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

  // Calcula os ciclos com base nos ganhos e nas configurações do perfil
  const { tipo, cycles } = useMemo(() => {
    return computePaymentCycles(earnings, profile, activeMonthStr);
  }, [earnings, profile, activeMonthStr]);

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
                Referência: <strong className="text-slate-300">{formattedMonthName}</strong> • {tipo === 'quinzenal' ? '2 Cortes' : '1 Corte'}
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
        <div className={`grid gap-3 ${tipo === 'quinzenal' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
          {cycles.map((cycle, index) => {
            const isFirst = index === 0;

            return (
              <div
                key={cycle.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCycleDetails(cycle)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedCycleDetails(cycle);
                  }
                }}
                className={`group text-left p-4 sm:p-5 rounded-3xl border transition-all duration-200 cursor-pointer relative overflow-hidden backdrop-blur-md shadow-lg hover:shadow-xl ${
                  cycle.isCurrent || (isFirst && tipo === 'quinzenal')
                    ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border-emerald-500/40 hover:border-emerald-500/60 ring-1 ring-emerald-500/20'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Glow decorativo suave */}
                {cycle.isCurrent && (
                  <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                )}

                <div className="flex items-start justify-between gap-2">
                  <div>
                    {/* Badge de Destaque */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          cycle.isCurrent
                            ? 'bg-emerald-500 text-slate-950 shadow-xs font-black'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {cycle.isCurrent ? 'Próximo Pagamento' : isFirst ? 'Ciclo Principal' : 'Segundo Ciclo'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {cycle.corteLabel}
                      </span>
                    </div>

                    {/* Título do Pagamento */}
                    <h4 className="text-sm sm:text-base font-extrabold text-white mt-1.5 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      Receber no Dia {cycle.diaPagamento}
                    </h4>
                  </div>

                  {/* Seta indicador de clique */}
                  <div className="w-7 h-7 rounded-xl bg-slate-800/80 group-hover:bg-emerald-500 group-hover:text-slate-950 text-slate-400 flex items-center justify-center transition shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Valor Total Acumulado */}
                <div className="mt-3.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Faturamento Acumulado no Período
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-0.5 tracking-tight font-mono">
                    {formatCurrency(cycle.totalFaturamento)}
                  </div>
                </div>

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
                    {cycle.entries.length} {cycle.entries.length === 1 ? 'dia lançado' : 'dias lançados'}
                  </span>
                </div>

                {/* Mensagem de clique para abrir */}
                <div className="mt-2 text-[10px] text-slate-400 group-hover:text-emerald-300 transition flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  Toque para ver a lista dia a dia deste pagamento
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL DE DETALHAMENTO DO CICLO AO CLICAR NO CARD */}
      {selectedCycleDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-5 sm:p-7 shadow-2xl relative max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
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

            {/* Resumo do Fechamento */}
            <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 mb-4 shrink-0">
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

            {/* Lista dos dias que compõem o fechamento */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1 mb-1">
                Lançamentos deste Fechamento ({selectedCycleDetails.entries.length})
              </div>

              {selectedCycleDetails.entries.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/50 rounded-2xl border border-slate-800/80">
                  <Info className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-white">Nenhum lançamento registrado neste corte</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Os lançamentos diários com data entre os {selectedCycleDetails.corteLabel.toLowerCase()} aparecerão aqui automaticamente.
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
                          <span>{item.qtd_pecas} peças × {formatCurrency(item.valor_unitario_peca)}</span>
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

            {/* Footer Modal */}
            <div className="pt-4 mt-3 border-t border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCycleDetails(null)}
                className="w-full sm:w-auto h-12 min-h-[48px] px-6 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white text-sm sm:text-xs font-bold transition active:scale-[0.98] cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIGURAÇÃO DE RECEBIMENTO */}
      <PaymentConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
      />
    </>
  );
};
