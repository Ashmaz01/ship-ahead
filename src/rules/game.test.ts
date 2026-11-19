import { describe, expect, it } from 'vitest';
import bank from '../data/questions.json';
import { createBoard } from './board';
import { RULES } from './config';
import { GameSetup, GameState, answer, createGame, currentPlayer, refuel, roll, usePower } from './game';
import { Question, isCorrect, pickQuestion } from './questions';
import { generateMath } from './mathgen';
import { createRng } from './rng';

const DOCK = RULES.pathLength - 1;
const setup = (over: Partial<GameSetup> = {}): GameSetup => ({
  players: [{ name: 'Aina', color: '#2DD4BF' }, { name: 'Danial', color: '#60A5FA' }],
  difficulty: 'medium',
  subjects: ['math', 'science', 'english', 'arabic'],
  qtypes: ['mcq', 'fill', 'pattern', 'word'],
  timer: false,
  seed: 42,
  ...over,
});
const game = (over: Partial<GameSetup> = {}) => createGame(setup(over), bank as Question[]);

function right(s: GameState) {
  const q = s.pending!.question;
  return answer(s, q.choices ? q.answerIndex! : q.answers![0]);
}
function wrong(s: GameState) {
  const q = s.pending!.question;
  return answer(s, q.choices ? (q.answerIndex! + 1) % q.choices.length : 'not an answer');
}
/** Puts the current player on `pos` and rolls `value`, so tests control the landing tile. */
function landOn(s: GameState, index: number) {
  currentPlayer(s).pos = index - 1;
  return roll(s, 1);
}

describe('board', () => {
  it('has a start, a dock, and the right number of power and fuel pillars', () => {
    const b = createBoard(createRng(1), ['mcq', 'fill']);
    expect(b).toHaveLength(RULES.pathLength);
    expect(b[0].kind).toBe('start');
    expect(b[DOCK].kind).toBe('dock');
    expect(b.filter((t) => t.kind === 'power')).toHaveLength(RULES.powerTiles);
    expect(b.filter((t) => t.kind === 'fuel')).toHaveLength(RULES.fuelTiles);
    expect(b.slice(1, 3).every((t) => t.kind === 'question')).toBe(true);
  });
});

describe('turns and answers', () => {
  it('moves by the roll and asks a question', () => {
    const s = game();
    const ev = roll(s, 4);
    expect(ev).toContainEqual({ type: 'move', playerId: 0, from: 0, to: 4 });
    expect(s.phase).toBe('question');
  });

  it('gives points for a right answer and passes the turn', () => {
    const s = game();
    const q = s.board.findIndex((t, i) => i > 0 && t.kind === 'question');
    landOn(s, q);
    right(s);
    expect(s.players[0].points).toBe(2);
    expect(s.players[0].pos).toBe(q);
    expect(s.current).toBe(1);
  });

  it('sends a wrong answer back by the difficulty amount', () => {
    const s = game({ difficulty: 'hard' });
    const q = s.board.findIndex((t, i) => i > 10 && t.kind === 'question');
    landOn(s, q);
    wrong(s);
    expect(s.players[0].pos).toBe(q - 3);
    expect(s.players[0].points).toBe(0);
  });

  it('treats a timeout as wrong', () => {
    const s = game();
    roll(s, 5);
    const ev = answer(s, null);
    expect(ev[0]).toMatchObject({ type: 'answer', correct: false });
  });

  it('never sends a player back into lava', () => {
    const s = game({ difficulty: 'hard' });
    s.lavaFront = 10;
    const q = s.board.findIndex((t, i) => i >= 11 && i <= 12 && t.kind === 'question');
    if (q < 0) return;
    landOn(s, q);
    wrong(s);
    expect(s.players[0].pos).toBeGreaterThanOrEqual(10);
  });
});

describe('fuel and the harbour', () => {
  it('adds fuel on a fuel pillar', () => {
    const s = game();
    landOn(s, s.board.findIndex((t) => t.kind === 'fuel'));
    right(s);
    expect(s.players[0].fuel).toBe(1);
  });

  it('boards straight away with enough fuel', () => {
    const s = game();
    s.players[0].fuel = 3;
    const ev = landOn(s, DOCK);
    expect(ev).toContainEqual({ type: 'gameOver', winnerId: 0, reason: 'boarded' });
    expect(s.phase).toBe('over');
  });

  it('waits at the dock and refuels one right answer at a time', () => {
    const s = game();
    s.players[0].fuel = 1;
    const ev = landOn(s, DOCK);
    expect(ev).toContainEqual({ type: 'waitAtDock', playerId: 0, fuel: 1 });
    right(s); // fuel 2, turn passes
    expect(s.players[0].fuel).toBe(2);
    expect(() => roll(s, 1)).not.toThrow(); // Danial's turn
    wrong(s);
    expect(currentPlayer(s).id).toBe(0);
    expect(() => roll(s)).toThrow(/refuel/);
    refuel(s);
    const last = right(s);
    expect(last).toContainEqual({ type: 'gameOver', winnerId: 0, reason: 'boarded' });
  });

  it('does not move a player at the dock back on a wrong refuel answer', () => {
    const s = game();
    landOn(s, DOCK);
    wrong(s);
    expect(s.players[0].pos).toBe(DOCK);
  });
});

describe('powers', () => {
  it('gains a power on a power pillar, up to two', () => {
    const s = game();
    const p = s.board.findIndex((t) => t.kind === 'power');
    landOn(s, p);
    right(s);
    expect(s.players[0].powers).toHaveLength(1);
    s.current = 0;
    s.players[0].powers = ['jump', 'shield'];
    landOn(s, p);
    const ev = right(s);
    expect(ev).toContainEqual({ type: 'powerSlotsFull', playerId: 0 });
    expect(s.players[0].powers).toHaveLength(2);
  });

  it('jump moves ahead before rolling', () => {
    const s = game();
    s.players[0].powers = ['jump'];
    usePower(s, 'jump');
    expect(s.players[0].pos).toBe(RULES.jumpDistance);
    expect(s.players[0].powers).toHaveLength(0);
    expect(s.phase).toBe('turn');
  });

  it('push back moves another player, but not into lava', () => {
    const s = game();
    s.players[0].powers = ['pushback'];
    s.players[1].pos = 12;
    s.lavaFront = 11;
    usePower(s, 'pushback', 1);
    expect(s.players[1].pos).toBe(11);
  });

  it('shield blocks one lava hit', () => {
    const s = game();
    s.players[0].powers = ['shield'];
    usePower(s, 'shield');
    s.round = RULES.lavaGraceRounds + 1;
    roll(s, 1);
    wrong(s); // to Danial
    roll(s, 1);
    const ev = wrong(s); // round ends, lava moves
    expect(ev).toContainEqual(expect.objectContaining({ type: 'lavaHit', playerId: 0, shielded: true }));
    expect(s.players[0].skipTurns).toBe(0);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'lavaHit', playerId: 1, shielded: false }));
  });
});

describe('lava', () => {
  it('waits for the grace rounds, then moves each round', () => {
    const s = game();
    for (let r = 0; r < RULES.lavaGraceRounds; r++) {
      roll(s, 6); wrong(s); roll(s, 6); wrong(s);
    }
    expect(s.lavaFront).toBe(0);
    roll(s, 6); wrong(s); roll(s, 6); wrong(s);
    expect(s.lavaFront).toBe(RULES.lavaPerRound);
  });

  it('a lava hit costs a turn', () => {
    const s = game();
    s.round = RULES.lavaGraceRounds + 1;
    roll(s, 1); wrong(s);
    s.players[0].pos = 0;
    roll(s, 6); right(s); // round ends: lava covers 0 and 1
    expect(s.players[0].skipTurns).toBe(0); // skip already used: Aina was skipped
    expect(currentPlayer(s).id).toBe(1);
  });

  it('ends the game when lava reaches the harbour, highest points wins', () => {
    const s = game();
    s.round = 50;
    s.lavaFront = DOCK - 1;
    s.players[1].points = 9;
    s.players[0].pos = 30;
    roll(s, 1); wrong(s);
    roll(s, 1);
    const ev = wrong(s);
    expect(ev).toContainEqual({ type: 'gameOver', winnerId: 1, reason: 'lavaReachedHarbour' });
  });
});

describe('questions', () => {
  it('accepts typed answers case-insensitively', () => {
    const q: Question = { id: 'x', subject: 'english', type: 'fill', difficulty: 'easy', prompt: '', answers: ['Sailed'] };
    expect(isCorrect(q, '  sailed ')).toBe(true);
    expect(isCorrect(q, 'sail')).toBe(false);
  });

  it('generated maths has a correct answer that matches the prompt', () => {
    const rng = createRng(7);
    for (let i = 0; i < 300; i++) {
      for (const d of ['easy', 'medium', 'hard'] as const) {
        const q = generateMath(rng, 'mcq', d);
        const [, a, op, b] = q.prompt.match(/(\d+) ([+\-×÷]) (\d+)/)!;
        const x = +a, y = +b;
        const r = op === '+' ? x + y : op === '-' ? x - y : op === '×' ? x * y : x / y;
        expect(Number.isInteger(r) && r >= 0).toBe(true);
        expect(q.choices![q.answerIndex!]).toBe(String(r));
        expect(new Set(q.choices).size).toBe(4);
      }
    }
  });

  it('pattern questions follow their sequence', () => {
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) {
      const q = generateMath(rng, 'pattern', 'medium');
      const nums = q.prompt.match(/-?\d+/g)!.map(Number);
      const step = nums[1] - nums[0];
      expect(+q.answers![0]).toBe(nums[3] + step);
    }
  });

  it('only picks from chosen subjects when maths is off', () => {
    const rng = createRng(5);
    const used = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const q = pickQuestion(rng, bank as Question[], 'mcq', { subjects: ['arabic'], difficulty: 'easy' }, used);
      expect(q.subject).toBe('arabic');
    }
  });
});
