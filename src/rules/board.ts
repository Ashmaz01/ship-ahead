import { QuestionType, RULES } from './config';
import { Rng, shuffle } from './rng';

export type TileKind = 'start' | 'question' | 'power' | 'dock';

export interface Tile {
  index: number;
  kind: TileKind;
  /** Question type asked on this tile (question, power and fuel tiles all ask one). */
  qtype: QuestionType;
}

/**
 * Lays out the path: start, dock at the end, power and fuel tiles placed at random
 * (never on the first three tiles or the dock), question types spread across the rest.
 */
export function createBoard(rng: Rng, qtypes: readonly QuestionType[]): Tile[] {
  const n = RULES.pathLength;
  const types = qtypes.length ? qtypes : (['mcq'] as QuestionType[]);
  const special = shuffle(
    rng,
    Array.from({ length: n - 5 }, (_, i) => i + 3),
  );
  const power = new Set(special.slice(0, RULES.powerTiles));
  const typeOrder = shuffle(rng, types);
  return Array.from({ length: n }, (_, index) => {
    let kind: TileKind = 'question';
    if (index === 0) kind = 'start';
    else if (index === n - 1) kind = 'dock';
    else if (power.has(index)) kind = 'power';
    return { index, kind, qtype: typeOrder[index % typeOrder.length] };
  });
}
