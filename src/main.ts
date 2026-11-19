import '@fontsource/lilita-one/400.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles.css';
import Phaser from 'phaser';
import bank from './data/questions.json';
import BoardScene from './scenes/BoardScene';
import { TYPE_COLORS, VIEW } from './scenes/layout';
import {
  DIFFICULTY, Difficulty, POWER_LABEL, PowerKind, QuestionType, RULES, SUBJECT_LABEL, Subject, TYPE_LABEL,
} from './rules/config';
import {
  GameEvent, GameState, Player, answer, createGame, currentPlayer, isAtDock, refuel, roll, usePower,
} from './rules/game';
import type { Question } from './rules/questions';
import { avatar, diceIcon, esc, fuelCans, introArt, overArt, pauseIcon, powerIcon, typeIcon } from './ui/html';

// ---------- settings ----------

interface Settings {
  difficulty: Difficulty;
  subjects: Subject[];
  qtypes: QuestionType[];
  timer: boolean;
  players: { name: string; color: string }[];
}

const PLAYER_COLORS = ['#2DD4BF', '#60A5FA', '#F472B6', '#A3E635', '#E2E8F0', '#FDBA74'];
const SUBJECTS: Subject[] = ['math', 'science', 'english', 'arabic'];
const QTYPES: QuestionType[] = ['mcq', 'fill', 'pattern', 'word'];
const STORE = 'shipahead.settings';
const INTRO_SEEN = 'shipahead.introSeen';

function store<T>(key: string, value?: T): T | null {
  try {
    if (value !== undefined) localStorage.setItem(key, JSON.stringify(value));
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const defaults = (): Settings => ({
  difficulty: 'easy',
  subjects: ['math', 'science', 'english'],
  qtypes: [...QTYPES],
  timer: false,
  players: [
    { name: '', color: PLAYER_COLORS[0] },
    { name: '', color: PLAYER_COLORS[1] },
  ],
});

let settings: Settings = { ...defaults(), ...(store<Settings>(STORE) ?? {}) };

// ---------- app shell ----------

const stage = document.getElementById('stage')!;
const hud = document.getElementById('hud')!;
const layer = document.getElementById('layer')!;
const live = document.getElementById('live')!;

function fit(): void {
  const k = Math.min(window.innerWidth / VIEW.w, window.innerHeight / VIEW.h);
  stage.style.transform = `translate(-50%, -50%) scale(${k})`;
}
window.addEventListener('resize', fit);
fit();

const announce = (msg: string) => { live.textContent = msg; };
const focusFirst = (sel = '[data-autofocus], button') => (layer.querySelector(sel) as HTMLElement | null)?.focus();

let board: BoardScene;
let state: GameState | null = null;
let busy = false;
let paused = false;
let timer: number | undefined;

// ---------- intro ----------

const STORY = [
  { h: 'The mountain woke up at dawn.', p: 'Ash is falling on the village. Two ships wait at the harbour, and they will sail before the lava reaches the shore.' },
  { h: 'The ships need fuel.', p: 'Each traveller must bring 3 cans of fuel to get aboard. The cans sit on white pillars along the path, and only a right answer unlocks one.' },
  { h: 'Race to the harbour.', p: 'Roll the dice and answer questions to hold your ground. Star pillars give powers. The first traveller aboard with 3 fuel cans wins.' },
];

function showIntro(i = 0): void {
  hud.hidden = true;
  const part = STORY[i];
  layer.innerHTML = `
    <section class="screen" aria-label="Volcano Isle story">
      <div class="intro-art">${introArt}
        <button class="intro-skip" data-act="skip">Skip story</button>
      </div>
      <div class="intro-copy">
        <span class="part">Volcano Isle, part ${i + 1} of ${STORY.length}</span>
        <h1 class="display">${part.h}</h1>
        <p>${part.p}</p>
        <div class="intro-foot">
          <div class="dots" aria-hidden="true">${STORY.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div>
          <button class="btn-primary" data-act="next" data-autofocus>${i === STORY.length - 1 ? 'Set up game' : 'Next'}</button>
        </div>
      </div>
    </section>`;
  layer.onclick = (e) => {
    const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
    if (act === 'skip' || (act === 'next' && i === STORY.length - 1)) {
      store(INTRO_SEEN, true);
      showSetup();
    } else if (act === 'next') showIntro(i + 1);
  };
  focusFirst();
}

// ---------- setup ----------

function showSetup(): void {
  hud.hidden = true;
  stopTimer();
  const d = DIFFICULTY[settings.difficulty];
  const canStart = settings.subjects.length > 0 && settings.qtypes.length > 0;
  layer.innerHTML = `
    <section class="screen setup" aria-label="Set up your game">
      <header>
        <h1 class="display">Set up your game</h1>
        <button class="map-chip" data-act="story" aria-label="Replay the Volcano Isle story">
          <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true"><polygon points="0,12 5,2 9,2 14,12" fill="#FF8A3D"/></svg>
          Volcano Isle
        </button>
      </header>
      <section>
        <h2>Subjects</h2>
        <div class="chips">${SUBJECTS.map((s) => `<button class="chip" data-act="subject" data-v="${s}" aria-pressed="${settings.subjects.includes(s)}">${SUBJECT_LABEL[s]}</button>`).join('')}</div>
      </section>
      <section>
        <h2>Question pillars on the board</h2>
        <div class="types">${QTYPES.map((t) => `<button class="type-btn" style="--c:${TYPE_COLORS[t].css}" data-act="qtype" data-v="${t}" aria-pressed="${settings.qtypes.includes(t)}"><span class="swatch">${typeIcon(t)}</span>${TYPE_LABEL[t]}</button>`).join('')}</div>
      </section>
      <section>
        <h2>Difficulty</h2>
        <div class="segmented">${(['easy', 'medium', 'hard'] as Difficulty[]).map((x) => `<button data-act="difficulty" data-v="${x}" aria-pressed="${settings.difficulty === x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div>
        <p class="hint">Right answer: ${d.points} point${d.points > 1 ? 's' : ''}. Wrong answer: back ${d.back} pillar${d.back > 1 ? 's' : ''}.</p>
      </section>
      <label class="toggle-row">
        <span><strong>Question timer</strong><small>${d.seconds} seconds per question on ${settings.difficulty}</small></span>
        <span class="switch"><input type="checkbox" data-act="timer" ${settings.timer ? 'checked' : ''}><span class="track"></span><span class="thumb"></span></span>
      </label>
      <section>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <h2>Players</h2>
          <div class="stepper">
            <button class="icon-btn" data-act="fewer" aria-label="Remove a player" ${settings.players.length <= RULES.minPlayers ? 'disabled' : ''}>−</button>
            <output aria-live="polite">${settings.players.length}</output>
            <button class="icon-btn" data-act="more" aria-label="Add a player" ${settings.players.length >= RULES.maxPlayers ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <div class="players">${settings.players.map((p, i) => `
          <div class="player-row">
            <button class="avatar" style="background:${p.color}" data-act="color" data-i="${i}" aria-label="Change colour for player ${i + 1}">${esc((p.name || `P${i + 1}`).slice(0, 1).toUpperCase())}</button>
            <label class="sr-only" for="pname${i}">Player ${i + 1} name</label>
            <input id="pname${i}" data-act="name" data-i="${i}" maxlength="12" placeholder="Player ${i + 1}" value="${esc(p.name)}" autocomplete="off">
          </div>`).join('')}
        </div>
      </section>
      ${canStart ? '' : '<p class="hint" role="alert">Pick at least one subject and one question type.</p>'}
      <button class="btn-primary" data-act="start" ${canStart ? '' : 'disabled'}>Start game</button>
    </section>`;

  const save = () => store(STORE, settings);
  const toggle = <T>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  layer.onclick = (e) => {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!el) return;
    const v = el.dataset.v as string;
    const i = Number(el.dataset.i);
    switch (el.dataset.act) {
      case 'story': return showIntro(0);
      case 'subject': settings.subjects = toggle(settings.subjects, v as Subject); break;
      case 'qtype': settings.qtypes = toggle(settings.qtypes, v as QuestionType); break;
      case 'difficulty': settings.difficulty = v as Difficulty; break;
      case 'fewer': settings.players.pop(); break;
      case 'more': {
        const free = PLAYER_COLORS.find((c) => !settings.players.some((p) => p.color === c))!;
        settings.players.push({ name: '', color: free });
        break;
      }
      case 'color': {
        const taken = settings.players.map((p) => p.color);
        const start = PLAYER_COLORS.indexOf(settings.players[i].color);
        for (let k = 1; k <= PLAYER_COLORS.length; k++) {
          const c = PLAYER_COLORS[(start + k) % PLAYER_COLORS.length];
          if (!taken.includes(c)) { settings.players[i].color = c; break; }
        }
        break;
      }
      case 'start': save(); return startGame();
      default: return;
    }
    save();
    const focusKey = `[data-act="${el.dataset.act}"]${v ? `[data-v="${v}"]` : ''}${el.dataset.i ? `[data-i="${i}"]` : ''}`;
    showSetup();
    (layer.querySelector(focusKey) as HTMLElement | null)?.focus();
  };
  layer.oninput = (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.act === 'name') {
      settings.players[Number(el.dataset.i)].name = el.value;
      save();
    }
  };
  layer.onchange = (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.act === 'timer') { settings.timer = el.checked; save(); }
  };
}

// ---------- game ----------

function startGame(): void {
  const players = settings.players.map((p, i) => ({ name: p.name.trim() || `Player ${i + 1}`, color: p.color }));
  state = createGame({ ...settings, players, seed: Date.now() }, bank as Question[]);
  board.setup(state);
  layer.innerHTML = '';
  hud.hidden = false;
  busy = false;
  renderHud();
  showHandoff([], true);
}

const name = (id: number) => state!.players[id].name;

function renderHud(): void {
  const s = state!;
  const p = currentPlayer(s);
  const canAct = !busy && s.phase === 'turn';
  const others = s.players.filter((x) => x.id !== p.id);
  hud.innerHTML = `
    <div class="topbar">
      <div class="who">
        ${avatar(p.name, p.color)}
        <div style="min-width:0">
          <strong>${esc(p.name)}'s turn</strong>
          <small>${p.points} point${p.points === 1 ? '' : 's'}, fuel ${fuelCans(p.fuel)}${p.shield ? ', shield on' : ''}</small>
        </div>
      </div>
      <div class="top-right">
        <span class="round">Round ${s.round}</span>
        <button class="icon-btn" data-act="pause" aria-label="Pause game">${pauseIcon}</button>
      </div>
    </div>
    <div class="map-label"><strong>Volcano Isle</strong><small>${s.lavaFront ? `Lava covers ${s.lavaFront} pillars` : 'Lava starts moving in round ' + (RULES.lavaGraceRounds + 2)}</small></div>
    <div class="ships-label">2 ships waiting</div>
    <div class="panel">
      <div class="powers">
        ${[0, 1].map((k) => {
          const pw = p.powers[k];
          if (!pw) return '<div class="power-empty">Empty power slot</div>';
          const blocked = !canAct || (pw === 'shield' && p.shield);
          return `<button class="power" data-act="power" data-v="${pw}" ${blocked ? 'disabled' : ''}>${powerIcon(pw)}<span><b>${POWER_LABEL[pw]}</b><small>${pw === 'shield' && p.shield ? 'Already on' : 'Use before rolling'}</small></span></button>`;
        }).join('')}
      </div>
      ${isAtDock(p)
        ? `<button class="btn-primary" data-act="refuel" ${canAct ? '' : 'disabled'}>Answer to refuel</button>`
        : `<button class="btn-primary" data-act="roll" ${canAct ? '' : 'disabled'}>${diceIcon} Roll dice</button>`}
      <div class="others">${others.map((o) => `
        <div class="other ${o.skipTurns ? 'skip' : ''}" title="${esc(o.name)}: ${o.points} points, ${o.fuel} fuel${o.skipTurns ? ', misses next turn' : ''}">
          ${avatar(o.name, o.color)}<b>${esc(o.name)}</b>${fuelCans(o.fuel)}<span class="pts">${o.points}</span>
        </div>`).join('')}
      </div>
    </div>`;
}

hud.addEventListener('click', async (e) => {
  const el = (e.target as HTMLElement).closest('[data-act]') as HTMLButtonElement | null;
  if (!el || el.disabled || !state) return;
  const act = el.dataset.act;
  if (act === 'pause') return showPause();
  if (busy || state.phase !== 'turn') return;
  if (act === 'roll') return doRoll();
  if (act === 'refuel') { refuel(state); renderHud(); return showQuestion(); }
  if (act === 'power') {
    const power = el.dataset.v as PowerKind;
    if (power === 'pushback') return pickPushTarget();
    await runEvents(usePower(state, power));
    announce(power === 'jump' ? `${currentPlayer(state).name} jumped ahead.` : 'Lava shield is on.');
  }
});

async function runEvents(events: GameEvent[]): Promise<void> {
  busy = true;
  renderHud();
  await board.play(events);
  busy = false;
  renderHud();
}

async function doRoll(): Promise<void> {
  const s = state!;
  busy = true;
  renderHud();
  const events = roll(s);
  const value = (events.find((e) => e.type === 'roll') as { value: number }).value;
  await showDice(value);
  layer.innerHTML = '';
  await board.play(events);
  busy = false;
  renderHud();
  if (s.phase === 'over') return showGameOver(events);
  if (s.phase === 'question') showQuestion();
}

function diceFace(n: number): string {
  const on: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  return Array.from({ length: 9 }, (_, i) => `<i class="${on[n].includes(i) ? 'on' : ''}"></i>`).join('');
}

function showDice(value: number): Promise<void> {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  layer.innerHTML = `<div class="scrim center" role="status"><div class="dice-wrap"><div class="dice">${diceFace(1)}</div><p aria-live="assertive"></p></div></div>`;
  const dice = layer.querySelector('.dice')!;
  const label = layer.querySelector('.dice-wrap p')!;
  return new Promise((resolve) => {
    let ticks = reduce ? 0 : 8;
    const spin = () => {
      if (ticks-- > 0) {
        dice.innerHTML = diceFace(1 + Math.floor(Math.random() * 6));
        setTimeout(spin, 70);
        return;
      }
      dice.innerHTML = diceFace(value);
      label.textContent = `You rolled ${value}`;
      setTimeout(resolve, reduce ? 500 : 700);
    };
    spin();
  });
}

// ---------- questions ----------

function promptHtml(q: Question): string {
  return q.prompt.split('\n').map((line) => (/[؀-ۿ]/.test(line) ? `<span class="ar" lang="ar">${esc(line)}</span>` : esc(line))).join('\n');
}

function stakes(s: GameState): { win: string; lose: string } {
  const d = DIFFICULTY[s.setup.difficulty];
  const pending = s.pending!;
  const kind = pending.reason === 'refuel' ? 'fuel' : pending.tile.kind;
  const extra = kind === 'fuel' ? ' and 1 fuel can' : kind === 'power' ? ' and a power' : '';
  return {
    win: `+${d.points} point${d.points > 1 ? 's' : ''}${extra}`,
    lose: pending.reason === 'refuel' ? 'No fuel this turn' : `Back ${d.back} pillar${d.back > 1 ? 's' : ''}`,
  };
}

function showQuestion(): void {
  const s = state!;
  const p = currentPlayer(s);
  const q = s.pending!.question;
  const c = TYPE_COLORS[q.type].css;
  const seconds = DIFFICULTY[s.setup.difficulty].seconds;
  const st = stakes(s);
  const numeric = q.answers?.every((a) => /^-?\d+$/.test(a));
  const title = s.pending!.reason === 'refuel' ? 'Refuel question' : TYPE_LABEL[q.type];
  layer.innerHTML = `
    <div class="scrim" role="dialog" aria-modal="true" aria-labelledby="qprompt">
      <div class="sheet" style="--c:${c}">
        <div class="q-head">
          <div class="q-head-row">
            <div class="q-kind"><span class="swatch">${typeIcon(q.type, c, 14)}</span>
              <span><strong>${title}</strong><small>${SUBJECT_LABEL[q.subject]}, ${s.setup.difficulty}</small></span>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              ${s.setup.timer ? `<div class="timer" role="timer" aria-label="${seconds} seconds left"><svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="24" fill="#26212B"/><circle cx="28" cy="28" r="24" fill="none" stroke="#4A4252" stroke-width="5"/><circle class="ring" cx="28" cy="28" r="24" fill="none" stroke="#FFC23D" stroke-width="5" stroke-linecap="round" stroke-dasharray="150.8" stroke-dashoffset="0"/></svg><span>${seconds}</span></div>` : ''}
              <button class="icon-btn" data-act="pause" aria-label="Pause game" style="background:#26212B;border-color:#26212B;color:#fff">${pauseIcon}</button>
            </div>
          </div>
          <div class="q-for">${avatar(p.name, p.color)}<span>${esc(p.name)}, ${s.pending!.reason === 'refuel' ? 'answer to earn fuel' : 'answer to keep your place'}</span></div>
        </div>
        <div class="q-body">
          <h2 class="q-prompt" id="qprompt">${promptHtml(q)}</h2>
          ${q.choices
            ? `<div class="choices">${q.choices.map((ch, i) => `<button class="choice" data-act="choose" data-i="${i}"><span class="letter" aria-hidden="true">${'ABCD'[i]}</span><b>${esc(ch)}</b></button>`).join('')}</div>`
            : `<form class="typed" data-act="typed"><label class="sr-only" for="ans">Your answer</label><input id="ans" ${numeric ? 'inputmode="numeric" pattern="-?[0-9]*"' : ''} autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type your answer" data-autofocus><button class="btn-primary" type="submit">Check answer</button></form>`}
          <div class="stakes"><div><b>Right:</b>&nbsp;${st.win}</div><div><b>Wrong:</b>&nbsp;${st.lose}</div></div>
        </div>
      </div>
    </div>`;
  layer.onclick = (e) => {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!el) return;
    if (el.dataset.act === 'pause') return showPause();
    if (el.dataset.act === 'choose') submit(Number(el.dataset.i));
  };
  layer.onsubmit = (e) => {
    e.preventDefault();
    const v = (layer.querySelector('#ans') as HTMLInputElement).value;
    if (v.trim()) submit(v);
  };
  layer.oninput = null;
  layer.onchange = null;
  focusFirst(q.choices ? '.choice' : '#ans');
  if (s.setup.timer) startTimer(seconds);
}

function startTimer(total: number): void {
  stopTimer();
  let left = total;
  timer = window.setInterval(() => {
    if (paused) return;
    left -= 1;
    const ring = layer.querySelector('.ring') as SVGCircleElement | null;
    const label = layer.querySelector('.timer span');
    const box = layer.querySelector('.timer');
    ring?.setAttribute('stroke-dashoffset', String(150.8 * (1 - left / total)));
    if (label) label.textContent = String(Math.max(0, left));
    box?.setAttribute('aria-label', `${left} seconds left`);
    if (left === 5) announce('5 seconds left');
    if (left <= 0) submit(null);
  }, 1000);
}

function stopTimer(): void {
  if (timer !== undefined) window.clearInterval(timer);
  timer = undefined;
}

function submit(response: string | number | null): void {
  const s = state!;
  if (s.phase !== 'question') return;
  stopTimer();
  const p = currentPlayer(s);
  const asked = s.pending!.question;
  const events = answer(s, response);
  const res = events.find((e) => e.type === 'answer') as Extract<GameEvent, { type: 'answer' }>;
  const lines: string[] = [];
  for (const e of events) {
    if (e.type === 'points') lines.push(`+${e.amount} point${e.amount > 1 ? 's' : ''}.`);
    if (e.type === 'fuel') lines.push(`Fuel can collected: ${e.fuel} of ${RULES.fuelNeeded}.`);
    if (e.type === 'gainPower') lines.push(`New power: ${POWER_LABEL[e.power]}.`);
    if (e.type === 'powerSlotsFull') lines.push('Your power slots are full, so no new power.');
    if (e.type === 'move' && e.playerId === p.id) lines.push(`Back ${e.from - e.to} pillar${e.from - e.to > 1 ? 's' : ''}.`);
  }
  if (!res.correct && response === null) lines.unshift('Time is up.');
  const heading = res.correct ? 'Right!' : 'Not quite.';
  const answerLine = res.correct ? '' : `<p>The answer is <b>${esc(res.answer)}</b>.</p>`;
  const body = layer.querySelector('.q-body')!;
  body.innerHTML = `
    <h2 class="q-prompt">${promptHtml(asked)}</h2>
    <div class="result ${res.correct ? 'good' : 'bad'}" role="status">
      <strong>${heading}</strong>${answerLine}
      ${lines.length ? `<p>${lines.join(' ')}</p>` : ''}
    </div>
    <button class="btn-primary" data-act="continue" data-autofocus>Continue</button>`;
  announce(`${heading} ${res.correct ? '' : `The answer is ${res.answer}.`} ${lines.join(' ')}`);
  layer.onclick = async (e) => {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (el?.dataset.act === 'pause') return showPause();
    if (el?.dataset.act !== 'continue') return;
    layer.onclick = null;
    layer.innerHTML = '';
    await runEvents(events);
    if (s.phase === 'over') return showGameOver(events);
    showHandoff(events);
  };
  focusFirst();
}

// ---------- turn handoff, powers, pause ----------

function showHandoff(events: GameEvent[], first = false): void {
  const s = state!;
  const next = currentPlayer(s);
  const notes: string[] = [];
  for (const e of events) {
    if (e.type === 'lava') notes.push(`The lava moved. It now covers ${e.front} pillars.`);
    if (e.type === 'lavaHit') {
      notes.push(e.shielded
        ? `${esc(name(e.playerId))}'s lava shield held, and they stepped to safety.`
        : `Lava caught ${esc(name(e.playerId))}! They got away but miss their next turn.`);
    }
    if (e.type === 'skip') notes.push(`${esc(name(e.playerId))} is still shaking off the ash and misses this turn.`);
  }
  const atDock = isAtDock(next);
  layer.innerHTML = `
    <div class="scrim center" role="dialog" aria-modal="true" aria-labelledby="turn-title">
      <div class="card">
        <div style="display:flex;align-items:center;gap:12px">${avatar(next.name, next.color)}<h2 id="turn-title">${first ? `${esc(next.name)} goes first` : `${esc(next.name)}'s turn`}</h2></div>
        ${notes.map((n) => `<p>${n}</p>`).join('')}
        <p>${first ? `Pass the phone to ${esc(next.name)}. Reach the harbour with ${RULES.fuelNeeded} fuel cans to board a ship.` : atDock ? `${esc(next.name)} is waiting at the harbour with ${next.fuel} of ${RULES.fuelNeeded} fuel cans. Answer right to refuel.` : `Pass the phone to ${esc(next.name)}.`}</p>
        <button class="btn-primary" data-act="go" data-autofocus>Start turn</button>
      </div>
    </div>`;
  announce(`${next.name}'s turn. ${notes.join(' ').replace(/<[^>]+>/g, '')}`);
  layer.onclick = (e) => {
    if ((e.target as HTMLElement).closest('[data-act="go"]')) {
      layer.innerHTML = '';
      layer.onclick = null;
      renderHud();
      (hud.querySelector('.btn-primary') as HTMLElement | null)?.focus();
    }
  };
  focusFirst();
}

function pickPushTarget(): void {
  const s = state!;
  const targets = s.players.filter((o) => o.id !== s.current && !o.boarded);
  layer.innerHTML = `
    <div class="scrim center" role="dialog" aria-modal="true" aria-labelledby="push-title">
      <div class="card">
        <h2 id="push-title">Push who back?</h2>
        <p>They move back ${RULES.pushbackDistance} pillars, but never into lava.</p>
        <div class="list">${targets.map((o) => `<button data-act="target" data-i="${o.id}">${avatar(o.name, o.color)}${esc(o.name)}<small>pillar ${o.pos + 1}</small></button>`).join('')}</div>
        <button class="btn-secondary" data-act="cancel">Keep the power</button>
      </div>
    </div>`;
  layer.onclick = async (e) => {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!el) return;
    layer.innerHTML = '';
    layer.onclick = null;
    if (el.dataset.act === 'target') {
      const id = Number(el.dataset.i);
      await runEvents(usePower(s, 'pushback', id));
      announce(`${name(id)} was pushed back.`);
    }
  };
  focusFirst();
}

function showPause(): void {
  paused = true;
  const wrap = document.createElement('div');
  wrap.className = 'scrim center';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-labelledby', 'pause-title');
  wrap.innerHTML = `
    <div class="card">
      <h2 id="pause-title">Game paused</h2>
      <p>The timer is stopped. Nothing moves until you come back.</p>
      <button class="btn-primary" data-pause="resume">Resume</button>
      <button class="btn-secondary" data-pause="restart">Restart with same setup</button>
      <button class="btn-secondary" data-pause="setup">Change setup</button>
    </div>`;
  const prev = document.activeElement as HTMLElement | null;
  wrap.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('[data-pause]')?.getAttribute('data-pause');
    if (!act) return;
    e.stopPropagation();
    wrap.remove();
    paused = false;
    if (act === 'resume') prev?.focus();
    if (act === 'restart') { stopTimer(); startGame(); }
    if (act === 'setup') { stopTimer(); showSetup(); }
  });
  stage.appendChild(wrap);
  (wrap.querySelector('button') as HTMLElement).focus();
}

// ---------- game over ----------

function showGameOver(events: GameEvent[]): void {
  const s = state!;
  stopTimer();
  hud.hidden = true;
  const over = events.find((e) => e.type === 'gameOver') as Extract<GameEvent, { type: 'gameOver' }>;
  const w = s.players[s.winnerId!];
  const order = [...s.players].sort((a: Player, b: Player) => Number(b.boarded) - Number(a.boarded) || b.points - a.points);
  const boarded = over?.reason === 'boarded';
  layer.innerHTML = `
    <section class="screen" aria-labelledby="over-title">
      <div class="over-art">${overArt}<span class="avatar" style="position:absolute;left:206px;top:186px;width:48px;height:48px;font-size:22px;border-width:4px;background:${w.color}" aria-hidden="true">${esc(w.name.slice(0, 1).toUpperCase())}</span></div>
      <div class="over-copy">
        <h1 class="display" id="over-title">${boarded ? `${esc(w.name)} made it aboard!` : 'The lava reached the harbour.'}</h1>
        <p>${boarded ? `First to the harbour with ${RULES.fuelNeeded} fuel cans, in round ${s.round}.` : `The ships sailed without anyone. ${esc(w.name)} scored the most points.`}</p>
      </div>
      <ol class="standings" aria-label="Final standings">${order.map((o, i) => `
        <li class="${i === 0 ? 'first' : ''}"><span class="rank">${i + 1}</span>${avatar(o.name, o.color)}<b>${esc(o.name)}</b>${fuelCans(o.fuel)}<span class="pts">${o.points} point${o.points === 1 ? '' : 's'}</span></li>`).join('')}
      </ol>
      <div class="over-foot">
        <button class="btn-primary" data-act="again" data-autofocus>Play again</button>
        <button class="btn-secondary" data-act="setup">Change setup</button>
      </div>
    </section>`;
  announce(boarded ? `${w.name} made it aboard and wins!` : `The lava reached the harbour. ${w.name} wins on points.`);
  layer.onclick = (e) => {
    const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
    if (act === 'again') startGame();
    if (act === 'setup') showSetup();
  };
  focusFirst();
}

// ---------- boot ----------

async function boot(): Promise<void> {
  await Promise.all([
    document.fonts.load('400 16px "Lilita One"'),
    document.fonts.load('400 16px "Atkinson Hyperlegible"'),
  ]).catch(() => undefined);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: VIEW.w * 2,
    height: VIEW.h * 2,
    backgroundColor: '#26212B',
    scale: { mode: Phaser.Scale.NONE },
    scene: [BoardScene],
    banner: false,
  });
  // Exposed for console debugging and the headless smoke test.
  Object.assign(window, { game, ship: { get state() { return state; }, render: () => state && renderHud() } });
  game.events.once('board-ready', () => {
    board = game.scene.getScene('board') as BoardScene;
    if (store<boolean>(INTRO_SEEN)) showSetup();
    else showIntro(0);
  });
}

boot();
