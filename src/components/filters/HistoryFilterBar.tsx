import React from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  SlidersHorizontal,
  X,
  RotateCcw,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import type { Profile } from '../../types/database';
import {
  type HistoryFilterState,
  type PeriodChipType,
  type SortOptionType,
  formatMonthYear,
  navigateMonthYear,
  getCurrentMonthYear,
  getProfilePaymentConfig,
  countActiveFilters,
} from '../../utils/filterUtils';

interface HistoryFilterBarProps {
  filterState: HistoryFilterState;
  onFilterChange: (newState: HistoryFilterState) => void;
  profile: Profile | null;
  searchPlaceholder?: string;
  totalFilteredCount?: number;
  hideSearchAndSort?: boolean; // Útil se alguma tela só quiser o navegador de datas (ex: Dashboard)
}

export const HistoryFilterBar: React.FC<HistoryFilterBarProps> = ({
  filterState,
  onFilterChange,
  profile,
  searchPlaceholder = 'Buscar no histórico...',
  totalFilteredCount,
  hideSearchAndSort = false,
}) => {
  const currentMonthYear = getCurrentMonthYear();
  const isCurrentMonth = filterState.monthYear === currentMonthYear;
  const config = getProfilePaymentConfig(profile);
  const activeCount = countActiveFilters(filterState);

  const handlePrevMonth = () => {
    onFilterChange({
      ...filterState,
      monthYear: navigateMonthYear(filterState.monthYear, -1),
    });
  };

  const handleNextMonth = () => {
    onFilterChange({
      ...filterState,
      monthYear: navigateMonthYear(filterState.monthYear, 1),
    });
  };

  const handleResetToCurrentMonth = () => {
    onFilterChange({
      ...filterState,
      monthYear: currentMonthYear,
    });
  };

  const handleChipClick = (chip: PeriodChipType) => {
    onFilterChange({
      ...filterState,
      periodChip: chip,
    });
  };

  const handleResetAllFilters = () => {
    onFilterChange({
      monthYear: currentMonthYear,
      periodChip: 'month',
      customStartDate: '',
      customEndDate: '',
      searchQuery: '',
      sortBy: 'recent',
    });
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-lg backdrop-blur-sm space-y-3.5">
      {/* 1. SELETOR HORIZONTAL DE MÊS/ANO COM SETAS (Estilo Banco / Fintech) */}
      <div className="flex items-center justify-between gap-2 bg-slate-950/80 border border-slate-800/90 rounded-2xl p-1.5 sm:p-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={handlePrevMonth}
          className="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-800/80"
          title="Mês anterior"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </motion.button>

        <div className="flex-1 flex flex-col items-center justify-center text-center px-1">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-emerald-400 shrink-0 hidden sm:block" />
            <span className="text-sm sm:text-base font-extrabold text-white tracking-tight">
              {formatMonthYear(filterState.monthYear)}
            </span>
          </div>

          {!isCurrentMonth && (
            <button
              type="button"
              onClick={handleResetToCurrentMonth}
              className="mt-0.5 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 cursor-pointer transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Voltar ao mês atual</span>
            </button>
          )}
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={handleNextMonth}
          className="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-800/80"
          title="Próximo mês"
          aria-label="Próximo mês"
        >
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>

      {/* 2. CHIPS INTELIGENTES DE PERÍODO (Botões Pílula Deslizantes no Mobile) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs select-none">
        {[
          { id: 'month' as PeriodChipType, label: 'Mês Inteiro' },
          {
            id: 'quinzena_1' as PeriodChipType,
            label: `1ª Quinzena (Dias ${config.corte2Inicio} a ${config.corte2Fim} → Pagto Dia ${config.diaPagamento2})`,
            title: `Dias ${config.corte2Inicio} a ${config.corte2Fim} • Pagamento Dia ${config.diaPagamento2}`,
          },
          {
            id: 'quinzena_2' as PeriodChipType,
            label: `2ª Quinzena (Dias ${config.corte1Inicio} a ${config.corte1Fim} → Pagto Dia ${config.diaPagamento1})`,
            title: `Dias ${config.corte1Inicio} a ${config.corte1Fim} • Pagamento Dia ${config.diaPagamento1}`,
          },
          { id: 'today' as PeriodChipType, label: 'Hoje' },
          { id: '7days' as PeriodChipType, label: 'Últimos 7 dias' },
          {
            id: 'custom' as PeriodChipType,
            label: 'Período Personalizado',
            icon: SlidersHorizontal,
          },
        ].map((chip) => {
          const isSelected = filterState.periodChip === chip.id;
          const IconComp = chip.icon;

          return (
            <motion.button
              key={chip.id}
              type="button"
              whileTap={{ scale: 0.94 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleChipClick(chip.id)}
              title={chip.title}
              className={`relative px-3.5 py-2 min-h-[40px] whitespace-nowrap rounded-xl font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 select-none ${
                isSelected
                  ? 'text-slate-950 font-black'
                  : 'text-slate-300 hover:text-white bg-slate-950/70 border border-slate-800 hover:bg-slate-800/80'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="activePeriodChipIndicator"
                  className="absolute inset-0 bg-emerald-500 rounded-xl -z-10 shadow-md shadow-emerald-500/25 border border-emerald-400"
                  transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                />
              )}
              {IconComp && <IconComp className="w-3.5 h-3.5" />}
              <span>{chip.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* 3. CAMPOS DE DATA PERSONALIZADA (Quando chip 'custom' está ativo) */}
      {filterState.periodChip === 'custom' && (
        <div className="p-3 bg-slate-950/80 border border-emerald-500/30 rounded-2xl animate-in fade-in duration-200">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-emerald-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>Defina o intervalo de datas:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                De (Data Inicial):
              </label>
              <input
                type="date"
                value={filterState.customStartDate}
                onChange={(e) =>
                  onFilterChange({
                    ...filterState,
                    customStartDate: e.target.value,
                  })
                }
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Até (Data Final):
              </label>
              <input
                type="date"
                value={filterState.customEndDate}
                onChange={(e) =>
                  onFilterChange({
                    ...filterState,
                    customEndDate: e.target.value,
                  })
                }
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. BARRA DE BUSCA E ORDENAÇÃO */}
      {!hideSearchAndSort && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Busca Instantânea */}
          <div className="sm:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={filterState.searchQuery}
              onChange={(e) =>
                onFilterChange({
                  ...filterState,
                  searchQuery: e.target.value,
                })
              }
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-9 py-2.5 min-h-[44px] bg-slate-950/80 border border-slate-700/80 rounded-xl text-white text-base sm:text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
            {filterState.searchQuery && (
              <button
                type="button"
                onClick={() =>
                  onFilterChange({
                    ...filterState,
                    searchQuery: '',
                  })
                }
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                title="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Seletor de Ordenação */}
          <div className="relative">
            <select
              value={filterState.sortBy}
              onChange={(e) =>
                onFilterChange({
                  ...filterState,
                  sortBy: e.target.value as SortOptionType,
                })
              }
              aria-label="Opções de ordenação"
              className="w-full px-3 py-2.5 min-h-[44px] bg-slate-950/80 border border-slate-700/80 rounded-xl text-white text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition cursor-pointer"
            >
              <option value="recent">⏱️ Mais recentes</option>
              <option value="oldest">⏳ Mais antigos</option>
              <option value="highest_value">💎 Maior valor</option>
              <option value="lowest_value">📉 Menor valor</option>
            </select>
          </div>
        </div>
      )}

      {/* 5. LINHA DE STATUS DO FILTRO E BOTÃO 'LIMPAR FILTROS' */}
      {activeCount > 0 && (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
              <Sparkles className="w-3 h-3" />
              {activeCount} {activeCount === 1 ? 'filtro ativo' : 'filtros ativos'}
            </span>
            {typeof totalFilteredCount === 'number' && (
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                ({totalFilteredCount} {totalFilteredCount === 1 ? 'item exibido' : 'itens exibidos'})
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleResetAllFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition cursor-pointer active:scale-95"
            title="Voltar à visão padrão"
          >
            <X className="w-3.5 h-3.5 text-rose-400" />
            <span>Limpar Filtros</span>
          </button>
        </div>
      )}
    </div>
  );
};
