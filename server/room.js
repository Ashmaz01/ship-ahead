import {selectedBands} from '../src/rules/school';
import { createGame, roll, answer, expireMatch, endTurn, usePower, standings } from '../src/rules/game';
import { createRng } from '../src/rules/rng';
import { DIFFICULTY } from '../src/rules/config';
import bank from '../src/data/questions.json';

const palette=['#2DD4BF','#60A5FA','#F472B6','#A3E635','#E2E8F0','#FDBA74'];
const hours=6*3600000;
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
function choices(values,allowed){
  if(!Array.isArray(values))fail('Choose your game settings.');
  const result=allowed.filter(v=>values.includes(v));
  if(!result.length)fail('Select a subject and question type.');
  return result;
}
function options(data){
  return {
    difficulty:['easy','medium','hard'].includes(data.difficulty)?data.difficulty:'easy',
    subjects:['math'], schoolLevels:selectedBands(data.schoolLevels ?? data.schoolLevel),
    qtypes:choices(data.qtypes,['mcq','fill','pattern','word']),
    timer:data.timer===true,matchMinutes:[0,5,10,15].includes(data.matchMinutes)?data.matchMinutes:10,
    weather:['auto','clear','dusk','rain','thunder'].includes(data.weather)?data.weather:'auto',
  };
}
function member(data){
  if(typeof data.name!=='string'||!data.name.trim()||!palette.includes(data.color))fail('Choose a crew member and enter your name.');
  return {name:data.name.trim().slice(0,18),color:data.color,token:crypto.randomUUID()};
}
function view(room,id,seat,rev){
  const {members,settings,game,deadline,questionEnd,feedback,events}=room;
  let board=null;
  if(game){
    const {pending,used,bank,rng,...publicGame}=game;
    board={...publicGame,pending:pending?{tile:pending.tile,question:{band:pending.question.band,prompt:pending.question.prompt,choices:pending.question.choices,type:pending.question.type}}:null};
  }
  return {id,seat,rev,settings,members:members.map(({name,color})=>({name,color})),game:board,deadline,questionEnd,feedback,events,serverNow:Date.now(),ended:room.ended,ranks:game?.phase==='over'?standings(game).map(x=>({id:x.player.id,rank:x.rank})):[]};
}
function saveGame(game){
  if(!game)return null;
  const {rng,bank,...data}=game;
  return {...data,used:Array.from(game.used)};
}
function observe(room,now,seen){
  const g=room.game;
  if(!g||g.phase==='over')return false;
  if(room.deadline && now>=room.deadline){
    room.events=expireMatch(g);room.ended='eruption';return true;
  }
  if(g.phase==='question' && room.questionEnd && now>=room.questionEnd){
    take(room,{action:'answer',value:null},now);return true;
  }
  if((g.phase==='turn'||!room.questionEnd) && now-Math.max(seen,room.turnStart)>=30000){
    g.phase='turn';g.pending=null;room.events=endTurn(g);
    room.feedback='Connection lost. The turn passed.';room.turnStart=now;room.questionEnd=0;return true;
  }
  return false;
}
function explain(q,correct){
  if(q.type==='fill')return q.prompt.replace(/^Fill the blank: /,'').replace(/_+/,correct);
  if(q.id.startsWith('math-mcq'))return q.prompt.replace(/^What is /,'').replace('?',' = '+correct+'.');
  if(q.id.startsWith('math-pattern')){
    const numbers=q.id.split('-').at(-1).split('.').map(Number);
    if(numbers.every((v,i)=>!i||v-numbers[i-1]===numbers[1]-numbers[0]))return 'The step between terms is '+(numbers[1]-numbers[0])+'.';
    if(numbers.every((v,i)=>!i||v/numbers[i-1]===numbers[1]/numbers[0]))return 'Multiply each term by '+numbers[1]/numbers[0]+'.';
    return 'The gap grows with each step.';
  }
  if(q.subject==='arabic')return q.prompt.split('\n').at(-1)+' means “'+correct+'”.';
  return q.explanation||'';
}
function take(room,data,now){
  const g=room.game;
  if(data.action==='roll')room.events=roll(g);
  else if(data.action==='power')room.events=usePower(g,data.power,data.target);
  else if(data.action==='answer'){
    const question=g.pending?.question;
    room.events=answer(g,data.value);
    const result=room.events.find(e=>e.type==='answer');
    room.feedback=(result.correct?'Correct! ':'The correct answer was ')+result.answer+'. '+explain(question,result.answer);
  }else fail('Unknown move.');
  if(data.action!=='answer')room.feedback='';
  room.turnStart=now;
  room.questionEnd=g.phase==='question' && g.setup.timer ? now+DIFFICULTY[g.setup.difficulty].seconds*1000 : 0;
  if(g.phase==='over')room.ended=room.events.some(e=>e.reason==='boarded')?'boarded':'eruption';
}

export async function roomRequest(request,db){
  try{
    const url=new URL(request.url);
    if(request.method!=='POST')return json({error:'Use POST.'},405);
    if(request.headers.get('Origin') && request.headers.get('Origin')!==url.origin)return json({error:'Invalid origin.'},403);
    const raw=await request.text();if(raw.length>4096)fail('Request too large.');
    const data=JSON.parse(raw||'{}'), now=Date.now();
    const id=url.pathname.split('/')[3];
    if(!id){
      const creator=member(data),code=crypto.randomUUID().slice(0,8).toUpperCase();
      const room={settings:options(data),members:[creator],game:null,events:[],feedback:'',deadline:0,questionEnd:0};
      await db.prepare('DELETE FROM rooms WHERE expires < ?').bind(now).run();
      await db.prepare('INSERT INTO rooms VALUES (?,0,?,?)').bind(code,JSON.stringify(room),now+hours).run();
      return json({...view(room,code,0,0),token:creator.token});
    }
    const rec=await db.prepare('SELECT body, revision FROM rooms WHERE id=? AND expires>?').bind(id,now).first();
    if(!rec)fail('Room expired or code incorrect.',404);
    const room=JSON.parse(rec.body);
    if(room.game)Object.assign(room.game,{bank,used:new Set(room.game.used),rng:createRng(crypto.getRandomValues(new Uint32Array(1))[0])});
    let seat=room.members.findIndex(p=>'Bearer '+p.token===request.headers.get('Authorization'));
    let changed=false,token;
    if(data.action==='join'&&seat<0){
      if(room.game||room.members.length>=6)fail('This room has started or is full.');
      const p=member(data);
      if(room.members.some(x=>x.color===p.color))fail('That avatar is taken. Choose another.');
      seat=room.members.length;room.members.push(p);token=p.token;changed=true;
    } else if(seat<0)fail('Join the room to continue.',403);
    const g=room.game;
    const presence=g && g.phase!=='over'?await db.prepare('SELECT seen FROM presence WHERE room=? AND seat=?').bind(id,g.current).first():null;
    if(data.action==='poll'||data.action==='join'||data.rev===rec.revision){
      await db.prepare('INSERT INTO presence VALUES (?,?,?) ON CONFLICT(room,seat) DO UPDATE SET seen=excluded.seen').bind(id,seat,now).run();
    }
    if(observe(room,now,presence?.seen||0))changed=true;
    else if(data.action==='start'){
      if(seat!==0||g||room.members.length<2)fail('Only the host can start with at least two players.');
      room.game=createGame({...room.settings,players:room.members.map(({name,color})=>({name,color}))},bank);
      room.deadline=room.settings.matchMinutes?now+room.settings.matchMinutes*60000:0;
      room.turnStart=now;changed=true;
    }else if(!['poll','join'].includes(data.action)){
      if(!g||g.phase==='over'||seat!==g.current||data.rev!==rec.revision)fail('The turn has changed.',409);
      take(room,data,now);changed=true;
    }
    let revision=rec.revision;
    if(changed){
      const saved=await db.prepare('UPDATE rooms SET body=?,revision=revision+1,expires=? WHERE id=? AND revision=?')
        .bind(JSON.stringify({...room,game:saveGame(room.game)}),now+hours,id,revision).run();
      if(!saved.meta.changes)fail('Room updated. Try again.',409);
      revision++;
    }
    return json({...view(room,id,seat,revision),token});
  }catch(e){return json({error:e.status?e.message:'Unable to complete this room request.'},e.status||400);}
}
