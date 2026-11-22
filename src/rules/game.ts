import { selectedBands, drawMath, type Band, type SchoolLevel } from './school';
import { Tile, createBoard } from './board';
import { DIFFICULTY, Difficulty, PowerKind, QuestionType, RULES, Subject } from './config';
import { Question, correctAnswerText, isCorrect } from './questions';
import { Rng, createRng, pick, randInt } from './rng';

export interface PlayerSetup {
  name: string;
  color: string;
}

export interface GameSetup {
  players: PlayerSetup[];
  difficulty: Difficulty;
  subjects: Subject[];
  schoolLevel?: SchoolLevel;
  schoolLevels?: Band[];
  qtypes: QuestionType[];
  timer: boolean;
  seed?: number;
  matchMinutes?: number;
}

export interface Player {
  id: number;
  name: string;
  color: string;
  pos: number;
  points: number;
  powers: PowerKind[];
  shield: boolean;
  skipTurns: number;
  boarded: boolean;
}


export interface Pending {
  question: Question;
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
  | { type: 'board'; playerId: number }
  | { type: 'lava'; front: number }
  | { type: 'lavaHit'; playerId: number; shielded: boolean; to: number }
  | { type: 'skip'; playerId: number }
  | { type: 'turn'; playerId: number; round: number }
  | { type: 'gameOver'; winnerId: number; reason: 'boarded' | 'lavaReachedHarbour' | 'timeExpired' };

export interface GameState {
  setup: GameSetup;
  board: Tile[];
  players: Player[];
  escapeOrder: number[];
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
      pos: 0, points: 0, powers: [], shield: false, skipTurns: 0, boarded: false,
    })),
    escapeOrder: [],
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
  if (isAtDock(p)) return events.concat(boardShip(s, p));
  return events;
}

/** Resolve the landing before its animation begins. */
export function roll(s: GameState, forced?: number): GameEvent[] {
  assertPhase(s, 'turn');
  const p = currentPlayer(s);
  const value = forced ?? randInt(s.rng, 1, 6);
  const to = Math.min(p.pos + value, DOCK);
  const events: GameEvent[] = [
    { type: 'roll', playerId: p.id, value },
    { type: 'move', playerId: p.id, from: p.pos, to },
  ];
  p.pos = to;
  const tile = s.board[to];
  if (tile.kind === 'dock') return events.concat(boardShip(s, p));
  const qtype = tile.qtype;
  const question = drawMath(s.rng,selectedBands(s.setup.schoolLevels ?? s.setup.schoolLevel),qtype,s.setup.difficulty,s.used);
  s.pending = { question, tile };
  s.phase = 'question';
  return events;
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
    if (pending.tile.kind === 'power') {
      if (p.powers.length < RULES.maxPowers) {
        const power = pick(s.rng, ['jump', 'shield', 'pushback'] as PowerKind[]);
        p.powers.push(power);
        events.push({ type: 'gainPower', playerId: p.id, power });
      } else {
        events.push({ type: 'powerSlotsFull', playerId: p.id });
      }
    }
  } else {
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
  s.escapeOrder.push(p.id);
  s.pending = null;
  const events: GameEvent[] = [{ type: 'board', playerId: p.id }];
  if (s.escapeOrder.length < (s.players.length === 2 ? 1 : 2)) return events.concat(endTurn(s));
  s.phase = 'over';
  s.winnerId = s.escapeOrder[0];
  return events.concat({ type: 'gameOver', winnerId: s.winnerId, reason: 'boarded' });
}

export function standings(s: GameState) {
  const boarded = s.escapeOrder.map((id, index) => ({ player: s.players[id], rank: index + 1 }));
  const island = s.players.filter(p => !p.boarded).sort((a,b) => b.points-a.points || b.pos-a.pos);
  let rank = boarded.length;
  return boarded.concat(island.map((player, index) => {
    const prev = island[index - 1];
    if (!prev || prev.points !== player.points || prev.pos !== player.pos) rank = boarded.length + index + 1;
    return { player, rank };
  }));
}

export function expireMatch(s: GameState): GameEvent[] {
  if (s.phase === 'over') return [];
  s.pending = null;
  s.phase = 'over';
  s.winnerId = standings(s)[0].player.id;
  return [{type:'gameOver',winnerId:s.winnerId,reason:'timeExpired'}];
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
    if (next.boarded) continue;
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
  s.lavaFront = Math.min(s.lavaFront + RULES.lavaPerRound, s.setup.matchMinutes ? DOCK - 1 : DOCK);
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
    const best = standings(s)[0].player;
    s.phase = 'over';
    s.winnerId = best.id;
    events.push({ type: 'gameOver', winnerId: best.id, reason: 'lavaReachedHarbour' });
  }
  return events;
}
