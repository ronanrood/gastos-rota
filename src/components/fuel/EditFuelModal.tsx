import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import type { FuelLog, FuelLogUpdate, FuelType, Vehicle } from '../../types/database';
import { modalBackdropVariants, modalContentVariants } from '../common/MotionVariants';
import {
  X,
  Pencil,
  Calendar,
  DollarSign,
  Gauge,
  AlertCircle,
  Sparkles,
  Zap,
} from 'lucide-react';

interface EditFuelModalProps {
  isOpen: boolean;
  onClose: () => void;
  fuelLog: FuelLog;
  vehicle: Vehicle | null;
  onSuccess: (updated: FuelLog) => void;
}

const getUnidade = (tipo: FuelType): string => {
  return tipo === 'gnv' ? 'm³' : 'litros';
};

export const EditFuelModal: React.FC<EditFuelModalProps> = ({
  isOpen,
  onClose,
  fuelLog,
  vehicle,
  onSuccess,
}) => {
  // Inicialização pura do estado
  const [data, setData] = useState<string>(() => fuelLog.data || '');
  const [tipoCombustivel, setTipoCombustivel] = useState<FuelType>(() => fuelLog.tipo_combustivel || 'gasolina');
  const [valorTotalAbastecido, setValorTotalAbastecido] = useState<string>(() => fuelLog.valor_total_abastecido?.toString() || '');
  const [precoPorLitro, setPrecoPorLitro] = useState<string>(() => fuelLog.preco_por_litro_ou_m3?.toString() || '');
  const [kmOdometro, setKmOdometro] = useState<string>(() => fuelLog.km_odometro?.toString() || '');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tecla ESC para fechar
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

  // Cálculos em tempo real
  const numValorTotal = parseFloat(valorTotalAbastecido) || 0;
  const numPrecoLitro = parseFloat(precoPorLitro) || 0;
  const numKm = parseFloat(kmOdometro);

  const litrosCalculados = useMemo(() => {
    if (numValorTotal > 0 && numPrecoLitro > 0) {
      return numValorTotal / numPrecoLitro;
    }
    return 0;
  }, [numValorTotal, numPrecoLitro]);

  const mediaVeiculo = useMemo(() => {
    if (!vehicle) return null;
    if (tipoCombustivel === 'gasolina') return vehicle.media_gasolina;
    if (tipoCombustivel === 'etanol') return vehicle.media_etanol;
    if (tipoCombustivel === 'gnv') return vehicle.media_gnv;
    return null;
  }, [vehicle, tipoCombustivel]);

  const autonomiaEstimada = useMemo(() => {
    if (litrosCalculados > 0 && mediaVeiculo && mediaVeiculo > 0) {
      return litrosCalculados * mediaVeiculo;
    }
    return 0;
  }, [litrosCalculados, mediaVeiculo]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!data) {
      setErrorMsg('Informe a data do abastecimento.');
      return;
    }
    if (numValorTotal <= 0) {
      setErrorMsg('Informe um valor total abastecido maior que zero.');
      return;
    }
    if (numPrecoLitro <= 0) {
      setErrorMsg('Informe o preço por litro ou m³ maior que zero.');
      return;
    }
    if (isNaN(numKm) || numKm < 0) {
      setErrorMsg('Informe uma quilometragem válida do odômetro.');
      return;
    }

    setSubmitting(true);

    try {
      /**
       * REGRA CRÍTICA DO SUPABASE:
       * NUNCA envie a coluna 'litros_calculados', 'id' ou 'created_at' no payload do UPDATE.
       * A coluna litros_calculados é GENERATED ALWAYS no PostgreSQL.
       */
      const payload: FuelLogUpdate = {
        data,
        tipo_combustivel: tipoCombustivel,
        valor_total_abastecido: Number(numValorTotal.toFixed(2)),
        preco_por_litro_ou_m3: Number(numPrecoLitro.toFixed(3)),
        km_odometro: Number(numKm.toFixed(1)),
      };

      const { data: updated, error } = await supabase
        .from('fuel_logs')
        .update(payload)
        .eq('id', fuelLog.id)
        .select('*')
        .single();

      if (error) throw error;

      // Se odômetro for maior que o atual do veículo, atualiza veículo também
      if (vehicle && numKm > (vehicle.km_atual || 0)) {
        await supabase
          .from('vehicles')
          .update({ km_atual: Number(numKm.toFixed(1)) })
          .eq('id', vehicle.id);
      }

      if (updated) {
        onSuccess(updated as FuelLog);
        onClose();
      }
    } catch (err: unknown) {
      console.error('Erro ao atualizar abastecimento:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar abastecimento.';
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
            aria-labelledby="modal-edit-fuel-title"
            variants={modalContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative my-auto z-10"
          >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-edit-fuel-title" className="text-base sm:text-lg font-bold text-white leading-tight">
                Editar Abastecimento
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Altere valores, combustível ou odômetro
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="w-10 h-10 min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visor em tempo real de Litros e Autonomia */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-950/80 border border-amber-500/30 grid grid-cols-2 gap-3 items-center">
          <div>
            <span className="text-[10px] font-semibold tracking-wider text-amber-400 uppercase flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Litros Calculados
            </span>
            <div className="text-2xl sm:text-3xl font-black text-white mt-0.5 font-mono">
              {litrosCalculados.toFixed(2)}{' '}
              <span className="text-xs font-normal text-slate-400">
                {getUnidade(tipoCombustivel)}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Autonomia Estimada
            </span>
            <span className="text-sm sm:text-base font-bold text-emerald-400 font-mono flex items-center gap-1 justify-end">
              <Zap className="w-3.5 h-3.5" />
              {autonomiaEstimada > 0 ? `~${autonomiaEstimada.toFixed(0)} km` : 'Cadastre média'}
            </span>
          </div>
        </div>

        {/* Erro */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Tipo de Combustível */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Tipo de Combustível
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['gasolina', 'etanol', 'gnv'] as FuelType[]).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setTipoCombustivel(tipo)}
                  className={`py-2.5 px-3 min-h-[44px] rounded-xl text-xs font-semibold capitalize border transition active:scale-[0.97] cursor-pointer ${
                    tipoCombustivel === tipo
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-sm'
                      : 'bg-slate-950/60 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {tipo}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Data */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Data do Abastecimento
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  type="date"
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                />
              </div>
            </div>

            {/* Odômetro KM */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                KM Atual no Odômetro
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Gauge className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  required
                  min="0"
                  step="0.1"
                  value={kmOdometro}
                  onChange={(e) => setKmOdometro(e.target.value)}
                  placeholder="Ex: 85400"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition font-mono"
                />
              </div>
            </div>

            {/* Valor Total Pago */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Valor Total Pago (R$)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <DollarSign className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  required
                  min="0.01"
                  step="0.01"
                  value={valorTotalAbastecido}
                  onChange={(e) => setValorTotalAbastecido(e.target.value)}
                  placeholder="Ex: 150.00"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition font-mono"
                />
              </div>
            </div>

            {/* Preço por Litro */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Preço por {getUnidade(tipoCombustivel)} (R$)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <DollarSign className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  required
                  min="0.001"
                  step="0.001"
                  value={precoPorLitro}
                  onChange={(e) => setPrecoPorLitro(e.target.value)}
                  placeholder="Ex: 5.89"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition font-mono"
                />
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition active:scale-[0.98] cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-md shadow-amber-500/20 transition active:scale-[0.98] cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )}
</AnimatePresence>
  );
};
