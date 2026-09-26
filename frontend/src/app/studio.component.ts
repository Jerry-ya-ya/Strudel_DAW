import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Score, ScoreInput, ScoreSummary } from './models';
import { ScoreApiService } from './score-api.service';
import { StrudelEngineService } from './strudel-engine.service';

const NEW_SCORE: ScoreInput = {
  name: 'Untitled pattern',
  description: '',
  bpm: 120,
  code: `stack(
  s("bd*4"),
  s("~ sd ~ sd"),
  s("hh*8").gain(0.35),
  note("<c3 eb3 g3 bb3>")
    .s("triangle")
    .lpf(1400)
    .gain(0.45)
).cpm(120)`
};

@Component({
  selector: 'app-studio',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './studio.component.html',
  styleUrl: './studio.component.css'
})
export class StudioComponent implements OnInit {
  private readonly api = inject(ScoreApiService);
  readonly engine = inject(StrudelEngineService);

  readonly scores = signal<ScoreSummary[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly dirty = signal(false);
  readonly notice = signal('');
  readonly error = signal('');
  readonly search = signal('');
  readonly showEmbed = signal(false);
  readonly confirmDelete = signal(false);
  readonly meterBars = Array.from({ length: 28 }, (_, index) => index);

  draft: ScoreInput = { ...NEW_SCORE };

  readonly filteredScores = computed(() => {
    const term = this.search().trim().toLocaleLowerCase();
    return term
      ? this.scores().filter((score) => `${score.name} ${score.description}`.toLocaleLowerCase().includes(term))
      : this.scores();
  });

  readonly embedUrl = computed(() => {
    const id = this.selectedId();
    return id ? `${window.location.origin}/embed/${encodeURIComponent(id)}` : '';
  });

  readonly embedCode = computed(() =>
    this.embedUrl()
      ? `<iframe src="${this.embedUrl()}" title="Strudel player" width="720" height="420" allow="autoplay" loading="lazy"></iframe>`
      : ''
  );

  async ngOnInit(): Promise<void> {
    await this.refresh();
    const first = this.scores()[0];
    if (first) await this.select(first.id);
  }

  async refresh(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      this.scores.set(await firstValueFrom(this.api.list()));
    } catch (error) {
      this.fail(error, '無法讀取樂譜');
    } finally {
      this.busy.set(false);
    }
  }

  async select(id: string): Promise<void> {
    if (this.dirty() && id !== this.selectedId() && !window.confirm('尚有未儲存變更，仍要切換嗎？')) return;
    this.busy.set(true);
    this.error.set('');
    this.engine.stop();
    try {
      const score = await firstValueFrom(this.api.get(id));
      this.selectedId.set(score.id);
      this.draft = this.toInput(score);
      this.dirty.set(false);
      this.confirmDelete.set(false);
    } catch (error) {
      this.fail(error, '無法開啟樂譜');
    } finally {
      this.busy.set(false);
    }
  }

  newScore(): void {
    if (this.dirty() && !window.confirm('尚有未儲存變更，仍要建立新樂譜嗎？')) return;
    this.engine.stop();
    this.selectedId.set(null);
    this.draft = { ...NEW_SCORE };
    this.dirty.set(true);
    this.notice.set('新樂譜尚未儲存');
    this.confirmDelete.set(false);
  }

  markDirty(): void {
    this.dirty.set(true);
    this.notice.set('');
  }

  async save(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const id = this.selectedId();
      const score = id
        ? await firstValueFrom(this.api.update(id, this.draft))
        : await firstValueFrom(this.api.create(this.draft));
      this.selectedId.set(score.id);
      this.draft = this.toInput(score);
      this.dirty.set(false);
      this.notice.set('已儲存');
      await this.refresh();
    } catch (error) {
      this.fail(error, '儲存失敗');
    } finally {
      this.busy.set(false);
    }
  }

  async duplicate(): Promise<void> {
    this.busy.set(true);
    try {
      const score = await firstValueFrom(this.api.create({ ...this.draft, name: `${this.draft.name} copy` }));
      await this.refresh();
      await this.select(score.id);
      this.notice.set('已建立副本');
    } catch (error) {
      this.fail(error, '建立副本失敗');
    } finally {
      this.busy.set(false);
    }
  }

  async remove(): Promise<void> {
    const id = this.selectedId();
    if (!id) return;
    if (!this.confirmDelete()) {
      this.confirmDelete.set(true);
      window.setTimeout(() => this.confirmDelete.set(false), 4000);
      return;
    }
    this.busy.set(true);
    try {
      this.engine.stop();
      await firstValueFrom(this.api.remove(id));
      this.selectedId.set(null);
      this.dirty.set(false);
      await this.refresh();
      const first = this.scores()[0];
      if (first) await this.select(first.id);
      else this.newScore();
      this.notice.set('樂譜已刪除');
    } catch (error) {
      this.fail(error, '刪除失敗');
    } finally {
      this.busy.set(false);
    }
  }

  async play(): Promise<void> {
    this.error.set('');
    try {
      await this.engine.play(this.draft.code);
    } catch (error) {
      this.fail(error, 'Strudel 執行失敗，請檢查樂譜語法');
    }
  }

  stop(): void {
    this.engine.stop();
  }

  async copyEmbed(): Promise<void> {
    if (!this.selectedId()) return;
    try {
      await navigator.clipboard.writeText(this.embedCode());
      this.notice.set('iframe 程式碼已複製');
    } catch {
      this.notice.set('請手動複製 iframe 程式碼');
    }
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('zh-TW', { month: 'short', day: 'numeric' }).format(new Date(value));
  }

  trackById(_index: number, score: ScoreSummary): string {
    return score.id;
  }

  private toInput(score: Score): ScoreInput {
    return { name: score.name, description: score.description, bpm: score.bpm, code: score.code };
  }

  private fail(error: unknown, fallback: string): void {
    const apiMessage = typeof error === 'object' && error && 'error' in error
      ? (error as { error?: { message?: string } }).error?.message
      : undefined;
    this.error.set(apiMessage ?? (error instanceof Error ? error.message : fallback));
  }
}

