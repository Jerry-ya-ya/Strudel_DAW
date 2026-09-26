import { Injectable, signal } from '@angular/core';
import {
  evaluate as evaluateStrudel,
  getAudioContext,
  hush as hushStrudel,
  initStrudel,
  samples
} from '@strudel/web';

@Injectable({ providedIn: 'root' })
export class StrudelEngineService {
  readonly state = signal<'idle' | 'loading' | 'ready' | 'playing' | 'error'>('idle');
  readonly message = signal('音訊引擎待命');
  private bootPromise?: Promise<void>;

  async boot(): Promise<void> {
    if (this.state() === 'ready' || this.state() === 'playing') return;
    if (this.bootPromise) return this.bootPromise;

    this.state.set('loading');
    this.message.set('正在載入 Strudel…');
    this.bootPromise = initStrudel({
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
}
