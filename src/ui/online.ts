import { SCHOOL_LABEL, selectedBands } from '../rules/school';
import type BoardScene from '../scenes/BoardScene';
import type { GameEvent, GameState } from '../rules/game';
import { POWER_LABEL } from '../rules/config';
import { CREW } from './crew';
import { avatar, esc } from './html';
import { cue, unlockAudio, syncMusic, sound, volumeControls } from '../sound';

interface Room {
  id:string; seat:number; rev:number; token?:string;
  members:Array<{name:string;color:string}>;
  game:GameState|null; events:GameEvent[]; ranks:Array<{id:number;rank:number}>;
  settings:{schoolLevel?:string;schoolLevels?:string[];weather:string;matchMinutes:number}; deadline:number;questionEnd:number;serverNow:number;feedback:string;ended:string;
}
interface Options {
  board:BoardScene; layer:HTMLElement; hud:HTMLElement; settings:object; exit:()=>void;
  conditions:(room:Room)=>void; dice:(value:number)=>Promise<void>;
}
export function openOnline(o:Options){
  const {layer,board,hud}=o;
  hud.hidden=true;
  let code=new URLSearchParams(location.search).get('room')?.toUpperCase()||'';
  let token=code?localStorage.getItem('ship.room.'+code)||'':'';
  let room:Room|null=null, running=true, pending=false, error='', offset=0;
  let interval=0;
  function leave(){
    running=false;clearInterval(interval);
    history.replaceState({},'',location.pathname);layer.onclick=null;layer.onsubmit=null;o.exit();
  }
  async function send(action:string,extra:Record<string,unknown>={}){
    if(pending||!running)return;
    pending=true;
    try{
      const response=await fetch('/api/rooms'+(code?'/'+encodeURIComponent(code):''),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,rev:room?.rev,...extra})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Connection interrupted.');
      if(!running)return;
      const before=room;room=data as Room;code=room.id;
      offset=room.serverNow-Date.now();error='';
      if(room.token){token=room.token;localStorage.setItem('ship.room.'+code,token);history.replaceState({},'',location.pathname+'?room='+code);}
      if(!before || room.rev!==before.rev){
        if(room.game){
          if(before?.game&&room.rev===before.rev+1){
            const roll=room.events.find(e=>e.type==='roll');
            if(roll?.type==='roll'){await o.dice(roll.value);}
            await board.play(room.events);
          }
          board.setup(room.game);
          if(room.ended==='eruption' && !before?.ended)cue('eruption');
        }
        draw();
      }
      updateClock();
    }catch(e){
      error=e instanceof Error?e.message:'Reconnecting…';
      const status=layer.querySelector('[data-status]');if(status)status.textContent=error;
    }finally{pending=false;}
  }
  function updateClock(){
    if(!room?.game||room.game.phase==='over')return;
    o.conditions({...room,serverNow:Date.now()+offset});
    const q=layer.querySelector('[data-seconds]');
    if(q&&room.questionEnd)q.textContent=Math.max(0,Math.ceil((room.questionEnd-Date.now()-offset)/1000))+'s';
  }
  const status=()=>'<p role="status" data-status>'+esc(error)+'</p>';
  function draw(){
    if(!room){
      layer.innerHTML=`<section class="screen setup"><h1>${code?'Join the crew':'Online crew'}</h1><form data-join>
      <label>Your name <input name="name" maxlength="18" required autocomplete="nickname"></label>
      <label>Avatar <select name="color">${CREW.map(m=>`<option value="${m.color}">${m.name}</option>`).join('')}</select></label>
      <label>Room code <input name="code" maxlength="8" placeholder="Leave empty to host" value="${esc(code)}"></label>
      <button class="btn-primary">Enter room</button></form>${status()}<button data-online="leave" class="btn-secondary">Back</button></section>`;
      return;
    }
    const me=room.seat,g=room.game;
    if(!g){
      const link=location.origin+location.pathname+'?room='+code;
      layer.innerHTML=`<section class="screen setup"><h1>Ferry crew</h1><h2>Room ${esc(code)}</h2><p>Math · ${selectedBands(room.settings.schoolLevels??room.settings.schoolLevel).map(b=>SCHOOL_LABEL[b]).join(' + ')}</p>
      <label>Invite link <input readonly value="${esc(link)}"></label><button class="btn-secondary" data-online="share">Share invite</button>
      <div class="list">${room.members.map((m,i)=>`<div>${avatar(m.color)} ${esc(m.name)}${i===0?' · Host':''}</div>`).join('')}</div>
      ${me===0?`<button class="btn-primary" data-online="start" ${room.members.length<2?'disabled':''}>Start race</button>`:'<p>Waiting for the host to start.</p>'}
      ${status()}<button class="btn-secondary" data-online="leave">Leave room</button></section>`;return;
    }
    if(g.phase==='over'){
      o.conditions(room);
      layer.innerHTML=`<section class="screen setup"><h1>${room.ended==='eruption'?'The volcano erupted!':'The ferry is away!'}</h1>
      <ol class="standings">${room.ranks.map(x=>{const p=g.players[x.id];return `<li><span class="rank">${x.rank}</span>${avatar(p.color)}<b>${esc(p.name)}${p.boarded||(room!.ended==='eruption'&&x.rank<=2)?' · Escaped':''}</b><span>${p.points} pts</span></li>`}).join('')}</ol>
      <button class="btn-primary" data-online="leave">Return to setup</button></section>`;return;
    }
    const p=g.players[g.current],mine=me===g.current,q=g.pending?.question;
    layer.innerHTML=`<div class="net-top">${avatar(p.color)}<strong>${esc(p.name)}’s turn</strong> · ${p.points} pts <button data-online="view">Map</button></div>
    <section class="net-panel">${room.feedback?`<p role="status">${esc(room.feedback)}</p>`:''}
    ${q?`<small>${q.band?SCHOOL_LABEL[q.band]:'Math'}</small><h2>${esc(q.prompt)}</h2><span data-seconds></span>${q.choices?q.choices.map((v,i)=>`<button data-online="answer" data-value="${i}" ${mine?'':'disabled'}>${esc(v)}</button>`).join(''):mine?'<form data-answer><input name="response" required placeholder="Your answer"><button>Check answer</button></form>':''}`:
    mine?`${p.powers.map(power=>`<button data-online="power" data-value="${power}">${POWER_LABEL[power]}</button>`).join('')}
    ${p.powers.includes('pushback')?`<select aria-label="Push back target" data-target>${g.players.filter(x=>!x.boarded&&x.id!==me).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>`:''}
    <button class="btn-primary" data-online="roll">Roll dice</button>`:`<p>Watching ${esc(p.name)}’s turn</p>`}
    <details><summary>Crew &amp; sound</summary><p>${g.players.map(x=>esc(x.name)+' · '+x.points+' pts').join(' / ')}</p>
    <label><input type="checkbox" data-sound="music" ${sound.music?'checked':''}> Music</label>
    <label><input type="checkbox" data-sound="effects" ${sound.effects?'checked':''}> Sound effects</label>${volumeControls()}</details>${status()}</section>`;
  }
  layer.onchange=e=>{const t=e.target as HTMLInputElement;if(t.dataset.sound==='music'||t.dataset.sound==='effects'){sound[t.dataset.sound]=t.checked;syncMusic();}};
  layer.onsubmit=e=>{
    e.preventDefault();const form=e.target as HTMLFormElement;const data=new FormData(form);unlockAudio();
    if(form.hasAttribute('data-answer'))void send('answer',{value:String(data.get('response'))});
    else{code=String(data.get('code')).trim().toUpperCase();token=localStorage.getItem('ship.room.'+code)||'';void send(code?'join':'create',{...o.settings,name:data.get('name'),color:data.get('color')});}
  };
  layer.onclick=async e=>{
    const btn=(e.target as Element).closest<HTMLElement>('[data-online]');if(!btn)return;
    const action=btn.dataset.online!;
    if(action==='leave')return leave();
    if(action==='view')return board.toggleView();
    if(action==='share'){
      const url=location.href;
      try{if(navigator.share)await navigator.share({title:'Join my Ship Ahead crew',url});else await navigator.clipboard.writeText(url);}
      catch{(layer.querySelector('input[readonly]') as HTMLInputElement)?.select();}
      return;
    }
    unlockAudio();
    void send(action,action==='answer'?{value:Number(btn.dataset.value)}:action==='power'?{power:btn.dataset.value,target:Number(layer.querySelector<HTMLSelectElement>('[data-target]')?.value)}:{});
  };
  draw();
  if(token&&code)void send('poll');
  interval=window.setInterval(()=>{if(room){updateClock();if(room.game?.phase!=='over')void send('poll');}},1000);
}
