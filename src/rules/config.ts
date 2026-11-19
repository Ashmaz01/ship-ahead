export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'mcq' | 'fill' | 'pattern' | 'word';
export type Subject = 'math' | 'science' | 'english' | 'arabic';
export type PowerKind = 'jump' | 'shield' | 'pushback';

export const DIFFICULTY: Record<Difficulty, { seconds: number; points: number; back: number }> = {
  easy: { seconds: 30, points: 1, back: 1 },
  medium: { seconds: 20, points: 2, back: 2 },
  hard: { seconds: 15, points: 3, back: 3 },
};

export const RULES = {
  pathLength: 40,
  powerTiles: 7,
  fuelTiles: 5,
  fuelNeeded: 3,
  maxPowers: 2,
  jumpDistance: 3,
  pushbackDistance: 3,
  /** Rounds played before lava starts to move. */
  lavaGraceRounds: 2,
  /** Pillars lava covers at the end of each full round. Tune after playtesting. */
  lavaPerRound: 2,
  minPlayers: 2,
  maxPlayers: 6,
} as const;

export const POWER_LABEL: Record<PowerKind, string> = {
  jump: 'Jump ahead',
  shield: 'Lava shield',
  pushback: 'Push back',
};

export const TYPE_LABEL: Record<QuestionType, string> = {
  mcq: 'Multiple choice',
  fill: 'Fill the blank',
  pattern: 'Number pattern',
  word: 'Word problem',
};

export const SUBJECT_LABEL: Record<Subject, string> = {
  math: 'Maths',
  science: 'Science',
  english: 'English',
  arabic: 'Arabic',
};
