import type {
  Profile,
  DailyEarning,
  PaymentCycleType,
  PaymentCycleRecord,
  PaymentCycleStatus,
} from '../types/database';

export interface PaymentCycleInfo {
  id: string; // 'cycle_q1' | 'cycle_q2' | 'cycle_mensal'
  cycleName: string; // ex: '1ª Quinzena' | '2ª Quinzena' | 'Fechamento Mensal'
  referenciaChave: string; // ex: '2026-11-Q1' | '2026-11-Q2' | '2026-11-MENSAL'
  diaPagamento: number;
  corteInicio: number;
  corteFim: number;
  corteLabel: string;
  periodoInicio: string; // 'YYYY-MM-DD'
  periodoFim: string; // 'YYYY-MM-DD'
  dataPagamentoPrevista: string; // 'YYYY-MM-DD'
  entries: DailyEarning[];
  totalFaturamento: number;
  totalPecas: number;
  totalKm: number;
  isCurrent: boolean;
  referenceMonthYear: string; // ex: '2026-11'
  paymentRecord?: PaymentCycleRecord | null;
  status: PaymentCycleStatus;
  statusLabel: string;
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

export const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const calculatePaymentDueDate = (
  monthYear: string,
  corteFim: number,
  diaPagamento: number
): string => {
  const [yStr, mStr] = monthYear.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10);

  // Se o dia de pagamento for <= fim do corte, o fechamento é pago no mês subsequente
  if (diaPagamento <= corteFim) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  const lastDay = new Date(y, m, 0).getDate();
  const safeDay = Math.min(diaPagamento, lastDay);
  return `${y}-${String(m).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
};

export const computePaymentStatus = (
  dataPagamentoPrevista: string,
  diaPagamento: number,
  record?: PaymentCycleRecord | null,
  todayStr: string = getLocalDateString()
): { status: PaymentCycleStatus; statusLabel: string } => {
  if (record && record.status === 'pago') {
    return {
      status: 'pago',
      statusLabel: 'Pago / Na Conta',
    };
  }

  if (todayStr > dataPagamentoPrevista) {
    return {
      status: 'atrasado',
      statusLabel: `Pagamento Atrasado (Era dia ${diaPagamento})`,
    };
  }

  return {
    status: 'pendente',
    statusLabel: `Aguardando Pagamento (Dia ${diaPagamento})`,
  };
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
  referenceMonthStr?: string, // 'YYYY-MM', defaults to current month
  paymentRecords?: PaymentCycleRecord[]
): {
  tipo: PaymentCycleType;
  cycles: PaymentCycleInfo[];
} => {
  const config = getEffectivePaymentConfig(profile);
  const now = new Date();
  const currentMonthStr = referenceMonthStr || now.toISOString().substring(0, 7);
  const todayDay = now.getDate();
  const todayStr = getLocalDateString(now);

  const [yStr, mStr] = currentMonthStr.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const lastDayOfMonth = new Date(year, month, 0).getDate();

  // Filtra lançamentos que pertencem ao mês de referência
  const monthEarnings = earnings.filter((e) => e.data && e.data.startsWith(currentMonthStr));

  const calculateForRange = (options: {
    id: string;
    cycleName: string;
    referenciaSuffix: 'Q1' | 'Q2' | 'MENSAL';
    diaPagamento: number;
    corteInicio: number;
    corteFim: number;
  }): PaymentCycleInfo => {
    const { id, cycleName, referenciaSuffix, diaPagamento, corteInicio, corteFim } = options;
    const safeFim = Math.min(corteFim, lastDayOfMonth);
    const referenciaChave = `${currentMonthStr}-${referenciaSuffix}`;
    const periodoInicio = `${currentMonthStr}-${String(corteInicio).padStart(2, '0')}`;
    const periodoFim = `${currentMonthStr}-${String(safeFim).padStart(2, '0')}`;
    const dataPagamentoPrevista = calculatePaymentDueDate(currentMonthStr, corteFim, diaPagamento);

    // Dias no intervalo [corteInicio, safeFim]
    const entries = monthEarnings.filter((item) => {
      if (!item.data) return false;
      const dayPart = parseInt(item.data.split('-')[2], 10);
      if (isNaN(dayPart)) return false;
      return dayPart >= corteInicio && dayPart <= safeFim;
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
      todayDay <= safeFim;

    const matchedRecord = paymentRecords?.find((r) => r.referencia_chave === referenciaChave) || null;
    const { status, statusLabel } = computePaymentStatus(
      dataPagamentoPrevista,
      diaPagamento,
      matchedRecord,
      todayStr
    );

    return {
      id,
      cycleName,
      referenciaChave,
      diaPagamento,
      corteInicio,
      corteFim,
      corteLabel: `Dias ${corteInicio} a ${corteFim}`,
      periodoInicio,
      periodoFim,
      dataPagamentoPrevista,
      entries,
      totalFaturamento,
      totalPecas,
      totalKm,
      isCurrent,
      referenceMonthYear: currentMonthStr,
      paymentRecord: matchedRecord,
      status,
      statusLabel,
    };
  };

  if (config.tipo_recebimento === 'mensal') {
    const cycle = calculateForRange({
      id: 'cycle_mensal',
      cycleName: 'Fechamento Mensal',
      referenciaSuffix: 'MENSAL',
      diaPagamento: config.dia_pagamento_1,
      corteInicio: config.corte_1_inicio,
      corteFim: config.corte_1_fim,
    });
    return {
      tipo: 'mensal',
      cycles: [cycle],
    };
  }

  // Quinzenal:
  // Q1 (1ª Quinzena: dias 1 a 15 -> Pagto config.dia_pagamento_2)
  // Q2 (2ª Quinzena: dias 16 a 31 -> Pagto config.dia_pagamento_1)
  const q1Cycle = calculateForRange({
    id: 'cycle_q1',
    cycleName: '1ª Quinzena',
    referenciaSuffix: 'Q1',
    diaPagamento: config.dia_pagamento_2,
    corteInicio: config.corte_2_inicio,
    corteFim: config.corte_2_fim,
  });

  const q2Cycle = calculateForRange({
    id: 'cycle_q2',
    cycleName: '2ª Quinzena',
    referenciaSuffix: 'Q2',
    diaPagamento: config.dia_pagamento_1,
    corteInicio: config.corte_1_inicio,
    corteFim: config.corte_1_fim,
  });

  // Ordena para que o ciclo ativo no momento apareça em primeiro lugar ("Próximo Pagamento")
  const cycles = q2Cycle.isCurrent ? [q2Cycle, q1Cycle] : [q1Cycle, q2Cycle];

  return {
    tipo: 'quinzenal',
    cycles,
  };
};
