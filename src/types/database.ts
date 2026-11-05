export type UserRole = 'admin' | 'driver';
export type UserStatus = 'active' | 'inactive';
export type PaymentCycleType = 'quinzenal' | 'mensal';

export interface Profile {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatar_url?: string | null;
  telefone?: string | null;
  cpf_cnpj?: string | null;
  chave_pix?: string | null;
  transportadora?: string | null;
  rota?: string | null;
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  tipo_recebimento?: PaymentCycleType | null;
  dia_pagamento_1?: number | null;
  corte_1_inicio?: number | null;
  corte_1_fim?: number | null;
  dia_pagamento_2?: number | null;
  corte_2_inicio?: number | null;
  corte_2_fim?: number | null;
  created_at?: string;
}

export interface ProfilePaymentConfig {
  tipo_recebimento: PaymentCycleType;
  dia_pagamento_1: number;
  corte_1_inicio: number;
  corte_1_fim: number;
  dia_pagamento_2?: number | null;
  corte_2_inicio?: number | null;
  corte_2_fim?: number | null;
}

export interface Vehicle {
  id: string;
  user_id: string;
  marca: string;
  modelo: string;
  ano: number;
  km_atual: number;
  media_gasolina: number | null;
  media_etanol: number | null;
  media_gnv: number | null;
  created_at?: string;
}

export interface VehicleUpsert {
  user_id: string;
  marca: string;
  modelo: string;
  ano: number;
  km_atual: number;
  media_gasolina: number | null;
  media_etanol: number | null;
  media_gnv: number | null;
}

export interface DailyEarning {
  id: string;
  user_id: string;
  data: string;
  qtd_pecas: number;
  valor_unitario_peca: number;
  valor_extra_bonus: number;
  faturamento_bruto: number;
  km_rodado: number;
  observacoes: string | null;
  created_at?: string;
}

export interface DailyEarningInsert {
  user_id: string;
  data: string;
  qtd_pecas: number;
  valor_unitario_peca: number;
  valor_extra_bonus: number;
  km_rodado: number;
  observacoes?: string | null;
  // NOTE: faturamento_bruto is GENERATED ALWAYS in PostgreSQL. Never send it on insert!
}

export type FuelType = 'gasolina' | 'etanol' | 'gnv';

export interface FuelLog {
  id: string;
  user_id: string;
  data: string;
  tipo_combustivel: FuelType;
  valor_total_abastecido: number;
  preco_por_litro_ou_m3: number;
  litros_calculados: number;
  km_odometro: number;
  created_at?: string;
}

export interface FuelLogInsert {
  user_id: string;
  data: string;
  tipo_combustivel: FuelType;
  valor_total_abastecido: number;
  preco_por_litro_ou_m3: number;
  km_odometro: number;
  // NOTE: litros_calculados is GENERATED ALWAYS in PostgreSQL. Do NOT send it!
}

export interface MaintenanceLog {
  id: string;
  user_id: string;
  data: string;
  oficina_nome: string;
  descricao_servico: string;
  valor_pecas: number;
  valor_mao_de_obra: number;
  valor_total: number;
  garantia_ate: string | null;
  comprovante_url: string | null;
  created_at?: string;
}

export interface MaintenanceLogInsert {
  user_id: string;
  data: string;
  oficina_nome: string;
  descricao_servico: string;
  valor_pecas: number;
  valor_mao_de_obra: number;
  garantia_ate?: string | null;
  comprovante_url?: string | null;
  // NOTE: valor_total is GENERATED ALWAYS in PostgreSQL. Do NOT send it!
}
