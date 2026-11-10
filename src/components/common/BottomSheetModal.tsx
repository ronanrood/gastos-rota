import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface BottomSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
}) => {
  // Trava a rolagem do body enquanto a gaveta estiver aberta
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center lg:hidden">
          {/* Backdrop escurecido com blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
            aria-hidden="true"
          />

          {/* Gaveta Deslizante Inferior (Bottom Sheet) */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl bg-slate-900 border-t border-slate-700/80 sm:border sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[88vh] z-10 overflow-hidden"
          >
            {/* Barra superior de arrasto (drag handle) */}
            <div className="w-12 h-1.5 bg-zinc-700/80 rounded-full mx-auto mt-3 mb-2 shrink-0" />

            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/80 shrink-0">
              <div className="flex items-center gap-3">
                {icon}
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-xs text-slate-400">{subtitle}</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar gaveta"
                className="w-9 h-9 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com rolagem suave e espaço para teclado */}
            <div className="overflow-y-auto px-5 py-4 pb-8 space-y-4 overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
