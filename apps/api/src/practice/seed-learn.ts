import bcrypt from "bcryptjs";
import { db, type DbStatement } from "../db/client.js";
import { DEMO_STEPS, installDemoStep } from "../education/demo.js";
import { runSeed } from "./batch.js";

/**
 * The Learn cluster. The educators, schools, classes, courses, lessons, quizzes and the two trial live classes come from
 * the existing demo installer. On top of that this adds learners and everything learners and teachers do around a
 * course: enrolments (free, paid, masterclass), progress, quizzes, certificates, badges, assignments, reviews, Q&A,
 * announcements, cohorts, coupons, bundles, school passes, fees, prerequisites, drip release, co-teachers, live class
 * attendance, a parent PIN and a paired TV.
 */
const NO_PASSWORD = "practice-account-no-password";
const when = (offset: string) => `datetime('now', '${offset}')`;

export const PRACTICE_LEARNERS = [
  { id: "prac_learn_1", name: "Esther Namara", phone: "00000081" },
  { id: "prac_learn_2", name: "Joel Okello", phone: "00000082" },
  { id: "prac_learn_3", name: "Ritah Namuddu", phone: "00000083" },
  { id: "prac_learn_4", name: "Kevin Mugabi", phone: "00000084" },
] as const;

type Row = Record<string, unknown>;

export async function seedLearn(): Promise<void> {
  for (let step = 0; step < DEMO_STEPS; step++) await installDemoStep(step);

  const s: DbStatement[] = [];
  const [L1, L2, L3, L4] = PRACTICE_LEARNERS.map((l) => l.id) as [string, string, string, string];
  for (const l of PRACTICE_LEARNERS) {
    s.push({ sql: "INSERT OR IGNORE INTO users (id, phone, name, password_hash, role, status, phone_verified_at) VALUES (?, ?, ?, ?, 'customer', 'active', datetime('now'))", args: [l.id, l.phone, l.name, NO_PASSWORD] });
  }

  const courses = (await db.execute("SELECT c.id, c.school_id, c.class_id, c.stream, c.title, s.owner_id FROM edu_courses c JOIN edu_schools s ON s.id = c.school_id WHERE c.id LIKE 'crs\\_demo\\_%' ESCAPE '\\' ORDER BY c.id")).rows as Row[];
  const bySchool = (school: string) => courses.filter((c) => c.school_id === school);
  const hilltop = bySchool("sch_demo_hilltop");
  const lakeview = bySchool("sch_demo_lakeview");
  const nilebiz = bySchool("sch_demo_nilebiz");
  const skills = bySchool("sch_demo_skillshub");
  const lessonsOf = async (course: string) => (await db.execute({ sql: "SELECT id, module_id, quiz_json FROM edu_lessons WHERE course_id = ? ORDER BY module_id, position", args: [course] })).rows as Row[];

  // A paid course, a masterclass and the lessons to go with them, in schools that already exist.
  const skillsOwner = String(skills[0]!.owner_id);
  const skillsClass = String(skills[0]!.class_id);
  const extra = [
    { id: "prac_crs_paid_1", school: "sch_demo_skillshub", cls: skillsClass, stream: String(skills[0]!.stream), title: "Start a Small Business in Uganda", price: 45_000, owner: skillsOwner },
    { id: "prac_crs_paid_2", school: "sch_demo_nilebiz", cls: String(nilebiz[0]!.class_id), stream: String(nilebiz[0]!.stream), title: "Bookkeeping with Mobile Money", price: 80_000, owner: String(nilebiz[0]!.owner_id) },
  ];
  s.push({ sql: "INSERT OR IGNORE INTO edu_classes (id, school_id, stream, kind, name, level, summary, status) VALUES ('prac_cls_master', 'sch_demo_skillshub', ?, 'masterclass', 'Guitar Masterclass', 'All levels', 'Four evenings with a working Kampala guitarist.', 'published')", args: [String(skills[0]!.stream)] });
  extra.push({ id: "prac_crs_master", school: "sch_demo_skillshub", cls: "prac_cls_master", stream: String(skills[0]!.stream), title: "Guitar Masterclass: Chords to Songs", price: 25_000, owner: skillsOwner });
  for (const c of extra) {
    s.push({ sql: "INSERT OR IGNORE INTO edu_courses (id, school_id, class_id, stream, title, summary, price_ugx, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'published')", args: [c.id, c.school, c.cls, c.stream, c.title, `${c.title}: practical lessons you can use this week.`, c.price] });
    s.push({ sql: "INSERT OR IGNORE INTO edu_modules (id, course_id, title, description, position) VALUES (?, ?, 'Getting started', 'The first steps', 1)", args: [`${c.id}_m1`, c.id] });
    [1, 2, 3].forEach((n) => s.push({
      sql: "INSERT OR IGNORE INTO edu_lessons (id, module_id, course_id, title, content_type, duration_minutes, summary, position, body) VALUES (?, ?, ?, ?, 'text', ?, ?, ?, ?)",
      args: [`${c.id}_l${n}`, `${c.id}_m1`, c.id, `Lesson ${n}: ${["The basics", "Putting it to work", "Common mistakes"][n - 1]}`, 8 + n * 2, "A short, practical lesson.", n, `Practice lesson ${n} of ${c.title}.`],
    }));
  }

  // Enrolments: every learner is on something free, and three of them paid for a course.
  const enrol = (user: string, course: Row | (typeof extra)[number], paid: number) => {
    const school = String("school" in course ? course.school : (course as Row).school_id);
    s.push({
      sql: "INSERT OR IGNORE INTO edu_enrollments (id, course_id, school_id, user_id, status, price_paid_ugx, commission_ugx, environment, created_at) VALUES (?, ?, ?, ?, 'active', ?, ?, 'sandbox', " + when("-6 days") + ")",
      args: [`prac_enr_${user}_${String(course.id)}`, String(course.id), school, user, paid, Math.round(paid * 0.1)],
    });
  };
  hilltop.slice(0, 3).forEach((c) => enrol(L1, c, 0));
  lakeview.slice(0, 2).forEach((c) => enrol(L2, c, 0));
  enrol(L2, extra[0]!, 45_000);
  enrol(L3, extra[0]!, 36_000); // bought with a coupon
  enrol(L3, extra[2]!, 25_000);
  nilebiz.slice(0, 2).forEach((c) => enrol(L4, c, 0));
  enrol(L4, extra[1]!, 80_000);

  // Progress: Esther has finished her first course, the others are part-way.
  const finishedCourse = hilltop[0]!;
  const finishedLessons = await lessonsOf(String(finishedCourse.id));
  for (const l of finishedLessons) s.push({ sql: "INSERT OR IGNORE INTO edu_lesson_progress (user_id, lesson_id, course_id, best_score_percent, completed_at) VALUES (?, ?, ?, ?, " + when("-2 days") + ")", args: [L1, String(l.id), String(finishedCourse.id), l.quiz_json ? 90 : null] });
  for (const [user, list] of [[L2, lakeview], [L4, nilebiz]] as const) {
    for (const l of (await lessonsOf(String(list[0]!.id))).slice(0, 3)) s.push({ sql: "INSERT OR IGNORE INTO edu_lesson_progress (user_id, lesson_id, course_id, best_score_percent, completed_at) VALUES (?, ?, ?, ?, " + when("-1 days") + ")", args: [user, String(l.id), String(list[0]!.id), l.quiz_json ? 72 : null] });
  }
  const quizLessons = finishedLessons.filter((l) => l.quiz_json);
  quizLessons.slice(0, 2).forEach((l, i) => s.push({
    sql: "INSERT OR IGNORE INTO edu_quiz_attempts (id, user_id, lesson_id, course_id, score_percent, passed, answers_json) VALUES (?, ?, ?, ?, ?, 1, '[]')",
    args: [`prac_qa_${i}`, L1, String(l.id), String(finishedCourse.id), 90 - i * 10],
  }));
  s.push({ sql: "INSERT OR IGNORE INTO edu_certificates (id, code, course_id, user_id, learner_name, course_title, school_name, score_percent) VALUES ('prac_cert_1', 'PB-CERT-PRAC01', ?, ?, 'Esther Namara', ?, 'Hilltop Junior Academy', 90)", args: [String(finishedCourse.id), L1, String(finishedCourse.title)] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_badges (user_id, badge, course_id) VALUES (?, 'first_lesson', ?)", args: [L1, String(finishedCourse.id)] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_badges (user_id, badge, course_id) VALUES (?, 'perfect_quiz', ?)", args: [L1, String(finishedCourse.id)] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_badges (user_id, badge, course_id) VALUES (?, 'first_lesson', ?)", args: [L2, String(lakeview[0]!.id)] });

  // Assignments with a handed-in, marked piece of work.
  const assignmentLesson = (await lessonsOf(String(lakeview[0]!.id)))[1];
  if (assignmentLesson) {
    s.push({ sql: "INSERT OR IGNORE INTO edu_assignments (lesson_id, max_points, pass_percent, due_at, allow_resubmit) VALUES (?, 100, 50, " + when("+5 days") + ", 1)", args: [String(assignmentLesson.id)] });
    s.push({
      sql: "INSERT OR IGNORE INTO edu_submissions (id, lesson_id, course_id, user_id, body, status, score, feedback, submitted_at, graded_at, graded_by) VALUES ('prac_sub_1', ?, ?, ?, 'My answers are attached: I worked through all five questions.', 'graded', 82, 'Well done. Check question 4 again.', " + when("-1 days") + ", " + when("-3 hours") + ", ?)",
      args: [String(assignmentLesson.id), String(lakeview[0]!.id), L2, String(lakeview[0]!.owner_id)],
    });
  }
  const assignment2 = (await lessonsOf("prac_crs_paid_1"))[0];
  s.push({ sql: "INSERT OR IGNORE INTO edu_assignments (lesson_id, max_points, pass_percent, due_at, allow_resubmit) VALUES ('prac_crs_paid_1_l2', 50, 60, " + when("+9 days") + ", 0)", args: [] });
  void assignment2;

  // Reviews, questions and answers, announcements.
  s.push({ sql: "INSERT OR IGNORE INTO edu_reviews (course_id, user_id, rating, body, reply, created_at, replied_at) VALUES (?, ?, 5, 'My daughter loves the stories and the sounds game.', 'Thank you! We are adding more stories next week.', " + when("-2 days") + ", " + when("-1 days") + ")", args: [String(finishedCourse.id), L1] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_reviews (course_id, user_id, rating, body, created_at) VALUES (?, ?, 4, 'Clear lessons, would like more practice questions.', " + when("-1 days") + ")", args: [String(lakeview[0]!.id), L2] });
  const qLesson = finishedLessons[0]!;
  s.push({ sql: "INSERT OR IGNORE INTO edu_questions (id, course_id, lesson_id, user_id, body, created_at) VALUES ('prac_q_1', ?, ?, ?, 'Can we repeat the sounds game at home with household items?', " + when("-2 days") + ")", args: [String(finishedCourse.id), String(qLesson.id), L1] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_answers (id, question_id, user_id, body, by_teacher, created_at) VALUES ('prac_a_1', 'prac_q_1', ?, 'Yes, any objects work. Name each one and say its first sound.', 1, " + when("-2 days", ) + ")", args: [String(finishedCourse.owner_id)] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_answers (id, question_id, user_id, body, by_teacher, created_at) VALUES ('prac_a_2', 'prac_q_1', ?, 'We used spoons and cups, it worked well.', 0, " + when("-1 days") + ")", args: [L3] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_announcements (id, course_id, user_id, title, body, created_at) VALUES ('prac_ann_1', ?, ?, 'New story added', 'A new Luganda folk story is now in Module 2.', " + when("-1 days") + ")", args: [String(finishedCourse.id), String(finishedCourse.owner_id)] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_announcements (id, course_id, user_id, title, body, created_at) VALUES ('prac_ann_2', 'prac_crs_paid_1', ?, 'Week one starts Monday', 'Bring a notebook. We begin with your business idea.', " + when("-3 hours") + ")", args: [skillsOwner] });

  // Cohorts, coupons, bundles, school passes.
  s.push({ sql: "INSERT OR IGNORE INTO edu_cohorts (id, course_id, name, starts_at, enrol_until, capacity) VALUES ('prac_coh_1', 'prac_crs_paid_1', 'January intake', " + when("+12 days") + ", " + when("+10 days") + ", 30)", args: [] });
  for (const user of [L2, L3]) s.push({ sql: "INSERT OR IGNORE INTO edu_cohort_members (cohort_id, user_id, course_id) VALUES ('prac_coh_1', ?, 'prac_crs_paid_1')", args: [user] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_coupons (id, school_id, code, percent_off, course_id, max_uses, used_count, expires_at, active) VALUES ('prac_cpn_1', 'sch_demo_skillshub', 'PRACTICE20', 20, 'prac_crs_paid_1', 50, 1, " + when("+30 days") + ", 1)", args: [] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_coupon_redemptions (coupon_id, user_id, course_id, discount_ugx) VALUES ('prac_cpn_1', ?, 'prac_crs_paid_1', 9000)", args: [L3] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_bundles (id, school_id, title, summary, price_ugx, status) VALUES ('prac_bun_1', 'sch_demo_skillshub', 'Business + Guitar bundle', 'Both courses for less.', 60000, 'published')", args: [] });
  for (const course of ["prac_crs_paid_1", "prac_crs_master"]) s.push({ sql: "INSERT OR IGNORE INTO edu_bundle_courses (bundle_id, course_id) VALUES ('prac_bun_1', ?)", args: [course] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_bundle_purchases (id, bundle_id, user_id, price_paid_ugx, commission_ugx, environment) VALUES ('prac_bp_1', 'prac_bun_1', ?, 60000, 6000, 'sandbox')", args: [L4] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_plans (id, school_id, title, summary, price_ugx, days, status) VALUES ('prac_plan_1', 'sch_demo_lakeview', 'Term pass', 'Every Lakeview course for a term.', 120000, 90, 'published')", args: [] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_subscriptions (id, plan_id, school_id, user_id, price_paid_ugx, commission_ugx, environment, expires_at) VALUES ('prac_subs_1', 'prac_plan_1', 'sch_demo_lakeview', ?, 120000, 12000, 'sandbox', " + when("+60 days") + ")", args: [L2] });

  // School fees: one part-paid invoice and one settled.
  s.push({ sql: "INSERT OR IGNORE INTO edu_fee_invoices (id, school_id, student_id, title, amount_ugx, paid_ugx, due_date, status, created_by) VALUES ('prac_inv_1', 'sch_demo_lakeview', ?, 'Term 3 tuition', 250000, 100000, " + when("+14 days") + ", 'partial', ?)", args: [L2, String(lakeview[0]!.owner_id)] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_fee_invoices (id, school_id, student_id, title, amount_ugx, paid_ugx, due_date, status, created_by) VALUES ('prac_inv_2', 'sch_demo_hilltop', ?, 'Term 3 school trip', 40000, 40000, " + when("-5 days") + ", 'paid', ?)", args: [L1, String(hilltop[0]!.owner_id)] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_fee_payments (id, invoice_id, payer_id, amount_ugx, commission_ugx, environment) VALUES ('prac_fp_1', 'prac_inv_1', ?, 100000, 5000, 'sandbox')", args: [L2] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_fee_payments (id, invoice_id, payer_id, amount_ugx, commission_ugx, environment) VALUES ('prac_fp_2', 'prac_inv_2', ?, 40000, 2000, 'sandbox')", args: [L1] });

  // Order of study, release over time, co-teachers, a teacher's plan.
  s.push({ sql: "INSERT OR IGNORE INTO edu_course_rules (course_id, sequential, prerequisite_course_id, certificate_enabled) VALUES ('prac_crs_paid_2', 1, ?, 1)", args: [String(nilebiz[0]!.id)] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_course_rules (course_id, sequential, certificate_enabled) VALUES (?, 1, 1)", args: [String(lakeview[0]!.id)] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_module_drip (module_id, drip_days) VALUES ('prac_crs_paid_1_m1', 3)", args: [] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_course_instructors (course_id, user_id, added_by) VALUES (?, 'usr_demo_sandra', ?)", args: [String(hilltop[0]!.id), String(hilltop[0]!.owner_id)] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_educator_plans (user_id, plan, source) VALUES (?, 'pro', 'practice')", args: [skillsOwner] });

  // Live class: two learners are in the trial class and one has a hand up.
  s.push({ sql: "INSERT OR IGNORE INTO edu_live_members (session_id, user_id, present_at, hand_raised_at) VALUES ('liv_demo_a', ?, " + when("-4 minutes") + ", NULL)", args: [L1] });
  s.push({ sql: "INSERT OR IGNORE INTO edu_live_members (session_id, user_id, present_at, hand_raised_at) VALUES ('liv_demo_a', ?, " + when("-3 minutes") + ", " + when("-1 minutes") + ")", args: [L2] });
  const attended = finishedLessons[1];
  if (attended) s.push({ sql: "INSERT OR IGNORE INTO edu_live_attendance (lesson_id, user_id, course_id) VALUES (?, ?, ?)", args: [String(attended.id), L1, String(finishedCourse.id)] });

  // A parent's PIN for the child's account and a TV that is already paired.
  s.push({ sql: "INSERT OR IGNORE INTO edu_parent_pins (user_id, pin_hash) VALUES (?, ?)", args: [L1, bcrypt.hashSync("1234", 8)] });
  s.push({ sql: "INSERT OR IGNORE INTO tv_devices (id, owner_id, name, secret_hash, status, paired_at, last_seen_at) VALUES ('prac_tv_1', ?, 'Living room TV', 'practice-tv-secret', 'paired', " + when("-3 days") + ", " + when("-2 hours") + ")", args: [L1] });

  await runSeed(s);
}
