import type { DailyEarning, FuelLog, MaintenanceLog, Profile, Vehicle } from '../types/database';

export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

export const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export const formatDateShortBR = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
};

export const formatDateTimeNow = (): string => {
  const now = new Date();
  const date = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date} às ${time}`;
};

/**
 * Copia texto para a área de transferência com fallback robusto
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Falha no navigator.clipboard, usando fallback textarea:', err);
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Falha ao copiar texto:', err);
    return false;
  }
};

/**
 * Abre o WhatsApp com o texto pré-preenchido
 */
export const openWhatsAppShare = (text: string) => {
  const encoded = encodeURIComponent(text);
  const url = `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * Gera texto para WhatsApp do Fechamento de Ganhos / Rota
 */
export const generateWhatsAppEarningsText = (options: {
  profile: Profile | null;
  periodLabel: string;
  items: DailyEarning[];
  paymentNotice?: string;
  vehicle?: Vehicle | null;
}): string => {
  const { profile, periodLabel, items, paymentNotice, vehicle } = options;

  // Ordena os itens cronologicamente (do mais antigo ao mais recente)
  const sortedItems = [...items].sort((a, b) => (a.data || '').localeCompare(b.data || ''));

  const totalFaturamento = sortedItems.reduce((acc, curr) => {
    const val =
      typeof curr.faturamento_bruto === 'number'
        ? curr.faturamento_bruto
        : (curr.qtd_pecas || 0) * (curr.valor_unitario_peca || 0) + (curr.valor_extra_bonus || 0);
    return acc + val;
  }, 0);

  const totalPecas = sortedItems.reduce((acc, curr) => acc + (curr.qtd_pecas || 0), 0);
  const totalKm = sortedItems.reduce((acc, curr) => acc + (curr.km_rodado || 0), 0);
  const totalBonus = sortedItems.reduce((acc, curr) => acc + (curr.valor_extra_bonus || 0), 0);
  const uniqueDays = new Set(sortedItems.map((i) => i.data)).size;

  const lines: string[] = [
    `*FECHAMENTO DE ROTA - GASTOS ROTA*`,
    `----------------------------------------`,
  ];

  if (profile?.nome) lines.push(`👤 *Motorista:* ${profile.nome}`);
  if (profile?.transportadora) lines.push(`🏢 *Transportadora:* ${profile.transportadora}`);
  if (profile?.rota) lines.push(`📍 *Rota:* ${profile.rota}`);
  if (profile?.cpf_cnpj) lines.push(`📄 *CPF/CNPJ:* ${profile.cpf_cnpj}`);
  if (vehicle) lines.push(`🚗 *Veículo:* ${vehicle.marca} ${vehicle.modelo} (${vehicle.ano})`);

  let periodoCompleto = periodLabel;
  if (paymentNotice) {
    periodoCompleto += ` • ${paymentNotice}`;
  }
  lines.push(`📅 *Período:* ${periodoCompleto}`);
  lines.push(`----------------------------------------`);

  lines.push(`*Lançamentos do Período:*`);
  if (sortedItems.length === 0) {
    lines.push(`_Nenhum lançamento registrado neste período._`);
  } else {
    sortedItems.forEach((item) => {
      const faturamento =
        typeof item.faturamento_bruto === 'number'
          ? item.faturamento_bruto
          : item.qtd_pecas * item.valor_unitario_peca + item.valor_extra_bonus;
      const dataFormatada = formatDateShortBR(item.data);
      let line = `- ${dataFormatada}: ${item.qtd_pecas} peças | ${item.km_rodado} km | ${formatCurrency(faturamento)}`;
      if (item.valor_extra_bonus > 0) {
        line += ` (inclui ${formatCurrency(item.valor_extra_bonus)} bônus)`;
      }
      lines.push(line);
    });
  }

  lines.push(`----------------------------------------`);
  lines.push(`*RESUMO DO FECHAMENTO:*`);
  lines.push(`• *Total de Dias Trabalhados:* ${uniqueDays} dias`);
  lines.push(`• *Total de Peças Entregues:* ${totalPecas.toLocaleString('pt-BR')} peças`);
  lines.push(`• *KM Total Rodado:* ${totalKm.toLocaleString('pt-BR')} km`);
  if (totalBonus > 0) {
    lines.push(`• *Total em Bônus:* ${formatCurrency(totalBonus)}`);
  }
  lines.push(`• *VALOR TOTAL A RECEBER:* ${formatCurrency(totalFaturamento)}`);
  lines.push(`----------------------------------------`);

  if (profile?.chave_pix) {
    lines.push(`*DADOS PARA PAGAMENTO (PIX):*`);
    lines.push(`💳 *Chave PIX:* ${profile.chave_pix}`);
    lines.push(`----------------------------------------`);
  }

  lines.push(`_Relatório emitido em ${formatDateTimeNow()} pelo app Gastos Rota_`);

  return lines.join('\n');
};

/**
 * Gera texto para WhatsApp do Relatório de Combustível
 */
export const generateWhatsAppFuelText = (options: {
  profile: Profile | null;
  periodLabel: string;
  items: FuelLog[];
  vehicle?: Vehicle | null;
}): string => {
  const { profile, periodLabel, items, vehicle } = options;
  const sortedItems = [...items].sort((a, b) => (a.data || '').localeCompare(b.data || ''));

  const totalGasto = sortedItems.reduce((acc, curr) => acc + (curr.valor_total_abastecido || 0), 0);
  const totalLitros = sortedItems.reduce((acc, curr) => {
    const l =
      typeof curr.litros_calculados === 'number'
        ? curr.litros_calculados
        : (curr.valor_total_abastecido || 0) / (curr.preco_por_litro_ou_m3 || 1);
    return acc + (isNaN(l) ? 0 : l);
  }, 0);

  const precoMedio = totalLitros > 0 ? totalGasto / totalLitros : 0;

  const lines: string[] = [
    `*RELATÓRIO DE COMBUSTÍVEL - GASTOS ROTA*`,
    `----------------------------------------`,
  ];

  if (profile?.nome) lines.push(`👤 *Motorista:* ${profile.nome}`);
  if (vehicle) lines.push(`🚗 *Veículo:* ${vehicle.marca} ${vehicle.modelo} (${vehicle.ano})`);
  lines.push(`📅 *Período:* ${periodLabel}`);
  lines.push(`----------------------------------------`);

  lines.push(`*Abastecimentos do Período:*`);
  if (sortedItems.length === 0) {
    lines.push(`_Nenhum abastecimento registrado neste período._`);
  } else {
    sortedItems.forEach((item) => {
      const litros =
        typeof item.litros_calculados === 'number'
          ? item.litros_calculados
          : item.valor_total_abastecido / (item.preco_por_litro_ou_m3 || 1);
      const dataFormatada = formatDateShortBR(item.data);
      const tipo = item.tipo_combustivel.toUpperCase();
      lines.push(
        `- ${dataFormatada}: ${tipo} | ${litros.toFixed(2)} ${item.tipo_combustivel === 'gnv' ? 'm³' : 'L'} | ${formatCurrency(item.valor_total_abastecido)} | KM ${item.km_odometro.toLocaleString('pt-BR')}`
      );
    });
  }

  lines.push(`----------------------------------------`);
  lines.push(`*RESUMO DE COMBUSTÍVEL:*`);
  lines.push(`• *Total de Abastecimentos:* ${sortedItems.length}`);
  lines.push(`• *Volume Total:* ${totalLitros.toFixed(2)} L/m³`);
  lines.push(`• *Preço Médio por Litro:* ${formatCurrency(precoMedio)}`);
  lines.push(`• *TOTAL GASTO:* ${formatCurrency(totalGasto)}`);
  lines.push(`----------------------------------------`);
  lines.push(`_Relatório emitido em ${formatDateTimeNow()} pelo app Gastos Rota_`);

  return lines.join('\n');
};

/**
 * Gera texto para WhatsApp do Relatório de Oficina e Manutenção
 */
export const generateWhatsAppMaintenanceText = (options: {
  profile: Profile | null;
  periodLabel: string;
  items: MaintenanceLog[];
  vehicle?: Vehicle | null;
}): string => {
  const { profile, periodLabel, items, vehicle } = options;
  const sortedItems = [...items].sort((a, b) => (a.data || '').localeCompare(b.data || ''));

  const realizados = sortedItems.filter((m) => m.status !== 'orcamento');
  const orcamentos = sortedItems.filter((m) => m.status === 'orcamento');

  const totalRealizados = realizados.reduce((acc, curr) => {
    const val =
      typeof curr.valor_total === 'number'
        ? curr.valor_total
        : (curr.valor_pecas || 0) + (curr.valor_mao_de_obra || 0);
    return acc + val;
  }, 0);

  const totalOrcamentos = orcamentos.reduce((acc, curr) => {
    const val =
      typeof curr.valor_total === 'number'
        ? curr.valor_total
        : (curr.valor_pecas || 0) + (curr.valor_mao_de_obra || 0);
    return acc + val;
  }, 0);

  const lines: string[] = [
    `*RELATÓRIO DE OFICINA E MANUTENÇÃO - GASTOS ROTA*`,
    `----------------------------------------`,
  ];

  if (profile?.nome) lines.push(`👤 *Motorista:* ${profile.nome}`);
  if (vehicle) lines.push(`🚗 *Veículo:* ${vehicle.marca} ${vehicle.modelo} (${vehicle.ano})`);
  lines.push(`📅 *Período:* ${periodLabel}`);
  lines.push(`----------------------------------------`);

  lines.push(`*Serviços e Orçamentos:*`);
  if (sortedItems.length === 0) {
    lines.push(`_Nenhum registro de oficina encontrado neste período._`);
  } else {
    sortedItems.forEach((item) => {
      const total =
        typeof item.valor_total === 'number'
          ? item.valor_total
          : item.valor_pecas + item.valor_mao_de_obra;
      const statusLabel = item.status === 'orcamento' ? 'ORÇAMENTO' : 'CONCLUÍDO';
      const dataFormatada = formatDateShortBR(item.data);
      lines.push(
        `- ${dataFormatada}: ${item.oficina_nome} | ${item.descricao_servico} | [${statusLabel}] | ${formatCurrency(total)}`
      );
    });
  }

  lines.push(`----------------------------------------`);
  lines.push(`*RESUMO DA OFICINA:*`);
  lines.push(`• *Serviços Realizados:* ${formatCurrency(totalRealizados)} (${realizados.length} serviços)`);
  lines.push(`• *Orçamentos Pendentes:* ${formatCurrency(totalOrcamentos)} (${orcamentos.length} orçamentos)`);
  lines.push(`• *TOTAL GERAL:* ${formatCurrency(totalRealizados + totalOrcamentos)}`);
  lines.push(`----------------------------------------`);
  lines.push(`_Relatório emitido em ${formatDateTimeNow()} pelo app Gastos Rota_`);

  return lines.join('\n');
};

/**
 * Gera texto para WhatsApp do Fechamento Financeiro Consolidado (Dashboard)
 */
export const generateWhatsAppDashboardText = (options: {
  profile: Profile | null;
  periodLabel: string;
  faturamentoBruto: number;
  despesasCombustivel: number;
  despesasOficina: number;
  despesasTotais: number;
  lucroLiquidoReal: number;
  totalKmRodados: number;
  diasProducao: number;
  vehicle?: Vehicle | null;
}): string => {
  const {
    profile,
    periodLabel,
    faturamentoBruto,
    despesasCombustivel,
    despesasOficina,
    despesasTotais,
    lucroLiquidoReal,
    totalKmRodados,
    diasProducao,
    vehicle,
  } = options;

  const margem = faturamentoBruto > 0 ? (lucroLiquidoReal / faturamentoBruto) * 100 : 0;
  const ganhoKm = totalKmRodados > 0 ? faturamentoBruto / totalKmRodados : 0;
  const lucroKm = totalKmRodados > 0 ? lucroLiquidoReal / totalKmRodados : 0;

  const lines: string[] = [
    `*FECHAMENTO FINANCEIRO CONSOLIDADO - GASTOS ROTA*`,
    `----------------------------------------`,
  ];

  if (profile?.nome) lines.push(`👤 *Motorista:* ${profile.nome}`);
  if (profile?.transportadora) lines.push(`🏢 *Transportadora:* ${profile.transportadora}`);
  if (profile?.rota) lines.push(`📍 *Rota:* ${profile.rota}`);
  if (profile?.cpf_cnpj) lines.push(`📄 *CPF/CNPJ:* ${profile.cpf_cnpj}`);
  if (vehicle) lines.push(`🚗 *Veículo:* ${vehicle.marca} ${vehicle.modelo} (${vehicle.ano})`);
  lines.push(`📅 *Período:* ${periodLabel}`);
  lines.push(`----------------------------------------`);

  lines.push(`*RESUMO FINANCEIRO:*`);
  lines.push(`• *Faturamento Bruto:* ${formatCurrency(faturamentoBruto)} (${diasProducao} dias trabalhados)`);
  lines.push(`• *Despesas com Combustível:* ${formatCurrency(despesasCombustivel)}`);
  lines.push(`• *Despesas com Oficina:* ${formatCurrency(despesasOficina)}`);
  lines.push(`• *Despesas Totais:* ${formatCurrency(despesasTotais)}`);
  lines.push(`• *LUCRO LÍQUIDO REAL:* ${formatCurrency(lucroLiquidoReal)}`);
  lines.push(`• *Margem de Lucro:* ${margem.toFixed(1)}%`);
  lines.push(`----------------------------------------`);

  if (totalKmRodados > 0) {
    lines.push(`*INDICADORES DE ROTA:*`);
    lines.push(`• *KM Total Rodado:* ${totalKmRodados.toLocaleString('pt-BR')} km`);
    lines.push(`• *Faturamento por KM:* ${formatCurrency(ganhoKm)}/km`);
    lines.push(`• *Lucro Líquido por KM:* ${formatCurrency(lucroKm)}/km`);
    lines.push(`----------------------------------------`);
  }

  if (profile?.chave_pix) {
    lines.push(`*DADOS PARA PAGAMENTO (PIX):*`);
    lines.push(`💳 *Chave PIX:* ${profile.chave_pix}`);
    lines.push(`----------------------------------------`);
  }

  lines.push(`_Relatório emitido em ${formatDateTimeNow()} pelo app Gastos Rota_`);

  return lines.join('\n');
};
