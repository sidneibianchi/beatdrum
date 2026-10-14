import React, { useState, useRef, useEffect } from 'react';
import { Plus, Radio, Smartphone, Cloud, CloudCheck, RefreshCw, LogIn, LogOut, Database, User as UserIcon } from 'lucide-react';
import type { User } from '../firebase';

interface HeaderProps {
  activeView: 'sequencer' | 'pedal' | 'samples';
  onSelectView: (view: 'sequencer' | 'pedal' | 'samples') => void;
  onOpenCreateModal: () => void;
  onOpenFootswitchModal?: () => void;
  onOpenMobileGuide?: () => void;
  onOpenShareMobile?: () => void;
  isSyncing?: boolean;
  lastSyncTime?: number | null;
  onManualSync?: () => void;
  currentUser?: User | null;
  isFirebaseLoading?: boolean;
  onLoginFirebase?: () => void;
  onLogoutFirebase?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onSelectView,
  onOpenCreateModal,
  onOpenFootswitchModal,
  onOpenMobileGuide,
  onOpenShareMobile,
  isSyncing = false,
  lastSyncTime = null,
  onManualSync,
  currentUser = null,
  isFirebaseLoading = false,
  onLoginFirebase,
  onLogoutFirebase,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-800 bg-[#0d1322] shrink-0">
      {/* Zone 1: Wordmark & Cloud Sync Status Badge */}
      <div className="flex items-center gap-3">
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            onSelectView('sequencer');
          }}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-amber-400 transition-colors"
        >
          BeatBuddy Studio
        </a>

        {/* Cloud Sync indicator */}
        {onManualSync && (
          <button
            type="button"
            onClick={onManualSync}
            title={
              lastSyncTime
                ? `Sincronizado na nuvem (Firebase + Servidor) às ${new Date(lastSyncTime).toLocaleTimeString('pt-BR')}. Clique para forçar sincronização agora.`
                : 'Sincronizar ritmos e samples com o banco de dados Firebase para o celular'
            }
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50 transition-colors cursor-pointer"
          >
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
            ) : (
              <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{isSyncing ? 'Sincronizando...' : currentUser ? 'Nuvem Firebase Conectada' : 'PC & Celular Sincronizados'}</span>
          </button>
        )}
      </div>

      {/* Zone 2: Navigation links */}
      <nav className="flex items-center gap-2 md:gap-6 text-sm font-medium text-slate-300">
        <button
          type="button"
          onClick={() => onSelectView('sequencer')}
          className={`hidden md:block cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
            activeView === 'sequencer'
              ? 'text-amber-400 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Sequenciador Matrix (PC)
        </button>
        <button
          type="button"
          onClick={() => onSelectView('pedal')}
          className={`cursor-pointer whitespace-nowrap shrink-0 transition-colors px-2.5 py-1 rounded-lg ${
            activeView === 'pedal'
              ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
              : 'text-slate-300 hover:text-white bg-slate-900 border border-slate-700/80 md:bg-transparent md:border-transparent'
          }`}
        >
          🦶 Pedal BeatBuddy Live
        </button>
        <button
          type="button"
          onClick={() => onSelectView('samples')}
          className={`hidden md:block cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
            activeView === 'samples'
              ? 'text-amber-400 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Meus Samples & Gravação
        </button>
        {/* Mobile toggle to switch to Sequencer Matrix if desired */}
        <button
          type="button"
          onClick={() => onSelectView(activeView === 'sequencer' ? 'pedal' : 'sequencer')}
          className="md:hidden text-xs text-slate-300 hover:text-amber-300 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 transition-colors"
        >
          {activeView === 'sequencer' ? '🦶 Voltar ao Pedal' : '🖥️ Modo PC'}
        </button>
      </nav>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Firebase Cloud Account & Sync */}
        {currentUser ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              title="Conta Google conectada ao banco de dados Firebase. Clique para gerenciar."
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/50 rounded-lg transition-colors cursor-pointer"
            >
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="w-5 h-5 rounded-full ring-1 ring-emerald-400"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-emerald-700 flex items-center justify-center text-[10px] text-white font-bold">
                  {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <span className="hidden sm:inline max-w-[100px] truncate">
                {currentUser.displayName || currentUser.email?.split('@')[0]}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center gap-2.5 pb-2.5 mb-2 border-b border-slate-800">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'User'}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-white truncate">
                      {currentUser.displayName || 'Músico'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{currentUser.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 mb-2 bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-[11px] text-emerald-300">
                  <Database className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  <span>Banco de Dados Firestore ativo. Seus samples e ritmos estão salvos!</span>
                </div>

                {onManualSync && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onManualSync();
                    }}
                    disabled={isSyncing}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors mb-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Nuvem Agora'}</span>
                  </button>
                )}

                {onLogoutFirebase && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogoutFirebase();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Desconectar Conta</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : onLoginFirebase ? (
          <button
            type="button"
            onClick={onLoginFirebase}
            disabled={isFirebaseLoading}
            title="Conectar com o Google para salvar ritmos e samples no banco de dados Firebase e não perder no celular"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 rounded-lg transition-all cursor-pointer shadow-sm disabled:opacity-60"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="hidden sm:inline">Salvar na Nuvem</span>
          </button>
        ) : null}

        {onManualSync && (
          <button
            type="button"
            title="Sincronizar ritmos e samples com a nuvem para o celular"
            onClick={onManualSync}
            className="flex lg:hidden items-center p-2 text-emerald-400 bg-slate-900 hover:bg-slate-800 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
          >
            <Cloud className="w-3.5 h-3.5" />
          </button>
        )}
        {onOpenShareMobile && (
          <button
            type="button"
            title="Abrir no celular com QR Code e tocar o ritmo"
            onClick={onOpenShareMobile}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-300 hover:text-slate-950 bg-amber-400/10 hover:bg-amber-400 border border-amber-400/40 rounded-lg transition-all cursor-pointer shadow-sm"
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-400 group-hover:text-slate-950" />
            <span>Abrir no Celular</span>
          </button>
        )}
        {onOpenFootswitchModal && (
          <button
            type="button"
            title="Configurar pedal Bluetooth / Cuvave Cube Turner Pro e MIDI"
            onClick={onOpenFootswitchModal}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Pedal Cuvave</span>
          </button>
        )}
        <button
          type="button"
          onClick={onOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] rounded-lg shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Ritmo</span>
        </button>
      </div>
    </header>
  );
};
