import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  LogIn,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Phone,
  CalendarCheck,
  Fuel,
  Wrench,
  Loader2,
  ChevronLeft,
  KeyRound,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';

type AuthMode = 'login' | 'register' | 'forgot';

interface FeatureItem {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
}

const FEATURE_SHOWCASE: FeatureItem[] = [
  {
    icon: CalendarCheck,
    title: 'Fechamento Automático de Quinzenas',
    subtitle:
      'Cortes automáticos dos Dias 1 a 15 (Pagto Dia 2) e 16 a 31 (Pagto Dia 17). Controle de recebimento, comprovantes e envio para transportadora com 1 toque.',
    badge: '📦 Dias 2 e 17',
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  },
  {
    icon: Fuel,
    title: 'Comparador Inteligente & Custo Real por KM',
    subtitle:
      'Descubra em segundos se compensa abastecer com Etanol, Gasolina ou GNV e saiba seu custo operacional real por quilômetro rodado.',
    badge: '⛽ Etanol vs Gasolina',
    badgeColor: 'border-teal-500/30 bg-teal-500/10 text-teal-400',
  },
  {
    icon: Wrench,
    title: 'Oficina, Parcelas & Saúde Preventiva',
    subtitle:
      'Monitore o desgaste de óleo, pastilhas, pneus e correia por KM. Suporte a serviços parcelados em até 24x sem distorcer o faturamento do mês.',
    badge: '🛠️ Saúde do Veículo',
    badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  },
];

const formatPhoneBR = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const translateAuthError = (errMessage: string): string => {
  if (!errMessage) return 'Ocorreu um erro inesperado. Tente novamente.';
  const lower = errMessage.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid_grant')) {
    return 'E-mail ou senha incorretos.';
  }
  if (lower.includes('user already registered') || lower.includes('already exists')) {
    return 'Este e-mail já possui conta cadastrada. Faça login ou recupere a senha.';
  }
  if (lower.includes('email not confirmed')) {
    return 'E-mail ainda não confirmado. Por favor, cheque sua caixa de entrada.';
  }
  if (lower.includes('at least 6 characters') || lower.includes('password is too short')) {
    return 'A senha deve conter no mínimo 6 caracteres.';
  }
  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('over_email_send_rate_limit')
  ) {
    return 'Muitas tentativas seguidas. Aguarde alguns instantes antes de tentar novamente.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Falha de conexão com a internet. Verifique sua rede e tente novamente.';
  }
  return errMessage;
};

export const AuthPage: React.FC = () => {
  const { signIn, signUp, isSupabaseConfigured } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);

  // Campos do formulário
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [transportadora, setTransportadora] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status de envio
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [forgotSentSuccess, setForgotSentSuccess] = useState(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatPhoneBR(e.target.value));
  };

  const handleModeChange = (newMode: AuthMode) => {
    setAuthMode(newMode);
    setErrorMessage(null);
    setSuccessMessage(null);
    setForgotSentSuccess(false);
  };

  // Submissão do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validações básicas
    if (authMode === 'forgot') {
      if (!email.trim()) {
        setErrorMessage('Por favor, informe seu e-mail cadastrado.');
        return;
      }
      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/#perfil`,
        });

        if (error) {
          setErrorMessage(translateAuthError(error.message));
        } else {
          setForgotSentSuccess(true);
          setSuccessMessage(
            `Link de recuperação enviado para ${email.trim()}. Verifique sua caixa de entrada ou spam!`
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha ao solicitar recuperação.';
        setErrorMessage(translateAuthError(msg));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setErrorMessage('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (authMode === 'register') {
      if (!nome.trim()) {
        setErrorMessage('Por favor, informe seu nome completo.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('A senha deve conter no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('As senhas não coincidem. Digite novamente.');
        return;
      }
    }

    setLoading(true);

    try {
      if (authMode === 'login') {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          setErrorMessage(translateAuthError(error.message));
        }
      } else {
        // Cadastro completo com metadados opcionais (telefone, transportadora)
        const { error, user } = await signUp(nome.trim(), email.trim(), password, {
          telefone: telefone.trim() || null,
          transportadora: transportadora.trim() || null,
        });

        if (error) {
          setErrorMessage(translateAuthError(error.message));
        } else {
          if (user?.identities?.length === 0) {
            setErrorMessage('Este e-mail já está cadastrado. Faça login ou recupere sua senha.');
          } else {
            setSuccessMessage(
              'Conta criada com sucesso! Se a confirmação de e-mail estiver ativa, confira sua caixa de entrada.'
            );
            if (user?.role !== 'authenticated') {
              setAuthMode('login');
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ocorreu um erro inesperado.';
      setErrorMessage(translateAuthError(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-center relative overflow-hidden selection:bg-emerald-500 selection:text-zinc-950">
      {/* Luzes Radiais de Fundo (Aura Fintech) */}
      <div className="absolute top-0 left-1/4 -translate-y-1/2 w-[550px] h-[550px] bg-emerald-500/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 translate-y-1/2 w-[550px] h-[550px] bg-teal-500/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

      <main className="w-full max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 relative z-10 my-auto">
        {/* Aviso caso Supabase URL não esteja configurada */}
        {!isSupabaseConfigured && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs sm:text-sm max-w-xl mx-auto backdrop-blur-md">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">Conexão Pendente com o Supabase</p>
                <p className="mt-1 text-amber-200/90 leading-relaxed">
                  A URL do Supabase precisa ser o endereço HTTP do seu projeto. Verifique o arquivo{' '}
                  <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-300 font-mono">
                    .env
                  </code>{' '}
                  ou as variáveis de ambiente.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Topo Compacto no Mobile */}
        <div className="lg:hidden text-center mb-6 space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-zinc-950 shadow-lg shadow-emerald-500/25 ring-4 ring-emerald-500/20">
            <Truck className="w-7 h-7 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              <span>Gastos Rota</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                Motorista
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1 font-medium">
              O copiloto financeiro do motorista de rota
            </p>
          </div>

          {/* Chips Horizontais Deslizantes de Destaque no Mobile */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1">
            <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-[11px] font-semibold text-zinc-300 shadow-sm">
              <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Quinzenas (Dias 2 e 17)</span>
            </span>
            <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-[11px] font-semibold text-zinc-300 shadow-sm">
              <Fuel className="w-3.5 h-3.5 text-teal-400" />
              <span>Comparador & Custo/KM</span>
            </span>
            <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-[11px] font-semibold text-zinc-300 shadow-sm">
              <Wrench className="w-3.5 h-3.5 text-blue-400" />
              <span>Oficina & Saúde do Carro</span>
            </span>
          </div>
        </div>

        {/* GRID SPLIT-SCREEN NO DESKTOP */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* LADO ESQUERDO: SHOWCASE IMERSIVO (Desktop) */}
          <section
            aria-label="Apresentação do Gastos Rota"
            className="hidden lg:flex lg:col-span-7 flex-col justify-between space-y-8 pr-4"
          >
            {/* Header da Marca */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold shadow-sm">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>O Aplicativo Definitivo para Quem Roda Todo Dia</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 via-emerald-400 to-teal-400 text-zinc-950 flex items-center justify-center shadow-xl shadow-emerald-500/30 ring-4 ring-emerald-500/20 shrink-0">
                  <Truck className="w-9 h-9 stroke-[2.3]" />
                </div>
                <div>
                  <h1 className="text-4xl font-black text-white tracking-tight">
                    Gastos Rota
                  </h1>
                  <p className="text-sm text-zinc-400 font-medium mt-0.5">
                    O copiloto financeiro do motorista de rota
                  </p>
                </div>
              </div>

              <p className="text-sm text-zinc-300/90 leading-relaxed max-w-lg">
                Gerencie seus ganhos brutos, abastecimentos, despesas de manutenção e fechamentos
                quinzenais sem planilhas complicadas. Tudo direto na tela do seu celular.
              </p>
            </div>

            {/* 3 Cards Flutuantes de Recursos */}
            <div className="space-y-3.5">
              {FEATURE_SHOWCASE.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * idx, duration: 0.4 }}
                    className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md hover:border-emerald-500/40 transition duration-300 shadow-lg flex items-start gap-3.5"
                  >
                    <div className="w-11 h-11 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 text-emerald-400 shadow-inner">
                      <Icon className="w-5 h-5 stroke-[2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-white truncate">
                          {feature.title}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${feature.badgeColor}`}
                        >
                          {feature.badge}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        {feature.subtitle}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Rodapé de Segurança */}
            <div className="pt-2 flex items-center gap-2 text-xs text-zinc-500">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Criptografia de ponta a ponta. Seus dados financeiros sincronizados em nuvem.
              </span>
            </div>
          </section>

          {/* LADO DIREITO: CARD DE FORMULÁRIO (Mobile & Desktop) */}
          <section
            aria-label="Formulário de acesso"
            className="w-full lg:col-span-5 max-w-md mx-auto"
          >
            <div className="bg-zinc-900/85 backdrop-blur-xl border border-zinc-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative">
              {/* Segmented Control: Entrar vs. Criar Conta */}
              {authMode !== 'forgot' && (
                <div className="relative grid grid-cols-2 p-1 mb-6 bg-zinc-950/80 rounded-2xl border border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => handleModeChange('login')}
                    className={`relative z-10 h-11 min-h-[44px] text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                      authMode === 'login' ? 'text-zinc-950' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {authMode === 'login' && (
                      <motion.div
                        layoutId="authTabIndicator"
                        className="absolute inset-0 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/30"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <LogIn className="w-4 h-4" />
                      <span>Entrar</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeChange('register')}
                    className={`relative z-10 h-11 min-h-[44px] text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                      authMode === 'register' ? 'text-zinc-950' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {authMode === 'register' && (
                      <motion.div
                        layoutId="authTabIndicator"
                        className="absolute inset-0 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/30"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4" />
                      <span>Criar Conta</span>
                    </span>
                  </button>
                </div>
              )}

              {/* Cabeçalho do modo "Esqueci Minha Senha" */}
              {authMode === 'forgot' && (
                <div className="mb-6 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleModeChange('login')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-emerald-400 transition cursor-pointer mb-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Voltar para o Login</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Recuperar Acesso</h3>
                      <p className="text-xs text-zinc-400">
                        Receba um link seguro para cadastrar uma nova senha
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Mensagem de Erro com Animação Shake */}
              {errorMessage && (
                <motion.div
                  key={errorMessage}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0, x: [-8, 8, -6, 6, -3, 3, 0] }}
                  transition={{ duration: 0.35 }}
                  className="mb-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </motion.div>
              )}

              {/* Mensagem de Sucesso */}
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{successMessage}</span>
                </motion.div>
              )}

              {/* Tela pós envio de recuperação */}
              {authMode === 'forgot' && forgotSentSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-4 text-center space-y-4"
                >
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Verifique seu E-mail</h4>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed max-w-xs mx-auto">
                      Enviamos as instruções de redefinição para{' '}
                      <strong className="text-emerald-400">{email}</strong>.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleModeChange('login')}
                    className="w-full h-12 min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-sm transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Voltar para o Login</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              ) : (
                /* Formulários com Transição Suave */
                <form onSubmit={handleSubmit} className="space-y-4">
                  <AnimatePresence mode="wait">
                    {/* 1. MODO RECUPERAÇÃO DE SENHA */}
                    {authMode === 'forgot' && (
                      <motion.div
                        key="form-forgot"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                            Seu E-mail Cadastrado
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                              <Mail className="w-4 h-4" />
                            </div>
                            <input
                              type="email"
                              inputMode="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="exemplo@email.com"
                              className="w-full pl-10 pr-3.5 h-12 min-h-[48px] bg-zinc-950/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/80 transition"
                            />
                          </div>
                        </div>

                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          type="submit"
                          disabled={loading}
                          className="w-full mt-2 h-12 min-h-[48px] rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-zinc-950 font-black text-sm shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Enviando link...</span>
                            </>
                          ) : (
                            <>
                              <Mail className="w-4 h-4" />
                              <span>Enviar Link de Redefinição</span>
                            </>
                          )}
                        </motion.button>
                      </motion.div>
                    )}

                    {/* 2. MODO LOGIN */}
                    {authMode === 'login' && (
                      <motion.div
                        key="form-login"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                            E-mail
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                              <Mail className="w-4 h-4" />
                            </div>
                            <input
                              type="email"
                              inputMode="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="seu@email.com"
                              className="w-full pl-10 pr-3.5 h-12 min-h-[48px] bg-zinc-950/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/80 transition"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-semibold text-zinc-300">
                              Senha
                            </label>
                            <button
                              type="button"
                              onClick={() => handleModeChange('forgot')}
                              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                            >
                              Esqueceu a senha?
                            </button>
                          </div>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                              <Lock className="w-4 h-4" />
                            </div>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full pl-10 pr-12 h-12 min-h-[48px] bg-zinc-950/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/80 transition"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                              className="absolute inset-y-0 right-0 pr-3 pl-3 flex items-center text-zinc-400 hover:text-white transition cursor-pointer"
                            >
                              {showPassword ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          type="submit"
                          disabled={loading}
                          className="w-full mt-2 h-12 min-h-[48px] rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-zinc-950 font-black text-sm shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                              <span>Autenticando...</span>
                            </>
                          ) : (
                            <>
                              <LogIn className="w-4 h-4 stroke-[2.5]" />
                              <span>Acessar Minha Conta</span>
                            </>
                          )}
                        </motion.button>
                      </motion.div>
                    )}

                    {/* 3. MODO CADASTRO */}
                    {authMode === 'register' && (
                      <motion.div
                        key="form-register"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3.5"
                      >
                        {/* Nome Completo */}
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            Nome Completo
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                              <User className="w-4 h-4" />
                            </div>
                            <input
                              type="text"
                              required
                              value={nome}
                              onChange={(e) => setNome(e.target.value)}
                              placeholder="Ex: Carlos Oliveira"
                              className="w-full pl-10 pr-3.5 h-12 min-h-[48px] bg-zinc-950/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/80 transition"
                            />
                          </div>
                        </div>

                        {/* E-mail */}
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            E-mail
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                              <Mail className="w-4 h-4" />
                            </div>
                            <input
                              type="email"
                              inputMode="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="seu@email.com"
                              className="w-full pl-10 pr-3.5 h-12 min-h-[48px] bg-zinc-950/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/80 transition"
                            />
                          </div>
                        </div>

                        {/* Telefone / WhatsApp */}
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            WhatsApp / Telefone (Opcional)
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                              <Phone className="w-4 h-4" />
                            </div>
                            <input
                              type="tel"
                              inputMode="tel"
                              value={telefone}
                              onChange={handlePhoneChange}
                              placeholder="(11) 98765-4321"
                              className="w-full pl-10 pr-3.5 h-12 min-h-[48px] bg-zinc-950/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/80 transition"
                            />
                          </div>
                        </div>

                        {/* Transportadora / Rota */}
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            Transportadora / Rota (Opcional)
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                              <Truck className="w-4 h-4" />
                            </div>
                            <input
                              type="text"
                              value={transportadora}
                              onChange={(e) => setTransportadora(e.target.value)}
                              placeholder="Ex: Mercado Livre, Shopee, Amazon"
                              className="w-full pl-10 pr-3.5 h-12 min-h-[48px] bg-zinc-950/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/80 transition"
                            />
                          </div>
                        </div>

                        {/* Senhas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              Senha
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                                <Lock className="w-4 h-4" />
                              </div>
                              <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Mínimo 6 dígitos"
                                className="w-full pl-10 pr-10 h-12 min-h-[48px] bg-zinc-950/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/80 transition"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">
                              Confirmar Senha
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                                <Lock className="w-4 h-4" />
                              </div>
                              <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repita a senha"
                                className="w-full pl-10 pr-10 h-12 min-h-[48px] bg-zinc-950/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/80 transition"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Toggle de visibilidade da senha */}
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-xs text-zinc-400 hover:text-emerald-400 flex items-center gap-1.5 transition cursor-pointer"
                          >
                            {showPassword ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Ocultar senhas</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>Mostrar senhas</span>
                              </>
                            )}
                          </button>
                        </div>

                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          type="submit"
                          disabled={loading}
                          className="w-full mt-2 h-12 min-h-[48px] rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-zinc-950 font-black text-sm shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                              <span>Preparando seu painel...</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4 stroke-[2.5]" />
                              <span>Criar Conta Grátis</span>
                            </>
                          )}
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>
              )}

              {/* Rodapé Alternador */}
              <div className="mt-6 pt-5 border-t border-zinc-800/80 text-center text-xs text-zinc-400">
                {authMode === 'login' ? (
                  <p>
                    Ainda não tem conta no Gastos Rota?{' '}
                    <button
                      type="button"
                      onClick={() => handleModeChange('register')}
                      className="text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-4 ml-1 cursor-pointer transition"
                    >
                      Cadastre-se grátis
                    </button>
                  </p>
                ) : authMode === 'register' ? (
                  <p>
                    Já possui conta cadastrada?{' '}
                    <button
                      type="button"
                      onClick={() => handleModeChange('login')}
                      className="text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-4 ml-1 cursor-pointer transition"
                    >
                      Entrar agora
                    </button>
                  </p>
                ) : (
                  <p>
                    Lembrou da senha?{' '}
                    <button
                      type="button"
                      onClick={() => handleModeChange('login')}
                      className="text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-4 ml-1 cursor-pointer transition"
                    >
                      Fazer login
                    </button>
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
