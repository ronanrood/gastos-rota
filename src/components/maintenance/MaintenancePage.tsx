import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import type { MaintenanceLog, MaintenanceLogInsert } from '../../types/database';
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
} from 'lucide-react';

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
  const { user } = useAuth();

  // Estados do formulário
  const [today] = useState<string>(getTodayString);
  const [data, setData] = useState<string>(getTodayString);
  const [oficinaNome, setOficinaNome] = useState('');
  const [descricaoServico, setDescricaoServico] = useState('');
  const [valorPecas, setValorPecas] = useState<string>('0');
  const [valorMaoDeObra, setValorMaoDeObra] = useState<string>('0');
  const [garantiaAte, setGarantiaAte] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Estados de controle e listagem
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Cálculo em tempo real do Valor Total (Peças + Mão de Obra)
  const numValorPecas = parseFloat(valorPecas) || 0;
  const numValorMaoDeObra = parseFloat(valorMaoDeObra) || 0;

  const valorTotalEstimado = useMemo(() => {
    return numValorPecas + numValorMaoDeObra;
  }, [numValorPecas, numValorMaoDeObra]);

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
        const { data: rows, error } = await supabase
          .from('maintenance_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('data', { ascending: false })
          .order('created_at', { ascending: false });

        if (!ignore) {
          if (error) {
            console.error('Erro ao carregar manutenções:', error.message);
          } else if (rows) {
            setMaintenanceLogs(rows as MaintenanceLog[]);
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
      const payload: MaintenanceLogInsert = {
        user_id: user.id,
        data,
        oficina_nome: oficinaNome.trim(),
        descricao_servico: descricaoServico.trim(),
        valor_pecas: Number(numValorPecas.toFixed(2)),
        valor_mao_de_obra: Number(numValorMaoDeObra.toFixed(2)),
        garantia_ate: garantiaAte ? garantiaAte : null,
        comprovante_url: comprovanteUrl,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('maintenance_logs')
        .insert(payload)
        .select('*')
        .single();

      if (insertError) {
        throw insertError;
      }

      setFormSuccess('Manutenção registrada com sucesso!');

      if (inserted) {
        setMaintenanceLogs((prev) => [inserted as MaintenanceLog, ...prev]);
      } else {
        await refreshMaintenanceLogs();
      }

      // Limpa os campos
      setOficinaNome('');
      setDescricaoServico('');
      setValorPecas('0');
      setValorMaoDeObra('0');
      setGarantiaAte('');
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

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Cards de Métricas Resumo */}
      {maintenanceLogs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 backdrop-blur-sm">
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

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 backdrop-blur-sm">
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

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 backdrop-blur-sm">
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

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 backdrop-blur-sm">
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
        </div>
      )}

      {/* CARD PRINCIPAL: FORMULÁRIO DE MANUTENÇÃO */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-7 relative overflow-hidden backdrop-blur-md">
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
            Cálculo em tempo real
          </span>
        </div>

        {/* FEEDBACKS */}
        {formError && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Erro</p>
              <p className="text-rose-300/90">{formError}</p>
            </div>
          </div>
        )}

        {formSuccess && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-semibold">{formSuccess}</div>
          </div>
        )}

        {/* VISOR EM TEMPO REAL: VALOR TOTAL */}
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border-2 border-blue-500/40 p-4 sm:p-5 relative shadow-inner">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-400">
                <DollarSign className="w-4 h-4" />
                Valor Total do Serviço
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {/* Data */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Data do Serviço
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
                Oficina ou Mecânico (`oficina_nome`)
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
                Valor das Peças (`valor_pecas`)
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
                  onChange={(e) => setValorPecas(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono"
                />
              </div>
            </div>

            {/* Valor Mão de Obra */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Valor da Mão de Obra (`valor_mao_de_obra`)
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
                  onChange={(e) => setValorMaoDeObra(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono"
                />
              </div>
            </div>

            {/* Garantia Até */}
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Garantia Válida Até (`garantia_ate` - opcional)
              </label>
              <div className="relative max-w-sm">
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
          </div>

          {/* Descrição do Serviço */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Descrição do Serviço Realizado (`descricao_servico`)
            </label>
            <div className="relative">
              <textarea
                required
                rows={2}
                value={descricaoServico}
                onChange={(e) => setDescricaoServico(e.target.value)}
                placeholder="Ex: Troca de correia dentada, tensor, óleo do motor 5W30 e filtro de ar"
                className="w-full px-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Upload de Comprovante (Storage comprovantes_oficina) */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Anexo / Nota Fiscal / Comprovante (PDF, JPG ou PNG)
            </label>

            {!selectedFile ? (
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-blue-500/70 rounded-2xl bg-slate-950/50 hover:bg-slate-950 cursor-pointer transition active:scale-[0.99] group">
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-400 mb-2 transition" />
                <span className="text-xs font-semibold text-slate-300 group-hover:text-white">
                  Clique ou arraste o comprovante aqui
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Salvo automaticamente no bucket `comprovantes_oficina`
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
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 min-h-[48px] px-4 bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-slate-950 font-bold text-sm sm:text-base rounded-2xl shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  {uploadProgress || 'Salvando Manutenção...'}
                </>
              ) : (
                <>
                  <Wrench className="w-5 h-5 stroke-[2.2]" />
                  Salvar Manutenção
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* HISTÓRICO DE MANUTENÇÕES */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Histórico de Manutenções
            </h3>
            <p className="text-xs text-slate-400">
              Serviços efetuados, garantias e comprovantes
            </p>
          </div>

          <button
            type="button"
            onClick={refreshMaintenanceLogs}
            disabled={loadingList}
            title="Atualizar lista"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
          </button>
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

        {/* Empty State */}
        {!loadingList && maintenanceLogs.length === 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Wrench className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">Nenhuma manutenção registrada</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Utilize o formulário acima para registrar trocas de óleo, revisões de freios e anexar notas fiscais.
            </p>
          </div>
        )}

        {/* Lista de Registros */}
        <div className="space-y-3">
          {maintenanceLogs.map((item) => {
            const total =
              typeof item.valor_total === 'number'
                ? item.valor_total
                : item.valor_pecas + item.valor_mao_de_obra;

            const isWarrantyActive = item.garantia_ate && item.garantia_ate >= today;
            const hasWarrantyExpired = item.garantia_ate && item.garantia_ate < today;

            const isConfirming = confirmDeleteId === item.id;
            const isDeleting = deletingId === item.id;

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 transition shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono">
                        {formatDate(item.data)}
                      </span>
                      <span className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-xs">
                        {item.oficina_nome}
                      </span>

                      {/* Badge de Garantia */}
                      {isWarrantyActive && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <ShieldCheck className="w-3 h-3" />
                          Na Garantia (até {formatDate(item.garantia_ate!)})
                        </span>
                      )}

                      {hasWarrantyExpired && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                          <ShieldAlert className="w-3 h-3" />
                          Garantia Expirada ({formatDate(item.garantia_ate!)})
                        </span>
                      )}
                    </div>

                    <div className="text-xl sm:text-2xl font-black text-blue-400 mt-1.5 font-mono">
                      {formatCurrency(total)}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Botão Ver Comprovante */}
                    {item.comprovante_url && (
                      <a
                        href={item.comprovante_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver Comprovante / Nota Fiscal"
                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-semibold transition active:scale-[0.96]"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Comprovante</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {/* Excluir */}
                    {isConfirming ? (
                      <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-600/50 p-1.5 rounded-xl">
                        <span className="text-[11px] font-semibold text-rose-300 px-1">
                          Excluir?
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={isDeleting}
                          className="min-h-[40px] px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition active:scale-[0.96] cursor-pointer"
                        >
                          {isDeleting ? '...' : 'Sim'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition active:scale-[0.96] cursor-pointer"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        aria-label="Excluir manutenção"
                        title="Excluir este registro"
                        className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 active:bg-rose-500/20 active:scale-[0.95] transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Descrição do Serviço */}
                <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {item.descricao_servico}
                </p>

                {/* Badges de Valores */}
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 font-mono">
                    Peças: <strong className="text-slate-200">{formatCurrency(item.valor_pecas)}</strong>
                  </span>
                  <span className="bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 font-mono">
                    Mão de Obra: <strong className="text-slate-200">{formatCurrency(item.valor_mao_de_obra)}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
