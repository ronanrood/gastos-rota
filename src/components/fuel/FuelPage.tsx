import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import type { FuelLog, FuelLogInsert, FuelType, Vehicle } from '../../types/database';
import { staggerContainerVariants, staggerItemVariants } from '../common/MotionVariants';
import {
  Fuel,
  Calendar,
  DollarSign,
  Gauge,
  PlusCircle,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RotateCw,
  Sparkles,
  Zap,
  Car,
  Info,
  Pencil,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { EditFuelModal } from './EditFuelModal';
import { HistoryFilterBar } from '../filters/HistoryFilterBar';
import { FuelFilterSummary } from '../filters/FuelFilterSummary';
import { BottomSheetModal } from '../common/BottomSheetModal';
import {
  type HistoryFilterState,
  getDefaultFilterState,
  calculateFilterDateRange,
  formatCardDateBadge,
} from '../../utils/filterUtils';

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

export const FuelPage: React.FC = () => {
  const { user, profile } = useAuth();

  // Estados do formulário
  const [data, setData] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [tipoCombustivel, setTipoCombustivel] = useState<FuelType>('gasolina');
  const [valorTotalAbastecido, setValorTotalAbastecido] = useState<string>('');
  const [precoPorLitro, setPrecoPorLitro] = useState<string>('');
  const [kmOdometro, setKmOdometro] = useState<string>('');

  // Estados de controle e listagem
  const [submitting, setSubmitting] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [filterState, setFilterState] = useState<HistoryFilterState>(getDefaultFilterState);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingFuelLog, setEditingFuelLog] = useState<FuelLog | null>(null);

  // Controle de abertura da gaveta inferior (Bottom Sheet) no mobile
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleOpenNewForm = useCallback(() => {
    setFormError(null);
    setFormSuccess(null);
    setIsFormOpen(true);
    // No desktop, rola suavemente para o formulário na lateral se estiver visível
    const el = document.getElementById('fuel-form-section');
    if (el && window.innerWidth >= 1024) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Estados para expansão inteligente tipo Accordion nos cards de histórico
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAllExpanded, setIsAllExpanded] = useState<boolean>(false);

  const toggleItemExpand = useCallback((id: string) => {
    setIsAllExpanded(false);
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const toggleAllExpanded = useCallback(() => {
    setIsAllExpanded((prev) => !prev);
    setExpandedId(null);
  }, []);

  const handleEditSuccess = (updated: FuelLog) => {
    setFuelLogs((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setFormSuccess('Abastecimento atualizado com sucesso!');
    setTimeout(() => {
      setFormSuccess(null);
    }, 4000);
  };

  // Cálculos em tempo real
  const numValorTotal = parseFloat(valorTotalAbastecido) || 0;
  const numPrecoLitro = parseFloat(precoPorLitro) || 0;

  // a) Litros / m³ calculados em tempo real na interface
  const litrosCalculadosEstimados = useMemo(() => {
    if (numValorTotal > 0 && numPrecoLitro > 0) {
      return numValorTotal / numPrecoLitro;
    }
    return 0;
  }, [numValorTotal, numPrecoLitro]);

  // b) Autonomia estimada em KM baseada na média cadastrada na tabela vehicles
  const mediaVeiculoAtual = useMemo(() => {
    if (!vehicle) return null;
    if (tipoCombustivel === 'gasolina') return vehicle.media_gasolina;
    if (tipoCombustivel === 'etanol') return vehicle.media_etanol;
    if (tipoCombustivel === 'gnv') return vehicle.media_gnv;
    return null;
  }, [vehicle, tipoCombustivel]);

  const autonomiaEstimadaKm = useMemo(() => {
    if (litrosCalculadosEstimados > 0 && mediaVeiculoAtual && mediaVeiculoAtual > 0) {
      return litrosCalculadosEstimados * mediaVeiculoAtual;
    }
    return 0;
  }, [litrosCalculadosEstimados, mediaVeiculoAtual]);

  // Recarregar sob demanda (ex: ao clicar no botão de atualizar ou após salvar)
  const refreshVehicleAndLogs = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);

    try {
      // 1. Veículo do usuário (para cálculo de autonomia e odômetro padrão)
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (vehicleData) {
        setVehicle(vehicleData as Vehicle);
        setKmOdometro((prev) => (prev ? prev : vehicleData.km_atual?.toString() || ''));
      }

      // 2. Histórico de abastecimentos
      const { data: logsData, error } = await supabase
        .from('fuel_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (logsData) {
        setFuelLogs(logsData as FuelLog[]);
      }
    } catch (err: unknown) {
      console.error('Erro ao buscar abastecimentos:', err);
    } finally {
      setLoadingList(false);
    }
  }, [user]);

  // Carregamento inicial sincronizado
  useEffect(() => {
    let ignore = false;

    const loadData = async () => {
      if (!user) {
        setLoadingList(false);
        return;
      }
      try {
        const [vehicleRes, logsRes] = await Promise.all([
          supabase.from('vehicles').select('*').eq('user_id', user.id).maybeSingle(),
          supabase.from('fuel_logs').select('*').eq('user_id', user.id).order('data', { ascending: false }).order('created_at', { ascending: false }),
        ]);

        if (!ignore) {
          if (vehicleRes.data) {
            const v = vehicleRes.data as Vehicle;
            setVehicle(v);
            setKmOdometro((prev) => (prev ? prev : v.km_atual?.toString() || ''));
          }
          if (logsRes.data) {
            setFuelLogs(logsRes.data as FuelLog[]);
          }
        }
      } catch (err) {
        if (!ignore) console.error('Falha ao carregar dados de combustível:', err);
      } finally {
        if (!ignore) setLoadingList(false);
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, [user]);

  // Submissão do novo abastecimento
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!user) {
      setFormError('Sessão expirada. Faça login novamente.');
      return;
    }

    if (!data) {
      setFormError('Informe a data do abastecimento.');
      return;
    }

    if (numValorTotal <= 0) {
      setFormError('Informe um valor abastecido maior que zero.');
      return;
    }

    if (numPrecoLitro <= 0) {
      setFormError('Informe o preço por litro/m³ maior que zero.');
      return;
    }

    const numKm = parseFloat(kmOdometro);
    if (isNaN(numKm) || numKm < 0) {
      setFormError('Informe a quilometragem atual do odômetro.');
      return;
    }

    setSubmitting(true);

    try {
      /**
       * REGRA CRÍTICA DO SUPABASE:
       * NÃO envie a coluna 'litros_calculados' no payload,
       * pois o PostgreSQL calcula ela automaticamente (GENERATED ALWAYS AS (valor_total_abastecido / preco_por_litro_ou_m3) STORED).
       */
      const payload: FuelLogInsert = {
        user_id: user.id,
        data,
        tipo_combustivel: tipoCombustivel,
        valor_total_abastecido: Number(numValorTotal.toFixed(2)),
        preco_por_litro_ou_m3: Number(numPrecoLitro.toFixed(3)),
        km_odometro: Number(numKm.toFixed(1)),
      };

      const { data: inserted, error } = await supabase
        .from('fuel_logs')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      // Se o odômetro abastecido for maior que o km atual do veículo, atualiza o veículo
      if (vehicle && numKm > (vehicle.km_atual || 0)) {
        await supabase
          .from('vehicles')
          .update({ km_atual: Number(numKm.toFixed(1)) })
          .eq('id', vehicle.id);
        setVehicle((prev) => (prev ? { ...prev, km_atual: numKm } : null));
      }

      setFormSuccess('Abastecimento registrado com sucesso!');
      setIsFormOpen(false);

      if (inserted) {
        setFuelLogs((prev) => [inserted as FuelLog, ...prev]);
      } else {
        await refreshVehicleAndLogs();
      }

      // Limpa os campos mantendo o tipo e a data
      setValorTotalAbastecido('');
      setPrecoPorLitro('');

      setTimeout(() => {
        setFormSuccess(null);
      }, 4000);
    } catch (err: unknown) {
      console.error('Erro ao salvar abastecimento:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao registrar abastecimento.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Exclusão de registro
  const handleDelete = async (id: string) => {
    if (!user) return;
    setDeletingId(id);

    try {
      const { error } = await supabase
        .from('fuel_logs')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setFuelLogs((prev) => prev.filter((item) => item.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Erro ao excluir abastecimento:', err);
      alert('Não foi possível excluir o registro. Tente novamente.');
    } finally {
      setDeletingId(null);
    }
  };

  // Registros filtrados e ordenados avançados
  const filteredLogs = useMemo(() => {
    const { startDate, endDate } = calculateFilterDateRange(filterState, profile);
    const q = filterState.searchQuery.trim().toLowerCase();

    return fuelLogs
      .filter((item) => {
        // Filtro por Data
        if (startDate && item.data < startDate) return false;
        if (endDate && item.data > endDate) return false;

        // Filtro por Busca Instantânea (tipo combustível, valor, preço por litro, km, data)
        if (q) {
          const combustivel = (item.tipo_combustivel || '').toLowerCase();
          const dStr = (item.data || '').toLowerCase();
          const dFormatted = formatDate(item.data).toLowerCase();
          const valorTotal = (item.valor_total_abastecido || 0).toFixed(2);
          const preco = (item.preco_por_litro_ou_m3 || 0).toFixed(3);
          const km = (item.km_odometro || '').toString();

          const matches =
            combustivel.includes(q) ||
            dStr.includes(q) ||
            dFormatted.includes(q) ||
            valorTotal.includes(q) ||
            preco.includes(q) ||
            km.includes(q);

          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const valA = a.valor_total_abastecido || 0;
        const valB = b.valor_total_abastecido || 0;

        if (filterState.sortBy === 'oldest') {
          return (a.data || '').localeCompare(b.data || '') || (a.created_at || '').localeCompare(b.created_at || '');
        }
        if (filterState.sortBy === 'highest_value') {
          return valB - valA;
        }
        if (filterState.sortBy === 'lowest_value') {
          return valA - valB;
        }
        // padrão: 'recent'
        return (b.data || '').localeCompare(a.data || '') || (b.created_at || '').localeCompare(a.created_at || '');
      });
  }, [fuelLogs, filterState, profile]);

  // Estatísticas do período filtrado
  const totalGastoPeriodo = useMemo(() => {
    return filteredLogs.reduce((acc, curr) => acc + (curr.valor_total_abastecido || 0), 0);
  }, [filteredLogs]);

  const totalLitrosPeriodo = useMemo(() => {
    return filteredLogs.reduce((acc, curr) => {
      const litros =
        typeof curr.litros_calculados === 'number'
          ? curr.litros_calculados
          : curr.valor_total_abastecido / (curr.preco_por_litro_ou_m3 || 1);
      return acc + litros;
    }, 0);
  }, [filteredLogs]);

  const precoMedioLitroPeriodo = useMemo(() => {
    if (totalLitrosPeriodo > 0 && totalGastoPeriodo > 0) {
      return totalGastoPeriodo / totalLitrosPeriodo;
    }
    return 0;
  }, [totalGastoPeriodo, totalLitrosPeriodo]);

  const getUnidade = (tipo: FuelType) => (tipo === 'gnv' ? 'm³' : 'L');

  // Renderiza o formulário de abastecimento (compartilhado entre desktop e Bottom Sheet mobile)
  const renderFuelForm = (isModal: boolean = false) => (
    <div
      className={`space-y-4 ${
        isModal
          ? ''
          : 'bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-7 relative overflow-hidden backdrop-blur-md'
      }`}
    >
      {!isModal && (
        <>
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
                <Fuel className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  Lançar Abastecimento
                </h2>
                <p className="text-xs text-slate-400">
                  Registre os dados da bomba para cálculo de autonomia
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Tempo real
            </span>
          </div>
        </>
      )}

      {/* FEEDBACKS */}
      {formError && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Erro</p>
            <p className="text-rose-300/90">{formError}</p>
          </div>
        </div>
      )}

      {formSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold">{formSuccess}</div>
        </div>
      )}

      {/* VISOR EM TEMPO REAL: LITROS CALCULADOS E AUTONOMIA ESTIMADA */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border-2 border-amber-500/40 p-4 sm:p-5 relative shadow-inner">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          {/* a) Volume calculado */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
              <Fuel className="w-4 h-4" />
              Volume Calculado (Litros / m³)
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white mt-1 tracking-tight font-mono">
              {litrosCalculadosEstimados > 0
                ? `${litrosCalculadosEstimados.toFixed(2)} ${getUnidade(tipoCombustivel)}`
                : `0,00 ${getUnidade(tipoCombustivel)}`}
            </div>
            <span className="text-[11px] text-slate-400 block mt-1">
              {numValorTotal > 0 && numPrecoLitro > 0
                ? `${formatCurrency(numValorTotal)} ÷ ${formatCurrency(numPrecoLitro)}`
                : 'Preencha o total e o preço por litro'}
            </span>
          </div>

          {/* b) Autonomia estimada em KM */}
          <div className="pt-3 sm:pt-0 border-t sm:border-t-0 sm:border-l border-slate-800 sm:pl-4">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-400">
              <Zap className="w-4 h-4" />
              Autonomia Estimada
            </div>
            <div className="text-2xl sm:text-3xl font-black text-teal-300 mt-1 tracking-tight font-mono">
              {autonomiaEstimadaKm > 0
                ? `~ ${autonomiaEstimadaKm.toFixed(0)} km`
                : '-- km'}
            </div>

            <div className="text-[11px] text-slate-400 mt-1">
              {mediaVeiculoAtual && mediaVeiculoAtual > 0 ? (
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <Car className="w-3 h-3 text-teal-400" />
                  Média de {mediaVeiculoAtual} {getUnidade(tipoCombustivel) === 'm³' ? 'km/m³' : 'km/l'}
                </span>
              ) : (
                <span className="text-amber-400/90 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Cadastre a média do veículo em &quot;Meu Veículo&quot;
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Seletor Tipo de Combustível */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Tipo de Combustível
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: 'gasolina' as FuelType, label: 'Gasolina', icon: '⛽' },
              { id: 'etanol' as FuelType, label: 'Etanol', icon: '🌱' },
              { id: 'gnv' as FuelType, label: 'GNV', icon: '💨' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTipoCombustivel(opt.id)}
                className={`min-h-[48px] py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] ${
                  tipoCombustivel === opt.id
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 ring-2 ring-amber-400'
                    : 'bg-slate-950/80 text-slate-400 hover:text-white border border-slate-700/80'
                }`}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Data */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Data do Abastecimento
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Odômetro KM */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              KM Atual no Odômetro 
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Gauge className="w-4 h-4" />
              </div>
              <input
                type="number"
                inputMode="decimal"
                required
                min="0"
                step="0.1"
                value={kmOdometro}
                onChange={(e) => setKmOdometro(e.target.value)}
                placeholder="Ex: 85400"
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition font-mono"
              />
            </div>
          </div>

          {/* Valor Total Abastecido */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Valor Total Pago 
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <input
                type="number"
                inputMode="decimal"
                required
                min="0"
                step="0.01"
                value={valorTotalAbastecido}
                onChange={(e) => setValorTotalAbastecido(e.target.value)}
                placeholder="Ex: 150.00"
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition font-mono"
              />
            </div>
          </div>

          {/* Preço por Litro ou m³ */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Preço por {getUnidade(tipoCombustivel)} 
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <input
                type="number"
                inputMode="decimal"
                required
                min="0"
                step="0.001"
                value={precoPorLitro}
                onChange={(e) => setPrecoPorLitro(e.target.value)}
                placeholder="Ex: 5.89"
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition font-mono"
              />
            </div>
          </div>
        </div>

        {/* Botão de Salvar */}
        <div className="pt-2">
          <motion.button
            type="submit"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.96 }}
            disabled={submitting}
            className="w-full h-12 min-h-[48px] px-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-sm sm:text-base rounded-2xl shadow-lg shadow-amber-500/25 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Salvando Abastecimento...
              </>
            ) : (
              <>
                <PlusCircle className="w-5 h-5 stroke-[2.2]" />
                Salvar Abastecimento
              </>
            )}
          </motion.button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="w-full space-y-6">
      {/* Cards de Métricas Resumo (Grade Compacta 3 Colunas no Mobile e Desktop) */}
      {fuelLogs.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="w-full bg-slate-900/80 border border-slate-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 backdrop-blur-sm min-w-0">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
              Total Combustível
            </span>
            <span className="text-base sm:text-xl font-extrabold text-amber-400 mt-0.5 sm:mt-1 block font-mono tabular-nums truncate">
              {formatCurrency(totalGastoPeriodo)}
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 block truncate">
              {filteredLogs.length} abastecimentos
            </span>
          </div>

          <div className="w-full bg-slate-900/80 border border-slate-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 backdrop-blur-sm min-w-0">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
              Volume Total
            </span>
            <span className="text-base sm:text-xl font-extrabold text-white mt-0.5 sm:mt-1 block font-mono tabular-nums truncate">
              {totalLitrosPeriodo.toFixed(1)} L/m³
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 block truncate">
              {filteredLogs.length > 0 ? `~${(totalLitrosPeriodo / filteredLogs.length).toFixed(1)}/vez` : '-'}
            </span>
          </div>

          <div className="w-full bg-slate-900/80 border border-slate-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 backdrop-blur-sm min-w-0">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
              Preço Médio
            </span>
            <span className="text-base sm:text-xl font-extrabold text-teal-400 mt-0.5 sm:mt-1 block font-mono tabular-nums truncate">
              {precoMedioLitroPeriodo > 0 ? formatCurrency(precoMedioLitroPeriodo) : 'R$ 0,00'}
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 block truncate">
              por litro/m³
            </span>
          </div>
        </div>
      )}

      {/* BOTÃO DE DESTAQUE INTEGRADO: LANÇAR ABASTECIMENTO (Ação Principal no Mobile) */}
      <div className="lg:hidden">
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={handleOpenNewForm}
          className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:from-amber-600 active:to-orange-600 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <PlusCircle className="w-5 h-5 stroke-[2.5]" />
          <span>+ Lançar Abastecimento</span>
        </motion.button>
      </div>

      {/* LAYOUT PRINCIPAL: No desktop, exibe o formulário na coluna lateral aberta (lg:grid) e o histórico na direita */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-6 items-start">
        {/* FORMULÁRIO LATERAL NO DESKTOP (Aberto e fixo na visão desktop) */}
        <div id="fuel-form-section" className="hidden lg:block lg:col-span-5 sticky top-24">
          {renderFuelForm(false)}
        </div>

        {/* COLUNA DO HISTÓRICO (Largura total no mobile, coluna direita no desktop) */}
        <div className="lg:col-span-7 space-y-4">
          {/* BARRA DE FILTRAGEM AVANÇADA (MÊS, QUINZENA, BUSCA E ORDENAÇÃO) */}
          <HistoryFilterBar
            filterState={filterState}
            onFilterChange={setFilterState}
            profile={profile}
            searchPlaceholder="Buscar por combustível, valor, preço por litro, km..."
            totalFilteredCount={filteredLogs.length}
          />

          {/* RESUMO DO FILTRO ATIVO (TOTALIZADOR DINÂMICO) */}
          <FuelFilterSummary
            items={filteredLogs}
            filterState={filterState}
            profile={profile}
            vehicle={vehicle}
          />

          {/* HISTÓRICO DE ABASTECIMENTOS */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1 gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Histórico de Abastecimentos
                  </h3>
                  {fuelLogs.length > 0 && (
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                      {fuelLogs.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Registros e consumo do veículo
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                {/* Botão de Ação Rápida no Cabeçalho da Lista */}
                <button
                  type="button"
                  onClick={handleOpenNewForm}
                  className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-md shadow-amber-500/20 active:scale-95 transition cursor-pointer select-none shrink-0"
                  aria-label="Novo Abastecimento"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span className="hidden xs:inline">+ Abastecer</span>
                  <span className="xs:hidden">+ Novo</span>
                </button>

                {filteredLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAllExpanded}
                    title={isAllExpanded ? 'Recolher todos os abastecimentos' : 'Expandir todos os abastecimentos'}
                    aria-label={isAllExpanded ? 'Recolher todos os abastecimentos' : 'Expandir todos os abastecimentos'}
                    className="flex items-center gap-1.5 px-2.5 py-2 min-h-[44px] rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/70 active:scale-[0.97] transition cursor-pointer select-none"
                  >
                    <span className="text-[11px] font-medium hidden sm:inline">
                      {isAllExpanded ? 'Recolher todos' : 'Expandir todos'}
                    </span>
                    <span className="text-[11px] font-medium sm:hidden">
                      {isAllExpanded ? 'Recolher' : 'Expandir'}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                        isAllExpanded ? 'rotate-180 text-amber-400' : ''
                      }`}
                    />
                  </button>
                )}

                <button
                  type="button"
                  onClick={refreshVehicleAndLogs}
                  disabled={loadingList}
                  title="Atualizar lista"
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition cursor-pointer"
                >
                  <RotateCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

        {/* BARRA DE FILTRAGEM AVANÇADA (MÊS, QUINZENA, BUSCA E ORDENAÇÃO) */}
        <HistoryFilterBar
          filterState={filterState}
          onFilterChange={setFilterState}
          profile={profile}
          searchPlaceholder="Buscar por combustível, valor, preço por litro, km..."
          totalFilteredCount={filteredLogs.length}
        />

        {/* RESUMO DO FILTRO ATIVO (TOTALIZADOR DINÂMICO) */}
        <FuelFilterSummary
          items={filteredLogs}
          filterState={filterState}
          profile={profile}
          vehicle={vehicle}
        />

        {/* Loading Skeleton */}
        {loadingList && fuelLogs.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 bg-slate-900/60 rounded-2xl border border-slate-800 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty State Sem Registros */}
        {!loadingList && fuelLogs.length === 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Fuel className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">Nenhum abastecimento encontrado</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Registre seus abastecimentos no formulário acima para acompanhar gastos e litros abastecidos.
            </p>
          </div>
        )}

        {/* Empty State Filtro Ativo */}
        {!loadingList && fuelLogs.length > 0 && filteredLogs.length === 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Info className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Nenhum abastecimento encontrado neste período</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Não há registros para o mês ou termos de busca selecionados. Alterne o período ou limpe os filtros.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFilterState(getDefaultFilterState())}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold transition active:scale-95 cursor-pointer border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpar Filtros e Ver Todos
            </button>
          </div>
        )}

        {/* Lista de Abastecimentos com Stagger e Animação de Layout */}
        <motion.div
          key={`${filterState.monthYear}-${filterState.periodChip}`}
          variants={staggerContainerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-2.5"
        >
          <AnimatePresence>
            {filteredLogs.map((item) => {
              const litros =
                typeof item.litros_calculados === 'number'
                  ? item.litros_calculados
                  : item.valor_total_abastecido / (item.preco_por_litro_ou_m3 || 1);

              const isConfirming = confirmDeleteId === item.id;
              const isDeleting = deletingId === item.id;
              const { fullBadge, formattedDate, paymentCycleBadge } = formatCardDateBadge(item.data, profile);

              const dateParts = formattedDate ? formattedDate.split(' ') : [];
              const dayAndMonth = dateParts.length >= 2 ? `${dateParts[0]} ${dateParts[1]}` : item.data;
              const isExpanded = isAllExpanded || expandedId === item.id;

              // Autonomia e custo estimado por km baseado na média do veículo
              const media =
                item.tipo_combustivel === 'gasolina'
                  ? vehicle?.media_gasolina
                  : item.tipo_combustivel === 'etanol'
                  ? vehicle?.media_etanol
                  : vehicle?.media_gnv;
              const estKm = media && media > 0 ? (litros * media).toFixed(0) : null;
              const custoKm =
                estKm && Number(estKm) > 0 ? (item.valor_total_abastecido / Number(estKm)).toFixed(2) : null;

              return (
                <motion.div
                  key={item.id}
                  layout
                  variants={staggerItemVariants}
                  className="w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/70 shadow-sm transition-colors mb-2"
                >
                  {/* Linha Compacta (1 Linha - Estado Fechado por Padrão) */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleItemExpand(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleItemExpand(item.id);
                      }
                    }}
                    aria-expanded={isExpanded}
                    className="w-full flex items-center justify-between gap-3 min-w-0 p-3.5 text-left cursor-pointer hover:bg-slate-800/40 active:bg-slate-800/60 transition select-none min-h-[48px]"
                  >
                    {/* Esquerda: Data (10 Nov) + Badge do combustível + Litragem/Volume */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono tracking-tight shrink-0 border border-slate-700/50">
                        {dayAndMonth}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                          item.tipo_combustivel === 'gasolina'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : item.tipo_combustivel === 'etanol'
                            ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                            : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {item.tipo_combustivel}
                      </span>
                      <span className="text-xs font-bold text-white font-mono truncate">
                        {litros.toFixed(2)}{' '}
                        <span className="text-[11px] font-normal text-slate-400">
                          {getUnidade(item.tipo_combustivel)}
                        </span>
                      </span>
                    </div>

                    {/* Direita: Valor abastecido + ChevronDown */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm sm:text-base font-black text-amber-400 font-mono tabular-nums whitespace-nowrap">
                        {formatCurrency(item.valor_total_abastecido)}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                          isExpanded ? 'rotate-180 text-amber-400' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Expansão Suave ao Tocar */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden border-t border-slate-800/80 bg-zinc-900/50 p-3.5 space-y-3"
                      >
                        {/* Grid Completo de Detalhes */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 min-w-0">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider truncate">
                              Preço / {getUnidade(item.tipo_combustivel)}
                            </span>
                            <span className="font-mono font-bold text-white text-xs sm:text-sm mt-0.5 block truncate">
                              {formatCurrency(item.preco_por_litro_ou_m3)}
                            </span>
                          </div>

                          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 min-w-0">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider truncate">
                              Volume Abastecido
                            </span>
                            <span className="font-mono font-bold text-white text-xs sm:text-sm mt-0.5 block truncate">
                              {litros.toFixed(2)} {getUnidade(item.tipo_combustivel)}
                            </span>
                          </div>

                          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 min-w-0">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider truncate">
                              Odômetro KM
                            </span>
                            <span className="font-mono font-bold text-white text-xs sm:text-sm mt-0.5 block truncate">
                              {item.km_odometro.toLocaleString('pt-BR')} km
                            </span>
                          </div>

                          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 min-w-0">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider truncate">
                              Autonomia Estimada
                            </span>
                            <span className="font-mono font-bold text-amber-400 text-xs sm:text-sm mt-0.5 block truncate">
                              {estKm ? `~${estKm} km` : '---'}
                            </span>
                          </div>
                        </div>

                        {/* Custo Estimado por KM se houver cálculo */}
                        {estKm && custoKm && (
                          <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-950/40 px-3 py-2 rounded-xl border border-slate-800/40 flex-wrap gap-2">
                            <span className="flex items-center gap-1.5 font-medium truncate">
                              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="truncate">Custo Estimado por KM:</span>
                              <strong className="text-white font-mono tabular-nums shrink-0">R$ {custoKm}/km</strong>
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 shrink-0">
                              (Média: {media} km/{getUnidade(item.tipo_combustivel)})
                            </span>
                          </div>
                        )}

                        {/* Referência da Quinzena / Ciclo */}
                        <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-950/40 px-3 py-2 rounded-xl border border-slate-800/40 flex-wrap gap-2">
                          <span className="flex items-center gap-1.5 font-medium truncate">
                            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">{fullBadge}</span>
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 shrink-0">
                            Ref: {paymentCycleBadge}
                          </span>
                        </div>

                        {/* Barra de Ações Rápidas no Rodapé */}
                        <div
                          className="pt-2 border-t border-slate-800/80 w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!isConfirming ? (
                            <div className="grid grid-cols-2 gap-2 w-full">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingFuelLog(item);
                                }}
                                className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-800 hover:text-amber-400 border border-slate-700/60 active:scale-[0.96] transition cursor-pointer w-full"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Editar Abastecimento</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(item.id);
                                }}
                                className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 active:scale-[0.96] transition cursor-pointer w-full"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Excluir</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-rose-950/90 border border-rose-600/50 p-2 rounded-xl w-full">
                              <span className="text-xs font-semibold text-rose-300 px-1 text-center sm:text-left">
                                Confirmar exclusão?
                              </span>
                              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(item.id);
                                  }}
                                  disabled={isDeleting}
                                  className="h-9 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition active:scale-[0.96] cursor-pointer"
                                >
                                  {isDeleting ? '...' : 'Sim, Excluir'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(null);
                                  }}
                                  className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition active:scale-[0.96] cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
          </section>
        </div>
      </div>

      {/* Modal Responsivo de Edição de Abastecimento */}
      {editingFuelLog && (
        <EditFuelModal
          key={editingFuelLog.id}
          isOpen={!!editingFuelLog}
          fuelLog={editingFuelLog}
          vehicle={vehicle}
          onClose={() => setEditingFuelLog(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Gaveta Inferior Deslizante (Bottom Sheet) no Mobile */}
      <BottomSheetModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Lançar Abastecimento"
        subtitle="Registre os dados da bomba para cálculo de autonomia"
        icon={
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
            <Fuel className="w-5 h-5 stroke-[2.2]" />
          </div>
        }
      >
        {renderFuelForm(true)}
      </BottomSheetModal>
    </div>
  );
};
