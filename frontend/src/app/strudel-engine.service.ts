import { Injectable, signal } from '@angular/core';
import {
  early as earlyStrudel,
  evaluate as evaluateStrudel,
  getAudioContext,
  getSuperdoughAudioController,
  hush as hushStrudel,
  initStrudel,
  samples,
  type StrudelPattern,
  type StrudelRepl
} from '@strudel/web';

function arrangementCycles(code: string): number {
  const arrangementIndex = code.search(/\barrange\s*\(/i);
  if (arrangementIndex < 0) return 1;

  const arrangementCode = code.slice(arrangementIndex);
  const sectionLengths = [...arrangementCode.matchAll(/\[\s*(\d+(?:\.\d+)?)\s*,/g)]
    .map((match) => Number(match[1]));
  const total = sectionLengths.reduce((sum, length) => sum + length, 0);
  return total > 0 ? total : 1;
}

@Injectable({ providedIn: 'root' })
export class StrudelEngineService {
  readonly state = signal<'idle' | 'loading' | 'ready' | 'playing' | 'error'>('idle');
  readonly message = signal('音訊引擎待命');
  readonly masterVolume = signal(0.8);
  readonly cycleProgress = signal(0);
  readonly currentCycle = signal(0);
  readonly totalCycles = signal(1);
  private bootPromise?: Promise<void>;
  private repl?: StrudelRepl;
  private activeCode = '';
  private masterGainNode?: GainNode;
  private strudelOutputGain?: GainNode;
  private progressInterval?: number;
  private playbackCycleOffset = 0;
  private isScrubbing = false;

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
      sync: false,
      outputNode: masterGainNode,
      prebake: async () => {
        try {
          await samples('github:tidalcycles/dirt-samples');
        } catch (error) {
          console.warn('Dirt sample pack could not be loaded; synth voices remain available.', error);
        }
      }
    }).then((repl) => {
      this.repl = repl;
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
      this.stopProgressUpdates();
      this.isScrubbing = false;
      this.activeCode = code;
      this.totalCycles.set(arrangementCycles(code));
      this.playbackCycleOffset = this.clampCycle(this.playbackCycleOffset);
      if (this.state() === 'playing') hushStrudel();
      const pattern = await evaluateStrudel(code, this.playbackCycleOffset === 0);
      if (!pattern) throw new Error('無法讀取 Strudel 樂譜');
      if (this.playbackCycleOffset > 0) {
        await this.repl?.setPattern(earlyStrudel(this.playbackCycleOffset, pattern), true);
      }
      this.startProgressUpdates();
      this.state.set('playing');
      this.message.set('正在播放');
    } catch (error) {
      this.stopProgressUpdates();
      this.isScrubbing = false;
      this.state.set('error');
      this.message.set(error instanceof Error ? error.message : '樂譜執行失敗');
      throw error;
    }
  }

  stop(): void {
    if (this.bootPromise) hushStrudel();
    this.stopProgressUpdates();
    this.isScrubbing = false;
    this.playbackCycleOffset = 0;
    this.cycleProgress.set(0);
    this.currentCycle.set(0);
    this.state.set(this.bootPromise ? 'ready' : 'idle');
    this.message.set('已停止');
  }

  setTimelineCode(code: string): void {
    if (this.state() === 'playing') return;
    this.activeCode = code;
    this.totalCycles.set(arrangementCycles(code));
    this.playbackCycleOffset = 0;
    this.updatePosition(0);
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

  previewSeek(cycle: number): void {
    this.isScrubbing = true;
    this.updatePosition(this.clampCycle(cycle));
  }

  async seekToCycle(cycle: number): Promise<void> {
    const targetCycle = this.clampCycle(cycle);
    const shouldResume = this.state() === 'playing';
    this.playbackCycleOffset = targetCycle;

    if (!shouldResume || !this.activeCode || !this.repl) {
      this.isScrubbing = false;
      this.updatePosition(targetCycle);
      return;
    }

    this.stopProgressUpdates();
    try {
      const audioContext = getAudioContext();
      if (audioContext.state === 'suspended') await audioContext.resume();
      hushStrudel();
      const pattern = await evaluateStrudel(this.activeCode, false);
      if (!pattern) throw new Error('無法定位到指定段落');
      await this.repl.setPattern(earlyStrudel(targetCycle, pattern), true);
      this.isScrubbing = false;
      this.startProgressUpdates();
      this.state.set('playing');
      this.message.set(`從第 ${Math.floor(targetCycle) + 1} cycle 播放`);
    } catch (error) {
      this.isScrubbing = false;
      this.state.set('error');
      this.message.set(error instanceof Error ? error.message : '跳播失敗');
      throw error;
    }
  }

  private stopProgressUpdates(): void {
    if (this.progressInterval === undefined) return;
    window.clearInterval(this.progressInterval);
    this.progressInterval = undefined;
  }

  private startProgressUpdates(): void {
    this.progressInterval = window.setInterval(() => {
      if (this.isScrubbing) return;
      const elapsedCycles = Math.max(0, this.repl?.scheduler.now() ?? 0);
      this.updatePosition(this.playbackCycleOffset + elapsedCycles);
    }, 50);
  }

  private updatePosition(cycle: number): void {
    const total = this.totalCycles();
    const position = ((cycle % total) + total) % total;
    this.currentCycle.set(position);
    this.cycleProgress.set(position / total * 100);
  }

  private clampCycle(cycle: number): number {
    const total = this.totalCycles();
    return Math.min(Math.max(0, Number.isFinite(cycle) ? cycle : 0), Math.max(0, total - 0.01));
  }
}
