import { expect,it } from 'vitest';
import { schoolQuestion, LEVELS } from './school';
import { createRng } from './rng';
import { correctAnswerText,isCorrect } from './questions';
it('supports all settings with valid math answers and draws every band in Random',()=>{
  const rng=createRng(78), seen=new Set();
  for(const level of [...LEVELS,'random'] as const)
    for(const diff of ['easy','medium','hard'] as const)
      for(const type of ['mcq','pattern','fill','word'] as const){
        const q=schoolQuestion(rng,level,type,diff);
        expect(q.subject).toBe('math');expect(q.type).toBe(type);
        if(level==='random')seen.add(q.band);else expect(q.band).toBe(level);
        expect(isCorrect(q,q.answerIndex??correctAnswerText(q))).toBe(true);
      }
  expect(seen.size).toBe(4);
});

import {drawMath,selectedBands,questionDeck} from './school';
it('draws 100 different prompts from two selected bands and migrates old settings',()=>{
  const rng=createRng(11),used=new Set<string>(),bands=selectedBands(['year13','form45']);
  for(let i=0;i<100;i++)expect(bands).toContain(drawMath(rng,bands,'mcq','easy',used).band);
  expect(used.size).toBe(100);
  expect(selectedBands('random')).toEqual(LEVELS);
  expect(selectedBands('year46')).toEqual(['year46']);
});
it('counts distinct playable prompts across every preset',()=>{
  const prompts=new Set<string>();
  for(const b of LEVELS)for(const t of ['mcq','fill','pattern','word'] as const)
    for(const d of ['easy','medium','hard'] as const)for(const q of questionDeck(b,t,d))prompts.add(q.prompt);
  expect(prompts.size).toBeGreaterThan(3000);
  console.log('Distinct math prompts:',prompts.size);
});
