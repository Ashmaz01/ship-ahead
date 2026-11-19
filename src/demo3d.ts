import '@fontsource/lilita-one/400.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import bank from './data/questions.json';
import { Board3D } from './board3d/Board3D';
import { islandRadius } from './board3d/world';
import { RULES } from './rules/config';
import { GameEvent, GameState, answer, createGame, currentPlayer, isAtDock, refuel, roll } from './rules/game';
import type { Question } from './rules/questions';

/**
 * A look-and-feel demo of the 3D board, driven by the real rules.
 * Questions are answered automatically (about 7 in 10 right) so the board can be judged on its own.
 */

const css = `
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: #1e1a22; overflow: hidden; font-family: 'Atkinson Hyperlegible', system-ui, sans-serif; color: #fff; }
#stage3d { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); overflow: hidden; border-radius: 0; }
#view, #view canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
#ui { position: absolute; inset: 0; pointer-events: none; }
#ui > * { pointer-events: auto; }
.bar { position: absolute; left: 12px; right: 12px; top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.turn { display: flex; align-items: center; gap: 10px; background: rgba(38,33,43,0.86); padding: 8px 14px 8px 8px; border-radius: 26px; }
.dot { width: 30px; height: 30px; border-radius: 50%; border: 3px solid #fff; flex: none; }
.turn b { font-family: 'Lilita One', sans-serif; font-weight: 400; font-size: 19px; display: block; line-height: 1.1; }
.turn small { font-size: 13px; color: #e4dfea; }
.chip { background: rgba(38,33,43,0.86); padding: 8px 12px; border-radius: 18px; font-size: 13px; }
.bottom { position: absolute; left: 12px; right: 12px; bottom: 14px; display: flex; gap: 10px; align-items: flex-end; }
button { font: inherit; color: inherit; cursor: pointer; }
button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
button:disabled { opacity: 0.5; cursor: default; }
.roll { flex: 1; height: 58px; border: 0; border-radius: 16px; background: #ffc23d; color: #26212b; font-family: 'Lilita One', sans-serif; font-size: 24px; box-shadow: 0 5px 0 #b9801a; }
.ghost { height: 58px; padding: 0 14px; border-radius: 16px; border: 2px solid rgba(255,255,255,0.7); background: rgba(38,33,43,0.8); font-weight: 700; font-size: 14px; }
.map { position: absolute; right: 12px; bottom: 86px; width: 132px; height: 132px; border-radius: 18px; background: rgba(15,79,115,0.88); border: 2px solid rgba(255,255,255,0.6); }
.log { position: absolute; left: 12px; right: 156px; bottom: 86px; display: flex; flex-direction: column; gap: 6px; }
.log p { margin: 0; background: rgba(38,33,43,0.86); padding: 8px 12px; border-radius: 12px; font-size: 14px; line-height: 1.3; }
.dice { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); width: 96px; height: 96px; border-radius: 22px; background: #fff; color: #26212b; font-family: 'Lilita One', sans-serif; font-size: 56px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 0 #b9b2c2; pointer-events: none; }
`;
document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);

const stage = document.getElementById('stage3d')!;
const view = document.getElementById('view')!;
const ui = document.getElementById('ui')!;

function fit(): void {
  const ratio = 390 / 844;
  const w = Math.min(window.innerWidth, window.innerHeight * ratio * 1.15);
  stage.style.width = `${Math.round(window.innerWidth < 600 ? window.innerWidth : w)}px`;
  stage.style.height = `${window.innerHeight}px`;
}
window.addEventListener('resize', fit);
fit();

const state: GameState = createGame(
  {
    players: [
      { name: 'Aina', color: '#2DD4BF' },
      { name: 'Danial', color: '#60A5FA' },
      { name: 'Mei', color: '#F472B6' },
      { name: 'Arjun', color: '#A3E635' },
    ],
    difficulty: 'easy',
    subjects: ['math', 'science', 'english'],
    qtypes: ['mcq', 'fill', 'pattern', 'word'],
    timer: false,
    seed: 2026,
  },
  bank as Question[],
);

const board = new Board3D(view, RULES.pathLength);
board.setup(state);
Object.assign(window, { board, ship: { state } });

ui.innerHTML = `
  <div class="bar">
    <div class="turn"><span class="dot"></span><span><b></b><small></small></span></div>
    <span class="chip" id="lava"></span>
  </div>
  <div class="log" aria-live="polite"></div>
  <canvas class="map" width="264" height="264" role="img" aria-label="Map of the path, the lava and every player"></canvas>
  <div class="bottom">
    <button class="roll">Roll dice</button>
    <button class="ghost" aria-pressed="false">Whole island</button>
  </div>`;

const rollBtn = ui.querySelector('.roll') as HTMLButtonElement;
const viewBtn = ui.querySelector('.ghost') as HTMLButtonElement;
const log = ui.querySelector('.log')!;
const map = ui.querySelector('.map') as HTMLCanvasElement;
let busy = false;

function say(msg: string): void {
  const p = document.createElement('p');
  p.textContent = msg;
  log.appendChild(p);
  while (log.children.length > 2) log.firstElementChild!.remove();
}

function renderBar(): void {
  const p = currentPlayer(state);
  (ui.querySelector('.dot') as HTMLElement).style.background = p.color;
  ui.querySelector('.turn b')!.textContent = state.phase === 'over' ? `${state.players[state.winnerId!].name} wins!` : `${p.name}'s turn`;
  ui.querySelector('.turn small')!.textContent = `${p.points} pts, fuel ${p.fuel}/3, pillar ${p.pos + 1}`;
  ui.querySelector('#lava')!.textContent = state.lavaFront ? `Lava: ${state.lavaFront} pillars` : `Round ${state.round}`;
  rollBtn.disabled = busy || state.phase === 'over';
  rollBtn.textContent = isAtDock(p) ? 'Refuel' : 'Roll dice';
}

function drawMap(): void {
  const g = map.getContext('2d')!;
  const S = map.width, k = S / 46;
  const X = (x: number) => S / 2 + x * k, Z = (z: number) => S / 2 + z * k;
  g.clearRect(0, 0, S, S);
  g.beginPath();
  for (let i = 0; i <= 90; i++) {
    const a = (i / 90) * Math.PI * 2, r = islandRadius(a);
    g.lineTo(X(Math.cos(a) * r), Z(Math.sin(a) * r));
  }
  g.fillStyle = '#5cab47';
  g.fill();
  board.pathPoints.forEach((p, i) => {
    g.beginPath();
    g.arc(X(p.x), Z(p.z), i === board.pathPoints.length - 1 ? 7 : 4, 0, Math.PI * 2);
    g.fillStyle = i < state.lavaFront ? '#ff5a1f' : i === board.pathPoints.length - 1 ? '#2ba8e0' : '#ffffff';
    g.fill();
  });
  state.players.forEach((pl) => {
    const p = board.pathPoints[pl.pos];
    g.beginPath();
    g.arc(X(p.x), Z(p.z), 9, 0, Math.PI * 2);
    g.fillStyle = pl.color;
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = pl.id === state.current ? '#26212b' : '#ffffff';
    g.stroke();
  });
}

function describe(events: GameEvent[]): void {
  for (const e of events) {
    const n = (id: number) => state.players[id].name;
    if (e.type === 'answer') say(e.correct ? `${n(e.playerId)} answered right.` : `${n(e.playerId)} got it wrong.`);
    if (e.type === 'fuel') say(`${n(e.playerId)} found fuel (${e.fuel}/3).`);
    if (e.type === 'gainPower') say(`${n(e.playerId)} got a power.`);
    if (e.type === 'lava') say(`The lava moved. It covers ${e.front} pillars.`);
    if (e.type === 'lavaHit') say(`Lava caught ${n(e.playerId)}!`);
    if (e.type === 'board') say(`${n(e.playerId)} boarded a ship!`);
  }
}

async function showDice(v: number): Promise<void> {
  const d = document.createElement('div');
  d.className = 'dice';
  d.setAttribute('role', 'status');
  ui.appendChild(d);
  for (let i = 0; i < 7; i++) {
    d.textContent = String(1 + Math.floor(Math.random() * 6));
    await new Promise((r) => setTimeout(r, 60));
  }
  d.textContent = String(v);
  await new Promise((r) => setTimeout(r, 450));
  d.remove();
}

function autoAnswer(): GameEvent[] {
  const q = state.pending!.question;
  const right = Math.random() < 0.7;
  if (q.choices) return answer(state, right ? q.answerIndex! : (q.answerIndex! + 1) % q.choices.length);
  return answer(state, right ? q.answers![0] : 'nope');
}

async function takeTurn(): Promise<void> {
  if (busy || state.phase === 'over') return;
  busy = true;
  board.setOverview(false);
  viewBtn.setAttribute('aria-pressed', 'false');
  renderBar();
  const p = currentPlayer(state);
  board.follow(p.id);
  let events: GameEvent[] = [];
  if (isAtDock(p)) refuel(state);
  else {
    events = roll(state);
    const v = (events.find((e) => e.type === 'roll') as { value: number }).value;
    await showDice(v);
    await board.play(events);
  }
  if (state.phase === 'question') {
    await new Promise((r) => setTimeout(r, 400));
    events = autoAnswer();
    describe(events);
    await board.play(events);
  } else describe(events);
  busy = false;
  renderBar();
}

rollBtn.addEventListener('click', takeTurn);
viewBtn.addEventListener('click', () => {
  const on = !board.isOverview;
  board.setOverview(on);
  viewBtn.setAttribute('aria-pressed', String(on));
  viewBtn.textContent = on ? 'Follow player' : 'Whole island';
  if (!on) board.follow(currentPlayer(state).id);
});
board.onFrame = drawMap;
renderBar();
say('Tap Roll dice. Questions are answered automatically in this demo.');
