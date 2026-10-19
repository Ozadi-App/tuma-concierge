import { DEMO_ACADEMY_EXAM } from "@peebee/shared";

/**
 * Answer keys for the exams the server marks itself. They live only here, never
 * in the shared package, so a learner's browser never receives them.
 * A question with no key is left for a teacher to mark.
 */
type Key =
  | { kind: "choice"; correctIndex: number }
  | { kind: "number"; value: number; tolerance: number }
  | { kind: "text"; accepted: string[] };

const KEYS: Record<string, Record<string, Key>> = {
  exam_uace_math_01: {
    // 2x² − 5x + 3 = 0 → x = 1 or x = 1.5
    q1: { kind: "choice", correctIndex: 0 },
    // d/dx [3x³ − 4 sin x + e^(2x)] = 9x² − 4 cos x + 2e^(2x)
    q2: { kind: "text", accepted: ["9x^2-4cos(x)+2e^(2x)", "9x^2-4cosx+2e^2x", "2e^(2x)+9x^2-4cos(x)", "2e^(2x)-4cos(x)+9x^2", "-4cos(x)+9x^2+2e^(2x)", "9x^2+2e^(2x)-4cos(x)"] },
    // 4,500,000 × 1.18³ = 7,393,644
    q3: { kind: "number", value: 7_393_644, tolerance: 1 },
  },
};

const normaliseText = (v: string) =>
  v
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/²/g, "^2")
    .replace(/[()]/g, "")
    .replace(/\*\*/g, "^")
    .replace(/\*/g, "")
    .replace(/\s+/g, "")
    .replace(/^d\/dx=|^=|^y'?=/, "");

function parseNumber(v: string): number | null {
  const cleaned = v.toLowerCase().replace(/ugx|shs|,|\s/g, "");
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export type ExamResult = {
  autoPoints: number;
  autoOutOf: number;
  totalPoints: number;
  /** True when some question has no key and a teacher still has to mark it. */
  needsMarking: boolean;
  perQuestion: Record<string, { points: number; maxPoints: number; correct: boolean | null }>;
};

/** Marks what the server can. Returns null if this exam is not one the server knows. */
export function gradeExam(examId: string, answers: Record<string, string>): ExamResult | null {
  if (examId !== DEMO_ACADEMY_EXAM.id) return null;
  const keys = KEYS[examId] ?? {};
  let autoPoints = 0;
  let autoOutOf = 0;
  let needsMarking = false;
  const perQuestion: ExamResult["perQuestion"] = {};
  for (const q of DEMO_ACADEMY_EXAM.questions) {
    const key = keys[q.id];
    const given = (answers[q.id] ?? "").trim();
    if (!key) {
      needsMarking = true;
      perQuestion[q.id] = { points: 0, maxPoints: q.maxPoints, correct: null };
      continue;
    }
    autoOutOf += q.maxPoints;
    let correct = false;
    if (key.kind === "choice") {
      const index = q.options?.findIndex((o) => o === given) ?? -1;
      correct = index === key.correctIndex || (/^\d+$/.test(given) && Number(given) === key.correctIndex);
    } else if (key.kind === "number") {
      const n = parseNumber(given);
      correct = n !== null && Math.abs(n - key.value) <= key.tolerance;
    } else {
      const n = normaliseText(given);
      correct = n !== "" && key.accepted.some((a) => normaliseText(a) === n);
    }
    const points = correct ? q.maxPoints : 0;
    autoPoints += points;
    perQuestion[q.id] = { points, maxPoints: q.maxPoints, correct };
  }
  return { autoPoints, autoOutOf, totalPoints: DEMO_ACADEMY_EXAM.totalPoints, needsMarking, perQuestion };
}
