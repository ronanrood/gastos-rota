import React, { useEffect } from 'react';
import { useMotionValue, useSpring, useTransform, motion } from 'framer-motion';

export interface AnimatedCounterProps {
  value: number;
  formatAsCurrency?: boolean;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  formatAsCurrency = false,
  prefix = '',
  suffix = '',
  decimals = 2,
  className = '',
}) => {
  const motionVal = useMotionValue(value || 0);
  const springVal = useSpring(motionVal, { stiffness: 120, damping: 20 });

  useEffect(() => {
    motionVal.set(isNaN(value) ? 0 : value);
  }, [value, motionVal]);

  const display = useTransform(springVal, (current) => {
    const safe = isNaN(current) ? 0 : current;
    if (formatAsCurrency) {
      return safe.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    return `${prefix}${safe.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;
  });

  return <motion.span className={className}>{display}</motion.span>;
};
