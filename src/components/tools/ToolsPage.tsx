import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fuel,
  Package,
  Target,
  RotateCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  DollarSign,
  Gauge,
  Sliders,
  Car,
  ChevronRight,
  Info,
  ArrowRight,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import type { Vehicle, FuelType, FuelLog } from '../../types/database';
import { formatCurrency } from '../../utils/exportUtils';
import { QuickFuelModal } from './QuickFuelModal';
import { AnimatedCounter } from '../common/AnimatedCounter';
import { triggerGoalCelebration } from '../../lib/celebrate';

export const ToolsPage: React.FC = () => {
  const { user } = useAuth();

  // Aba ativa: 'combustivel' | 'viabilidade' | 'metas' | 'custo_km'
  const [activeTab, setActiveTab] = useState<'combustivel' | 'viabilidade' | 'metas' | 'custo_km'>('combustivel');
  const [loading, setLoading] = useState(true);

  // Dados carregados do banco de dados
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [hasVehicleAverages, setHasVehicleAverages] = useState(false);

  // 1. Estado da Ferramenta 1: Comparador de Combustível
  const [precoGasolina, setPrecoGasolina] = useState<string>('5.89');
  const [precoEtanol, setPrecoEtanol] = useState<string>('3.99');
  const [precoGnv, setPrecoGnv] = useState<string>('');
  const [mediaGasolina, setMediaGasolina] = useState<string>('11.0');
  const [mediaEtanol, setMediaEtanol] = useState<string>('7.7');
  const [mediaGnv, setMediaGnv] = useState<string>('14.0');
  const [simuladorAbastecimento, setSimuladorAbastecimento] = useState<string>('200');

  // Estado do Modal de Abastecimento Rápido (Ferramenta 1)
  const [isQuickFuelOpen, setIsQuickFuelOpen] = useState(false);
  const [quickFuelType, setQuickFuelType] = useState<FuelType>('gasolina');
  const [quickFuelToast, setQuickFuelToast] = useState<{
    tipo: string;
    valor: number;
    litros: number;
    unidade: string;
  } | null>(null);

  // Auto-dismiss do Toast de sucesso
  useEffect(() => {
    if (!quickFuelToast) return;
    const timer = setTimeout(() => {
      setQuickFuelToast(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [quickFuelToast]);

  const handleOpenQuickFuel = (tipo: FuelType) => {
    setQuickFuelType(tipo);
    setIsQuickFuelOpen(true);
  };

  const handleQuickFuelSuccess = (inserted: FuelLog, updatedVehicleKm?: number) => {
    if (updatedVehicleKm && vehicle) {
      setVehicle((prev) => (prev ? { ...prev, km_atual: updatedVehicleKm } : null));
    }
    const unidade = inserted.tipo_combustivel === 'gnv' ? 'm³' : 'litros';
    const tipoFormatado =
      inserted.tipo_combustivel === 'etanol'
        ? 'Etanol'
        : inserted.tipo_combustivel === 'gnv'
        ? 'GNV'
        : 'Gasolina';
    const vol =
      inserted.litros_calculados ||
      (inserted.preco_por_litro_ou_m3 > 0
        ? inserted.valor_total_abastecido / inserted.preco_por_litro_ou_m3
        : 0);

    setQuickFuelToast({
      tipo: tipoFormatado,
      valor: inserted.valor_total_abastecido,
      litros: vol,
      unidade,
    });
  };

  // 2. Estado da Ferramenta 2: Viabilidade de Rota
  const [rotaQtdPecas, setRotaQtdPecas] = useState<string>('80');
  const [rotaValorPeca, setRotaValorPeca] = useState<string>('4.50');
  const [rotaDistanciaKm, setRotaDistanciaKm] = useState<string>('90');
  const [rotaTipoCombustivel, setRotaTipoCombustivel] = useState<FuelType>('gasolina');
  const [rotaPrecoCombustivel, setRotaPrecoCombustivel] = useState<string>('5.89');
  const [rotaConsumoKml, setRotaConsumoKml] = useState<string>('11.0');
  const [rotaBonusExtra, setRotaBonusExtra] = useState<string>('0');

  // 3. Estado da Ferramenta 3: Meta de Ganhos e Peças
  const [metaLiquida, setMetaLiquida] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gastos_rota_meta_liquida') || '3500';
    }
    return '3500';
  });
  const [metaDiasTrabalho, setMetaDiasTrabalho] = useState<string>('12');
  const [metaKmDia, setMetaKmDia] = useState<string>('90');
  const [metaValorPeca, setMetaValorPeca] = useState<string>('4.50');
  const [metaPrecoCombustivel, setMetaPrecoCombustivel] = useState<string>('5.89');
  const [metaConsumoKml, setMetaConsumoKml] = useState<string>('11.0');

  // Produção real acumulada no mês corrente para comparação de meta
  const [currentMonthAccumulated, setCurrentMonthAccumulated] = useState<{
    faturamento: number;
    pecas: number;
    combustivel: number;
    lucroLiquido: number;
    diasTrabalhados: number;
  }>({
    faturamento: 0,
    pecas: 0,
    combustivel: 0,
    lucroLiquido: 0,
    diasTrabalhados: 0,
  });

  const handleUpdateMetaLiquida = (val: string) => {
    setMetaLiquida(val);
    try {
      localStorage.setItem('gastos_rota_meta_liquida', val);
    } catch {
      // ignore
    }
  };

  // 4. Estado da Ferramenta 4: Custo Real por KM
  const [custoCombustivelKmLitro, setCustoCombustivelKmLitro] = useState<string>('5.89');
  const [custoCombustivelKmMedia, setCustoCombustivelKmMedia] = useState<string>('11.0');
  const [custoManutencaoKmInput, setCustoManutencaoKmInput] = useState<string>('0.18');
  const [custoPneusKmInput, setCustoPneusKmInput] = useState<string>('0.035');
  const [custoDepreciacaoKmInput, setCustoDepreciacaoKmInput] = useState<string>('0.15');
  const [simFreteDistanciaKm, setSimFreteDistanciaKm] = useState<string>('100');
  const [simFreteLucroDesejado, setSimFreteLucroDesejado] = useState<string>('150');

  // Função interna para carregar dados do Supabase
  const fetchDriverData = useCallback(async (isCurrent = true) => {
    if (!user) return;

    try {
      // 1. Busca dados do veículo
      const { data: vData } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!isCurrent) return;

      if (vData) {
        setVehicle(vData);
        const hasGas = typeof vData.media_gasolina === 'number' && vData.media_gasolina > 0;
        const hasEta = typeof vData.media_etanol === 'number' && vData.media_etanol > 0;
        const hasGnvVal = typeof vData.media_gnv === 'number' && vData.media_gnv > 0;

        if (hasGas || hasEta || hasGnvVal) {
          setHasVehicleAverages(true);
          const gas = hasGas ? vData.media_gasolina!.toString() : '11.0';
          const eta = hasEta ? vData.media_etanol!.toString() : (parseFloat(gas) * 0.7).toFixed(1);
          const gnv = hasGnvVal ? vData.media_gnv!.toString() : '14.0';

          setMediaGasolina(gas);
          setMediaEtanol(eta);
          setMediaGnv(gnv);
          setRotaConsumoKml(gas);
          setMetaConsumoKml(gas);
          setCustoCombustivelKmMedia(gas);
        }
      }

      // 2. Busca o último valor por peça e média de KM em daily_earnings
      const { data: lastEarnings } = await supabase
        .from('daily_earnings')
        .select('valor_unitario_peca, km_rodado')
        .eq('user_id', user.id)
        .order('data', { ascending: false })
        .limit(10);

      if (!isCurrent) return;

      if (lastEarnings && lastEarnings.length > 0) {
        const lastPrice = lastEarnings[0].valor_unitario_peca;
        if (lastPrice > 0) {
          setRotaValorPeca(lastPrice.toFixed(2));
          setMetaValorPeca(lastPrice.toFixed(2));
        }

        const validKms = lastEarnings.map((e) => e.km_rodado).filter((k) => k > 0);
        if (validKms.length > 0) {
          const avgKm = Math.round(validKms.reduce((a, b) => a + b, 0) / validKms.length);
          setRotaDistanciaKm(avgKm.toString());
          setMetaKmDia(avgKm.toString());
        }
      }

      // 3. Busca os últimos preços de combustível em fuel_logs
      const { data: lastFuels } = await supabase
        .from('fuel_logs')
        .select('tipo_combustivel, preco_por_litro_ou_m3')
        .eq('user_id', user.id)
        .order('data', { ascending: false })
        .limit(15);

      if (!isCurrent) return;

      if (lastFuels && lastFuels.length > 0) {
        const lastGas = lastFuels.find((f) => f.tipo_combustivel === 'gasolina');
        const lastEta = lastFuels.find((f) => f.tipo_combustivel === 'etanol');
        const lastGnvLog = lastFuels.find((f) => f.tipo_combustivel === 'gnv');

        if (lastGas && lastGas.preco_por_litro_ou_m3 > 0) {
          const p = lastGas.preco_por_litro_ou_m3.toFixed(2);
          setPrecoGasolina(p);
          setRotaPrecoCombustivel(p);
          setMetaPrecoCombustivel(p);
          setCustoCombustivelKmLitro(p);
        }
        if (lastEta && lastEta.preco_por_litro_ou_m3 > 0) {
          setPrecoEtanol(lastEta.preco_por_litro_ou_m3.toFixed(2));
        }
        if (lastGnvLog && lastGnvLog.preco_por_litro_ou_m3 > 0) {
          setPrecoGnv(lastGnvLog.preco_por_litro_ou_m3.toFixed(2));
        }
      }

      // 4. Busca acumulado do mês atual para a Meta Financeira
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const startMonthStr = `${currentMonthStr}-01`;
      const endMonthStr = `${currentMonthStr}-31`;

      const { data: monthEarnings } = await supabase
        .from('daily_earnings')
        .select('faturamento_bruto, qtd_pecas, valor_unitario_peca, valor_extra_bonus')
        .eq('user_id', user.id)
        .gte('data', startMonthStr)
        .lte('data', endMonthStr);

      const { data: monthFuels } = await supabase
        .from('fuel_logs')
        .select('valor_total_abastecido')
        .eq('user_id', user.id)
        .gte('data', startMonthStr)
        .lte('data', endMonthStr);

      if (!isCurrent) return;

      const faturamento = (monthEarnings || []).reduce((acc, curr) => {
        const val =
          typeof curr.faturamento_bruto === 'number'
            ? curr.faturamento_bruto
            : curr.qtd_pecas * curr.valor_unitario_peca + curr.valor_extra_bonus;
        return acc + val;
      }, 0);

      const pecas = (monthEarnings || []).reduce((acc, curr) => acc + (curr.qtd_pecas || 0), 0);
      const combustivel = (monthFuels || []).reduce(
        (acc, curr) => acc + (curr.valor_total_abastecido || 0),
        0
      );
      const lucroLiquido = faturamento - combustivel;
      const diasTrabalhados = (monthEarnings || []).length;

      setCurrentMonthAccumulated({
        faturamento,
        pecas,
        combustivel,
        lucroLiquido,
        diasTrabalhados,
      });
    } catch (err) {
      if (isCurrent) {
        console.error('Erro ao buscar dados para calculadoras:', err);
      }
    }
  }, [user]);

  // Efeito de inicialização
  useEffect(() => {
    let isCurrent = true;

    async function init() {
      await fetchDriverData(isCurrent);
      if (isCurrent) {
        setLoading(false);
      }
    }

    init();

    return () => {
      isCurrent = false;
    };
  }, [fetchDriverData]);

  // Recarregamento manual ao clicar em "Sincronizar Dados"
  const handleManualSync = async () => {
    setLoading(true);
    await fetchDriverData(true);
    setLoading(false);
  };

  // Atualiza consumo e preço da rota ao trocar o combustível
  const handleSelectRotaCombustivel = (tipo: FuelType) => {
    setRotaTipoCombustivel(tipo);
    if (tipo === 'etanol') {
      setRotaPrecoCombustivel(precoEtanol);
      setRotaConsumoKml(mediaEtanol);
    } else if (tipo === 'gnv') {
      setRotaPrecoCombustivel(precoGnv || '4.79');
      setRotaConsumoKml(mediaGnv || '14.0');
    } else {
      setRotaPrecoCombustivel(precoGasolina);
      setRotaConsumoKml(mediaGasolina);
    }
  };

  // ==========================================
  // CÁLCULOS DA FERRAMENTA 1: COMBUSTÍVEL
  // ==========================================
  const fuelCalc = useMemo(() => {
    const pGas = parseFloat(precoGasolina) || 0;
    const pEta = parseFloat(precoEtanol) || 0;
    const pGnv = parseFloat(precoGnv) || 0;

    const mGas = parseFloat(mediaGasolina) || 1;
    const mEta = parseFloat(mediaEtanol) || 1;
    const mGnv = parseFloat(mediaGnv) || 1;

    const custoGasKm = pGas > 0 && mGas > 0 ? pGas / mGas : 0;
    const custoEtaKm = pEta > 0 && mEta > 0 ? pEta / mEta : 0;
    const custoGnvKm = pGnv > 0 && mGnv > 0 ? pGnv / mGnv : null;

    const razaoEtaGas = pGas > 0 ? (pEta / pGas) * 100 : 0;
    const paridadeCarro = mGas > 0 ? (mEta / mGas) * 100 : 70;
    const precoMaxEtanol = pGas * (mEta / mGas);

    // Determina vencedor
    interface Option {
      name: 'Etanol' | 'Gasolina' | 'GNV';
      custoKm: number;
      media: number;
      preco: number;
    }

    const options: Option[] = [];
    if (custoEtaKm > 0) options.push({ name: 'Etanol', custoKm: custoEtaKm, media: mEta, preco: pEta });
    if (custoGasKm > 0) options.push({ name: 'Gasolina', custoKm: custoGasKm, media: mGas, preco: pGas });
    if (custoGnvKm !== null && custoGnvKm > 0) {
      options.push({ name: 'GNV', custoKm: custoGnvKm, media: mGnv, preco: pGnv });
    }

    options.sort((a, b) => a.custoKm - b.custoKm);
    const vencedor = options[0] || { name: 'Gasolina', custoKm: custoGasKm, media: mGas, preco: pGas };
    const segundo = options[1] || vencedor;

    // Simulação com valor de abastecimento
    const valSim = parseFloat(simuladorAbastecimento) || 200;
    const kmVencedor = vencedor.preco > 0 ? (valSim / vencedor.preco) * vencedor.media : 0;
    const kmSegundo = segundo.preco > 0 ? (valSim / segundo.preco) * segundo.media : 0;
    const diffKm = Math.max(0, kmVencedor - kmSegundo);
    const economia1000km = Math.max(0, (segundo.custoKm - vencedor.custoKm) * 1000);

    return {
      custoGasKm,
      custoEtaKm,
      custoGnvKm,
      razaoEtaGas,
      paridadeCarro,
      precoMaxEtanol,
      vencedor,
      segundo,
      diffKm,
      economia1000km,
      kmVencedor,
      kmSegundo,
    };
  }, [precoGasolina, precoEtanol, precoGnv, mediaGasolina, mediaEtanol, mediaGnv, simuladorAbastecimento]);

  // ==========================================
  // CÁLCULOS DA FERRAMENTA 2: VIABILIDADE DE ROTA
  // ==========================================
  const routeCalc = useMemo(() => {
    const pecas = parseFloat(rotaQtdPecas) || 0;
    const vlrPeca = parseFloat(rotaValorPeca) || 0;
    const distKm = parseFloat(rotaDistanciaKm) || 0;
    const prcComb = parseFloat(rotaPrecoCombustivel) || 0;
    const consKm = parseFloat(rotaConsumoKml) || 1;
    const bonus = parseFloat(rotaBonusExtra) || 0;

    const faturamentoBruto = pecas * vlrPeca + bonus;
    const litrosGastos = consKm > 0 ? distKm / consKm : 0;
    const custoCombustivel = litrosGastos * prcComb;
    const lucroLiquido = faturamentoBruto - custoCombustivel;
    const margemLucro = faturamentoBruto > 0 ? (lucroLiquido / faturamentoBruto) * 100 : 0;
    const ganhoLiquidoKm = distKm > 0 ? lucroLiquido / distKm : 0;
    const ganhoBrutoKm = distKm > 0 ? faturamentoBruto / distKm : 0;
    const pecasPagarCombustivel = vlrPeca > 0 ? Math.ceil(custoCombustivel / vlrPeca) : 0;
    const pecasLucroLivre = Math.max(0, pecas - pecasPagarCombustivel);

    // Veredito
    let status: 'otima' | 'atencao' | 'prejuizo' = 'otima';
    let vereditoTitle = 'Excelente Rota - Pode Pegar!';
    let vereditoMsg = 'Esta rota oferece ótima margem e excelente rendimento por quilômetro rodado.';

    if (lucroLiquido <= 0 || margemLucro < 40 || ganhoLiquidoKm < 0.8) {
      status = 'prejuizo';
      vereditoTitle = 'Rota de Baixa Rentabilidade / Prejuízo';
      vereditoMsg = 'O custo do combustível consome a maior parte do ganho. Avalie pedir taxa extra ou recusar.';
    } else if (margemLucro < 65 || ganhoLiquidoKm < 1.5) {
      status = 'atencao';
      vereditoTitle = 'Rota Regular / Atenção';
      vereditoMsg = 'Margem intermediária. Verifique se há muito trânsito ou atrasos que aumentem o consumo.';
    }

    return {
      faturamentoBruto,
      litrosGastos,
      custoCombustivel,
      lucroLiquido,
      margemLucro,
      ganhoLiquidoKm,
      ganhoBrutoKm,
      pecasPagarCombustivel,
      pecasLucroLivre,
      status,
      vereditoTitle,
      vereditoMsg,
    };
  }, [
    rotaQtdPecas,
    rotaValorPeca,
    rotaDistanciaKm,
    rotaPrecoCombustivel,
    rotaConsumoKml,
    rotaBonusExtra,
  ]);

  // ==========================================
  // CÁLCULOS DA FERRAMENTA 3: METAS E PEÇAS
  // ==========================================
  const goalCalc = useMemo(() => {
    const metaLiq = parseFloat(metaLiquida) || 0;
    const dias = parseInt(metaDiasTrabalho, 10) || 1;
    const kmDia = parseFloat(metaKmDia) || 0;
    const vlrPeca = parseFloat(metaValorPeca) || 1;
    const prcComb = parseFloat(metaPrecoCombustivel) || 0;
    const consKm = parseFloat(metaConsumoKml) || 1;

    const kmTotal = dias * kmDia;
    const custoCombustivelDia = consKm > 0 ? (kmDia / consKm) * prcComb : 0;
    const custoCombustivelPeriodo = custoCombustivelDia * dias;
    const faturamentoBrutoTotalNecessario = metaLiq + custoCombustivelPeriodo;

    const pecasTotais = vlrPeca > 0 ? Math.ceil(faturamentoBrutoTotalNecessario / vlrPeca) : 0;
    const pecasPorDia = Math.ceil(pecasTotais / dias);
    const faturamentoBrutoDia = pecasPorDia * vlrPeca;
    const metaLiquidaDia = metaLiq / dias;
    const pecasCombustivelDia = vlrPeca > 0 ? Math.ceil(custoCombustivelDia / vlrPeca) : 0;

    return {
      kmTotal,
      custoCombustivelDia,
      custoCombustivelPeriodo,
      faturamentoBrutoTotalNecessario,
      pecasTotais,
      pecasPorDia,
      faturamentoBrutoDia,
      metaLiquidaDia,
      pecasCombustivelDia,
    };
  }, [
    metaLiquida,
    metaDiasTrabalho,
    metaKmDia,
    metaValorPeca,
    metaPrecoCombustivel,
    metaConsumoKml,
  ]);

  // Comparativo da Meta com a Produção Real Acumulada no Mês Corrente
  const metaAlvo = useMemo(() => parseFloat(metaLiquida) || 3500, [metaLiquida]);
  const acumuladoPeriodo = useMemo(() => {
    return currentMonthAccumulated.lucroLiquido > 0
      ? currentMonthAccumulated.lucroLiquido
      : currentMonthAccumulated.faturamento;
  }, [currentMonthAccumulated]);

  const percentualMeta = useMemo(() => {
    return metaAlvo > 0 ? (acumuladoPeriodo / metaAlvo) * 100 : 0;
  }, [acumuladoPeriodo, metaAlvo]);

  const isMetaBatida = percentualMeta >= 100 && acumuladoPeriodo > 0;
  const excedenteMeta = Math.max(0, acumuladoPeriodo - metaAlvo);
  const valorUnitarioPecaNum = parseFloat(metaValorPeca) || 4.5;
  const excedentePecas = valorUnitarioPecaNum > 0 ? Math.round(excedenteMeta / valorUnitarioPecaNum) : 0;

  // Celebração de meta batida disparada uma única vez por mês na sessão
  useEffect(() => {
    if (isMetaBatida && acumuladoPeriodo > 0) {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const sessionKey = `celebrated_tools_goal_${monthKey}`;
      if (typeof window !== 'undefined' && !sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, 'true');
        triggerGoalCelebration();
      }
    }
  }, [isMetaBatida, acumuladoPeriodo]);

  // ==========================================
  // CÁLCULOS DA FERRAMENTA 4: CUSTO REAL POR KM
  // ==========================================
  const realCostCalc = useMemo(() => {
    const prcComb = parseFloat(custoCombustivelKmLitro) || 0;
    const consKm = parseFloat(custoCombustivelKmMedia) || 1;
    const custoManut = parseFloat(custoManutencaoKmInput) || 0;
    const custoPneu = parseFloat(custoPneusKmInput) || 0;
    const custoDeprec = parseFloat(custoDepreciacaoKmInput) || 0;

    const custoCombustivelKm = consKm > 0 ? prcComb / consKm : 0;
    const custoTotalKm = custoCombustivelKm + custoManut + custoPneu + custoDeprec;

    // Percentuais de composição
    const pctComb = custoTotalKm > 0 ? (custoCombustivelKm / custoTotalKm) * 100 : 0;
    const pctManut = custoTotalKm > 0 ? (custoManut / custoTotalKm) * 100 : 0;
    const pctPneu = custoTotalKm > 0 ? (custoPneu / custoTotalKm) * 100 : 0;
    const pctDeprec = custoTotalKm > 0 ? (custoDeprec / custoTotalKm) * 100 : 0;

    // Simulação de frete mínimo
    const simKm = parseFloat(simFreteDistanciaKm) || 100;
    const simLucro = parseFloat(simFreteLucroDesejado) || 150;
    const custoVeiculoFrete = simKm * custoTotalKm;
    const precoMinimoFrete = custoVeiculoFrete + simLucro;
    const precoMinimoKm = simKm > 0 ? precoMinimoFrete / simKm : 0;

    return {
      custoCombustivelKm,
      custoTotalKm,
      pctComb,
      pctManut,
      pctPneu,
      pctDeprec,
      custoVeiculoFrete,
      precoMinimoFrete,
      precoMinimoKm,
    };
  }, [
    custoCombustivelKmLitro,
    custoCombustivelKmMedia,
    custoManutencaoKmInput,
    custoPneusKmInput,
    custoDepreciacaoKmInput,
    simFreteDistanciaKm,
    simFreteLucroDesejado,
  ]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-teal-500/20">
              <Sliders className="w-5 h-5 stroke-[2.2]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Tools & Calculadoras
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Simuladores práticos para tomada de decisão rápida e controle financeiro
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualSync}
          disabled={loading}
          title="Recarregar dados do veículo e histórico"
          className="self-end sm:self-center inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition active:scale-95 cursor-pointer"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-400' : ''}`} />
          <span>Sincronizar Dados</span>
        </button>
      </div>

      {/* Banner Informativo do Veículo */}
      {vehicle && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center shrink-0">
              <Car className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-white">
                {vehicle.marca} {vehicle.modelo} ({vehicle.ano})
              </span>
              <p className="text-[11px] text-slate-400">
                {hasVehicleAverages
                  ? `Médias salvas: Gasolina ${vehicle.media_gasolina || '-'} km/l • Etanol ${vehicle.media_etanol || '-'} km/l ${vehicle.media_gnv ? `• GNV ${vehicle.media_gnv} km/m³` : ''}`
                  : '⚠️ Seu carro ainda não possui médias salvas em "Meu Veículo". Usando regra de 70%.'}
              </p>
            </div>
          </div>

          <a
            href="#veiculo"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-400 hover:text-teal-300 self-start sm:self-center"
          >
            <span>Ver Veículo</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* SELETOR DE ABAS DAS 4 FERRAMENTAS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
        <motion.button
          whileTap={{ scale: 0.96 }}
          type="button"
          onClick={() => setActiveTab('combustivel')}
          className={`relative flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'combustivel'
              ? 'text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          {activeTab === 'combustivel' && (
            <motion.div
              layoutId="toolsActiveTabIndicator"
              className="absolute inset-0 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-600/30"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
          <span className="relative z-10 flex items-center justify-center gap-2 truncate">
            <Fuel className="w-4 h-4 shrink-0" />
            <span className="truncate">1. Combustível</span>
          </span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.96 }}
          type="button"
          onClick={() => setActiveTab('viabilidade')}
          className={`relative flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'viabilidade'
              ? 'text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          {activeTab === 'viabilidade' && (
            <motion.div
              layoutId="toolsActiveTabIndicator"
              className="absolute inset-0 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/30"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
          <span className="relative z-10 flex items-center justify-center gap-2 truncate">
            <Package className="w-4 h-4 shrink-0" />
            <span className="truncate">2. Viabilidade</span>
          </span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.96 }}
          type="button"
          onClick={() => setActiveTab('metas')}
          className={`relative flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'metas'
              ? 'text-slate-950 font-black shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          {activeTab === 'metas' && (
            <motion.div
              layoutId="toolsActiveTabIndicator"
              className="absolute inset-0 bg-amber-500 rounded-xl shadow-lg shadow-amber-500/30"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
          <span className="relative z-10 flex items-center justify-center gap-2 truncate">
            <Target className="w-4 h-4 shrink-0" />
            <span className="truncate">3. Meta Diária</span>
          </span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.96 }}
          type="button"
          onClick={() => setActiveTab('custo_km')}
          className={`relative flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'custo_km'
              ? 'text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          {activeTab === 'custo_km' && (
            <motion.div
              layoutId="toolsActiveTabIndicator"
              className="absolute inset-0 bg-teal-600 rounded-xl shadow-lg shadow-teal-600/30"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
          <span className="relative z-10 flex items-center justify-center gap-2 truncate">
            <Gauge className="w-4 h-4 shrink-0" />
            <span className="truncate">4. Custo / KM</span>
          </span>
        </motion.button>
      </div>

      {/* ======================================================== */}
      {/* FERRAMENTA 1: COMPARADOR INTELIGENTE DE COMBUSTÍVEL      */}
      {/* ======================================================== */}
      {activeTab === 'combustivel' && (
        <section className="space-y-5 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <Fuel className="w-5 h-5 text-emerald-400" />
                  Comparador Inteligente: Etanol vs. Gasolina vs. GNV
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Descubra qual combustível dá o menor custo real por quilômetro rodado no seu carro
                </p>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Paridade Real
              </span>
            </div>

            {/* Inputs de Preço na Bomba */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Preço do Etanol (R$/L)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">
                    R$
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={precoEtanol}
                    onChange={(e) => setPrecoEtanol(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Preço da Gasolina (R$/L)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">
                    R$
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={precoGasolina}
                    onChange={(e) => setPrecoGasolina(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Preço do GNV (R$/m³ - Opcional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">
                    R$
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 4.79"
                    value={precoGnv}
                    onChange={(e) => setPrecoGnv(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Médias de Consumo do Carro (Editáveis para simular estrada vs cidade) */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-teal-400" />
                  Médias de Consumo do seu Veículo
                </span>
                <span className="text-[10px] text-slate-400">Editável para simulação</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Média no Etanol (km/l)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="1"
                    value={mediaEtanol}
                    onChange={(e) => setMediaEtanol(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Média na Gasolina (km/l)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="1"
                    value={mediaGasolina}
                    onChange={(e) => setMediaGasolina(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Média no GNV (km/m³)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="1"
                    value={mediaGnv}
                    onChange={(e) => setMediaGnv(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Ponto de equilíbrio do seu carro: o Etanol compensa se custar até{' '}
                <strong className="text-emerald-400 font-mono">
                  {fuelCalc.paridadeCarro.toFixed(1)}%
                </strong>{' '}
                do preço da gasolina (Preço máximo do Etanol:{' '}
                <strong className="text-emerald-400 font-mono">
                  {formatCurrency(fuelCalc.precoMaxEtanol)}
                </strong>
                ).
              </p>
            </div>

            {/* RESULTADO EM DESTAQUE (CARD BRILHANTE) */}
            <div className="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border-2 border-emerald-500/60 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-4">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400 block">
                    Veredito da Bomba
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-white mt-1">
                    Abasteça com{' '}
                    <span className="text-emerald-400 underline decoration-emerald-500 decoration-wavy">
                      {fuelCalc.vencedor.name.toUpperCase()}
                    </span>
                    !
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">
                    Relação Etanol / Gasolina
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-300 block">
                    {fuelCalc.razaoEtaGas.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Comparativo de Custo por KM */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 my-4">
                <div className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-3 ${fuelCalc.vencedor.name === 'Etanol' ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10' : 'bg-slate-950/60 border-slate-800 text-slate-400'}`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold block uppercase tracking-wider">Custo no Etanol</span>
                      {fuelCalc.vencedor.name === 'Etanol' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500 text-slate-950 uppercase">Vencedor</span>
                      )}
                    </div>
                    <span className="text-xl font-black font-mono block mt-1">
                      <AnimatedCounter value={fuelCalc.custoEtaKm} formatAsCurrency /> <span className="text-xs font-normal text-slate-400">/ km</span>
                    </span>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => handleOpenQuickFuel('etanol')}
                    className="w-full min-h-[38px] py-1.5 px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Abastecer com Etanol</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </motion.button>
                </div>

                <div className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-3 ${fuelCalc.vencedor.name === 'Gasolina' ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10' : 'bg-slate-950/60 border-slate-800 text-slate-400'}`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold block uppercase tracking-wider">Custo na Gasolina</span>
                      {fuelCalc.vencedor.name === 'Gasolina' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500 text-slate-950 uppercase">Vencedor</span>
                      )}
                    </div>
                    <span className="text-xl font-black font-mono block mt-1">
                      <AnimatedCounter value={fuelCalc.custoGasKm} formatAsCurrency /> <span className="text-xs font-normal text-slate-400">/ km</span>
                    </span>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => handleOpenQuickFuel('gasolina')}
                    className="w-full min-h-[38px] py-1.5 px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Abastecer com Gasolina</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </motion.button>
                </div>

                {fuelCalc.custoGnvKm !== null && (
                  <div className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-3 ${fuelCalc.vencedor.name === 'GNV' ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10' : 'bg-slate-950/60 border-slate-800 text-slate-400'} sm:col-span-2 lg:col-span-1`}>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold block uppercase tracking-wider">Custo no GNV</span>
                        {fuelCalc.vencedor.name === 'GNV' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500 text-slate-950 uppercase">Vencedor</span>
                        )}
                      </div>
                      <span className="text-xl font-black font-mono block mt-1">
                        <AnimatedCounter value={fuelCalc.custoGnvKm} formatAsCurrency /> <span className="text-xs font-normal text-slate-400">/ km</span>
                      </span>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => handleOpenQuickFuel('gnv')}
                      className="w-full min-h-[38px] py-1.5 px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span>Abastecer com GNV</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                )}
              </div>

              {/* Simulador de Abastecimento */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-slate-300">
                      Em um abastecimento de{' '}
                      <strong className="text-white font-mono">
                        {formatCurrency(parseFloat(simuladorAbastecimento) || 200)}
                      </strong>
                      :
                    </span>
                    <p className="text-emerald-300 font-bold mt-0.5">
                      Você roda +{fuelCalc.diffKm.toFixed(0)} km a mais escolhendo{' '}
                      {fuelCalc.vencedor.name}! (Economia de {formatCurrency(fuelCalc.economia1000km)} a cada 1.000 km)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <span className="text-[11px] text-slate-400">Simular:</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={simuladorAbastecimento}
                    onChange={(e) => setSimuladorAbastecimento(e.target.value)}
                    className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold text-center text-xs"
                  />
                </div>
              </div>

              {/* BOTÃO PRINCIPAL DE AÇÃO RÁPIDA: ABASTECI COM [VENCEDOR] */}
              <div className="pt-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.01 }}
                  type="button"
                  onClick={() => handleOpenQuickFuel(fuelCalc.vencedor.name.toLowerCase() as FuelType)}
                  className="w-full min-h-[48px] h-12 sm:h-14 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Fuel className="w-5 h-5 shrink-0" />
                  <span>⛽ Abasteci com {fuelCalc.vencedor.name} → Registrar Agora</span>
                </motion.button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* FERRAMENTA 2: SIMULADOR DE VIABILIDADE DE ROTA           */}
      {/* ======================================================== */}
      {activeTab === 'viabilidade' && (
        <section className="space-y-5 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-400" />
                  Simulador de Viabilidade: Essa Rota Vale a Pena?
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calcule a rentabilidade líquida antes de aceitar uma rota, apoio ou frete extra
                </p>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                Análise Pré-Rota
              </span>
            </div>

            {/* Inputs de Rota */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Quantidade de Peças / Entregas
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={rotaQtdPecas}
                  onChange={(e) => setRotaQtdPecas(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Valor Pago por Peça (R$)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">
                    R$
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={rotaValorPeca}
                    onChange={(e) => setRotaValorPeca(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Distância Total (KM Ida + Volta)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={rotaDistanciaKm}
                    onChange={(e) => setRotaDistanciaKm(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 text-xs font-bold pointer-events-none">
                    km
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Bônus / Diária Base (R$ Opcional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">
                    R$
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={rotaBonusExtra}
                    onChange={(e) => setRotaBonusExtra(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Combustível Utilizado na Simulação */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Fuel className="w-4 h-4 text-blue-400" />
                  Combustível que vai usar nesta rota
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSelectRotaCombustivel('gasolina')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      rotaTipoCombustivel === 'gasolina'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    Gasolina
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRotaCombustivel('etanol')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      rotaTipoCombustivel === 'etanol'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    Etanol
                  </button>
                  {precoGnv && (
                    <button
                      type="button"
                      onClick={() => handleSelectRotaCombustivel('gnv')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        rotaTipoCombustivel === 'gnv'
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      GNV
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Preço do Litro (R$)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={rotaPrecoCombustivel}
                    onChange={(e) => setRotaPrecoCombustivel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Consumo Médio (km/l)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={rotaConsumoKml}
                    onChange={(e) => setRotaConsumoKml(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* VEREDITO DA ROTA */}
            <div
              className={`border-2 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden ${
                routeCalc.status === 'otima'
                  ? 'bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border-emerald-500/60'
                  : routeCalc.status === 'atencao'
                  ? 'bg-gradient-to-br from-amber-950/80 via-slate-900 to-slate-950 border-amber-500/60'
                  : 'bg-gradient-to-br from-rose-950/80 via-slate-900 to-slate-950 border-rose-500/60'
              }`}
            >
              <div className="flex items-center gap-3 border-b pb-4 border-slate-800">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    routeCalc.status === 'otima'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : routeCalc.status === 'atencao'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {routeCalc.status === 'otima' ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : routeCalc.status === 'atencao' ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : (
                    <XCircle className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Veredito de Viabilidade
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-white">
                    {routeCalc.vereditoTitle}
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">{routeCalc.vereditoMsg}</p>
                </div>
              </div>

              {/* 4 Cards de Métricas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Lucro Líquido Limpo
                  </span>
                  <span className={`text-lg font-black font-mono block mt-0.5 ${routeCalc.lucroLiquido >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(routeCalc.lucroLiquido)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Margem: {routeCalc.margemLucro.toFixed(1)}%
                  </span>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Faturamento Bruto
                  </span>
                  <span className="text-lg font-black text-white font-mono block mt-0.5">
                    {formatCurrency(routeCalc.faturamentoBruto)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {formatCurrency(routeCalc.ganhoBrutoKm)}/km
                  </span>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Custo de Combustível
                  </span>
                  <span className="text-lg font-black text-amber-400 font-mono block mt-0.5">
                    {formatCurrency(routeCalc.custoCombustivel)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {routeCalc.litrosGastos.toFixed(1)} litros
                  </span>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Ganho Líquido / KM
                  </span>
                  <span className={`text-lg font-black font-mono block mt-0.5 ${routeCalc.ganhoLiquidoKm >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                    {formatCurrency(routeCalc.ganhoLiquidoKm)}/km
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {routeCalc.ganhoLiquidoKm >= 1.5 ? 'Muito Bom' : routeCalc.ganhoLiquidoKm >= 0.8 ? 'Regular' : 'Baixo'}
                  </span>
                </div>
              </div>

              {/* Frase de Ouro da Rota */}
              <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  📦 As primeiras <strong className="text-amber-400 font-mono">{routeCalc.pecasPagarCombustivel} peças</strong> desta rota pagam o combustível. As outras <strong className="text-emerald-400 font-mono">{routeCalc.pecasLucroLivre} peças</strong> são o seu lucro limpo no bolso!
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* FERRAMENTA 3: CALCULADORA DE METAS DE GANHOS E PEÇAS     */}
      {/* ======================================================== */}
      {activeTab === 'metas' && (
        <section className="space-y-5 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-400" />
                  Calculadora de Metas: Planejador de Peças e Quinzena
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Defina quanto quer sobrar livre no bolso e descubra a meta diária de entregas
                </p>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Planejador
              </span>
            </div>

            {/* Inputs de Metas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Meta Líquida Desejada (R$ Livre)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">
                    R$
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="50"
                    min="100"
                    value={metaLiquida}
                    onChange={(e) => handleUpdateMetaLiquida(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-emerald-400 font-mono font-black text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Dias que vai Trabalhar no Período
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="31"
                    value={metaDiasTrabalho}
                    onChange={(e) => setMetaDiasTrabalho(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMetaDiasTrabalho('12')}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-300 rounded"
                    >
                      12d (Qz)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetaDiasTrabalho('24')}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-blue-300 rounded"
                    >
                      24d (Mês)
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Média de KM Rodado por Dia
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={metaKmDia}
                    onChange={(e) => setMetaKmDia(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 text-xs font-bold pointer-events-none">
                    km/dia
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Valor Recebido por Peça (R$)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">
                    R$
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={metaValorPeca}
                    onChange={(e) => setMetaValorPeca(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Parâmetros de Combustível da Meta */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Preço do Combustível (R$/L)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={metaPrecoCombustivel}
                  onChange={(e) => setMetaPrecoCombustivel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Consumo Médio do Carro (km/l)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={metaConsumoKml}
                  onChange={(e) => setMetaConsumoKml(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm"
                />
              </div>
            </div>

            {/* RESULTADO DA META EM DESTAQUE */}
            <div
              className={`rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 transition-all duration-300 relative overflow-hidden ${
                isMetaBatida
                  ? 'bg-gradient-to-br from-amber-950/80 via-slate-900 to-emerald-950/40 border-2 border-amber-400/80 shadow-amber-500/20'
                  : 'bg-gradient-to-br from-amber-950/70 via-slate-900 to-slate-950 border-2 border-amber-500/60'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
                    Sua Meta Diária de Produção
                  </span>
                  <div className="text-3xl sm:text-4xl font-black text-white mt-1">
                    {goalCalc.pecasPorDia}{' '}
                    <span className="text-lg font-normal text-slate-300">peças por dia</span>
                  </div>
                  <p className="text-xs text-amber-300 font-bold mt-1">
                    Faturamento Bruto Diário Necessário: {formatCurrency(goalCalc.faturamentoBrutoDia)}/dia
                  </p>
                </div>

                <div className="self-start sm:self-center">
                  {isMetaBatida ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black shadow-xs">
                      <span className="text-sm">🏆</span>
                      <span>Meta do Mês Batida!</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700 text-xs font-semibold">
                      <span>Progresso: {percentualMeta.toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* BARRA DE PROGRESSO ANIMADA (FRAMER-MOTION) */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                  <span className="text-slate-300 font-medium">
                    Acumulado no mês:{' '}
                    <strong className="text-white font-mono">{formatCurrency(acumuladoPeriodo)}</strong>
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {percentualMeta.toFixed(1)}% da meta ({formatCurrency(metaAlvo)})
                  </span>
                </div>

                <div className="w-full bg-slate-900 rounded-full h-3 p-0.5 border border-slate-800/80 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(percentualMeta, 100)}%` }}
                    transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                    className={`h-full rounded-full ${
                      isMetaBatida
                        ? 'bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-400 shadow-sm shadow-amber-400/30'
                        : 'bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400'
                    }`}
                  />
                </div>

                {isMetaBatida && (
                  <div className="mt-2 pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-xs text-amber-300 font-extrabold flex items-center gap-1.5">
                      <span>🎉</span>
                      <span>
                        Você superou sua meta em +{formatCurrency(excedenteMeta)} (+{excedentePecas} peças)!
                      </span>
                    </p>
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      type="button"
                      onClick={() => triggerGoalCelebration()}
                      className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] transition cursor-pointer self-start sm:self-center shadow-xs"
                    >
                      Celebrar 🎊
                    </motion.button>
                  </div>
                )}
              </div>

              {/* Detalhes Diários */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Seu Lucro Limpo Diário
                  </span>
                  <span className="text-lg font-black text-emerald-400 font-mono block mt-0.5">
                    {formatCurrency(goalCalc.metaLiquidaDia)}/dia
                  </span>
                  <span className="text-[10px] text-slate-500">Direto no seu bolso</span>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Gasto de Combustível Diário
                  </span>
                  <span className="text-lg font-black text-amber-400 font-mono block mt-0.5">
                    {formatCurrency(goalCalc.custoCombustivelDia)}/dia
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {goalCalc.pecasCombustivelDia} peças pagam isso
                  </span>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Total no Período ({metaDiasTrabalho} dias)
                  </span>
                  <span className="text-lg font-black text-blue-400 font-mono block mt-0.5">
                    {goalCalc.pecasTotais} peças
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Bruto: {formatCurrency(goalCalc.faturamentoBrutoTotalNecessario)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* FERRAMENTA 4: CALCULADORA DE DEPRECIAÇÃO E CUSTO REAL    */}
      {/* ======================================================== */}
      {activeTab === 'custo_km' && (
        <section className="space-y-5 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <Gauge className="w-5 h-5 text-teal-400" />
                  Custo Real Operacional por KM e Depreciação
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Revele o custo invisível do seu veículo (combustível + revisões + pneus + desvalorização)
                </p>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                Custo Invisível
              </span>
            </div>

            {/* Parâmetros de Custos por KM */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Preço Combustível (R$/L)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={custoCombustivelKmLitro}
                  onChange={(e) => setCustoCombustivelKmLitro(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Média Consumo (km/l)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={custoCombustivelKmMedia}
                  onChange={(e) => setCustoCombustivelKmMedia(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Manutenção (R$/km)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={custoManutencaoKmInput}
                  onChange={(e) => setCustoManutencaoKmInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">Óleo, freios, correia</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Pneus (R$/km)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.005"
                  value={custoPneusKmInput}
                  onChange={(e) => setCustoPneusKmInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">Jogo de pneus / 40 mil km</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Depreciação + IPVA (R$/km)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={custoDepreciacaoKmInput}
                  onChange={(e) => setCustoDepreciacaoKmInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">Desvalorização e seguro</span>
              </div>
            </div>

            {/* CARD PRINCIPAL DO CUSTO TOTAL POR KM */}
            <div className="bg-gradient-to-br from-teal-950/80 via-slate-900 to-slate-950 border-2 border-teal-500/60 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-teal-400 block">
                    Custo Real Operacional por KM Rodado
                  </span>
                  <div className="text-3xl sm:text-4xl font-black text-white font-mono mt-1">
                    {formatCurrency(realCostCalc.custoTotalKm)} <span className="text-base text-slate-400 font-normal">/ km</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Combustível:</span>
                    <strong className="text-amber-400 font-mono">{formatCurrency(realCostCalc.custoCombustivelKm)}/km</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Manutenção & Peças:</span>
                    <strong className="text-blue-400 font-mono">{formatCurrency(parseFloat(custoManutencaoKmInput) || 0)}/km</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Pneus & Rodagem:</span>
                    <strong className="text-indigo-400 font-mono">{formatCurrency(parseFloat(custoPneusKmInput) || 0)}/km</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Depreciação & Taxas:</span>
                    <strong className="text-teal-400 font-mono">{formatCurrency(parseFloat(custoDepreciacaoKmInput) || 0)}/km</strong>
                  </div>
                </div>
              </div>

              {/* Barra de Proporção Visual */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] text-slate-400 block font-semibold">
                  Composição do Custo do seu Veículo:
                </span>
                <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
                  <div style={{ width: `${realCostCalc.pctComb}%` }} className="bg-amber-500 h-full" title={`Combustível: ${realCostCalc.pctComb.toFixed(0)}%`} />
                  <div style={{ width: `${realCostCalc.pctManut}%` }} className="bg-blue-500 h-full" title={`Manutenção: ${realCostCalc.pctManut.toFixed(0)}%`} />
                  <div style={{ width: `${realCostCalc.pctPneu}%` }} className="bg-indigo-500 h-full" title={`Pneus: ${realCostCalc.pctPneu.toFixed(0)}%`} />
                  <div style={{ width: `${realCostCalc.pctDeprec}%` }} className="bg-teal-500 h-full" title={`Depreciação: ${realCostCalc.pctDeprec.toFixed(0)}%`} />
                </div>
                <div className="flex flex-wrap gap-3 text-[10px] text-slate-400 pt-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Combustível ({realCostCalc.pctComb.toFixed(0)}%)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Manutenção ({realCostCalc.pctManut.toFixed(0)}%)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Pneus ({realCostCalc.pctPneu.toFixed(0)}%)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500" /> Depreciação ({realCostCalc.pctDeprec.toFixed(0)}%)</span>
                </div>
              </div>

              {/* Alerta de Ouro */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Regra de Ouro do Motorista:</strong>
                  Nunca aceite fretes ou diárias cujo valor pago por quilômetro rodado seja menor que{' '}
                  <strong className="text-white font-mono">{formatCurrency(realCostCalc.custoTotalKm)}/km</strong>.
                  Abaixo desse valor, você está gastando as peças e os pneus do seu carro para trabalhar de graça.
                </div>
              </div>

              {/* Simulador de Preço Mínimo para Frete */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Simulador de Frete / Diária Mínima
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Distância da Corrida/Frete (KM ida + volta)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={simFreteDistanciaKm}
                      onChange={(e) => setSimFreteDistanciaKm(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Quanto quer lucrar limpo no bolso? (R$)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="10"
                      value={simFreteLucroDesejado}
                      onChange={(e) => setSimFreteLucroDesejado(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-base sm:text-sm"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-teal-500/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-400">
                      Custo operacional do carro para rodar {simFreteDistanciaKm} km:
                    </span>
                    <strong className="text-rose-400 font-mono ml-1">
                      {formatCurrency(realCostCalc.custoVeiculoFrete)}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-300">Cobrar no Mínimo:</span>
                    <strong className="text-emerald-400 font-mono text-base ml-1.5 font-black">
                      {formatCurrency(realCostCalc.precoMinimoFrete)}
                    </strong>
                    <span className="text-[10px] text-slate-400 ml-1">
                      ({formatCurrency(realCostCalc.precoMinimoKm)}/km)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* MODAL DE ABASTECIMENTO RÁPIDO */}
      {isQuickFuelOpen && (
        <QuickFuelModal
          key={`${quickFuelType}-${precoGasolina}-${precoEtanol}-${precoGnv}-${simuladorAbastecimento}`}
          isOpen={isQuickFuelOpen}
          onClose={() => setIsQuickFuelOpen(false)}
          initialFuelType={quickFuelType}
          precoEtanol={precoEtanol}
          precoGasolina={precoGasolina}
          precoGnv={precoGnv}
          mediaEtanol={mediaEtanol}
          mediaGasolina={mediaGasolina}
          mediaGnv={mediaGnv}
          simuladorValor={simuladorAbastecimento}
          vehicle={vehicle}
          onSuccess={handleQuickFuelSuccess}
        />
      )}

      {/* TOAST DE SUCESSO DO ABASTECIMENTO */}
      <AnimatePresence>
        {quickFuelToast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-emerald-950/95 border border-emerald-500/60 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-black text-white truncate">
                  Abastecimento registrado com sucesso!
                </p>
                <p className="text-[11px] sm:text-xs text-emerald-300 truncate">
                  {quickFuelToast.litros.toFixed(2)} {quickFuelToast.unidade} de {quickFuelToast.tipo} ({formatCurrency(quickFuelToast.valor)})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <motion.a
                whileTap={{ scale: 0.94 }}
                href="#combustivel"
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition cursor-pointer whitespace-nowrap"
              >
                Ver Histórico
              </motion.a>
              <button
                type="button"
                onClick={() => setQuickFuelToast(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                aria-label="Fechar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
