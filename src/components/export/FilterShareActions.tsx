import React, { useState } from 'react';
import { Share2, Copy, FileText, Check, Sparkles } from 'lucide-react';
import { copyToClipboard, openWhatsAppShare } from '../../utils/exportUtils';

interface FilterShareActionsProps {
  getWhatsAppText: () => string;
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

  const handleWhatsApp = () => {
    const text = getWhatsAppText();
    openWhatsAppShare(text);
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
    <div className="relative pt-3 border-t border-slate-800/80 mt-3">
      {/* Toast flutuante de confirmação */}
      {toast && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200 whitespace-nowrap">
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
          <Sparkles className={`w-3.5 h-3.5 ${sparklesColorClass}`} />
          <span>Exportar Fechamento do Período Filtrado:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão Copiar Texto */}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-xs"
            title="Copiar resumo formatado para a área de transferência"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-bold">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copiar Texto</span>
              </>
            )}
          </button>

          {/* Botão Enviar no WhatsApp */}
          <button
            type="button"
            onClick={handleWhatsApp}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-md shadow-emerald-600/25 border border-emerald-500/50"
            title="Enviar resumo formatado para o WhatsApp da transportadora"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Enviar no WhatsApp</span>
          </button>

          {/* Botão Gerar PDF do Período */}
          <button
            type="button"
            onClick={onOpenPdfModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-100 hover:text-white text-xs font-bold transition active:scale-95 cursor-pointer border border-slate-600 shadow-sm"
            title="Visualizar, Imprimir ou Salvar Extrato em PDF"
          >
            <FileText className={`w-3.5 h-3.5 ${pdfIconColorClass}`} />
            <span>Gerar PDF do Período</span>
          </button>
        </div>
      </div>
    </div>
  );
};
