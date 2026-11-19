import { Difficulty, QuestionType, Subject } from './config';
import { generateMath } from './mathgen';
import { Rng, pick, shuffle } from './rng';

export interface Question {
  id: string;
  subject: Subject;
  type: QuestionType;
  difficulty: Difficulty;
  prompt: string;
  /** Multiple choice: options shown as buttons. Absent means a typed answer. */
  choices?: string[];
  /** Index into choices for multiple choice. */
  answerIndex?: number;
  /** Accepted typed answers, compared case-insensitively after trimming. */
  answers?: string[];
}

export interface QuestionFilter {
  subjects: readonly Subject[];
  difficulty: Difficulty;
}

/**
 * Picks a question of the tile's type. Hand-written questions come from the bank;
 * maths is generated so it never runs dry. Falls back to any type when the chosen
 * subjects have nothing of that type.
 */
export function pickQuestion(
  rng: Rng,
  bank: readonly Question[],
  type: QuestionType,
  filter: QuestionFilter,
  used: Set<string>,
): Question {
  const subjects = filter.subjects.length ? filter.subjects : (['math'] as Subject[]);
  const fits = (q: Question, anyType: boolean) =>
    subjects.includes(q.subject) &&
    q.difficulty === filter.difficulty &&
    (anyType || q.type === type) &&
    !used.has(q.id);

  const options: Array<() => Question> = [];
  if (subjects.includes('math')) options.push(() => generateMath(rng, type, filter.difficulty));
  const written = bank.filter((q) => fits(q, false));
  if (written.length) options.push(() => pick(rng, written));

  let q: Question;
  if (options.length) {
    q = pick(rng, options)();
  } else {
    const anyType = bank.filter((x) => fits(x, true));
    const anyLevel = bank.filter((x) => subjects.includes(x.subject) && !used.has(x.id));
    if (anyType.length) q = pick(rng, anyType);
    else if (anyLevel.length) q = pick(rng, anyLevel);
    else q = generateMath(rng, type, filter.difficulty);
  }
  used.add(q.id);
  return shuffleChoices(rng, q);
}

function shuffleChoices(rng: Rng, q: Question): Question {
  if (!q.choices || q.answerIndex === undefined) return q;
  const correct = q.choices[q.answerIndex];
  const choices = shuffle(rng, q.choices);
  return { ...q, choices, answerIndex: choices.indexOf(correct) };
}

export function isCorrect(q: Question, response: string | number): boolean {
  if (q.choices && q.answerIndex !== undefined) return response === q.answerIndex;
  const given = normalise(String(response));
  return (q.answers ?? []).some((a) => normalise(a) === given);
}

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function correctAnswerText(q: Question): string {
  if (q.choices && q.answerIndex !== undefined) return q.choices[q.answerIndex];
  return q.answers?.[0] ?? '';
}
