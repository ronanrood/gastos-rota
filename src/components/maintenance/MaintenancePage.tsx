import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import type { MaintenanceLog, MaintenanceLogInsert, MaintenanceStatus, PaymentMethod, Vehicle } from '../../types/database';
import { staggerContainerVariants, staggerItemVariants } from '../common/MotionVariants';
import {
  Wrench,
  Calendar,
  DollarSign,
  FileText,
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RotateCw,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Building,
  Paperclip,
  X,
  Pencil,
  ClipboardList,
  RotateCcw,
  Info,
  CreditCard,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { EditMaintenanceModal } from './EditMaintenanceModal';
import { HistoryFilterBar } from '../filters/HistoryFilterBar';
import { MaintenanceFilterSummary } from '../filters/MaintenanceFilterSummary';
import { BottomSheetModal } from '../common/BottomSheetModal';
import { FloatingActionButton } from '../common/FloatingActionButton';
import { SwipeableCarousel } from '../common/SwipeableCarousel';
import {
  type HistoryFilterState,
  getDefaultFilterState,
  calculateFilterDateRange,
  formatCardDateBadge,
} from '../../utils/filterUtils';
import {
  isServiceParcelado,
  calculateMaintenanceInstallmentInfo,
  calculatePeriodMaintenanceExpenses,
} from '../../utils/maintenanceInstallments';

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

export const MaintenancePage: React.FC = () => {
  const { user, profile } = useAuth();

  // Estados do formulário
  const [today] = useState<string>(getTodayString);
  const [status, setStatus] = useState<MaintenanceStatus>('realizado');
  const [data, setData] = useState<string>(getTodayString);
  const [oficinaNome, setOficinaNome] = useState('');
  const [descricaoServico, setDescricaoServico] = useState('');
  const [valorPecas, setValorPecas] = useState<string>('0');
  const [valorMaoDeObra, setValorMaoDeObra] = useState<string>('0');
  const [garantiaAte, setGarantiaAte] = useState<string>('');
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethod>('avista');
  const [qtdParcelas, setQtdParcelas] = useState<string>('2');
  const [valorParcela, setValorParcela] = useState<string>('');
  const [mesPrimeiraParcela, setMesPrimeiraParcela] = useState<string>(getTodayString);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Estados de controle e listagem
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [filterState, setFilterState] = useState<HistoryFilterState>(getDefaultFilterState);
  const [statusFilter, setStatusFilter] = useState<'all' | 'realizado' | 'orcamento' | 'parcelado'>('all');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingMaintenanceLog, setEditingMaintenanceLog] = useState<MaintenanceLog | null>(null);
  const [modalMode, setModalMode] = useState<'edit' | 'approve'>('edit');

  // Controle de abertura da gaveta inferior (Bottom Sheet) no mobile
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleOpenNewForm = useCallback(() => {
    setFormError(null);
    setFormSuccess(null);
    setIsFormOpen(true);
    // No desktop, rola suavemente para o formulário na lateral se estiver visível
    const el = document.getElementById('maintenance-form-section');
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

  const handleEditSuccess = (updated: MaintenanceLog) => {
    setMaintenanceLogs((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setFormSuccess(
      updated.status === 'orcamento'
        ? 'Orçamento atualizado com sucesso!'
        : 'Serviço atualizado com sucesso!'
    );
    setTimeout(() => {
      setFormSuccess(null);
    }, 4000);
  };

  // Contagem no período selecionado (mês / quinzena / custom)
  const dateFilteredLogs = useMemo(() => {
    const { startDate, endDate } = calculateFilterDateRange(filterState, profile);
    return maintenanceLogs.filter((item) => {
      if (startDate && item.data < startDate) return false;
      if (endDate && item.data > endDate) return false;
      return true;
    });
  }, [maintenanceLogs, filterState, profile]);

  const orcamentosCount = useMemo(
    () => dateFilteredLogs.filter((m) => m.status === 'orcamento').length,
    [dateFilteredLogs]
  );

  const realizadosCount = useMemo(
    () => dateFilteredLogs.filter((m) => m.status !== 'orcamento').length,
    [dateFilteredLogs]
  );

  const parceladosCount = useMemo(
    () => maintenanceLogs.filter((m) => isServiceParcelado(m)).length,
    [maintenanceLogs]
  );

  // Filtragem e Ordenação avançada da Oficina
  const filteredLogs = useMemo(() => {
    const { startDate, endDate } = calculateFilterDateRange(filterState, profile);
    const q = filterState.searchQuery.trim().toLowerCase();

    return maintenanceLogs
      .filter((item) => {
        // Filtro por Data (quando não estamos visualizando a aba exclusiva de parcelamentos,
        // pois serviços parcelados ativos no mês podem ter sido realizados em meses anteriores)
        if (statusFilter !== 'parcelado') {
          if (startDate && item.data < startDate) return false;
          if (endDate && item.data > endDate) return false;
        }

        // Filtro por Status da Oficina (Pills)
        if (statusFilter === 'orcamento' && item.status !== 'orcamento') return false;
        if (statusFilter === 'realizado' && item.status === 'orcamento') return false;
        if (statusFilter === 'parcelado' && !isServiceParcelado(item)) return false;

        // Filtro por Busca Instantânea (nome da oficina, descrição, status, garantia, valores, data)
        if (q) {
          const oficina = (item.oficina_nome || '').toLowerCase();
          const desc = (item.descricao_servico || '').toLowerCase();
          const dStr = (item.data || '').toLowerCase();
          const dFormatted = formatDate(item.data).toLowerCase();
          const statusText =
            (item.status === 'orcamento' ? 'orcamento orçamento pendente' : 'realizado concluido concluído') +
            (isServiceParcelado(item) ? ' parcelado parcela parcelas cartão boleto' : ' avista à vista');
          const isGarantiaAtiva = item.garantia_ate && item.garantia_ate >= today ? 'garantia na garantia' : '';
          const valorTotal = (
            typeof item.valor_total === 'number'
              ? item.valor_total
              : (item.valor_pecas || 0) + (item.valor_mao_de_obra || 0)
          ).toFixed(2);

          const matches =
            oficina.includes(q) ||
            desc.includes(q) ||
            dStr.includes(q) ||
            dFormatted.includes(q) ||
            statusText.includes(q) ||
            isGarantiaAtiva.includes(q) ||
            valorTotal.includes(q);

          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const valA =
          typeof a.valor_total === 'number'
            ? a.valor_total
            : (a.valor_pecas || 0) + (a.valor_mao_de_obra || 0);
        const valB =
          typeof b.valor_total === 'number'
            ? b.valor_total
            : (b.valor_pecas || 0) + (b.valor_mao_de_obra || 0);

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
  }, [maintenanceLogs, filterState, profile, statusFilter, today]);

  // Cálculo em tempo real do Valor Total (Peças + Mão de Obra)
  const numValorPecas = parseFloat(valorPecas) || 0;
  const numValorMaoDeObra = parseFloat(valorMaoDeObra) || 0;

  const valorTotalEstimado = useMemo(() => {
    return numValorPecas + numValorMaoDeObra;
  }, [numValorPecas, numValorMaoDeObra]);

  const handlePecasChange = (val: string) => {
    setValorPecas(val);
    if (formaPagamento === 'parcelado') {
      const total = (parseFloat(val) || 0) + numValorMaoDeObra;
      const q = parseInt(qtdParcelas, 10) || 1;
      setValorParcela((total / q).toFixed(2));
    }
  };

  const handleMaoDeObraChange = (val: string) => {
    setValorMaoDeObra(val);
    if (formaPagamento === 'parcelado') {
      const total = numValorPecas + (parseFloat(val) || 0);
      const q = parseInt(qtdParcelas, 10) || 1;
      setValorParcela((total / q).toFixed(2));
    }
  };

  // Resumo de comprometimento mensal com parcelas ativas no período filtrado
  const parcelamentoResumo = useMemo(() => {
    const { startDate, endDate } = calculateFilterDateRange(filterState, profile);
    const expenses = calculatePeriodMaintenanceExpenses(maintenanceLogs, {
      monthYear: filterState.periodChip === 'month' ? filterState.monthYear : undefined,
      startDate,
      endDate,
    });

    const activeParcelados = maintenanceLogs.filter((m) => isServiceParcelado(m));
    const totalFuturo = activeParcelados.reduce((acc, curr) => {
      const info = calculateMaintenanceInstallmentInfo(curr, filterState.monthYear);
      return acc + (info.isFinished ? 0 : info.remainingValue);
    }, 0);

    return {
      comprometimentoMensal: expenses.parcelasTotal,
      activeCount: expenses.activeInstallmentsCount,
      totalRestanteFuturo: totalFuturo,
    };
  }, [maintenanceLogs, filterState, profile]);

  // Recarregar sob demanda (ex: ao clicar no botão de atualizar ou após salvar)
  const refreshMaintenanceLogs = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);

    try {
      const { data: rows, error } = await supabase
        .from('maintenance_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (rows) {
        setMaintenanceLogs(rows as MaintenanceLog[]);
      }
    } catch (err: unknown) {
      console.error('Erro ao buscar histórico de manutenção:', err);
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
        const [logsRes, vehicleRes] = await Promise.all([
          supabase
            .from('maintenance_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('data', { ascending: false })
            .order('created_at', { ascending: false }),
          supabase
            .from('vehicles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        if (!ignore) {
          if (logsRes.error) {
            console.error('Erro ao carregar manutenções:', logsRes.error.message);
          } else if (logsRes.data) {
            setMaintenanceLogs(logsRes.data as MaintenanceLog[]);
          }
          if (vehicleRes.data) {
            setVehicle(vehicleRes.data as Vehicle);
          }
        }
      } catch (err) {
        if (!ignore) console.error('Falha ao carregar manutenções:', err);
      } finally {
        if (!ignore) setLoadingList(false);
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, [user]);

  // Manipulação da seleção de arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

      if (!validTypes.includes(file.type)) {
        setFormError('Formato inválido. Selecione um arquivo PDF, JPG ou PNG.');
        return;
      }

      // Limite de 10MB
      if (file.size > 10 * 1024 * 1024) {
        setFormError('O arquivo selecionado deve ter menos de 10MB.');
        return;
      }

      setFormError(null);
      setSelectedFile(file);
    }
  };

  // Submissão do lançamento de manutenção
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!user) {
      setFormError('Sessão expirada. Faça login novamente.');
      return;
    }

    if (!data) {
      setFormError('Informe a data da manutenção.');
      return;
    }

    if (!oficinaNome.trim()) {
      setFormError('Informe o nome da oficina ou mecânico.');
      return;
    }

    if (!descricaoServico.trim()) {
      setFormError('Descreva o serviço executado.');
      return;
    }

    if (numValorPecas < 0) {
      setFormError('O valor de peças não pode ser negativo.');
      return;
    }

    if (numValorMaoDeObra < 0) {
      setFormError('O valor de mão de obra não pode ser negativo.');
      return;
    }

    if (valorTotalEstimado <= 0) {
      setFormError('O valor total do serviço (peças + mão de obra) deve ser maior que zero.');
      return;
    }

    setSubmitting(true);
    let comprovanteUrl: string | null = null;

    try {
      // 1. Upload do comprovante para o Storage bucket 'comprovantes_oficina' se houver arquivo
      if (selectedFile) {
        setUploadProgress('Enviando comprovante para o Supabase Storage...');
        const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${user.id}/${Date.now()}_${cleanName}`;

        const { error: uploadError } = await supabase.storage
          .from('comprovantes_oficina')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Falha no upload do comprovante: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from('comprovantes_oficina')
          .getPublicUrl(filePath);

        comprovanteUrl = publicUrlData.publicUrl;
      }

      setUploadProgress('Salvando registro de manutenção...');

      /**
       * REGRA CRÍTICA DO SUPABASE:
       * NÃO envie a coluna 'valor_total' no payload JSON,
       * pois ela é calculada automaticamente pelo PostgreSQL (GENERATED ALWAYS AS (valor_pecas + valor_mao_de_obra) STORED).
       */
      const parsedQtd = parseInt(qtdParcelas, 10) || 1;
      const parsedValParc =
        parseFloat(valorParcela.replace(',', '.')) || valorTotalEstimado / parsedQtd;

      const payload: MaintenanceLogInsert = {
        user_id: user.id,
        data,
        oficina_nome: oficinaNome.trim(),
        descricao_servico: descricaoServico.trim(),
        valor_pecas: Number(numValorPecas.toFixed(2)),
        valor_mao_de_obra: Number(numValorMaoDeObra.toFixed(2)),
        garantia_ate: garantiaAte ? garantiaAte : null,
        comprovante_url: comprovanteUrl,
        status,
        forma_pagamento: formaPagamento,
        qtd_parcelas: formaPagamento === 'parcelado' ? parsedQtd : 1,
        valor_parcela: formaPagamento === 'parcelado' ? Number(parsedValParc.toFixed(2)) : null,
        mes_primeira_parcela: formaPagamento === 'parcelado' ? (mesPrimeiraParcela || data) : null,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('maintenance_logs')
        .insert(payload)
        .select('*')
        .single();

      if (insertError) {
        throw insertError;
      }

      setFormSuccess(
        status === 'orcamento'
          ? 'Orçamento pendente registrado com sucesso!'
          : 'Serviço realizado registrado com sucesso!'
      );
      setIsFormOpen(false);

      if (inserted) {
        setMaintenanceLogs((prev) => [inserted as MaintenanceLog, ...prev]);
      } else {
        await refreshMaintenanceLogs();
      }

      // Limpa os campos
      setStatus('realizado');
      setOficinaNome('');
      setDescricaoServico('');
      setValorPecas('0');
      setValorMaoDeObra('0');
      setGarantiaAte('');
      setFormaPagamento('avista');
      setQtdParcelas('2');
      setValorParcela('');
      setMesPrimeiraParcela(getTodayString());
      setSelectedFile(null);

      setTimeout(() => {
        setFormSuccess(null);
      }, 4000);
    } catch (err: unknown) {
      console.error('Erro ao salvar manutenção:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao salvar manutenção.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  // Exclusão de registro de manutenção
  const handleDelete = async (id: string) => {
    if (!user) return;
    setDeletingId(id);

    try {
      const { error } = await supabase
        .from('maintenance_logs')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setMaintenanceLogs((prev) => prev.filter((item) => item.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Erro ao excluir manutenção:', err);
      alert('Não foi possível excluir o registro. Tente novamente.');
    } finally {
      setDeletingId(null);
    }
  };

  // Totais acumulados
  const totalGastoManutencao = useMemo(() => {
    return maintenanceLogs.reduce((acc, curr) => {
      const total =
        typeof curr.valor_total === 'number'
          ? curr.valor_total
          : curr.valor_pecas + curr.valor_mao_de_obra;
      return acc + total;
    }, 0);
  }, [maintenanceLogs]);

  const totalEmPecas = useMemo(() => {
    return maintenanceLogs.reduce((acc, curr) => acc + (curr.valor_pecas || 0), 0);
  }, [maintenanceLogs]);

  const totalEmMaoDeObra = useMemo(() => {
    return maintenanceLogs.reduce((acc, curr) => acc + (curr.valor_mao_de_obra || 0), 0);
  }, [maintenanceLogs]);

  const servicosEmGarantia = useMemo(() => {
    return maintenanceLogs.filter((item) => {
      if (!item.garantia_ate) return false;
      return item.garantia_ate >= today;
    }).length;
  }, [maintenanceLogs, today]);

  // Renderiza o formulário de oficina (compartilhado entre desktop e Bottom Sheet mobile)
  const renderMaintenanceForm = (isModal: boolean = false) => (
    <div
      className={`space-y-4 ${
        isModal
          ? ''
          : 'bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-7 relative overflow-hidden backdrop-blur-md'
      }`}
    >
      {!isModal && (
        <>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-cyan-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
                <Wrench className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  Registrar Manutenção ou Revisão
                </h2>
                <p className="text-xs text-slate-400">
                  Guarde histórico de oficinas, notas fiscais e garantias
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
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

      {/* SELETOR VISUAL: TIPO DE REGISTRO (Serviço Realizado vs Orçamento Pendente) */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-300 mb-2">
          Tipo de Lançamento
        </label>
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => setStatus('realizado')}
            className={`relative flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer select-none ${
              status === 'realizado'
                ? 'text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {status === 'realizado' && (
              <motion.div
                layoutId="maintenanceFormStatusIndicator"
                className="absolute inset-0 bg-blue-600 rounded-xl -z-10 shadow-lg shadow-blue-600/30"
                transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              />
            )}
            <Wrench className="w-4 h-4 stroke-[2.2]" />
            <span>🛠️ Serviço Realizado</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => setStatus('orcamento')}
            className={`relative flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer select-none ${
              status === 'orcamento'
                ? 'text-slate-950 font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {status === 'orcamento' && (
              <motion.div
                layoutId="maintenanceFormStatusIndicator"
                className="absolute inset-0 bg-amber-500 rounded-xl -z-10 shadow-lg shadow-amber-500/30"
                transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              />
            )}
            <ClipboardList className="w-4 h-4 stroke-[2.2]" />
            <span>📋 Orçamento</span>
          </motion.button>
        </div>
      </div>

      {/* VISOR EM TEMPO REAL: VALOR TOTAL */}
      <div
        className={`rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border-2 p-4 sm:p-5 relative shadow-inner transition-colors ${
          status === 'realizado' ? 'border-blue-500/40' : 'border-amber-500/40'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div
              className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${
                status === 'realizado' ? 'text-blue-400' : 'text-amber-400'
              }`}
            >
              {status === 'realizado' ? <Wrench className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
              {status === 'realizado' ? 'Valor Total do Serviço' : 'Valor Total do Orçamento'}
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white mt-1 tracking-tight font-mono">
              {formatCurrency(valorTotalEstimado)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800 text-[11px] text-slate-300">
            <span className="bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
              Peças: {formatCurrency(numValorPecas)}
            </span>
            <span className="text-slate-500">+</span>
            <span className="bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
              Mão de Obra: {formatCurrency(numValorMaoDeObra)}
            </span>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Data */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {status === 'realizado' ? 'Data do Serviço' : 'Data do Orçamento'}
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
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Nome da Oficina */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Oficina ou Mecânico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Building className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={oficinaNome}
                onChange={(e) => setOficinaNome(e.target.value)}
                placeholder="Ex: Auto Mecânica Silva"
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Valor Peças */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Valor das Peças 
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={valorPecas}
                onChange={(e) => handlePecasChange(e.target.value)}
                placeholder="0.00"
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono"
              />
            </div>
          </div>

          {/* Valor Mão de Obra */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Valor da Mão de Obra 
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={valorMaoDeObra}
                onChange={(e) => handleMaoDeObraChange(e.target.value)}
                placeholder="0.00"
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono"
              />
            </div>
          </div>

          {/* Garantia Até */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Garantia Válida Até (Opcional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <input
                type="date"
                value={garantiaAte}
                onChange={(e) => setGarantiaAte(e.target.value)}
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* SELETOR DE FORMA DE PAGAMENTO */}
          <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-blue-400" />
                Forma de Pagamento
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setFormaPagamento('avista')}
                  className={`relative flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer select-none ${
                    formaPagamento === 'avista'
                      ? 'text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {formaPagamento === 'avista' && (
                    <motion.div
                      layoutId="paymentMethodIndicator"
                      className="absolute inset-0 bg-emerald-600 rounded-xl -z-10 shadow-md shadow-emerald-600/30"
                      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                    />
                  )}
                  <span>💵 À Vista</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setFormaPagamento('parcelado');
                    const q = parseInt(qtdParcelas, 10) || 2;
                    setValorParcela((valorTotalEstimado / q).toFixed(2));
                  }}
                  className={`relative flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer select-none ${
                    formaPagamento === 'parcelado'
                      ? 'text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {formaPagamento === 'parcelado' && (
                    <motion.div
                      layoutId="paymentMethodIndicator"
                      className="absolute inset-0 bg-blue-600 rounded-xl -z-10 shadow-md shadow-blue-600/30"
                      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                    />
                  )}
                  <span>💳 Parcelado</span>
                </motion.button>
              </div>
            </div>

            {/* CAMPOS QUANDO PARCELADO */}
            {formaPagamento === 'parcelado' && (
              <div className="pt-3 border-t border-slate-800 space-y-3 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Quantidade de Parcelas */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Quantidade de Parcelas
                    </label>
                    <select
                      value={qtdParcelas}
                      onChange={(e) => {
                        const q = e.target.value;
                        setQtdParcelas(q);
                        const numQ = parseInt(q, 10) || 1;
                        setValorParcela((valorTotalEstimado / numQ).toFixed(2));
                      }}
                      className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    >
                      {Array.from({ length: 23 }, (_, i) => i + 2).map((num) => (
                        <option key={num} value={num}>
                          {num}x parcelas
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Valor de Cada Parcela */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Valor da Parcela (R$)</span>
                      <span className="text-[10px] text-slate-400">Editável se tiver juros</span>
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
                        value={valorParcela}
                        onChange={(e) => setValorParcela(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-emerald-400 font-mono font-bold text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Mês/Data da 1ª Parcela */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Data / Mês da 1ª Parcela
                    </label>
                    <input
                      type="date"
                      value={mesPrimeiraParcela}
                      onChange={(e) => setMesPrimeiraParcela(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* Resumo do Parcelamento */}
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>
                      Total do Serviço: <strong>{formatCurrency(valorTotalEstimado)}</strong> →{' '}
                      <strong>{qtdParcelas}x de {formatCurrency(parseFloat(valorParcela) || 0)}</strong>
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    Impacto mensal no caixa: {formatCurrency(parseFloat(valorParcela) || 0)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Descrição do Serviço */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            {status === 'realizado'
              ? 'Descrição do Serviço Realizado'
              : 'Descrição do Orçamento / Itens a Realizar'}
          </label>
          <div className="relative">
            <textarea
              required
              rows={2}
              value={descricaoServico}
              onChange={(e) => setDescricaoServico(e.target.value)}
              placeholder={
                status === 'realizado'
                  ? 'Ex: Troca de correia dentada, óleo do motor e pastilhas de freio'
                  : 'Ex: Cotação para troca de amortecedores dianteiros e alinhamento'
              }
              className="w-full px-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Upload de Comprovante (Storage comprovantes_oficina) */}
        <div className="pt-2">
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            {status === 'realizado'
              ? 'Nota Fiscal / Comprovante Final (PDF, JPG ou PNG)'
              : 'Foto / PDF do Orçamento (PDF, JPG ou PNG)'}
          </label>

          {!selectedFile ? (
            <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-blue-500/70 rounded-2xl bg-slate-950/50 hover:bg-slate-950 cursor-pointer transition active:scale-[0.99] group">
              <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-400 mb-2 transition" />
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white">
                {status === 'realizado'
                  ? 'Clique ou arraste a nota fiscal aqui'
                  : 'Clique ou arraste a foto do orçamento aqui'}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Salvo com segurança no Supabase Storage
              </span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-blue-500/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <Paperclip className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
                    {selectedFile.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Botão de Salvar */}
        <div className="pt-2">
          <motion.button
            type="submit"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.96 }}
            disabled={submitting}
            className={`w-full h-12 min-h-[48px] px-4 font-bold text-sm sm:text-base rounded-2xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
              status === 'realizado'
                ? 'bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-slate-950 shadow-blue-500/25'
                : 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-amber-500/25 font-black'
            }`}
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                {uploadProgress || 'Salvando...'}
              </>
            ) : status === 'realizado' ? (
              <>
                <Wrench className="w-5 h-5 stroke-[2.2]" />
                Salvar Serviço Realizado
              </>
            ) : (
              <>
                <ClipboardList className="w-5 h-5 stroke-[2.2]" />
                Salvar Orçamento Pendente
              </>
            )}
          </motion.button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cards de Métricas Resumo */}
      {maintenanceLogs.length > 0 && (
        <SwipeableCarousel totalItems={4} gridClassName="md:grid-cols-4">
          <div className="min-w-[70vw] sm:min-w-[220px] snap-center shrink-0 md:min-w-0 md:w-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Investido
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-blue-400 mt-1 block">
              {formatCurrency(totalGastoManutencao)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {maintenanceLogs.length} serviços
            </span>
          </div>

          <div className="min-w-[70vw] sm:min-w-[220px] snap-center shrink-0 md:min-w-0 md:w-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Peças
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-white mt-1 block">
              {formatCurrency(totalEmPecas)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {totalGastoManutencao > 0 ? `${((totalEmPecas / totalGastoManutencao) * 100).toFixed(0)}% do total` : '-'}
            </span>
          </div>

          <div className="min-w-[70vw] sm:min-w-[220px] snap-center shrink-0 md:min-w-0 md:w-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Mão de Obra
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-teal-400 mt-1 block">
              {formatCurrency(totalEmMaoDeObra)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {totalGastoManutencao > 0 ? `${((totalEmMaoDeObra / totalGastoManutencao) * 100).toFixed(0)}% do total` : '-'}
            </span>
          </div>

          <div className="min-w-[70vw] sm:min-w-[220px] snap-center shrink-0 md:min-w-0 md:w-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Em Garantia
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-emerald-400 mt-1 block">
              {servicosEmGarantia}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              serviços ativos
            </span>
          </div>
        </SwipeableCarousel>
      )}

      {/* LAYOUT PRINCIPAL: No desktop, exibe o formulário na coluna lateral aberta (lg:grid) e o histórico na direita */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-6 items-start">
        {/* FORMULÁRIO LATERAL NO DESKTOP (Aberto e fixo na visão desktop) */}
        <div id="maintenance-form-section" className="hidden lg:block lg:col-span-5 sticky top-24">
          {renderMaintenanceForm(false)}
        </div>

        {/* COLUNA DO HISTÓRICO (Largura total no mobile, coluna direita no desktop) */}
        <div className="lg:col-span-7 space-y-4">
          {/* BARRA DE FILTRAGEM AVANÇADA (MÊS, QUINZENA, BUSCA E ORDENAÇÃO) */}
          <HistoryFilterBar
            filterState={filterState}
            onFilterChange={setFilterState}
            profile={profile}
            searchPlaceholder="Buscar por oficina, serviço (óleo, pneu), status..."
            totalFilteredCount={filteredLogs.length}
          />

          {/* RESUMO DO FILTRO ATIVO (TOTALIZADOR DINÂMICO) */}
          <MaintenanceFilterSummary
            items={filteredLogs}
            filterState={filterState}
            profile={profile}
            vehicle={vehicle}
          />

          {/* Filtros Rápidos: Todos vs Serviços Realizados vs Orçamentos Pendentes */}
          <div className="flex flex-wrap items-center gap-2 pt-1 px-1">
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`py-2 px-3.5 min-h-[40px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-100 text-slate-950 border-white font-bold shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
              }`}
            >
              Todos ({dateFilteredLogs.length})
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setStatusFilter('realizado')}
              className={`py-2 px-3.5 min-h-[40px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'realizado'
                  ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-md shadow-blue-600/30'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Serviços Realizados ({realizadosCount})</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setStatusFilter('orcamento')}
              className={`py-2 px-3.5 min-h-[40px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'orcamento'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md shadow-amber-500/30'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Orçamentos Pendentes</span>
              {orcamentosCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    statusFilter === 'orcamento'
                      ? 'bg-slate-950 text-amber-300'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {orcamentosCount}
                </span>
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setStatusFilter('parcelado')}
              className={`py-2 px-3.5 min-h-[40px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'parcelado'
                  ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-md shadow-blue-600/30'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>💳 Serviços Parcelados</span>
              {parceladosCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    statusFilter === 'parcelado'
                      ? 'bg-slate-950 text-blue-300'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}
                >
                  {parceladosCount}
                </span>
              )}
            </motion.button>
          </div>

          {/* CARD RESUMO EXCLUSIVO DA ABA PARCELADOS */}
          {statusFilter === 'parcelado' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-950 border border-blue-500/30 shadow-lg space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                      Comprometimento Mensal com Oficina neste Mês
                    </h4>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-1">
                    {formatCurrency(parcelamentoResumo.comprometimentoMensal)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {parcelamentoResumo.activeCount === 0
                      ? 'Nenhuma parcela vencendo no período selecionado'
                      : `${parcelamentoResumo.activeCount} ${parcelamentoResumo.activeCount === 1 ? 'parcela ativa impactando o caixa' : 'parcelas ativas impactando o caixa'}`}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-left sm:text-right shrink-0">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block tracking-wider">
                    Total Restante a Pagar em Parcelas Futuras:
                  </span>
                  <span className="text-base sm:text-lg font-black text-amber-400 font-mono block mt-0.5">
                    {formatCurrency(parcelamentoResumo.totalRestanteFuturo)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* HISTÓRICO DE MANUTENÇÕES E ORÇAMENTOS */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1 gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Histórico da Oficina e Orçamentos
                  </h3>
                  {maintenanceLogs.length > 0 && (
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                      {maintenanceLogs.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Serviços executados, orçamentos, garantias e comprovantes
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                {/* Botão de Ação Rápida no Cabeçalho da Lista */}
                <button
                  type="button"
                  onClick={handleOpenNewForm}
                  className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-bold bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-slate-950 shadow-md shadow-blue-500/20 active:scale-95 transition cursor-pointer select-none shrink-0"
                  aria-label="Novo Serviço ou Orçamento"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span className="hidden xs:inline">+ Oficina</span>
                  <span className="xs:hidden">+ Novo</span>
                </button>

                {filteredLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAllExpanded}
                    title={isAllExpanded ? 'Recolher todos os registros' : 'Expandir todos os registros'}
                    aria-label={isAllExpanded ? 'Recolher todos os registros' : 'Expandir todos os registros'}
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
                        isAllExpanded ? 'rotate-180 text-blue-400' : ''
                      }`}
                    />
                  </button>
                )}

                <button
                  type="button"
                  onClick={refreshMaintenanceLogs}
                  disabled={loadingList}
                  title="Atualizar lista"
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition cursor-pointer"
                >
                  <RotateCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Loading Skeleton */}
        {loadingList && maintenanceLogs.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 bg-slate-900/60 rounded-2xl border border-slate-800 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty State Sem Registros Totais */}
        {!loadingList && maintenanceLogs.length === 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Wrench className="w-6 h-6 text-blue-400" />
            </div>
            <h4 className="text-sm font-bold text-white">Nenhum registro encontrado</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Utilize o formulário acima para registrar manutenções, peças e notas fiscais.
            </p>
          </div>
        )}

        {/* Empty State com Filtro Ativo */}
        {!loadingList && maintenanceLogs.length > 0 && filteredLogs.length === 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Info className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Nenhum lançamento encontrado neste período</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Não foram encontrados serviços ou orçamentos para o mês ou termos de busca selecionados.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFilterState(getDefaultFilterState());
                setStatusFilter('all');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-bold transition active:scale-95 cursor-pointer border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpar Filtros e Ver Todos
            </button>
          </div>
        )}

        {/* Lista de Registros */}
        <motion.div
          key={`${filterState.monthYear}-${filterState.periodChip}-${statusFilter}`}
          variants={staggerContainerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-2.5"
        >
          <AnimatePresence mode="popLayout">
            {filteredLogs.map((item) => {
              const total =
                typeof item.valor_total === 'number'
                  ? item.valor_total
                  : item.valor_pecas + item.valor_mao_de_obra;

              const isOrcamento = item.status === 'orcamento';
              const isWarrantyActive = !isOrcamento && item.garantia_ate && item.garantia_ate >= today;
              const hasWarrantyExpired = !isOrcamento && item.garantia_ate && item.garantia_ate < today;
              const instInfo = calculateMaintenanceInstallmentInfo(item, filterState.monthYear);

              const isConfirming = confirmDeleteId === item.id;
              const isDeleting = deletingId === item.id;
              const { fullBadge, formattedDate, paymentCycleBadge } = formatCardDateBadge(item.data, profile);

              const dateParts = formattedDate ? formattedDate.split(' ') : [];
              const dayAndMonth = dateParts.length >= 2 ? `${dateParts[0]} ${dateParts[1]}` : item.data;
              const isExpanded = isAllExpanded || expandedId === item.id;

              return (
                <motion.div
                  key={item.id}
                  layout
                  variants={staggerItemVariants}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                  className={`bg-slate-900 border rounded-2xl overflow-hidden shadow-sm transition-colors ${
                    isOrcamento
                      ? 'border-amber-500/40 hover:border-amber-500/60'
                      : 'border-slate-800/80 hover:border-slate-700/80'
                  }`}
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
                    className="w-full flex items-center justify-between py-3 px-4 text-left cursor-pointer hover:bg-slate-800/40 active:bg-slate-800/60 transition select-none gap-2 min-h-[48px]"
                  >
                    {/* Esquerda: Data + Nome do Serviço/Oficina (truncate) + Badge/Dot de status */}
                    <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono tracking-tight shrink-0 border border-slate-700/50">
                        {dayAndMonth}
                      </span>

                      <span className="text-xs font-bold text-white truncate max-w-[120px] xs:max-w-[170px] sm:max-w-[260px]">
                        {item.descricao_servico || item.oficina_nome}
                      </span>

                      {/* Badge / Dot de status */}
                      {isOrcamento ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                          <ClipboardList className="w-3 h-3" />
                          <span>Orçamento</span>
                        </span>
                      ) : instInfo.isParcelado ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 shrink-0">
                          <CreditCard className="w-3 h-3 text-blue-400" />
                          <span>Parcela {instInfo.currentInstallmentNumber}/{instInfo.totalParcelas}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                          <Wrench className="w-3 h-3" />
                          <span>Realizado</span>
                        </span>
                      )}
                    </div>

                    {/* Direita: Valor total + ChevronDown */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-sm sm:text-base font-black font-mono ${
                          isOrcamento ? 'text-amber-400' : 'text-blue-400'
                        }`}
                      >
                        {formatCurrency(total)}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-blue-400' : ''
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
                        className="overflow-hidden border-t border-slate-800/60 px-4 pt-3 pb-4 space-y-3"
                      >
                        {/* Grid Completo de Detalhes */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                              Oficina / Local
                            </span>
                            <span className="font-bold text-white text-xs sm:text-sm mt-0.5 block truncate" title={item.oficina_nome}>
                              {item.oficina_nome}
                            </span>
                          </div>

                          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                              Peças
                            </span>
                            <span className="font-mono font-bold text-slate-200 text-xs sm:text-sm mt-0.5 block">
                              {formatCurrency(item.valor_pecas)}
                            </span>
                          </div>

                          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                              Mão de Obra
                            </span>
                            <span className="font-mono font-bold text-slate-200 text-xs sm:text-sm mt-0.5 block">
                              {formatCurrency(item.valor_mao_de_obra)}
                            </span>
                          </div>

                          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                              Valor Total
                            </span>
                            <span
                              className={`font-mono font-black text-xs sm:text-sm mt-0.5 block ${
                                isOrcamento ? 'text-amber-400' : 'text-blue-400'
                              }`}
                            >
                              {formatCurrency(total)}
                            </span>
                          </div>
                        </div>

                        {/* Descrição Completa do Serviço */}
                        {item.descricao_servico && (
                          <div className="text-xs text-slate-300 bg-slate-950/50 p-3 rounded-xl border border-slate-800/60 leading-relaxed">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                              Descrição do Serviço
                            </span>
                            {item.descricao_servico}
                          </div>
                        )}

                        {/* Badges de Garantia se houver */}
                        {item.garantia_ate && !isOrcamento && (
                          <div className="flex items-center gap-2 text-xs">
                            {isWarrantyActive ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                Na Garantia até {formatDate(item.garantia_ate)}
                              </span>
                            ) : hasWarrantyExpired ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 font-semibold">
                                <ShieldAlert className="w-4 h-4 text-slate-400" />
                                Garantia Expirada ({formatDate(item.garantia_ate)})
                              </span>
                            ) : null}
                          </div>
                        )}

                        {/* BLOCO DE GESTÃO DE PARCELAS */}
                        {instInfo.isParcelado && (
                          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                                <CreditCard className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <span>{instInfo.badgeLabel}</span>
                              </span>
                              <span className="text-[11px] font-mono text-blue-400 font-bold">
                                {instInfo.progressPercent}% quitado
                              </span>
                            </div>

                            {/* Barra de Progresso Visual */}
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(instInfo.progressPercent, 100)}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-0.5 flex-wrap gap-1">
                              <span>1ª Parcela: {formatDate(instInfo.firstInstallmentDate)}</span>
                              <span>Impacto mensal no caixa: {formatCurrency(instInfo.valorParcela)}</span>
                            </div>
                          </div>
                        )}

                        {/* Referência da Data e Ciclo */}
                        <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-950/40 px-3 py-2 rounded-xl border border-slate-800/40 flex-wrap gap-2">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-blue-400" />
                            <span>{fullBadge}</span>
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            Ref: {paymentCycleBadge}
                          </span>
                        </div>

                        {/* BOTÃO RÁPIDO: APROVAR E CONVERTER ORÇAMENTO EM SERVIÇO REALIZADO */}
                        {isOrcamento && (
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            whileHover={{ scale: 1.01 }}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalMode('approve');
                              setEditingMaintenanceLog(item);
                            }}
                            className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:from-emerald-600 active:to-teal-600 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/25 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4 stroke-[2.8]" />
                            <span>Aprovar e Concluir Serviço</span>
                          </motion.button>
                        )}

                        {/* Barra de Ações Rápidas no Rodapé */}
                        <div
                          className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60 flex-wrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Botão Ver Comprovante / Anexo à esquerda */}
                          <div>
                            {item.comprovante_url && (
                              <a
                                href={item.comprovante_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title={isOrcamento ? 'Ver Orçamento Anexado' : 'Ver Nota Fiscal / Comprovante'}
                                className="h-9 px-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-semibold transition cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>{isOrcamento ? 'Ver Anexo' : 'Ver Comprovante'}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>

                          {/* Ações: Editar e Excluir */}
                          <div className="flex items-center gap-2 ml-auto">
                            {!isConfirming ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setModalMode('edit');
                                    setEditingMaintenanceLog(item);
                                  }}
                                  className="h-9 px-3 flex items-center gap-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-800 hover:text-blue-400 border border-slate-700/60 active:scale-[0.96] transition cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>Editar Registro</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(item.id);
                                  }}
                                  className="h-9 px-3 flex items-center gap-1.5 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 active:scale-[0.96] transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Excluir</span>
                                </button>
                              </>
                            ) : (
                              <div className="flex items-center gap-2 bg-rose-950/90 border border-rose-600/50 p-1.5 rounded-xl">
                                <span className="text-xs font-semibold text-rose-300 px-1">
                                  Confirmar exclusão?
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(item.id);
                                  }}
                                  disabled={isDeleting}
                                  className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition active:scale-[0.96] cursor-pointer"
                                >
                                  {isDeleting ? '...' : 'Sim, Excluir'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(null);
                                  }}
                                  className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition active:scale-[0.96] cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>
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

      {/* Modal Responsivo de Edição / Aprovação de Manutenção */}
      {editingMaintenanceLog && user && (
        <EditMaintenanceModal
          key={`${editingMaintenanceLog.id}-${modalMode}`}
          isOpen={!!editingMaintenanceLog}
          maintenanceLog={editingMaintenanceLog}
          userId={user.id}
          mode={modalMode}
          onClose={() => setEditingMaintenanceLog(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Botão de Ação Flutuante (FAB) Mobile */}
      <FloatingActionButton
        label="+ Oficina"
        onClick={handleOpenNewForm}
      />

      {/* Gaveta Inferior Deslizante (Bottom Sheet) no Mobile */}
      <BottomSheetModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Registrar Manutenção ou Revisão"
        subtitle="Guarde histórico de oficinas, notas fiscais e garantias"
        icon={
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-cyan-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
            <Wrench className="w-5 h-5 stroke-[2.2]" />
          </div>
        }
      >
        {renderMaintenanceForm(true)}
      </BottomSheetModal>
    </div>
  );
};
