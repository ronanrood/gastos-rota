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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          {/* Backdrop escurecido clicável para fechar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 cursor-pointer"
            aria-hidden="true"
          />

          {/* Caixa do formulário responsiva segura (sem quebrar no teclado) */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-lg max-h-[85dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-2xl z-10 overscroll-contain"
          >
            {/* Barra superior de arrasto (drag handle no mobile) */}
            <div className="w-12 h-1.5 bg-zinc-700/80 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

            {/* Cabeçalho */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-zinc-800/80 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {icon && <div className="shrink-0">{icon}</div>}
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-xs text-zinc-400 truncate">{subtitle}</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar modal"
                className="w-9 h-9 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 active:bg-zinc-700 transition cursor-pointer shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com rolagem suave e espaço para teclado */}
            <div className="space-y-4">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
