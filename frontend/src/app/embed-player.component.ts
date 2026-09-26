import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Score } from './models';
import { ScoreApiService } from './score-api.service';
import { StrudelEngineService } from './strudel-engine.service';

@Component({
  selector: 'app-embed-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './embed-player.component.html',
  styleUrl: './embed-player.component.css'
})
export class EmbedPlayerComponent implements OnInit {
  @Input({ required: true }) scoreId!: string;
  private readonly api = inject(ScoreApiService);
  readonly engine = inject(StrudelEngineService);
  readonly score = signal<Score | null>(null);
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.score.set(await firstValueFrom(this.api.get(this.scoreId)));
    } catch {
      this.error.set('找不到這份樂譜，或它已被刪除。');
    }
  }

  async togglePlayback(): Promise<void> {
    if (this.engine.state() === 'playing') {
      this.engine.stop();
      return;
    }
    const score = this.score();
    if (!score) return;
    try {
      await this.engine.play(score.code);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '無法播放這份樂譜');
    }
  }
}

