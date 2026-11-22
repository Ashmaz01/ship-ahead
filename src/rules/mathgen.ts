import { Difficulty, QuestionType } from './config';
import type { Question } from './questions';
import { Rng, pick, randInt, shuffle } from './rng';

type Op = '+' | '-' | '×' | '÷';

const OPS: Record<Difficulty, Op[]> = {
  easy: ['+', '-'],
  medium: ['+', '-', '×'],
  hard: ['+', '-', '×', '÷'],
};

const MAX: Record<Difficulty, number> = { easy: 20, medium: 100, hard: 1000 };

/** Returns [a, b, result] for an operation that stays in whole, non-negative numbers. */
function operands(rng: Rng, op: Op, d: Difficulty): [number, number, number] {
  const max = MAX[d];
  const table = d === 'hard' ? 12 : 10;
  switch (op) {
    case '+': {
      const a = randInt(rng, 1, Math.floor(max / 2));
      const b = randInt(rng, 1, Math.floor(max / 2));
      return [a, b, a + b];
    }
    case '-': {
      const a = randInt(rng, 2, max);
      const b = randInt(rng, 1, a - 1);
      return [a, b, a - b];
    }
    case '×': {
      const a = randInt(rng, 2, table);
      const b = randInt(rng, 2, table);
      return [a, b, a * b];
    }
    case '÷': {
      const b = randInt(rng, 2, table);
      const r = randInt(rng, 2, table);
      return [b * r, b, r];
    }
  }
}

function distractors(rng: Rng, answer: number): number[] {
  const set = new Set<number>();
  const spread = Math.max(3, Math.round(Math.abs(answer) * 0.2));
  while (set.size < 3) {
    const n = answer + randInt(rng, -spread, spread);
    if (n !== answer && n >= 0) set.add(n);
  }
  return [...set];
}

export function generateMath(rng: Rng, type: QuestionType, d: Difficulty): Question {
  switch (type) {
    case 'mcq': {
      const op = pick(rng, OPS[d]);
      const [a, b, r] = operands(rng, op, d);
      const choices = shuffle(rng, [r, ...distractors(rng, r)]).map(String);
      return {
        id: `math-mcq-${d}-${a}${op}${b}`,
        subject: 'math', type, difficulty: d,
        prompt: `What is ${a} ${op} ${b}?`,
        choices, answerIndex: choices.indexOf(String(r)),
      };
    }
    case 'fill': {
      const op = pick(rng, OPS[d]);
      const [a, b, r] = operands(rng, op, d);
      const hideFirst = rng() < 0.5;
      const prompt = hideFirst ? `__ ${op} ${b} = ${r}` : `${a} ${op} __ = ${r}`;
      return {
        id: `math-fill-${d}-${a}${op}${b}-${hideFirst ? 1 : 2}`,
        subject: 'math', type, difficulty: d,
        prompt: `Fill the blank: ${prompt}`,
        answers: [String(hideFirst ? a : b)],
      };
    }
    case 'pattern':
      return pattern(rng, d);
    case 'word':
      return word(rng, d);
  }
}

function pattern(rng: Rng, d: Difficulty): Question {
  let terms: number[];
  if (d === 'easy') {
    const step = pick(rng, [1, 2, 5, 10]);
    const start = randInt(rng, 0, 10);
    terms = [0, 1, 2, 3, 4].map((i) => start + step * i);
  } else if (d === 'medium') {
    const step = randInt(rng, 3, 12) * (rng() < 0.3 ? -1 : 1);
    const start = step < 0 ? randInt(rng, 60, 99) : randInt(rng, 1, 30);
    terms = [0, 1, 2, 3, 4].map((i) => start + step * i);
  } else if (rng() < 0.5) {
    const ratio = pick(rng, [2, 3]);
    const start = randInt(rng, 1, 5);
    terms = [0, 1, 2, 3, 4].map((i) => start * ratio ** i);
  } else {
    const start = randInt(rng, 1, 10);
    const grow = randInt(rng, 1, 4);
    terms = [start];
    for (let i = 1; i < 5; i++) terms.push(terms[i - 1] + grow * i);
  }
  const answer = terms[4];
  return {
    id: `math-pattern-${d}-${terms.join('.')}`,
    subject: 'math', type: 'pattern', difficulty: d,
    prompt: `What comes next? ${terms.slice(0, 4).join(', ')}, __`,
    answers: [String(answer)],
  };
}

function word(rng: Rng, d: Difficulty): Question {
  const max = d === 'easy' ? 10 : d === 'medium' ? 12 : 25;
  const templates: Array<() => [string, number]> = [
    () => {
      const boats = randInt(rng, 2, Math.min(max, 9));
      const seats = randInt(rng, 2, max);
      return [`A rescue boat carries ${seats} people. How many people can ${boats} boats carry?`, boats * seats];
    },
    () => {
      const have = randInt(rng, 5, max * 4);
      const used = randInt(rng, 1, have - 1);
      return [`A ship has ${have} litres of fuel. It uses ${used} litres. How many litres are left?`, have - used];
    },
    () => {
      const a = randInt(rng, 3, max * 3);
      const b = randInt(rng, 3, max * 3);
      return [`Aina collects ${a} shells and Danial collects ${b}. How many shells do they have together?`, a + b];
    },
    () => {
      const groups = randInt(rng, 2, Math.min(max, 9));
      const each = randInt(rng, 2, max);
      return [`${groups * each} villagers share ${groups} boats equally. How many people go in each boat?`, each];
    },
  ];
  const pool = d === 'easy' ? templates.slice(1, 3) : templates;
  const [prompt, answer] = pick(rng, pool)();
  return {
    id: `math-word-${d}-${prompt}`,
    subject: 'math', type: 'word', difficulty: d,
    prompt, answers: [String(answer)],
  };
}
