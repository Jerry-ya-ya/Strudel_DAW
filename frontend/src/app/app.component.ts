import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmbedPlayerComponent } from './embed-player.component';
import { StudioComponent } from './studio.component';

@Component({
  selector: 'app-root',
  imports: [EmbedPlayerComponent, StudioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (embedId) {
      <app-embed-player [scoreId]="embedId" />
    } @else {
      <app-studio />
    }
  `
})
export class AppComponent {
  readonly embedId = this.readEmbedId();

  private readEmbedId(): string | null {
    const match = window.location.pathname.match(/^\/embed\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

