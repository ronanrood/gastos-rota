import type { Profile, DailyEarning, PaymentCycleType } from '../types/database';

export interface PaymentCycleInfo {
  id: string; // 'cycle_1' | 'cycle_2'
  cycleName: string; // ex: '1ª Quinzena' | '2ª Quinzena' | 'Fechamento Mensal'
  diaPagamento: number;
  corteInicio: number;
  corteFim: number;
  corteLabel: string;
  entries: DailyEarning[];
  totalFaturamento: number;
  totalPecas: number;
  totalKm: number;
  isCurrent: boolean;
  referenceMonthYear: string; // ex: '2026-11'
}

export const DEFAULT_PAYMENT_CONFIG = {
  tipo_recebimento: 'quinzenal' as PaymentCycleType,
  dia_pagamento_1: 17,
  corte_1_inicio: 16,
  corte_1_fim: 31,
  dia_pagamento_2: 2,
  corte_2_inicio: 1,
  corte_2_fim: 15,
};

export const getEffectivePaymentConfig = (profile: Profile | null) => {
  const tipo = profile?.tipo_recebimento || DEFAULT_PAYMENT_CONFIG.tipo_recebimento;
  return {
    tipo_recebimento: tipo,
    dia_pagamento_1: profile?.dia_pagamento_1 ?? DEFAULT_PAYMENT_CONFIG.dia_pagamento_1,
    corte_1_inicio: profile?.corte_1_inicio ?? DEFAULT_PAYMENT_CONFIG.corte_1_inicio,
    corte_1_fim: profile?.corte_1_fim ?? DEFAULT_PAYMENT_CONFIG.corte_1_fim,
    dia_pagamento_2: profile?.dia_pagamento_2 ?? DEFAULT_PAYMENT_CONFIG.dia_pagamento_2,
    corte_2_inicio: profile?.corte_2_inicio ?? DEFAULT_PAYMENT_CONFIG.corte_2_inicio,
    corte_2_fim: profile?.corte_2_fim ?? DEFAULT_PAYMENT_CONFIG.corte_2_fim,
    isCustomized: Boolean(profile?.tipo_recebimento),
  };
};

export const computePaymentCycles = (
  earnings: DailyEarning[],
  profile: Profile | null,
  referenceMonthStr?: string // 'YYYY-MM', defaults to current month
): {
  tipo: PaymentCycleType;
  cycles: PaymentCycleInfo[];
} => {
  const config = getEffectivePaymentConfig(profile);
  const now = new Date();
  const currentMonthStr = referenceMonthStr || now.toISOString().substring(0, 7);
  const todayDay = now.getDate();

  // Filtra lançamentos que pertencem ao mês de referência
  const monthEarnings = earnings.filter((e) => e.data && e.data.startsWith(currentMonthStr));

  const calculateForRange = (
    id: string,
    cycleName: string,
    diaPagamento: number,
    corteInicio: number,
    corteFim: number
  ): PaymentCycleInfo => {
    // Dias no intervalo [corteInicio, corteFim]
    const entries = monthEarnings.filter((item) => {
      if (!item.data) return false;
      const dayPart = parseInt(item.data.split('-')[2], 10);
      if (isNaN(dayPart)) return false;
      return dayPart >= corteInicio && dayPart <= corteFim;
    });

    // Ordena do dia mais recente para o mais antigo dentro do ciclo
    entries.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    const totalFaturamento = entries.reduce((acc, curr) => {
      const val =
        typeof curr.faturamento_bruto === 'number'
          ? curr.faturamento_bruto
          : curr.qtd_pecas * curr.valor_unitario_peca + curr.valor_extra_bonus;
      return acc + val;
    }, 0);

    const totalPecas = entries.reduce((acc, curr) => acc + (curr.qtd_pecas || 0), 0);
    const totalKm = entries.reduce((acc, curr) => acc + (curr.km_rodado || 0), 0);

    const isCurrent =
      referenceMonthStr === now.toISOString().substring(0, 7) &&
      todayDay >= corteInicio &&
      todayDay <= corteFim;

    return {
      id,
      cycleName,
      diaPagamento,
      corteInicio,
      corteFim,
      corteLabel: `Dias ${corteInicio} a ${corteFim}`,
      entries,
      totalFaturamento,
      totalPecas,
      totalKm,
      isCurrent,
      referenceMonthYear: currentMonthStr,
    };
  };

  if (config.tipo_recebimento === 'mensal') {
    const cycle = calculateForRange(
      'cycle_1',
      'Fechamento Mensal',
      config.dia_pagamento_1,
      config.corte_1_inicio,
      config.corte_1_fim
    );
    return {
      tipo: 'mensal',
      cycles: [cycle],
    };
  }

  // Quinzenal: Ciclo 1 (ex: 16 a 31 p/ dia 17) e Ciclo 2 (ex: 1 a 15 p/ dia 2)
  const cycle1 = calculateForRange(
    'cycle_1',
    'Ciclo 1',
    config.dia_pagamento_1,
    config.corte_1_inicio,
    config.corte_1_fim
  );

  const cycle2 = calculateForRange(
    'cycle_2',
    'Ciclo 2',
    config.dia_pagamento_2,
    config.corte_2_inicio,
    config.corte_2_fim
  );

  // Ordena para que o ciclo ativo no momento apareça em primeiro lugar ("Próximo Pagamento")
  const cycles = cycle1.isCurrent ? [cycle1, cycle2] : [cycle2, cycle1];

  return {
    tipo: 'quinzenal',
    cycles,
  };
};

