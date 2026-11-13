import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import type { MaintenanceLog, MaintenanceLogUpdate, MaintenanceStatus, PaymentMethod } from '../../types/database';
import { modalBackdropVariants, modalContentVariants } from '../common/MotionVariants';
import {
  X,
  Pencil,
  Calendar,
  DollarSign,
  FileText,
  Building,
  AlertCircle,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Paperclip,
  Trash2,
  CheckCircle2,
  Wrench,
  ClipboardList,
  CreditCard,
} from 'lucide-react';

interface EditMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  maintenanceLog: MaintenanceLog;
  userId: string;
  mode?: 'edit' | 'approve';
  onSuccess: (updated: MaintenanceLog) => void;
}

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

const TODAY_STR = new Date().toISOString().split('T')[0];

export const EditMaintenanceModal: React.FC<EditMaintenanceModalProps> = ({
  isOpen,
  onClose,
  maintenanceLog,
  userId,
  mode = 'edit',
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Se o modo for 'approve', o status já inicia como 'realizado' e a data pode ser sugerida como hoje
  const [status, setStatus] = useState<MaintenanceStatus>(() => {
    if (mode === 'approve') return 'realizado';
    return maintenanceLog.status || 'realizado';
  });
  const [data, setData] = useState<string>(() => {
    if (mode === 'approve') return TODAY_STR;
    return maintenanceLog.data || '';
  });
  const [oficinaNome, setOficinaNome] = useState<string>(() => maintenanceLog.oficina_nome || '');
  const [descricaoServico, setDescricaoServico] = useState<string>(() => maintenanceLog.descricao_servico || '');
  const [valorPecas, setValorPecas] = useState<string>(() => maintenanceLog.valor_pecas?.toString() || '0');
  const [valorMaoDeObra, setValorMaoDeObra] = useState<string>(() => maintenanceLog.valor_mao_de_obra?.toString() || '0');
  const [garantiaAte, setGarantiaAte] = useState<string>(() => maintenanceLog.garantia_ate || '');
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethod>(() => maintenanceLog.forma_pagamento || 'avista');
  const [qtdParcelas, setQtdParcelas] = useState<string>(() => (maintenanceLog.qtd_parcelas || 2).toString());
  const [valorParcela, setValorParcela] = useState<string>(() => {
    if (maintenanceLog.valor_parcela) return maintenanceLog.valor_parcela.toString();
    const total = (maintenanceLog.valor_pecas || 0) + (maintenanceLog.valor_mao_de_obra || 0);
    const q = maintenanceLog.qtd_parcelas || 2;
    return (total / q).toFixed(2);
  });
  const [mesPrimeiraParcela, setMesPrimeiraParcela] = useState<string>(() => {
    return maintenanceLog.mes_primeira_parcela || maintenanceLog.data || TODAY_STR;
  });

  const existingComprovanteUrl = maintenanceLog.comprovante_url || null;
  const [removeExistingFile, setRemoveExistingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
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
  const numValorPecas = parseFloat(valorPecas) || 0;
  const numValorMaoDeObra = parseFloat(valorMaoDeObra) || 0;

  const valorTotalEstimado = useMemo(() => {
    return numValorPecas + numValorMaoDeObra;
  }, [numValorPecas, numValorMaoDeObra]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

      if (!validTypes.includes(file.type)) {
        setErrorMsg('Formato inválido. Selecione um arquivo PDF, JPG ou PNG.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg('O arquivo deve ter no máximo 10MB.');
        return;
      }

      setErrorMsg(null);
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!data) {
      setErrorMsg('Informe a data da manutenção.');
      return;
    }
    if (!oficinaNome.trim()) {
      setErrorMsg('Informe o nome da oficina ou mecânico.');
      return;
    }
    if (!descricaoServico.trim()) {
      setErrorMsg('Descreva o serviço executado.');
      return;
    }
    if (numValorPecas < 0) {
      setErrorMsg('O valor das peças não pode ser negativo.');
      return;
    }
    if (numValorMaoDeObra < 0) {
      setErrorMsg('O valor da mão de obra não pode ser negativo.');
      return;
    }
    if (valorTotalEstimado <= 0) {
      setErrorMsg('O valor total do serviço (peças + mão de obra) deve ser maior que zero.');
      return;
    }

    setSubmitting(true);
    let finalComprovanteUrl: string | null = removeExistingFile ? null : existingComprovanteUrl;

    try {
      // Se selecionou um novo arquivo, faz upload para o bucket
      if (selectedFile) {
        setUploadStatus('Enviando novo comprovante...');
        const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${userId}/${Date.now()}_${cleanName}`;

        const { error: uploadError } = await supabase.storage
          .from('comprovantes_oficina')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Falha no upload do comprovante: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from('comprovantes_oficina')
          .getPublicUrl(filePath);

        finalComprovanteUrl = publicUrlData.publicUrl;
      }

      setUploadStatus(mode === 'approve' ? 'Aprovando serviço...' : 'Salvando alterações...');

      /**
       * REGRA CRÍTICA DO SUPABASE:
       * NUNCA envie a coluna 'valor_total', 'id' ou 'created_at' no payload do UPDATE.
       * A coluna valor_total é GENERATED ALWAYS no PostgreSQL.
       */
      const parsedQtd = parseInt(qtdParcelas, 10) || 1;
      const parsedValParc = parseFloat(valorParcela.replace(',', '.')) || (valorTotalEstimado / parsedQtd);

      const payload: MaintenanceLogUpdate = {
        data,
        oficina_nome: oficinaNome.trim(),
        descricao_servico: descricaoServico.trim(),
        valor_pecas: Number(numValorPecas.toFixed(2)),
        valor_mao_de_obra: Number(numValorMaoDeObra.toFixed(2)),
        garantia_ate: garantiaAte ? garantiaAte : null,
        comprovante_url: finalComprovanteUrl,
        status,
        forma_pagamento: formaPagamento,
        qtd_parcelas: formaPagamento === 'parcelado' ? parsedQtd : 1,
        valor_parcela: formaPagamento === 'parcelado' ? Number(parsedValParc.toFixed(2)) : null,
        mes_primeira_parcela: formaPagamento === 'parcelado' ? (mesPrimeiraParcela || data) : null,
      };

      const { data: updated, error } = await supabase
        .from('maintenance_logs')
        .update(payload)
        .eq('id', maintenanceLog.id)
        .select('*')
        .single();

      if (error) throw error;

      if (updated) {
        onSuccess(updated as MaintenanceLog);
        onClose();
      }
    } catch (err: unknown) {
      console.error('Erro ao atualizar manutenção:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar manutenção.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
      setUploadStatus(null);
    }
  };

  const isRealizado = status === 'realizado';

  return (
    <AnimatePresence>
      {isOpen && (
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-edit-maintenance-title"
            variants={modalContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full sm:max-w-xl max-h-[85dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 bg-slate-900 border border-slate-800 shadow-2xl relative z-10 overscroll-contain"
          >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                mode === 'approve' || isRealizado
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
              }`}
            >
              {mode === 'approve' ? <CheckCircle2 className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
            </div>
            <div>
              <h3 id="modal-edit-maintenance-title" className="text-base sm:text-lg font-bold text-white leading-tight">
                {mode === 'approve' ? 'Aprovar e Concluir Serviço' : 'Editar Registro de Oficina'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {mode === 'approve'
                  ? 'Confirme a data de conclusão, valores negociados e anexe a nota final'
                  : 'Altere peças, mão de obra, status, garantia ou anexe a nota fiscal'}
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

        {/* Seletor de Tipo (Segmented Control) */}
        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Classificação do Registro
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setStatus('realizado')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
                status === 'realizado'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Serviço Realizado</span>
            </button>

            <button
              type="button"
              onClick={() => setStatus('orcamento')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
                status === 'orcamento'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Orçamento Pendente</span>
            </button>
          </div>
        </div>

        {/* Visor em tempo real do Total */}
        <div
          className={`mt-4 p-4 rounded-2xl bg-slate-950/80 border flex items-center justify-between gap-3 ${
            isRealizado ? 'border-blue-500/30' : 'border-amber-500/30'
          }`}
        >
          <div>
            <span
              className={`text-[10px] font-semibold tracking-wider uppercase flex items-center gap-1 ${
                isRealizado ? 'text-blue-400' : 'text-amber-400'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isRealizado ? 'Valor Total do Serviço' : 'Valor Total do Orçamento'}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-white mt-0.5 font-mono">
              {formatCurrency(valorTotalEstimado)}
            </div>
          </div>
          <div className="text-right text-xs text-slate-400 font-mono">
            <div>Peças: {formatCurrency(numValorPecas)}</div>
            <div>Mão de Obra: {formatCurrency(numValorMaoDeObra)}</div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Data */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {isRealizado ? 'Data do Serviço Concluído' : 'Data do Orçamento'}
                </label>
                {data !== TODAY_STR && (
                  <button
                    type="button"
                    onClick={() => setData(TODAY_STR)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 underline cursor-pointer"
                  >
                    Usar Hoje
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  type="date"
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            {/* Oficina */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nome da Oficina ou Mecânico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Building className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={oficinaNome}
                  onChange={(e) => setOficinaNome(e.target.value)}
                  placeholder="Ex: Auto Mecânica Silva"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            {/* Valor das Peças */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Valor das Peças (R$)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <DollarSign className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={valorPecas}
                  onChange={(e) => setValorPecas(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-mono"
                />
              </div>
            </div>

            {/* Valor da Mão de Obra */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Valor da Mão de Obra (R$)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <DollarSign className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={valorMaoDeObra}
                  onChange={(e) => setValorMaoDeObra(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-mono"
                />
              </div>
            </div>

            {/* Garantia Até */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Garantia Válida Até (Opcional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <input
                  type="date"
                  value={garantiaAte}
                  onChange={(e) => setGarantiaAte(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            {/* SELETOR DE FORMA DE PAGAMENTO */}
            <div className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormaPagamento('avista')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer active:scale-[0.98] ${
                      formaPagamento === 'avista'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                        : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-slate-800'
                    }`}
                  >
                    <span>💵 À Vista</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormaPagamento('parcelado');
                      const q = parseInt(qtdParcelas, 10) || 2;
                      setValorParcela((valorTotalEstimado / q).toFixed(2));
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer active:scale-[0.98] ${
                      formaPagamento === 'parcelado'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-slate-800'
                    }`}
                  >
                    <span>💳 Parcelado</span>
                  </button>
                </div>
              </div>

              {formaPagamento === 'parcelado' && (
                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Qtd Parcelas
                      </label>
                      <select
                        value={qtdParcelas}
                        onChange={(e) => {
                          const q = e.target.value;
                          setQtdParcelas(q);
                          const numQ = parseInt(q, 10) || 1;
                          setValorParcela((valorTotalEstimado / numQ).toFixed(2));
                        }}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold"
                      >
                        {Array.from({ length: 23 }, (_, i) => i + 2).map((num) => (
                          <option key={num} value={num}>
                            {num}x parcelas
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                        <span>Valor Parcela</span>
                        <span className="text-[9px] text-slate-400">Juros?</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={valorParcela}
                          onChange={(e) => setValorParcela(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-emerald-400 font-mono font-bold text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        1ª Parcela
                      </label>
                      <input
                        type="date"
                        value={mesPrimeiraParcela}
                        onChange={(e) => setMesPrimeiraParcela(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center justify-between flex-wrap gap-1">
                    <span>
                      Total: <strong>{formatCurrency(valorTotalEstimado)}</strong> →{' '}
                      <strong>{qtdParcelas}x de {formatCurrency(parseFloat(valorParcela) || 0)}</strong>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      Impacto mensal: {formatCurrency(parseFloat(valorParcela) || 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Descrição do Serviço */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {isRealizado ? 'Descrição do Serviço Executado' : 'Descrição dos Itens do Orçamento'}
              </label>
              <textarea
                required
                rows={2}
                value={descricaoServico}
                onChange={(e) => setDescricaoServico(e.target.value)}
                placeholder="Ex: Troca de pastilhas de freio, disco e alinhamento"
                className="w-full p-3 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
              />
            </div>
          </div>

          {/* Seção de Comprovante / Nota Fiscal */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-blue-400" />
                {isRealizado ? 'Nota Fiscal / Comprovante Final' : 'Foto / PDF do Orçamento'}
              </span>
              {existingComprovanteUrl && !removeExistingFile && (
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                  Arquivo Já Anexado
                </span>
              )}
            </div>

            {/* Comprovante atual existente */}
            {existingComprovanteUrl && !removeExistingFile && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <a
                  href={existingComprovanteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1.5 truncate max-w-[220px] sm:max-w-xs"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate">Visualizar Arquivo Anexado</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>

                <button
                  type="button"
                  onClick={() => setRemoveExistingFile(true)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 transition cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Remover
                </button>
              </div>
            )}

            {existingComprovanteUrl && removeExistingFile && (
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                <span>O comprovante atual será desvinculado ao salvar.</span>
                <button
                  type="button"
                  onClick={() => setRemoveExistingFile(false)}
                  className="text-xs underline text-slate-300 hover:text-white"
                >
                  Desfazer
                </button>
              </div>
            )}

            {/* Campo para anexar novo arquivo */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">
                {existingComprovanteUrl && !removeExistingFile
                  ? 'Ou selecione um novo arquivo para substituir:'
                  : isRealizado
                  ? 'Selecione a nota fiscal ou comprovante (máx 10MB):'
                  : 'Selecione a foto ou PDF do orçamento (máx 10MB):'}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:cursor-pointer cursor-pointer"
              />
              {selectedFile && (
                <div className="mt-1 text-[11px] text-emerald-400">
                  Novo arquivo selecionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
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
              className={`px-5 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold shadow-md transition active:scale-[0.98] cursor-pointer flex items-center gap-2 disabled:opacity-50 ${
                mode === 'approve' || isRealizado
                  ? 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 shadow-emerald-500/20'
                  : 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-amber-500/20'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  {uploadStatus || 'Salvando...'}
                </>
              ) : mode === 'approve' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
                  Aprovar e Concluir Serviço
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
