import { Tile, createBoard } from './board';
import { DIFFICULTY, Difficulty, PowerKind, QuestionType, RULES, Subject } from './config';
import { Question, correctAnswerText, isCorrect, pickQuestion } from './questions';
import { Rng, createRng, pick, randInt } from './rng';

export interface PlayerSetup {
  name: string;
  color: string;
}

export interface GameSetup {
  players: PlayerSetup[];
  difficulty: Difficulty;
  subjects: Subject[];
  qtypes: QuestionType[];
  timer: boolean;
  seed?: number;
}

export interface Player {
  id: number;
  name: string;
  color: string;
  pos: number;
  points: number;
  fuel: number;
  powers: PowerKind[];
  shield: boolean;
  skipTurns: number;
  boarded: boolean;
}

export type PendingReason = 'tile' | 'refuel';

export interface Pending {
  question: Question;
  reason: PendingReason;
  tile: Tile;
}

export type Phase = 'turn' | 'question' | 'over';

export type GameEvent =
  | { type: 'power'; playerId: number; power: PowerKind; targetId?: number }
  | { type: 'roll'; playerId: number; value: number }
  | { type: 'move'; playerId: number; from: number; to: number }
  | { type: 'answer'; playerId: number; correct: boolean; answer: string }
  | { type: 'points'; playerId: number; amount: number }
  | { type: 'gainPower'; playerId: number; power: PowerKind }
  | { type: 'powerSlotsFull'; playerId: number }
  | { type: 'fuel'; playerId: number; fuel: number }
  | { type: 'board'; playerId: number }
  | { type: 'waitAtDock'; playerId: number; fuel: number }
  | { type: 'lava'; front: number }
  | { type: 'lavaHit'; playerId: number; shielded: boolean; to: number }
  | { type: 'skip'; playerId: number }
  | { type: 'turn'; playerId: number; round: number }
  | { type: 'gameOver'; winnerId: number; reason: 'boarded' | 'lavaReachedHarbour' };

export interface GameState {
  setup: GameSetup;
  board: Tile[];
  players: Player[];
  current: number;
  round: number;
  /** Tiles with index below this are covered by lava. */
  lavaFront: number;
  phase: Phase;
  pending: Pending | null;
  winnerId: number | null;
  rng: Rng;
  used: Set<string>;
  bank: readonly Question[];
}

const DOCK = RULES.pathLength - 1;

export function createGame(setup: GameSetup, bank: readonly Question[]): GameState {
  const n = setup.players.length;
  if (n < RULES.minPlayers || n > RULES.maxPlayers) {
    throw new Error(`Ship Ahead needs ${RULES.minPlayers} to ${RULES.maxPlayers} players.`);
  }
  const rng = createRng(setup.seed ?? Date.now());
  return {
    setup,
    board: createBoard(rng, setup.qtypes),
    players: setup.players.map((p, id) => ({
      id, name: p.name, color: p.color,
      pos: 0, points: 0, fuel: 0, powers: [], shield: false, skipTurns: 0, boarded: false,
    })),
    current: 0,
    round: 1,
    lavaFront: 0,
    phase: 'turn',
    pending: null,
    winnerId: null,
    rng,
    used: new Set(),
    bank,
  };
}

export function currentPlayer(s: GameState): Player {
  return s.players[s.current];
}

export function isAtDock(p: Player): boolean {
  return p.pos === DOCK;
}

function assertPhase(s: GameState, phase: Phase): void {
  if (s.phase !== phase) throw new Error(`Expected phase "${phase}" but game is in "${s.phase}".`);
}

/** Uses a stored power. Only before rolling, on the player's own turn. */
export function usePower(s: GameState, power: PowerKind, targetId?: number): GameEvent[] {
  assertPhase(s, 'turn');
  const p = currentPlayer(s);
  const slot = p.powers.indexOf(power);
  if (slot < 0) throw new Error(`${p.name} has no ${power} power.`);
  const events: GameEvent[] = [];
  if (power === 'jump') {
    const to = Math.min(p.pos + RULES.jumpDistance, DOCK);
    events.push({ type: 'power', playerId: p.id, power }, { type: 'move', playerId: p.id, from: p.pos, to });
    p.pos = to;
  } else if (power === 'shield') {
    if (p.shield) throw new Error(`${p.name} already has a lava shield.`);
    p.shield = true;
    events.push({ type: 'power', playerId: p.id, power });
  } else {
    const target = s.players.find((x) => x.id === targetId);
    if (!target || target.id === p.id || target.boarded) throw new Error('Pick another player who is still on the island.');
    const to = Math.max(s.lavaFront, target.pos - RULES.pushbackDistance, 0);
    events.push(
      { type: 'power', playerId: p.id, power, targetId: target.id },
      { type: 'move', playerId: target.id, from: target.pos, to },
    );
    target.pos = to;
  }
  p.powers.splice(slot, 1);
  return events;
}

/** Rolls the dice and moves. A player at the dock refuels instead (see `refuel`). */
export function roll(s: GameState, forced?: number): GameEvent[] {
  assertPhase(s, 'turn');
  const p = currentPlayer(s);
  if (isAtDock(p)) throw new Error(`${p.name} is at the harbour: answer a refuel question instead of rolling.`);
  const value = forced ?? randInt(s.rng, 1, 6);
  const to = Math.min(p.pos + value, DOCK);
  const events: GameEvent[] = [
    { type: 'roll', playerId: p.id, value },
    { type: 'move', playerId: p.id, from: p.pos, to },
  ];
  p.pos = to;
  const tile = s.board[to];
  if (tile.kind === 'dock') {
    if (p.fuel >= RULES.fuelNeeded) return events.concat(boardShip(s, p));
    events.push({ type: 'waitAtDock', playerId: p.id, fuel: p.fuel });
    ask(s, tile, 'refuel');
    return events;
  }
  ask(s, tile, 'tile');
  return events;
}

/** At the dock without enough fuel: one question per turn, one fuel per right answer. */
export function refuel(s: GameState): GameEvent[] {
  assertPhase(s, 'turn');
  const p = currentPlayer(s);
  if (!isAtDock(p)) throw new Error(`${p.name} is not at the harbour.`);
  ask(s, s.board[DOCK], 'refuel');
  return [];
}

function ask(s: GameState, tile: Tile, reason: PendingReason): void {
  const qtype = reason === 'refuel' ? pick(s.rng, s.setup.qtypes.length ? s.setup.qtypes : (['mcq'] as QuestionType[])) : tile.qtype;
  const question = pickQuestion(s.rng, s.bank, qtype, { subjects: s.setup.subjects, difficulty: s.setup.difficulty }, s.used);
  s.pending = { question, reason, tile };
  s.phase = 'question';
}

/** Answers the pending question. Pass `null` when the timer runs out. */
export function answer(s: GameState, response: string | number | null): GameEvent[] {
  assertPhase(s, 'question');
  const pending = s.pending!;
  const p = currentPlayer(s);
  const d = DIFFICULTY[s.setup.difficulty];
  const correct = response !== null && isCorrect(pending.question, response);
  const events: GameEvent[] = [
    { type: 'answer', playerId: p.id, correct, answer: correctAnswerText(pending.question) },
  ];
  s.pending = null;
  s.phase = 'turn';

  if (correct) {
    p.points += d.points;
    events.push({ type: 'points', playerId: p.id, amount: d.points });
    const kind = pending.reason === 'refuel' ? 'fuel' : pending.tile.kind;
    if (kind === 'fuel' && p.fuel < RULES.fuelNeeded) {
      p.fuel += 1;
      events.push({ type: 'fuel', playerId: p.id, fuel: p.fuel });
    }
    if (kind === 'power') {
      if (p.powers.length < RULES.maxPowers) {
        const power = pick(s.rng, ['jump', 'shield', 'pushback'] as PowerKind[]);
        p.powers.push(power);
        events.push({ type: 'gainPower', playerId: p.id, power });
      } else {
        events.push({ type: 'powerSlotsFull', playerId: p.id });
      }
    }
    if (isAtDock(p) && p.fuel >= RULES.fuelNeeded) return events.concat(boardShip(s, p));
  } else if (pending.reason === 'tile') {
    const to = Math.max(s.lavaFront, p.pos - d.back, 0);
    if (to !== p.pos) {
      events.push({ type: 'move', playerId: p.id, from: p.pos, to });
      p.pos = to;
    }
  }
  return events.concat(endTurn(s));
}

function boardShip(s: GameState, p: Player): GameEvent[] {
  p.boarded = true;
  s.phase = 'over';
  s.pending = null;
  s.winnerId = p.id;
  return [
    { type: 'board', playerId: p.id },
    { type: 'gameOver', winnerId: p.id, reason: 'boarded' },
  ];
}

/** Moves to the next player, advancing lava at the end of each full round. */
export function endTurn(s: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  for (let guard = 0; guard < s.players.length * 8; guard++) {
    s.current = (s.current + 1) % s.players.length;
    if (s.current === 0) {
      s.round += 1;
      events.push(...advanceLava(s));
      if (s.phase === 'over') return events;
    }
    const next = currentPlayer(s);
    if (next.skipTurns > 0) {
      next.skipTurns -= 1;
      events.push({ type: 'skip', playerId: next.id });
      continue;
    }
    events.push({ type: 'turn', playerId: next.id, round: s.round });
    return events;
  }
  throw new Error('No player could take a turn.');
}

function advanceLava(s: GameState): GameEvent[] {
  if (s.round <= RULES.lavaGraceRounds + 1) return [];
  s.lavaFront = Math.min(s.lavaFront + RULES.lavaPerRound, DOCK);
  const events: GameEvent[] = [{ type: 'lava', front: s.lavaFront }];
  for (const p of s.players) {
    if (p.boarded || p.pos >= s.lavaFront) continue;
    const to = s.lavaFront;
    events.push({ type: 'lavaHit', playerId: p.id, shielded: p.shield, to });
    if (p.shield) p.shield = false;
    else p.skipTurns += 1;
    p.pos = to;
  }
  if (s.lavaFront >= DOCK) {
    const best = s.players.reduce((a, b) => (b.points > a.points ? b : a));
    s.phase = 'over';
    s.winnerId = best.id;
    events.push({ type: 'gameOver', winnerId: best.id, reason: 'lavaReachedHarbour' });
  }
  return events;
}
