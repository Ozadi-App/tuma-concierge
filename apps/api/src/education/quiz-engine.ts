import { SignJWT, jwtVerify } from "jose";

/**
 * Quizzes and exams. The creator's paper is stored with its answers and never leaves the server that way.
 * A learner is served a version without answers; the shuffle is derived from a seed carried in a signed token,
 * so marking needs no extra table: the server re-derives the same order and marks what came back.
 */

export const QUESTION_TYPES = ["single", "multiple", "true_false", "fill_blank", "short_answer", "ordering", "matching"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** A question as stored. Which fields matter depends on the type. */
export interface StoredQuestion {
  id: string;
  type: QuestionType;
  question: string;
  explanation?: string;
  points: number;
  /** single, multiple: the choices. ordering: the items in the correct order. matching: unused (see pairs). */
  options?: string[];
  /** single */
  correctIndex?: number;
  /** multiple */
  correctIndexes?: number[];
  /** true_false */
  answerBool?: boolean;
  /** fill_blank, short_answer: any of these counts as right (case and spacing ignored). */
  accepted?: string[];
  /** matching: each left side with its right side. */
  pairs?: { left: string; right: string }[];
}

export interface QuizSettings {
  timeLimitMinutes: number;
  /** 0 means as many as the platform allows. */
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  /** Draw this many questions at random for each attempt. 0 means all. */
  questionsPerAttempt: number;
}

export interface StoredQuiz {
  title: string;
  passingScorePercent: number;
  questions: StoredQuestion[];
  settings: QuizSettings;
}

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = { timeLimitMinutes: 0, maxAttempts: 0, shuffleQuestions: false, shuffleOptions: false, questionsPerAttempt: 0 };

const asText = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const asInt = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

/** Reads a stored quiz of any age (including the old single-choice shape) into the current one, dropping what is unusable. */
export function parseQuiz(raw: unknown): StoredQuiz | null {
  let data: any = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.questions)) return null;
  const questions: StoredQuestion[] = [];
  const seen = new Set<string>();
  data.questions.forEach((q: any, i: number) => {
    const normal = normaliseQuestion(q, i);
    if (!normal) return;
    if (seen.has(normal.id)) normal.id = `${normal.id}_${i + 1}`;
    seen.add(normal.id);
    questions.push(normal);
  });
  if (!questions.length) return null;
  const s = data.settings ?? {};
  return {
    title: asText(data.title, 120),
    passingScorePercent: asInt(data.passingScorePercent, 60, 0, 100),
    questions,
    settings: {
      timeLimitMinutes: asInt(s.timeLimitMinutes, 0, 0, 600),
      maxAttempts: asInt(s.maxAttempts, 0, 0, 50),
      shuffleQuestions: s.shuffleQuestions === true,
      shuffleOptions: s.shuffleOptions === true,
      questionsPerAttempt: asInt(s.questionsPerAttempt, 0, 0, 200),
    },
  };
}

export function normaliseQuestion(q: any, index: number): StoredQuestion | null {
  if (!q || typeof q !== "object") return null;
  const question = asText(q.question, 500);
  if (!question) return null;
  const type: QuestionType = QUESTION_TYPES.includes(q.type) ? q.type : "single";
  const base = {
    id: asText(q.id, 40) || `q${index + 1}`,
    type,
    question,
    points: asInt(q.points, 1, 1, 100),
    ...(asText(q.explanation, 500) ? { explanation: asText(q.explanation, 500) } : {}),
  };
  const options = Array.isArray(q.options) ? q.options.map((o: unknown) => asText(o, 200)).filter(Boolean) : [];
  switch (type) {
    case "single": {
      const correctIndex = Number(q.correctIndex);
      if (options.length < 2 || options.length > 8 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return null;
      return { ...base, options, correctIndex };
    }
    case "multiple": {
      const picks: number[] = Array.isArray(q.correctIndexes) ? [...new Set<number>(q.correctIndexes.map(Number))] : [];
      if (options.length < 2 || options.length > 8 || !picks.length || picks.some((n) => !Number.isInteger(n) || n < 0 || n >= options.length)) return null;
      return { ...base, options, correctIndexes: picks.sort((a, b) => a - b) };
    }
    case "true_false":
      return typeof q.answerBool === "boolean" ? { ...base, answerBool: q.answerBool } : null;
    case "fill_blank":
    case "short_answer": {
      const accepted = Array.isArray(q.accepted) ? q.accepted.map((a: unknown) => asText(a, 200)).filter(Boolean) : [];
      return accepted.length ? { ...base, accepted: accepted.slice(0, 10) } : null;
    }
    case "ordering":
      return options.length >= 2 && options.length <= 8 ? { ...base, options } : null;
    case "matching": {
      const pairs = Array.isArray(q.pairs) ? q.pairs.map((p: any) => ({ left: asText(p?.left, 200), right: asText(p?.right, 200) })).filter((p: any) => p.left && p.right) : [];
      return pairs.length >= 2 && pairs.length <= 8 ? { ...base, pairs } : null;
    }
  }
}

// ---------------------------------------------------------------------------
// Serving: no answers, optionally shuffled
// ---------------------------------------------------------------------------

/** Small seeded generator so the same seed always gives the same shuffle. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function permutation(length: number, random: (() => number) | null): number[] {
  const order = Array.from({ length }, (_, i) => i);
  if (!random) return order;
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

interface Layout {
  /** Question ids in the order served. */
  ids: string[];
  /** Per question: the permutation that maps served position -> stored index. */
  perm: Record<string, number[]>;
}

/** Decides what a given seed serves. Ordering and matching always shuffle (the stored order is the answer). */
function layout(quiz: StoredQuiz, seed: number): Layout {
  const random = rng(seed);
  let pool = quiz.questions.map((q) => q.id);
  if (quiz.settings.questionsPerAttempt > 0 && quiz.settings.questionsPerAttempt < pool.length) {
    pool = permutation(pool.length, random).slice(0, quiz.settings.questionsPerAttempt).sort((a, b) => a - b).map((i) => pool[i]);
  }
  if (quiz.settings.shuffleQuestions) pool = permutation(pool.length, random).map((i) => pool[i]);
  const perm: Record<string, number[]> = {};
  for (const id of pool) {
    const q = quiz.questions.find((x) => x.id === id)!;
    if (q.type === "single" || q.type === "multiple") perm[id] = permutation(q.options!.length, quiz.settings.shuffleOptions ? random : null);
    else if (q.type === "ordering") {
      let p = permutation(q.options!.length, random);
      if (p.every((v, i) => v === i)) p = [...p.slice(1), p[0]];
      perm[id] = p;
    } else if (q.type === "matching") perm[id] = permutation(q.pairs!.length, random);
  }
  return { ids: pool, perm };
}

export interface ServedQuestion {
  id: string;
  type: QuestionType;
  question: string;
  points: number;
  options?: string[];
  /** matching: the left side in a fixed order, and the right side to be matched against it. */
  left?: string[];
  right?: string[];
}

export function serveQuestions(quiz: StoredQuiz, seed: number): ServedQuestion[] {
  const lay = layout(quiz, seed);
  return lay.ids.map((id) => {
    const q = quiz.questions.find((x) => x.id === id)!;
    const out: ServedQuestion = { id: q.id, type: q.type, question: q.question, points: q.points };
    const p = lay.perm[id];
    if (q.type === "single" || q.type === "multiple" || q.type === "ordering") out.options = p.map((i) => q.options![i]);
    if (q.type === "matching") {
      out.left = q.pairs!.map((x) => x.left);
      out.right = p.map((i) => q.pairs![i].right);
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

/** What a learner sends back for one question, in served positions. */
export type Answer = number | number[] | boolean | string | null | undefined;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export interface QuestionResult {
  id: string;
  correct: boolean;
  earned: number;
  points: number;
  /** Set only when the caller chose to reveal answers. */
  reveal?: { answer: string; explanation?: string };
}

export interface Marked {
  earned: number;
  total: number;
  scorePercent: number;
  passed: boolean;
  results: QuestionResult[];
}

function describe(q: StoredQuestion): string {
  switch (q.type) {
    case "single": return q.options![q.correctIndex!];
    case "multiple": return q.correctIndexes!.map((i) => q.options![i]).join(", ");
    case "true_false": return q.answerBool ? "True" : "False";
    case "fill_blank":
    case "short_answer": return q.accepted![0];
    case "ordering": return q.options!.join(" → ");
    case "matching": return q.pairs!.map((p) => `${p.left} — ${p.right}`).join("; ");
  }
}

function isRight(q: StoredQuestion, perm: number[] | undefined, a: Answer): boolean {
  switch (q.type) {
    case "single": {
      if (typeof a !== "number" || !perm || !(a in perm)) return false;
      return perm[a] === q.correctIndex;
    }
    case "multiple": {
      if (!Array.isArray(a) || !perm) return false;
      const stored = [...new Set(a.map(Number))].map((n) => perm[n]).filter((n) => n !== undefined).sort((x, y) => x - y);
      return stored.length === q.correctIndexes!.length && stored.every((n, i) => n === q.correctIndexes![i]);
    }
    case "true_false":
      return typeof a === "boolean" && a === q.answerBool;
    case "fill_blank":
    case "short_answer":
      return typeof a === "string" && q.accepted!.some((x) => norm(x) === norm(a));
    case "ordering": {
      if (!Array.isArray(a) || !perm || a.length !== perm.length) return false;
      const stored = a.map((n) => perm[Number(n)]);
      return stored.every((n, i) => n === i) && new Set(a.map(Number)).size === perm.length;
    }
    case "matching": {
      if (!Array.isArray(a) || !perm || a.length !== q.pairs!.length) return false;
      // a[i] is the served position of the right side chosen for left side i; it must lead back to pair i.
      return a.every((n, i) => perm[Number(n)] === i) && new Set(a.map(Number)).size === a.length;
    }
  }
}

export function mark(quiz: StoredQuiz, seed: number, answers: Record<string, Answer>, reveal: boolean): Marked {
  const lay = layout(quiz, seed);
  let earned = 0;
  let total = 0;
  const results: QuestionResult[] = lay.ids.map((id) => {
    const q = quiz.questions.find((x) => x.id === id)!;
    const correct = isRight(q, lay.perm[id], answers[id]);
    total += q.points;
    if (correct) earned += q.points;
    return {
      id,
      correct,
      earned: correct ? q.points : 0,
      points: q.points,
      ...(reveal ? { reveal: { answer: describe(q), ...(q.explanation ? { explanation: q.explanation } : {}) } } : {}),
    };
  });
  const scorePercent = total ? Math.round((earned / total) * 100) : 0;
  return { earned, total, scorePercent, passed: scorePercent >= quiz.passingScorePercent, results };
}

// ---------------------------------------------------------------------------
// Attempt tokens
// ---------------------------------------------------------------------------

const AUDIENCE = "peebee-learn-attempt";
const key = () => new TextEncoder().encode(process.env.JWT_SECRET ?? "");

export interface AttemptClaims {
  userId: string;
  lessonId: string;
  seed: number;
  startedAt: number;
}

/** A started attempt. It expires after the time limit (plus a minute of grace for slow networks), or after a day with no limit. */
export async function signAttempt(userId: string, lessonId: string, seed: number, timeLimitMinutes: number): Promise<string> {
  const seconds = timeLimitMinutes > 0 ? timeLimitMinutes * 60 + 60 : 24 * 3600;
  return new SignJWT({ lid: lessonId, seed })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("peebee-api")
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + seconds)
    .sign(key());
}

export async function readAttempt(token: string): Promise<AttemptClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: "peebee-api", audience: AUDIENCE });
    if (typeof payload.sub !== "string" || typeof payload.lid !== "string" || typeof payload.seed !== "number") return null;
    return { userId: payload.sub, lessonId: payload.lid, seed: payload.seed, startedAt: (payload.iat ?? 0) * 1000 };
  } catch {
    return null;
  }
}

export function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
