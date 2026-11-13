import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckCircle2,
  Calendar,
  FileText,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { PaymentCycleRecord, PaymentCycleUpsert } from '../../types/database';
import { type PaymentCycleInfo, getLocalDateString } from '../../utils/paymentCycles';
import { modalBackdropVariants, modalContentVariants } from '../common/MotionVariants';
import { triggerSuccessCelebration } from '../../lib/celebrate';

interface ConfirmPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycle: PaymentCycleInfo | null;
  userId: string;
  onSaveSuccess: (record: PaymentCycleRecord) => void;
  onRevertSuccess?: (referenciaChave: string) => void;
}

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

interface InnerFormProps {
  cycle: PaymentCycleInfo;
  userId: string;
  onClose: () => void;
  onSaveSuccess: (record: PaymentCycleRecord) => void;
  onRevertSuccess?: (referenciaChave: string) => void;
}

const ConfirmPaymentForm: React.FC<InnerFormProps> = ({
  cycle,
  userId,
  onClose,
  onSaveSuccess,
  onRevertSuccess,
}) => {
  const isAlreadyPaid = cycle.paymentRecord?.status === 'pago';

  const [valorRecebido, setValorRecebido] = useState<string>(() => {
    if (isAlreadyPaid && cycle.paymentRecord) {
      const recVal =
        typeof cycle.paymentRecord.valor_recebido === 'number'
          ? cycle.paymentRecord.valor_recebido
          : cycle.totalFaturamento;
      return recVal.toFixed(2);
    }
    return cycle.totalFaturamento.toFixed(2);
  });

  const [dataConfirmacao, setDataConfirmacao] = useState<string>(() => {
    if (isAlreadyPaid && cycle.paymentRecord?.data_confirmacao) {
      return cycle.paymentRecord.data_confirmacao;
    }
    return getLocalDateString();
  });

  const [observacoes, setObservacoes] = useState<string>(() => {
    return cycle.paymentRecord?.observacoes || '';
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConfirmingRevert, setIsConfirmingRevert] = useState(false);
  const [successRecord, setSuccessRecord] = useState<PaymentCycleRecord | null>(null);

  const parsedCalculated = cycle.totalFaturamento;
  const parsedRecebido = parseFloat(valorRecebido.replace(',', '.')) || 0;
  const diff = parsedRecebido - parsedCalculated;
  const hasDiff = Math.abs(diff) >= 0.01;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setErrorMsg('Usuário não autenticado.');
      return;
    }

    if (parsedRecebido < 0) {
      setErrorMsg('O valor recebido não pode ser negativo.');
      return;
    }

    if (!dataConfirmacao) {
      setErrorMsg('Informe a data em que o valor caiu na conta.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: PaymentCycleUpsert = {
        user_id: userId,
        referencia_chave: cycle.referenciaChave,
        periodo_inicio: cycle.periodoInicio,
        periodo_fim: cycle.periodoFim,
        data_pagamento_prevista: cycle.dataPagamentoPrevista,
        valor_calculado: cycle.totalFaturamento,
        valor_recebido: parsedRecebido,
        status: 'pago',
        data_confirmacao: dataConfirmacao,
        observacoes: observacoes.trim() || null,
      };

      const { data, error } = await supabase
        .from('payment_cycles')
        .upsert(payload, { onConflict: 'user_id,referencia_chave' })
        .select()
        .single();

      if (error) {
        throw error;
      }

      const record = data as PaymentCycleRecord;
      setSuccessRecord(record);
      triggerSuccessCelebration();

      setTimeout(() => {
        onSaveSuccess(record);
        onClose();
      }, 2100);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao registrar confirmação do pagamento.';
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevert = async () => {
    if (!userId) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: PaymentCycleUpsert = {
        user_id: userId,
        referencia_chave: cycle.referenciaChave,
        periodo_inicio: cycle.periodoInicio,
        periodo_fim: cycle.periodoFim,
        data_pagamento_prevista: cycle.dataPagamentoPrevista,
        valor_calculado: cycle.totalFaturamento,
        valor_recebido: null,
        status: 'pendente',
        data_confirmacao: null,
        observacoes: null,
      };

      const { error } = await supabase
        .from('payment_cycles')
        .upsert(payload, { onConflict: 'user_id,referencia_chave' });

      if (error) {
        throw error;
      }

      if (onRevertSuccess) {
        onRevertSuccess(cycle.referenciaChave);
      }
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao reverter status do pagamento.';
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
      setIsConfirmingRevert(false);
    }
  };

  if (successRecord) {
    return (
      <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative text-center flex flex-col items-center justify-center space-y-4 overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute inset-0 bg-emerald-500/10 rounded-3xl blur-2xl pointer-events-none" />

        <div className="relative my-2">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto"
          >
            <svg className="w-12 h-12 text-emerald-400" viewBox="0 0 52 52">
              <motion.circle
                cx="26"
                cy="26"
                r="22"
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />
              <motion.path
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 27l8 8 16-16"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.18 }}
              />
            </svg>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.28 }}
          className="space-y-1 relative z-10"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Confirmado com Sucesso</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Pagamento Confirmado!
          </h3>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            {formatCurrency(successRecord.valor_recebido ?? cycle.totalFaturamento)} na conta 🎉
          </p>
          <p className="text-xs text-slate-400 pt-1">
            {cycle.cycleName} • {cycle.corteLabel}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative max-h-[85dvh] overflow-y-auto overscroll-contain flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5 stroke-[2.4]" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {isAlreadyPaid ? 'Editar Recebimento' : 'Confirmar Recebimento na Conta'}
            </h3>
            <p className="text-xs text-slate-400">
              {cycle.cycleName} • {cycle.corteLabel} (Ref: {cycle.referenciaChave})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-[0.95] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Formulário com scroll se necessário */}
      <form onSubmit={handleSave} className="flex-1 overflow-y-auto space-y-4 pr-1">
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Card Resumo do Valor Calculado */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Valor Calculado pelo App
            </span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5 block">
              {formatCurrency(parsedCalculated)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Com base em {cycle.entries.length} {cycle.entries.length === 1 ? 'dia lançado' : 'dias lançados'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Previsão Pagto
            </span>
            <span className="text-xs font-bold text-emerald-400 font-mono mt-0.5 block">
              Dia {cycle.diaPagamento} ({cycle.dataPagamentoPrevista.split('-').reverse().join('/')})
            </span>
          </div>
        </div>

        {/* Campo Valor Realmente Recebido */}
        <div>
          <label className="block text-xs font-bold text-slate-200 mb-1.5">
            Valor Realmente Recebido na Conta (R$) *
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
              R$
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={valorRecebido}
              onChange={(e) => setValorRecebido(e.target.value)}
              placeholder="0,00"
              className="w-full h-12 min-h-[48px] bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 text-base sm:text-sm font-bold text-emerald-400 focus:outline-hidden focus:border-emerald-500 font-mono transition"
            />
          </div>

          {/* Destaque Visual de Diferença (Desconto ou Bônus) */}
          <div className="mt-2">
            {hasDiff ? (
              diff < 0 ? (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 shrink-0 text-amber-400" />
                  <div>
                    <strong>Diferença: -{formatCurrency(Math.abs(diff))}</strong>
                    <span className="block text-[11px] text-amber-200/80">
                      Houve desconto da transportadora em relação ao total calculado pelo app.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 shrink-0 text-emerald-400" />
                  <div>
                    <strong>Diferença: +{formatCurrency(diff)}</strong>
                    <span className="block text-[11px] text-emerald-200/80">
                      Houve bônus, ajuste ou acréscimo pago pela transportadora.
                    </span>
                  </div>
                </div>
              )
            ) : (
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 px-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Valor exato calculado pelo app (sem diferenças).</span>
              </div>
            )}
          </div>
        </div>

        {/* Campo Data de Confirmação (Caiu na Conta) */}
        <div>
          <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            Data em que caiu na conta *
          </label>
          <input
            type="date"
            required
            value={dataConfirmacao}
            onChange={(e) => setDataConfirmacao(e.target.value)}
            className="w-full h-12 min-h-[48px] bg-slate-950 border border-slate-800 rounded-xl px-4 text-base sm:text-sm text-white focus:outline-hidden focus:border-emerald-500 font-mono transition"
          />
        </div>

        {/* Campo Observações */}
        <div>
          <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Observações / Motivo de desconto ou ajuste (opcional)
          </label>
          <textarea
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex: Caiu via PIX; descontou R$ 30 por divergência no romaneio do dia 12..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-base sm:text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 transition resize-none"
          />
        </div>

        {/* Botão de Reversão para Pendente (se já estava pago) */}
        {isAlreadyPaid && (
          <div className="pt-2 border-t border-slate-800/80">
            {isConfirmingRevert ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                <p className="text-xs text-amber-300 font-medium">
                  Tem certeza que deseja reverter este fechamento para <strong>Pendente</strong>?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleRevert}
                    className="flex-1 min-h-[40px] px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer"
                  >
                    Sim, Reverter para Pendente
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingRevert(false)}
                    className="px-3 min-h-[40px] py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingRevert(true)}
                className="w-full min-h-[40px] py-2 text-xs font-semibold text-slate-400 hover:text-amber-400 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Marquei por engano? Reverter para Pendente
              </button>
            )}
          </div>
        )}

        {/* Ações do Modal */}
        <div className="pt-3 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition active:scale-[0.98] cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition active:scale-[0.98] cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <span>Salvando...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>
                  {isAlreadyPaid ? 'Salvar Alterações' : 'Confirmar Recebimento (Pago)'}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export const ConfirmPaymentModal: React.FC<ConfirmPaymentModalProps> = ({
  isOpen,
  onClose,
  cycle,
  userId,
  onSaveSuccess,
  onRevertSuccess,
}) => {
  return (
    <AnimatePresence>
      {isOpen && cycle && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            variants={modalBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-transparent cursor-pointer"
          />

          <motion.div
            variants={modalContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full sm:max-w-lg relative z-10"
          >
            <ConfirmPaymentForm
              key={cycle.referenciaChave}
              cycle={cycle}
              userId={userId}
              onClose={onClose}
              onSaveSuccess={onSaveSuccess}
              onRevertSuccess={onRevertSuccess}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
