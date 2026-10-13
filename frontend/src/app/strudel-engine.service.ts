import { Injectable, signal } from '@angular/core';
import {
  evaluate as evaluateStrudel,
  getAudioContext,
  getSuperdoughAudioController,
  hush as hushStrudel,
  initStrudel,
  samples
} from '@strudel/web';

@Injectable({ providedIn: 'root' })
export class StrudelEngineService {
  readonly state = signal<'idle' | 'loading' | 'ready' | 'playing' | 'error'>('idle');
  readonly message = signal('音訊引擎待命');
  readonly masterVolume = signal(0.8);
  private bootPromise?: Promise<void>;
  private masterGainNode?: GainNode;
  private strudelOutputGain?: GainNode;

  async boot(): Promise<void> {
    if (this.state() === 'ready' || this.state() === 'playing') return;
    if (this.bootPromise) return this.bootPromise;

    this.state.set('loading');
    this.message.set('正在載入 Strudel…');

    const audioContext = getAudioContext();
    const masterGainNode = audioContext.createGain();
    masterGainNode.gain.value = this.masterVolume();
    masterGainNode.connect(audioContext.destination);
    this.masterGainNode = masterGainNode;
    // Strudel patterns use Superdough's output bus, separate from initStrudel's outputNode.
    const strudelOutputGain = getSuperdoughAudioController().output.destinationGain;
    strudelOutputGain.gain.value = this.masterVolume();
    this.strudelOutputGain = strudelOutputGain;

    this.bootPromise = initStrudel({
      outputNode: masterGainNode,
      prebake: async () => {
        try {
          await samples('github:tidalcycles/dirt-samples');
        } catch (error) {
          console.warn('Dirt sample pack could not be loaded; synth voices remain available.', error);
        }
      }
    }).then(() => {
      this.state.set('ready');
      this.message.set('Strudel 已就緒');
    }).catch((error: unknown) => {
      this.state.set('error');
      this.message.set(error instanceof Error ? error.message : 'Strudel 初始化失敗');
      masterGainNode.disconnect();
      if (this.masterGainNode === masterGainNode) this.masterGainNode = undefined;
      if (this.strudelOutputGain === strudelOutputGain) this.strudelOutputGain = undefined;
      this.bootPromise = undefined;
      throw error;
    });
    return this.bootPromise;
  }

  async play(code: string): Promise<void> {
    await this.boot();
    try {
      const audioContext = getAudioContext();
      if (audioContext.state === 'suspended') await audioContext.resume();
      await evaluateStrudel(code);
      this.state.set('playing');
      this.message.set('正在播放');
    } catch (error) {
      this.state.set('error');
      this.message.set(error instanceof Error ? error.message : '樂譜執行失敗');
      throw error;
    }
  }

  stop(): void {
    if (this.bootPromise) hushStrudel();
    this.state.set(this.bootPromise ? 'ready' : 'idle');
    this.message.set('已停止');
  }

  setMasterVolume(volume: number): void {
    const clampedVolume = Math.min(1, Math.max(0, volume));
    this.masterVolume.set(clampedVolume);
    for (const gainNode of [this.masterGainNode, this.strudelOutputGain]) {
      if (!gainNode || gainNode.context.state === 'closed') continue;
      const now = gainNode.context.currentTime;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setTargetAtTime(clampedVolume, now, 0.015);
    }
  }
}
