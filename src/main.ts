import { LEVELS, SCHOOL_LABEL, selectedBands, type Band, type SchoolLevel } from './rules/school';
import { openOnline } from './ui/online';
import { showFinale } from './ui/finale';
import { cue, score, sound, unlockAudio, pauseAudio, volumeControls } from './sound';
import './assets/fonts/lilita-one/400.css';
import './assets/fonts/atkinson-hyperlegible/400.css';
import './assets/fonts/atkinson-hyperlegible/700.css';
import './styles.css';

import { CREW, crewArt, crewIndex } from './ui/crew';
import Phaser from 'phaser';
import bank from './data/questions.json';
import BoardScene from './scenes/BoardScene';
import { TYPE_COLORS, VIEW } from './scenes/layout';
import {
  DIFFICULTY, Difficulty, POWER_LABEL, PowerKind, QuestionType, RULES, SUBJECT_LABEL, Subject, TYPE_LABEL,
} from './rules/config';
import {
  GameEvent, GameState, answer, createGame, currentPlayer, expireMatch, standings, roll, usePower,
} from './rules/game';
import type { Question } from './rules/questions';
import { avatar, diceIcon, esc, pauseIcon, powerIcon, typeIcon } from './ui/html';

// ---------- settings ----------

interface Settings {
  difficulty: Difficulty;
  subjects: Subject[];
  schoolLevel?: SchoolLevel;
  schoolLevels: Band[];
  qtypes: QuestionType[];
  timer: boolean;
  matchMinutes:number;
  weather:'auto'|'clear'|'dusk'|'rain'|'thunder';
  music:boolean;
  effects:boolean;
  players: { name: string; color: string }[];
}

const PLAYER_COLORS = CREW.map((member): string => member.color);

const QTYPES: QuestionType[] = ['mcq', 'fill', 'pattern', 'word'];
const STORE = 'shipahead.settings';
const INTRO_SEEN = 'shipahead.pixelVoyageSeen';

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
  subjects: ['math'], schoolLevels:['year13'],
  qtypes: [...QTYPES],
  timer: false, matchMinutes:10, weather:'auto', music:true,effects:true,
  players: [
    { name: '', color: PLAYER_COLORS[0] },
    { name: '', color: PLAYER_COLORS[1] },
  ],
});

let settings: Settings = { ...defaults(), ...(store<Settings>(STORE) ?? {}) };

settings.subjects=['math'];
settings.schoolLevels=selectedBands(store<Settings>(STORE)?.schoolLevels ?? settings.schoolLevel);
Object.assign(sound,{music:settings.music,effects:settings.effects});

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

const matchClock=document.createElement('div');
matchClock.className='match-clock'; matchClock.hidden=true;
stage.appendChild(matchClock);
const sky=document.createElement('div');
sky.className='weather-sky'; sky.hidden=true;
hud.before(sky);
let deadline=0, pausedAt=0, matchTick:number|undefined, finishReason='', beat=0, nextBeat=0, nextThunder=0;
let nextRain=0, nextRumble=0;
const weatherNames=['auto','clear','dusk','rain','thunder'] as const;
function environmentOptions():string {
  return `<label class="env-row">Island weather <select data-env="weather">${weatherNames.map(w=>`<option value="${w}" ${settings.weather===w?'selected':''}>${w==='auto'?'Changing weather':w==='dusk'?'Night':w==='thunder'?'Thunderstorm':w[0].toUpperCase()+w.slice(1)}</option>`).join('')}</select></label>
    <div class="env-audio"><label><input type="checkbox" data-env="music" ${settings.music?'checked':''}> Music</label><label><input type="checkbox" data-env="effects" ${settings.effects?'checked':''}> Sound effects</label></div>${volumeControls()}`;
}
stage.addEventListener('change',event=>{
  const input=event.target as HTMLInputElement;
  if(input.dataset.env==='weather')settings.weather=input.value as Settings['weather'];
  else if(input.dataset.env==='music'||input.dataset.env==='effects')settings[input.dataset.env]=input.checked;
  else if(input.dataset.env==='minutes')settings.matchMinutes=Number(input.value);
  else return;
  Object.assign(sound,{music:settings.music,effects:settings.effects});
  unlockAudio(); store(STORE,settings);
  if(paused && state)paintConditions(pausedAt);
});
function paintConditions(now:number){
  const seconds=Math.max(0,Math.ceil((deadline-now)/1000));
  const danger=!!settings.matchMinutes && seconds<=60;
  board.danger=danger;
  const elapsed=settings.matchMinutes ? settings.matchMinutes*60-seconds : (state!.round-1)*16;
  const cycle=(['clear','dusk','rain','thunder'] as const)[Math.floor(Math.max(0,elapsed)/48)%4];
  const weather=settings.weather==='auto'?(danger?'thunder':cycle):settings.weather;
  sky.dataset.sky=weather;
  sky.classList.toggle('danger',danger);
  matchClock.textContent=settings.matchMinutes?`${danger?'⚠ Eruption':'Eruption in'} ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'';
  matchClock.hidden=!settings.matchMinutes;
  matchClock.classList.toggle('urgent',danger);
  if(!paused && !document.hidden){
    if((weather==='rain'||weather==='thunder') && now>=nextRain){cue('rain');nextRain=now+1000;}
    if(now>=nextRumble){cue('rumble');nextRumble=now+(danger?5300:15000);}
    if(now>=nextBeat){score(beat++,danger);nextBeat=now+(danger?390:630);}
    if(weather==='thunder' && now>=nextThunder){
      cue('thunder');nextThunder=now+8500;
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches)
        sky.animate([{backgroundColor:'#a4bfd085'},{backgroundColor:'transparent'}],{duration:580});
    }
  }
}
function clearMatch(){
  clearInterval(matchTick); matchTick=undefined;matchClock.hidden=true;sky.hidden=true;
  if(board)board.danger=false;
}
function tickMatch(){
  if(!state || paused || state.phase==='over')return;
  const now=performance.now();
  paintConditions(now);
  if(settings.matchMinutes && now>=deadline){
    const events=expireMatch(state);
    finishReason='timeExpired'; stopTimer();clearMatch();
    // Let an in-flight hop finish before displaying replay controls.
    if(!busy)showGameOver(events);
  }
}

// ---------- intro ----------

const scenes = [
  { clip:'harbour', title:'At Coral Harbour,', line:'the ferry crew spots a dark tower across the water. The warning light on Volcanic Isle has gone out.', dialogue:'Captain: “Take this repair kit. Ships need that beacon to find their way past the rocks.”' },
  { clip:'trail', title:'On Volcanic Isle,', line:'the ferry lands at the island jetty. The navigator leads the way up the trail. The mechanic carries the kit.', dialogue:'Navigator: “See the tower above the palms? That’s where we’re headed.”' },
  { clip:'beacon', title:'At the summit,', line:'the mechanic opens the kit and fixes a loose wire. The beacon shines again. Then the ground shakes and ash rises from the crater.', dialogue:'Captain, over the radio: “Back to the jetty, crew! Two boats are waiting!”' },
];
let sceneTimers: number[] = [];
function showIntro(page = 0): void {
  sceneTimers.forEach(clearTimeout);
  sceneTimers = [];
  hud.hidden = true;
  const scene = scenes[page - 1];
  layer.innerHTML = `
    <section class="screen film pixel-film ${scene ? 'pixel-scene' : 'prologue'}" aria-label="Volcano Isle story">
      ${scene ? `<video class="pixel-window" muted playsinline preload="auto" poster="./story/${scene.clip}.png" src="./story/${scene.clip}.mp4" aria-label="${esc(scene.line)}"></video>` :
        '<div class="film-world pixel-title-art" aria-hidden="true"></div>'}
      <button class="intro-skip" data-act="skip">Skip story</button>
      <div class="film-copy">
        <h1 class="display">${scene?.title || 'The Beacon has gone dark…'}</h1>
        ${scene?`<p>${scene.line}</p><blockquote>${scene.dialogue}</blockquote>`:''}
        <button class="btn-primary" data-act="advance" data-autofocus>${page===0?'Begin story':page<scenes.length?'Continue':'Set up game'}</button>
      </div>
    </section>`;
  if(scene){
    const playCue=(delay:number,kind:Parameters<typeof cue>[0])=>{
      sceneTimers.push(window.setTimeout(()=>{if(!document.hidden)cue(kind);},delay));
    };
    const clip=layer.querySelector('video')!;
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      clip.onplaying=()=>{
        clip.onplaying=null;
        if(page===1)playCue(3800,'horn');
        if(page===3){playCue(3000,'beacon');playCue(4800,'thunder');}
      };
      void clip.play().catch(()=>{clip.controls=true;});
    }
  }
  layer.onclick=e=>{
    const act=(e.target as Element).closest('[data-act]')?.getAttribute('data-act');
    if(act==='skip'||(act==='advance'&&page===scenes.length)){
      sceneTimers.forEach(clearTimeout);sceneTimers=[];store(INTRO_SEEN,true);enterFromLink();
    }else if(act==='advance')showIntro(page+1);
  };
  focusFirst();
}

// ---------- setup ----------

function online(){
  if (location.protocol === 'file:') {
    layer.innerHTML = `<section class="screen setup"><h1>Play online</h1>
      <p>Online rooms need an internet connection.</p>
      <a class="btn-primary" href="https://ship-ahead-volcano-isle.expertmagpie5.chatgpt.site/?room=">Open online lobby</a>
      <button class="btn-secondary">Back to setup</button></section>`;
    layer.onclick = null;
    layer.querySelector('button')!.onclick = showSetup;
    hud.hidden = true;
    return;
  }
  openOnline({board,layer,hud,settings,dice:showDice,exit:showSetup,conditions:room=>{
    if (!room.game || room.game.phase==='over') { clearMatch(); return; }
    state=room.game;
    const remaining=room.deadline-room.serverNow;
    deadline=performance.now()+remaining;
    const local=settings;
    settings={...local,weather:room.settings.weather as Settings['weather'],matchMinutes:room.settings.matchMinutes};
    sky.hidden=false;
    paintConditions(performance.now());
    settings=local;
  }});
}
function enterFromLink(){
  if(new URLSearchParams(location.search).has('room'))online();else showSetup();
}
function showSetup(): void {
  window.ResultBanner?.setVisible(false);
  clearMatch();
  hud.hidden = true;
  stopTimer();
  const d = DIFFICULTY[settings.difficulty];
  const canStart = settings.subjects.length > 0 && settings.qtypes.length > 0;
  layer.innerHTML = `
    <section class="screen setup" aria-label="Set up your game">
      <header>
        <h1 class="display">Ship Ahead: Volcanic (Math)</h1>
        <button class="map-chip" data-act="story" aria-label="Replay the Volcano Isle story">
          <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true"><polygon points="0,12 5,2 9,2 14,12" fill="#FF8A3D"/></svg>
          Volcano Isle
        </button>
      </header>
      <button class="btn-secondary" data-act="online">Play online</button>
      <section>
        <h2>School levels</h2>
        <div class="chips">${([...LEVELS,'random'] as SchoolLevel[]).map(s=>`<button class="chip" data-act="school" data-v="${s}" aria-pressed="${(s==='random'?settings.schoolLevels.length===4:settings.schoolLevels.includes(s))}">${SCHOOL_LABEL[s]}</button>`).join('')}</div>
        <p class="hint">Choose one or more. Random includes all four levels.</p>
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
      <label class="env-row">Eruption clock <select data-env="minutes">${[0,5,10,15].map(n=>`<option value="${n}" ${settings.matchMinutes===n?'selected':''}>${n?n+' min':'Off'}</option>`).join('')}</select></label>
      ${environmentOptions()}
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
            <button class="avatar" style="background:${p.color}" data-act="color" data-i="${i}" aria-label="Change avatar for player ${i + 1}, currently ${CREW[crewIndex(p.color)].name}">${crewArt(crewIndex(p.color))}</button>
            <label class="sr-only" for="pname${i}">Player ${i + 1} name</label>
            <input id="pname${i}" data-act="name" data-i="${i}" maxlength="12" placeholder="Player ${i + 1}" value="${esc(p.name)}" autocomplete="off">
          </div>`).join('')}
        </div>
      </section>
      ${canStart ? '' : '<p class="hint" role="alert">Pick at least one question type.</p>'}
      <button class="btn-primary" data-act="start" ${canStart ? '' : 'disabled'}>Start game</button>
      <p class="legal"><a href="https://shipahead.ashmaz.app/policy/" target="_blank" rel="noopener">Privacy policy</a></p>
    </section>`;

  const save = () => store(STORE, settings);
  const toggle = <T>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  layer.onclick = (e) => {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!el) return;
    const v = el.dataset.v as string;
    const i = Number(el.dataset.i);
    switch (el.dataset.act) {
      case 'online': save(); return online();
      case 'story': return showIntro(0);
      case 'school': {
        if(v==='random')settings.schoolLevels=[...LEVELS];
        else if(LEVELS.includes(v as Band)){
          const next=toggle(settings.schoolLevels,v as Band);
          if(next.length)settings.schoolLevels=next;
        }
        break;
      }
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
        if (taken.length === PLAYER_COLORS.length) {
          const next = PLAYER_COLORS[(start + 1) % PLAYER_COLORS.length];
          const other = settings.players.find((player) => player.color === next)!;
          other.color = settings.players[i].color;
          settings.players[i].color = next;
        } else {
          for (let offset = 1; offset < PLAYER_COLORS.length; offset++) {
            const color = PLAYER_COLORS[(start + offset) % PLAYER_COLORS.length];
            if (taken.includes(color)) continue;
            settings.players[i].color = color;
            break;
          }
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

  const history=store<string[]>('shipahead.recentMath');
  if(Array.isArray(history))state.used=new Set(history.slice(-100));
  clearMatch();finishReason='';paused=false;pausedAt=0;
  unlockAudio();Object.assign(sound,{music:settings.music,effects:settings.effects});
  board.setup(state);
  deadline=performance.now()+settings.matchMinutes*60000;
  nextBeat=0;beat=0;nextThunder=performance.now()+3500;
  sky.hidden=false;
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
        ${avatar(p.color)}
        <div style="min-width:0">
          <strong>${esc(p.name)}'s turn</strong>
          <small>${p.points} point${p.points === 1 ? '' : 's'}${p.shield ? ', shield on' : ''}</small>
        </div>
      </div>
      <div class="top-right">
        <span class="round">Round ${s.round} · ${p.pos + 1}/${RULES.pathLength}</span>
        <button class="icon-btn" data-act="pause" aria-label="Pause game">${pauseIcon}</button>
      </div>
    </div>
    <div class="map-label"><strong>Volcano Isle</strong><small>${s.lavaFront ? `Lava covers ${s.lavaFront} pillars` : 'Lava starts moving in round ' + (RULES.lavaGraceRounds + 2)}</small></div>
    <button class="view-toggle" data-act="view">${board.overview ? "Follow player" : "Whole island"}</button><div class="ships-label"><span>✦ Power</span><span>⚓ Harbour</span></div>
    <div class="panel">
      <div class="powers">
        ${[0, 1].map((k) => {
          const pw = p.powers[k];
          if (!pw) return '<div class="power-empty">Empty power slot</div>';
          const blocked = !canAct || (pw === 'shield' && p.shield);
          return `<button class="power" data-act="power" data-v="${pw}" ${blocked ? 'disabled' : ''}>${powerIcon(pw)}<span><b>${POWER_LABEL[pw]}</b><small>${pw === 'shield' && p.shield ? 'Already on' : 'Use before rolling'}</small></span></button>`;
        }).join('')}
      </div>
      <button class="btn-primary" data-act="roll" ${canAct ? '' : 'disabled'}>${diceIcon} Roll dice</button>
      <div class="others">${others.map((o) => `
        <div class="other ${o.skipTurns ? 'skip' : ''}" title="${esc(o.name)}: ${o.points} points${o.skipTurns ? ', misses next turn' : ''}">
          ${avatar(o.color)}<b>${esc(o.name)}</b><span class="pts">${o.points}</span>
        </div>`).join('')}
      </div>
    </div>`;
}

hud.addEventListener('click', async (e) => {
  const el = (e.target as HTMLElement).closest('[data-act]') as HTMLButtonElement | null;
  if (!el || el.disabled || !state) return;
  const act = el.dataset.act;
  if (act === 'view') { board.toggleView(); renderHud(); return; }
  if (act === 'pause' && !busy) return showPause();
  if (busy || state.phase !== 'turn') return;
  if (act === 'roll') return doRoll();
  if (act === 'power') {
    const power = el.dataset.v as PowerKind;
    if (power === 'pushback') return pickPushTarget();
    tickMatch(); if(finishReason)return;
    const events=usePower(state,power);
    await runEvents(events);
    if(state.winnerId!==null)return showGameOver(events);
    if(events.some(e=>e.type==='board'))return showHandoff(events);
    if(finishReason)return showGameOver([]);
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
  tickMatch();if(finishReason)return;
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
  else if(events.some(e=>e.type==='board'))showHandoff(events);
}

function diceFace(n: number): string {
  const on: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  return Array.from({ length: 9 }, (_, i) => `<i class="${on[n].includes(i) ? 'on' : ''}"></i>`).join('');
}

async function showDice(value: number): Promise<void> {
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduced)cue('roll');
  const faces = ['rotateY(0deg)', 'rotateY(90deg)', 'rotateX(90deg)', 'rotateX(-90deg)', 'rotateY(-90deg)', 'rotateY(180deg)'];
  const angles = [[0,0], [0,-90], [-90,0], [90,0], [0,90], [0,180]];
  const [x,y] = angles[value - 1];
  const final = `rotateX(${x}deg) rotateY(${y}deg)`;
  layer.innerHTML = `<div class="scrim center" role="status"><div class="dice-wrap">
    <div class="die-stage" aria-hidden="true"><div class="die-throw"><div class="die-cube">
    ${faces.map((rotation, index) => `<div class="dice die-face" style="transform:${rotation} translateZ(39px)">${diceFace(index+1)}</div>`).join('')}
    </div></div></div><p></p></div></div>`;
  const cube = layer.querySelector<HTMLElement>('.die-cube')!;
  cube.style.transform = final;
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const toss = layer.querySelector('.die-throw')!.animate([
      {transform:'translate(-48px, 10px) scale(.8)'},
      {transform:'translate(-9px,-50px) scale(1.12)',offset:.36},
      {transform:'translate(12px,5px) scale(1,.94)',offset:.68},
      {transform:'translate(5px,-9px)',offset:.81},
      {transform:'translate(0,0)'}
    ], {duration:820,easing:'ease-out'});
    const spin = cube.animate([
      {transform:`rotateX(${x-270}deg) rotateY(${y-400}deg)`},
      {transform:`rotateX(${x+10}deg) rotateY(${y+13}deg)`,offset:.78},
      {transform:final}
    ], {duration:820,easing:'ease-out'});
    await Promise.all([toss.finished, spin.finished]);
  }
  cue('land');
  layer.querySelector('.dice-wrap p')!.textContent = `You rolled ${value}`;
  await new Promise(resolve => setTimeout(resolve, 540));
}

// ---------- questions ----------

function promptHtml(q: Question): string {
  return q.prompt.split('\n').map((line) => (/[؀-ۿ]/.test(line) ? `<span class="ar" lang="ar">${esc(line)}</span>` : esc(line))).join('\n');
}

function stakes(s: GameState): { win: string; lose: string } {
  const d = DIFFICULTY[s.setup.difficulty];
  const pending = s.pending!;
  const kind = pending.tile.kind;
  const extra = kind === 'power' ? ' and a power' : '';
  return {
    win: `+${d.points} point${d.points > 1 ? 's' : ''}${extra}`,
    lose: `Back ${d.back} pillar${d.back > 1 ? 's' : ''}`,
  };
}

function showQuestion(): void {
  store('shipahead.recentMath',[...state!.used].slice(-100));
  const s = state!;
  const p = currentPlayer(s);
  const q = s.pending!.question;
  const c = TYPE_COLORS[q.type].css;
  const seconds = DIFFICULTY[s.setup.difficulty].seconds;
  const st = stakes(s);
  const numeric = q.answers?.every((a) => /^-?\d+$/.test(a));
  const title = TYPE_LABEL[q.type];
  layer.innerHTML = `
    <div class="scrim" role="dialog" aria-modal="true" aria-labelledby="qprompt">
      <div class="sheet" style="--c:${c}">
        <div class="q-head">
          <div class="q-head-row">
            <div class="q-kind"><span class="swatch">${typeIcon(q.type, c, 14)}</span>
              <span><strong>${title}</strong><small>${q.band?SCHOOL_LABEL[q.band]:SUBJECT_LABEL[q.subject]}, ${s.setup.difficulty}</small></span>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              ${s.setup.timer ? `<div class="timer" role="timer" aria-label="${seconds} seconds left"><svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="24" fill="#26212B"/><circle cx="28" cy="28" r="24" fill="none" stroke="#4A4252" stroke-width="5"/><circle class="ring" cx="28" cy="28" r="24" fill="none" stroke="#FFC23D" stroke-width="5" stroke-linecap="round" stroke-dasharray="150.8" stroke-dashoffset="0"/></svg><span>${seconds}</span></div>` : ''}
              <button class="icon-btn" data-act="pause" aria-label="Pause game" style="background:#26212B;border-color:#26212B;color:#fff">${pauseIcon}</button>
            </div>
          </div>
          <div class="q-for">${avatar(p.color)}<span>${esc(p.name)}, answer to keep your place</span></div>
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
  tickMatch(); if(finishReason)return;
  const asked = s.pending!.question;
  const events = answer(s, response);
  const res = events.find((e) => e.type === 'answer') as Extract<GameEvent, { type: 'answer' }>;
  cue(res.correct?'right':'wrong');
  const lines: string[] = [];
  for (const e of events) {
    if(e.type==='board')lines.push('You made it aboard the rescue ferry!');
    if (e.type === 'points') lines.push(`+${e.amount} point${e.amount > 1 ? 's' : ''}.`);
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
    if(e.type==='board')notes.push(`${esc(name(e.playerId))} escaped on the first ferry. One place remains.`);
    if (e.type === 'lava') notes.push(`The lava moved. It now covers ${e.front} pillars.`);
    if (e.type === 'lavaHit') {
      notes.push(e.shielded
        ? `${esc(name(e.playerId))}'s lava shield held, and they stepped to safety.`
        : `Lava caught ${esc(name(e.playerId))}! They got away but miss their next turn.`);
    }
    if (e.type === 'skip') notes.push(`${esc(name(e.playerId))} is still shaking off the ash and misses this turn.`);
  }
  layer.innerHTML = `
    <div class="scrim center" role="dialog" aria-modal="true" aria-labelledby="turn-title">
      <div class="card">
        <div style="display:flex;align-items:center;gap:12px">${avatar(next.color)}<h2 id="turn-title">${first ? `${esc(next.name)} goes first` : `${esc(next.name)}'s turn`}</h2></div>
        ${notes.map((n) => `<p>${n}</p>`).join('')}
        <p>Pass the phone to ${esc(next.name)}.${first ? ' Reach the jetty to board a rescue boat.' : ''}</p>
        <button class="btn-primary" data-act="go" data-autofocus>Start turn</button>
      </div>
    </div>`;
  announce(`${next.name}'s turn. ${notes.join(' ').replace(/<[^>]+>/g, '')}`);
  layer.onclick = (e) => {
    if ((e.target as HTMLElement).closest('[data-act="go"]')) {
      layer.innerHTML = '';
      layer.onclick = null;
      if(first) {
        deadline=performance.now()+settings.matchMinutes*60000;
        tickMatch(); matchTick=window.setInterval(tickMatch,180);
      }
      board.focusPlayer(next.id);
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
        <div class="list">${targets.map((o) => `<button data-act="target" data-i="${o.id}">${avatar(o.color)}${esc(o.name)}<small>pillar ${o.pos + 1}</small></button>`).join('')}</div>
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
      if(finishReason)return showGameOver([]);
      announce(`${name(id)} was pushed back.`);
    }
  };
  focusFirst();
}

function showPause(): void {
  if(paused)return;
  pausedAt=performance.now();paused = true;pauseAudio(true);
  const wrap = document.createElement('div');
  wrap.className = 'scrim center';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-labelledby', 'pause-title');
  wrap.innerHTML = `
    <div class="card">
      <h2 id="pause-title">Game paused</h2>
      <p>Game and question timers are paused.</p>
      ${environmentOptions()}
      <button class="btn-primary" data-pause="resume">Resume</button>
      <button class="btn-secondary" data-pause="restart">Restart with same setup</button>
      <button class="btn-secondary" data-pause="setup">Change setup</button>
      <p class="legal"><a href="https://shipahead.ashmaz.app/policy/" target="_blank" rel="noopener">Privacy policy</a></p>
    </div>`;
  const prev = document.activeElement as HTMLElement | null;
  wrap.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('[data-pause]')?.getAttribute('data-pause');
    if (!act) return;
    e.stopPropagation();
    wrap.remove();
    deadline+=performance.now()-pausedAt;paused = false;pauseAudio(false);
    if (act === 'resume') prev?.focus();
    if (act === 'restart') { stopTimer(); startGame(); }
    if (act === 'setup') { stopTimer(); showSetup(); }
  });
  stage.appendChild(wrap);
  (wrap.querySelector('button') as HTMLElement).focus();
}

// ---------- game over ----------

function showGameOver(_events: GameEvent[]): void {
  const s = state!;
  stopTimer();
  hud.hidden = true;
  if (layer.querySelector('.finish-film, [aria-label="Final results"]')) return;
  clearMatch();
  showFinale(layer, standings(s), '<button class="btn-primary" data-act="again">Play again</button><button class="btn-secondary" data-act="setup">Change setup</button>');
  layer.onclick = (e) => {
    const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
    if (act === 'again') { window.ResultBanner?.setVisible(false); startGame(); }
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
    if (store<boolean>(INTRO_SEEN)) enterFromLink();
    else showIntro(0);
  });
}

boot();
