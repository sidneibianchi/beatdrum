/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Radio, Volume2, CheckCircle2, ArrowRightLeft, Disc3 } from 'lucide-react';
import { SongPartId } from '../types/rhythm';
import { footswitchManager } from '../audio/midiAndPedalManager';
import { audioEngine } from '../audio/AudioEngine';

interface PedalControllerProps {
  isPlaying: boolean;
  currentPartId: SongPartId;
  basePartId?: SongPartId;
  selectedStartPart?: SongPartId;
  isFill: boolean;
  isTransition: boolean;
  isOutro: boolean;
  isIntro?: boolean;
  activeFillId?: SongPartId | null;
  activeTransitionId?: SongPartId | null;
  isExternalPedal1Pressed?: boolean;
  isExternalPedal2Pressed?: boolean;
  onPedal1Tap: () => void;
  onPedal1HoldStart: () => void;
  onPedal2Tap: () => void;
  onStop: () => void;
  onOpenFootswitchConfig?: () => void;
}

export const PedalController: React.FC<PedalControllerProps> = ({
  isPlaying,
  currentPartId: _currentPartId,
  basePartId = 'verse',
  selectedStartPart = 'verse',
  isFill,
  isTransition,
  isOutro,
  isIntro,
  activeFillId,
  activeTransitionId,
  isExternalPedal1Pressed = false,
  isExternalPedal2Pressed = false,
  onPedal1Tap,
  onPedal1HoldStart,
  onPedal2Tap,
  onStop,
  onOpenFootswitchConfig,
}) => {
  const [isPedal1Pressed, setIsPedal1Pressed] = useState(false);
  const [isPedal2Pressed, setIsPedal2Pressed] = useState(false);
  const pedal1PressTimerRef = useRef<number | null>(null);
  const isHoldingRef = useRef<boolean>(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Live Pedal Signal Monitor
  const [recentPedalSignal, setRecentPedalSignal] = useState<{
    text: string;
    type: 'success' | 'unmapped' | 'idle';
    timestamp: number;
    rawKey?: string;
    rawKeyCode?: number;
  }>({
    text: 'Aguardando pisada no pedal Cube Turner Pro...',
    type: 'idle',
    timestamp: 0,
  });

  const [activeProfile, setActiveProfile] = useState<string>(() => {
    return footswitchManager.getConfig().preset || 'universal';
  });

  const callbacksRef = useRef({
    isPlaying,
    onPedal1Tap,
    onPedal1HoldStart,
    onPedal2Tap,
  });

  useEffect(() => {
    callbacksRef.current = {
      isPlaying,
      onPedal1Tap,
      onPedal1HoldStart,
      onPedal2Tap,
    };
  });

  // Keep phone focus active so Bluetooth pedal events are never dropped
  const handleEnsureFocus = () => {
    if (mobileInputRef.current) {
      mobileInputRef.current.focus({ preventScroll: true });
    }
  };

  useEffect(() => {
    const handleActivity = (signal: { type: 'key' | 'midi' | 'ble'; value: string; rawEvent?: unknown }) => {
      setRecentPedalSignal({
        text: signal.value,
        type: 'success',
        timestamp: Date.now(),
      });
    };

    footswitchManager.setCallbacks({
      onActivity: handleActivity,
    });

    const handleGlobalKeyMonitor = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLInputElement && e.target !== mobileInputRef.current) return;

      const isP1 = footswitchManager.isPedal1Event(e);
      const isP2 = footswitchManager.isPedal2Event(e);
      const keyLabel = e.key === ' ' ? 'Espaço' : (e.key || e.code || `KeyCode #${e.keyCode}`);

      if (isP1) {
        setRecentPedalSignal({
          text: `Sinal "${keyLabel}" -> Acionou PEDAL 1!`,
          type: 'success',
          timestamp: Date.now(),
        });
      } else if (isP2) {
        setRecentPedalSignal({
          text: `Sinal "${keyLabel}" -> Acionou PEDAL 2!`,
          type: 'success',
          timestamp: Date.now(),
        });
      } else {
        setRecentPedalSignal({
          text: `Sinal detectado: "${keyLabel}" (KeyCode: ${e.keyCode})`,
          type: 'unmapped',
          timestamp: Date.now(),
          rawKey: e.key || e.code,
          rawKeyCode: e.keyCode,
        });
      }
    };

    window.addEventListener('keydown', handleGlobalKeyMonitor, { capture: true, passive: true });
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyMonitor, { capture: true });
    };
  }, []);

  // Pedal 1 Press Handling (Tap: Intro or Fill / Hold: Ending)
  const handlePedal1PressStart = () => {
    handleEnsureFocus();
    setIsPedal1Pressed(true);
    isHoldingRef.current = false;

    // Hold threshold: >= 400ms triggers Ending if playing
    pedal1PressTimerRef.current = window.setTimeout(() => {
      isHoldingRef.current = true;
      if (callbacksRef.current.isPlaying) {
        callbacksRef.current.onPedal1HoldStart();
      }
    }, 400);
  };

  const handlePedal1PressEnd = () => {
    setIsPedal1Pressed(false);
    if (pedal1PressTimerRef.current) {
      clearTimeout(pedal1PressTimerRef.current);
      pedal1PressTimerRef.current = null;
    }
    if (!isHoldingRef.current) {
      callbacksRef.current.onPedal1Tap();
    }
    isHoldingRef.current = false;
  };

  // Pedal 2 Press Handling (Tap: Stop -> Toggle Part A/B; Play -> Transition A->B or B->A)
  const handlePedal2PressStart = () => {
    handleEnsureFocus();
    setIsPedal2Pressed(true);
    callbacksRef.current.onPedal2Tap();
  };

  const handlePedal2PressEnd = () => {
    setIsPedal2Pressed(false);
  };

  const handleQuickProfileSelect = (preset: 'universal' | 'cuvave_arrows' | 'cuvave_pgup_pgdn' | 'cuvave_space') => {
    const cfg = footswitchManager.getConfig();
    let mainKeys = [...cfg.mainKeys];
    let mainKeyCodes = [...cfg.mainKeyCodes];
    let accentKeys = [...cfg.accentKeys];
    let accentKeyCodes = [...cfg.accentKeyCodes];

    if (preset === 'cuvave_arrows') {
      mainKeys = ['ArrowLeft', 'ArrowDown', 'Left', 'Down'];
      mainKeyCodes = [37, 40];
      accentKeys = ['ArrowRight', 'ArrowUp', 'Right', 'Up'];
      accentKeyCodes = [39, 38];
    } else if (preset === 'cuvave_pgup_pgdn') {
      mainKeys = ['PageDown', 'pagedown'];
      mainKeyCodes = [34];
      accentKeys = ['PageUp', 'pageup'];
      accentKeyCodes = [33];
    } else if (preset === 'cuvave_space') {
      mainKeys = ['Space', ' ', 'Spacebar'];
      mainKeyCodes = [32];
      accentKeys = ['Enter', 'Return'];
      accentKeyCodes = [13];
    }

    const nextConfig = {
      ...cfg,
      preset,
      mainKeys,
      mainKeyCodes,
      accentKeys,
      accentKeyCodes,
    };
    footswitchManager.saveConfig(nextConfig);
    setActiveProfile(preset);
    setRecentPedalSignal({
      text: `Perfil "${preset}" aplicado com sucesso!`,
      type: 'success',
      timestamp: Date.now(),
    });
  };

  const handleTestAudioSample = () => {
    audioEngine.unlockAudioContext();
    audioEngine.triggerInstrument('custom', { volume: 1.0 }, undefined, 'pandeiro grave.wav');
  };

  const activeP1Pressed = isPedal1Pressed || isExternalPedal1Pressed;
  const activeP2Pressed = isPedal2Pressed || isExternalPedal2Pressed;
  const isSignalFresh = Date.now() - recentPedalSignal.timestamp < 3500;
  const isPartB = isPlaying ? basePartId === 'part_b' : selectedStartPart === 'part_b';

  return (
    <div
      onClick={handleEnsureFocus}
      className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 sm:p-6 max-w-2xl mx-auto shadow-2xl relative"
    >
      {/* Input to capture Bluetooth footswitches (Cube Turner Pro) without soft keyboard popup */}
      <input
        ref={mobileInputRef}
        type="text"
        inputMode="none"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value=""
        onChange={() => {}}
        aria-hidden="true"
        className="opacity-0 fixed -top-20 -left-20 w-1 h-1 z-0 pointer-events-auto"
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            Pedal BeatBuddy Live (2 Pedais)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Pedal 1: Intro / Fills / End • Pedal 2: Seleção A/B & Transições
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenFootswitchConfig && (
            <button
              type="button"
              onClick={onOpenFootswitchConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 hover:text-amber-200 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              <span>Configurar Pedal Cube Turner</span>
            </button>
          )}
          {isPlaying && (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 rounded-lg transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              Parar
            </button>
          )}
        </div>
      </div>

      {/* PROMINENT TOP STATUS BANNER: QUAL PARTE ESTÁ TOCANDO OU SELECIONADA */}
      <div
        className={`mb-4 px-4 py-2.5 rounded-xl border flex items-center justify-between gap-3 flex-wrap transition-all duration-200 ${
          isPlaying
            ? isPartB
              ? 'bg-blue-950/70 border-blue-500 text-blue-200 shadow-md shadow-blue-500/20'
              : 'bg-cyan-950/70 border-cyan-500 text-cyan-200 shadow-md shadow-cyan-500/20'
            : isPartB
            ? 'bg-blue-950/60 border-blue-500/80 text-blue-300 shadow-md shadow-blue-500/10'
            : 'bg-cyan-950/60 border-cyan-500/80 text-cyan-300 shadow-md shadow-cyan-500/10'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`w-3 h-3 rounded-full ${
              isPlaying ? 'bg-amber-400 animate-ping' : 'bg-cyan-400'
            }`}
          />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {isPlaying ? 'TOCANDO AGORA NO PEDAL:' : 'SELECIONADA PARA INICIAR:'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-sm sm:text-base font-black tracking-wide uppercase ${
              isPartB ? 'text-blue-300' : 'text-cyan-300'
            }`}
          >
            {isPlaying
              ? isIntro
                ? 'INTRODUÇÃO (➔ Parte A)'
                : isOutro
                ? 'FINALIZAÇÃO (END)'
                : isTransition
                ? activeTransitionId === 'transition_b_a'
                  ? 'TRANSIÇÃO B ➔ A'
                  : 'TRANSIÇÃO A ➔ B'
                : isFill
                ? activeFillId === 'fill_b'
                  ? 'VIRADA (FILL B)'
                  : 'VIRADA (FILL A)'
                : isPartB
                ? 'PARTE B'
                : 'PARTE A'
              : isPartB
              ? 'PARTE B'
              : 'PARTE A'}
          </span>
          {!isPlaying && (
            <span className="text-[11px] text-slate-400 font-medium">
              (Pise no Pedal 2 para alternar)
            </span>
          )}
        </div>
      </div>

      {/* LIVE CUBE TURNER PRO SIGNAL DETECTOR BANNER */}
      <div
        className={`mb-4 p-3 rounded-xl border transition-all duration-200 ${
          isSignalFresh && recentPedalSignal.type === 'success'
            ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
            : isSignalFresh && recentPedalSignal.type === 'unmapped'
            ? 'bg-amber-950/60 border-amber-500/80 text-amber-200'
            : 'bg-slate-950/70 border-slate-800 text-slate-300'
        }`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isSignalFresh && recentPedalSignal.type === 'success'
                  ? 'bg-emerald-400 animate-ping'
                  : isSignalFresh && recentPedalSignal.type === 'unmapped'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-slate-600'
              }`}
            />
            <span className="font-semibold text-slate-200">Cube Turner Pro:</span>
            <span className="font-mono text-xs">
              {recentPedalSignal.text}
            </span>
          </div>

          {/* Quick Bind Button if an unmapped pedal key is stepped on */}
          {recentPedalSignal.type === 'unmapped' && recentPedalSignal.rawKey && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  footswitchManager.bindKeyToPedal1(
                    recentPedalSignal.rawKey!,
                    recentPedalSignal.rawKeyCode
                  );
                }}
                className="px-2 py-0.5 text-[11px] font-bold bg-amber-400 text-slate-950 rounded hover:bg-amber-300 cursor-pointer"
              >
                Vincular ao Pedal 1
              </button>
              <button
                type="button"
                onClick={() => {
                  footswitchManager.bindKeyToPedal2(
                    recentPedalSignal.rawKey!,
                    recentPedalSignal.rawKeyCode
                  );
                }}
                className="px-2 py-0.5 text-[11px] font-bold bg-purple-400 text-slate-950 rounded hover:bg-purple-300 cursor-pointer"
              >
                Vincular ao Pedal 2
              </button>
            </div>
          )}
        </div>

        {/* Quick Mode Profiles */}
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-800/80 text-[11px] flex-wrap">
          <span className="text-slate-400">Modos Cube Turner:</span>
          <button
            type="button"
            onClick={() => handleQuickProfileSelect('cuvave_arrows')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              activeProfile === 'cuvave_arrows'
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
          >
            Modo Setas (Esq / Dir)
          </button>
          <button
            type="button"
            onClick={() => handleQuickProfileSelect('cuvave_pgup_pgdn')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              activeProfile === 'cuvave_pgup_pgdn'
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
          >
            Modo PgDn / PgUp
          </button>
          <button
            type="button"
            onClick={() => handleQuickProfileSelect('cuvave_space')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              activeProfile === 'cuvave_space'
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
          >
            Espaço / Enter
          </button>
        </div>
      </div>

      {/* TWO REALISTIC PEDAL SWITCHES: PEDAL 1 & PEDAL 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* PEDAL 1 (Esquerdo): IN STOP: TAP INTRO | IN PLAY: TAP FILL A/B, HOLD ENDING */}
        <div className="flex flex-col items-center">
          <div className="text-xs font-bold text-slate-300 uppercase mb-1 tracking-wider">
            PEDAL 1 (Esquerdo)
          </div>
          <button
            type="button"
            onMouseDown={handlePedal1PressStart}
            onMouseUp={handlePedal1PressEnd}
            onMouseLeave={() => {
              if (isPedal1Pressed) handlePedal1PressEnd();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              handlePedal1PressStart();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handlePedal1PressEnd();
            }}
            className={`w-full min-h-[180px] rounded-2xl border-4 transition-all duration-100 flex flex-col items-center justify-center p-4 cursor-pointer select-none active:scale-[0.98] ${
              activeP1Pressed
                ? 'scale-[0.97] bg-slate-800 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.4)]'
                : isPlaying
                ? isOutro
                  ? 'bg-red-950/50 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                  : isFill
                  ? 'bg-amber-950/50 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                  : isIntro
                  ? 'bg-emerald-950/50 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  : 'bg-slate-900 border-cyan-500/80 shadow-[0_4px_20px_rgba(6,182,212,0.15)]'
                : 'bg-slate-900 border-emerald-500/70 hover:border-emerald-400 shadow-[0_4px_20px_rgba(16,185,129,0.15)]'
            }`}
          >
            <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center shadow-inner mb-2.5">
              {!isPlaying ? (
                <Play className="w-7 h-7 text-emerald-400 fill-emerald-400 ml-1" />
              ) : isOutro ? (
                <div className="w-7 h-7 rounded-full bg-red-500 animate-pulse" />
              ) : isFill ? (
                <div className="w-7 h-7 rounded-full bg-amber-400 animate-pulse" />
              ) : isIntro ? (
                <div className="w-7 h-7 rounded-full bg-emerald-400 animate-pulse" />
              ) : (
                <Disc3 className="w-7 h-7 text-cyan-400 animate-spin" />
              )}
            </div>

            <span className="text-base font-extrabold text-white tracking-wide uppercase text-center leading-tight">
              {!isPlaying
                ? 'TAP: TOCAR INTRO'
                : isOutro
                ? 'FINALIZANDO (END)'
                : isIntro
                ? 'PULAR INTRO ➔ PARTE A'
                : isPartB
                ? 'TAP: VIRADA (FILL B)'
                : 'TAP: VIRADA (FILL A)'}
            </span>

            <span className="text-xs text-amber-300 font-semibold mt-1 text-center">
              {isPlaying
                ? 'Segurar: Finalizar Música (Ending)'
                : 'Toca Intro e avança para Parte A'}
            </span>

            <span className="text-[10px] text-slate-400 mt-1 font-mono">
              [Switch 1 • PgDn / Seta Esq / Espaço]
            </span>
          </button>
        </div>

        {/* PEDAL 2 (Direito): IN STOP: TAP PARTE A / B | IN PLAY: TAP TRANSIÇÃO A->B / B->A */}
        <div className="flex flex-col items-center">
          <div className="text-xs font-bold text-slate-300 uppercase mb-1 tracking-wider">
            PEDAL 2 (Direito)
          </div>
          <button
            type="button"
            onMouseDown={handlePedal2PressStart}
            onMouseUp={handlePedal2PressEnd}
            onMouseLeave={() => {
              if (isPedal2Pressed) handlePedal2PressEnd();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              handlePedal2PressStart();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handlePedal2PressEnd();
            }}
            className={`w-full min-h-[180px] rounded-2xl border-4 transition-all duration-100 flex flex-col items-center justify-center p-4 cursor-pointer select-none active:scale-[0.98] ${
              activeP2Pressed
                ? 'scale-[0.97] bg-slate-800 border-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.4)]'
                : isPlaying
                ? isTransition
                  ? 'bg-purple-950/50 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                  : 'bg-slate-900 border-purple-500/70 hover:border-purple-400 shadow-[0_4px_20px_rgba(168,85,247,0.15)]'
                : 'bg-slate-900 border-blue-500/70 hover:border-blue-400 shadow-[0_4px_20px_rgba(59,130,246,0.15)]'
            }`}
          >
            <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center shadow-inner mb-2.5">
              <ArrowRightLeft className="w-7 h-7 text-purple-400" />
            </div>

            <span className="text-base font-extrabold text-white tracking-wide uppercase text-center leading-tight">
              {!isPlaying
                ? `TAP: MUDAR P/ ${isPartB ? 'PARTE A' : 'PARTE B'}`
                : isTransition
                ? (activeTransitionId === 'transition_b_a' ? 'TRANSIÇÃO B ➔ A' : 'TRANSIÇÃO A ➔ B')
                : isPartB
                ? 'TAP: TRANSIÇÃO B ➔ A'
                : 'TAP: TRANSIÇÃO A ➔ B'}
            </span>

            <span className="text-xs text-purple-300 font-semibold mt-1 text-center">
              {!isPlaying
                ? `Selecionada: ${isPartB ? 'Parte B' : 'Parte A'}`
                : isPartB
                ? 'Transita da Parte B para a Parte A'
                : 'Transita da Parte A para a Parte B'}
            </span>

            <span className="text-[10px] text-slate-400 mt-1 font-mono">
              [Switch 2 • PgUp / Seta Dir / Enter]
            </span>
          </button>
        </div>
      </div>

      {/* SAMPLE FIDELITY & AUDIO BADGE */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3 text-xs flex-wrap bg-slate-950/40 p-2.5 rounded-xl">
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-semibold text-slate-200">Sons Fiéis:</span>
          <span className="text-slate-400 text-[11px]">
            Pandeiro, Ganzá, Surdo, Tamborim e Bumbo (100% autênticos)
          </span>
        </div>
        <button
          type="button"
          onClick={handleTestAudioSample}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg cursor-pointer transition-colors"
        >
          <Volume2 className="w-3.5 h-3.5" />
          Testar Som do Pandeiro
        </button>
      </div>

      {/* Quick cheat-sheet */}
      <div className="mt-3 pt-2 text-xs text-slate-400 grid grid-cols-1 sm:grid-cols-2 gap-2 text-center">
        <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80 text-left">
          <strong className="text-emerald-300 block mb-1 text-xs">PEDAL 1 (Esquerdo):</strong>
          <div className="space-y-0.5 text-[11px]">
            <div><span className="text-white font-semibold">Parado:</span> 1 Toque toca a <strong className="text-emerald-400">Intro</strong></div>
            <div><span className="text-white font-semibold">Tocando:</span> 1 Toque toca <strong className="text-amber-400">Fill A</strong> (na Parte A) ou <strong className="text-amber-400">Fill B</strong> (na Parte B)</div>
            <div><span className="text-white font-semibold">Tocando:</span> Segurar aciona a <strong className="text-rose-400">Finalização (End)</strong></div>
          </div>
        </div>

        <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80 text-left">
          <strong className="text-purple-300 block mb-1 text-xs">PEDAL 2 (Direito):</strong>
          <div className="space-y-0.5 text-[11px]">
            <div><span className="text-white font-semibold">Parado:</span> 1 Toque alterna entre <strong className="text-cyan-400">Parte A</strong> e <strong className="text-blue-400">Parte B</strong></div>
            <div><span className="text-white font-semibold">Tocando Parte A:</span> 1 Toque toca a <strong className="text-purple-400">Transição A ➔ B</strong></div>
            <div><span className="text-white font-semibold">Tocando Parte B:</span> 1 Toque toca a <strong className="text-purple-400">Transição B ➔ A</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
};
