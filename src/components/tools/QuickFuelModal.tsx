import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Fuel,
  Calendar,
  Gauge,
  Sparkles,
  AlertCircle,
  RotateCw,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import type { FuelLog, FuelLogInsert, FuelType, Vehicle } from '../../types/database';
import { modalBackdropVariants, modalContentVariants } from '../common/MotionVariants';

export interface QuickFuelModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFuelType: FuelType;
  precoEtanol: string;
  precoGasolina: string;
  precoGnv: string;
  mediaEtanol: string;
  mediaGasolina: string;
  mediaGnv: string;
  simuladorValor: string;
  vehicle: Vehicle | null;
  onSuccess: (savedLog: FuelLog, updatedVehicleKm?: number) => void;
}

const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const QuickFuelModal: React.FC<QuickFuelModalProps> = ({
  isOpen,
  onClose,
  initialFuelType,
  precoEtanol,
  precoGasolina,
  precoGnv,
  mediaEtanol,
  mediaGasolina,
  mediaGnv,
  simuladorValor,
  vehicle,
  onSuccess,
}) => {
  const { user } = useAuth();
  const amountInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<string>(getTodayDateString);
  const [tipoCombustivel, setTipoCombustivel] = useState<FuelType>(initialFuelType);
  const [precoPorLitro, setPrecoPorLitro] = useState<string>(() => {
    if (initialFuelType === 'etanol') return precoEtanol || '3.99';
    if (initialFuelType === 'gnv') return precoGnv || '4.79';
    return precoGasolina || '5.89';
  });
  const [valorTotalAbastecido, setValorTotalAbastecido] = useState<string>(() => {
    return parseFloat(simuladorValor) > 0 ? simuladorValor : '200.00';
  });
  const [kmOdometro, setKmOdometro] = useState<string>(() => {
    return vehicle?.km_atual?.toString() || '';
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Foco automático no campo de valor total após breve delay para animação de abertura
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (amountInputRef.current) {
          amountInputRef.current.focus();
          amountInputRef.current.select();
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

  // Ao alternar o combustível dentro do modal, atualiza o preço sugerido
  const handleSelectTipo = (tipo: FuelType) => {
    setTipoCombustivel(tipo);
    if (tipo === 'etanol') {
      setPrecoPorLitro(precoEtanol || '3.99');
    } else if (tipo === 'gnv') {
      setPrecoPorLitro(precoGnv || '4.79');
    } else {
      setPrecoPorLitro(precoGasolina || '5.89');
    }
  };

  // Média de consumo correspondente ao combustível ativo
  const mediaAtiva = useMemo(() => {
    if (tipoCombustivel === 'etanol') return parseFloat(mediaEtanol) || 7.7;
    if (tipoCombustivel === 'gnv') return parseFloat(mediaGnv) || 14.0;
    return parseFloat(mediaGasolina) || 11.0;
  }, [tipoCombustivel, mediaEtanol, mediaGasolina, mediaGnv]);

  // Cálculos dinâmicos em tempo real
  const numValorTotal = parseFloat(valorTotalAbastecido.replace(',', '.')) || 0;
  const numPrecoLitro = parseFloat(precoPorLitro.replace(',', '.')) || 0;
  const numKm = parseFloat(kmOdometro.replace(',', '.'));

  const volumeCalculado = useMemo(() => {
    if (numValorTotal > 0 && numPrecoLitro > 0) {
      return numValorTotal / numPrecoLitro;
    }
    return 0;
  }, [numValorTotal, numPrecoLitro]);

  const autonomiaEstimada = useMemo(() => {
    if (volumeCalculado > 0 && mediaAtiva > 0) {
      return Math.round(volumeCalculado * mediaAtiva);
    }
    return 0;
  }, [volumeCalculado, mediaAtiva]);

  const unidadeVolume = tipoCombustivel === 'gnv' ? 'm³' : 'Litros';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user) {
      setErrorMsg('Usuário não autenticado.');
      return;
    }

    if (!data) {
      setErrorMsg('Informe a data do abastecimento.');
      return;
    }

    if (numValorTotal <= 0) {
      setErrorMsg('Informe o valor total abastecido (maior que zero).');
      return;
    }

    if (numPrecoLitro <= 0) {
      setErrorMsg('Informe o preço por litro ou m³ válido.');
      return;
    }

    const kmFinal = !isNaN(numKm) && numKm >= 0 ? numKm : (vehicle?.km_atual || 0);

    setSubmitting(true);

    try {
      /**
       * REGRA CRÍTICA DO SUPABASE:
       * NUNCA envie a coluna 'litros_calculados' no payload do INSERT,
       * pois o PostgreSQL calcula ela automaticamente (GENERATED ALWAYS STORED).
       */
      const payload: FuelLogInsert = {
        user_id: user.id,
        data,
        tipo_combustivel: tipoCombustivel,
        valor_total_abastecido: Number(numValorTotal.toFixed(2)),
        preco_por_litro_ou_m3: Number(numPrecoLitro.toFixed(3)),
        km_odometro: Number(kmFinal.toFixed(1)),
      };

      const { data: inserted, error: insertError } = await supabase
        .from('fuel_logs')
        .insert(payload)
        .select('*')
        .single();

      if (insertError) {
        throw insertError;
      }

      // Se o odômetro abastecido for maior que o km atual do veículo, atualiza o veículo
      let updatedVehicleKm: number | undefined;
      if (vehicle && kmFinal > (vehicle.km_atual || 0)) {
        const { error: vehError } = await supabase
          .from('vehicles')
          .update({ km_atual: Number(kmFinal.toFixed(1)) })
          .eq('id', vehicle.id);

        if (!vehError) {
          updatedVehicleKm = kmFinal;
        } else {
          console.warn('Erro ao atualizar km_atual do veículo:', vehError);
        }
      }

      if (inserted) {
        onSuccess(inserted as FuelLog, updatedVehicleKm);
        onClose();
      }
    } catch (err: unknown) {
      console.error('Erro ao registrar abastecimento rápido:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao salvar abastecimento. Tente novamente.';
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
            aria-labelledby="modal-quick-fuel-title"
            variants={modalContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative my-auto z-10"
          >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-quick-fuel-title" className="text-base sm:text-lg font-bold text-white leading-tight">
                Registrar Abastecimento Rápido
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Valores pré-preenchidos do comparador de combustível
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

        {/* Visor em Tempo Real: Volume e Autonomia Estimada */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-emerald-950/60 via-slate-950 to-slate-950 border border-emerald-500/30">
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Volume Calculado
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white mt-0.5 font-mono">
                {volumeCalculado.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">{unidadeVolume}</span>
              </div>
            </div>

            <div className="border-l border-slate-800 pl-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5" />
                Autonomia Estimada
              </span>
              <div className="text-2xl sm:text-3xl font-black text-teal-300 mt-0.5 font-mono">
                +{autonomiaEstimada}{' '}
                <span className="text-xs font-normal text-slate-400">KM</span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              Volume abastecido: <strong className="text-white font-mono">{volumeCalculado.toFixed(2)} {unidadeVolume}</strong>
            </span>
            <span>
              Autonomia estimada: <strong className="text-emerald-400 font-mono">+{autonomiaEstimada} KM</strong>
            </span>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Seletor de Tipo de Combustível */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tipo de Combustível
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'etanol' as FuelType, label: '🌿 Etanol' },
                { id: 'gasolina' as FuelType, label: '⛽ Gasolina' },
                { id: 'gnv' as FuelType, label: '⚡ GNV' },
              ].map((btn) => {
                const isSelected = tipoCombustivel === btn.id;
                return (
                  <motion.button
                    key={btn.id}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => handleSelectTipo(btn.id)}
                    className={`relative min-h-[44px] py-2 px-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                      isSelected
                        ? 'text-slate-950 font-black'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="quickFuelTypeIndicator"
                        className="absolute inset-0 bg-emerald-500 rounded-xl -z-10 shadow-md shadow-emerald-500/25"
                        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                      />
                    )}
                    <span>{btn.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Valor Total Abastecido & Preço por Litro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Valor Total Abastecido (R$) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">
                  R$
                </span>
                <input
                  ref={amountInputRef}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0,00"
                  value={valorTotalAbastecido}
                  onChange={(e) => setValorTotalAbastecido(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                />
              </div>
              <span className="text-[10px] text-slate-500 block mt-1">
                Quanto você realmente pagou na bomba
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Preço por {unidadeVolume === 'm³' ? 'm³' : 'Litro'} (R$) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">
                  R$
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min="0.001"
                  required
                  placeholder="0,000"
                  value={precoPorLitro}
                  onChange={(e) => setPrecoPorLitro(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                />
              </div>
              <span className="text-[10px] text-slate-500 block mt-1">
                Trazido do comparador
              </span>
            </div>
          </div>

          {/* Data e KM Odômetro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Data do Abastecimento *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Calendar className="w-4 h-4" />
                </span>
                <input
                  type="date"
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                KM no Odômetro (Opcional)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Gauge className="w-4 h-4" />
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  placeholder={vehicle?.km_atual ? `Atual: ${vehicle.km_atual}` : 'Ex: 125400'}
                  value={kmOdometro}
                  onChange={(e) => setKmOdometro(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                />
              </div>
              <span className="text-[10px] text-slate-500 block mt-1">
                {vehicle?.km_atual ? `Sugestão: ${vehicle.km_atual} km` : 'Odômetro do painel'}
              </span>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-semibold transition active:scale-[0.98] cursor-pointer"
            >
              Cancelar
            </button>

            <motion.button
              type="submit"
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.01 }}
              disabled={submitting || numValorTotal <= 0 || numPrecoLitro <= 0}
              className="flex-[2] min-h-[48px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs sm:text-sm font-black transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Confirmar e Salvar Abastecimento</span>
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
