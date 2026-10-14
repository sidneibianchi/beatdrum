/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sliders,
  Trash2,
  Plus,
  Play,
  Sparkles,
} from 'lucide-react';
import { SongPartId, StepData, TrackDefinition, RhythmicResolution } from '../types/rhythm';

interface SequencerGridProps {
  tracks: TrackDefinition[];
  partSteps: Record<string, StepData[]>;
  partStepCounts?: Record<string, number>;
  activePartId: SongPartId;
  playingTick: number;
  activeTrackSteps: Record<string, number>;
  isPlaying: boolean;
  resolution?: RhythmicResolution;
  barsCount?: number;
  timeSignature?: string;
  onResolutionChange?: (res: RhythmicResolution) => void;
  onBarsCountChange?: (bars: number) => void;
  onToggleStep: (trackId: string, stepIndex: number) => void;
  onUpdateStep: (trackId: string, stepIndex: number, stepData: Partial<StepData>) => void;
  onUpdateTrackLength: (trackId: string, newLength: number) => void;
  onUpdateTrackVolume: (trackId: string, vol: number) => void;
  onUpdateTrackPan: (trackId: string, pan: number) => void;
  onToggleTrackMute: (trackId: string) => void;
  onToggleTrackSolo: (trackId: string) => void;
  onTriggerTrack: (trackDef: TrackDefinition) => void;
  onOpenTrackSettings: (trackDef: TrackDefinition) => void;
  onDeleteTrack: (trackId: string) => void;
  onRemoveTrackSample?: (trackId: string) => void;
  onAddTrackClick: () => void;
}

export const SequencerGrid: React.FC<SequencerGridProps> = ({
  tracks,
  partSteps,
  partStepCounts: _partStepCounts,
  activePartId: _activePartId,
  playingTick: _playingTick,
  activeTrackSteps,
  isPlaying,
  resolution: _resolution = '1/32',
  barsCount = 1,
  timeSignature = '4/4',
  onResolutionChange: _onResolutionChange,
  onBarsCountChange: _onBarsCountChange,
  onToggleStep,
  onUpdateStep,
  onUpdateTrackLength: _onUpdateTrackLength,
  onUpdateTrackVolume: _onUpdateTrackVolume,
  onUpdateTrackPan: _onUpdateTrackPan,
  onToggleTrackMute,
  onToggleTrackSolo,
  onTriggerTrack,
  onOpenTrackSettings,
  onDeleteTrack,
  onRemoveTrackSample,
  onAddTrackClick,
}) => {
  // Currently inspected step for micro-editing (trackId + stepIndex)
  const [inspectedStep, setInspectedStep] = useState<{
    trackId: string;
    stepIndex: number;
  } | null>(null);

  // Fusa por padrão (8 subdivisões por tempo / 1/32)
  const subPerBeat = 8;
  const beatsPerBar =
    timeSignature === '2/4'
      ? 2
      : timeSignature === '3/4'
      ? 3
      : timeSignature === '5/4'
      ? 5
      : timeSignature === '7/8'
      ? 7
      : timeSignature === '6/8'
      ? 6
      : timeSignature === '12/8'
      ? 12
      : 4;

  const stepsPerBar =
    timeSignature === '2/4'
      ? 2 * subPerBeat // 16 notas por compasso em 2/4
      : timeSignature === '3/4'
      ? 3 * subPerBeat
      : timeSignature === '6/8'
      ? Math.max(6, Math.round(6 * (subPerBeat / 2)))
      : timeSignature === '7/8'
      ? Math.max(7, Math.round(7 * (subPerBeat / 2)))
      : timeSignature === '12/8'
      ? Math.max(12, Math.round(12 * (subPerBeat / 4)))
      : beatsPerBar * subPerBeat;

  const totalBars = barsCount || 1;
  const totalDisplaySteps = Math.min(64, stepsPerBar * totalBars);

  return (
    <div className="flex-1 overflow-x-auto p-4 sm:p-6 bg-[#090d16]">
      <div className="min-w-[960px] space-y-3">
        {/* Step Numbers & Bars Header */}
        <div className="space-y-1 pb-1 border-b border-slate-800/80">
          {/* Compassos (Bars) Banner Row */}
          <div className="flex items-center gap-2">
            <div className="w-[260px] shrink-0 text-xs font-semibold text-slate-400 pl-2">
              Divisão de Compassos
            </div>
            <div
              className="flex-1 gap-1"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${totalDisplaySteps}, minmax(22px, 1fr))`,
              }}
            >
              {Array.from({ length: totalBars }, (_, bIdx) => {
                const barStart = bIdx * stepsPerBar;
                const barSpan = Math.min(stepsPerBar, totalDisplaySteps - barStart);
                if (barSpan <= 0) return null;
                return (
                  <div
                    key={bIdx}
                    style={{ gridColumn: `span ${barSpan}` }}
                    className={`py-1 text-center font-bold text-[11px] rounded-md border flex items-center justify-center gap-1.5 transition-colors ${
                      bIdx % 2 === 0
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                        : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                    }`}
                  >
                    <span>Compasso #{bIdx + 1}</span>
                    <span className="text-[10px] opacity-75 font-mono">
                      (Notas {barStart + 1} a {barStart + barSpan})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Individual Step Numbers & Beats */}
          <div className="flex items-center gap-2">
            <div className="w-[260px] shrink-0 text-[11px] text-slate-500 pl-2 font-mono">
              Tempo / Subdivisão
            </div>
            <div
              className="flex-1 gap-1 font-mono text-[10px] text-slate-400 text-center"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${totalDisplaySteps}, minmax(22px, 1fr))`,
              }}
            >
              {Array.from({ length: totalDisplaySteps }, (_, i) => {
                const isDownbeat = i % subPerBeat === 0;
                const barNum = Math.floor(i / stepsPerBar) + 1;
                const beatNum = Math.floor((i % stepsPerBar) / subPerBeat) + 1;
                const subInBeat = (i % subPerBeat) + 1;

                return (
                  <div
                    key={i}
                    title={`Compasso ${barNum}, Tempo ${beatNum}.${subInBeat} (Nota #${i + 1})`}
                    className={`py-0.5 rounded truncate px-0.5 ${
                      isDownbeat
                        ? 'bg-slate-800/90 text-amber-300 font-bold border border-slate-700/80 shadow-xs'
                        : 'bg-slate-950/40 text-slate-500'
                    }`}
                  >
                    <span>
                      {`${beatNum}.${subInBeat}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tracks List */}
        {tracks.map((track) => {
          const steps = partSteps[track.id] || [];
          const activeStepIdx = activeTrackSteps[track.id];

          return (
            <div
              key={track.id}
              className="group flex items-center gap-2 p-2 rounded-xl bg-[#0f172a]/90 hover:bg-[#131d35] border border-slate-800 transition-colors"
            >
              {/* Track Controls (Left Panel) */}
              <div className="w-[260px] shrink-0 flex items-center justify-between gap-2 bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Color accent pill & audition button */}
                  <button
                    type="button"
                    title="Ouvir som deste instrumento"
                    onClick={() => onTriggerTrack(track)}
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border border-slate-700 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                    style={{ backgroundColor: `${track.color}25`, borderColor: track.color }}
                  >
                    <Play className="w-3.5 h-3.5" style={{ color: track.color }} />
                  </button>

                  {/* Instrument Name */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate max-w-[100px]">
                        {track.name}
                      </span>
                      {track.customSampleName && (
                        <div className="flex items-center gap-0.5 bg-amber-500/20 text-amber-300 rounded px-1 py-0.2">
                          <span className="text-[9px] font-mono">Sample</span>
                          <button
                            type="button"
                            title="Remover sample customizado desta pista"
                            onClick={() => onRemoveTrackSample?.(track.id)}
                            className="text-rose-400 hover:text-white ml-0.5 cursor-pointer"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block truncate">
                      {track.soundType}
                    </span>
                  </div>
                </div>

                {/* Right controls inside track panel: Mute, Solo, Sound Settings & Delete */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Mute button */}
                  <button
                    type="button"
                    title={track.muted ? 'Desmutar' : 'Mutar'}
                    onClick={() => onToggleTrackMute(track.id)}
                    className={`w-6 h-6 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      track.muted
                        ? 'bg-rose-500 text-slate-950 font-extrabold'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    M
                  </button>

                  {/* Solo button */}
                  <button
                    type="button"
                    title={track.solo ? 'Desativar Solo' : 'Solo'}
                    onClick={() => onToggleTrackSolo(track.id)}
                    className={`w-6 h-6 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      track.solo
                        ? 'bg-amber-400 text-slate-950 font-extrabold'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    S
                  </button>

                  {/* Sound & Sample Editor Settings */}
                  <button
                    type="button"
                    title="Ajustar som ou trocar sample"
                    onClick={() => onOpenTrackSettings(track)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete track */}
                  {tracks.length > 1 && (
                    <button
                      type="button"
                      title="Excluir pista"
                      onClick={() => onDeleteTrack(track.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Step Pads Matrix */}
              <div
                className="flex-1 gap-1"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${totalDisplaySteps}, minmax(22px, 1fr))`,
                }}
              >
                {Array.from({ length: totalDisplaySteps }, (_, stepIdx) => {
                  const step = steps[stepIdx];
                  const isActive = step?.active ?? false;
                  const isPlayhead = isPlaying && activeStepIdx === stepIdx;
                  const isBeatDown = stepIdx % subPerBeat === 0;

                  // Dynamic velocity visuals
                  const velocity = step?.velocity ?? 90;
                  const isAccent = isActive && velocity >= 115;
                  const isGhost = isActive && velocity <= 65;
                  const ratchet = step?.ratchet ?? 1;

                  return (
                    <button
                      key={stepIdx}
                      type="button"
                      onClick={() => onToggleStep(track.id, stepIdx)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setInspectedStep({ trackId: track.id, stepIndex: stepIdx });
                      }}
                      className={`relative h-10 rounded-lg border transition-all duration-75 flex flex-col items-center justify-center cursor-pointer select-none ${
                        isActive
                          ? isAccent
                            ? 'shadow-[0_0_12px_rgba(245,158,11,0.5)] border-white text-slate-950 font-bold'
                            : isGhost
                            ? 'bg-slate-800 border-slate-600 text-slate-300'
                            : 'border-slate-300/80 text-slate-950 font-semibold'
                          : isBeatDown
                          ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                          : 'bg-slate-950/60 border-slate-900 hover:border-slate-800'
                      } ${
                        isPlayhead ? 'ring-2 ring-white scale-[1.05] z-10' : ''
                      }`}
                      style={{
                        backgroundColor: isActive
                          ? isGhost
                            ? `${track.color}40`
                            : track.color
                          : undefined,
                      }}
                    >
                      {/* Step Indicator */}
                      {isActive && (
                        <div className="flex flex-col items-center justify-center pointer-events-none">
                          {isAccent && (
                            <span className="text-[9px] font-black leading-none text-slate-950">
                              ▲
                            </span>
                          )}
                          {isGhost && (
                            <span className="text-[9px] font-mono leading-none text-slate-400">
                              g
                            </span>
                          )}
                          {ratchet > 1 && (
                            <span className="text-[8px] font-bold px-1 rounded bg-black/40 text-white leading-none mt-0.5">
                              {ratchet}x
                            </span>
                          )}
                        </div>
                      )}

                      {/* Ghost dot if inactive */}
                      {!isActive && (
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            isBeatDown ? 'bg-slate-700' : 'bg-slate-800'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Add Track & Percussion Button */}
        <div className="pt-3">
          <button
            type="button"
            onClick={onAddTrackClick}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-700 hover:border-amber-400 bg-slate-950/40 hover:bg-slate-900/60 text-slate-300 hover:text-amber-400 transition-all text-xs font-semibold cursor-pointer w-full justify-center"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Novo Instrumento ou Enviar Sample Próprio</span>
          </button>
        </div>
      </div>

      {/* Micro Step Editor Modal */}
      {inspectedStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Micro-Edição do Passo #{inspectedStep.stepIndex + 1}</span>
              </h4>
              <button
                type="button"
                onClick={() => setInspectedStep(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {(() => {
              const currentStep =
                partSteps[inspectedStep.trackId]?.[inspectedStep.stepIndex] || {
                  active: true,
                  velocity: 90,
                  probability: 1.0,
                  ratchet: 1,
                };

              return (
                <div className="space-y-4 text-xs">
                  {/* Active Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-medium">Ativar Passo:</span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateStep(inspectedStep.trackId, inspectedStep.stepIndex, {
                          active: !currentStep.active,
                        })
                      }
                      className={`px-3 py-1 rounded font-bold transition-colors cursor-pointer ${
                        currentStep.active
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {currentStep.active ? 'ATIVADO' : 'DESATIVADO'}
                    </button>
                  </div>

                  {/* Velocity Slider */}
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Velocidade / Dinâmica (1-127):</span>
                      <span className="font-mono text-amber-400 font-bold">
                        {currentStep.velocity}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={127}
                      value={currentStep.velocity}
                      onChange={(e) =>
                        onUpdateStep(inspectedStep.trackId, inspectedStep.stepIndex, {
                          velocity: Number(e.target.value),
                          active: true,
                        })
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                      <span>Ghost (50)</span>
                      <span>Normal (90)</span>
                      <span>Acento (125)</span>
                    </div>
                  </div>

                  {/* Ratchet / Flam / Roll */}
                  <div>
                    <span className="text-slate-300 block mb-1.5">
                      Subdivisão / Rulo (Ratchet / Flam):
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() =>
                            onUpdateStep(inspectedStep.trackId, inspectedStep.stepIndex, {
                              ratchet: r,
                              active: true,
                            })
                          }
                          className={`py-1.5 rounded font-mono font-bold text-center border cursor-pointer ${
                            (currentStep.ratchet || 1) === r
                              ? 'bg-amber-400 text-slate-950 border-amber-300'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {r}x {r === 1 ? 'único' : r === 2 ? 'duplo' : r === 3 ? 'trio' : 'rulo'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Probability */}
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Probabilidade de Execução:</span>
                      <span className="font-mono text-cyan-400 font-bold">
                        {Math.round((currentStep.probability ?? 1) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      value={currentStep.probability ?? 1}
                      onChange={(e) =>
                        onUpdateStep(inspectedStep.trackId, inspectedStep.stepIndex, {
                          probability: Number(e.target.value),
                        })
                      }
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setInspectedStep(null)}
                      className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg cursor-pointer"
                    >
                      Concluir
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
