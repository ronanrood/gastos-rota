import confetti from 'canvas-confetti';

export interface CelebrationOptions {
  particleCount?: number;
  spread?: number;
  origin?: { x?: number; y?: number };
  disableForReducedMotion?: boolean;
  colors?: string[];
}

const DEFAULT_CELEBRATION_COLORS = [
  '#10b981', // Verde Esmeralda 500
  '#34d399', // Esmeralda Claro 400
  '#059669', // Esmeralda Profundo 600
  '#f59e0b', // Ouro / Dourado Amber 500
  '#fbbf24', // Dourado Claro 400
  '#ffffff', // Branco Puro
];

/**
 * Dispara uma explosão curta, elegante e sofisticada de confetes (estilo app de banco digital)
 * com tons de verde esmeralda, dourado e branco, além de vibração tátil háptica em dispositivos móveis.
 */
export function triggerSuccessCelebration(options?: CelebrationOptions): void {
  // Vibração háptica no mobile se suportado
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([40, 30, 60]);
    } catch {
      // Ignora silenciosamente restrições do navegador
    }
  }

  try {
    confetti({
      particleCount: options?.particleCount ?? 45,
      spread: options?.spread ?? 60,
      origin: options?.origin ?? { y: 0.75 },
      disableForReducedMotion: options?.disableForReducedMotion ?? true,
      colors: options?.colors ?? DEFAULT_CELEBRATION_COLORS,
      ticks: 200,
      gravity: 1.1,
      scalar: 0.9,
    });
  } catch (err) {
    console.warn('Erro ao disparar confetti:', err);
  }
}

/**
 * Celebração de Meta Batida (duas rajadas laterais coordenadas sutis e elegantes)
 */
export function triggerGoalCelebration(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([50, 40, 80, 40, 100]);
    } catch {
      // Ignora silenciosamente restrições do navegador
    }
  }

  try {
    // Rajada esquerda
    confetti({
      particleCount: 35,
      angle: 60,
      spread: 55,
      origin: { x: 0.15, y: 0.7 },
      colors: DEFAULT_CELEBRATION_COLORS,
      disableForReducedMotion: true,
      ticks: 240,
    });
    // Rajada direita
    confetti({
      particleCount: 35,
      angle: 120,
      spread: 55,
      origin: { x: 0.85, y: 0.7 },
      colors: DEFAULT_CELEBRATION_COLORS,
      disableForReducedMotion: true,
      ticks: 240,
    });
  } catch (err) {
    console.warn('Erro ao disparar confetti de meta:', err);
  }
}
