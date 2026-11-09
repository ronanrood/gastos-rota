import React, { useRef, useState } from 'react';
import {
  Printer,
  X,
  Share2,
  Copy,
  Check,
  FileText,
} from 'lucide-react';
import type { DailyEarning, FuelLog, MaintenanceLog, Profile, Vehicle } from '../../types/database';
import {
  formatCurrency,
  formatDateBR,
  formatDateTimeNow,
  copyToClipboard,
  openWhatsAppShare,
  generateWhatsAppEarningsText,
  generateWhatsAppFuelText,
  generateWhatsAppMaintenanceText,
  generateWhatsAppDashboardText,
} from '../../utils/exportUtils';

export type ReportType = 'earnings' | 'fuel' | 'maintenance' | 'dashboard';

interface ReportPrintModalProps {
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
}) => {
  const [copied, setCopied] = useState(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Gerar texto do WhatsApp de acordo com o tipo
  const getWhatsAppText = (): string => {
    if (reportType === 'earnings') {
      return generateWhatsAppEarningsText({
        profile,
        periodLabel,
        items: earningsItems,
        paymentNotice,
        vehicle,
      });
    }
    if (reportType === 'fuel') {
      return generateWhatsAppFuelText({
        profile,
        periodLabel,
        items: fuelItems,
        vehicle,
      });
    }
    if (reportType === 'maintenance') {
      return generateWhatsAppMaintenanceText({
        profile,
        periodLabel,
        items: maintenanceItems,
        vehicle,
      });
    }
    if (reportType === 'dashboard' && dashboardData) {
      return generateWhatsAppDashboardText({
        profile,
        periodLabel,
        faturamentoBruto: dashboardData.faturamentoBruto,
        despesasCombustivel: dashboardData.despesasCombustivel,
        despesasOficina: dashboardData.despesasOficina,
        despesasTotais: dashboardData.despesasTotais,
        lucroLiquidoReal: dashboardData.lucroLiquidoReal,
        totalKmRodados: dashboardData.totalKmRodados,
        diasProducao: dashboardData.diasProducao,
        vehicle,
      });
    }
    return '';
  };

  const handleCopy = async () => {
    const text = getWhatsAppText();
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleWhatsApp = () => {
    const text = getWhatsAppText();
    openWhatsAppShare(text);
  };

  const handlePrint = () => {
    window.print();
  };

  // Título e identificadores
  const reportTitles: Record<ReportType, { title: string; subtitle: string }> = {
    earnings: {
      title: 'Extrato de Fechamento de Rota e Diárias',
      subtitle: 'Relatório detalhado de produção diária, peças, bônus e total líquido a repassar',
    },
    fuel: {
      title: 'Relatório de Consumo e Abastecimento de Combustível',
      subtitle: 'Registro de abastecimentos, volumetria e controle financeiro de combustível',
    },
    maintenance: {
      title: 'Relatório de Oficina, Peças e Manutenção',
      subtitle: 'Controle de manutenções realizadas, orçamentos preventivos e garantias',
    },
    dashboard: {
      title: 'Extrato Financeiro Consolidado da Operação',
      subtitle: 'Visão executiva com faturamento bruto, custos operacionais e margem líquida real',
    },
  };

  const { title: docTitle, subtitle: docSubtitle } = reportTitles[reportType];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto">
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

      {/* Modal Card Wrapper */}
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:rounded-none print:bg-white">
        {/* Barra Superior de Ações (Oculta na impressão) */}
        <div className="p-3.5 sm:p-5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Pré-visualização do Relatório / Extrato
              </h3>
              <p className="text-[11px] text-slate-400">
                Pronto para salvar em PDF, imprimir ou compartilhar no WhatsApp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Botão Copiar Texto */}
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95 cursor-pointer border border-slate-700"
              title="Copiar texto formatado para o WhatsApp"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copiar Texto</span>
                </>
              )}
            </button>

            {/* Botão Enviar no WhatsApp */}
            <button
              type="button"
              onClick={handleWhatsApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-md shadow-emerald-600/20"
              title="Abrir no WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Enviar WhatsApp</span>
            </button>

            {/* Botão Imprimir / Salvar PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-md shadow-blue-600/20"
              title="Imprimir ou Salvar como PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / Salvar PDF</span>
            </button>

            {/* Fechar */}
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 min-h-[40px] min-w-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              title="Fechar janela"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ÁREA DO DOCUMENTO DE IMPRESSÃO (Folha A4 Estilizada) */}
        <div className="overflow-y-auto p-3 sm:p-6 bg-slate-900/60 print:p-0 print:overflow-visible">
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

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  CPF / CNPJ
                </span>
                <span className="font-mono font-semibold text-slate-800">
                  {profile?.cpf_cnpj || 'Não informado'}
                </span>
              </div>

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

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Veículo Vinculado
                </span>
                <span className="font-semibold text-slate-800">
                  {vehicle
                    ? `${vehicle.marca} ${vehicle.modelo} (${vehicle.ano})`
                    : 'Não cadastrado'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Chave PIX para Repasse
                </span>
                <span className="font-mono font-bold text-emerald-700">
                  {profile?.chave_pix || 'Solicitar ao motorista'}
                </span>
              </div>
            </div>

            {/* SEÇÃO 1: CARDS DE MÉTRICAS RESUMO */}
            {reportType === 'earnings' && (
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                    Total a Receber
                  </span>
                  <span className="text-xl font-black text-emerald-900 font-mono">
                    {formatCurrency(
                      earningsItems.reduce((acc, curr) => {
                        const val =
                          typeof curr.faturamento_bruto === 'number'
                            ? curr.faturamento_bruto
                            : curr.qtd_pecas * curr.valor_unitario_peca + curr.valor_extra_bonus;
                        return acc + val;
                      }, 0)
                    )}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Dias Trabalhados
                  </span>
                  <span className="text-lg font-black text-slate-800 font-mono">
                    {new Set(earningsItems.map((i) => i.data)).size} dias
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Peças Entregues
                  </span>
                  <span className="text-lg font-black text-slate-800 font-mono">
                    {earningsItems.reduce((acc, curr) => acc + (curr.qtd_pecas || 0), 0)} un.
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    KM Total Rodado
                  </span>
                  <span className="text-lg font-black text-slate-800 font-mono">
                    {earningsItems.reduce((acc, curr) => acc + (curr.km_rodado || 0), 0)} km
                  </span>
                </div>
              </div>
            )}

            {reportType === 'fuel' && (
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">
                    Total Gasto
                  </span>
                  <span className="text-xl font-black text-amber-900 font-mono">
                    {formatCurrency(
                      fuelItems.reduce((acc, curr) => acc + (curr.valor_total_abastecido || 0), 0)
                    )}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Abastecimentos
                  </span>
                  <span className="text-lg font-black text-slate-800 font-mono">
                    {fuelItems.length}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Volume Total
                  </span>
                  <span className="text-lg font-black text-slate-800 font-mono">
                    {fuelItems
                      .reduce((acc, curr) => {
                        const l =
                          typeof curr.litros_calculados === 'number'
                            ? curr.litros_calculados
                            : (curr.valor_total_abastecido || 0) / (curr.preco_por_litro_ou_m3 || 1);
                        return acc + (isNaN(l) ? 0 : l);
                      }, 0)
                      .toFixed(2)}{' '}
                    L/m³
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Preço Médio / L
                  </span>
                  <span className="text-lg font-black text-slate-800 font-mono">
                    {(() => {
                      const totalGasto = fuelItems.reduce(
                        (acc, curr) => acc + (curr.valor_total_abastecido || 0),
                        0
                      );
                      const totalLitros = fuelItems.reduce((acc, curr) => {
                        const l =
                          typeof curr.litros_calculados === 'number'
                            ? curr.litros_calculados
                            : (curr.valor_total_abastecido || 0) / (curr.preco_por_litro_ou_m3 || 1);
                        return acc + (isNaN(l) ? 0 : l);
                      }, 0);
                      return formatCurrency(totalLitros > 0 ? totalGasto / totalLitros : 0);
                    })()}
                  </span>
                </div>
              </div>
            )}

            {reportType === 'maintenance' && (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-blue-800 block">
                    Serviços Realizados (Pago)
                  </span>
                  <span className="text-xl font-black text-blue-900 font-mono">
                    {formatCurrency(
                      maintenanceItems
                        .filter((m) => m.status !== 'orcamento')
                        .reduce((acc, curr) => {
                          const val =
                            typeof curr.valor_total === 'number'
                              ? curr.valor_total
                              : (curr.valor_pecas || 0) + (curr.valor_mao_de_obra || 0);
                          return acc + val;
                        }, 0)
                    )}
                  </span>
                  <span className="text-[10px] text-blue-700 block mt-0.5">
                    {maintenanceItems.filter((m) => m.status !== 'orcamento').length} serviços
                  </span>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">
                    Orçamentos Pendentes (Previsto)
                  </span>
                  <span className="text-xl font-black text-amber-900 font-mono">
                    {formatCurrency(
                      maintenanceItems
                        .filter((m) => m.status === 'orcamento')
                        .reduce((acc, curr) => {
                          const val =
                            typeof curr.valor_total === 'number'
                              ? curr.valor_total
                              : (curr.valor_pecas || 0) + (curr.valor_mao_de_obra || 0);
                          return acc + val;
                        }, 0)
                    )}
                  </span>
                  <span className="text-[10px] text-amber-700 block mt-0.5">
                    {maintenanceItems.filter((m) => m.status === 'orcamento').length} orçamentos
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Total Geral de Registros
                  </span>
                  <span className="text-xl font-black text-slate-900 font-mono">
                    {maintenanceItems.length} registros
                  </span>
                  <span className="text-[10px] text-slate-600 block mt-0.5">
                    Histórico da oficina
                  </span>
                </div>
              </div>
            )}

            {reportType === 'dashboard' && dashboardData && (
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Faturamento Bruto
                  </span>
                  <span className="text-lg font-black text-slate-900 font-mono">
                    {formatCurrency(dashboardData.faturamentoBruto)}
                  </span>
                  <span className="text-[10px] text-slate-600 block">
                    {dashboardData.diasProducao} dias
                  </span>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-rose-800 block">
                    Despesas Totais
                  </span>
                  <span className="text-lg font-black text-rose-900 font-mono">
                    {formatCurrency(dashboardData.despesasTotais)}
                  </span>
                  <span className="text-[10px] text-rose-700 block">
                    Combustível + Oficina
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                    Lucro Líquido Real
                  </span>
                  <span className="text-xl font-black text-emerald-900 font-mono">
                    {formatCurrency(dashboardData.lucroLiquidoReal)}
                  </span>
                  <span className="text-[10px] text-emerald-700 block">
                    Margem: {dashboardData.margemLucro.toFixed(1)}%
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    KM Total Rodado
                  </span>
                  <span className="text-lg font-black text-slate-800 font-mono">
                    {dashboardData.totalKmRodados.toLocaleString('pt-BR')} km
                  </span>
                  <span className="text-[10px] text-slate-600 block">
                    {dashboardData.totalKmRodados > 0
                      ? `${formatCurrency(dashboardData.lucroLiquidoReal / dashboardData.totalKmRodados)}/km líq.`
                      : '-'}
                  </span>
                </div>
              </div>
            )}

            {/* SEÇÃO 2: TABELA DETALHADA DOS LANÇAMENTOS */}
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Discriminação dos Lançamentos do Período
              </h3>

              {/* Tabela de Ganhos */}
              {reportType === 'earnings' && (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3 text-center">Peças</th>
                        <th className="py-2.5 px-3 text-right">Unitário</th>
                        <th className="py-2.5 px-3 text-center">KM</th>
                        <th className="py-2.5 px-3 text-right">Bônus</th>
                        <th className="py-2.5 px-3 text-right">Total Bruto</th>
                        <th className="py-2.5 px-3">Observações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                      {earningsItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-slate-400 italic">
                            Nenhum lançamento encontrado no período.
                          </td>
                        </tr>
                      ) : (
                        [...earningsItems]
                          .sort((a, b) => (a.data || '').localeCompare(b.data || ''))
                          .map((item, idx) => {
                            const faturamento =
                              typeof item.faturamento_bruto === 'number'
                                ? item.faturamento_bruto
                                : item.qtd_pecas * item.valor_unitario_peca + item.valor_extra_bonus;
                            return (
                              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {formatDateBR(item.data)}
                                </td>
                                <td className="py-2 px-3 text-center text-slate-800">
                                  {item.qtd_pecas}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-600">
                                  {formatCurrency(item.valor_unitario_peca)}
                                </td>
                                <td className="py-2 px-3 text-center text-slate-800">
                                  {item.km_rodado}
                                </td>
                                <td className="py-2 px-3 text-right text-purple-700 font-semibold">
                                  {item.valor_extra_bonus > 0 ? formatCurrency(item.valor_extra_bonus) : '-'}
                                </td>
                                <td className="py-2 px-3 text-right font-black text-emerald-800">
                                  {formatCurrency(faturamento)}
                                </td>
                                <td className="py-2 px-3 font-sans text-slate-600 text-[10px] max-w-[150px] truncate">
                                  {item.observacoes || '-'}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tabela de Combustível */}
              {reportType === 'fuel' && (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Combustível</th>
                        <th className="py-2.5 px-3 text-right">Volume (L/m³)</th>
                        <th className="py-2.5 px-3 text-right">Preço Unitário</th>
                        <th className="py-2.5 px-3 text-right">Total Pago</th>
                        <th className="py-2.5 px-3 text-right">Odômetro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                      {fuelItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                            Nenhum abastecimento encontrado no período.
                          </td>
                        </tr>
                      ) : (
                        [...fuelItems]
                          .sort((a, b) => (a.data || '').localeCompare(b.data || ''))
                          .map((item, idx) => {
                            const litros =
                              typeof item.litros_calculados === 'number'
                                ? item.litros_calculados
                                : item.valor_total_abastecido / (item.preco_por_litro_ou_m3 || 1);
                            return (
                              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {formatDateBR(item.data)}
                                </td>
                                <td className="py-2 px-3 uppercase font-sans font-bold text-slate-800">
                                  {item.tipo_combustivel}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-800">
                                  {litros.toFixed(2)} {item.tipo_combustivel === 'gnv' ? 'm³' : 'L'}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-600">
                                  {formatCurrency(item.preco_por_litro_ou_m3)}
                                </td>
                                <td className="py-2 px-3 text-right font-black text-amber-800">
                                  {formatCurrency(item.valor_total_abastecido)}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-800">
                                  {item.km_odometro.toLocaleString('pt-BR')} km
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tabela de Oficina */}
              {reportType === 'maintenance' && (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Oficina / Estabelecimento</th>
                        <th className="py-2.5 px-3">Descrição do Serviço</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Peças</th>
                        <th className="py-2.5 px-3 text-right">Mão de Obra</th>
                        <th className="py-2.5 px-3 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                      {maintenanceItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-slate-400 italic">
                            Nenhum registro de manutenção no período.
                          </td>
                        </tr>
                      ) : (
                        [...maintenanceItems]
                          .sort((a, b) => (a.data || '').localeCompare(b.data || ''))
                          .map((item, idx) => {
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
                                  {item.descricao_servico}
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
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tabela do Dashboard Consolidado */}
              {reportType === 'dashboard' && dashboardData?.dailyData && (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3 text-right">Faturamento Diário</th>
                        <th className="py-2.5 px-3 text-right">Despesas Operacionais</th>
                        <th className="py-2.5 px-3 text-right">Lucro Líquido Real</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                      {dashboardData.dailyData.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                            Nenhum registro para o período.
                          </td>
                        </tr>
                      ) : (
                        dashboardData.dailyData.map((row, idx) => (
                          <tr key={row.dateRaw} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {formatDateBR(row.dateRaw)}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-800">
                              {formatCurrency(row.faturamento)}
                            </td>
                            <td className="py-2 px-3 text-right text-rose-700">
                              {formatCurrency(row.despesas)}
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-black ${
                                row.lucro >= 0 ? 'text-emerald-800' : 'text-rose-800'
                              }`}
                            >
                              {formatCurrency(row.lucro)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SEÇÃO 3: PROTOCOLO / RECIBO DE CONFERÊNCIA COMERCIAL */}
            <div className="mt-8 pt-5 border-t-2 border-slate-200 page-break-inside-avoid">
              <p className="text-[11px] text-slate-500 italic text-center max-w-xl mx-auto">
                Declaro para os devidos fins que as informações, rotas, despesas e dados bancários acima
                descritos conferem integralmente com a prestação de serviços executada no período indicado.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-8 px-4 text-center text-xs">
                <div className="border-t border-slate-400 pt-2">
                  <span className="font-bold text-slate-900 block">
                    {profile?.nome || 'Motorista Responsável'}
                  </span>
                  <span className="text-[11px] text-slate-500">Assinatura do Motorista</span>
                </div>

                <div className="border-t border-slate-400 pt-2">
                  <span className="font-bold text-slate-900 block">
                    {profile?.transportadora || 'Transportadora / Embarcador'}
                  </span>
                  <span className="text-[11px] text-slate-500">Visto / Conferência da Transportadora</span>
                </div>
              </div>

              {/* Rodapé do documento */}
              <div className="mt-6 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Gastos Rota • Sistema de Gestão Financeira para Motoristas</span>
                <span>Documento emitido eletronicamente em {formatDateTimeNow()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
