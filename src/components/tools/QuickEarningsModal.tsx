import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Package,
  Calendar,
  Gauge,
  DollarSign,
  AlertCircle,
  RotateCw,
  CheckCircle2,
  Gift,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import type { DailyEarning, Vehicle } from '../../types/database';
import { modalBackdropVariants, modalContentVariants } from '../common/MotionVariants';
import { formatCurrency } from '../../utils/exportUtils';
import { AnimatedCounter } from '../common/AnimatedCounter';

export interface QuickEarningsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQtdPecas: string;
  initialValorPeca: string;
  initialBonusExtra: string;
  initialDistanciaKm: string;
  simulatedLucroLiquido?: number;
  vehicle: Vehicle | null;
  onSuccess: (savedEarning: DailyEarning, updatedVehicleKm?: number) => void;
}

const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const QuickEarningsModal: React.FC<QuickEarningsModalProps> = ({
  isOpen,
  onClose,
  initialQtdPecas,
  initialValorPeca,
  initialBonusExtra,
  initialDistanciaKm,
  simulatedLucroLiquido,
  vehicle,
  onSuccess,
}) => {
  const { user } = useAuth();
  const pecasInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<string>(getTodayDateString);
  const [qtdPecas, setQtdPecas] = useState<string>(initialQtdPecas || '80');
  const [valorUnitarioPeca, setValorUnitarioPeca] = useState<string>(initialValorPeca || '4.50');
  const [valorExtraBonus, setValorExtraBonus] = useState<string>(initialBonusExtra || '0');
  const [kmRodado, setKmRodado] = useState<string>(initialDistanciaKm || '90');
  const [observacoes, setObservacoes] = useState<string>(() => {
    if (typeof simulatedLucroLiquido === 'number' && !isNaN(simulatedLucroLiquido)) {
      return `Rota lançada via Simulador (Lucro líq. estimado: ${formatCurrency(simulatedLucroLiquido)})`;
    }
    return 'Rota lançada via Simulador de Viabilidade';
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Foco inicial no campo de peças ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (pecasInputRef.current) {
          pecasInputRef.current.focus();
          pecasInputRef.current.select();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Tecla ESC para fechar e travar scroll do body
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Cálculos numéricos em tempo real
  const numPecas = Math.floor(parseFloat(qtdPecas.replace(',', '.'))) || 0;
  const numValorUnit = parseFloat(valorUnitarioPeca.replace(',', '.')) || 0;
  const numBonus = parseFloat(valorExtraBonus.replace(',', '.')) || 0;
  const numKm = parseFloat(kmRodado.replace(',', '.')) || 0;

  const totalBrutoCalculado = useMemo(() => {
    const bruto = numPecas * numValorUnit + numBonus;
    return Math.max(0, bruto);
  }, [numPecas, numValorUnit, numBonus]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user) {
      setErrorMsg('Sessão expirada. Por favor faça login novamente.');
      return;
    }

    if (!data) {
      setErrorMsg('Informe a data da rota.');
      return;
    }

    if (numPecas <= 0) {
      setErrorMsg('A quantidade de peças entregues deve ser maior que zero.');
      return;
    }

    if (numValorUnit < 0) {
      setErrorMsg('O valor por peça não pode ser negativo.');
      return;
    }

    if (numBonus < 0) {
      setErrorMsg('O bônus/extra não pode ser negativo.');
      return;
    }

    if (numKm < 0) {
      setErrorMsg('O KM rodado não pode ser negativo.');
      return;
    }

    setSubmitting(true);

    try {
      /**
       * REGRA CRÍTICA DO SUPABASE:
       * NUNCA envie a coluna 'faturamento_bruto' no payload do INSERT,
       * pois o PostgreSQL calcula ela automaticamente (GENERATED ALWAYS STORED).
       */
      const payload = {
        user_id: user.id,
        data,
        qtd_pecas: numPecas,
        valor_unitario_peca: Number(numValorUnit.toFixed(2)),
        valor_extra_bonus: Number(numBonus.toFixed(2)),
        km_rodado: Number(numKm.toFixed(1)),
        observacoes: observacoes.trim() ? observacoes.trim() : null,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('daily_earnings')
        .insert(payload)
        .select('*')
        .single();

      if (insertError) {
        throw insertError;
      }

      // Atualização automática do odômetro do veículo para manter Saúde Preventiva sincronizada
      let updatedVehicleKm: number | undefined;
      if (numKm > 0) {
        try {
          const currentVehKm = vehicle?.km_atual || 0;
          const newKm = Number((currentVehKm + numKm).toFixed(1));

          if (vehicle?.id) {
            const { error: vErr } = await supabase
              .from('vehicles')
              .update({ km_atual: newKm })
              .eq('id', vehicle.id);

            if (!vErr) {
              updatedVehicleKm = newKm;
            }
          } else {
            // Fallback caso vehicle em state não possua id carregado
            const { data: v } = await supabase
              .from('vehicles')
              .select('id, km_atual')
              .eq('user_id', user.id)
              .maybeSingle();

            if (v) {
              const fallbackKm = Number(((v.km_atual || 0) + numKm).toFixed(1));
              const { error: vErr } = await supabase
                .from('vehicles')
                .update({ km_atual: fallbackKm })
                .eq('id', v.id);

              if (!vErr) {
                updatedVehicleKm = fallbackKm;
              }
            }
          }
        } catch (vehErr) {
          console.warn('Erro ao atualizar odômetro do veículo:', vehErr);
        }
      }

      if (inserted) {
        onSuccess(inserted as DailyEarning, updatedVehicleKm);
        onClose();
      }
    } catch (err: unknown) {
      console.error('Erro ao registrar rota nos ganhos diários:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Falha ao salvar ganho diário. Tente novamente.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4">
          <motion.div
            variants={modalBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-quick-earnings-title"
            variants={modalContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative my-auto z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="modal-quick-earnings-title"
                    className="text-base sm:text-lg font-bold text-white leading-tight"
                  >
                    Registrar Rota nos Ganhos Diários
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Lançamento oficial pré-preenchido pelo simulador
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar modal"
                className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Visor em Destaque do Total Bruto */}
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-blue-950/70 via-slate-950 to-slate-950 border border-blue-500/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Total Bruto a Receber
                  </span>
                  <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight mt-0.5">
                    <AnimatedCounter value={totalBrutoCalculado} decimals={2} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 self-start sm:self-center text-[11px] font-bold">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30">
                    📦 {numPecas} peças
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                    {formatCurrency(numValorUnit)}/un
                  </span>
                  {numKm > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/30">
                      🛣️ {numKm.toFixed(1)} km
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Data da Rota e KM Rodado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    Data da Rota
                  </label>
                  <input
                    type="date"
                    required
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Hoje (altere se realizou ontem)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-teal-400" />
                    KM Rodado na Rota
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      required
                      value={kmRodado}
                      onChange={(e) => setKmRodado(e.target.value)}
                      placeholder="90.0"
                      className="w-full px-3 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 text-xs font-bold pointer-events-none">
                      km
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Atualiza a saúde do veículo
                  </span>
                </div>
              </div>

              {/* Peças e Valor Unitário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-blue-400" />
                    Quantidade de Peças
                  </label>
                  <input
                    ref={pecasInputRef}
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="1"
                    required
                    value={qtdPecas}
                    onChange={(e) => setQtdPecas(e.target.value)}
                    placeholder="80"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    Valor por Peça (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold pointer-events-none">
                      R$
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      required
                      value={valorUnitarioPeca}
                      onChange={(e) => setValorUnitarioPeca(e.target.value)}
                      placeholder="4.50"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Bônus / Diária Base */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-amber-400" />
                  Bônus / Diária Base / Taxa Extra (Opcional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold pointer-events-none">
                    R$
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={valorExtraBonus}
                    onChange={(e) => setValorExtraBonus(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Observações (Opcional)
                </label>
                <input
                  type="text"
                  maxLength={160}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Rota zona sul concluída com sucesso"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Botões de Ação */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="w-full sm:w-auto px-4 py-3 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:flex-1 min-h-[48px] h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin text-white" />
                      <span>Salvando Ganho...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar e Salvar Ganho</span>
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
