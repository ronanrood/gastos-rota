import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { MaintenanceLog, MaintenanceLogUpdate } from '../../types/database';
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
} from 'lucide-react';

interface EditMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  maintenanceLog: MaintenanceLog;
  userId: string;
  onSuccess: (updated: MaintenanceLog) => void;
}

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

export const EditMaintenanceModal: React.FC<EditMaintenanceModalProps> = ({
  isOpen,
  onClose,
  maintenanceLog,
  userId,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicialização pura do estado
  const [data, setData] = useState<string>(() => maintenanceLog.data || '');
  const [oficinaNome, setOficinaNome] = useState<string>(() => maintenanceLog.oficina_nome || '');
  const [descricaoServico, setDescricaoServico] = useState<string>(() => maintenanceLog.descricao_servico || '');
  const [valorPecas, setValorPecas] = useState<string>(() => maintenanceLog.valor_pecas?.toString() || '0');
  const [valorMaoDeObra, setValorMaoDeObra] = useState<string>(() => maintenanceLog.valor_mao_de_obra?.toString() || '0');
  const [garantiaAte, setGarantiaAte] = useState<string>(() => maintenanceLog.garantia_ate || '');
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

      setUploadStatus('Salvando alterações...');

      /**
       * REGRA CRÍTICA DO SUPABASE:
       * NUNCA envie a coluna 'valor_total', 'id' ou 'created_at' no payload do UPDATE.
       * A coluna valor_total é GENERATED ALWAYS no PostgreSQL.
       */
      const payload: MaintenanceLogUpdate = {
        data,
        oficina_nome: oficinaNome.trim(),
        descricao_servico: descricaoServico.trim(),
        valor_pecas: Number(numValorPecas.toFixed(2)),
        valor_mao_de_obra: Number(numValorMaoDeObra.toFixed(2)),
        garantia_ate: garantiaAte ? garantiaAte : null,
        comprovante_url: finalComprovanteUrl,
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-edit-maintenance-title"
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-edit-maintenance-title" className="text-base sm:text-lg font-bold text-white leading-tight">
                Editar Manutenção / Orçamento
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Altere peças, mão de obra, garantia ou anexe a nota fiscal
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

        {/* Visor em tempo real do Total */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-950/80 border border-blue-500/30 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-semibold tracking-wider text-blue-400 uppercase flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Novo Valor Total (Peças + M.O.)
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
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Data do Serviço
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

            {/* Descrição do Serviço */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Descrição do Serviço Executado
              </label>
              <textarea
                required
                rows={2}
                value={descricaoServico}
                onChange={(e) => setDescricaoServico(e.target.value)}
                placeholder="Ex: Troca de pastilhas de freio e alinhamento"
                className="w-full p-3 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
              />
            </div>
          </div>

          {/* Seção de Comprovante / Nota Fiscal */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-blue-400" />
                Comprovante / Nota Fiscal
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
                  : 'Selecione uma imagem ou PDF da nota fiscal (máx 10MB):'}
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
              className="px-5 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition active:scale-[0.98] cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {uploadStatus || 'Salvando...'}
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
