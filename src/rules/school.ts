import type { Difficulty, QuestionType } from './config';
import type { Question } from './questions';
import { generateMath } from './mathgen';
import { createRng, pick, randInt, shuffle, type Rng } from './rng';

export const LEVELS = ['year13','year46','form13','form45'] as const;
export type Band = typeof LEVELS[number];
export type SchoolLevel = Band | 'random';
export const SCHOOL_LABEL: Record<SchoolLevel,string> = {
  year13:'Year 1–3', year46:'Year 4–6', form13:'Form 1–3', form45:'Form 4–5', random:'Random',
};
export function schoolLevel(value: unknown): SchoolLevel {
  return value==='random' || LEVELS.includes(value as Band) ? value as SchoolLevel : 'year13';
}

export function schoolQuestion(rng:Rng, level:SchoolLevel, type:QuestionType, difficulty:Difficulty):Question {
  const band=level==='random'?pick(rng,LEVELS):level;
  if(band==='year13' && type!=='pattern')return {...generateMath(rng,type,difficulty),band};
  const limit={easy:5,medium:9,hard:14}[difficulty];
  const a=randInt(rng,2,limit), b=randInt(rng,2,limit+1);
  let prompt:string, result:number;
  if(type==='pattern'){
    const term=(n:number)=>{
      switch(band){
        case 'year13':return a+b*n;
        case 'year46':return a+b*(n+1)*2;
        case 'form13':return a*2**n+b;
        case 'form45':return a*n*n+b*n+1;
      }
    };
    prompt='What comes next? '+[0,1,2,3].map(term).join(', ')+', __';result=term(4);
  }else if(band==='year46'){
    if(type==='mcq'){prompt=`What is 3/4 of ${4*a*b}?`;result=3*a*b;}
    else if(type==='fill'){prompt=`__ minutes = ${a} hours and ${b*3} minutes.`;result=a*60+b*3;}
    else{prompt=`A repair kit costs RM${a*10}. The shop gives a 10% discount. How many ringgit do you pay?`;result=a*9;}
  }else if(band==='form13'){
    if(type==='mcq'){prompt=`Solve for x: ${a}x + ${b} = ${a*(b+1)+b}.`;result=b+1;}
    else if(type==='fill'){prompt=`If x = −${a}, then ${b}x + 3 = __.`;result=3-a*b;}
    else{prompt=`A ferry travels ${a*b*10} km in ${a} hours. What is its average speed in km/h?`;result=b*10;}
  }else{
    if(type==='mcq'){prompt=`Find the larger root of x² − ${2*a+b}x + ${a*(a+b)} = 0.`;result=a+b;}
    else if(type==='fill'){prompt=`For the quadratic y = (x − ${a})² + ${b}, the minimum value of y is __.`;result=b;}
    else{prompt=`The crew deposits RM${100*a} at ${b}% simple interest per year. How much interest, in ringgit, will it earn in 3 years?`;result=3*a*b;}
  }
  const q:Question={band,id:[band,type,prompt].join('/'),subject:'math',type,difficulty,prompt};
  if(type==='mcq'){
    q.choices=shuffle(rng,[result,result+1,result-1,result+2]).map(String);
    q.answerIndex=q.choices.indexOf(String(result));
  }else q.answers=[String(result)];
  return q;
}

export function selectedBands(value:unknown):Band[] {
  const list=Array.isArray(value)?value:[value];
  if(list.includes('random'))return [...LEVELS];
  const valid=LEVELS.filter(b=>list.includes(b));
  return valid.length?valid:['year13'];
}

// Each deck belongs to one school band, pillar type and difficulty.
const decks=new Map<string,Question[]>();
function extraQuestion(rng:Rng,band:Band,type:QuestionType,d:Difficulty):Question {
  const a=randInt(rng,2,{easy:9,medium:16,hard:28}[d]), b=randInt(rng,2,9);
  let pair:[string,number];
  if(type==='pattern'){
    const seq=Array.from({length:5},(_,n)=>{
      if(band==='year13')return a+b*(5-n);
      if(band==='year46')return a+b*Math.floor(n/2)+(n%2)*(b+1)+Math.floor(n/2)*(b+1);
      if(band==='form13')return a+b*n*(n+1)/2;
      return a*(n+1)**2-b;
    });
    pair=[`Find the next term: ${seq.slice(0,4).join(', ')}, __`,seq[4]];
  }else{
    const items:Record<Band,[string,number][]> = {
      year13:[[`There are ${a+b} shells. ${b} wash away. How many remain?`,a],
        [`A crew packs ${b} bags with ${a} apples each. How many apples altogether?`,a*b],
        [`How many minutes are in ${b} hours?`,60*b]],
      year46:[[`A map is ${a+b} cm long and ${b} cm wide. Find its perimeter in cm.`,2*(a+2*b)],
        [`What is the average of ${a}, ${a+b} and ${a+2*b}?`,a+b],
        [`How many grams are in ${a} kg and ${b*10} g?`,a*1000+b*10]],
      form13:[[`A triangle has angles of ${a+20}° and ${b+40}°. Find its third angle in degrees.`,120-a-b],
        [`Paint is mixed in a ratio of 2 to 3. For ${2*a} litres of blue, how many litres of white are needed?`,3*a],
        [`A tank is ${a} m long, ${b} m wide and 2 m tall. Find its volume in cubic metres.`,2*a*b]],
      form45:[[`A workshop pays RM${a*100} in fixed costs and RM${b} per kit. What is the cost in ringgit for 20 kits?`,100*a+20*b],
        [`Given y = ${b}x², find y when x = ${a}.`,b*a*a],
        [`The ferry covers ${a*b} km in ${b} hours and ${a*b*2} km in another ${b} hours. Find its average speed in km/h.`,1.5*a]]
    };
    pair=pick(rng,items[band]);
  }
  const [text,value]=pair;
  const prompt=type==='fill'?text+' Answer: __':text;
  const q:Question={id:[band,type,prompt].join('/'),band,type,subject:'math',difficulty:d,prompt};
  if(type==='mcq'){
    q.choices=shuffle(rng,[value,value+1,value+2,value-1]).map(String);
    q.answerIndex=q.choices.indexOf(String(value));
  }else q.answers=[String(value)];
  return q;
}
export function questionDeck(band:Band,type:QuestionType,d:Difficulty):Question[]{
  const key=[band,type,d].join('/');
  let deck=decks.get(key);
  if(!deck){
    const rng=createRng(84127), unique=new Map<string,Question>();
    for(let i=0;i<800;i++){
      const q=i%2?extraQuestion(rng,band,type,d):schoolQuestion(rng,band,type,d);
      unique.set(q.prompt,q);
    }
    deck=[...unique.values()];decks.set(key,deck);
  }
  return deck;
}
export function drawMath(rng:Rng,bands:Band[],type:QuestionType,d:Difficulty,used:Set<string>):Question{
  const decks=bands.map(b=>questionDeck(b,type,d));
  let available=decks.map(deck=>deck.filter(q=>!used.has(q.prompt))).filter(deck=>deck.length);
  if(!available.length){
    for(const deck of decks)for(const q of deck)used.delete(q.prompt);
    available=decks;
  }
  const q=pick(rng,pick(rng,available));used.add(q.prompt);return q;
}
