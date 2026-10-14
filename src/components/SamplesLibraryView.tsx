/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Upload,
  Mic,
  Play,
  Trash2,
  FileAudio,
  Plus,
  Pencil,
  Check,
  X,
  Database,
} from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';

interface SamplesLibraryViewProps {
  onAddTrackWithSample: (sampleId: string, sampleName: string) => void;
  onDeleteSample?: (sampleId: string) => void;
  onRenameSample?: (sampleId: string, newName: string) => void;
  customSamplesList?: Array<{ id: string; name: string }>;
}

export const SamplesLibraryView: React.FC<SamplesLibraryViewProps> = ({
  onAddTrackWithSample,
  onDeleteSample,
  onRenameSample,
  customSamplesList,
}) => {
  const [samplesList, setSamplesList] = useState<Array<{ id: string; name: string }>>(() =>
    customSamplesList || audioEngine.getCustomSamplesList()
  );

  React.useEffect(() => {
    if (customSamplesList) {
      setSamplesList(customSamplesList);
    } else {
      setSamplesList(audioEngine.getCustomSamplesList());
    }
  }, [customSamplesList]);

  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
  const [editNameText, setEditNameText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const refreshList = () => {
    setSamplesList(audioEngine.getCustomSamplesList());
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setStatusMessage(`Processando sample "${file.name}"...`);
        const id = await audioEngine.loadSampleFromBlob(file, file.name);
        audioEngine.triggerInstrument('custom', { volume: 0.9 }, id);
      }
      refreshList();
      setStatusMessage('Samples carregados com sucesso!');
    } catch {
      setStatusMessage('Erro ao decodificar arquivo de áudio.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const name = `Gravação_Voz_${new Date().toLocaleTimeString('pt-BR')}`;
        const id = await audioEngine.loadSampleFromBlob(blob, name);
        refreshList();
        setStatusMessage(`Sample "${name}" gravado com sucesso!`);
        audioEngine.triggerInstrument('custom', { volume: 0.9 }, id);
        stream.getTracks().forEach((t) => t.stop());
      };

      setIsRecording(true);
      mediaRecorder.start();
      let left = 3;
      setCountdown(left);
      const interval = setInterval(() => {
        left--;
        if (left <= 0) {
          clearInterval(interval);
          mediaRecorder.stop();
          setIsRecording(false);
          setCountdown(null);
        } else {
          setCountdown(left);
        }
      }, 1000);
    } catch {
      setStatusMessage('Microfone não acessível ou permissão recusada.');
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const executeDeleteSample = (sampleId: string, sampleName: string) => {
    audioEngine.deleteCustomSample(sampleId);
    onDeleteSample?.(sampleId);
    refreshList();
    setConfirmDeleteId(null);
    setStatusMessage(`Sample "${sampleName}" excluído com sucesso.`);
  };

  const playSample = (sampleId: string) => {
    audioEngine.triggerInstrument('custom', { volume: 0.9 }, sampleId);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-wide">
          Gerenciador de Samples & Gravação de Áudio
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Importe seus próprios sons de percussão (.wav, .mp3, .ogg, .flac) ou grave diretamente pelo microfone para usar no BeatBuddy Studio.
        </p>
      </div>

      {/* Cloud & Folder Storage Info Banner */}
      <div className="flex items-center gap-3 p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
        <Database className="w-4 h-4 text-emerald-400 shrink-0" />
        <div>
          <span className="font-semibold text-white">Armazenamento Persistente Multi-Dispositivo Ativo: </span>
          <span>
            Todos os samples de áudio adicionados pelo computador são salvos na pasta de áudio local (<code className="text-emerald-300 bg-emerald-950 px-1 py-0.5 rounded">public/samples</code>), no IndexedDB do navegador e sincronizados no banco de dados Firebase Firestore. Eles não somem ao abrir no celular!
          </span>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-amber-400 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload & Record Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upload Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center ${
            isDragOver
              ? 'border-amber-400 bg-amber-500/10'
              : 'border-slate-800 bg-[#0f172a] hover:border-slate-700'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mb-3">
            <Upload className="w-5 h-5 text-amber-400" />
          </div>
          <h4 className="text-sm font-bold text-white">Carregar Arquivos de Áudio</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Arraste arquivos ou clique para selecionar do seu dispositivo
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-sm"
          >
            Selecionar Arquivos (.wav, .mp3, .ogg)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={(e) => {
              if (e.target.files) handleFileUpload(e.target.files);
            }}
            className="hidden"
          />
        </div>

        {/* Record with Microphone */}
        <div className="border border-slate-800 bg-[#0f172a] rounded-2xl p-6 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mb-3">
            <Mic className="w-5 h-5 text-rose-400" />
          </div>
          <h4 className="text-sm font-bold text-white">Gravar com Microfone</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Grave palmas, estalos de dedo, beatbox ou percussão acústica ao vivo
          </p>
          <button
            type="button"
            onClick={handleRecord}
            disabled={isRecording}
            className={`mt-4 px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              isRecording
                ? 'bg-rose-500 text-slate-950 border-rose-400 animate-pulse'
                : 'bg-rose-950/60 hover:bg-rose-900 text-rose-300 border-rose-800'
            }`}
          >
            {isRecording
              ? `Gravando... ${countdown}s`
              : 'Iniciar Gravação (3 segundos)'}
          </button>
        </div>
      </div>

      {/* Sample Library Table */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileAudio className="w-4 h-4 text-amber-400" />
            <span>Biblioteca de Samples Carregados ({samplesList.length})</span>
          </h3>
        </div>

        {samplesList.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Nenhum sample carregado ainda. Use os botões acima para enviar um arquivo de áudio ou gravar com o microfone!
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {samplesList.map((sample) => (
              <div
                key={sample.id}
                className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-900/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    title="Tocar sample"
                    onClick={() => playSample(sample.id)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-amber-400 text-amber-400 hover:text-slate-950 border border-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                  <div className="min-w-0">
                    {editingSampleId === sample.id ? (
                      <div className="flex items-center gap-1.5 py-0.5">
                        <input
                          type="text"
                          value={editNameText}
                          onChange={(e) => setEditNameText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && editNameText.trim()) {
                              audioEngine.renameCustomSample(sample.id, editNameText.trim());
                              onRenameSample?.(sample.id, editNameText.trim());
                              refreshList();
                              setEditingSampleId(null);
                              setStatusMessage(`Sample renomeado para "${editNameText.trim()}".`);
                            } else if (e.key === 'Escape') {
                              setEditingSampleId(null);
                            }
                          }}
                          className="bg-slate-900 border border-amber-400 text-xs px-2 py-1 rounded text-white font-medium focus:outline-none w-44"
                          autoFocus
                        />
                        <button
                          type="button"
                          title="Salvar novo nome"
                          onClick={() => {
                            if (editNameText.trim()) {
                              audioEngine.renameCustomSample(sample.id, editNameText.trim());
                              onRenameSample?.(sample.id, editNameText.trim());
                              refreshList();
                              setEditingSampleId(null);
                              setStatusMessage(`Sample renomeado para "${editNameText.trim()}".`);
                            }
                          }}
                          className="p-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Cancelar"
                          onClick={() => setEditingSampleId(null)}
                          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white block truncate max-w-[200px]">
                          {sample.name}
                        </span>
                        <button
                          type="button"
                          title="Renomear este sample"
                          onClick={() => {
                            setEditingSampleId(sample.id);
                            setEditNameText(sample.name);
                          }}
                          className="p-1 text-slate-500 hover:text-amber-400 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono block">
                      ID: {sample.id}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onAddTrackWithSample(sample.id, sample.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Usar em Nova Pista</span>
                  </button>

                  {confirmDeleteId === sample.id ? (
                    <div className="flex items-center gap-1.5 bg-rose-950/90 border border-rose-500/60 rounded-lg px-2 py-1 animate-in fade-in">
                      <span className="text-[11px] text-rose-300 font-bold">Excluir?</span>
                      <button
                        type="button"
                        onClick={() => executeDeleteSample(sample.id, sample.name)}
                        className="px-2 py-0.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded cursor-pointer shadow-xs transition-colors"
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-0.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded cursor-pointer transition-colors"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      title="Excluir este sample da biblioteca"
                      onClick={() => setConfirmDeleteId(sample.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-600 border border-rose-900 hover:border-rose-500 rounded-lg transition-all cursor-pointer shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
