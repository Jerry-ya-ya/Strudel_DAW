import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Score, ScoreInput, ScoreSummary } from './models';

@Injectable({ providedIn: 'root' })
export class ScoreApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<ScoreSummary[]> {
    return this.http.get<ScoreSummary[]>('/api/scores');
  }

  get(id: string): Observable<Score> {
    return this.http.get<Score>(`/api/scores/${encodeURIComponent(id)}`);
  }

  create(input: ScoreInput): Observable<Score> {
    return this.http.post<Score>('/api/scores', input);
  }

  update(id: string, input: ScoreInput): Observable<Score> {
    return this.http.put<Score>(`/api/scores/${encodeURIComponent(id)}`, input);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/scores/${encodeURIComponent(id)}`);
  }
}

