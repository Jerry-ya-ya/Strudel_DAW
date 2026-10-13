export interface ScoreSummary {
  id: string;
  name: string;
  description: string;
  bpm: number;
  codeLength: number;
  createdAt: string;
  updatedAt: string;
  source?: 'saved' | 'generated';
}

export interface Score extends Omit<ScoreSummary, 'codeLength'> {
  code: string;
}

export type ScoreInput = Pick<Score, 'name' | 'description' | 'bpm' | 'code'>;

