"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLearnAuth } from "../lib/auth-context";
import {
  EDUCATION_STREAMS,
  DEMO_CREATORS,
  DEMO_CREATOR_COURSES,
  DEMO_LIVE_MEETINGS,
  type EducationStreamId,
  type CreatorProfile,
  type CreatorCourse,
  type CourseLesson,
} from "@peebee/shared";
import {
  Search,
  Video,
  MessageSquare,
  BookOpen,
  CheckCircle2,
  FileText,
  Clock,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  X,
  Download,
  Play,
  Layers,
} from "lucide-react";

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

export default function LearnHomePage() {
  const { setActiveStream } = useLearnAuth();
  const [mode, setMode] = useState<"browse" | "studio">("browse");
  const [streamFilter, setStreamFilter] = useState<EducationStreamId | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [creators, setCreators] = useState<CreatorProfile[]>(DEMO_CREATORS);
  const [courses, setCourses] = useState<CreatorCourse[]>(DEMO_CREATOR_COURSES);

  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([
    "course_greenwood_math4",
    "course_fintech_101",
    "course_little_stars_phonics",
  ]);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(["les_gw_1"]);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmittedLessonId, setQuizSubmittedLessonId] = useState<string | null>(null);

  // Resource modal
  const [previewResource, setPreviewResource] = useState<{
    name: string;
    size: string;
    courseTitle: string;
    lessonTitle: string;
  } | null>(null);

  // Educator Studio state
  const [studioCreatorId, setStudioCreatorId] = useState<string>(DEMO_CREATORS[0].id);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseStream, setNewCourseStream] = useState<EducationStreamId>("foundations");
  const [newCourseLevel, setNewCourseLevel] = useState("Primary 5");
  const [newCoursePrice, setNewCoursePrice] = useState("280000");
  const [newCourseSummary, setNewCourseSummary] = useState("");
  const [studioNotice, setStudioNotice] = useState<string | null>(null);

  const filteredCreators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return creators.filter((c) => {
      const matchesStream =
        streamFilter === "all" || c.stream === streamFilter || c.supportedStreams.includes(streamFilter);
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.leadInstructor.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q);
      return matchesStream && matchesQuery;
    });
  }, [creators, streamFilter, searchQuery]);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesStream = streamFilter === "all" || course.stream === streamFilter;
      const matchesCreator = !selectedCreatorId || course.creatorId === selectedCreatorId;
      const matchesQuery =
        !q ||
        course.title.toLowerCase().includes(q) ||
        course.creatorName.toLowerCase().includes(q) ||
        course.level.toLowerCase().includes(q) ||
        course.summary.toLowerCase().includes(q);
      return matchesStream && matchesCreator && matchesQuery;
    });
  }, [courses, streamFilter, selectedCreatorId, searchQuery]);

  const filteredLiveMeetings = useMemo(() => {
    return DEMO_LIVE_MEETINGS.filter(
      (m) => streamFilter === "all" || m.stream === streamFilter
    );
  }, [streamFilter]);

  const selectedCreator = useMemo(
    () => creators.find((c) => c.id === selectedCreatorId) ?? null,
    [creators, selectedCreatorId]
  );

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  const allLessonsInSelectedCourse = useMemo(() => {
    if (!selectedCourse) return [];
    return selectedCourse.modules.flatMap((m) => m.lessons);
  }, [selectedCourse]);

  const activeLesson: CourseLesson | null = useMemo(() => {
    if (!selectedCourse) return null;
    if (selectedLessonId) {
      const found = allLessonsInSelectedCourse.find((l) => l.id === selectedLessonId);
      if (found) return found;
    }
    return allLessonsInSelectedCourse[0] ?? null;
  }, [selectedCourse, selectedLessonId, allLessonsInSelectedCourse]);

  function openCourse(course: CreatorCourse) {
    setSelectedCourseId(course.id);
    setActiveStream(course.stream);
    setSelectedLessonId(course.modules[0]?.lessons[0]?.id ?? null);
    setQuizAnswers({});
    setQuizSubmittedLessonId(null);
    setMode("browse");
  }

  function handleCreateCourse(e: FormEvent) {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;
    const creator = creators.find((c) => c.id === studioCreatorId) ?? creators[0];
    const created: CreatorCourse = {
      id: `course_custom_${Date.now()}`,
      creatorId: creator.id,
      creatorName: creator.name,
      creatorAvatar: creator.avatarUrl,
      creatorRoleTitle: `${creator.leadInstructor} (${creator.leadInstructorTitle})`,
      institutionName: creator.name,
      title: newCourseTitle.trim(),
      stream: newCourseStream,
      category: STREAM_LABELS[newCourseStream],
      level: newCourseLevel.trim() || "All Levels",
      summary:
        newCourseSummary.trim() ||
        "Structured course with interactive lessons, study materials, and graded assessments.",
      thumbnailUrl: creator.bannerUrl ?? creator.avatarUrl,
      priceUgx: Number(newCoursePrice) || 150000,
      enrolledStudentsCount: 1,
      rating: 5.0,
      reviewCount: 1,
      modules: [
        {
          id: `mod_custom_${Date.now()}`,
          title: "Module 1: Core Foundations",
          description: "First module published via Educator Studio.",
          order: 1,
          lessons: [
            {
              id: `les_custom_${Date.now()}`,
              title: "Lesson 1: Welcome & Orientation",
              durationMinutes: 20,
              contentType: "video",
              summary: "Course overview, learning objectives, and study schedule.",
              quiz: {
                id: `quiz_custom_${Date.now()}`,
                title: "Orientation Checkpoint Quiz",
                instructions: "Quick check to verify your course setup.",
                timeLimitMinutes: 5,
                passingScorePercent: 50,
                questions: [
                  {
                    id: `q_custom_${Date.now()}`,
                    questionText: `Which institution published "${newCourseTitle.trim()}"?`,
                    options: [creator.name, "Other Institution"],
                    correctOptionIndex: 0,
                    explanation: `Published directly by ${creator.name} (${creator.leadInstructor}).`,
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
      prev.map((c) => (c.id === creator.id ? { ...c, courses: [created, ...c.courses] } : c))
    );
    setNewCourseTitle("");
    setNewCourseSummary("");
    setStudioNotice(`Published "${created.title}" under ${creator.name}.`);
  }

  return (
    <div className="space-y-5 pb-10">
      <header className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gold font-semibold">
              Peebee Learn
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-cream mt-0.5">
              Schools, Tutors & Courses
            </h1>
            <p className="text-sm text-ink-500 mt-1">
              Explore partner schools, vocational guilds, and tutor-led courses across all five education streams.
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMode("browse")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                mode === "browse" ? "bg-gold text-ink-gold" : "text-ink-500 hover:text-cream"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Browse & Learn</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("studio");
                setSelectedCourseId(null);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                mode === "studio" ? "bg-gold text-ink-gold" : "text-ink-500 hover:text-cream"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Educator Studio</span>
            </button>
          </div>
        </div>

        {mode === "browse" && !selectedCourse && (
          <>
            <div className="field-box flex items-center gap-2.5 rounded-xl px-3.5 py-2.5">
              <Search className="h-4 w-4 text-ink-500 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search schools, courses, subjects or tutors..."
                className="w-full text-sm text-cream placeholder:text-ink-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-ink-500 hover:text-cream"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => {
                  setStreamFilter("all");
                  setSelectedCreatorId(null);
                }}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  streamFilter === "all"
                    ? "bg-gold text-ink-gold"
                    : "bg-[rgb(var(--surface-muted))] text-ink-500 hover:text-cream"
                }`}
              >
                All Streams ({courses.length})
              </button>
              {EDUCATION_STREAMS.map((s) => {
                const active = streamFilter === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setStreamFilter(s.id);
                      setActiveStream(s.id);
                      setSelectedCreatorId(null);
                    }}
                    className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "bg-gold text-ink-gold"
                        : "bg-[rgb(var(--surface-muted))] text-ink-500 hover:text-cream"
                    }`}
                  >
                    {s.title} · {s.ageBracket}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </header>

      {/* Course Player View */}
      {mode === "browse" && selectedCourse && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSelectedCourseId(null)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {selectedCreator ? selectedCreator.name : "Schools & Courses"}
            </button>
            <div className="flex items-center gap-2">
              <Link
                href="/chat"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-3 py-1.5 text-xs font-semibold text-cream hover:border-gold/40"
              >
                <MessageSquare className="h-3.5 w-3.5 text-gold" />
                Ask Instructor
              </Link>
              <Link
                href="/streams"
                onClick={() => setActiveStream(selectedCourse.stream)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-ink-gold"
              >
                Open {selectedCourse.stream.toUpperCase()} Stream Tools
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <span className="rounded-md bg-[rgb(var(--surface-muted))] px-2 py-0.5 font-semibold text-gold">
                {STREAM_LABELS[selectedCourse.stream]}
              </span>
              <span>·</span>
              <span>{selectedCourse.level}</span>
              <span>·</span>
              <span>★ {selectedCourse.rating.toFixed(1)} ({selectedCourse.reviewCount} reviews)</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-cream">
              {selectedCourse.title}
            </h2>
            <p className="text-xs sm:text-sm text-ink-500">{selectedCourse.summary}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                Curriculum ({allLessonsInSelectedCourse.length} Lessons)
              </h3>
              {selectedCourse.modules.map((mod) => (
                <div key={mod.id} className="space-y-2">
                  <div className="text-xs font-semibold text-cream">{mod.title}</div>
                  {mod.lessons.map((lesson, idx) => {
                    const isSelected = activeLesson?.id === lesson.id;
                    const isDone = completedLessonIds.includes(lesson.id);
                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => {
                          setSelectedLessonId(lesson.id);
                          setQuizAnswers({});
                          setQuizSubmittedLessonId(null);
                        }}
                        className={`w-full text-left rounded-xl p-3 transition border ${
                          isSelected
                            ? "border-gold bg-gold/10"
                            : "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] hover:border-gold/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-cream">
                            {idx + 1}. {lesson.title}
                          </span>
                          {isDone && <CheckCircle2 className="h-4 w-4 text-gold shrink-0" />}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-500">
                          <Clock className="h-3 w-3" />
                          <span>{lesson.durationMinutes} min</span>
                          {lesson.quiz && <span className="text-gold font-medium">· Quiz</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="lg:col-span-8 space-y-4">
              {activeLesson && (
                <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--border-faint)] pb-3">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                        Active Lesson · {activeLesson.durationMinutes} Mins
                      </span>
                      <h3 className="font-display text-lg font-semibold text-cream mt-0.5">
                        {activeLesson.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCompletedLessonIds((prev) =>
                          prev.includes(activeLesson.id)
                            ? prev.filter((id) => id !== activeLesson.id)
                            : [...prev, activeLesson.id]
                        )
                      }
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        completedLessonIds.includes(activeLesson.id)
                          ? "bg-gold text-ink-gold"
                          : "border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-cream"
                      }`}
                    >
                      {completedLessonIds.includes(activeLesson.id) ? "✓ Completed" : "Mark Complete"}
                    </button>
                  </div>

                  <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold text-ink-gold">
                        <Play className="h-4 w-4 fill-current" />
                      </div>
                      <div className="text-xs font-semibold text-cream">
                        {selectedCourse.creatorName} — {selectedCourse.creatorRoleTitle}
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-cream leading-relaxed">
                      {activeLesson.summary}
                    </p>
                  </div>

                  {activeLesson.downloadableResources &&
                    activeLesson.downloadableResources.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {activeLesson.downloadableResources.map((res) => (
                          <button
                            key={res.name}
                            type="button"
                            onClick={() =>
                              setPreviewResource({
                                name: res.name,
                                size: res.size,
                                courseTitle: selectedCourse.title,
                                lessonTitle: activeLesson.title,
                              })
                            }
                            className="flex items-center justify-between rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3 text-left hover:border-gold/40"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-4 w-4 text-gold shrink-0" />
                              <span className="truncate text-xs font-semibold text-cream">
                                {res.name} ({res.size})
                              </span>
                            </div>
                            <Download className="h-4 w-4 text-gold shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}

                  {activeLesson.quiz && (
                    <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-3">
                      <div>
                        <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                          Checkpoint Quiz
                        </span>
                        <h4 className="text-sm font-semibold text-cream">
                          {activeLesson.quiz.title}
                        </h4>
                      </div>
                      {activeLesson.quiz.questions.map((q, qIdx) => {
                        const chosen = quizAnswers[q.id];
                        const isSubmitted = quizSubmittedLessonId === activeLesson.id;
                        return (
                          <div
                            key={q.id}
                            className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3 space-y-2"
                          >
                            <div className="text-xs font-semibold text-cream">
                              {qIdx + 1}. {q.questionText}
                            </div>
                            <div className="grid gap-1.5">
                              {q.options.map((opt, oIdx) => {
                                const selected = chosen === oIdx;
                                const isCorrect = q.correctOptionIndex === oIdx;
                                let btnStyle =
                                  "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-cream";
                                if (selected) {
                                  btnStyle = "border-gold bg-gold text-ink-gold font-semibold";
                                }
                                if (isSubmitted && isCorrect) {
                                  btnStyle = "border-gold bg-gold/20 text-gold font-semibold";
                                }
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                      if (!isSubmitted) {
                                        setQuizAnswers((prev) => ({ ...prev, [q.id]: oIdx }));
                                      }
                                    }}
                                    className={`w-full text-left rounded-lg border px-3 py-2 text-xs ${btnStyle}`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                            {isSubmitted && (
                              <p className="text-[11px] text-gold">✓ {q.explanation}</p>
                            )}
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setQuizSubmittedLessonId(activeLesson.id)}
                        className="rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-ink-gold"
                      >
                        {quizSubmittedLessonId === activeLesson.id
                          ? "Quiz Completed"
                          : "Submit Quiz Answers"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Catalog View */}
      {mode === "browse" && !selectedCourse && (
        <div className="space-y-6">
          {/* Stream-Matched Live Class Card */}
          {filteredLiveMeetings.length > 0 && (
            <section className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
                    <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                    {filteredLiveMeetings[0].isLiveNow ? "Live Classroom" : "Scheduled Classroom"}
                  </span>
                  <span className="text-xs text-ink-500">
                    Room {filteredLiveMeetings[0].roomCode} · {STREAM_LABELS[filteredLiveMeetings[0].stream]}
                  </span>
                </div>
                <h2 className="font-display text-base sm:text-lg font-semibold text-cream">
                  {filteredLiveMeetings[0].title}
                </h2>
                <p className="text-xs text-ink-500">
                  Host: {filteredLiveMeetings[0].hostTutorName} · {filteredLiveMeetings[0].participantCount} learners
                </p>
              </div>
              <Link
                href={`/live/${filteredLiveMeetings[0].id}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-ink-gold self-start sm:self-center shrink-0"
              >
                <Video className="h-3.5 w-3.5" />
                Join Live Class
              </Link>
            </section>
          )}

          {/* Partner Schools & Tutors */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-cream">
                Partner Schools, Academies & Tutors
              </h2>
              {selectedCreatorId && (
                <button
                  type="button"
                  onClick={() => setSelectedCreatorId(null)}
                  className="text-xs font-semibold text-gold hover:underline"
                >
                  Show All
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCreators.map((creator) => {
                const isSelected = selectedCreatorId === creator.id;
                const creatorCourseCount = courses.filter((c) => c.creatorId === creator.id).length;
                return (
                  <div
                    key={creator.id}
                    className={`rounded-2xl border p-4 transition flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "border-gold bg-gold/10"
                        : "border-[var(--border-faint)] bg-[rgb(var(--surface-card))] hover:border-gold/30"
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start gap-3">
                        <img
                          src={creator.avatarUrl}
                          alt={creator.name}
                          className="h-12 w-12 rounded-xl object-cover shrink-0 border border-[var(--border-faint)]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-gold">
                              {CREATOR_TYPE_LABELS[creator.type]}
                            </span>
                            {creator.isVerified && (
                              <ShieldCheck className="h-3.5 w-3.5 text-gold shrink-0" />
                            )}
                          </div>
                          <h3 className="font-display text-base font-semibold text-cream truncate">
                            {creator.name}
                          </h3>
                          <p className="text-xs text-ink-500 truncate">
                            {creator.leadInstructor} · {creator.location}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-ink-500 line-clamp-2">{creator.bio}</p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[var(--border-faint)]">
                      <div className="flex items-center justify-between text-xs text-ink-500">
                        <span>★ {creator.rating.toFixed(1)}</span>
                        <span>{creator.enrolledStudents.toLocaleString()} students</span>
                        <span className="text-gold font-semibold">{creatorCourseCount} courses</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCreatorId((prev) => (prev === creator.id ? null : creator.id))
                        }
                        className={`w-full rounded-xl px-3 py-2 text-xs font-semibold ${
                          isSelected
                            ? "bg-gold text-ink-gold"
                            : "bg-[rgb(var(--surface-muted))] text-cream"
                        }`}
                      >
                        {isSelected ? "Showing Courses" : "View Courses"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Courses Grid */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-cream">
              {selectedCreator ? `Courses by ${selectedCreator.name}` : "Published Courses & Quizzes"}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCourses.map((course) => {
                const lessonCount = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
                const isEnrolled = enrolledCourseIds.includes(course.id);
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
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="text-xs text-ink-500">
                          {course.creatorName} · {course.level}
                        </div>
                        <h3 className="font-display text-base font-semibold text-cream">
                          {course.title}
                        </h3>
                        <p className="text-xs text-ink-500 line-clamp-2">{course.summary}</p>
                      </div>
                    </div>
                    <div className="p-4 pt-0 space-y-3">
                      <div className="flex items-center justify-between text-xs text-ink-500 border-t border-[var(--border-faint)] pt-3">
                        <span>{lessonCount} Lessons</span>
                        <span className="font-semibold text-cream">{formatUgx(course.priceUgx)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCourse(course)}
                        className="w-full rounded-xl bg-gold px-4 py-2.5 text-xs font-semibold text-ink-gold flex items-center justify-center gap-1.5"
                      >
                        <span>{isEnrolled ? "Continue Course" : "Open Course & Quizzes"}</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* Educator Studio View */}
      {mode === "studio" && (
        <div className="space-y-4">
          {studioNotice && (
            <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs text-gold flex items-center justify-between">
              <span>✓ {studioNotice}</span>
              <button type="button" onClick={() => setStudioNotice(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <form
            onSubmit={handleCreateCourse}
            className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-3.5 max-w-2xl"
          >
            <div>
              <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                Educator Studio
              </span>
              <h2 className="font-display text-lg font-semibold text-cream">
                Publish a New Course
              </h2>
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-ink-500">Publishing School or Tutor</label>
              <select
                value={studioCreatorId}
                onChange={(e) => setStudioCreatorId(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-xs text-cream"
              >
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.leadInstructor})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs text-ink-500">Stream</label>
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
                <label className="block text-xs text-ink-500">Level</label>
                <input
                  type="text"
                  value={newCourseLevel}
                  onChange={(e) => setNewCourseLevel(e.target.value)}
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
                  placeholder="Course title..."
                  className="w-full rounded-xl px-3 py-2 text-xs text-cream"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-ink-500">Tuition (UGX)</label>
                <input
                  type="number"
                  value={newCoursePrice}
                  onChange={(e) => setNewCoursePrice(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-xs text-cream"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-ink-500">Summary</label>
              <textarea
                rows={2}
                value={newCourseSummary}
                onChange={(e) => setNewCourseSummary(e.target.value)}
                className="w-full rounded-xl p-3 text-xs text-cream"
              />
            </div>

            <button
              type="submit"
              className="rounded-xl bg-gold px-4 py-2.5 text-xs font-semibold text-ink-gold"
            >
              Publish Course
            </button>
          </form>
        </div>
      )}

      {previewResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-cream">{previewResource.name}</h3>
                <p className="text-xs text-ink-500">
                  {previewResource.courseTitle} · {previewResource.size}
                </p>
              </div>
              <button type="button" onClick={() => setPreviewResource(null)}>
                <X className="h-4 w-4 text-ink-500" />
              </button>
            </div>
            <p className="text-xs text-ink-500">
              Study material attached to <strong className="text-cream">{previewResource.lessonTitle}</strong>.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewResource(null)}
                className="rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-ink-gold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
