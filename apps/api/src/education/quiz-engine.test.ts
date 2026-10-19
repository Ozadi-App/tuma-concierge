import assert from "node:assert/strict";
import { test } from "node:test";
import { mark, parseQuiz, readAttempt, serveQuestions, signAttempt, type Answer } from "./quiz-engine.js";

const paper = parseQuiz({
  title: "End of unit",
  passingScorePercent: 60,
  settings: { shuffleOptions: true, shuffleQuestions: true },
  questions: [
    { id: "a", type: "single", question: "2+2?", options: ["3", "4", "5"], correctIndex: 1 },
    { id: "b", type: "multiple", question: "Primes?", options: ["2", "3", "4", "6"], correctIndexes: [0, 1], points: 2 },
    { id: "c", type: "true_false", question: "Sky is blue", answerBool: true },
    { id: "d", type: "fill_blank", question: "Capital of Uganda", accepted: ["Kampala"] },
    { id: "e", type: "ordering", question: "Order", options: ["first", "second", "third"] },
    { id: "f", type: "matching", question: "Match", pairs: [{ left: "cat", right: "meow" }, { left: "dog", right: "woof" }] },
  ],
})!;

/** Builds the perfect answer sheet by reading what was served, the way a learner would. */
function perfect(seed: number): Record<string, Answer> {
  const served = serveQuestions(paper, seed);
  const out: Record<string, Answer> = {};
  for (const q of served) {
    if (q.id === "a") out.a = q.options!.indexOf("4");
    if (q.id === "b") out.b = [q.options!.indexOf("2"), q.options!.indexOf("3")];
    if (q.id === "c") out.c = true;
    if (q.id === "d") out.d = "  kampala ";
    if (q.id === "e") out.e = ["first", "second", "third"].map((t) => q.options!.indexOf(t));
    if (q.id === "f") out.f = ["meow", "woof"].map((t) => q.right!.indexOf(t));
  }
  return out;
}

test("the same seed serves the same paper, and no answers are served", () => {
  const one = serveQuestions(paper, 7);
  assert.deepEqual(one, serveQuestions(paper, 7));
  assert.ok(!JSON.stringify(one).includes("correct"));
  assert.equal(one.length, 6);
});

test("a perfect sheet scores 100 for any shuffle", () => {
  for (const seed of [1, 2, 99, 123456]) {
    const m = mark(paper, seed, perfect(seed), false);
    assert.equal(m.scorePercent, 100, `seed ${seed}`);
    assert.ok(m.passed);
  }
});

test("wrong, partial and missing answers lose marks", () => {
  const sheet = perfect(5);
  sheet.b = [(sheet.b as number[])[0]];
  delete sheet.d;
  sheet.e = [0, 1, 2];
  const m = mark(paper, 5, sheet, true);
  assert.ok(m.scorePercent < 100);
  const b = m.results.find((r) => r.id === "b")!;
  assert.equal(b.correct, false);
  assert.ok(b.reveal?.answer.includes("2"));
  assert.equal(mark(paper, 5, sheet, false).results[0].reveal, undefined);
});

test("garbage answers never score", () => {
  const m = mark(paper, 3, { a: 99, b: "x", c: "true", d: 5, e: [9, 9, 9], f: [0, 0] }, false);
  assert.equal(m.earned, 0);
});

test("old single-choice quizzes still load", () => {
  const old = parseQuiz({ title: "t", passingScorePercent: 50, questions: [{ question: "q", options: ["x", "y"], correctIndex: 0 }] });
  assert.equal(old?.questions[0].type, "single");
  assert.equal(parseQuiz({ questions: [] }), null);
  assert.equal(parseQuiz("not json"), null);
});

test("a draw of questions serves only that many", () => {
  const small = parseQuiz({ ...paper, settings: { ...paper.settings, questionsPerAttempt: 3 } })!;
  assert.equal(serveQuestions(small, 4).length, 3);
});

test("attempt tokens round-trip and reject tampering", async () => {
  process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
  const token = await signAttempt("u1", "l1", 42, 10);
  const claims = await readAttempt(token);
  assert.deepEqual({ ...claims, startedAt: 0 }, { userId: "u1", lessonId: "l1", seed: 42, startedAt: 0 });
  assert.equal(await readAttempt(token + "x"), null);
});
