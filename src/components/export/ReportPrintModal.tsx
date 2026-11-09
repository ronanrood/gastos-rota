import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Printer,
  X,
  Share2,
  Copy,
  Check,
  FileText,
  SlidersHorizontal,
  Sparkles,
  Package,
  DollarSign,
  Fuel,
  Wrench,
  Gauge,
  CreditCard,
  Calendar,
  CheckCircle2,
  MessageSquare,
  Eye,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import type { DailyEarning, FuelLog, MaintenanceLog, Profile, Vehicle } from '../../types/database';
import {
  formatCurrency,
  formatDateBR,
  formatDateTimeNow,
  copyToClipboard,
  openWhatsAppShare,
  type CustomReportConfig,
  type CustomReportPreset,
  PRESET_CONFIGS,
  getMatchingPreset,
  generateCustomWhatsAppText,
} from '../../utils/exportUtils';
import { calculatePeriodMaintenanceExpenses } from '../../utils/maintenanceInstallments';

export type ReportType = 'earnings' | 'fuel' | 'maintenance' | 'dashboard';

export interface ReportPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportType;
  profile: Profile | null;
  vehicle?: Vehicle | null;
  periodLabel: string;
  paymentNotice?: string;
  earningsItems?: DailyEarning[];
  fuelItems?: FuelLog[];
  maintenanceItems?: MaintenanceLog[];
  dashboardData?: {
    faturamentoBruto: number;
    despesasCombustivel: number;
    despesasOficina: number;
    despesasTotais: number;
    lucroLiquidoReal: number;
    totalKmRodados: number;
    diasProducao: number;
    margemLucro: number;
    dailyData?: Array<{
      dateRaw: string;
      data: string;
      faturamento: number;
      despesas: number;
      lucro: number;
    }>;
  };
  startDate?: string | null;
  endDate?: string | null;
  defaultPreset?: CustomReportPreset;
}

export const ReportPrintModal: React.FC<ReportPrintModalProps> = ({
  isOpen,
  onClose,
  reportType,
  profile,
  vehicle,
  periodLabel,
  paymentNotice,
  earningsItems = [],
  fuelItems = [],
  maintenanceItems = [],
  dashboardData,
  startDate,
  endDate,
  defaultPreset,
}) => {
  const { user } = useAuth();
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Determinar preset inicial inteligente baseado no contexto
  const initialPreset: Exclude<CustomReportPreset, 'custom'> = useMemo(() => {
    if (defaultPreset && defaultPreset !== 'custom') return defaultPreset;
    if (reportType === 'earnings') return 'cobranca_transportadora';
    if (reportType === 'fuel' || reportType === 'maintenance') return 'apenas_despesas';
    return 'completo';
  }, [defaultPreset, reportType]);

  // Configuração ativa de blocos
  const [config, setConfig] = useState<CustomReportConfig>(() => PRESET_CONFIGS[initialPreset]);

  // Modo de pré-visualização no modal: WhatsApp vs Folha PDF
  const [previewTab, setPreviewTab] = useState<'whatsapp' | 'pdf'>('whatsapp');

  // Ajusta configuração de preset se o preset inicial mudar
  const [prevInitialPreset, setPrevInitialPreset] = useState(initialPreset);
  if (prevInitialPreset !== initialPreset) {
    setPrevInitialPreset(initialPreset);
    setConfig(PRESET_CONFIGS[initialPreset]);
  }

  // Estados de feedback
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estados assíncronos caso o usuário ative uma categoria que não foi pré-carregada na tela atual
  const [extraFuel, setExtraFuel] = useState<FuelLog[]>([]);
  const [extraMaintenance, setExtraMaintenance] = useState<MaintenanceLog[]>([]);
  const [extraEarnings, setExtraEarnings] = useState<DailyEarning[]>([]);

  // Tecla ESC para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Carregamento sob demanda se o usuário marcar combustível e não houver itens fornecidos
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    if (config.includeCombustivel && fuelItems.length === 0 && extraFuel.length === 0) {
      let query = supabase.from('fuel_logs').select('*').eq('user_id', user.id);
      if (startDate) query = query.gte('data', startDate);
      if (endDate) query = query.lte('data', endDate);
      query.order('data', { ascending: true }).then(({ data }) => {
        if (data) setExtraFuel(data);
      });
    }

    if (config.includeOficina && maintenanceItems.length === 0 && extraMaintenance.length === 0) {
      let query = supabase.from('maintenance_logs').select('*').eq('user_id', user.id);
      if (startDate) query = query.gte('data', startDate);
      if (endDate) query = query.lte('data', endDate);
      query.order('data', { ascending: true }).then(({ data }) => {
        if (data) setExtraMaintenance(data);
      });
    }

    if (config.includeGanhos && earningsItems.length === 0 && extraEarnings.length === 0) {
      let query = supabase.from('daily_earnings').select('*').eq('user_id', user.id);
      if (startDate) query = query.gte('data', startDate);
      if (endDate) query = query.lte('data', endDate);
      query.order('data', { ascending: true }).then(({ data }) => {
        if (data) setExtraEarnings(data);
      });
    }
  }, [
    isOpen,
    user?.id,
    config.includeCombustivel,
    config.includeOficina,
    config.includeGanhos,
    fuelItems.length,
    extraFuel.length,
    maintenanceItems.length,
    extraMaintenance.length,
    earningsItems.length,
    extraEarnings.length,
    startDate,
    endDate,
  ]);

  if (!isOpen) return null;

  // Itens consolidados
  const effectiveEarnings = earningsItems.length > 0 ? earningsItems : extraEarnings;
  const effectiveFuel = fuelItems.length > 0 ? fuelItems : extraFuel;
  const effectiveMaintenance = maintenanceItems.length > 0 ? maintenanceItems : extraMaintenance;

  // Preset ativo correspondente
  const activePreset = getMatchingPreset(config);

  // Manipulador de troca de Preset
  const handleSelectPreset = (preset: Exclude<CustomReportPreset, 'custom'>) => {
    setConfig(PRESET_CONFIGS[preset]);
  };

  // Manipulador de alternância individual de checkbox
  const handleToggleBlock = (key: keyof CustomReportConfig) => {
    setConfig((prev) => {
      const nextVal = !prev[key];
      const updated = { ...prev, [key]: nextVal };
      // Se desmarcar ganhos gerais, desmarca detalhamento dia a dia
      if (key === 'includeGanhos' && !nextVal) {
        updated.includeDetalhamentoGanhos = false;
      }
      return updated;
    });
  };

  // Cálculos Consolidados
  const sortedEarnings = [...effectiveEarnings].sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  const calcFaturamento = sortedEarnings.reduce((acc, curr) => {
    const val =
      typeof curr.faturamento_bruto === 'number'
        ? curr.faturamento_bruto
        : (curr.qtd_pecas || 0) * (curr.valor_unitario_peca || 0) + (curr.valor_extra_bonus || 0);
    return acc + val;
  }, 0);
  const faturamentoBruto = dashboardData?.faturamentoBruto ?? calcFaturamento;
  const diasProducao = dashboardData?.diasProducao ?? sortedEarnings.length;
  const totalPecas = sortedEarnings.reduce((acc, curr) => acc + (curr.qtd_pecas || 0), 0);
  const totalBonus = sortedEarnings.reduce((acc, curr) => acc + (curr.valor_extra_bonus || 0), 0);
  const calcKmEarnings = sortedEarnings.reduce((acc, curr) => acc + (curr.km_rodado || 0), 0);
  const totalKmRodados = dashboardData?.totalKmRodados ?? calcKmEarnings;

  // Combustível
  const calcCombustivel = effectiveFuel.reduce((acc, curr) => acc + (curr.valor_total_abastecido || 0), 0);
  const despesasCombustivel = dashboardData?.despesasCombustivel ?? calcCombustivel;
  const totalLitros = effectiveFuel.reduce((acc, curr) => {
    const l =
      typeof curr.litros_calculados === 'number'
        ? curr.litros_calculados
        : (curr.valor_total_abastecido || 0) / (curr.preco_por_litro_ou_m3 || 1);
    return acc + (isNaN(l) ? 0 : l);
  }, 0);
  const precoMedioLitro = totalLitros > 0 ? despesasCombustivel / totalLitros : 0;

  // Oficina (com cálculo de parcelas inteligentes)
  const maintenanceExpenses = calculatePeriodMaintenanceExpenses(effectiveMaintenance, {
    startDate,
    endDate,
  });
  const despesasOficina = dashboardData?.despesasOficina ?? maintenanceExpenses.totalExpenses;
  const parcelasTotal = maintenanceExpenses.parcelasTotal;
  const activeInstallmentsCount = maintenanceExpenses.activeInstallmentsCount;
  const futureCommittedTotal = maintenanceExpenses.futureCommittedTotal;

  // Totais e Lucro
  const despesasTotais = dashboardData?.despesasTotais ?? (despesasCombustivel + despesasOficina);
  const lucroLiquidoReal = dashboardData?.lucroLiquidoReal ?? (faturamentoBruto - despesasTotais);
  const margemLucro =
    dashboardData?.margemLucro ?? (faturamentoBruto > 0 ? (lucroLiquidoReal / faturamentoBruto) * 100 : 0);
  const ganhoKm = totalKmRodados > 0 ? faturamentoBruto / totalKmRodados : 0;
  const lucroKm = totalKmRodados > 0 ? lucroLiquidoReal / totalKmRodados : 0;

  // Texto formatado para o WhatsApp com base na configuração ativa
  const customWhatsAppText = generateCustomWhatsAppText({
    profile,
    vehicle,
    periodLabel,
    paymentNotice,
    config,
    earningsItems: effectiveEarnings,
    fuelItems: effectiveFuel,
    maintenanceItems: effectiveMaintenance,
    totals: {
      faturamentoBruto,
      diasProducao,
      totalPecas,
      totalBonus,
      totalKmRodados,
      despesasCombustivel,
      totalLitros,
      precoMedioLitro,
      despesasOficina,
      parcelasTotal,
      activeInstallmentsCount,
      futureCommittedTotal,
      despesasTotais,
      lucroLiquidoReal,
      margemLucro,
    },
  });

  const handleCopy = async () => {
    const success = await copyToClipboard(customWhatsAppText);
    if (success) {
      setCopied(true);
      setToastMessage('Texto copiado com sucesso! Pronto para colar no WhatsApp.');
      setTimeout(() => {
        setCopied(false);
        setToastMessage(null);
      }, 3500);
    }
  };

  const handleWhatsApp = () => {
    openWhatsAppShare(customWhatsAppText);
  };

  const handlePrint = () => {
    window.print();
  };

  // Título e identificadores contextuais
  let docTitle = 'Extrato Personalizado de Operação';
  let docSubtitle = 'Documento customizado de produção e fechamento de rota';

  if (config.includeGanhos && !config.includeCombustivel && !config.includeOficina && !config.includeLucro) {
    docTitle = 'Fechamento de Rota - Cobrança para Transportadora';
    docSubtitle = 'Comprovante detalhado de diárias, entregas, quilometragem e valor a repassar';
  } else if (!config.includeGanhos && (config.includeCombustivel || config.includeOficina)) {
    docTitle = 'Relatório de Custos e Despesas Operacionais';
    docSubtitle = 'Demonstrativo de gastos com combustível e manutenções do veículo';
  } else if (config.includeLucro) {
    docTitle = 'Extrato Financeiro Consolidado da Operação';
    docSubtitle = 'Visão de faturamento bruto, custos operacionais e margem líquida real';
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Estilos específicos de impressão para forçar documento A4 limpo */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          nav, header, aside, .bottom-nav, .print-hide {
            display: none !important;
          }
          #report-print-container {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 12mm !important;
            background: white !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .page-break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Modal Wrapper */}
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:rounded-none print:bg-white">
        {/* TOPO DO MODAL: TÍTULO, SUBTÍTULO E FECHAR (Oculto na impressão) */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-emerald-500/20 shrink-0">
              <SlidersHorizontal className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Personalizar Relatório
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  WhatsApp & PDF
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Escolha o modelo pronto ou selecione o que deseja exibir para a transportadora
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 min-h-[40px] min-w-[40px] rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="Fechar personalizador"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPO DO MODAL (Scrollável) */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6 print:p-0 print:overflow-visible">
          {/* Toast Informativo */}
          {toastMessage && (
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-2 print:hidden animate-in fade-in duration-200">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* 1. PRESETS RÁPIDOS NO TOPO DO MODAL (Seleção com 1 toque) */}
          <section className="print:hidden space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Modelos Prontos (1 Toque)
              </label>
              {activePreset === 'custom' && (
                <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  Personalização Manual
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Preset 1: Cobrança Transportadora */}
              <button
                type="button"
                onClick={() => handleSelectPreset('cobranca_transportadora')}
                className={`p-3 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[78px] ${
                  activePreset === 'cobranca_transportadora'
                    ? 'bg-emerald-950/60 border-emerald-500 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-500/40'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-base">📦</span>
                  {activePreset === 'cobranca_transportadora' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white leading-tight">
                    Cobrança Transportadora
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                    Só Ganhos Brutos + PIX
                  </div>
                </div>
              </button>

              {/* Preset 2: Apenas Resumo Líquido */}
              <button
                type="button"
                onClick={() => handleSelectPreset('apenas_resumo_liquido')}
                className={`p-3 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[78px] ${
                  activePreset === 'apenas_resumo_liquido'
                    ? 'bg-blue-950/60 border-blue-500 shadow-md shadow-blue-500/20 ring-1 ring-blue-500/40'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-base">💰</span>
                  {activePreset === 'apenas_resumo_liquido' && (
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white leading-tight">
                    Apenas Resumo Líquido
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                    Bruto vs Gastos (sem lista)
                  </div>
                </div>
              </button>

              {/* Preset 3: Apenas Despesas */}
              <button
                type="button"
                onClick={() => handleSelectPreset('apenas_despesas')}
                className={`p-3 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[78px] ${
                  activePreset === 'apenas_despesas'
                    ? 'bg-amber-950/60 border-amber-500 shadow-md shadow-amber-500/20 ring-1 ring-amber-500/40'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-base">🛠️</span>
                  {activePreset === 'apenas_despesas' && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white leading-tight">
                    Apenas Despesas
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                    Combustível + Oficina
                  </div>
                </div>
              </button>

              {/* Preset 4: Relatório Completo */}
              <button
                type="button"
                onClick={() => handleSelectPreset('completo')}
                className={`p-3 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[78px] ${
                  activePreset === 'completo'
                    ? 'bg-teal-950/60 border-teal-500 shadow-md shadow-teal-500/20 ring-1 ring-teal-500/40'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-base">📊</span>
                  {activePreset === 'completo' && (
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white leading-tight">
                    Relatório Completo
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                    Todos os blocos inclusos
                  </div>
                </div>
              </button>
            </div>
          </section>

          {/* 2. CHECKBOXES DE PERSONALIZAÇÃO FINA ("O que incluir no relatório?") */}
          <section className="print:hidden space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              O que incluir no relatório?
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* 1. Ganhos Brutos e Entregas */}
              <div
                onClick={() => handleToggleBlock('includeGanhos')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                  config.includeGanhos
                    ? 'bg-slate-900 border-emerald-500/40 shadow-xs'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      config.includeGanhos ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">Ganhos Brutos e Entregas</p>
                    <p className="text-[10px] text-slate-400 truncate">Faturamento, peças e bônus</p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${
                    config.includeGanhos
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {config.includeGanhos && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* 2. Detalhamento Dia a Dia dos Ganhos */}
              <div
                onClick={() => config.includeGanhos && handleToggleBlock('includeDetalhamentoGanhos')}
                className={`p-3 rounded-2xl border transition-all select-none flex items-center justify-between gap-3 ${
                  !config.includeGanhos
                    ? 'bg-slate-950/40 border-slate-800/40 opacity-40 cursor-not-allowed'
                    : config.includeDetalhamentoGanhos
                    ? 'bg-slate-900 border-emerald-500/40 shadow-xs cursor-pointer'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-70 hover:opacity-100 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      config.includeDetalhamentoGanhos && config.includeGanhos
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">Detalhamento Dia a Dia</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {config.includeGanhos ? 'Lista de cada dia trabalhado' : 'Ative Ganhos Brutos primeiro'}
                    </p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${
                    config.includeDetalhamentoGanhos && config.includeGanhos
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {config.includeDetalhamentoGanhos && config.includeGanhos && (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  )}
                </div>
              </div>

              {/* 3. Despesas de Combustível */}
              <div
                onClick={() => handleToggleBlock('includeCombustivel')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                  config.includeCombustivel
                    ? 'bg-slate-900 border-amber-500/40 shadow-xs'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      config.includeCombustivel ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Fuel className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">Despesas de Combustível</p>
                    <p className="text-[10px] text-slate-400 truncate">Total abastecido, litros e médias</p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${
                    config.includeCombustivel
                      ? 'bg-amber-500 border-amber-400 text-slate-950 font-black'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {config.includeCombustivel && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* 4. Despesas de Oficina e Parcelas */}
              <div
                onClick={() => handleToggleBlock('includeOficina')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                  config.includeOficina
                    ? 'bg-slate-900 border-blue-500/40 shadow-xs'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      config.includeOficina ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">Despesas de Oficina e Parcelas</p>
                    <p className="text-[10px] text-slate-400 truncate">Serviços à vista + parcelas ativas</p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${
                    config.includeOficina
                      ? 'bg-blue-600 border-blue-500 text-white font-bold'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {config.includeOficina && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* 5. Cálculo de Lucro Líquido Real */}
              <div
                onClick={() => handleToggleBlock('includeLucro')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                  config.includeLucro
                    ? 'bg-slate-900 border-emerald-500/40 shadow-xs'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      config.includeLucro ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">Cálculo de Lucro Líquido Real</p>
                    <p className="text-[10px] text-slate-400 truncate">Conta: Bruto - Despesas = Líquido</p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${
                    config.includeLucro
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {config.includeLucro && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* 6. Quilometragem e Médias por KM */}
              <div
                onClick={() => handleToggleBlock('includeKm')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                  config.includeKm
                    ? 'bg-slate-900 border-teal-500/40 shadow-xs'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      config.includeKm ? 'bg-teal-500/20 text-teal-400' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Gauge className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">Quilometragem e Médias por KM</p>
                    <p className="text-[10px] text-slate-400 truncate">KM total rodado e ganho/KM</p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${
                    config.includeKm
                      ? 'bg-teal-600 border-teal-500 text-white'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {config.includeKm && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* 7. Meus Dados e Chave PIX no Rodapé */}
              <div
                onClick={() => handleToggleBlock('includeDadosPix')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none sm:col-span-2 ${
                  config.includeDadosPix
                    ? 'bg-slate-900 border-indigo-500/40 shadow-xs'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      config.includeDadosPix ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      Meus Dados e Chave PIX no Rodapé
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      Nome, CPF/CNPJ, Transportadora, Rota e Chave PIX para pagamento
                    </p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${
                    config.includeDadosPix
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {config.includeDadosPix && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
            </div>
          </section>

          {/* 3. PRÉ-VISUALIZAÇÃO DINÂMICA EM TEMPO REAL */}
          <section className="space-y-3 print:m-0">
            {/* Seletor de Prévia (WhatsApp vs PDF) */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2 print:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-emerald-400" />
                Pré-visualização em Tempo Real
              </span>

              <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setPreviewTab('whatsapp')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    previewTab === 'whatsapp'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('pdf')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    previewTab === 'pdf'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Documento A4</span>
                </button>
              </div>
            </div>

            {/* TAB A: PRÉVIA DO WHATSAPP */}
            {previewTab === 'whatsapp' && (
              <div className="print:hidden space-y-2 animate-in fade-in duration-150">
                <div className="bg-[#0b141a] border border-slate-800 rounded-2xl p-4 sm:p-5 relative shadow-inner">
                  <div className="flex items-center justify-between border-b border-[#202c33] pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#00a884]" />
                      <span className="text-xs font-bold text-[#e9edef] font-sans">
                        Como a mensagem vai chegar no WhatsApp
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#202c33] hover:bg-[#2a3942] text-[#00a884] text-xs font-bold transition cursor-pointer active:scale-95"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>

                  {/* Balão da Mensagem do WhatsApp */}
                  <div className="bg-[#1f2c34] rounded-2xl p-3.5 sm:p-4 text-[#e9edef] text-xs font-mono whitespace-pre-wrap leading-relaxed shadow-md border border-[#2a3942] select-all max-h-[360px] overflow-y-auto">
                    {customWhatsAppText}
                  </div>

                  <p className="text-[11px] text-slate-500 mt-2 italic text-right">
                    💡 Os blocos desmarcados acima não serão incluídos nessa mensagem.
                  </p>
                </div>
              </div>
            )}

            {/* TAB B: FOLHA DE IMPRESSÃO / PDF A4 (Renderiza na tela se previewTab === 'pdf' e SEMPRE no print) */}
            <div
              className={`${
                previewTab === 'pdf' ? 'block' : 'hidden'
              } print:block print:p-0 print:m-0`}
            >
              <div
                id="report-print-container"
                ref={printContainerRef}
                className="bg-white text-slate-900 rounded-2xl shadow-xl p-6 sm:p-8 max-w-3xl mx-auto border border-slate-200 print:shadow-none print:border-none print:p-0 print:max-w-none font-sans"
              >
                {/* CABEÇALHO DO DOCUMENTO COMERCIAL */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-slate-900">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-sm">
                        GR
                      </div>
                      <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase">
                        Gastos Rota
                      </h1>
                    </div>
                    <p className="text-xs font-bold text-emerald-700 tracking-wide mt-0.5">
                      CONTROLE E GESTÃO PROFISSIONAL PARA MOTORISTAS
                    </p>
                    <h2 className="text-sm font-bold text-slate-800 mt-2">{docTitle}</h2>
                    <p className="text-[11px] text-slate-500">{docSubtitle}</p>
                  </div>

                  <div className="text-left sm:text-right text-xs text-slate-600 space-y-1">
                    <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-800 rounded font-mono font-bold text-[11px] border border-slate-200">
                      EXTRATO OFICIAL
                    </span>
                    <p className="text-[11px]">
                      <strong>Emissão:</strong> {formatDateTimeNow()}
                    </p>
                    <p className="text-[11px]">
                      <strong>Período:</strong> {periodLabel}
                    </p>
                    {paymentNotice && (
                      <p className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block">
                        {paymentNotice}
                      </p>
                    )}
                  </div>
                </div>

                {/* GRADE DE IDENTIFICAÇÃO DO MOTORISTA E OPERAÇÃO */}
                <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Motorista
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      {profile?.nome || 'Não informado'}
                    </span>
                  </div>

                  {config.includeDadosPix && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        CPF / CNPJ
                      </span>
                      <span className="font-mono font-semibold text-slate-800">
                        {profile?.cpf_cnpj || 'Não informado'}
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Transportadora
                    </span>
                    <span className="font-semibold text-slate-800">
                      {profile?.transportadora || 'Não informada'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Rota / Região
                    </span>
                    <span className="font-semibold text-slate-800">
                      {profile?.rota || 'Não informada'}
                    </span>
                  </div>

                  {vehicle && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Veículo Vinculado
                      </span>
                      <span className="font-semibold text-slate-800">
                        {vehicle.marca} {vehicle.modelo} ({vehicle.ano})
                      </span>
                    </div>
                  )}

                  {config.includeKm && totalKmRodados > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Quilometragem Total
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {totalKmRodados.toLocaleString('pt-BR')} km
                      </span>
                    </div>
                  )}
                </div>

                {/* CARDS DE RESUMO (CONSOLIDADOS BASEADOS NOS CHECKBOXES ATIVOS) */}
                <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 page-break-inside-avoid">
                  {/* Card Faturamento Bruto */}
                  {config.includeGanhos && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                        Faturamento Bruto
                      </span>
                      <span className="text-xl font-black text-emerald-950 font-mono">
                        {formatCurrency(faturamentoBruto)}
                      </span>
                      <span className="text-[10px] text-emerald-700 block mt-0.5">
                        {diasProducao} dias trabalhados • {totalPecas.toLocaleString('pt-BR')} pçs
                        {ganhoKm > 0 ? ` • ${formatCurrency(ganhoKm)}/km` : ''}
                      </span>
                    </div>
                  )}

                  {/* Card Combustível */}
                  {config.includeCombustivel && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-amber-800 block">
                        Combustível
                      </span>
                      <span className="text-xl font-black text-amber-950 font-mono">
                        {formatCurrency(despesasCombustivel)}
                      </span>
                      <span className="text-[10px] text-amber-700 block mt-0.5">
                        {totalLitros > 0 ? `${totalLitros.toFixed(1)} L/m³ • Méd: ${formatCurrency(precoMedioLitro)}` : 'Despesa do período'}
                      </span>
                    </div>
                  )}

                  {/* Card Oficina e Parcelas */}
                  {config.includeOficina && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-blue-800 block">
                        Oficina & Parcelas
                      </span>
                      <span className="text-xl font-black text-blue-950 font-mono">
                        {formatCurrency(despesasOficina)}
                      </span>
                      <span className="text-[10px] text-blue-700 block mt-0.5">
                        {parcelasTotal > 0 ? `Inclui ${formatCurrency(parcelasTotal)} em parcelas` : 'Serviços realizados'}
                      </span>
                    </div>
                  )}

                  {/* Card Lucro Líquido Real */}
                  {config.includeLucro && (
                    <div className={`p-3 rounded-xl border ${lucroLiquidoReal >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'}`}>
                      <span className={`text-[10px] uppercase font-bold block ${lucroLiquidoReal >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                        Lucro Líquido Real
                      </span>
                      <span className={`text-xl font-black font-mono ${lucroLiquidoReal >= 0 ? 'text-emerald-950' : 'text-rose-950'}`}>
                        {formatCurrency(lucroLiquidoReal)}
                      </span>
                      <span className="text-[10px] text-slate-600 block mt-0.5">
                        Margem: {margemLucro.toFixed(1)}% {lucroKm > 0 ? `(${formatCurrency(lucroKm)}/km)` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* TABELA: DETALHAMENTO DIA A DIA DOS GANHOS */}
                {config.includeGanhos && config.includeDetalhamentoGanhos && sortedEarnings.length > 0 && (
                  <div className="mt-6 space-y-2 page-break-inside-avoid">
                    <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center justify-between">
                      <span>Lançamentos Diários de Produção</span>
                      <span className="font-normal text-slate-500 font-mono">
                        {sortedEarnings.length} {sortedEarnings.length === 1 ? 'dia' : 'dias'}
                      </span>
                    </h3>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                            <th className="py-2.5 px-3">Data</th>
                            <th className="py-2.5 px-3 text-right">Qtd Peças</th>
                            <th className="py-2.5 px-3 text-right">Valor/Pça</th>
                            <th className="py-2.5 px-3 text-right">Bônus</th>
                            <th className="py-2.5 px-3 text-right">Faturamento</th>
                            {config.includeKm && <th className="py-2.5 px-3 text-right">KM Dia</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                          {sortedEarnings.map((item, idx) => {
                            const faturamento =
                              typeof item.faturamento_bruto === 'number'
                                ? item.faturamento_bruto
                                : item.qtd_pecas * item.valor_unitario_peca + item.valor_extra_bonus;
                            return (
                              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {formatDateBR(item.data)}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-slate-800">
                                  {item.qtd_pecas}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-600">
                                  {formatCurrency(item.valor_unitario_peca)}
                                </td>
                                <td className="py-2 px-3 text-right text-emerald-700 font-semibold">
                                  {item.valor_extra_bonus > 0 ? formatCurrency(item.valor_extra_bonus) : '-'}
                                </td>
                                <td className="py-2 px-3 text-right font-black text-emerald-950">
                                  {formatCurrency(faturamento)}
                                </td>
                                {config.includeKm && (
                                  <td className="py-2 px-3 text-right text-slate-700">
                                    {item.km_rodado ? `${item.km_rodado} km` : '-'}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                            <td className="py-2.5 px-3 font-sans">TOTAL GERAL</td>
                            <td className="py-2.5 px-3 text-right font-mono">{totalPecas}</td>
                            <td className="py-2.5 px-3 text-right">-</td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                              {formatCurrency(totalBonus)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-900 text-sm font-black">
                              {formatCurrency(faturamentoBruto)}
                            </td>
                            {config.includeKm && (
                              <td className="py-2.5 px-3 text-right font-mono">
                                {totalKmRodados.toLocaleString('pt-BR')} km
                              </td>
                            )}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* TABELA: DESPESAS DE COMBUSTÍVEL */}
                {config.includeCombustivel && effectiveFuel.length > 0 && (
                  <div className="mt-6 space-y-2 page-break-inside-avoid">
                    <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center justify-between">
                      <span>Abastecimentos Registrados</span>
                      <span className="font-normal text-slate-500 font-mono">
                        {effectiveFuel.length} {effectiveFuel.length === 1 ? 'abastecimento' : 'abastecimentos'}
                      </span>
                    </h3>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                            <th className="py-2.5 px-3">Data</th>
                            <th className="py-2.5 px-3">Tipo</th>
                            <th className="py-2.5 px-3 text-right">Litros/m³</th>
                            <th className="py-2.5 px-3 text-right">Preço/L</th>
                            <th className="py-2.5 px-3 text-right">Valor Total</th>
                            <th className="py-2.5 px-3 text-right">Odômetro</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                          {effectiveFuel.map((item, idx) => {
                            const litros =
                              typeof item.litros_calculados === 'number'
                                ? item.litros_calculados
                                : item.valor_total_abastecido / (item.preco_por_litro_ou_m3 || 1);
                            return (
                              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {formatDateBR(item.data)}
                                </td>
                                <td className="py-2 px-3 font-sans uppercase font-bold text-slate-700">
                                  {item.tipo_combustivel}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700">
                                  {litros.toFixed(2)} {item.tipo_combustivel === 'gnv' ? 'm³' : 'L'}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-600">
                                  {formatCurrency(item.preco_por_litro_ou_m3)}
                                </td>
                                <td className="py-2 px-3 text-right font-black text-amber-900">
                                  {formatCurrency(item.valor_total_abastecido)}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700">
                                  {item.km_odometro.toLocaleString('pt-BR')} km
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                            <td colSpan={2} className="py-2.5 px-3 font-sans">TOTAL COMBUSTÍVEL</td>
                            <td className="py-2.5 px-3 text-right font-mono">{totalLitros.toFixed(2)} L</td>
                            <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(precoMedioLitro)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-amber-900 text-sm font-black">
                              {formatCurrency(despesasCombustivel)}
                            </td>
                            <td className="py-2.5 px-3 text-right">-</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* TABELA: DESPESAS DE OFICINA E PARCELAS */}
                {config.includeOficina && effectiveMaintenance.length > 0 && (
                  <div className="mt-6 space-y-2 page-break-inside-avoid">
                    <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center justify-between">
                      <span>Oficina, Manutenção e Parcelas</span>
                      <span className="font-normal text-slate-500 font-mono">
                        {effectiveMaintenance.length} registros
                      </span>
                    </h3>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                            <th className="py-2.5 px-3">Data</th>
                            <th className="py-2.5 px-3">Oficina</th>
                            <th className="py-2.5 px-3">Descrição</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-right">Peças</th>
                            <th className="py-2.5 px-3 text-right">M. Obra</th>
                            <th className="py-2.5 px-3 text-right">Valor Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                          {effectiveMaintenance.map((item, idx) => {
                            const total =
                              typeof item.valor_total === 'number'
                                ? item.valor_total
                                : item.valor_pecas + item.valor_mao_de_obra;
                            const isOrcamento = item.status === 'orcamento';
                            return (
                              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {formatDateBR(item.data)}
                                </td>
                                <td className="py-2 px-3 font-sans font-bold text-slate-800">
                                  {item.oficina_nome}
                                </td>
                                <td className="py-2 px-3 font-sans text-slate-700">
                                  <div>{item.descricao_servico}</div>
                                  {item.forma_pagamento === 'parcelado' && (
                                    <div className="text-[10px] text-indigo-700 font-semibold font-mono mt-0.5">
                                      💳 {item.qtd_parcelas || 1}x de {formatCurrency(item.valor_parcela || 0)}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                      isOrcamento
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    }`}
                                  >
                                    {isOrcamento ? 'ORÇAMENTO' : 'REALIZADO'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right text-slate-600">
                                  {formatCurrency(item.valor_pecas)}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-600">
                                  {formatCurrency(item.valor_mao_de_obra)}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right font-black ${
                                    isOrcamento ? 'text-amber-800' : 'text-blue-900'
                                  }`}
                                >
                                  {formatCurrency(total)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                            <td colSpan={4} className="py-2.5 px-3 font-sans">
                              TOTAL DE OFICINA NO PERÍODO (À VISTA + PARCELAS DO MÊS)
                            </td>
                            <td colSpan={2} className="py-2.5 px-3 text-right font-mono text-xs text-slate-500">
                              {futureCommittedTotal > 0 && `(Futuro a pagar: ${formatCurrency(futureCommittedTotal)})`}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-blue-900 text-sm font-black">
                              {formatCurrency(despesasOficina)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* DEMONSTRATIVO DE FECHAMENTO FINANCEIRO */}
                {config.includeLucro && (
                  <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 page-break-inside-avoid">
                    <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider mb-2">
                      Demonstrativo de Fechamento Financeiro
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                      {config.includeGanhos && (
                        <div className="flex justify-between border-b sm:border-b-0 sm:border-r border-slate-200 p-2">
                          <span className="text-slate-600">(+) Faturamento Bruto:</span>
                          <strong className="text-emerald-700">{formatCurrency(faturamentoBruto)}</strong>
                        </div>
                      )}
                      {(config.includeCombustivel || config.includeOficina) && (
                        <div className="flex justify-between border-b sm:border-b-0 sm:border-r border-slate-200 p-2">
                          <span className="text-slate-600">(-) Despesas Totais:</span>
                          <strong className="text-rose-700">{formatCurrency(despesasTotais)}</strong>
                        </div>
                      )}
                      <div className="flex justify-between p-2">
                        <span className="text-slate-900 font-bold">(=) Lucro Líquido Real:</span>
                        <strong className={`font-black ${lucroLiquidoReal >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                          {formatCurrency(lucroLiquidoReal)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* MEUS DADOS E CHAVE PIX NO RODAPÉ */}
                {config.includeDadosPix && (
                  <div className="mt-6 p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 page-break-inside-avoid">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-indigo-900 block tracking-wider">
                        Dados para Pagamento e Transferência (PIX)
                      </span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">
                        {profile?.nome || 'Motorista Parceiro'}
                      </p>
                      {profile?.cpf_cnpj && (
                        <p className="text-[11px] text-slate-600 font-mono">
                          CPF/CNPJ: {profile.cpf_cnpj}
                        </p>
                      )}
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-indigo-200 text-left sm:text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Chave PIX
                      </span>
                      <span className="text-sm font-black text-indigo-950 font-mono block">
                        {profile?.chave_pix || 'Chave não cadastrada'}
                      </span>
                    </div>
                  </div>
                )}

                {/* RODAPÉ DO DOCUMENTO A4 */}
                <div className="mt-8 pt-4 border-t border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-slate-500 page-break-inside-avoid">
                  <div>
                    <p>Documento emitido eletronicamente via <strong>Gastos Rota</strong>.</p>
                    <p>Controle financeiro pessoal e prestação de contas operacionais.</p>
                  </div>
                  <div className="text-left sm:text-right font-mono">
                    <p>ID da Emissão: {((user?.id || 'GR').slice(0, 4) + '-' + (startDate || 'REL').replace(/-/g, '')).toUpperCase()}</p>
                    <p>{formatDateTimeNow()}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 4. BOTÕES FINAIS DE EXPORTAÇÃO NO RODAPÉ DO MODAL (Ocultos na impressão) */}
        <div className="p-3.5 sm:p-5 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden shrink-0">
          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 self-start sm:self-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Relatório customizado pronto com base nos blocos selecionados</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            {/* Botão Copiar Texto */}
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold transition active:scale-[0.97] cursor-pointer border border-slate-700 shadow-sm"
              title="Copiar texto formatado para o WhatsApp"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Copiar Texto</span>
                </>
              )}
            </button>

            {/* Botão Enviar no WhatsApp */}
            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition active:scale-[0.97] cursor-pointer shadow-lg shadow-emerald-600/25 border border-emerald-500/40"
              title="Abrir WhatsApp com o relatório pré-formatado"
            >
              <Share2 className="w-4 h-4" />
              <span>Enviar no WhatsApp</span>
            </button>

            {/* Botão Baixar / Imprimir PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs sm:text-sm font-bold transition active:scale-[0.97] cursor-pointer shadow-lg shadow-blue-600/25 border border-blue-500/40"
              title="Baixar ou Imprimir Extrato em PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Baixar / Imprimir PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
