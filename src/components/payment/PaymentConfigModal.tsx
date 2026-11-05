import React, { useState } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import type { PaymentCycleType } from '../../types/database';
import { getEffectivePaymentConfig } from '../../utils/paymentCycles';
import {
  CalendarDays,
  Calendar,
  DollarSign,
  Save,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';

interface PaymentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PaymentConfigModal: React.FC<PaymentConfigModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, refreshProfile } = useAuth();
  const initialConfig = getEffectivePaymentConfig(profile);

  const [tipoRecebimento, setTipoRecebimento] = useState<PaymentCycleType>(
    initialConfig.tipo_recebimento
  );

  // Ciclo 1
  const [diaPagamento1, setDiaPagamento1] = useState<string>(
    initialConfig.dia_pagamento_1.toString()
  );
  const [corte1Inicio, setCorte1Inicio] = useState<string>(
    initialConfig.corte_1_inicio.toString()
  );
  const [corte1Fim, setCorte1Fim] = useState<string>(
    initialConfig.corte_1_fim.toString()
  );

  // Ciclo 2 (apenas se quinzenal)
  const [diaPagamento2, setDiaPagamento2] = useState<string>(
    initialConfig.dia_pagamento_2.toString()
  );
  const [corte2Inicio, setCorte2Inicio] = useState<string>(
    initialConfig.corte_2_inicio.toString()
  );
  const [corte2Fim, setCorte2Fim] = useState<string>(
    initialConfig.corte_2_fim.toString()
  );

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!user) {
      setErrorMessage('Sessão expirada. Faça login novamente.');
      return;
    }

    const p1 = parseInt(diaPagamento1, 10);
    const c1Ini = parseInt(corte1Inicio, 10);
    const c1Fim = parseInt(corte1Fim, 10);

    if (isNaN(p1) || p1 < 1 || p1 > 31) {
      setErrorMessage('Informe um dia válido (1 a 31) para o pagamento.');
      return;
    }
    if (isNaN(c1Ini) || c1Ini < 1 || c1Ini > 31 || isNaN(c1Fim) || c1Fim < 1 || c1Fim > 31) {
      setErrorMessage('Informe dias válidos (1 a 31) para o período de corte.');
      return;
    }

    let p2: number | null = null;
    let c2Ini: number | null = null;
    let c2Fim: number | null = null;

    if (tipoRecebimento === 'quinzenal') {
      p2 = parseInt(diaPagamento2, 10);
      c2Ini = parseInt(corte2Inicio, 10);
      c2Fim = parseInt(corte2Fim, 10);

      if (isNaN(p2) || p2 < 1 || p2 > 31) {
        setErrorMessage('Informe um dia válido (1 a 31) para o segundo pagamento.');
        return;
      }
      if (isNaN(c2Ini) || c2Ini < 1 || c2Ini > 31 || isNaN(c2Fim) || c2Fim < 1 || c2Fim > 31) {
        setErrorMessage('Informe dias válidos (1 a 31) para o corte da 2ª quinzena.');
        return;
      }
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          tipo_recebimento: tipoRecebimento,
          dia_pagamento_1: p1,
          corte_1_inicio: c1Ini,
          corte_1_fim: c1Fim,
          dia_pagamento_2: p2,
          corte_2_inicio: c2Ini,
          corte_2_fim: c2Fim,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      setSuccessMessage('Configuração de recebimento salva com sucesso!');

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Erro ao salvar configuração de pagamento:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao salvar preferências.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-5 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
              <CalendarDays className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Configuração de Recebimento
              </h3>
              <p className="text-xs text-slate-400">
                Defina as datas de fechamento e pagamento da sua rota
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

        {/* Alertas */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Frequência de Recebimento */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Frequência de Recebimento
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTipoRecebimento('quinzenal')}
                className={`min-h-[48px] py-3 px-3 sm:px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                  tipoRecebimento === 'quinzenal'
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <CalendarDays className="w-4 h-4 shrink-0" />
                <span>Quinzenal (2x/mês)</span>
              </button>

              <button
                type="button"
                onClick={() => setTipoRecebimento('mensal')}
                className={`min-h-[48px] py-3 px-3 sm:px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                  tipoRecebimento === 'mensal'
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-4 h-4 shrink-0" />
                <span>Mensal (1x/mês)</span>
              </button>
            </div>
          </div>

          {/* CICLO 1 */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                {tipoRecebimento === 'quinzenal' ? 'Ciclo 1 de Pagamento' : 'Ciclo de Pagamento Mensal'}
              </span>
              <span className="text-[10px] text-slate-400">Ex: Mercado Livre / Shopee</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Dia do Pagamento
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="31"
                    required
                    value={diaPagamento1}
                    onChange={(e) => setDiaPagamento1(e.target.value)}
                    placeholder="17"
                    className="w-full px-3 py-2.5 sm:py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-[10px] text-slate-400 pointer-events-none">
                    dia
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Corte: Dia Inicial
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="31"
                    required
                    value={corte1Inicio}
                    onChange={(e) => setCorte1Inicio(e.target.value)}
                    placeholder="16"
                    className="w-full px-3 py-2.5 sm:py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-[10px] text-slate-400 pointer-events-none">
                    dia
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Corte: Dia Final
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="31"
                    required
                    value={corte1Fim}
                    onChange={(e) => setCorte1Fim(e.target.value)}
                    placeholder="31"
                    className="w-full px-3 py-2.5 sm:py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-[10px] text-slate-400 pointer-events-none">
                    dia
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              ↳ Recebe no <strong>dia {diaPagamento1 || '--'}</strong> referente aos dias rodados de{' '}
              <strong>{corte1Inicio || '--'} até {corte1Fim || '--'}</strong>.
            </p>
          </div>

          {/* CICLO 2 (Apenas se for Quinzenal) */}
          {tipoRecebimento === 'quinzenal' && (
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  Ciclo 2 de Pagamento
                </span>
                <span className="text-[10px] text-slate-400">Segunda Quinzena</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Dia do Pagamento
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="31"
                      required
                      value={diaPagamento2}
                      onChange={(e) => setDiaPagamento2(e.target.value)}
                      placeholder="2"
                      className="w-full px-3 py-2.5 sm:py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-[10px] text-slate-400 pointer-events-none">
                      dia
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Corte: Dia Inicial
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="31"
                      required
                      value={corte2Inicio}
                      onChange={(e) => setCorte2Inicio(e.target.value)}
                      placeholder="1"
                      className="w-full px-3 py-2.5 sm:py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-[10px] text-slate-400 pointer-events-none">
                      dia
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Corte: Dia Final
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="31"
                      required
                      value={corte2Fim}
                      onChange={(e) => setCorte2Fim(e.target.value)}
                      placeholder="15"
                      className="w-full px-3 py-2.5 sm:py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-[10px] text-slate-400 pointer-events-none">
                      dia
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 italic">
                ↳ Recebe no <strong>dia {diaPagamento2 || '--'}</strong> referente aos dias rodados de{' '}
                <strong>{corte2Inicio || '--'} até {corte2Fim || '--'}</strong>.
              </p>
            </div>
          )}

          {/* Dica */}
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              Ao salvar, a Tela Inicial e o Dashboard somarão automaticamente todas as rotas lançadas dentro dos intervalos de corte correspondentes!
            </p>
          </div>

          {/* Botões */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 h-12 min-h-[48px] rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm sm:text-xs font-semibold transition active:scale-[0.98] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-2/3 h-12 min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 text-sm sm:text-xs font-bold shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 stroke-[2.2]" />
                  Salvar Preferências
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

