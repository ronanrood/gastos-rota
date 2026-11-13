import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Car,
  Fuel,
  Package,
  QrCode,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  RotateCw,
  CalendarCheck,
  ShieldCheck,
  Lightbulb,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type {
  Profile,
  PaymentCycleType,
  PreventiveMaintenanceData,
} from '../../types/database';
import { DEFAULT_PREVENTIVE_CONFIGS } from '../../utils/vehicleHealth';
import { triggerSuccessCelebration } from '../../lib/celebrate';
import { modalBackdropVariants, modalContentVariants } from '../common/MotionVariants';

export interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  profile: Profile | null;
  onComplete: () => Promise<void>;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  user,
  profile,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Passo 1: Veículo
  const [marcaModelo, setMarcaModelo] = useState('');
  const [kmAtual, setKmAtual] = useState('');
  const [mediaGasolina, setMediaGasolina] = useState('11.0');
  const [mediaEtanol, setMediaEtanol] = useState('7.7');

  // Passo 2: Rota, Peça e Pagamento
  const [transportadora, setTransportadora] = useState(profile?.transportadora || '');
  const [rota, setRota] = useState(profile?.rota || '');
  const [valorPadraoPeca, setValorPadraoPeca] = useState(
    profile?.valor_padrao_peca ? profile.valor_padrao_peca.toString() : '4.50'
  );
  const [tipoRecebimento, setTipoRecebimento] = useState<PaymentCycleType>(
    profile?.tipo_recebimento || 'quinzenal'
  );

  // Passo 3: PIX
  const [chavePix, setChavePix] = useState(profile?.chave_pix || '');
  const [cpfCnpj, setCpfCnpj] = useState(profile?.cpf_cnpj || '');

  if (!isOpen) return null;

  const firstName = profile?.nome?.trim().split(' ')[0] || 'Motorista';

  const handleNextStep = () => {
    setErrorMsg(null);

    if (step === 1) {
      if (!marcaModelo.trim()) {
        setErrorMsg('Por favor, informe a marca e modelo do seu veículo.');
        return;
      }
      const kmNum = parseFloat(kmAtual.replace(',', '.'));
      if (isNaN(kmNum) || kmNum < 0) {
        setErrorMsg('Informe o KM atual válido do seu carro.');
        return;
      }
      setDirection(1);
      setStep(2);
    } else if (step === 2) {
      const valorNum = parseFloat(valorPadraoPeca.replace(',', '.'));
      if (isNaN(valorNum) || valorNum <= 0) {
        setErrorMsg('Informe um valor padrão válido por peça/entrega.');
        return;
      }
      setDirection(1);
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    setErrorMsg(null);
    if (step > 1) {
      setDirection(-1);
      setStep((prev) => (prev - 1) as 1 | 2);
    }
  };

  const handleSkip = async () => {
    try {
      sessionStorage.setItem('gastos_rota_onboarding_skipped', 'true');
      // Marca onboarding_completed como true para não interromper o motorista
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);
    } catch {
      // ignore
    } finally {
      onClose();
    }
  };

  const handleFinish = async () => {
    setErrorMsg(null);
    setSaving(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const kmAtualNum = Math.max(0, parseFloat(kmAtual.replace(',', '.')) || 0);
      const mediaGasNum = parseFloat(mediaGasolina.replace(',', '.')) || 11.0;
      const mediaEtaNum = parseFloat(mediaEtanol.replace(',', '.')) || 7.7;
      const valorPecaNum = parseFloat(valorPadraoPeca.replace(',', '.')) || 4.50;

      // 1. Divide marca e modelo se possível
      const parts = marcaModelo.trim().split(' ');
      const marca = parts[0] || 'Veículo';
      const modelo = parts.slice(1).join(' ') || parts[0] || 'Utilitário';

      // 2. Inicializa dados de manutenção preventiva com o KM atual do painel
      const initialPreventive: PreventiveMaintenanceData = {
        oleo_motor: {
          nome: DEFAULT_PREVENTIVE_CONFIGS.oleo_motor.nome,
          intervalo_km: DEFAULT_PREVENTIVE_CONFIGS.oleo_motor.intervalo_km,
          ultimo_km: kmAtualNum,
          ultima_data: today,
        },
        pastilhas_freio: {
          nome: DEFAULT_PREVENTIVE_CONFIGS.pastilhas_freio.nome,
          intervalo_km: DEFAULT_PREVENTIVE_CONFIGS.pastilhas_freio.intervalo_km,
          ultimo_km: kmAtualNum,
          ultima_data: today,
        },
        pneus: {
          nome: DEFAULT_PREVENTIVE_CONFIGS.pneus.nome,
          intervalo_km: DEFAULT_PREVENTIVE_CONFIGS.pneus.intervalo_km,
          ultimo_km: kmAtualNum,
          ultima_data: today,
        },
        correia_dentada: {
          nome: DEFAULT_PREVENTIVE_CONFIGS.correia_dentada.nome,
          intervalo_km: DEFAULT_PREVENTIVE_CONFIGS.correia_dentada.intervalo_km,
          ultimo_km: kmAtualNum,
          ultima_data: today,
        },
      };

      // 3. Salva ou atualiza veículo na tabela 'vehicles'
      const { data: existingVeh } = await supabase
        .from('vehicles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const vehiclePayload = {
        user_id: user.id,
        marca,
        modelo,
        ano: new Date().getFullYear(),
        km_atual: kmAtualNum,
        km_inicial_cadastro: kmAtualNum,
        media_gasolina: mediaGasNum,
        media_etanol: mediaEtaNum,
        manutencao_preventiva: initialPreventive,
      };

      if (existingVeh) {
        await supabase
          .from('vehicles')
          .update(vehiclePayload)
          .eq('id', existingVeh.id);
      } else {
        await supabase.from('vehicles').insert(vehiclePayload);
      }

      // 4. Salva configurações do motorista na tabela 'profiles'
      const profileUpdates: Partial<Profile> = {
        transportadora: transportadora.trim() || null,
        rota: rota.trim() || null,
        valor_padrao_peca: valorPecaNum,
        tipo_recebimento: tipoRecebimento,
        dia_pagamento_1: tipoRecebimento === 'quinzenal' ? 17 : 5,
        corte_1_inicio: 1,
        corte_1_fim: 15,
        dia_pagamento_2: tipoRecebimento === 'quinzenal' ? 2 : null,
        corte_2_inicio: tipoRecebimento === 'quinzenal' ? 16 : null,
        corte_2_fim: tipoRecebimento === 'quinzenal' ? 31 : null,
        chave_pix: chavePix.trim() || null,
        cpf_cnpj: cpfCnpj.trim() || null,
        onboarding_completed: true,
      };

      const { error: profError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.id);

      if (profError) throw profError;

      // 5. Celebração e finalização
      triggerSuccessCelebration();
      await onComplete();
    } catch (err) {
      console.error('Erro ao salvar onboarding:', err);
      setErrorMsg('Não foi possível salvar as configurações. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const stepVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 30 : -30,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -30 : 30,
      opacity: 0,
    }),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      {/* Backdrop com blur escuro */}
      <motion.div
        variants={modalBackdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 bg-transparent cursor-pointer"
        onClick={handleSkip}
      />

      {/* Card do Modal */}
      <motion.div
        role="dialog"
        aria-modal="true"
        variants={modalContentVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full sm:max-w-lg max-h-[88dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-7 shadow-2xl relative z-10 text-zinc-100 bg-zinc-900 border border-zinc-800 overscroll-contain"
      >
        {/* Topo: Barra de Progresso e Botão Pular */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">
              {step}
            </span>
            <span className="text-xs font-bold text-zinc-300">
              Passo {step} de 3
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            >
              Configurar depois
            </button>
            <button
              type="button"
              onClick={handleSkip}
              aria-label="Pular configuração"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Linha de Progresso Visual */}
        <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden my-3">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
            initial={{ width: '33.3%' }}
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Mensagem de Erro */}
        {errorMsg && (
          <div className="mb-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* CONTEÚDO DOS PASSOS COM TRANSIÇÃO */}
        <div className="min-h-[290px] flex flex-col justify-between">
          <AnimatePresence mode="wait" custom={direction}>
            {/* PASSO 1: VEÍCULO */}
            {step === 1 && (
              <motion.div
                key="step-1"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                    <Car className="w-5 h-5 text-emerald-400" />
                    <span>Olá, {firstName}!</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Vamos calibrar seu copiloto em 30 segundos com os dados do seu veículo.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Marca e Modelo do Carro
                    </label>
                    <input
                      type="text"
                      required
                      value={marcaModelo}
                      onChange={(e) => setMarcaModelo(e.target.value)}
                      placeholder="Ex: Fiat Fiorino, Onix, Strada..."
                      className="w-full px-3.5 h-12 min-h-[48px] bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      KM Atual no Odômetro do Painel
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        required
                        value={kmAtual}
                        onChange={(e) => setKmAtual(e.target.value)}
                        placeholder="Ex: 85200"
                        className="w-full pl-3.5 pr-10 h-12 min-h-[48px] bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 text-xs font-bold pointer-events-none">
                        km
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
                        <Fuel className="w-3.5 h-3.5 text-teal-400" />
                        Média Gasolina
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          value={mediaGasolina}
                          onChange={(e) => setMediaGasolina(e.target.value)}
                          placeholder="11.0"
                          className="w-full pl-3 pr-10 h-11 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 text-[10px] font-bold pointer-events-none">
                          km/l
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
                        <Fuel className="w-3.5 h-3.5 text-emerald-400" />
                        Média Etanol
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          value={mediaEtanol}
                          onChange={(e) => setMediaEtanol(e.target.value)}
                          placeholder="7.7"
                          className="w-full pl-3 pr-10 h-11 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 text-[10px] font-bold pointer-events-none">
                          km/l
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dica visual */}
                  <div className="p-3 rounded-xl bg-zinc-950/80 border border-emerald-500/30 text-xs text-zinc-300 flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      Esses dados alimentam o <strong>Comparador de Combustível</strong> e ativam
                      os alertas de <strong>troca de óleo e pneus</strong> por quilometragem!
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PASSO 2: ROTA & VALOR DA PEÇA */}
            {step === 2 && (
              <motion.div
                key="step-2"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-400" />
                    <span>Sua Rota e Remuneração</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Configure sua rotina para automatizar os ganhos e fechamentos quinzenais.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        Transportadora
                      </label>
                      <input
                        type="text"
                        value={transportadora}
                        onChange={(e) => setTransportadora(e.target.value)}
                        placeholder="Ex: Mercado Livre, Shopee..."
                        className="w-full px-3.5 h-12 min-h-[48px] bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        Código / Nome da Rota
                      </label>
                      <input
                        type="text"
                        value={rota}
                        onChange={(e) => setRota(e.target.value)}
                        placeholder="Ex: Rota ZL-04, Expressa..."
                        className="w-full px-3.5 h-12 min-h-[48px] bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Valor Padrão Pago por Peça / Pacote
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-400 text-xs font-bold pointer-events-none">
                        R$
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        required
                        value={valorPadraoPeca}
                        onChange={(e) => setValorPadraoPeca(e.target.value)}
                        placeholder="4.50"
                        className="w-full pl-9 pr-3.5 h-12 min-h-[48px] bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <span className="text-[11px] text-zinc-500 mt-1 block">
                      💡 Esse valor já virá pré-preenchido em seus lançamentos diários e simuladores.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Ciclo de Recebimento da Transportadora
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTipoRecebimento('quinzenal')}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                          tipoRecebimento === 'quinzenal'
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <CalendarCheck className="w-4 h-4 text-emerald-400" />
                          <span>Quinzenal</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 block mt-1">
                          Pagamentos nos Dias 17 e 2
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTipoRecebimento('mensal')}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                          tipoRecebimento === 'mensal'
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <CalendarCheck className="w-4 h-4 text-teal-400" />
                          <span>Mensal</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 block mt-1">
                          Fechamento do mês inteiro
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PASSO 3: CHAVE PIX */}
            {step === 3 && (
              <motion.div
                key="step-3"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-emerald-400" />
                    <span>Sua Chave PIX para Cobrança</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Facilite a cobrança e o repasse das suas quinzenas com a transportadora.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Chave PIX
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={chavePix}
                        onChange={(e) => setChavePix(e.target.value)}
                        placeholder="CPF, celular, e-mail ou aleatória"
                        className="w-full pl-10 pr-3.5 h-12 min-h-[48px] bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      CPF ou CNPJ (Opcional)
                    </label>
                    <input
                      type="text"
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(e.target.value)}
                      placeholder="000.000.000-00"
                      className="w-full px-3.5 h-12 min-h-[48px] bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Explicação curta */}
                  <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-emerald-500/30 text-xs text-zinc-300 flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      Sua chave PIX sairá pronta e formatada nos relatórios de cobrança enviados para
                      o WhatsApp da transportadora e para conferência de repasses.
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* BOTÕES DE NAVEGAÇÃO INFERIORES */}
        <div className="pt-4 mt-4 border-t border-zinc-800/80 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              disabled={saving}
              onClick={handlePrevStep}
              className="px-4 py-3 h-12 min-h-[48px] rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={handleNextStep}
              className="flex-1 max-w-[240px] ml-auto h-12 min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs sm:text-sm transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Próximo Passo</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              disabled={saving}
              onClick={handleFinish}
              className="flex-1 h-12 min-h-[48px] rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-zinc-950 font-black text-xs sm:text-sm transition shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Configurando seu Copiloto...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>🚀 Concluir e Abrir Meu Painel</span>
                </>
              )}
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
