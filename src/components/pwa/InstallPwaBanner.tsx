import React, { useState, useEffect } from 'react';
import {
  Download,
  Smartphone,
  Share2,
  PlusSquare,
  X,
  Sparkles,
  CheckCircle2,
  Truck,
} from 'lucide-react';

// Interface do evento BeforeInstallPromptEvent do W3C
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const getIsStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isDisplayStandalone || isIosStandalone;
};

const getIsIosDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const InstallPwaBanner: React.FC<{ inDrawer?: boolean; onActionComplete?: () => void }> = ({
  inDrawer = false,
  onActionComplete,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(getIsStandalone);
  const [isIosDevice] = useState(getIsIosDevice);
  const [showIosModal, setShowIosModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Listener do evento beforeinstallprompt (Android / Chrome / Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listener quando o app termina de ser instalado
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Se já estiver instalado em tela cheia, oculte o botão/banner
  if (isStandalone) {
    return null;
  }

  const handleInstallClick = async () => {
    // Caso Android/Chrome com prompt capturado
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setDeferredPrompt(null);
          setIsStandalone(true);
        }
      } catch (err) {
        console.error('Erro ao acionar prompt de instalação:', err);
      }
      onActionComplete?.();
      return;
    }

    // Caso iPhone/iOS Safari (ou navegador sem beforeinstallprompt)
    if (isIosDevice) {
      setShowIosModal(true);
      return;
    }

    // Outros navegadores: abre modal com orientação universal
    setShowIosModal(true);
  };

  return (
    <>
      {/* RENDERIZAÇÃO NO MENU HAMBÚRGUER (DRAWER) */}
      {inDrawer ? (
        <div className="px-3 py-2">
          <button
            type="button"
            onClick={handleInstallClick}
            className="w-full min-h-[48px] p-3 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/20 hover:from-emerald-500/25 hover:to-teal-500/25 border border-emerald-500/35 text-emerald-300 hover:text-white flex items-center justify-between transition-all group active:scale-[0.98] cursor-pointer shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 font-bold shadow-sm shadow-emerald-500/30">
                <Smartphone className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="text-left min-w-0">
                <span className="text-xs font-extrabold text-white block truncate leading-tight flex items-center gap-1.5">
                  📲 Instalar no Celular
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 uppercase">
                    App
                  </span>
                </span>
                <span className="text-[10px] text-emerald-400/90 block truncate leading-tight mt-0.5">
                  {isIosDevice ? 'Adicionar à tela de início' : 'Carregamento instantâneo offline'}
                </span>
              </div>
            </div>

            <Download className="w-4 h-4 text-emerald-400 group-hover:translate-y-0.5 transition-transform shrink-0 ml-2" />
          </button>
        </div>
      ) : (
        /* RENDERIZAÇÃO COMO BANNER DISCRETO (opcional no topo/rodapé) */
        !dismissed && (
          <aside
            aria-label="Notificação de instalação do aplicativo"
            className="mb-4 sm:mb-5 relative bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-3.5 shadow-xl backdrop-blur-md"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20 font-bold">
                  <Smartphone className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                    Instalar Gastos Rota no Celular
                    <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    Acesse direto da sua tela inicial como um app nativo
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition active:scale-[0.96] cursor-pointer"
                >
                  Instalar
                </button>
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  aria-label="Fechar banner"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </aside>
        )
      )}

      {/* MODAL VISUAL COM GUIA PASSO A PASSO (ESPECIALMENTE PARA IPHONE / SAFARI) */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-emerald-500/20 shrink-0">
                  <Truck className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white tracking-tight">
                    Instalar Gastos Rota
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isIosDevice
                      ? 'Como adicionar no iPhone / Safari'
                      : 'Adicione à tela inicial do seu dispositivo'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Passos ilustrados */}
            <div className="space-y-3.5 my-2">
              {/* Passo 1 */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/90 flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  <p className="font-bold text-white mb-0.5 flex items-center gap-1.5">
                    {isIosDevice ? (
                      <>
                        Toque no botão Compartilhar
                        <span className="p-1 bg-slate-800 rounded-lg text-emerald-400 inline-flex items-center">
                          <Share2 className="w-3.5 h-3.5" />
                        </span>
                      </>
                    ) : (
                      'Abra as opções do seu navegador'
                    )}
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    {isIosDevice
                      ? 'Localizado na barra inferior do Safari (o quadrado com uma seta para cima).'
                      : 'Toque nos 3 pontinhos do menu do navegador no canto superior direito.'}
                  </p>
                </div>
              </div>

              {/* Passo 2 */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/90 flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  <p className="font-bold text-white mb-0.5 flex items-center gap-1.5">
                    Role e toque em &quot;Adicionar à Tela de Início&quot;
                    <span className="p-1 bg-slate-800 rounded-lg text-emerald-400 inline-flex items-center">
                      <PlusSquare className="w-3.5 h-3.5" />
                    </span>
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Selecione &quot;Adicionar&quot; no canto superior. O ícone oficial do Gastos Rota aparecerá no seu celular!
                  </p>
                </div>
              </div>

              {/* Vantagens do PWA */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Abre em <strong>tela cheia</strong>, sem barras de navegação do browser e com carregamento instantâneo.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                className="w-full h-12 min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-sm transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                Entendi, vamos lá!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
