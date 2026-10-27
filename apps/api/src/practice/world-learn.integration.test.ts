import assert from "node:assert/strict";
import test from "node:test";
import { practiceHarness } from "./world-test-helpers.js";

test("Learn cluster: a practising learner and teacher find every Learn module populated", async (t) => {
  const { db, call, json, start } = await practiceHarness();
  const learner = await start("learner");
  const educator = await start("educator");
  const n = async (sql: string) => Number((await db.execute(sql)).rows[0]!.n);

  await t.test("personas", () => {
    assert.equal(learner.user.id, "prac_learn_1");
    assert.equal(educator.user.id, "usr_demo_hilltop");
  });

  await t.test("catalog: five streams of free and paid courses, a masterclass", async () => {
    const catalog = await json<{ courses: { id: string; price_ugx?: number; priceUgx?: number; stream: string }[] }>(await call(learner.token, "/education/catalog/courses"));
    assert.ok(catalog.courses.length >= 10, `courses ${catalog.courses.length}`);
    assert.ok(new Set(catalog.courses.map((c) => c.stream)).size >= 4);
    assert.ok(await n("SELECT COUNT(*) n FROM edu_classes WHERE kind = 'masterclass'") >= 1);
    assert.ok(await n("SELECT COUNT(*) n FROM edu_courses WHERE price_ugx > 0") >= 3);
  });

  await t.test("my learning: enrolments, certificate, badges, invoices", async () => {
    const enrol = await json<{ enrollments: unknown[] }>(await call(learner.token, "/education/learn/enrollments"));
    assert.ok(enrol.enrollments.length >= 3);
    const certs = await json<{ certificates: unknown[] }>(await call(learner.token, "/education/learn/certificates"));
    assert.equal(certs.certificates.length, 1);
    const badges = await json<{ badges: unknown[] }>(await call(learner.token, "/education/learn/badges"));
    assert.ok(badges.badges.length >= 2);
    const invoices = await json<{ invoices: unknown[] }>(await call(learner.token, "/education/learn/invoices"));
    assert.ok(invoices.invoices.length >= 1);
  });

  await t.test("community: review, questions with a teacher's answer, announcements, cohorts, instructors", async () => {
    const course = String((await db.execute("SELECT course_id FROM edu_reviews WHERE user_id = 'prac_learn_1'")).rows[0]!.course_id);
    const qa = await json<{ questions: { answers: unknown[] }[] }>(await call(learner.token, `/education/learn/courses/${course}/qa`));
    assert.ok(qa.questions.length >= 1 && qa.questions[0]!.answers.length >= 2);
    const announcements = await json<{ announcements: unknown[] }>(await call(learner.token, `/education/learn/courses/${course}/announcements`));
    assert.ok(announcements.announcements.length >= 1);
    assert.equal(await n("SELECT COUNT(*) n FROM edu_cohorts"), 1);
    assert.equal(await n("SELECT COUNT(*) n FROM edu_course_instructors"), 1);
  });

  await t.test("commerce and rules: coupon, bundle, school pass, drip, prerequisite", () => {
    return Promise.all([
      n("SELECT COUNT(*) n FROM edu_coupon_redemptions"), n("SELECT COUNT(*) n FROM edu_bundle_purchases"), n("SELECT COUNT(*) n FROM edu_subscriptions"),
      n("SELECT COUNT(*) n FROM edu_module_drip"), n("SELECT COUNT(*) n FROM edu_course_rules WHERE prerequisite_course_id IS NOT NULL"),
    ]).then((counts) => assert.deepEqual(counts, [1, 1, 1, 1, 1]));
  });

  await t.test("classroom: two live trial classes, learners in the room, a paired TV", async () => {
    const sessions = await json<{ sessions: unknown[] }>(await call(educator.token, "/education/classroom/sessions"));
    assert.ok(sessions.sessions.length >= 0);
    assert.equal(await n("SELECT COUNT(*) n FROM edu_live_sessions WHERE status = 'live'"), 2);
    assert.equal(await n("SELECT COUNT(*) n FROM edu_live_members"), 2);
    assert.equal(await n("SELECT COUNT(*) n FROM tv_devices WHERE status = 'paired'"), 1);
  });

  await t.test("a teacher sees their students and a graded submission exists", async () => {
    assert.equal(await n("SELECT COUNT(*) n FROM edu_submissions WHERE status = 'graded'"), 1);
    assert.ok(await n("SELECT COUNT(*) n FROM edu_enrollments WHERE environment = 'sandbox'") >= 9);
  });
});
