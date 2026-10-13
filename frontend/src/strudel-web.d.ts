declare module '@strudel/web' {
  export interface StrudelInitOptions {
    miniAllStrings?: boolean;
    prebake?: () => void | Promise<void>;
    outputNode?: AudioNode;
    sync?: boolean;
    [key: string]: unknown;
  }

  export interface StrudelPattern {
    readonly _Pattern?: boolean;
  }

  export interface StrudelRepl {
    scheduler: { now(): number };
    setPattern(pattern: StrudelPattern, autoplay?: boolean): Promise<StrudelPattern>;
  }

  export function initStrudel(options?: StrudelInitOptions): Promise<StrudelRepl>;
  export function evaluate(code: string, autoplay?: boolean): Promise<StrudelPattern | undefined>;
  export function early(cycles: number, pattern: StrudelPattern): StrudelPattern;
  export function hush(): void;
  export function getAudioContext(): AudioContext;
  export function getSuperdoughAudioController(): { output: { destinationGain: GainNode } };
  export function samples(source: string, baseUrl?: string): Promise<unknown>;
}
