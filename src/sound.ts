import themeUrl from './assets/beacon-theme.mp3';

let ctx: AudioContext | undefined;
export const sound = { music: true, effects: true };
const theme = new Audio(themeUrl);
theme.loop = true;
theme.volume = .18;
type Channel = 'music' | 'effects';
const volumes = { music: .18, effects: .85 };
try {
  for (const key of ['music','effects'] as const) {
    const saved = localStorage.getItem('shipahead.volume.'+key);
    if (saved !== null && Number.isFinite(Number(saved))) volumes[key]=Math.max(0,Math.min(1,Number(saved)));
  }
} catch { /* Use defaults when storage is unavailable. */ }
let musicBus:GainNode | undefined, effectsBus:GainNode | undefined;
let mediaConnected=false;
function mix(){
  if(ctx && musicBus && effectsBus){
    musicBus.gain.setTargetAtTime(sound.music?volumes.music:0,ctx.currentTime,.015);
    effectsBus.gain.setTargetAtTime(sound.effects?volumes.effects:0,ctx.currentTime,.015);
  }
  theme.volume=mediaConnected?1:volumes.music;
}
export function volumeControls(){
  return (['music','effects'] as const).map(key=>{
    const value=Math.round(100*volumes[key]);
    return `<label class="mix-row">${key==='music'?'Music volume':'Effects volume'} <output>${value}%</output><input aria-label="${key} volume" type="range" min="0" max="100" value="${value}" data-volume="${key}"></label>`;
  }).join('');
}
document.addEventListener('input',event=>{
  const el=event.target;
  if(!(el instanceof HTMLInputElement))return;
  const key=el.dataset.volume;
  if(key!=='music' && key!=='effects')return;
  volumes[key]=el.valueAsNumber/100;
  try{localStorage.setItem('shipahead.volume.'+key,String(volumes[key]));}catch{}
  const output=el.parentElement?.querySelector('output');
  if(output)output.textContent=el.value+'%';
  unlockAudio();
});
let activated = false;
let paused = false;

export function syncMusic() {
  mix();
  if (!activated || paused || document.hidden || !sound.music) theme.pause();
  else if (theme.paused) void theme.play().catch(() => {});
}
export function pauseAudio(value: boolean) {
  paused = value;
  syncMusic();
}
export function unlockAudio() {
  activated = true;
  try {
    const session = (navigator as Navigator & {audioSession?: {type:string}}).audioSession;
    if (session) session.type = 'playback';
    ctx ??= new AudioContext();
    if(!musicBus){
      musicBus=ctx.createGain();effectsBus=ctx.createGain();
      musicBus.connect(ctx.destination);effectsBus.connect(ctx.destination);
      ctx.createMediaElementSource(theme).connect(musicBus);mediaConnected=true;
    }
    if (ctx.state !== 'running') void ctx.resume().catch(()=>{});
  } catch { /* The recorded soundtrack uses a separate media element. */ }
  syncMusic();
}
document.addEventListener('click',e=>{
  unlockAudio();
  if(e.target instanceof Element && e.target.closest('button:not(:disabled)'))cue('click');
},{capture:true});
document.addEventListener('visibilitychange', syncMusic);

function note(hz:number, length:number, gain:number, type:OscillatorType='sine', delay=0, endHz=hz,channel:Channel='effects') {
  if (!ctx || ctx.state !== 'running') return;
  const start=ctx.currentTime+delay, osc=ctx.createOscillator(), amp=ctx.createGain();
  osc.type=type; osc.frequency.setValueAtTime(hz,start); osc.frequency.exponentialRampToValueAtTime(endHz,start+length);
  amp.gain.setValueAtTime(.0001,start); amp.gain.exponentialRampToValueAtTime(gain,start+.015);
  amp.gain.exponentialRampToValueAtTime(.0001,start+length);
  osc.connect(amp).connect((channel==='music'?musicBus:effectsBus)??ctx.destination); osc.start(start); osc.stop(start+length);
}
export function cue(kind:'roll'|'step'|'right'|'wrong'|'thunder'|'escape'|'eruption'|'horn'|'beacon'|'click'|'rain'|'rumble'|'land') {
  if(!sound.effects)return;
  if(kind==='horn'){note(220,.86,.13,'triangle',0,205);note(330,.8,.07,'sine',.04,307);}
  if(kind==='beacon'){note(660,.21,.11,'sine');note(880,.34,.10,'sine',.27);}
  if(kind==='click')note(890,.064,.10,'triangle',0,540);
  if(kind==='roll')for(const [i,t] of [0,.045,.105,.19,.30,.45,.63].entries()){
    note(1250-i*85,.035,.16-i*.012,'triangle',t,340);
    note(290-i*11,.046,.14,'sine',t,115);
  }
  if(kind==='land'){note(420,.095,.19,'triangle',0,100);note(900,.046,.09,'triangle',.025,380);}
  if(kind==='step')note(320,.16,.15,'triangle',0,700);
  if(kind==='right'||kind==='escape'){[392,494,587].forEach((f,i)=>note(f,.31,.07,'sine',i*.1));}
  if(kind==='wrong')note(230,.3,.06,'triangle',0,145);
  if(kind==='eruption'||kind==='thunder'||kind==='rain'||kind==='rumble'){
    if(!ctx || ctx.state!=='running')return;
    const duration=kind==='rain'?1.2:kind==='eruption'?2.1:1.25;
    const noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate);
    const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    const source=ctx.createBufferSource(), filter=ctx.createBiquadFilter(), amp=ctx.createGain();
    source.buffer=noise;filter.type=kind==='rain'?'highpass':'lowpass';filter.frequency.value=kind==='rain'?2900:kind==='rumble'?200:460;
    amp.gain.setValueAtTime(.001,ctx.currentTime);amp.gain.linearRampToValueAtTime(kind==='rain'?.045:kind==='rumble'?.20:.36,ctx.currentTime+.1);amp.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);
    source.connect(filter).connect(amp).connect(effectsBus??ctx.destination);source.start();
  }
}
export function score(beat:number, danger:boolean){
  if(!sound.music || !danger)return;
  const melody=[0,7,12,9,7,4,2,4,0,4,7,12,9,7,4,2];
  const root=danger?146.83:174.61;
  const hz=root*2**(melody[beat%16]/12);note(hz,.48,.10,'triangle',0,hz,'music');
  if(beat%4===0)note(root/2,.9,.12,'sine',0,root/2,'music');
}
