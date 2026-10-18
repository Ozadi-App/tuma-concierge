"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLearnAuth } from "../lib/auth-context";
import {
  EDUCATION_STREAMS,
  DEMO_CREATORS,
  DEMO_CREATOR_COURSES,
  DEMO_LIVE_MEETINGS,
  DEMO_FOUNDATIONS_SUBMISSIONS,
  DEMO_SKILLS_SUBMISSION,
  DEMO_ACADEMY_REPORT_CARD,
  type EducationStreamId,
  type CreatorProfile,
  type CreatorCourse,
  type CourseLesson,
} from "@peebee/shared";
import {
  Video,
  MessageSquare,
  BookOpen,
  CheckCircle2,
  FileText,
  Clock,
  ShieldCheck,
  X,
  Plus,
  Users,
  ArrowDownToLine,
  ClipboardCheck,
  Building2,
} from "lucide-react";

type EducatorTab = "courses" | "publish_course" | "add_lesson" | "grading";

const STREAM_LABELS: Record<EducationStreamId, string> = {
  sprouts: "Sprouts · Ages 3–6",
  foundations: "Foundations · Ages 6–12",
  academy: "Academy · Ages 12–18",
  campus: "Campus · Higher Ed & Business",
  skills: "Skills · Vocational Trades",
};

const CREATOR_TYPE_LABELS: Record<CreatorProfile["type"], string> = {
  school: "Primary School",
  academy: "Academy & Institute",
  vocational_guild: "Vocational Guild",
  early_childhood_center: "Kindergarten Hub",
  independent_tutor: "Independent Tutor",
};

function formatUgx(amount: number) {
  return `UGX ${amount.toLocaleString()}`;
}

export default function EducatorStudioHomePage() {
  const { setActiveStream } = useLearnAuth();

  // Active school / educator profile being managed in the Educator App
  const [creators, setCreators] = useState<CreatorProfile[]>(DEMO_CREATORS);
  const [courses, setCourses] = useState<CreatorCourse[]>(DEMO_CREATOR_COURSES);
  const [activeCreatorId, setActiveCreatorId] = useState<string>(DEMO_CREATORS[0].id);
  const [activeTab, setActiveTab] = useState<EducatorTab>("courses");

  // Course curriculum drill-down for the educator
  const [inspectingCourseId, setInspectingCourseId] = useState<string | null>(null);

  // Publish New Course state
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseStream, setNewCourseStream] = useState<EducationStreamId>("foundations");
  const [newCourseLevel, setNewCourseLevel] = useState("Primary 5");
  const [newCoursePrice, setNewCoursePrice] = useState("280000");
  const [newCourseSummary, setNewCourseSummary] = useState("");

  // Add Lesson & Quiz state
  const [targetCourseId, setTargetCourseId] = useState<string>(DEMO_CREATOR_COURSES[0].id);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonDuration, setNewLessonDuration] = useState("25");
  const [newLessonSummary, setNewLessonSummary] = useState("");
  const [newQuizQuestion, setNewQuizQuestion] = useState("");
  const [newQuizOptionA, setNewQuizOptionA] = useState("");
  const [newQuizOptionB, setNewQuizOptionB] = useState("");

  // Grading & Payout state
  const [notice, setNotice] = useState<string | null>(null);
  const [gradedSubmissionIds, setGradedSubmissionIds] = useState<string[]>([]);
  const [newCritiquePinText, setNewCritiquePinText] = useState("");
  const [critiquePins, setCritiquePins] = useState(DEMO_SKILLS_SUBMISSION.critiques);

  const activeCreator = useMemo(
    () => creators.find((c) => c.id === activeCreatorId) ?? creators[0],
    [creators, activeCreatorId]
  );

  const creatorCourses = useMemo(
    () => courses.filter((c) => c.creatorId === activeCreator.id),
    [courses, activeCreator.id]
  );

  const inspectingCourse = useMemo(
    () => courses.find((c) => c.id === inspectingCourseId) ?? null,
    [courses, inspectingCourseId]
  );

  const creatorLiveRoom = useMemo(
    () =>
      DEMO_LIVE_MEETINGS.find((m) => m.stream === activeCreator.stream) ??
      DEMO_LIVE_MEETINGS[0],
    [activeCreator.stream]
  );

  function handleSelectCreator(creator: CreatorProfile) {
    setActiveCreatorId(creator.id);
    setActiveStream(creator.stream);
    setNewCourseStream(creator.stream);
    setInspectingCourseId(null);
    const firstCourse = courses.find((c) => c.creatorId === creator.id);
    if (firstCourse) setTargetCourseId(firstCourse.id);
  }

  function handleWithdrawPayout() {
    if (activeCreator.payoutBalanceUgx <= 0) return;
    const amount = activeCreator.payoutBalanceUgx;
    setCreators((prev) =>
      prev.map((c) => (c.id === activeCreator.id ? { ...c, payoutBalanceUgx: 0 } : c))
    );
    setNotice(
      `Settlement of ${formatUgx(amount)} initiated for ${activeCreator.name} (${activeCreator.leadInstructor}).`
    );
  }

  function handlePublishCourse(e: FormEvent) {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;

    const created: CreatorCourse = {
      id: `course_custom_${Date.now()}`,
      creatorId: activeCreator.id,
      creatorName: activeCreator.name,
      creatorAvatar: activeCreator.avatarUrl,
      creatorRoleTitle: `${activeCreator.leadInstructor} (${activeCreator.leadInstructorTitle})`,
      institutionName: activeCreator.name,
      title: newCourseTitle.trim(),
      stream: newCourseStream,
      category: STREAM_LABELS[newCourseStream],
      level: newCourseLevel.trim() || "All Levels",
      summary:
        newCourseSummary.trim() ||
        "Structured course with interactive lessons, downloadable study resources, and graded assessments.",
      thumbnailUrl: activeCreator.bannerUrl ?? activeCreator.avatarUrl,
      priceUgx: Number(newCoursePrice) || 150000,
      enrolledStudentsCount: 1,
      rating: 5.0,
      reviewCount: 1,
      modules: [
        {
          id: `mod_custom_${Date.now()}`,
          title: "Module 1: Core Foundations & Practicals",
          description: "Published via Peebee Learn Educator Studio.",
          order: 1,
          lessons: [
            {
              id: `les_custom_${Date.now()}`,
              title: "Lesson 1: Course Orientation & Syllabus",
              durationMinutes: 20,
              contentType: "video",
              summary: "Welcome lecture, study expectations, and assessment schedule.",
              quiz: {
                id: `quiz_custom_${Date.now()}`,
                title: "Orientation Checkpoint Quiz",
                instructions: "Complete this quick checkpoint to unlock Lesson 2.",
                timeLimitMinutes: 5,
                passingScorePercent: 50,
                questions: [
                  {
                    id: `q_custom_${Date.now()}`,
                    questionText: `Which educator published "${newCourseTitle.trim()}"?`,
                    options: [activeCreator.name, "Other Institution"],
                    correctOptionIndex: 0,
                    explanation: `Published by ${activeCreator.name} (${activeCreator.leadInstructor}).`,
                    points: 5,
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    setCourses((prev) => [created, ...prev]);
    setCreators((prev) =>
      prev.map((c) =>
        c.id === activeCreator.id ? { ...c, courses: [created, ...c.courses] } : c
      )
    );
    setTargetCourseId(created.id);
    setNewCourseTitle("");
    setNewCourseSummary("");
    setActiveTab("courses");
    setNotice(
      `Published "${created.title}" to the Peebee Learn catalog under ${activeCreator.name}.`
    );
  }

  function handleAddLesson(e: FormEvent) {
    e.preventDefault();
    if (!newLessonTitle.trim()) return;
    const targetCourse = courses.find((c) => c.id === targetCourseId);
    if (!targetCourse) return;

    const newLesson: CourseLesson = {
      id: `les_${Date.now()}`,
      title: newLessonTitle.trim(),
      durationMinutes: Number(newLessonDuration) || 25,
      contentType: "video",
      summary:
        newLessonSummary.trim() ||
        "Structured lesson with study notes and checkpoint quiz.",
      quiz: newQuizQuestion.trim()
        ? {
            id: `quiz_${Date.now()}`,
            title: `${newLessonTitle.trim()} — Checkpoint Quiz`,
            instructions: "Answer the checkpoint question below.",
            timeLimitMinutes: 10,
            passingScorePercent: 70,
            questions: [
              {
                id: `q_${Date.now()}`,
                questionText: newQuizQuestion.trim(),
                options: [
                  newQuizOptionA.trim() || "Correct Answer",
                  newQuizOptionB.trim() || "Alternative Option",
                ],
                correctOptionIndex: 0,
                explanation: `Verified by ${activeCreator.leadInstructor}.`,
                points: 10,
              },
            ],
          }
        : undefined,
    };

    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== targetCourseId) return c;
        const firstMod = c.modules[0] ?? {
          id: `mod_${Date.now()}`,
          title: "Module 1",
          description: "Core curriculum",
          order: 1,
          lessons: [],
        };
        return {
          ...c,
          modules: [{ ...firstMod, lessons: [...firstMod.lessons, newLesson] }, ...c.modules.slice(1)],
        };
      })
    );

    setNewLessonTitle("");
    setNewLessonSummary("");
    setNewQuizQuestion("");
    setNewQuizOptionA("");
    setNewQuizOptionB("");
    setInspectingCourseId(targetCourse.id);
    setActiveTab("courses");
    setNotice(`Added "${newLesson.title}" to ${targetCourse.title}.`);
  }

  return (
    <div className="space-y-5 pb-10">
      {/* ─── Active Institution / Educator Switcher Banner (matches Pharmacy & Merchant apps) ─── */}
      <section className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={activeCreator.avatarUrl}
              alt={activeCreator.name}
              className="h-12 w-12 rounded-2xl object-cover border border-[var(--border-faint)] shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {CREATOR_TYPE_LABELS[activeCreator.type]} · {activeCreator.badge}
                </span>
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-semibold text-cream truncate">
                {activeCreator.name}
              </h1>
              <p className="text-xs text-ink-500 truncate">
                {activeCreator.leadInstructor} ({activeCreator.leadInstructorTitle}) ·{" "}
                {activeCreator.location}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href={`/live/${creatorLiveRoom.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-semibold text-ink-gold"
            >
              <Video className="h-3.5 w-3.5" />
              Host Live Class
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3.5 py-2 text-xs font-semibold text-cream hover:border-gold/40"
            >
              <MessageSquare className="h-3.5 w-3.5 text-gold" />
              Student Messages
            </Link>
          </div>
        </div>

        {/* Switch Demo School / Educator Account */}
        <div className="border-t border-[var(--border-faint)] pt-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 shrink-0 mr-1">
              Switch Educator:
            </span>
            {creators.map((c) => {
              const selected = c.id === activeCreator.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCreator(c)}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition ${
                    selected
                      ? "bg-gold text-ink-gold"
                      : "bg-[rgb(var(--surface-muted))] text-ink-500 hover:text-cream"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {notice && (
        <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs text-gold flex items-center justify-between">
          <span>✓ {notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-cream">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ─── Educator KPI & Tuition Settlement Row (matches apps/merchant & apps/pharmacy) ─── */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 flex flex-col justify-between gap-3">
          <div>
            <p className="text-xs text-ink-500">Available Tuition to Settle</p>
            <p className="mt-1 font-display text-2xl font-semibold text-gold">
              {formatUgx(activeCreator.payoutBalanceUgx)}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-500">
              Cumulative Earnings: {formatUgx(activeCreator.totalEarningsUgx)}
            </p>
          </div>
          <button
            type="button"
            disabled={activeCreator.payoutBalanceUgx <= 0}
            onClick={handleWithdrawPayout}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-semibold text-ink-gold disabled:opacity-40"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            {activeCreator.payoutBalanceUgx > 0 ? "Withdraw to Mobile Money" : "Settled"}
          </button>
        </div>

        <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-500">Enrolled Students</span>
            <Users className="h-4 w-4 text-gold" />
          </div>
          <div>
            <p className="font-display text-2xl font-semibold text-cream">
              {activeCreator.enrolledStudents.toLocaleString()}
            </p>
            <p className="text-[11px] text-ink-500 mt-0.5">
              ★ {activeCreator.rating.toFixed(1)} rating ({activeCreator.reviewCount} student reviews)
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-500">Published Courses</span>
            <BookOpen className="h-4 w-4 text-gold" />
          </div>
          <div>
            <p className="font-display text-2xl font-semibold text-cream">
              {creatorCourses.length}
            </p>
            <p className="text-[11px] text-ink-500 mt-0.5">
              Stream: {STREAM_LABELS[activeCreator.stream]}
            </p>
          </div>
        </div>
      </section>

      {/* ─── Educator Studio Workspace Switcher ─── */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-1">
        {(
          [
            { id: "courses", label: `My Courses (${creatorCourses.length})`, icon: BookOpen },
            { id: "publish_course", label: "Publish New Course", icon: Plus },
            { id: "add_lesson", label: "Add Lesson & Quiz", icon: FileText },
            { id: "grading", label: "Student Submissions & Grading", icon: ClipboardCheck },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                active ? "bg-gold text-ink-gold" : "text-ink-500 hover:text-cream"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          TAB 1: MY PUBLISHED COURSES & CURRICULUM MANAGER
         ===================================================================== */}
      {activeTab === "courses" && (
        <div className="space-y-4">
          {inspectingCourse ? (
            <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-faint)] pb-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                    {STREAM_LABELS[inspectingCourse.stream]} · {inspectingCourse.level}
                  </span>
                  <h2 className="font-display text-lg sm:text-xl font-semibold text-cream">
                    {inspectingCourse.title}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetCourseId(inspectingCourse.id);
                      setActiveTab("add_lesson");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink-gold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Lesson & Quiz
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectingCourseId(null)}
                    className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3 py-1.5 text-xs font-semibold text-cream"
                  >
                    Back to Courses
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {inspectingCourse.modules.map((mod) => (
                  <div
                    key={mod.id}
                    className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-3"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-cream">{mod.title}</h3>
                      <p className="text-xs text-ink-500">{mod.description}</p>
                    </div>
                    <div className="space-y-2">
                      {mod.lessons.map((lesson, idx) => (
                        <div
                          key={lesson.id}
                          className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3.5 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-cream">
                              Lesson {idx + 1}: {lesson.title}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-ink-500">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{lesson.durationMinutes} mins</span>
                              {lesson.quiz && (
                                <span className="rounded bg-gold/15 px-2 py-0.5 font-semibold text-gold">
                                  Quiz: {lesson.quiz.questions.length} Qs
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-ink-500">{lesson.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {creatorCourses.map((course) => {
                const lessonCount = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
                const quizCount = course.modules.reduce(
                  (acc, m) => acc + m.lessons.filter((l) => l.quiz).length,
                  0
                );
                return (
                  <div
                    key={course.id}
                    className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-36 w-full bg-[rgb(var(--surface-muted))]">
                        <img
                          src={course.thumbnailUrl}
                          alt={course.title}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute top-2.5 left-2.5 rounded-lg bg-[rgb(var(--surface-card))]/90 px-2.5 py-1 text-[11px] font-semibold text-gold">
                          {STREAM_LABELS[course.stream]}
                        </div>
                        <div className="absolute top-2.5 right-2.5 rounded-lg bg-[rgb(var(--surface-card))]/90 px-2.5 py-1 text-[11px] font-semibold text-cream">
                          {course.enrolledStudentsCount} Enrolled
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="text-xs text-ink-500">
                          {course.level} · Tuition: <strong className="text-cream">{formatUgx(course.priceUgx)}</strong>
                        </div>
                        <h3 className="font-display text-base font-semibold text-cream">
                          {course.title}
                        </h3>
                        <p className="text-xs text-ink-500 line-clamp-2">{course.summary}</p>
                      </div>
                    </div>

                    <div className="p-4 pt-0 space-y-3">
                      <div className="flex items-center justify-between text-xs text-ink-500 border-t border-[var(--border-faint)] pt-3">
                        <span>
                          {course.modules.length} Modules · {lessonCount} Lessons · {quizCount} Quizzes
                        </span>
                        <span>★ {course.rating.toFixed(1)}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setInspectingCourseId(course.id)}
                          className="flex-1 rounded-xl bg-gold px-3 py-2 text-xs font-semibold text-ink-gold"
                        >
                          Manage Curriculum
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetCourseId(course.id);
                            setActiveTab("add_lesson");
                          }}
                          className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3 py-2 text-xs font-semibold text-cream hover:border-gold/40"
                        >
                          + Lesson
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: PUBLISH NEW COURSE
         ===================================================================== */}
      {activeTab === "publish_course" && (
        <form
          onSubmit={handlePublishCourse}
          className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-4 max-w-2xl"
        >
          <div>
            <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
              Publishing as {activeCreator.name}
            </span>
            <h2 className="font-display text-lg font-semibold text-cream">
              Create & Publish a New Course
            </h2>
            <p className="text-xs text-ink-500">
              Your published course will immediately be available to students and parents in the Customer app.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs text-ink-500">Education Stream</label>
              <select
                value={newCourseStream}
                onChange={(e) => setNewCourseStream(e.target.value as EducationStreamId)}
                className="w-full rounded-xl px-3 py-2.5 text-xs text-cream"
              >
                {EDUCATION_STREAMS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.ageBracket})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-ink-500">Class / Grade Level</label>
              <input
                type="text"
                value={newCourseLevel}
                onChange={(e) => setNewCourseLevel(e.target.value)}
                placeholder="e.g. Primary 6, S.4 O-Level, Vocational"
                className="w-full rounded-xl px-3 py-2 text-xs text-cream"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs text-ink-500">Course Title</label>
              <input
                type="text"
                required
                value={newCourseTitle}
                onChange={(e) => setNewCourseTitle(e.target.value)}
                placeholder="e.g. Primary 6 Social Studies: East African Trade"
                className="w-full rounded-xl px-3 py-2 text-xs text-cream"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-ink-500">Tuition Fee (UGX)</label>
              <input
                type="number"
                value={newCoursePrice}
                onChange={(e) => setNewCoursePrice(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-xs text-cream"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-ink-500">Course Syllabus Summary</label>
            <textarea
              rows={3}
              value={newCourseSummary}
              onChange={(e) => setNewCourseSummary(e.target.value)}
              placeholder="Describe the learning outcomes, practical exercises, and assessment format..."
              className="w-full rounded-xl p-3 text-xs text-cream"
            />
          </div>

          <button
            type="submit"
            className="rounded-xl bg-gold px-5 py-2.5 text-xs font-semibold text-ink-gold"
          >
            Publish Course to Student Catalog
          </button>
        </form>
      )}

      {/* =====================================================================
          TAB 3: ADD LESSON & INTERACTIVE QUIZ BUILDER
         ===================================================================== */}
      {activeTab === "add_lesson" && (
        <form
          onSubmit={handleAddLesson}
          className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-4 max-w-2xl"
        >
          <div>
            <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
              Curriculum & Quiz Authoring
            </span>
            <h2 className="font-display text-lg font-semibold text-cream">
              Add a Lesson & Auto-Graded Quiz
            </h2>
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-ink-500">Select Course</label>
            <select
              value={targetCourseId}
              onChange={(e) => setTargetCourseId(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-xs text-cream"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.creatorName})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs text-ink-500">Lesson Title</label>
              <input
                type="text"
                required
                value={newLessonTitle}
                onChange={(e) => setNewLessonTitle(e.target.value)}
                placeholder="e.g. Lesson 3: Worked Past Paper Problems"
                className="w-full rounded-xl px-3 py-2 text-xs text-cream"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-ink-500">Duration (Minutes)</label>
              <input
                type="number"
                value={newLessonDuration}
                onChange={(e) => setNewLessonDuration(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-xs text-cream"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-ink-500">Lesson Notes / Summary</label>
            <textarea
              rows={2}
              value={newLessonSummary}
              onChange={(e) => setNewLessonSummary(e.target.value)}
              placeholder="Key concepts and instructions for this lesson..."
              className="w-full rounded-xl p-3 text-xs text-cream"
            />
          </div>

          <div className="space-y-2 border-t border-[var(--border-faint)] pt-3">
            <label className="block text-xs font-semibold text-gold">
              Attach Checkpoint Quiz Question (Optional)
            </label>
            <input
              type="text"
              value={newQuizQuestion}
              onChange={(e) => setNewQuizQuestion(e.target.value)}
              placeholder="Question prompt..."
              className="w-full rounded-xl px-3 py-2 text-xs text-cream"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={newQuizOptionA}
                onChange={(e) => setNewQuizOptionA(e.target.value)}
                placeholder="Correct Answer Option"
                className="w-full rounded-xl px-3 py-2 text-xs text-cream"
              />
              <input
                type="text"
                value={newQuizOptionB}
                onChange={(e) => setNewQuizOptionB(e.target.value)}
                placeholder="Distractor Option"
                className="w-full rounded-xl px-3 py-2 text-xs text-cream"
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-xl bg-gold px-5 py-2.5 text-xs font-semibold text-ink-gold"
          >
            Save Lesson & Quiz to Course
          </button>
        </form>
      )}

      {/* =====================================================================
          TAB 4: STUDENT SUBMISSIONS, WORKSHEETS & VIDEO CRITIQUE GRADING
         ===================================================================== */}
      {activeTab === "grading" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Primary Worksheet Turn-In Queue */}
          <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                Foundations · Homework Turn-Ins
              </span>
              <h2 className="font-display text-base font-semibold text-cream">
                Parent-Signed Exercise Book Submissions
              </h2>
            </div>

            {DEMO_FOUNDATIONS_SUBMISSIONS.map((sub) => {
              const isAwarded = gradedSubmissionIds.includes(sub.id);
              return (
                <div
                  key={sub.id}
                  className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3.5 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-cream">{sub.studentName}</span>
                    <span className="text-gold font-semibold">
                      {sub.parentSigned ? `✓ Signed by ${sub.parentSignerName}` : "Awaiting Parent"}
                    </span>
                  </div>
                  <div className="text-ink-500">{sub.worksheetTitle}</div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-ink-500">Submitted {sub.submittedAt}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setGradedSubmissionIds((prev) =>
                          prev.includes(sub.id) ? prev : [...prev, sub.id]
                        );
                        setNotice(`Awarded 25 Merit Stars to ${sub.studentName} and notified parent.`);
                      }}
                      className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-ink-gold"
                    >
                      {isAwarded ? "✓ 25 Merit Stars Awarded" : "Approve & Award 25★"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vocational Video Timestamp Critique Queue */}
          <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                Skills · Apprentice Video Critique
              </span>
              <h2 className="font-display text-base font-semibold text-cream">
                {DEMO_SKILLS_SUBMISSION.studentName} — {DEMO_SKILLS_SUBMISSION.taskTitle}
              </h2>
            </div>

            <div className="space-y-2">
              {critiquePins.map((pin) => (
                <div
                  key={pin.id}
                  className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gold">
                      Pin @ 0{Math.floor(pin.timestampSeconds / 60)}:
                      {String(pin.timestampSeconds % 60).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] uppercase text-ink-500">
                      {pin.severity.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-cream">{pin.critiqueText}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newCritiquePinText}
                onChange={(e) => setNewCritiquePinText(e.target.value)}
                placeholder="Drop a new feedback pin at 02:10..."
                className="w-full rounded-xl px-3 py-2 text-xs text-cream"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newCritiquePinText.trim()) return;
                  setCritiquePins((prev) => [
                    ...prev,
                    {
                      id: `crit_${Date.now()}`,
                      timestampSeconds: 130,
                      instructorName: activeCreator.leadInstructor,
                      critiqueText: newCritiquePinText.trim(),
                      severity: "technique_correction",
                      resolved: false,
                    },
                  ]);
                  setNewCritiquePinText("");
                }}
                className="rounded-xl bg-gold px-3.5 py-2 text-xs font-semibold text-ink-gold shrink-0"
              >
                Pin Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
