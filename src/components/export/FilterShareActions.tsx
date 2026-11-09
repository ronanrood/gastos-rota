import React, { useState } from 'react';
import { Share2, Copy, FileText, Check, Sparkles, SlidersHorizontal } from 'lucide-react';
import { copyToClipboard } from '../../utils/exportUtils';

interface FilterShareActionsProps {
  getWhatsAppText?: () => string;
  onOpenPdfModal: () => void;
  accentColor?: 'emerald' | 'amber' | 'blue';
}

export const FilterShareActions: React.FC<FilterShareActionsProps> = ({
  getWhatsAppText,
  onOpenPdfModal,
  accentColor = 'emerald',
}) => {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleCopy = async () => {
    if (!getWhatsAppText) {
      onOpenPdfModal();
      return;
    }
    const text = getWhatsAppText();
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setToast('Resumo copiado! Pronto para colar no WhatsApp');
      setTimeout(() => {
        setCopied(false);
        setToast(null);
      }, 3500);
    }
  };

  const sparklesColorClass =
    accentColor === 'amber'
      ? 'text-amber-400'
      : accentColor === 'blue'
      ? 'text-blue-400'
      : 'text-emerald-400';

  const pdfIconColorClass =
    accentColor === 'amber'
      ? 'text-amber-400'
      : accentColor === 'blue'
      ? 'text-blue-400'
      : 'text-emerald-400';

  return (
    <div className="relative pt-3.5 border-t border-slate-800/80 mt-3.5">
      {/* Toast flutuante de confirmação */}
      {toast && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200 whitespace-nowrap">
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
          <Sparkles className={`w-3.5 h-3.5 ${sparklesColorClass} shrink-0`} />
          <span>Exportar Fechamento do Período Filtrado:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão de Destaque: Personalizar e Exportar Relatório */}
          <button
            type="button"
            onClick={onOpenPdfModal}
            className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[42px] rounded-xl font-bold text-xs sm:text-xs text-slate-950 transition-all active:scale-[0.97] cursor-pointer shadow-md ${
              accentColor === 'amber'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-amber-500/20'
                : accentColor === 'blue'
                ? 'bg-gradient-to-r from-blue-400 to-cyan-400 hover:from-blue-300 hover:to-cyan-300 shadow-blue-500/20'
                : 'bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-emerald-500/20'
            }`}
            title="Personalizar blocos e exportar para WhatsApp ou PDF"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Exportar / Compartilhar Relatório</span>
          </button>

          {/* Botão Enviar no WhatsApp (Abre o modal personalizado) */}
          <button
            type="button"
            onClick={onOpenPdfModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[42px] rounded-xl bg-emerald-600/90 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold transition active:scale-95 cursor-pointer shadow-sm border border-emerald-500/40"
            title="Personalizar e Enviar para o WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          {/* Botão Gerar PDF (Abre o modal personalizado) */}
          <button
            type="button"
            onClick={onOpenPdfModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[42px] rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 hover:text-white text-xs font-semibold transition active:scale-95 cursor-pointer border border-slate-700 shadow-sm"
            title="Personalizar e Gerar PDF do Período"
          >
            <FileText className={`w-3.5 h-3.5 ${pdfIconColorClass}`} />
            <span className="hidden sm:inline">PDF</span>
          </button>

          {/* Botão Copiar Rápido (Fallback se disponível) */}
          {getWhatsAppText && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[42px] rounded-xl bg-slate-950/70 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs transition active:scale-95 cursor-pointer"
              title="Copiar texto rápido"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
