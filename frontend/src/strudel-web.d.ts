declare module '@strudel/web' {
  export interface StrudelInitOptions {
    miniAllStrings?: boolean;
    prebake?: () => void | Promise<void>;
    [key: string]: unknown;
  }

  export function initStrudel(options?: StrudelInitOptions): Promise<unknown>;
  export function evaluate(code: string, autoplay?: boolean): Promise<unknown>;
  export function hush(): void;
  export function getAudioContext(): AudioContext;
  export function samples(source: string, baseUrl?: string): Promise<unknown>;
}
