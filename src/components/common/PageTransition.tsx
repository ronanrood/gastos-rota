import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

export interface PageTransitionProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`w-full ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};
