import type { PreventiveMaintenanceData, PreventiveMaintenanceItem, Vehicle } from '../types/database';

export type MaintenanceHealthStatus = 'saudavel' | 'atencao' | 'vencido';

export type PreventiveItemKey = 'oleo_motor' | 'pastilhas_freio' | 'pneus' | 'correia_dentada';

export interface ComponentHealthInfo {
  key: PreventiveItemKey;
  nome: string;
  intervalo_km: number;
  ultimo_km: number;
  ultima_data: string;
  kmRodadoDesdeATroca: number;
  kmRestante: number;
  trocarAosKm: number;
  percentualDesgaste: number;
  status: MaintenanceHealthStatus;
  badgeLabel: string;
  statusText: string;
  urgencia: number; // 3: vencido, 2: atencao, 1: saudavel
}

export const DEFAULT_PREVENTIVE_CONFIGS: Record<PreventiveItemKey, { nome: string; intervalo_km: number; icon: string }> = {
  oleo_motor: {
    nome: 'Óleo e Filtro do Motor',
    intervalo_km: 10000,
    icon: 'Droplets',
  },
  pastilhas_freio: {
    nome: 'Pastilhas de Freio',
    intervalo_km: 25000,
    icon: 'Disc',
  },
  pneus: {
    nome: 'Pneus e Alinhamento',
    intervalo_km: 45000,
    icon: 'CircleDot',
  },
  correia_dentada: {
    nome: 'Correia Dentada / Sincronizadora',
    intervalo_km: 50000,
    icon: 'Cog',
  },
};

const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Normaliza os 4 componentes garantindo valores padrão se ainda não configurados no JSONB
 */
export function normalizePreventiveMaintenanceData(
  data: PreventiveMaintenanceData | null | undefined,
  kmAtual: number
): Record<PreventiveItemKey, PreventiveMaintenanceItem> {
  const today = getTodayString();
  const safeKm = Math.max(0, kmAtual || 0);

  const getOrDef = (key: PreventiveItemKey): PreventiveMaintenanceItem => {
    const raw = data?.[key];
    const def = DEFAULT_PREVENTIVE_CONFIGS[key];
    if (raw && typeof raw.intervalo_km === 'number' && typeof raw.ultimo_km === 'number') {
      return {
        nome: raw.nome || def.nome,
        intervalo_km: raw.intervalo_km > 0 ? raw.intervalo_km : def.intervalo_km,
        ultimo_km: Math.max(0, raw.ultimo_km),
        ultima_data: raw.ultima_data || today,
      };
    }
    return {
      nome: def.nome,
      intervalo_km: def.intervalo_km,
      ultimo_km: safeKm,
      ultima_data: today,
    };
  };

  return {
    oleo_motor: getOrDef('oleo_motor'),
    pastilhas_freio: getOrDef('pastilhas_freio'),
    pneus: getOrDef('pneus'),
    correia_dentada: getOrDef('correia_dentada'),
  };
}

/**
 * Calcula os indicadores de saúde para um componente individual
 */
export function calculateComponentHealth(
  key: PreventiveItemKey,
  item: PreventiveMaintenanceItem,
  kmAtual: number
): ComponentHealthInfo {
  const safeKmAtual = Math.max(0, kmAtual || 0);
  const kmRodadoDesdeATroca = Math.max(0, safeKmAtual - item.ultimo_km);
  const kmRestante = item.intervalo_km - kmRodadoDesdeATroca;
  const trocarAosKm = item.ultimo_km + item.intervalo_km;
  const percentualDesgaste = Math.min(100, Math.max(0, Math.round((kmRodadoDesdeATroca / item.intervalo_km) * 100)));

  let status: MaintenanceHealthStatus = 'saudavel';
  let badgeLabel = 'Saudável';
  let statusText = `Faltam ${kmRestante.toLocaleString('pt-BR')} km para a próxima troca (Trocar aos ${trocarAosKm.toLocaleString('pt-BR')} km)`;
  let urgencia = 1;

  if (percentualDesgaste >= 100 || kmRestante <= 0) {
    status = 'vencido';
    urgencia = 3;
    const atraso = Math.abs(kmRestante);
    badgeLabel = atraso > 0 ? `Troca Vencida há ${atraso.toLocaleString('pt-BR')} km!` : 'Troca Vencida!';
    statusText = `Atenção: limite ultrapassado em ${atraso.toLocaleString('pt-BR')} km. Realize a troca imediatamente.`;
  } else if (percentualDesgaste >= 80 || kmRestante < 1000) {
    status = 'atencao';
    urgencia = 2;
    badgeLabel = 'Programar Revisão';
    statusText = `Faltam apenas ${kmRestante.toLocaleString('pt-BR')} km para a troca (Trocar aos ${trocarAosKm.toLocaleString('pt-BR')} km)`;
  }

  return {
    key,
    nome: item.nome,
    intervalo_km: item.intervalo_km,
    ultimo_km: item.ultimo_km,
    ultima_data: item.ultima_data,
    kmRodadoDesdeATroca,
    kmRestante,
    trocarAosKm,
    percentualDesgaste,
    status,
    badgeLabel,
    statusText,
    urgencia,
  };
}

/**
 * Retorna o alerta mais urgente de manutenção preventiva para exibir na tela inicial
 */
export function getMostUrgentMaintenanceAlert(
  vehicle: Vehicle | null,
  kmAtual: number
): ComponentHealthInfo | null {
  if (!vehicle) return null;

  const normalized = normalizePreventiveMaintenanceData(vehicle.manutencao_preventiva, kmAtual);
  const keys: PreventiveItemKey[] = ['oleo_motor', 'pastilhas_freio', 'pneus', 'correia_dentada'];

  const healthList = keys.map((key) => calculateComponentHealth(key, normalized[key], kmAtual));

  // Filtra itens com atenção ou vencidos
  const alerts = healthList.filter((item) => item.status === 'vencido' || item.status === 'atencao');

  if (alerts.length === 0) return null;

  // Ordena pelo mais urgente (3 > 2), depois pelo que tiver menor KM restante
  alerts.sort((a, b) => {
    if (b.urgencia !== a.urgencia) {
      return b.urgencia - a.urgencia;
    }
    return a.kmRestante - b.kmRestante;
  });

  return alerts[0];
}
