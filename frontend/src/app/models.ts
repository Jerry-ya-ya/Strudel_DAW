export interface ScoreSummary {
  id: string;
  name: string;
  description: string;
  bpm: number;
  codeLength: number;
  createdAt: string;
  updatedAt: string;
}

export interface Score extends Omit<ScoreSummary, 'codeLength'> {
  code: string;
}

export type ScoreInput = Pick<Score, 'name' | 'description' | 'bpm' | 'code'>;

