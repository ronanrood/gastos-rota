import type { Profile } from '../types/database';

export type PeriodChipType = 'month' | 'quinzena_1' | 'quinzena_2' | 'today' | '7days' | 'custom';

export type SortOptionType = 'recent' | 'oldest' | 'highest_value' | 'lowest_value';

export interface HistoryFilterState {
  monthYear: string; // 'YYYY-MM'
  periodChip: PeriodChipType;
  customStartDate: string; // 'YYYY-MM-DD'
  customEndDate: string; // 'YYYY-MM-DD'
  searchQuery: string;
  sortBy: SortOptionType;
}

export const getCurrentMonthYear = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getDefaultFilterState = (): HistoryFilterState => {
  return {
    monthYear: getCurrentMonthYear(),
    periodChip: 'month',
    customStartDate: '',
    customEndDate: '',
    searchQuery: '',
    sortBy: 'recent',
  };
};

/**
 * Formata '2026-11' como 'Novembro 2026'
 */
export const formatMonthYear = (monthYear: string): string => {
  if (!monthYear || !monthYear.includes('-')) return monthYear;
  const [y, m] = monthYear.split('-');
  const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  const text = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Avança ou recua um mês no formato 'YYYY-MM'
 */
export const navigateMonthYear = (current: string, direction: -1 | 1): string => {
  const [yStr, mStr] = current.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) - 1 + direction;
  if (m < 0) {
    m = 11;
    y -= 1;
  } else if (m > 11) {
    m = 0;
    y += 1;
  }
  return `${y}-${String(m + 1).padStart(2, '0')}`;
};

/**
 * Retorna os cortes e dias de pagamento com base no perfil do motorista
 */
export const getProfilePaymentConfig = (profile: Profile | null) => {
  const tipo = profile?.tipo_recebimento || 'quinzenal';
  const diaPagamento1 = profile?.dia_pagamento_1 ?? 17;
  const corte1Inicio = profile?.corte_1_inicio ?? 16;
  const corte1Fim = profile?.corte_1_fim ?? 31;

  const diaPagamento2 = profile?.dia_pagamento_2 ?? 2;
  const corte2Inicio = profile?.corte_2_inicio ?? 1;
  const corte2Fim = profile?.corte_2_fim ?? 15;

  return {
    tipo,
    diaPagamento1,
    corte1Inicio,
    corte1Fim,
    diaPagamento2,
    corte2Inicio,
    corte2Fim,
  };
};

/**
 * Calcula o intervalo de datas (startDate e endDate) para o filtro ativo
 */
export const calculateFilterDateRange = (
  state: HistoryFilterState,
  profile: Profile | null
): {
  startDate: string | null;
  endDate: string | null;
  periodLabel: string;
  paymentNotice?: string;
} => {
  const { monthYear, periodChip, customStartDate, customEndDate } = state;
  const [yStr, mStr] = monthYear.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const config = getProfilePaymentConfig(profile);

  if (periodChip === 'month') {
    const startDate = `${monthYear}-01`;
    const endDate = `${monthYear}-${String(lastDayOfMonth).padStart(2, '0')}`;
    return {
      startDate,
      endDate,
      periodLabel: `Mês de ${formatMonthYear(monthYear)}`,
    };
  }

  if (periodChip === 'quinzena_1') {
    const cInicio = config.corte2Inicio;
    const cFim = Math.min(config.corte2Fim, lastDayOfMonth);
    const startDate = `${monthYear}-${String(cInicio).padStart(2, '0')}`;
    const endDate = `${monthYear}-${String(cFim).padStart(2, '0')}`;
    return {
      startDate,
      endDate,
      periodLabel: `1ª Quinzena (Dias ${cInicio} a ${cFim})`,
      paymentNotice: `Pagamento Previsto no Dia ${config.diaPagamento2}`,
    };
  }

  if (periodChip === 'quinzena_2') {
    const cInicio = config.corte1Inicio;
    const cFim = Math.min(config.corte1Fim, lastDayOfMonth);
    const startDate = `${monthYear}-${String(cInicio).padStart(2, '0')}`;
    const endDate = `${monthYear}-${String(cFim).padStart(2, '0')}`;
    return {
      startDate,
      endDate,
      periodLabel: `2ª Quinzena (Dias ${cInicio} a ${cFim})`,
      paymentNotice: `Pagamento Previsto no Dia ${config.diaPagamento1}`,
    };
  }

  if (periodChip === 'today') {
    const today = new Date().toISOString().split('T')[0];
    return {
      startDate: today,
      endDate: today,
      periodLabel: 'Hoje',
    };
  }

  if (periodChip === '7days') {
    const now = new Date();
    const past = new Date();
    past.setDate(past.getDate() - 6);
    const startDate = past.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];
    return {
      startDate,
      endDate,
      periodLabel: 'Últimos 7 dias',
    };
  }

  if (periodChip === 'custom') {
    return {
      startDate: customStartDate || null,
      endDate: customEndDate || null,
      periodLabel:
        customStartDate && customEndDate
          ? `De ${customStartDate.split('-').reverse().join('/')} até ${customEndDate.split('-').reverse().join('/')}`
          : 'Período Personalizado',
    };
  }

  return {
    startDate: null,
    endDate: null,
    periodLabel: 'Todos os Lançamentos',
  };
};

/**
 * Retorna etiqueta de lote de pagamento e data amigável para um card
 * Ex: "Sex, 30 Out 2026 • 2ª Quinzena (Pagto dia 17)"
 */
export const formatCardDateBadge = (
  dateStr: string,
  profile: Profile | null
): {
  fullBadge: string;
  formattedDate: string;
  weekday: string;
  paymentCycleBadge: string;
} => {
  if (!dateStr) {
    return {
      fullBadge: '',
      formattedDate: '',
      weekday: '',
      paymentCycleBadge: '',
    };
  }

  const [y, m, d] = dateStr.split('-');
  const dayNum = parseInt(d, 10);
  const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, dayNum);

  const weekdayRaw = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
  const weekday = weekdayRaw.replace('.', '').charAt(0).toUpperCase() + weekdayRaw.replace('.', '').slice(1);
  const monthShortRaw = dateObj.toLocaleDateString('pt-BR', { month: 'short' });
  const monthShort = monthShortRaw.replace('.', '').charAt(0).toUpperCase() + monthShortRaw.replace('.', '').slice(1);
  const formattedDate = `${dayNum} ${monthShort} ${y}`;

  const config = getProfilePaymentConfig(profile);
  let paymentCycleBadge = '';

  if (config.tipo === 'mensal') {
    paymentCycleBadge = `Fechamento Mensal (Pagto dia ${config.diaPagamento1})`;
  } else {
    if (dayNum >= config.corte1Inicio && dayNum <= config.corte1Fim) {
      paymentCycleBadge = `2ª Quinzena (Pagto dia ${config.diaPagamento1})`;
    } else if (dayNum >= config.corte2Inicio && dayNum <= config.corte2Fim) {
      paymentCycleBadge = `1ª Quinzena (Pagto dia ${config.diaPagamento2})`;
    } else {
      paymentCycleBadge = `Lote Quinzena`;
    }
  }

  const fullBadge = `${weekday}, ${formattedDate} • ${paymentCycleBadge}`;

  return {
    fullBadge,
    formattedDate,
    weekday,
    paymentCycleBadge,
  };
};

/**
 * Conta quantos filtros estão ativos além do padrão
 */
export const countActiveFilters = (state: HistoryFilterState): number => {
  let count = 0;
  const currentMonth = getCurrentMonthYear();

  if (state.monthYear !== currentMonth) count += 1;
  if (state.periodChip !== 'month') count += 1;
  if (state.searchQuery.trim().length > 0) count += 1;
  if (state.sortBy !== 'recent') count += 1;
  if (state.periodChip === 'custom' && (state.customStartDate || state.customEndDate)) count += 1;

  return count;
};

