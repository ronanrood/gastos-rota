import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import type { DailyEarning, DailyEarningUpdate } from '../../types/database';
import {
  X,
  Pencil,
  Calendar,
  Package,
  DollarSign,
  Gift,
  Gauge,
  FileText,
  AlertCircle,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

interface EditEarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  earning: DailyEarning;
  onSuccess: (updated: DailyEarning) => void;
}

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

export const EditEarningModal: React.FC<EditEarningModalProps> = ({
  isOpen,
  onClose,
  earning,
  onSuccess,
}) => {
  // Inicialização direta do estado sem useEffect para evitar renderizações em cascata
  const [data, setData] = useState<string>(() => earning.data || '');
  const [qtdPecas, setQtdPecas] = useState<string>(() => earning.qtd_pecas?.toString() || '');
  const [valorUnitarioPeca, setValorUnitarioPeca] = useState<string>(() => earning.valor_unitario_peca?.toString() || '');
  const [valorExtraBonus, setValorExtraBonus] = useState<string>(() => earning.valor_extra_bonus?.toString() || '0');
  const [kmRodado, setKmRodado] = useState<string>(() => earning.km_rodado?.toString() || '');
  const [observacoes, setObservacoes] = useState<string>(() => earning.observacoes || '');

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
  const numPecas = parseFloat(qtdPecas) || 0;
  const numValorUnit = parseFloat(valorUnitarioPeca) || 0;
  const numBonus = parseFloat(valorExtraBonus) || 0;
  const numKm = parseFloat(kmRodado) || 0;

  const totalBrutoEstimado = useMemo(() => {
    return numPecas * numValorUnit + numBonus;
  }, [numPecas, numValorUnit, numBonus]);

  const rendimentoPorKm = useMemo(() => {
    if (numKm > 0 && totalBrutoEstimado > 0) {
      return totalBrutoEstimado / numKm;
    }
    return 0;
  }, [totalBrutoEstimado, numKm]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!data) {
      setErrorMsg('Informe a data do lançamento.');
      return;
    }
    if (numPecas <= 0) {
      setErrorMsg('A quantidade de peças entregues deve ser maior que zero.');
      return;
    }
    if (numValorUnit <= 0) {
      setErrorMsg('O valor unitário por peça deve ser maior que zero.');
      return;
    }
    if (numBonus < 0) {
      setErrorMsg('O bônus extra não pode ser negativo.');
      return;
    }
    if (numKm < 0) {
      setErrorMsg('A quilometragem rodada não pode ser negativa.');
      return;
    }

    setSubmitting(true);

    try {
      /**
       * REGRA CRÍTICA DO SUPABASE:
       * NUNCA inclua 'faturamento_bruto', 'id' ou 'created_at' no payload de UPDATE.
       * A coluna faturamento_bruto é GENERATED ALWAYS no PostgreSQL.
       */
      const payload: DailyEarningUpdate = {
        data,
        qtd_pecas: numPecas,
        valor_unitario_peca: Number(numValorUnit.toFixed(2)),
        valor_extra_bonus: Number(numBonus.toFixed(2)),
        km_rodado: Number(numKm.toFixed(1)),
        observacoes: observacoes.trim() || null,
      };

      const { data: updated, error } = await supabase
        .from('daily_earnings')
        .update(payload)
        .eq('id', earning.id)
        .select('*')
        .single();

      if (error) throw error;

      if (updated) {
        onSuccess(updated as DailyEarning);
        onClose();
      }
    } catch (err: unknown) {
      console.error('Erro ao atualizar lançamento:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar lançamento.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-edit-earning-title"
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header do Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-edit-earning-title" className="text-base sm:text-lg font-bold text-white leading-tight">
                Editar Lançamento
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Altere valores, peças, quilometragem ou observações
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

        {/* Visor em tempo real do Total Recalculado */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-emerald-400 uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Novo Total Estimado
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-0.5 font-mono">
              {formatCurrency(totalBrutoEstimado)}
            </div>
          </div>
          {rendimentoPorKm > 0 && (
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                Rendimento / KM
              </span>
              <span className="text-sm sm:text-base font-bold text-emerald-400 font-mono flex items-center gap-1 justify-end">
                <TrendingUp className="w-3.5 h-3.5" />
                {formatCurrency(rendimentoPorKm)}/km
              </span>
            </div>
          )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Data */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Data do Lançamento
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
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
            </div>

            {/* Qtd Peças */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Qtd. de Peças Entregues
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Package className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  required
                  min="1"
                  step="1"
                  value={qtdPecas}
                  onChange={(e) => setQtdPecas(e.target.value)}
                  placeholder="Ex: 120"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-mono"
                />
              </div>
            </div>

            {/* Valor Unitário */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Valor por Peça (R$)
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
                  value={valorUnitarioPeca}
                  onChange={(e) => setValorUnitarioPeca(e.target.value)}
                  placeholder="Ex: 3.50"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-mono"
                />
              </div>
            </div>

            {/* Bônus Extra */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Bônus Extra (R$)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Gift className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={valorExtraBonus}
                  onChange={(e) => setValorExtraBonus(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-mono"
                />
              </div>
            </div>

            {/* KM Rodado */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                KM Rodado no Dia
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
                  value={kmRodado}
                  onChange={(e) => setKmRodado(e.target.value)}
                  placeholder="Ex: 85.5"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-mono"
                />
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Observações
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <FileText className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Rota centro / chuva"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
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
              className="px-5 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 shadow-md shadow-emerald-500/20 transition active:scale-[0.98] cursor-pointer flex items-center gap-2 disabled:opacity-50"
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
      </div>
    </div>
  );
};
