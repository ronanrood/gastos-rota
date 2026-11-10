import type { Variants } from 'framer-motion';

/**
 * Entrada em cascata (Stagger) para containers de cards e listas
 */
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

/**
 * Animação individual de cada card dentro de um container com stagger
 */
export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.24,
      ease: [0.25, 1, 0.5, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.16,
    },
  },
};

/**
 * Animação de backdrop para Modais e Drawers com fade suave
 */
export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

/**
 * Animação de conteúdo de Modais com física natural de mola (Spring)
 */
export const modalContentVariants: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 18 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 350,
      damping: 28,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 12,
    transition: {
      duration: 0.15,
      ease: 'easeIn',
    },
  },
};

/**
 * Micro-interação tátil para botões principais
 */
export const buttonTapHover = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.96 },
  transition: { type: 'spring', stiffness: 500, damping: 25 },
};

/**
 * Micro-interação tátil para cards clicáveis
 */
export const cardTapHover = {
  whileHover: { y: -2, transition: { duration: 0.18 } },
  whileTap: { scale: 0.98 },
};
