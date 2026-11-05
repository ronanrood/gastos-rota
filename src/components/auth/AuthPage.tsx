import React, { useState } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { Truck, LogIn, UserPlus, AlertCircle, CheckCircle2, Lock, Mail, User, Eye, EyeOff } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { signIn, signUp, isSupabaseConfigured } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setErrorMessage('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (!isLogin) {
      if (!nome.trim()) {
        setErrorMessage('Por favor, informe seu nome completo.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('A senha deve ter no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('As senhas não coincidem.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setErrorMessage('E-mail ou senha incorretos.');
          } else if (error.message.includes('Email not confirmed')) {
            setErrorMessage('E-mail ainda não confirmado. Por favor, cheque sua caixa de entrada.');
          } else {
            setErrorMessage(error.message || 'Erro ao realizar login. Tente novamente.');
          }
        }
      } else {
        const { error, user } = await signUp(nome, email, password);
        if (error) {
          if (error.message.includes('User already registered')) {
            setErrorMessage('Este e-mail já está cadastrado no sistema.');
          } else {
            setErrorMessage(error.message || 'Erro ao realizar cadastro.');
          }
        } else {
          setSuccessMessage(
            user?.identities?.length === 0
              ? 'Este e-mail já possui conta. Tente fazer login.'
              : 'Cadastro realizado com sucesso! Se a confirmação de e-mail estiver ativa, verifique sua caixa de entrada para ativar o acesso.'
          );
          if (user?.role === 'authenticated') {
            // Conta já logada automaticamente
          } else {
            setIsLogin(true);
          }
        }
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-radial from-emerald-500/10 via-transparent to-transparent pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* App Logo & Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/25 mb-4 ring-4 ring-emerald-500/20">
            <Truck className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Gastos Rota
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Controle financeiro diário e manutenção para motoristas
          </p>
        </div>

        {/* Warning if Supabase URL is not configured properly */}
        {!isSupabaseConfigured && (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs sm:text-sm">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300">Configuração de Conexão Pendente</p>
                <p className="mt-1 text-amber-200/90 leading-relaxed">
                  A URL do Supabase no arquivo <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-300 font-mono">.env</code> precisa ser o endereço HTTP do seu projeto (ex: <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-300 font-mono">https://xyz.supabase.co</code>). Verifique seu painel do Supabase em Project Settings &gt; API.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="mt-6 bg-slate-800/90 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-6 sm:p-8">
          {/* Tabs */}
          <div className="grid grid-cols-2 p-1 mb-6 bg-slate-900/80 rounded-xl border border-slate-700/40">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                isLogin
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                !isLogin
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Criar Conta
            </button>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : isLogin ? (
                <>
                  <LogIn className="w-4 h-4 stroke-[2.5]" />
                  Acessar Minha Conta
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 stroke-[2.5]" />
                  Finalizar Cadastro
                </>
              )}
            </button>
          </form>

          {/* Footer toggle */}
          <div className="mt-6 text-center text-xs text-slate-400">
            {isLogin ? (
              <p>
                Ainda não tem conta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setErrorMessage(null);
                  }}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 ml-1 cursor-pointer"
                >
                  Cadastre-se gratuitamente
                </button>
              </p>
            ) : (
              <p>
                Já possui uma conta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setErrorMessage(null);
                  }}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 ml-1 cursor-pointer"
                >
                  Faça login
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
