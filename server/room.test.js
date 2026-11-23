import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {roomRequest} from './room';

it('shares a room, enforces seats, restores a session and skips an offline question with both clocks off',async()=>{
  const sql=new DatabaseSync(':memory:');
  sql.exec(readFileSync('drizzle/0000_rooms.sql','utf8'));
  const db={prepare(q){const s=sql.prepare(q);return {bind(...v){return {first:()=>s.get(...v),run:()=>({meta:s.run(...v)})}}}}};
  async function call(id,token,data){
    const r=await roomRequest(new Request('https://example.test/api/rooms'+(id?'/'+id:''),{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(data)}),db);
    return {status:r.status,...await r.json()};
  }
  const a=await call('','',{name:'Aina',color:'#2DD4BF',subjects:['math'],qtypes:['mcq'],matchMinutes:0});
  expect(a.status).toBe(200);
  const b=await call(a.id,'',{action:'join',name:'Amir',color:'#60A5FA'});
  expect(b.seat).toBe(1);
  const start=await call(a.id,a.token,{action:'start',rev:b.rev});
  expect(start.game.current).toBe(0);
  expect((await call(a.id,b.token,{action:'roll',rev:start.rev})).status).toBe(409);
  const turn=await call(a.id,a.token,{action:'roll',rev:start.rev});
  expect(turn.game.phase).toBe('question');
  const other=await call(a.id,b.token,{action:'poll'});
  expect(other.game.pending).toEqual(turn.game.pending);
  expect(other.game.pending.question.answerIndex).toBeUndefined();
  vi.useFakeTimers();
  try{
    vi.setSystemTime(Date.now()+31000);
    const skipped=await call(a.id,b.token,{action:'poll'});
    expect(skipped.game.current).toBe(1);
    const back=await call(a.id,a.token,{action:'poll'});
    expect(back.game.players[0].pos).toBe(turn.game.players[0].pos);
    expect(back.game.players[0].points).toBe(0);
  }finally{vi.useRealTimers();sql.close();}
});
