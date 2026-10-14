/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Footswitch, Cuvave Cube Turner Pro & Web MIDI Manager.
 * Supports Bluetooth page turners, M-Vave pedals, wireless footswitches, USB controllers,
 * with multi-code detection (code, key, keyCode) and dynamic Key-Learning mode.
 */

export interface FootswitchConfig {
  preset: 'universal' | 'cuvave_pgup_pgdn' | 'cuvave_arrows' | 'cuvave_space' | 'custom';
  mainKeys: string[]; // Codes or Keys that trigger the main pedal
  mainKeyCodes: number[]; // KeyCodes (e.g. 34 for PageDown, 32 for Space)
  accentKeys: string[]; // Codes or Keys that trigger the crash / accent
  accentKeyCodes: number[]; // KeyCodes (e.g. 33 for PageUp)
  midiEnabled: boolean;
  midiMainNotes: number[]; // MIDI note numbers or CC (e.g. 60 or CC 64)
  midiAccentNotes: number[];
}

const STORAGE_KEY = 'beatbuddy_footswitch_config_v2';

export const DEFAULT_FOOTSWITCH_CONFIG: FootswitchConfig = {
  preset: 'universal',
  // Covers all Cuvave / M-Vave Cube Turner Pro modes: PageDown, ArrowLeft, ArrowDown, Space, Enter, 'B', 'A', '1', MediaTrackPrevious, VolumeDown
  mainKeys: [
    'Space',
    ' ',
    'Spacebar',
    'PageDown',
    'pagedown',
    'ArrowLeft',
    'arrowleft',
    'ArrowDown',
    'arrowdown',
    'Left',
    'Down',
    'Enter',
    'Return',
    'KeyB',
    'b',
    'B',
    'KeyA',
    'a',
    'A',
    'Digit1',
    '1',
    'Numpad1',
    'MediaTrackPrevious',
    'MediaPlayPause',
    'AudioVolumeDown',
    'VolumeDown',
  ],
  mainKeyCodes: [32, 34, 37, 40, 13, 66, 65, 49, 97, 177, 179, 174, 25],
  // Covers Cuvave modes: PageUp, ArrowRight, ArrowUp, Shift, 'C', 'D', '2', MediaTrackNext, VolumeUp
  accentKeys: [
    'ShiftLeft',
    'ShiftRight',
    'Shift',
    'PageUp',
    'pageup',
    'ArrowRight',
    'arrowright',
    'ArrowUp',
    'arrowup',
    'Right',
    'Up',
    'KeyC',
    'c',
    'C',
    'KeyD',
    'd',
    'D',
    'Digit2',
    '2',
    'Numpad2',
    'MediaTrackNext',
    'AudioVolumeUp',
    'VolumeUp',
  ],
  accentKeyCodes: [16, 33, 39, 38, 67, 68, 50, 98, 176, 175, 24],
  midiEnabled: true,
  midiMainNotes: [60, 64, 36, 48, 1, 65], // Middle C, CC64 Sustain, Bass C, C3, CC1, CC65
  midiAccentNotes: [62, 65, 38, 50, 2, 66], // D, CC65, D3, CC2, CC66
};

export class FootswitchManager {
  private config: FootswitchConfig;
  private midiAccess: MIDIAccess | null = null;
  private connectedMidiDevices: string[] = [];
  private onPedal1Callback: (() => void) | null = null;
  private onPedal2Callback: (() => void) | null = null;
  private onActivityCallback: ((signal: { type: 'key' | 'midi' | 'ble'; value: string; rawEvent?: unknown }) => void) | null = null;

  // Learning mode ('pedal1' | 'pedal2' | 'main' | 'accent')
  private learningTarget: 'pedal1' | 'pedal2' | 'main' | 'accent' | null = null;

  constructor() {
    this.config = this.loadConfig();
    this.initMidi();
  }

  private loadConfig(): FootswitchConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_FOOTSWITCH_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load footswitch config:', e);
    }
    return { ...DEFAULT_FOOTSWITCH_CONFIG };
  }

  public saveConfig(newConfig: FootswitchConfig) {
    this.config = newConfig;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch (e) {
      console.warn('Failed to save footswitch config:', e);
    }
  }

  public getConfig(): FootswitchConfig {
    return { ...this.config };
  }

  public setCallbacks(callbacks: {
    onPedal1?: () => void;
    onPedal2?: () => void;
    onMainPedal?: () => void;
    onAccent?: () => void;
    onActivity?: (signal: { type: 'key' | 'midi' | 'ble'; value: string; rawEvent?: unknown }) => void;
  }) {
    if (callbacks.onPedal1) this.onPedal1Callback = callbacks.onPedal1;
    else if (callbacks.onMainPedal) this.onPedal1Callback = callbacks.onMainPedal;

    if (callbacks.onPedal2) this.onPedal2Callback = callbacks.onPedal2;
    else if (callbacks.onAccent) this.onPedal2Callback = callbacks.onAccent;

    if (callbacks.onActivity) this.onActivityCallback = callbacks.onActivity;
  }

  // --- Web MIDI API Integration ---
  public async initMidi(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      return false;
    }
    try {
      this.midiAccess = await (navigator as unknown as { requestMIDIAccess: (opts: { sysex: boolean }) => Promise<MIDIAccess> }).requestMIDIAccess({ sysex: false });
      this.updateConnectedDevices();
      this.midiAccess.onstatechange = () => {
        this.updateConnectedDevices();
      };
      for (const input of this.midiAccess.inputs.values()) {
        input.onmidimessage = (msg: MIDIMessageEvent) => this.handleMidiMessage(msg);
      }
      return true;
    } catch (err) {
      console.warn('Web MIDI Access not granted or unsupported:', err);
      return false;
    }
  }

  public async requestMidiPermission(): Promise<boolean> {
    return this.initMidi();
  }

  private updateConnectedDevices() {
    if (!this.midiAccess) return;
    const names: string[] = [];
    for (const input of this.midiAccess.inputs.values()) {
      if (input.name) names.push(input.name);
    }
    this.connectedMidiDevices = names;
  }

  public getConnectedMidiDevices(): string[] {
    return [...this.connectedMidiDevices];
  }

  private handleMidiMessage(event: MIDIMessageEvent) {
    if (!this.config.midiEnabled || !event.data) return;
    const [status, data1, data2] = event.data;
    const command = status >> 4;

    // Handle learning mode
    if (this.learningTarget) {
      const isNote = command === 9 && data2 > 0;
      const isCC = command === 11 && data2 >= 64;
      if (isNote || isCC) {
        const val = data1;
        if (this.learningTarget === 'main') {
          const updated = {
            ...this.config,
            preset: 'custom' as const,
            midiMainNotes: [...new Set([...this.config.midiMainNotes, val])],
          };
          this.saveConfig(updated);
        } else if (this.learningTarget === 'accent') {
          const updated = {
            ...this.config,
            preset: 'custom' as const,
            midiAccentNotes: [...new Set([...this.config.midiAccentNotes, val])],
          };
          this.saveConfig(updated);
        }
        this.learningTarget = null;
        this.onActivityCallback?.({ type: 'midi', value: `MIDI #${val} (MAPEADO!)` });
        return;
      }
    }

    // Note On (command 9) with velocity > 0 or Control Change (command 11)
    if (command === 9 && data2 > 0) {
      const note = data1;
      this.onActivityCallback?.({ type: 'midi', value: `Nota MIDI #${note}` });
      if (this.config.midiMainNotes.includes(note)) {
        this.onPedal1Callback?.();
      } else if (this.config.midiAccentNotes.includes(note)) {
        this.onPedal2Callback?.();
      }
    } else if (command === 11) {
      const cc = data1;
      const val = data2;
      this.onActivityCallback?.({ type: 'midi', value: `CC #${cc} (Val: ${val})` });
      if (val >= 64) {
        if (this.config.midiMainNotes.includes(cc)) {
          this.onPedal1Callback?.();
        } else if (this.config.midiAccentNotes.includes(cc)) {
          this.onPedal2Callback?.();
        }
      }
    }
  }

  // --- Key Evaluation Helpers ---
  public isPedal1Event(e: KeyboardEvent): boolean {
    const code = (e.code || '').toLowerCase();
    const key = (e.key || '').toLowerCase();
    const keyCode = e.keyCode || e.which || 0;

    const mainLower = this.config.mainKeys.map((k) => k.toLowerCase());
    if (code && mainLower.includes(code)) return true;
    if (key && mainLower.includes(key)) return true;
    if (keyCode && this.config.mainKeyCodes.includes(keyCode)) return true;
    return false;
  }

  // Alias for backward compatibility
  public isMainPedalEvent(e: KeyboardEvent): boolean {
    return this.isPedal1Event(e);
  }

  public isPedal2Event(e: KeyboardEvent): boolean {
    const code = (e.code || '').toLowerCase();
    const key = (e.key || '').toLowerCase();
    const keyCode = e.keyCode || e.which || 0;

    const accentLower = this.config.accentKeys.map((k) => k.toLowerCase());
    if (code && accentLower.includes(code)) return true;
    if (key && accentLower.includes(key)) return true;
    if (keyCode && this.config.accentKeyCodes.includes(keyCode)) return true;
    return false;
  }

  // Alias for backward compatibility
  public isAccentEvent(e: KeyboardEvent): boolean {
    return this.isPedal2Event(e);
  }

  public async connectBluetoothMidi(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      return false;
    }
    try {
      const navBt = (navigator as unknown as { bluetooth: { requestDevice: (opts: unknown) => Promise<unknown> } }).bluetooth;
      const device = await navBt.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access', 'battery_service', '03b80e5a-ede8-4b33-a751-6ce34ec4c700'],
      });
      if (device) {
        this.notifyActivity({ type: 'ble', value: 'Pedal Bluetooth M-VAVE emparelhado!' });
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Bluetooth pairing cancelled or error:', err);
      return false;
    }
  }

  // --- Learning Mode ---
  public startLearning(target: 'pedal1' | 'pedal2' | 'main' | 'accent') {
    this.learningTarget = target;
  }

  public cancelLearning() {
    this.learningTarget = null;
  }

  public getLearningTarget(): 'pedal1' | 'pedal2' | 'main' | 'accent' | null {
    return this.learningTarget;
  }

  public handleKeyEventForLearning(e: KeyboardEvent): boolean {
    if (!this.learningTarget) return false;
    const code = e.code || e.key;
    const key = e.key;
    const keyCode = e.keyCode || e.which;

    const newKeys = [code, key].filter(Boolean);

    if (this.learningTarget === 'main' || this.learningTarget === 'pedal1') {
      const updated: FootswitchConfig = {
        ...this.config,
        preset: 'custom',
        mainKeys: [...new Set([...this.config.mainKeys, ...newKeys])],
        mainKeyCodes: keyCode ? [...new Set([...this.config.mainKeyCodes, keyCode])] : this.config.mainKeyCodes,
      };
      this.saveConfig(updated);
    } else {
      const updated: FootswitchConfig = {
        ...this.config,
        preset: 'custom',
        accentKeys: [...new Set([...this.config.accentKeys, ...newKeys])],
        accentKeyCodes: keyCode ? [...new Set([...this.config.accentKeyCodes, keyCode])] : this.config.accentKeyCodes,
      };
      this.saveConfig(updated);
    }

    const learnedLabel = `${code || key} (KeyCode: ${keyCode})`;
    this.onActivityCallback?.({ type: 'key', value: `${learnedLabel} [MAPEADO COM SUCESSO!]` });
    this.learningTarget = null;
    return true;
  }

  public bindKeyToPedal1(keyOrCode: string, keyCode?: number) {
    const updated: FootswitchConfig = {
      ...this.config,
      preset: 'custom',
      mainKeys: [...new Set([...this.config.mainKeys, keyOrCode, keyOrCode.toLowerCase()])],
      mainKeyCodes: keyCode ? [...new Set([...this.config.mainKeyCodes, keyCode])] : this.config.mainKeyCodes,
    };
    this.saveConfig(updated);
    this.notifyActivity({ type: 'key', value: `${keyOrCode} associado ao Pedal 1!` });
  }

  public bindKeyToMain(keyOrCode: string, keyCode?: number) {
    this.bindKeyToPedal1(keyOrCode, keyCode);
  }

  public bindKeyToPedal2(keyOrCode: string, keyCode?: number) {
    const updated: FootswitchConfig = {
      ...this.config,
      preset: 'custom',
      accentKeys: [...new Set([...this.config.accentKeys, keyOrCode, keyOrCode.toLowerCase()])],
      accentKeyCodes: keyCode ? [...new Set([...this.config.accentKeyCodes, keyCode])] : this.config.accentKeyCodes,
    };
    this.saveConfig(updated);
    this.notifyActivity({ type: 'key', value: `${keyOrCode} associado ao Pedal 2!` });
  }

  public bindKeyToAccent(keyOrCode: string, keyCode?: number) {
    this.bindKeyToPedal2(keyOrCode, keyCode);
  }

  public notifyActivity(signal: { type: 'key' | 'midi' | 'ble'; value: string; rawEvent?: unknown }) {
    this.onActivityCallback?.(signal);
  }
}

export const footswitchManager = new FootswitchManager();
