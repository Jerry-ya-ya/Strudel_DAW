import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { StrudelEngineService } from './strudel-engine.service';

@Component({
  selector: 'app-volume-control',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="volume-control" role="group" [attr.aria-label]="label + ' 音量控制'">
      <span class="volume-label">{{ label }}</span>
      <div class="volume-actions">
        <button
          class="volume-button"
          type="button"
          [attr.aria-label]="label + ' 降低音量'"
          [disabled]="volumePercent === 0"
          (click)="adjustVolume(-10)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 9v6h4l5 4V5L7 9H3Z" />
            <path d="M16 12h6" />
          </svg>
        </button>
        <output class="volume-value" aria-live="polite">{{ volumePercent }}%</output>
        <button
          class="volume-button"
          type="button"
          [attr.aria-label]="label + ' 提高音量'"
          [disabled]="volumePercent === 100"
          (click)="adjustVolume(10)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 9v6h4l5 4V5L7 9H3Z" />
            <path d="M18 9v6M15 12h6" />
          </svg>
        </button>
      </div>
    </div>
  `,
  styleUrl: './volume-control.component.css'
})
export class VolumeControlComponent {
  @Input() label = 'MASTER';

  private readonly engine = inject(StrudelEngineService);

  get volumePercent(): number {
    return Math.round(this.engine.masterVolume() * 100);
  }

  adjustVolume(step: number): void {
    const next = Math.min(100, Math.max(0, this.volumePercent + step));
    this.engine.setMasterVolume(next / 100);
  }
}
