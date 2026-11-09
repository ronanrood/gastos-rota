import type { MaintenanceLog } from '../types/database';

export const isServiceParcelado = (
  log: MaintenanceLog | null | undefined
): boolean => {
  if (!log) return false;
  return log.forma_pagamento === 'parcelado' && (log.qtd_parcelas || 1) > 1;
};

export const getServiceTotal = (log: MaintenanceLog): number => {
  if (typeof log.valor_total === 'number') {
    return log.valor_total;
  }
  return (log.valor_pecas || 0) + (log.valor_mao_de_obra || 0);
};

/**
 * Retorna o mês 'YYYY-MM' correspondente à parcela (índice 0-based)
 */
export const getInstallmentMonth = (
  firstDateOrMonth: string,
  indexZeroBased: number
): string => {
  if (!firstDateOrMonth) return '';
  const parts = firstDateOrMonth.split('-');
  let y = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10) + indexZeroBased;

  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }

  return `${y}-${String(m).padStart(2, '0')}`;
};

/**
 * Retorna a data 'YYYY-MM-DD' exata da parcela (índice 0-based),
 * respeitando o dia da primeira parcela com clamp no último dia do mês correspondente.
 */
export const getInstallmentDate = (
  firstDate: string,
  indexZeroBased: number
): string => {
  if (!firstDate) return '';
  const parts = firstDate.split('-');
  let y = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10) + indexZeroBased;
  const targetDay = parts[2] ? parseInt(parts[2], 10) : 1;

  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }

  const maxDays = new Date(y, m, 0).getDate();
  const safeDay = Math.min(targetDay, maxDays);
  return `${y}-${String(m).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
};

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

export interface InstallmentInfo {
  isParcelado: boolean;
  totalParcelas: number;
  valorParcela: number;
  valorTotalServico: number;
  firstInstallmentMonth: string; // 'YYYY-MM'
  firstInstallmentDate: string; // 'YYYY-MM-DD'
  targetMonth: string; // 'YYYY-MM'
  isFinished: boolean; // Quitado
  isFuture: boolean; // Ainda não começou
  isActiveInTargetMonth: boolean; // Parcela vigente no mês analisado
  currentInstallmentNumber: number; // 1..N
  remainingInstallmentsCount: number;
  remainingValue: number;
  progressPercent: number;
  badgeLabel: string;
}

/**
 * Analisa o estado de um serviço parcelado em relação a um mês de referência (ex: '2026-11').
 */
export const calculateMaintenanceInstallmentInfo = (
  log: MaintenanceLog,
  referenceMonthYear?: string
): InstallmentInfo => {
  const isParcel = isServiceParcelado(log);
  const totalParcelas = Math.max(log.qtd_parcelas || 1, 1);
  const valorTotalServico = getServiceTotal(log);
  const valorParcela =
    typeof log.valor_parcela === 'number' && log.valor_parcela > 0
      ? log.valor_parcela
      : valorTotalServico / totalParcelas;

  const firstInstallmentDate = log.mes_primeira_parcela || log.data || '';
  const firstInstallmentMonth = firstInstallmentDate.substring(0, 7);

  const targetMonth =
    referenceMonthYear || new Date().toISOString().substring(0, 7);

  if (!isParcel) {
    return {
      isParcelado: false,
      totalParcelas: 1,
      valorParcela: valorTotalServico,
      valorTotalServico,
      firstInstallmentMonth,
      firstInstallmentDate,
      targetMonth,
      isFinished: true,
      isFuture: false,
      isActiveInTargetMonth: targetMonth === firstInstallmentMonth,
      currentInstallmentNumber: 1,
      remainingInstallmentsCount: 0,
      remainingValue: 0,
      progressPercent: 100,
      badgeLabel: 'À Vista',
    };
  }

  // Diferença em meses entre o primeiro mês de parcela e o mês alvo
  const [y1, m1] = firstInstallmentMonth.split('-').map(Number);
  const [y2, m2] = targetMonth.split('-').map(Number);
  const diffMonths = (y2 - y1) * 12 + (m2 - m1);

  const isFuture = diffMonths < 0;
  const isFinished = diffMonths >= totalParcelas;

  if (isFinished) {
    return {
      isParcelado: true,
      totalParcelas,
      valorParcela,
      valorTotalServico,
      firstInstallmentMonth,
      firstInstallmentDate,
      targetMonth,
      isFinished: true,
      isFuture: false,
      isActiveInTargetMonth: false,
      currentInstallmentNumber: totalParcelas,
      remainingInstallmentsCount: 0,
      remainingValue: 0,
      progressPercent: 100,
      badgeLabel: 'Quitado ✅',
    };
  }

  if (isFuture) {
    const formattedFirst = firstInstallmentMonth.split('-').reverse().join('/');
    return {
      isParcelado: true,
      totalParcelas,
      valorParcela,
      valorTotalServico,
      firstInstallmentMonth,
      firstInstallmentDate,
      targetMonth,
      isFinished: false,
      isFuture: true,
      isActiveInTargetMonth: false,
      currentInstallmentNumber: 0,
      remainingInstallmentsCount: totalParcelas,
      remainingValue: totalParcelas * valorParcela,
      progressPercent: 0,
      badgeLabel: `Inicia em ${formattedFirst} (0 de ${totalParcelas})`,
    };
  }

  // Parcela ativa no mês
  const currentInstallmentNumber = diffMonths + 1; // 1-based
  const remainingInstallmentsCount = totalParcelas - currentInstallmentNumber;
  const remainingValue = remainingInstallmentsCount * valorParcela;
  const progressPercent = Math.round((currentInstallmentNumber / totalParcelas) * 100);

  const badgeLabel = `Parcela ${currentInstallmentNumber} de ${totalParcelas} • ${formatCurrency(
    valorParcela
  )}/mês • Faltam ${formatCurrency(remainingValue)}`;

  return {
    isParcelado: true,
    totalParcelas,
    valorParcela,
    valorTotalServico,
    firstInstallmentMonth,
    firstInstallmentDate,
    targetMonth,
    isFinished: false,
    isFuture: false,
    isActiveInTargetMonth: true,
    currentInstallmentNumber,
    remainingInstallmentsCount,
    remainingValue,
    progressPercent,
    badgeLabel,
  };
};

export interface PeriodExpensesSummary {
  totalExpenses: number;
  avistaTotal: number;
  parcelasTotal: number;
  activeInstallmentsCount: number;
  futureCommittedTotal: number;
}

/**
 * Calcula com precisão matemática as despesas de oficina que realmente afetam o caixa no período selecionado:
 * - Serviços à vista: debitados integralmente na data do serviço.
 * - Serviços parcelados: apenas a parcela correspondente ao mês/período é debitada!
 */
export const calculatePeriodMaintenanceExpenses = (
  allLogs: MaintenanceLog[],
  options: {
    monthYear?: string;
    startDate?: string | null;
    endDate?: string | null;
  }
): PeriodExpensesSummary => {
  const { monthYear, startDate, endDate } = options;

  let avistaTotal = 0;
  let parcelasTotal = 0;
  let activeInstallmentsCount = 0;
  let futureCommittedTotal = 0;

  // Apenas serviços concluídos/realizados geram despesa no caixa (orçamentos são pendentes)
  const realizados = allLogs.filter((m) => m.status !== 'orcamento');

  realizados.forEach((log) => {
    const isParcel = isServiceParcelado(log);

    if (!isParcel) {
      // À VISTA: afeta a data do serviço
      const logData = log.data;
      let matches = false;

      if (monthYear) {
        matches = logData.startsWith(monthYear);
      } else if (startDate && endDate) {
        matches = logData >= startDate && logData <= endDate;
      } else if (startDate) {
        matches = logData >= startDate;
      } else if (endDate) {
        matches = logData <= endDate;
      } else {
        matches = true;
      }

      if (matches) {
        avistaTotal += getServiceTotal(log);
      }
    } else {
      // PARCELADO: distribui cada parcela no seu respectivo mês/data
      const totalParcelas = Math.max(log.qtd_parcelas || 1, 1);
      const valorTotalServico = getServiceTotal(log);
      const valorParcela =
        typeof log.valor_parcela === 'number' && log.valor_parcela > 0
          ? log.valor_parcela
          : valorTotalServico / totalParcelas;

      const firstDate = log.mes_primeira_parcela || log.data || '';

      for (let i = 0; i < totalParcelas; i++) {
        const instMonth = getInstallmentMonth(firstDate, i);
        const instDate = getInstallmentDate(firstDate, i);

        let matches = false;
        if (monthYear) {
          matches = instMonth === monthYear;
        } else if (startDate && endDate) {
          matches = instDate >= startDate && instDate <= endDate;
        } else if (startDate) {
          matches = instDate >= startDate;
        } else if (endDate) {
          matches = instDate <= endDate;
        } else {
          matches = true;
        }

        if (matches) {
          parcelasTotal += valorParcela;
          activeInstallmentsCount += 1;
        } else {
          // Verifica se é uma parcela futura em relação ao período filtrado
          const referenceBoundary = endDate || (monthYear ? `${monthYear}-31` : null);
          if (referenceBoundary && instDate > referenceBoundary) {
            futureCommittedTotal += valorParcela;
          }
        }
      }
    }
  });

  return {
    totalExpenses: Number((avistaTotal + parcelasTotal).toFixed(2)),
    avistaTotal: Number(avistaTotal.toFixed(2)),
    parcelasTotal: Number(parcelasTotal.toFixed(2)),
    activeInstallmentsCount,
    futureCommittedTotal: Number(futureCommittedTotal.toFixed(2)),
  };
};
