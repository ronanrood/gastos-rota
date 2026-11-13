import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/database';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  User,
  Camera,
  Truck,
  MapPin,
  Shield,
  Copy,
  Check,
  Save,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Phone,
  CreditCard,
  Building,
  Navigation,
  Search,
} from 'lucide-react';
import {
  formatCpfCnpj,
  formatPhone,
  formatCep,
  getInitials,
} from '../../utils/formatters';

interface ProfileFormProps {
  profile: Profile;
  user: SupabaseUser;
  refreshProfile: () => Promise<void>;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ profile, user, refreshProfile }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Card 1 — Identificação
  const [avatarUrl, setAvatarUrl] = useState<string>(profile.avatar_url || '');
  const [nome, setNome] = useState<string>(profile.nome || '');
  const [cpfCnpj, setCpfCnpj] = useState<string>(profile.cpf_cnpj ? formatCpfCnpj(profile.cpf_cnpj) : '');
  const [telefone, setTelefone] = useState<string>(profile.telefone ? formatPhone(profile.telefone) : '');

  // Card 2 — Dados Operacionais e PIX
  const [transportadora, setTransportadora] = useState<string>(profile.transportadora || '');
  const [rota, setRota] = useState<string>(profile.rota || '');
  const [chavePix, setChavePix] = useState<string>(profile.chave_pix || '');
  const [copiedPix, setCopiedPix] = useState(false);

  // Card 3 — Endereço
  const [cep, setCep] = useState<string>(profile.cep ? formatCep(profile.cep) : '');
  const [endereco, setEndereco] = useState<string>(profile.endereco || '');
  const [numero, setNumero] = useState<string>(profile.numero || '');
  const [bairro, setBairro] = useState<string>(profile.bairro || '');
  const [cidade, setCidade] = useState<string>(profile.cidade || '');
  const [estado, setEstado] = useState<string>(profile.estado || '');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  // Card 4 — Segurança
  const [novoEmail, setNovoEmail] = useState<string>(profile.email || user.email || '');
  const [novaSenha, setNovaSenha] = useState<string>('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState<string>('');
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [senhaLoading, setSenhaLoading] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  // Feedbacks gerais do perfil
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Consulta automática de CEP via ViaCEP
  const handleCepSearch = async (cepValue: string) => {
    const rawCep = cepValue.replace(/\D/g, '');
    if (rawCep.length !== 8) return;

    setCepLoading(true);
    setCepError(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        setCepError('CEP não encontrado. Por favor, preencha manualmente.');
        return;
      }

      if (data.logradouro) setEndereco(data.logradouro);
      if (data.bairro) setBairro(data.bairro);
      if (data.localidade) setCidade(data.localidade);
      if (data.uf) setEstado(data.uf);

      // Foca automaticamente no campo número após preenchimento
      setTimeout(() => {
        document.getElementById('numero-input')?.focus();
      }, 100);
    } catch (err) {
      console.error('Erro ao consultar ViaCEP:', err);
      setCepError('Falha ao consultar CEP online. Digite o endereço manualmente.');
    } finally {
      setCepLoading(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setCep(formatted);
    const raw = formatted.replace(/\D/g, '');
    if (raw.length === 8) {
      handleCepSearch(raw);
    }
  };

  // Upload de Foto de Perfil para o Supabase Storage (bucket 'avatars')
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFeedbackError(null);
    setFeedbackSuccess(null);
    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}/avatar_${Date.now()}.${fileExt}`;

      // Upload no bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Pega a URL pública gerada
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // Atualiza a tabela profiles do usuário
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      await refreshProfile();
      setFeedbackSuccess('Foto de perfil atualizada com sucesso!');
      setTimeout(() => setFeedbackSuccess(null), 4000);
    } catch (err: unknown) {
      console.error('Erro ao fazer upload do avatar:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar foto de perfil.';
      setFeedbackError(msg);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Copiar Chave PIX com feedback
  const handleCopyPix = async () => {
    if (!chavePix.trim()) return;
    try {
      await navigator.clipboard.writeText(chavePix.trim());
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar Chave PIX:', err);
    }
  };

  // Salvar Dados Principais do Perfil (Cards 1, 2 e 3)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError(null);
    setFeedbackSuccess(null);

    if (!nome.trim()) {
      setFeedbackError('O Nome Completo é obrigatório.');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nome: nome.trim(),
          cpf_cnpj: cpfCnpj.trim() || null,
          telefone: telefone.trim() || null,
          transportadora: transportadora.trim() || null,
          rota: rota.trim() || null,
          chave_pix: chavePix.trim() || null,
          cep: cep.trim() || null,
          endereco: endereco.trim() || null,
          numero: numero.trim() || null,
          bairro: bairro.trim() || null,
          cidade: cidade.trim() || null,
          estado: estado.trim() || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      setFeedbackSuccess('Perfil atualizado com sucesso!');
      setTimeout(() => setFeedbackSuccess(null), 4000);
    } catch (err: unknown) {
      console.error('Erro ao salvar dados do perfil:', err);
      const msg = err instanceof Error ? err.message : 'Não foi possível salvar o perfil.';
      setFeedbackError(msg);
    } finally {
      setSaving(false);
    }
  };

  // Atualizar E-mail na autenticação e no profile
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    const trimmedEmail = novoEmail.trim();
    if (!trimmedEmail) {
      setSecurityError('Informe um e-mail válido.');
      return;
    }

    setEmailLoading(true);

    try {
      // Atualiza no Auth
      const { error: authError } = await supabase.auth.updateUser({
        email: trimmedEmail,
      });

      if (authError) throw authError;

      // Atualiza na tabela profiles
      await supabase
        .from('profiles')
        .update({ email: trimmedEmail })
        .eq('id', user.id);

      await refreshProfile();
      setSecuritySuccess(
        'E-mail atualizado! Se a confirmação de segurança estiver ativa no Supabase, cheque a caixa de entrada para confirmar.'
      );
      setTimeout(() => setSecuritySuccess(null), 6000);
    } catch (err: unknown) {
      console.error('Erro ao atualizar e-mail:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar e-mail.';
      setSecurityError(msg);
    } finally {
      setEmailLoading(false);
    }
  };

  // Atualizar Senha de Acesso
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    if (!novaSenha) {
      setSecurityError('Digite a nova senha.');
      return;
    }

    if (novaSenha.length < 6) {
      setSecurityError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmarNovaSenha) {
      setSecurityError('As senhas digitadas não coincidem.');
      return;
    }

    setSenhaLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
      });

      if (error) throw error;

      setNovaSenha('');
      setConfirmarNovaSenha('');
      setSecuritySuccess('Senha alterada com sucesso! Use a nova senha no próximo acesso.');
      setTimeout(() => setSecuritySuccess(null), 5000);
    } catch (err: unknown) {
      console.error('Erro ao alterar senha:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao alterar senha.';
      setSecurityError(msg);
    } finally {
      setSenhaLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-400">
              <User className="w-5 h-5 stroke-[2.2]" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Meu Perfil
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Informações cadastrais, dados operacionais da rota e segurança
          </p>
        </div>

        {/* Badge do Papel / Status */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-900 border border-slate-800 text-slate-300 font-mono">
            {profile.role === 'admin' ? '🛡️ Administrador' : '🚚 Motorista Parceiro'}
          </span>
          <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            ● Ativo
          </span>
        </div>
      </div>

      {/* FEEDBACKS GERAIS DO PERFIL */}
      {feedbackError && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5 shadow-md">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Erro</p>
            <p className="text-rose-300/90">{feedbackError}</p>
          </div>
        </div>
      )}

      {feedbackSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5 shadow-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <span className="font-semibold">{feedbackSuccess}</span>
        </div>
      )}

      {/* FORMULÁRIO PRINCIPAL DOS DADOS (CARDS 1, 2 E 3) */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* ==========================================
            CARD 1 — FOTO DE PERFIL E IDENTIFICAÇÃO
        =========================================== */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3.5 mb-6">
            <User className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight uppercase">
              Foto de Perfil e Identificação
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
            {/* Avatar circular com botão de câmera sobreposto */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-slate-800 bg-slate-950 overflow-hidden flex items-center justify-center text-emerald-400 text-2xl sm:text-3xl font-black shadow-xl ring-2 ring-emerald-500/30">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={nome || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{getInitials(nome)}</span>
                )}
              </div>

              {/* Botão de Câmera */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Alterar Foto de Perfil"
                className="absolute bottom-0 right-0 w-9 h-9 min-h-[36px] min-w-[36px] rounded-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 flex items-center justify-center shadow-lg transition active:scale-[0.95] cursor-pointer"
              >
                {uploadingAvatar ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 stroke-[2.2]" />
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <div className="text-center sm:text-left flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">
                {nome || 'Motorista'}
              </h3>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {profile.email || user.email}
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                Formatos aceitos: JPG, PNG ou WEBP. A foto será salva automaticamente no Supabase Storage.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Nome Completo */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nome Completo *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full pl-9 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* CPF ou CNPJ */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                CPF ou CNPJ
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full pl-9 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Telefone / WhatsApp */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Telefone / WhatsApp
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={telefone}
                  onChange={(e) => setTelefone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="w-full pl-9 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            CARD 2 — DADOS OPERACIONAIS E PIX
        =========================================== */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3.5 mb-5">
            <Truck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight uppercase">
              Dados Operacionais e Recebimento (PIX)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Transportadora */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Transportadora / Agregado
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Building className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={transportadora}
                  onChange={(e) => setTransportadora(e.target.value)}
                  placeholder="Ex: Mercado Envios, Shopee"
                  className="w-full pl-9 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Rota */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nome ou Código da Rota
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Navigation className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={rota}
                  onChange={(e) => setRota(e.target.value)}
                  placeholder="Ex: Rota SP-04 Leste"
                  className="w-full pl-9 pr-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Chave PIX + Botão Copiar */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Chave PIX para Recebimentos
              </label>
              <div className="relative flex">
                <input
                  type="text"
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  placeholder="CPF, e-mail, celular ou chave aleatória"
                  className="w-full pr-12 pl-3 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleCopyPix}
                  disabled={!chavePix.trim()}
                  title="Copiar Chave PIX"
                  className="absolute inset-y-0 right-0 pr-3 pl-2 flex items-center text-slate-400 hover:text-emerald-400 disabled:opacity-30 cursor-pointer transition active:scale-[0.95]"
                >
                  {copiedPix ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded-md">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            CARD 3 — ENDEREÇO COMPLETO (ViaCEP)
        =========================================== */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5 mb-5">
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight uppercase">
                Endereço Completo
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Preenchimento automático via CEP
            </span>
          </div>

          {cepError && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{cepError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* CEP */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                CEP (Busca Automática)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={cep}
                  onChange={handleCepChange}
                  placeholder="00000-000"
                  className="w-full pr-9 pl-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  {cepLoading ? (
                    <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </div>
              </div>
            </div>

            {/* Endereço / Rua */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Endereço (Rua / Avenida)
              </label>
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Ex: Av. Paulista"
                className="w-full px-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Número */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Número
              </label>
              <input
                id="numero-input"
                type="text"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex: 1500"
                className="w-full px-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Bairro */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Bairro
              </label>
              <input
                type="text"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                placeholder="Ex: Bela Vista"
                className="w-full px-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Cidade */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Cidade
              </label>
              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Ex: São Paulo"
                className="w-full px-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Estado */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Estado (UF)
              </label>
              <input
                type="text"
                maxLength={2}
                value={estado}
                onChange={(e) => setEstado(e.target.value.toUpperCase())}
                placeholder="SP"
                className="w-full px-3.5 py-3 sm:py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white text-base sm:text-sm uppercase font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* BOTÃO PRINCIPAL: SALVAR PERFIL */}
          <div className="pt-6 border-t border-slate-800/80 mt-6">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto min-w-[200px] h-12 min-h-[48px] px-6 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-base sm:text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Salvando Dados...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 stroke-[2.2]" />
                  Salvar Dados do Perfil
                </>
              )}
            </button>
          </div>
        </section>
      </form>

      {/* ==========================================
          CARD 4 — SEGURANÇA DA CONTA (E-MAIL E SENHA)
      =========================================== */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl backdrop-blur-md relative overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3.5 mb-5">
          <Shield className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight uppercase">
            Segurança da Conta (E-mail e Senha)
          </h2>
        </div>

        {/* FEEDBACK DE SEGURANÇA */}
        {securityError && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2 shadow-md">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <span>{securityError}</span>
          </div>
        )}

        {securitySuccess && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-2 shadow-md">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <span>{securitySuccess}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Subseção A: Atualização de E-mail */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
            <form onSubmit={handleUpdateEmail} className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  E-mail de Acesso
                </h3>
                <p className="text-[11px] text-slate-400">
                  Atualize o e-mail utilizado para fazer login no Gastos Rota
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Novo E-mail
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    placeholder="novo@email.com"
                    className="w-full pl-9 pr-3.5 py-3 sm:py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={emailLoading || novoEmail.trim() === (profile.email || user.email)}
                className="w-full h-11 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white font-bold text-xs sm:text-sm transition active:scale-[0.98] disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
              >
                {emailLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Atualizar E-mail'
                )}
              </button>
            </form>
          </div>

          {/* Subseção B: Alteração de Senha */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  Alterar Senha
                </h3>
                <p className="text-[11px] text-slate-400">
                  Crie uma senha forte com no mínimo 6 caracteres
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nova Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNovaSenha ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 6 dígitos"
                    className="w-full pl-9 pr-10 py-3 sm:py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNovaSenha(!showNovaSenha)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmarSenha ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmarNovaSenha}
                    onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full pl-9 pr-10 py-3 sm:py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showConfirmarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={senhaLoading || !novaSenha}
                className="w-full h-11 min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-xs sm:text-sm transition active:scale-[0.98] disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
              >
                {senhaLoading ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Salvar Nova Senha'
                )}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};

export const ProfilePage: React.FC = () => {
  const { user, profile, refreshProfile, loading } = useAuth();

  if (loading && !profile) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold">Carregando dados do perfil...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400 text-center px-4">
        <p className="text-sm font-semibold text-slate-300">Sessão não identificada</p>
        <p className="text-xs text-slate-400 mt-1">Por favor, faça login novamente para acessar seu perfil.</p>
      </div>
    );
  }

  const effectiveProfile: Profile = profile || {
    id: user.id,
    nome: user.user_metadata?.nome || user.email?.split('@')[0] || 'Motorista',
    email: user.email || '',
    role: 'driver',
    status: 'active',
  };

  return (
    <ProfileForm
      key={effectiveProfile.id}
      profile={effectiveProfile}
      user={user}
      refreshProfile={refreshProfile}
    />
  );
};
