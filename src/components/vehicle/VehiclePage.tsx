import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import type { Vehicle, VehicleUpsert } from '../../types/database';
import {
  Car,
  Gauge,
  Fuel,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RotateCw,
  Calendar,
} from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

export const VehiclePage: React.FC = () => {
  const { user } = useAuth();

  // Estados do formulário
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState<string>(() => CURRENT_YEAR.toString());
  const [kmAtual, setKmAtual] = useState<string>('');
  const [mediaGasolina, setMediaGasolina] = useState<string>('');
  const [mediaEtanol, setMediaEtanol] = useState<string>('');
  const [mediaGnv, setMediaGnv] = useState<string>('');

  // Estados de controle
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Recarregar dados do veículo sob demanda
  const refreshVehicle = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setFeedbackError(null);
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        const v = data as Vehicle;
        setVehicle(v);
        setMarca(v.marca || '');
        setModelo(v.modelo || '');
        setAno(v.ano?.toString() || CURRENT_YEAR.toString());
        setKmAtual(v.km_atual?.toString() || '');
        setMediaGasolina(v.media_gasolina !== null && v.media_gasolina !== undefined ? v.media_gasolina.toString() : '');
        setMediaEtanol(v.media_etanol !== null && v.media_etanol !== undefined ? v.media_etanol.toString() : '');
        setMediaGnv(v.media_gnv !== null && v.media_gnv !== undefined ? v.media_gnv.toString() : '');
      } else {
        setVehicle(null);
      }
    } catch (err: unknown) {
      console.error('Erro ao buscar dados do veículo:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao carregar dados do veículo.';
      setFeedbackError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Carregamento inicial sincronizado
  useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('vehicles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!ignore) {
          if (error) {
            throw error;
          }
          if (data) {
            const v = data as Vehicle;
            setVehicle(v);
            setMarca(v.marca || '');
            setModelo(v.modelo || '');
            setAno(v.ano?.toString() || CURRENT_YEAR.toString());
            setKmAtual(v.km_atual?.toString() || '');
            setMediaGasolina(v.media_gasolina !== null && v.media_gasolina !== undefined ? v.media_gasolina.toString() : '');
            setMediaEtanol(v.media_etanol !== null && v.media_etanol !== undefined ? v.media_etanol.toString() : '');
            setMediaGnv(v.media_gnv !== null && v.media_gnv !== undefined ? v.media_gnv.toString() : '');
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          console.error('Erro ao buscar dados do veículo:', err);
          const msg = err instanceof Error ? err.message : 'Falha ao carregar dados do veículo.';
          setFeedbackError(msg);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, [user]);

  // Salva / Atualiza o veículo via upsert (onConflict: 'user_id')
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError(null);
    setFeedbackSuccess(null);

    if (!user) {
      setFeedbackError('Sessão expirada. Faça login novamente.');
      return;
    }

    if (!marca.trim()) {
      setFeedbackError('Informe a marca do veículo.');
      return;
    }

    if (!modelo.trim()) {
      setFeedbackError('Informe o modelo do veículo.');
      return;
    }

    const numAno = parseInt(ano, 10);
    if (isNaN(numAno) || numAno < 1970 || numAno > CURRENT_YEAR + 1) {
      setFeedbackError(`Ano inválido. Informe um ano entre 1970 e ${CURRENT_YEAR + 1}.`);
      return;
    }

    const numKm = parseFloat(kmAtual);
    if (isNaN(numKm) || numKm < 0) {
      setFeedbackError('Informe uma quilometragem válida (>= 0).');
      return;
    }

    const numMediaGasolina = mediaGasolina ? parseFloat(mediaGasolina) : null;
    const numMediaEtanol = mediaEtanol ? parseFloat(mediaEtanol) : null;
    const numMediaGnv = mediaGnv ? parseFloat(mediaGnv) : null;

    if (numMediaGasolina !== null && (isNaN(numMediaGasolina) || numMediaGasolina <= 0)) {
      setFeedbackError('A média na gasolina deve ser maior que zero.');
      return;
    }
    if (numMediaEtanol !== null && (isNaN(numMediaEtanol) || numMediaEtanol <= 0)) {
      setFeedbackError('A média no etanol deve ser maior que zero.');
      return;
    }
    if (numMediaGnv !== null && (isNaN(numMediaGnv) || numMediaGnv <= 0)) {
      setFeedbackError('A média no GNV deve ser maior que zero.');
      return;
    }

    setSaving(true);

    try {
      const payload: VehicleUpsert = {
        user_id: user.id,
        marca: marca.trim(),
        modelo: modelo.trim(),
        ano: numAno,
        km_atual: Number(numKm.toFixed(1)),
        media_gasolina: numMediaGasolina !== null ? Number(numMediaGasolina.toFixed(2)) : null,
        media_etanol: numMediaEtanol !== null ? Number(numMediaEtanol.toFixed(2)) : null,
        media_gnv: numMediaGnv !== null ? Number(numMediaGnv.toFixed(2)) : null,
      };

      const { data, error } = await supabase
        .from('vehicles')
        .upsert(payload, { onConflict: 'user_id' })
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setVehicle(data as Vehicle);
      }

      setFeedbackSuccess(
        vehicle
          ? 'Dados do veículo atualizados com sucesso!'
          : 'Veículo cadastrado com sucesso!'
      );

      setTimeout(() => {
        setFeedbackSuccess(null);
      }, 4000);
    } catch (err: unknown) {
      console.error('Erro ao salvar veículo:', err);
      const msg = err instanceof Error ? err.message : 'Não foi possível salvar os dados do veículo.';
      setFeedbackError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Resumo do Veículo Cadastrado (se já existir) */}
      {vehicle && !loading && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
                <Car className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                  Veículo em Operação
                </span>
                <h3 className="text-xl font-extrabold text-white tracking-tight">
                  {vehicle.marca} {vehicle.modelo} ({vehicle.ano})
                </h3>
                <span className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
                  <Gauge className="w-3.5 h-3.5 text-slate-400" />
                  {vehicle.km_atual?.toLocaleString('pt-BR')} km rodados
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
              {vehicle.media_gasolina && (
                <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-xl text-xs font-semibold font-mono">
                  ⛽ {vehicle.media_gasolina} km/l
                </span>
              )}
              {vehicle.media_etanol && (
                <span className="bg-teal-500/15 text-teal-300 border border-teal-500/30 px-2.5 py-1 rounded-xl text-xs font-semibold font-mono">
                  🌱 {vehicle.media_etanol} km/l
                </span>
              )}
              {vehicle.media_gnv && (
                <span className="bg-blue-500/15 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-xl text-xs font-semibold font-mono">
                  💨 {vehicle.media_gnv} km/m³
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CARD PRINCIPAL DO FORMULÁRIO */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-7 relative overflow-hidden backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
              <Car className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                {vehicle ? 'Atualizar Dados do Veículo' : 'Cadastrar Meu Veículo'}
              </h2>
              <p className="text-xs text-slate-400">
                Informações para acompanhamento de quilometragem e autonomia
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={refreshVehicle}
            disabled={loading}
            title="Recarregar dados"
            className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition active:scale-[0.96] cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* FEEDBACKS */}
        {feedbackError && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Erro</p>
              <p className="text-rose-300/90">{feedbackError}</p>
            </div>
          </div>
        )}

        {feedbackSuccess && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-semibold">{feedbackSuccess}</div>
          </div>
        )}

        {/* FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Dados do Carro */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-emerald-400" />
              Identificação do Veículo
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Marca
                </label>
                <input
                  type="text"
                  required
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Ex: Fiat, Chevrolet, Renault"
                  className="w-full px-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Modelo
                </label>
                <input
                  type="text"
                  required
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="Ex: Fiorino, Strada, Kangoo"
                  className="w-full px-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Ano
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    required
                    min="1970"
                    max={CURRENT_YEAR + 1}
                    value={ano}
                    onChange={(e) => setAno(e.target.value)}
                    placeholder="Ex: 2022"
                    className="w-full pl-9 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Odômetro */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-teal-400" />
              Quilometragem
            </h4>
            <div className="max-w-md">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Quilometragem Atual
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
                  value={kmAtual}
                  onChange={(e) => setKmAtual(e.target.value)}
                  placeholder="Ex: 85400"
                  className="w-full pl-10 pr-12 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-mono"
                />
                <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs text-slate-400 font-semibold pointer-events-none">
                  KM
                </span>
              </div>
            </div>
          </div>

          {/* Médias de Consumo */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Fuel className="w-3.5 h-3.5 text-amber-400" />
                Médias de Consumo Esperadas
              </h4>
              <span className="text-[11px] text-slate-400">
                Usadas para calcular a autonomia na tela de Combustível
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Gasolina */}
              <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Média Gasolina
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={mediaGasolina}
                    onChange={(e) => setMediaGasolina(e.target.value)}
                    placeholder="Ex: 11.5"
                    className="w-full pr-14 pl-3 py-3 sm:py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-mono"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 pointer-events-none">
                    km/l
                  </span>
                </div>
              </div>

              {/* Etanol */}
              <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Média Etanol
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={mediaEtanol}
                    onChange={(e) => setMediaEtanol(e.target.value)}
                    placeholder="Ex: 8.2"
                    className="w-full pr-14 pl-3 py-3 sm:py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-mono"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 pointer-events-none">
                    km/l
                  </span>
                </div>
              </div>

              {/* GNV */}
              <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Média GNV
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Opcional</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={mediaGnv}
                    onChange={(e) => setMediaGnv(e.target.value)}
                    placeholder="Ex: 14.0"
                    className="w-full pr-16 pl-3 py-3 sm:py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-mono"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 pointer-events-none">
                    km/m³
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dica Informativa */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              Ao registrar os abastecimentos no módulo <strong>Combustível</strong>, o sistema calculará em tempo real quantos quilômetros de autonomia você terá antes de salvar!
            </p>
          </div>

          {/* Botão de Salvar */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full h-12 min-h-[48px] px-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-base sm:text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Salvando Veículo...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 stroke-[2.2]" />
                  {vehicle ? 'Atualizar Dados do Veículo' : 'Cadastrar Veículo'}
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
