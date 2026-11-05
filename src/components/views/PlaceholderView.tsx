import React from 'react';
import { type ViewType } from '../layout/Drawer';
import { BarChart3, Fuel, Wrench, Car, ShieldCheck, ArrowLeft, Clock, User } from 'lucide-react';

interface PlaceholderViewProps {
  view: ViewType;
  onGoToEarnings: () => void;
}

const VIEW_CONFIG: Record<
  Exclude<ViewType, 'earnings'>,
  {
    title: string;
    description: string;
    table: string;
    icon: React.ElementType;
    color: string;
    features: string[];
  }
> = {
  dashboard: {
    title: 'Dashboard Financeiro',
    description: 'Visão consolidada de lucros, custos com combustível, manutenção e rentabilidade líquida por rota.',
    table: 'Consolidação de daily_earnings, fuel_logs e maintenance_logs',
    icon: BarChart3,
    color: 'emerald',
    features: [
      'Gráficos de evolução de faturamento e quilometragem',
      'Cálculo de Lucro Líquido Real (Faturamento - Combustível - Manutenção)',
      'Rentabilidade média por quilômetro rodado',
      'Filtros por semana, mês ou período personalizado',
    ],
  },
  fuel: {
    title: 'Controle de Combustível',
    description: 'Registre cada abastecimento e acompanhe o consumo real do veículo em km/l ou km/m³.',
    table: 'Tabela fuel_logs',
    icon: Fuel,
    color: 'amber',
    features: [
      'Registro de abastecimento (Gasolina, Etanol ou GNV)',
      'Preço por litro e total pago',
      'Cálculo automático de litros e consumo médio',
      'Histórico de odômetro e alertas de consumo excessivo',
    ],
  },
  maintenance: {
    title: 'Oficina e Manutenção',
    description: 'Gestão preventiva e corretiva com upload de notas fiscais e comprovantes de serviço.',
    table: 'Tabela maintenance_logs e bucket comprovantes_oficina',
    icon: Wrench,
    color: 'blue',
    features: [
      'Registro de oficinas, peças e mão de obra',
      'Upload de comprovantes direto para o Storage do Supabase',
      'Acompanhamento de prazos de garantia de peças',
      'Histórico completo de revisões do veículo',
    ],
  },
  vehicle: {
    title: 'Meu Veículo',
    description: 'Gerenciamento das especificações e histórico do veículo em atividade.',
    table: 'Tabela vehicles',
    icon: Car,
    color: 'purple',
    features: [
      'Cadastro de marca, modelo, ano e odômetro atual',
      'Configuração das médias esperadas por tipo de combustível',
      'Monitoramento de desgaste preventivo por km',
    ],
  },
  profile: {
    title: 'Meu Perfil',
    description: 'Gerenciamento de dados cadastrais, operacionais, chave PIX e segurança.',
    table: 'Tabela profiles e bucket avatars',
    icon: User,
    color: 'emerald',
    features: [
      'Foto de perfil e dados de identificação',
      'Transportadora, rota e chave PIX',
      'Endereço completo com busca por CEP',
      'Alteração de e-mail e senha de acesso',
    ],
  },
  admin: {
    title: 'Painel do Administrador',
    description: 'Área restrita de controle operacional e gerenciamento de motoristas cadastrados.',
    table: 'Tabela profiles e relatórios gerais',
    icon: ShieldCheck,
    color: 'rose',
    features: [
      'Listagem de motoristas cadastrados e status (ativo/inativo)',
      'Alteração de permissões e controle de acesso',
      'Consolidado geral de faturamento e produção da frota',
    ],
  },
};

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({
  view,
  onGoToEarnings,
}) => {
  if (view === 'earnings') return null;

  const config = VIEW_CONFIG[view];
  const Icon = config.icon;

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-8">
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Módulo do Sistema
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {config.title}
              </h2>
            </div>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Pronto para expansão
          </span>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          {config.description}
        </p>

        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 mb-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Estrutura no Supabase Vinculada
          </h4>
          <code className="text-xs text-emerald-400 font-mono block">
            {config.table}
          </code>
        </div>

        <div className="space-y-2 mb-8">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Recursos deste módulo:
          </h4>
          {config.features.map((feature, i) => (
            <div key={i} className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-300">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onGoToEarnings}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Lançamentos Diários
          </button>
        </div>
      </div>
    </div>
  );
};

