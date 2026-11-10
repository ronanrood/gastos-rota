import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gauge,
  Wrench,
  Droplets,
  Disc,
  CircleDot,
  Cog,
  CheckCircle2,
  AlertTriangle,
  Settings,
  X,
  DollarSign,
  CreditCard,
  Pencil,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type {
  Vehicle,
  PreventiveMaintenanceData,
  PreventiveMaintenanceItem,
  MaintenanceStatus,
  PaymentMethod,
} from '../../types/database';
import {
  calculateComponentHealth,
  normalizePreventiveMaintenanceData,
  type PreventiveItemKey,
  type ComponentHealthInfo,
} from '../../utils/vehicleHealth';
import { triggerSuccessCelebration } from '../../lib/celebrate';
import { AnimatedCounter } from '../common/AnimatedCounter';
import { modalBackdropVariants, modalContentVariants } from '../common/MotionVariants';
import { SwipeableCarousel } from '../common/SwipeableCarousel';

interface VehicleHealthPanelProps {
  vehicle: Vehicle | null;
  userId: string;
  onVehicleUpdated: (updated: Vehicle) => void;
}

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
};

const getTodayString = (): string => new Date().toISOString().split('T')[0];

const ITEM_ICONS: Record<PreventiveItemKey, React.ComponentType<{ className?: string }>> = {
  oleo_motor: Droplets,
  pastilhas_freio: Disc,
  pneus: CircleDot,
  correia_dentada: Cog,
};

export const VehicleHealthPanel: React.FC<VehicleHealthPanelProps> = ({
  vehicle,
  userId,
  onVehicleUpdated,
}) => {
  // Odômetro inteligente estimado
  const [highestFuelKm, setHighestFuelKm] = useState<number>(0);
  const [totalEarningsKm, setTotalEarningsKm] = useState<number>(0);
  const [loadingEstimate, setLoadingEstimate] = useState(true);

  // Modais
  const [isAdjustOdometerOpen, setIsAdjustOdometerOpen] = useState(false);
  const [adjustingKmValue, setAdjustingKmValue] = useState<string>('');

  const [configuringItem, setConfiguringItem] = useState<{
    key: PreventiveItemKey;
    info: ComponentHealthInfo;
  } | null>(null);

  const [replacingItem, setReplacingItem] = useState<{
    key: PreventiveItemKey;
    info: ComponentHealthInfo;
  } | null>(null);

  // Busca dados de abastecimentos e ganhos para cálculo do odômetro inteligente
  useEffect(() => {
    let isMounted = true;
    const fetchOdometerData = async () => {
      if (!userId) {
        if (isMounted) setLoadingEstimate(false);
        return;
      }
      try {
        // 1. Maior odômetro registrado em abastecimentos
        const { data: maxFuelData } = await supabase
          .from('fuel_logs')
          .select('km_odometro')
          .eq('user_id', userId)
          .order('km_odometro', { ascending: false })
          .limit(1);

        if (isMounted && maxFuelData && maxFuelData.length > 0) {
          setHighestFuelKm(maxFuelData[0].km_odometro || 0);
        }

        // 2. Soma de todos os KM rodados lançados em diárias
        const { data: earningsKmData } = await supabase
          .from('daily_earnings')
          .select('km_rodado')
          .eq('user_id', userId);

        if (isMounted && earningsKmData) {
          const sumKm = earningsKmData.reduce((acc, curr) => acc + (curr.km_rodado || 0), 0);
          setTotalEarningsKm(sumKm);
        }
      } catch (err) {
        console.warn('Erro ao calcular odômetro inteligente:', err);
      } finally {
        if (isMounted) {
          setLoadingEstimate(false);
        }
      }
    };

    fetchOdometerData();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Odômetro real inteligente
  const kmOdometroReal = useMemo(() => {
    const vehKm = vehicle?.km_atual || 0;
    const initialKm = vehicle?.km_inicial_cadastro || 0;
    const calculatedFromEarnings = initialKm + totalEarningsKm;

    return Math.max(vehKm, highestFuelKm, calculatedFromEarnings);
  }, [vehicle?.km_atual, vehicle?.km_inicial_cadastro, highestFuelKm, totalEarningsKm]);

  // Normaliza os 4 componentes
  const componentsData = useMemo(() => {
    if (!vehicle) return null;
    return normalizePreventiveMaintenanceData(vehicle.manutencao_preventiva, kmOdometroReal);
  }, [vehicle, kmOdometroReal]);

  // Calcula indicadores para os 4 componentes
  const healthList: ComponentHealthInfo[] = useMemo(() => {
    if (!componentsData) return [];
    const keys: PreventiveItemKey[] = ['oleo_motor', 'pastilhas_freio', 'pneus', 'correia_dentada'];
    return keys.map((k) => calculateComponentHealth(k, componentsData[k], kmOdometroReal));
  }, [componentsData, kmOdometroReal]);

  // Contadores de status
  const summaryCounts = useMemo(() => {
    const vencidos = healthList.filter((h) => h.status === 'vencido').length;
    const atencao = healthList.filter((h) => h.status === 'atencao').length;
    const saudaveis = healthList.filter((h) => h.status === 'saudavel').length;
    return { vencidos, atencao, saudaveis };
  }, [healthList]);

  // Salvar novo odômetro manual
  const handleSaveAdjustedOdometer = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(adjustingKmValue.replace(',', '.'));
    if (isNaN(num) || num < 0 || !vehicle) return;

    try {
      const { data, error } = await supabase
        .from('vehicles')
        .update({ km_atual: Number(num.toFixed(1)) })
        .eq('id', vehicle.id)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        onVehicleUpdated(data as Vehicle);
      }
      setIsAdjustOdometerOpen(false);
      triggerSuccessCelebration({ particleCount: 25 });
    } catch (err) {
      console.error('Erro ao salvar odômetro manual:', err);
      alert('Não foi possível salvar o novo odômetro. Tente novamente.');
    }
  };

  // Salvar configuração de intervalo/KM de um componente
  const handleSaveComponentConfig = async (
    key: PreventiveItemKey,
    updatedItem: PreventiveMaintenanceItem
  ) => {
    if (!vehicle) return;

    const currentPreventive: PreventiveMaintenanceData = vehicle.manutencao_preventiva || {};
    const nextPreventive: PreventiveMaintenanceData = {
      ...currentPreventive,
      [key]: updatedItem,
    };

    try {
      const { data, error } = await supabase
        .from('vehicles')
        .update({ manutencao_preventiva: nextPreventive })
        .eq('id', vehicle.id)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        onVehicleUpdated(data as Vehicle);
      }
      setConfiguringItem(null);
      triggerSuccessCelebration({ particleCount: 30 });
    } catch (err) {
      console.error('Erro ao atualizar configuração da manutenção:', err);
      alert('Não foi possível salvar as configurações do componente.');
    }
  };

  // Confirmar que realizou a troca (com opção de lançar na oficina)
  const handleConfirmReplacement = async (
    key: PreventiveItemKey,
    info: ComponentHealthInfo,
    expenseData?: {
      saveExpense: boolean;
      valorTotal: number;
      formaPagamento: PaymentMethod;
      qtdParcelas: number;
      oficinaNome?: string;
    }
  ) => {
    if (!vehicle) return;

    const today = getTodayString();
    const currentPreventive: PreventiveMaintenanceData = vehicle.manutencao_preventiva || {};
    const updatedItem: PreventiveMaintenanceItem = {
      nome: info.nome,
      intervalo_km: info.intervalo_km,
      ultimo_km: kmOdometroReal,
      ultima_data: today,
    };

    const nextPreventive: PreventiveMaintenanceData = {
      ...currentPreventive,
      [key]: updatedItem,
    };

    try {
      // 1. Atualiza vehicle no Supabase zerando a barra do componente
      const { data: vUpdated, error: vError } = await supabase
        .from('vehicles')
        .update({ manutencao_preventiva: nextPreventive })
        .eq('id', vehicle.id)
        .select()
        .single();

      if (vError) throw vError;

      // 2. Se o usuário marcou para lançar o gasto na aba Oficina
      if (expenseData?.saveExpense && expenseData.valorTotal > 0) {
        const payload = {
          user_id: userId,
          data: today,
          oficina_nome: expenseData.oficinaNome?.trim() || 'Revisão Preventiva',
          descricao_servico: `${info.nome} - Troca realizada aos ${kmOdometroReal.toLocaleString('pt-BR')} km`,
          status: 'realizado' as MaintenanceStatus,
          valor_pecas: Number(expenseData.valorTotal.toFixed(2)),
          valor_mao_de_obra: 0,
          valor_total: Number(expenseData.valorTotal.toFixed(2)),
          forma_pagamento: expenseData.formaPagamento,
          qtd_parcelas: expenseData.qtdParcelas,
          valor_parcela: Number((expenseData.valorTotal / expenseData.qtdParcelas).toFixed(2)),
          mes_primeira_parcela: today,
        };

        const { error: mError } = await supabase.from('maintenance_logs').insert(payload);
        if (mError) {
          console.warn('Erro ao salvar gasto na oficina:', mError);
        }
      }

      if (vUpdated) {
        onVehicleUpdated(vUpdated as Vehicle);
      }

      setReplacingItem(null);
      triggerSuccessCelebration();
    } catch (err) {
      console.error('Erro ao registrar troca de componente:', err);
      alert('Não foi possível registrar a troca. Tente novamente.');
    }
  };

  if (!vehicle) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto">
          <Wrench className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-white">Nenhum Veículo Cadastrado</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Cadastre seu carro na aba <strong>Meu Veículo</strong> para habilitar o monitoramento de
          saúde preventiva e acompanhamento de trocas por quilometragem.
        </p>
        <a
          href="#veiculo"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition active:scale-95 shadow-md shadow-teal-500/20"
        >
          <span>Ir para Meu Veículo</span>
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* CARD DO TOPO: ODÔMETRO INTELIGENTE E RESUMO DE SAÚDE */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/40 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-teal-500/25 shrink-0">
              <Gauge className="w-6 h-6 stroke-[2.3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Saúde do Veículo & Preventivas
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                  Por KM
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {vehicle.marca} {vehicle.modelo} ({vehicle.ano})
              </p>
            </div>
          </div>

          {/* Chips de Resumo de Saúde */}
          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center text-[11px] font-bold">
            {summaryCounts.vencidos > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{summaryCounts.vencidos} Vencido</span>
              </span>
            )}
            {summaryCounts.atencao > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{summaryCounts.atencao} Programar</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{summaryCounts.saudaveis} Saudáveis</span>
            </span>
          </div>
        </div>

        {/* Visor do Odômetro Atual com Botão de Ajuste Rápido */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Odômetro Atual Estimado (Painel do Carro)
            </span>
            <div className="text-3xl sm:text-4xl font-black text-white font-mono mt-1 tracking-tight flex items-baseline gap-2">
              <AnimatedCounter value={kmOdometroReal} decimals={0} />
              <span className="text-base font-normal text-slate-400">km</span>
              {loadingEstimate && (
                <span className="text-xs font-sans font-normal text-slate-500 animate-pulse">
                  (sincronizando...)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Atualizado automaticamente pelos seus lançamentos diários de rota e abastecimentos
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => {
              setAdjustingKmValue(kmOdometroReal.toString());
              setIsAdjustOdometerOpen(true);
            }}
            className="self-start sm:self-center inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-750 text-teal-300 text-xs font-bold transition border border-slate-700 shadow-sm cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Ajustar KM do Painel</span>
          </motion.button>
        </div>
      </div>

      {/* CARROSSEL / GRID DOS 4 COMPONENTES DE MANUTENÇÃO PREVENTIVA */}
      <SwipeableCarousel
        totalItems={healthList.length}
        gridClassName="md:grid-cols-2 md:gap-4"
      >
        {healthList.map((item) => {
          const Icon = ITEM_ICONS[item.key] || Wrench;
          const isVencido = item.status === 'vencido';
          const isAtencao = item.status === 'atencao';

          return (
            <motion.div
              key={item.key}
              layout
              className={`min-w-[85vw] sm:min-w-[320px] snap-center shrink-0 md:min-w-0 md:w-auto rounded-3xl p-5 border transition-all duration-300 flex flex-col justify-between space-y-4 shadow-lg ${
                isVencido
                  ? 'bg-gradient-to-br from-slate-900 via-rose-950/30 to-slate-950 border-rose-500/50 ring-1 ring-rose-500/30'
                  : isAtencao
                  ? 'bg-gradient-to-br from-slate-900 via-amber-950/25 to-slate-950 border-amber-500/50 ring-1 ring-amber-500/30'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Cabeçalho do Card */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                        isVencido
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : isAtencao
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                      }`}
                    >
                      <Icon className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                        {item.nome}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Última troca: {item.ultimo_km.toLocaleString('pt-BR')} km ({formatDate(item.ultima_data)})
                      </p>
                    </div>
                  </div>

                  {/* Badge de Status */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                      isVencido
                        ? 'bg-rose-500 text-white animate-pulse shadow-sm shadow-rose-500/30'
                        : isAtencao
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {item.badgeLabel}
                  </span>
                </div>

                {/* Barra de Desgaste Animada com framer-motion */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Desgaste:</span>
                    <span
                      className={`font-bold ${
                        isVencido ? 'text-rose-400' : isAtencao ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {item.percentualDesgaste}% usado
                    </span>
                  </div>

                  <div className="w-full bg-slate-950 rounded-full h-2.5 p-0.5 border border-slate-800 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.percentualDesgaste}%` }}
                      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                      className={`h-full rounded-full ${
                        isVencido
                          ? 'bg-gradient-to-r from-rose-500 to-red-600 animate-pulse'
                          : isAtencao
                          ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                          : 'bg-gradient-to-r from-teal-500 to-emerald-400'
                      }`}
                    />
                  </div>

                  <p
                    className={`text-[11px] font-medium pt-1 ${
                      isVencido ? 'text-rose-300 font-bold' : isAtencao ? 'text-amber-300' : 'text-slate-300'
                    }`}
                  >
                    {item.statusText}
                  </p>
                </div>

                {/* Métricas do Componente */}
                <div className="mt-3.5 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-sans">
                      Rodados na peça
                    </span>
                    <strong className="text-white text-xs">
                      {item.kmRodadoDesdeATroca.toLocaleString('pt-BR')} km
                    </strong>
                  </div>
                  <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-sans">
                      Intervalo padrão
                    </span>
                    <strong className="text-teal-300 text-xs">
                      a cada {item.intervalo_km.toLocaleString('pt-BR')} km
                    </strong>
                  </div>
                </div>
              </div>

              {/* Ações Rápidas do Card */}
              <div className="pt-2 flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => setConfiguringItem({ key: item.key, info: item })}
                  className="px-3 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 border border-slate-700/80"
                  title="Configurar KM da última troca e intervalo"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configurar</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => setReplacingItem({ key: item.key, info: item })}
                  className={`flex-1 py-2 px-3 min-h-[40px] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                    isVencido
                      ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/25'
                      : isAtencao
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-amber-500/25'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-emerald-500/20'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.3]" />
                  <span>Já Troquei → Zerar</span>
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </SwipeableCarousel>

      {/* ========================================================================= */}
      {/* MODAL 1: AJUSTAR ODÔMETRO MANUAL DO PAINEL                                */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAdjustOdometerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              variants={modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setIsAdjustOdometerOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              variants={modalContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center font-bold">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Ajustar Odômetro do Painel</h3>
                    <p className="text-xs text-slate-400">Sincronize com o painel físico do seu carro</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdjustOdometerOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAdjustedOdometer} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    KM Atual no Painel do Carro
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={adjustingKmValue}
                      onChange={(e) => setAdjustingKmValue(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-base focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      placeholder="Ex: 125400"
                      required
                    />
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 text-xs font-bold pointer-events-none">
                      km
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Ao atualizar o odômetro, todas as barras de manutenção preventiva são recalculadas imediatamente.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAdjustOdometerOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                  >
                    Cancelar
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-black transition cursor-pointer shadow-md shadow-teal-500/20"
                  >
                    Salvar Novo Odômetro
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIGURAR COMPONENTE (ÚLTIMO KM E INTERVALO)                     */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {configuringItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              variants={modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setConfiguringItem(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              variants={modalContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center font-bold">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Configurar {configuringItem.info.nome}
                    </h3>
                    <p className="text-xs text-slate-400">Ajuste o odômetro da última troca e a frequência</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfiguringItem(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ConfigureComponentForm
                itemInfo={configuringItem.info}
                onCancel={() => setConfiguringItem(null)}
                onSave={(updated) => handleSaveComponentConfig(configuringItem.key, updated)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: REGISTRAR TROCA REALIZADA COM OPÇÃO DE LANÇAR NA OFICINA          */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {replacingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              variants={modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setReplacingItem(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              variants={modalContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Registrar Troca de {replacingItem.info.nome}
                    </h3>
                    <p className="text-xs text-slate-400">Zere a barra de desgaste e registre a revisão</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplacingItem(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ConfirmReplacementForm
                itemInfo={replacingItem.info}
                currentOdometerKm={kmOdometroReal}
                onCancel={() => setReplacingItem(null)}
                onConfirm={(expense) =>
                  handleConfirmReplacement(replacingItem.key, replacingItem.info, expense)
                }
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// SUB-FORMULÁRIO DE CONFIGURAÇÃO DE INTERVALO
// =============================================================================
interface ConfigureComponentFormProps {
  itemInfo: ComponentHealthInfo;
  onCancel: () => void;
  onSave: (updated: PreventiveMaintenanceItem) => void;
}

const ConfigureComponentForm: React.FC<ConfigureComponentFormProps> = ({
  itemInfo,
  onCancel,
  onSave,
}) => {
  const [ultimoKm, setUltimoKm] = useState<string>(itemInfo.ultimo_km.toString());
  const [intervaloKm, setIntervaloKm] = useState<string>(itemInfo.intervalo_km.toString());
  const [ultimaData, setUltimaData] = useState<string>(itemInfo.ultima_data || getTodayString());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numUltimo = parseFloat(ultimoKm.replace(',', '.'));
    const numIntervalo = parseFloat(intervaloKm.replace(',', '.'));

    if (isNaN(numUltimo) || isNaN(numIntervalo) || numIntervalo <= 0) {
      alert('Informe valores válidos para o odômetro e o intervalo.');
      return;
    }

    onSave({
      nome: itemInfo.nome,
      ultimo_km: Number(numUltimo.toFixed(0)),
      intervalo_km: Number(numIntervalo.toFixed(0)),
      ultima_data: ultimaData || getTodayString(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          KM em que fez a última troca
        </label>
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={ultimoKm}
            onChange={(e) => setUltimoKm(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
            required
          />
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 text-xs font-bold pointer-events-none">
            km
          </span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Intervalo de Troca (Frequência)
        </label>
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            min="100"
            value={intervaloKm}
            onChange={(e) => setIntervaloKm(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
            required
          />
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 text-xs font-bold pointer-events-none">
            km
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Exemplo: Óleo trocado a cada 7.000 km (uso severo) ou 10.000 km (estrada).
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Data da última troca
        </label>
        <input
          type="date"
          value={ultimaData}
          onChange={(e) => setUltimaData(e.target.value)}
          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
          required
        />
      </div>

      <div className="pt-2 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
        >
          Cancelar
        </button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="submit"
          className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-black transition cursor-pointer"
        >
          Salvar Configurações
        </motion.button>
      </div>
    </form>
  );
};

// =============================================================================
// SUB-FORMULÁRIO DE CONFIRMAÇÃO DE TROCA COM INTEGRAÇÃO DE OFICINA
// =============================================================================
interface ConfirmReplacementFormProps {
  itemInfo: ComponentHealthInfo;
  currentOdometerKm: number;
  onCancel: () => void;
  onConfirm: (expenseData: {
    saveExpense: boolean;
    valorTotal: number;
    formaPagamento: PaymentMethod;
    qtdParcelas: number;
    oficinaNome?: string;
  }) => void;
}

const ConfirmReplacementForm: React.FC<ConfirmReplacementFormProps> = ({
  itemInfo,
  currentOdometerKm,
  onCancel,
  onConfirm,
}) => {
  const [saveExpense, setSaveExpense] = useState(true);
  const [valorTotal, setValorTotal] = useState<string>('');
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethod>('avista');
  const [qtdParcelas, setQtdParcelas] = useState<number>(1);
  const [oficinaNome, setOficinaNome] = useState<string>('Oficina Mecânica');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(valorTotal.replace(',', '.')) || 0;

    if (saveExpense && val <= 0) {
      alert('Informe o valor pago pela troca do componente para salvar na oficina.');
      return;
    }

    onConfirm({
      saveExpense,
      valorTotal: val,
      formaPagamento,
      qtdParcelas: formaPagamento === 'parcelado' ? qtdParcelas : 1,
      oficinaNome,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      {/* Card Informativo do Odômetro Zerado */}
      <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-1">
        <p className="font-extrabold text-white text-sm flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Troca será registrada aos {currentOdometerKm.toLocaleString('pt-BR')} km</span>
        </p>
        <p className="text-slate-400 text-[11px]">
          A data será registrada como hoje ({formatDate(getTodayString())}) e o desgaste de {itemInfo.nome} será zerado para 0% verde.
        </p>
      </div>

      {/* Checkbox: Lançar gasto na oficina */}
      <div
        onClick={() => setSaveExpense(!saveExpense)}
        className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5">
          <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <p className="font-bold text-white">Salvar gasto na aba Oficina (maintenance_logs)?</p>
            <p className="text-[11px] text-slate-400">
              Registra automaticamente a nota fiscal/gasto sem precisar redigitar na aba Oficina
            </p>
          </div>
        </div>
        <input
          type="checkbox"
          checked={saveExpense}
          onChange={(e) => setSaveExpense(e.target.checked)}
          className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400"
        />
      </div>

      {/* Campos de Despesa da Oficina se checkbox ativo */}
      {saveExpense && (
        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 animate-in fade-in duration-200">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Valor Total Pago (Peças + Mão de Obra)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">
                R$
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
                placeholder="0,00"
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required={saveExpense}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nome da Oficina / Auto Peças (Opcional)
            </label>
            <input
              type="text"
              value={oficinaNome}
              onChange={(e) => setOficinaNome(e.target.value)}
              placeholder="Ex: Auto Mecânica Silva"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Forma de Pagamento */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Forma de Pagamento
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormaPagamento('avista')}
                className={`py-2 px-3 rounded-xl font-bold transition text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                  formaPagamento === 'avista'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>À Vista (PIX/Débito)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormaPagamento('parcelado')}
                className={`py-2 px-3 rounded-xl font-bold transition text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                  formaPagamento === 'parcelado'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Parcelado (Cartão)</span>
              </button>
            </div>
          </div>

          {formaPagamento === 'parcelado' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Quantidade de Parcelas
              </label>
              <select
                value={qtdParcelas}
                onChange={(e) => setQtdParcelas(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => {
                  const val = parseFloat(valorTotal.replace(',', '.')) || 0;
                  const parcelaVal = val > 0 ? val / n : 0;
                  return (
                    <option key={n} value={n}>
                      {n}x de {formatCurrency(parcelaVal)}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Botões Finais */}
      <div className="pt-2 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
        >
          Cancelar
        </button>
        <motion.button
          whileTap={{ scale: 0.96 }}
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition cursor-pointer shadow-md shadow-emerald-500/25 flex items-center gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4 stroke-[2.4]" />
          <span>Confirmar Troca</span>
        </motion.button>
      </div>
    </form>
  );
};
