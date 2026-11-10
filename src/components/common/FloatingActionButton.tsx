import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

interface FloatingActionButtonProps {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  label,
  onClick,
  icon = <Plus className="w-5 h-5 stroke-[2.5]" />,
}) => {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      aria-label={label}
      className="fixed bottom-20 right-4 z-40 md:hidden bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 shadow-lg shadow-emerald-500/30 h-14 px-5 rounded-full flex items-center gap-2 font-bold select-none cursor-pointer border border-emerald-400/40"
    >
      {icon}
      <span className="text-sm font-extrabold tracking-tight">
        {label.replace(/^\+\s*/, '')}
      </span>
    </motion.button>
  );
};
