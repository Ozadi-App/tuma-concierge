"use client";

import { useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Building2,
  Sparkles,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Video,
  Radio,
  Users,
  ChevronRight,
  ArrowRight,
  Clock,
  CreditCard,
  Wallet,
  FileText,
  Plus,
  Award,
  ShieldCheck,
  Layers,
  MessageSquare,
  Wrench,
  Laptop,
  Star,
  Check,
  Eye,
  Camera,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  DEMO_CREATORS,
  DEMO_CREATOR_COURSES,
  EDUCATION_STREAMS,
  DEMO_LIVE_MEETINGS,
  DEMO_TUTOR_CONTACTS,
  type CreatorProfile,
  type CreatorCourse,
  type CourseLesson,
  type CourseQuiz,
  type EducationStream,
} from "@peebee/shared";
import { useLearnAuth } from "@/lib/auth-context";

const ugx = (amt: number) => `UGX ${Math.round(amt).toLocaleString("en-UG")}`;

export default function LearnHomePage() {
  const { user, activeStream, setActiveStream } = useLearnAuth();

  // Mode: "learner" (discovering & taking courses from creators) vs "creator" (educator SaaS studio)
  const [platformMode, setPlatformMode] = useState<"learner" | "creator">("learner");

  // Selected Creator for profile details or management
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>("creator_greenwood");
  const selectedCreator = DEMO_CREATORS.find((c) => c.id === selectedCreatorId) || DEMO_CREATORS[0];

  // Active Course Viewer State
  const [activeCourse, setActiveCourse] = useState<CreatorCourse | null>(null);
  const [activeLesson, setActiveLesson] = useState<CourseLesson | null>(null);

  // Active Quiz Runner State
  const [activeQuiz, setActiveQuiz] = useState<CourseQuiz | null>(null);
  const [currentQuizQuestionIndex, setCurrentQuizQuestionIndex] = useState(0);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [quizAnswerSubmitted, setQuizAnswerSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Creator Studio Form State (simulating a creator creating a new course/quiz)
  const [creatorTab, setCreatorTab] = useState<"courses" | "quizzes" | "live" | "grading" | "payouts">("courses");
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseStream, setNewCourseStream] = useState<EducationStream>("academy");
  const [newCoursePrice, setNewCoursePrice] = useState("150000");
  const [creatorNotice, setCreatorNotice] = useState<string | null>(null);

  // Filter courses by activeStream if desired
  const filteredCourses = DEMO_CREATOR_COURSES.filter(
    (c) => activeStream === "sprouts" ? c.stream === "sprouts" : c.stream === activeStream || activeStream === "campus"
  );

  const displayCourses = filteredCourses.length > 0 ? filteredCourses : DEMO_CREATOR_COURSES;

  // Quiz helper handlers
  const handleStartQuiz = (quiz: CourseQuiz) => {
    setActiveQuiz(quiz);
    setCurrentQuizQuestionIndex(0);
    setSelectedQuizOption(null);
    setQuizAnswerSubmitted(false);
    setQuizScore(0);
    setQuizFinished(false);
  };

  const handleSubmitQuizAnswer = () => {
    if (selectedQuizOption === null || !activeQuiz) return;
    const currentQ = activeQuiz.questions[currentQuizQuestionIndex];
    if (selectedQuizOption === currentQ.correctOptionIndex) {
      setQuizScore((prev) => prev + currentQ.points);
    }
    setQuizAnswerSubmitted(true);
  };

  const handleNextQuizQuestion = () => {
    if (!activeQuiz) return;
    if (currentQuizQuestionIndex + 1 < activeQuiz.questions.length) {
      setCurrentQuizQuestionIndex((prev) => prev + 1);
      setSelectedQuizOption(null);
      setQuizAnswerSubmitted(false);
    } else {
      setQuizFinished(true);
    }
  };

  const handleCreateNewCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;
    setCreatorNotice(`Course "${newCourseTitle}" created in ${selectedCreator.name}'s catalogue! You can now attach modules, video lessons and quizzes.`);
    setNewCourseTitle("");
    setTimeout(() => setCreatorNotice(null), 6000);
  };

  const handleRequestPayout = () => {
    setCreatorNotice(`Payout request of ${ugx(selectedCreator.payoutBalanceUgx)} initiated to ${selectedCreator.leadInstructor}'s MTN Mobile Money account. Settlement ETA: 5 minutes.`);
    setTimeout(() => setCreatorNotice(null), 6000);
  };

  return (
    <div className="space-y-6">
      {/* Platform Objective & Value Prop Header */}
      <section className="home-card relative overflow-hidden bg-gradient-to-br from-cream to-cream-100 p-5 dark:from-black-700 dark:to-black-900 border border-[var(--border-faint)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-gold">
                <Sparkles className="h-3 w-3" />
                Education Enablement Platform
              </span>
              <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase text-sky-700 dark:text-sky-300">
                Multi-Tenant Engine
              </span>
            </div>
            <h1 className="mt-2 text-xl font-black text-ink">
              Peebee Learning Infrastructure
            </h1>
            <p className="mt-1 text-xs text-ink-500 max-w-lg leading-relaxed">
              Peebee does not teach classes or create courses. We provide the complete digital operating system for partner schools, academies, vocational guilds, and independent tutors to publish courses, interactive quizzes, live Zoom classrooms, and collect tuition.
            </p>
          </div>
        </div>

        {/* Perspective Mode Switcher */}
        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-2xl border border-[var(--border-faint)] bg-cream-50/70 p-1.5 dark:bg-black/40">
          <button
            type="button"
            onClick={() => setPlatformMode("learner")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
              platformMode === "learner"
                ? "bg-gold text-black shadow-sm font-black"
                : "text-ink-500 hover:text-ink"
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            <span>Learner & Parent Experience</span>
          </button>

          <button
            type="button"
            onClick={() => setPlatformMode("creator")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
              platformMode === "creator"
                ? "bg-gold text-black shadow-sm font-black"
                : "text-ink-500 hover:text-ink"
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Creator & School Studio (Educator SaaS)</span>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* PERSPECTIVE 1: LEARNER & PARENT EXPERIENCE (Marketplace & Enrolled Courses) */}
      {/* ========================================================================= */}
      {platformMode === "learner" && (
        <div className="space-y-6">
          {/* Stream Filter Pills */}
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-ink-500">
              Browse by Education Stream
            </h2>
            <span className="text-[11px] font-bold text-gold">5 Specialized Tiers</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {EDUCATION_STREAMS.map((st) => {
              const isSelected = activeStream === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => setActiveStream(st.id as EducationStream)}
                  className={`flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold transition ${
                    isSelected
                      ? "bg-gold text-black shadow-sm font-black"
                      : "border border-[var(--border-faint)] bg-cream/70 text-ink-500 hover:text-ink dark:bg-black/40"
                  }`}
                >
                  <span className="text-base">{st.icon}</span>
                  <div className="text-left leading-tight">
                    <span className="block font-black">{st.title}</span>
                    <span className="block text-[9px] opacity-75">{st.ageBracket}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Directory of Demo Creators & Institutions */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-ink">Verified Partner Schools & Creators</h2>
                <p className="text-xs text-ink-500">
                  Select an independent institution or creator to view their syllabus, lessons, and quizzes.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {DEMO_CREATORS.map((creator) => {
                const isSelected = selectedCreatorId === creator.id;
                return (
                  <div
                    key={creator.id}
                    onClick={() => setSelectedCreatorId(creator.id)}
                    className={`home-card cursor-pointer p-4 transition-all hover:border-gold ${
                      isSelected
                        ? "border-2 border-gold shadow-md"
                        : "border border-[var(--border-faint)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={creator.avatarUrl}
                        alt={creator.name}
                        className="h-12 w-12 rounded-2xl object-cover shrink-0 border border-[var(--border-faint)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="truncate text-xs font-black text-ink">{creator.name}</h3>
                          {creator.isVerified && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-gold shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-ink-500 font-bold truncate">
                          {creator.leadInstructor} • {creator.leadInstructorTitle}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-500">
                          <span className="flex items-center gap-0.5 text-gold font-bold">
                            <Star className="h-3 w-3 fill-gold" /> {creator.rating} ({creator.reviewCount})
                          </span>
                          <span>•</span>
                          <span>{creator.enrolledStudents} Students</span>
                        </div>
                      </div>
                    </div>

                    <p className="mt-2 text-xs text-ink-500 line-clamp-2 leading-relaxed">
                      {creator.bio}
                    </p>

                    <div className="mt-3 flex items-center justify-between border-t border-[var(--border-faint)] pt-2 text-[11px] font-bold">
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-black text-gold uppercase">
                        {creator.badge || creator.type}
                      </span>
                      <span className="text-gold font-black">
                        {creator.tuitionFeeUgx ? `${ugx(creator.tuitionFeeUgx)} / ${creator.tuitionCadence}` : "Per-Course"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Featured Courses Published by Selected Creator */}
          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-ink">
                  Courses & Quizzes by {selectedCreator.name}
                </h2>
                <p className="text-xs text-ink-500">
                  Complete lessons and test your knowledge on interactive quizzes created by {selectedCreator.leadInstructor}.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {selectedCreator.courses.map((course) => (
                <div
                  key={course.id}
                  className="home-card overflow-hidden border border-[var(--border-faint)] p-4 hover:border-gold/60 transition"
                >
                  <div className="flex flex-col sm:flex-row gap-4">
                    <img
                      src={course.thumbnailUrl}
                      alt={course.title}
                      className="h-28 w-full sm:w-36 rounded-2xl object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-gold/15 px-2 py-0.5 text-[10px] font-black text-gold uppercase">
                          {course.level}
                        </span>
                        <span className="text-[11px] font-bold text-ink-500">
                          {course.category}
                        </span>
                      </div>
                      <h3 className="mt-1 text-sm font-black text-ink leading-tight">
                        {course.title}
                      </h3>
                      <p className="mt-1 text-xs text-ink-500 line-clamp-2">
                        {course.summary}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-ink-500">
                        <span>{course.modules.length} Modules</span>
                        <span>•</span>
                        <span>{course.enrolledStudentsCount} Learners Enrolled</span>
                        <span>•</span>
                        <span className="text-gold font-black">{ugx(course.priceUgx)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Modules & Lessons Drawer within Course */}
                  <div className="mt-4 border-t border-[var(--border-faint)] pt-3 space-y-2">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-ink-500">
                      Curriculum Tree & Lessons:
                    </h4>
                    {course.modules.map((mod) => (
                      <div key={mod.id} className="space-y-1.5">
                        <p className="text-xs font-bold text-ink">{mod.title}</p>
                        <div className="space-y-1 pl-2 border-l-2 border-gold/40">
                          {mod.lessons.map((les) => (
                            <div
                              key={les.id}
                              className="flex items-center justify-between rounded-xl bg-cream/60 p-2 text-xs dark:bg-black/30"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <BookOpen className="h-3.5 w-3.5 text-gold shrink-0" />
                                <span className="truncate font-semibold text-ink">{les.title}</span>
                                <span className="text-[10px] text-ink-500">({les.durationMinutes}m)</span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {les.quiz && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartQuiz(les.quiz!)}
                                    className="flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[10px] font-black text-black transition hover:opacity-90 active:scale-95"
                                  >
                                    <HelpCircle className="h-3 w-3" />
                                    <span>Take Quiz ({les.quiz.questions.length}Q)</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveCourse(course);
                                    setActiveLesson(les);
                                  }}
                                  className="rounded-full border border-[var(--border-faint)] px-2.5 py-1 text-[10px] font-bold text-ink hover:border-gold"
                                >
                                  View Lesson
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Live Zoom-Style Classrooms Hosted by Creators */}
          <section className="home-card relative overflow-hidden border-2 border-red-500/20 bg-gradient-to-r from-red-500/10 via-cream to-cream p-5 dark:from-red-950/30 dark:via-black-700 dark:to-black-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                  Creator Live Classroom in Session
                </span>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-[11px] font-black text-red-600 dark:text-red-400">
                <Users className="h-3 w-3" />
                {DEMO_LIVE_MEETINGS[0].participantCount} in Room
              </span>
            </div>

            <div className="mt-2.5">
              <h2 className="text-base font-black text-ink">{DEMO_LIVE_MEETINGS[0].title}</h2>
              <p className="mt-0.5 text-xs text-ink-500">
                {DEMO_LIVE_MEETINGS[0].subject} • Hosted by{" "}
                <span className="font-bold text-ink">{DEMO_LIVE_MEETINGS[0].hostTutorName}</span> (
                {DEMO_LIVE_MEETINGS[0].hostTutorTitle})
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href={`/live/${DEMO_LIVE_MEETINGS[0].id}`}
                className="flex items-center gap-2 rounded-2xl bg-gold px-4 py-2.5 text-xs font-black text-black shadow-sm transition hover:opacity-90 active:scale-95"
              >
                <Video className="h-4 w-4" />
                Join Live Class (Zoom-Style)
              </Link>

              <Link
                href="/chat"
                className="flex items-center gap-1.5 text-xs font-bold text-ink-500 hover:text-ink"
              >
                <MessageSquare className="h-4 w-4 text-gold" />
                Message Instructor Directly
              </Link>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PERSPECTIVE 2: CREATOR & SCHOOL STUDIO (Educator & School SaaS Workstation) */}
      {/* ========================================================================= */}
      {platformMode === "creator" && (
        <div className="space-y-6">
          {/* Active Creator / School Switcher Header */}
          <section className="home-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={selectedCreator.avatarUrl}
                  alt={selectedCreator.name}
                  className="h-14 w-14 rounded-2xl object-cover shrink-0 border border-gold"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-ink">{selectedCreator.name}</h2>
                    <span className="rounded bg-gold/15 px-2 py-0.5 text-[10px] font-black uppercase text-gold">
                      {selectedCreator.type}
                    </span>
                  </div>
                  <p className="text-xs text-ink-500">
                    Lead: <span className="font-bold text-ink">{selectedCreator.leadInstructor}</span> ({selectedCreator.leadInstructorTitle})
                  </p>
                  <p className="text-[11px] text-ink-500 mt-0.5">
                    Subdomain: <span className="font-mono text-gold">{selectedCreator.handle}.peebee.online</span>
                  </p>
                </div>
              </div>

              {/* Creator Selector Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink-500 shrink-0">Switch School:</span>
                <div className="field-box px-3 py-1.5 rounded-xl">
                  <select
                    value={selectedCreatorId}
                    onChange={(e) => setSelectedCreatorId(e.target.value)}
                    className="bg-transparent text-xs font-bold text-ink outline-none cursor-pointer"
                  >
                    {DEMO_CREATORS.map((c) => (
                      <option key={c.id} value={c.id} className="dark:bg-black text-ink">
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Financial & Operational KPI Metrics */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-2">
              <div className="rounded-xl border border-[var(--border-faint)] bg-cream-50/60 p-3 text-center dark:bg-black/30">
                <span className="text-[10px] font-bold text-ink-500 uppercase">Enrolled Students</span>
                <p className="mt-1 text-base font-black text-ink">{selectedCreator.enrolledStudents}</p>
              </div>

              <div className="rounded-xl border border-[var(--border-faint)] bg-cream-50/60 p-3 text-center dark:bg-black/30">
                <span className="text-[10px] font-bold text-ink-500 uppercase">Active Courses</span>
                <p className="mt-1 text-base font-black text-ink">{selectedCreator.courses.length}</p>
              </div>

              <div className="rounded-xl border border-[var(--border-faint)] bg-cream-50/60 p-3 text-center dark:bg-black/30">
                <span className="text-[10px] font-bold text-ink-500 uppercase">Available Payout</span>
                <p className="mt-1 text-sm font-black text-gold">{ugx(selectedCreator.payoutBalanceUgx)}</p>
              </div>

              <div className="rounded-xl border border-[var(--border-faint)] bg-cream-50/60 p-3 text-center dark:bg-black/30">
                <span className="text-[10px] font-bold text-ink-500 uppercase">Total Lifetime Sales</span>
                <p className="mt-1 text-sm font-black text-ink">{ugx(selectedCreator.totalEarningsUgx)}</p>
              </div>
            </div>
          </section>

          {creatorNotice && (
            <div className="flex items-center gap-2 rounded-2xl bg-green-500/15 p-3.5 text-xs font-bold text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              <span>{creatorNotice}</span>
            </div>
          )}

          {/* Creator SaaS Tools Navigation Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-[var(--border-faint)]">
            {[
              { id: "courses", label: "Course & Lesson Builder", icon: BookOpen },
              { id: "quizzes", label: "Quiz & Assessment Studio", icon: HelpCircle },
              { id: "grading", label: "Student Submissions Desk", icon: FileText },
              { id: "live", label: "Live Meeting Room Host", icon: Video },
              { id: "payouts", label: "Tuition & Payouts", icon: Wallet },
            ].map((tab) => {
              const active = creatorTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCreatorTab(tab.id as any)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-t-xl px-3.5 py-2 text-xs font-bold transition border-b-2 ${
                    active
                      ? "border-gold text-gold font-black bg-gold/10"
                      : "border-transparent text-ink-500 hover:text-ink"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: Course & Lesson Builder */}
          {creatorTab === "courses" && (
            <section className="space-y-4">
              <div className="home-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-ink">Publish a New Course or Term Subject</h3>
                  <span className="text-[11px] font-bold text-ink-500">Instructor Tool</span>
                </div>

                <form onSubmit={handleCreateNewCourse} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-ink-500">Course / Subject Title</label>
                    <div className="field-box mt-1 px-3 py-2">
                      <input
                        type="text"
                        placeholder="e.g. S.3 O-Level Chemistry & Practical Experiments"
                        value={newCourseTitle}
                        onChange={(e) => setNewCourseTitle(e.target.value)}
                        className="w-full text-xs font-semibold text-ink"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-ink-500">Target Education Stream</label>
                      <div className="field-box mt-1 px-3 py-2">
                        <select
                          value={newCourseStream}
                          onChange={(e) => setNewCourseStream(e.target.value as EducationStream)}
                          className="w-full bg-transparent text-xs font-semibold text-ink outline-none"
                        >
                          {EDUCATION_STREAMS.map((s) => (
                            <option key={s.id} value={s.id} className="dark:bg-black">
                              {s.icon} {s.title} ({s.ageBracket})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-ink-500">Tuition Fee or Course Price (UGX)</label>
                      <div className="field-box mt-1 px-3 py-2">
                        <input
                          type="number"
                          value={newCoursePrice}
                          onChange={(e) => setNewCoursePrice(e.target.value)}
                          className="w-full text-xs font-semibold text-ink"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-gold px-5 py-2.5 text-xs font-black text-black shadow-sm transition hover:opacity-90 active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Course & Attach Modules</span>
                  </button>
                </form>
              </div>

              {/* Existing Courses in this Institution */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-ink-500">
                  Published by {selectedCreator.name} ({selectedCreator.courses.length})
                </h4>
                {selectedCreator.courses.map((course) => (
                  <div key={course.id} className="home-card p-4 flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-black text-ink">{course.title}</h5>
                      <p className="text-[11px] text-ink-500">
                        {course.level} • {course.modules.length} Modules • {course.enrolledStudentsCount} Learners
                      </p>
                    </div>
                    <span className="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-black text-gold">
                      {ugx(course.priceUgx)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* TAB 2: Quiz & Assessment Studio */}
          {creatorTab === "quizzes" && (
            <section className="home-card p-5 space-y-4">
              <div>
                <h3 className="text-sm font-black text-ink">Interactive Quiz & Examination Engine</h3>
                <p className="text-xs text-ink-500">
                  Educators use this engine to construct auto-graded multiple choice quizzes, timed exams, and randomized question pools.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border-faint)] bg-cream/40 p-4 space-y-3 dark:bg-black/30">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-gold">Active Demo Quiz</span>
                    <h4 className="text-xs font-black text-ink">{selectedCreator.courses[0]?.modules[0]?.lessons.find((l) => l.quiz)?.quiz?.title ?? "Course Quiz"}</h4>
                  </div>
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-black text-gold">
                    Auto-Graded
                  </span>
                </div>

                {selectedCreator.courses[0]?.modules[0]?.lessons.find((l) => l.quiz)?.quiz && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-ink-500">
                      Sample Question Configured by {selectedCreator.leadInstructor}:
                    </p>
                    <div className="rounded-xl border border-[var(--border-faint)] bg-white p-3 dark:bg-black/50 text-xs">
                      <p className="font-bold text-ink">
                        {selectedCreator.courses[0].modules[0].lessons.find((l) => l.quiz)!.quiz!.questions[0].questionText}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {selectedCreator.courses[0].modules[0].lessons.find((l) => l.quiz)!.quiz!.questions[0].options.map((opt, i) => (
                          <li
                            key={i}
                            className={`rounded-lg px-2.5 py-1 text-[11px] ${
                              i === selectedCreator.courses[0].modules[0].lessons.find((l) => l.quiz)!.quiz!.questions[0].correctOptionIndex
                                ? "bg-green-500/15 text-green-700 font-bold dark:text-green-300"
                                : "text-ink-500"
                            }`}
                          >
                            {opt} {i === selectedCreator.courses[0].modules[0].lessons.find((l) => l.quiz)!.quiz!.questions[0].correctOptionIndex && "(Correct Answer)"}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStartQuiz(selectedCreator.courses[0].modules[0].lessons.find((l) => l.quiz)!.quiz!)}
                      className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-black text-black shadow-sm transition hover:opacity-90"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Preview Quiz in Learner Mode</span>
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB 3: Student Submissions Desk */}
          {creatorTab === "grading" && (
            <section className="home-card p-5 space-y-4">
              <div>
                <h3 className="text-sm font-black text-ink">Grading & Assessment In-box</h3>
                <p className="text-xs text-ink-500">
                  Review submitted student homework photos, apprentice haircut videos with timestamp comments, and sign off attendance.
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-[var(--border-faint)] bg-cream-50/60 p-4 dark:bg-black/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-gold">Primary Worksheet Submission</span>
                    <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      Parent PIN Signed: 1234
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-ink">Timothy Mukasa — P.4 Fractions Worksheet #1</h4>
                  <p className="text-[11px] text-ink-500">
                    Parent Signer: Grace Mukasa (Mother) • Mobile Photo Upload Attached
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCreatorNotice("Grade awarded: 15 Merit Stars awarded to Timothy Mukasa! Parent alerted via WhatsApp.");
                        setTimeout(() => setCreatorNotice(null), 5000);
                      }}
                      className="rounded-full bg-gold px-3.5 py-1.5 text-xs font-black text-black hover:opacity-90"
                    >
                      Approve & Award 15 Merits
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-[var(--border-faint)] px-3 py-1.5 text-xs font-bold text-ink"
                    >
                      Request Re-Upload
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border-faint)] bg-cream-50/60 p-4 dark:bg-black/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-gold">Vocational Practical Video Demo</span>
                    <span className="rounded bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                      Apprentice Logbook Pending
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-ink">Kato Joseph — Low Taper Skin Fade (03:45 Video)</h4>
                  <p className="text-[11px] text-ink-500">
                    Master Alex placed critique pin at 01:23: "Tilt clipper blade 45 degrees when clearing guideline."
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCreatorNotice("Apprentice practical approved. 6 verified practice hours credited to Kato Joseph's DIT logbook!");
                        setTimeout(() => setCreatorNotice(null), 5000);
                      }}
                      className="rounded-full bg-gold px-3.5 py-1.5 text-xs font-black text-black hover:opacity-90"
                    >
                      Verify & Sign Logbook Hours
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 4: Live Meeting Room Host Station */}
          {creatorTab === "live" && (
            <section className="home-card p-5 space-y-4">
              <div>
                <h3 className="text-sm font-black text-ink">Host Live Zoom-Style Video Classroom</h3>
                <p className="text-xs text-ink-500">
                  Start your scheduled lecture, broadcast your webcam, draw on the interactive whiteboard, and answer student questions in real-time.
                </p>
              </div>

              <div className="rounded-2xl border-2 border-red-500/30 bg-red-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-wider">
                    Room Code: PB-FIN-101
                  </span>
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-black text-red-600">
                    Host Station Ready
                  </span>
                </div>
                <h4 className="text-sm font-black text-ink">
                  {selectedCreator.name}: {DEMO_LIVE_MEETINGS[0].title}
                </h4>
                <p className="text-xs text-ink-500">
                  Equipped with synchronized drawing whiteboard, participant hand-raising chime, and question upvoting queue.
                </p>

                <div className="pt-2 flex gap-3">
                  <Link
                    href={`/live/${DEMO_LIVE_MEETINGS[0].id}`}
                    className="flex items-center gap-2 rounded-2xl bg-gold px-5 py-2.5 text-xs font-black text-black shadow-sm hover:opacity-90"
                  >
                    <Video className="h-4 w-4" />
                    <span>Launch Classroom as Host</span>
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* TAB 5: Tuition, Billing & Payout Balance */}
          {creatorTab === "payouts" && (
            <section className="home-card p-5 space-y-4">
              <div>
                <h3 className="text-sm font-black text-ink">Tuition Revenue & Mobile Money Payouts</h3>
                <p className="text-xs text-ink-500">
                  Track student installment payments, Peebee platform fee deductions, and withdraw funds directly to your telecom float.
                </p>
              </div>

              <div className="rounded-2xl border border-gold/40 bg-gold/10 p-5 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gold">
                  Available Payout Balance
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-ink">{ugx(selectedCreator.payoutBalanceUgx)}</span>
                  <span className="text-xs text-green-600 font-bold">+UGX 350,000 this week</span>
                </div>
                <p className="text-xs text-ink-500">
                  Deductions: 5% Peebee platform processing fee automatically settled at time of student transaction.
                </p>

                <button
                  type="button"
                  onClick={handleRequestPayout}
                  className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gold px-5 py-2.5 text-xs font-black text-black shadow-sm transition hover:opacity-90 active:scale-95"
                >
                  <Wallet className="h-4 w-4" />
                  <span>Withdraw to MTN MoMo ({selectedCreator.leadInstructor})</span>
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* INTERACTIVE QUIZ MODAL (Take quiz created by instructors) */}
      {/* ========================================================================= */}
      {activeQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--border-faint)] bg-cream p-5 text-ink shadow-2xl dark:bg-black-700 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border-faint)] pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-gold">
                  Interactive Quiz Simulator
                </span>
                <h3 className="text-base font-black text-ink">{activeQuiz.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveQuiz(null)}
                className="rounded-full border border-[var(--border-faint)] p-1 text-ink-500 hover:text-ink"
              >
                ✕
              </button>
            </div>

            {!quizFinished ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-ink-500">
                  <span>
                    Question {currentQuizQuestionIndex + 1} of {activeQuiz.questions.length}
                  </span>
                  <span className="flex items-center gap-1 text-gold font-mono">
                    <Clock className="h-3 w-3" /> {activeQuiz.timeLimitMinutes}:00 min
                  </span>
                </div>

                <div className="rounded-2xl border border-[var(--border-faint)] bg-cream-50/70 p-4 text-xs font-bold text-ink dark:bg-black/40">
                  <p className="text-sm font-black">
                    {activeQuiz.questions[currentQuizQuestionIndex].questionText}
                  </p>
                </div>

                {/* Question Options */}
                <div className="space-y-2">
                  {activeQuiz.questions[currentQuizQuestionIndex].options.map((opt, idx) => {
                    const isSelected = selectedQuizOption === idx;
                    const isCorrect = idx === activeQuiz.questions[currentQuizQuestionIndex].correctOptionIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={quizAnswerSubmitted}
                        onClick={() => setSelectedQuizOption(idx)}
                        className={`w-full text-left rounded-2xl border p-3.5 text-xs font-semibold transition ${
                          isSelected
                            ? "border-gold bg-gold/15 font-black text-ink"
                            : "border-[var(--border-faint)] bg-white/70 hover:border-gold/50 dark:bg-black/30"
                        } ${
                          quizAnswerSubmitted && isCorrect
                            ? "!border-green-500 !bg-green-500/15 !text-green-800 dark:!text-green-300 font-bold"
                            : ""
                        } ${
                          quizAnswerSubmitted && isSelected && !isCorrect
                            ? "!border-red-500 !bg-red-500/15 !text-red-700 font-bold"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{opt}</span>
                          {quizAnswerSubmitted && isCorrect && (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          )}
                          {quizAnswerSubmitted && isSelected && !isCorrect && (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Explanation Box when Answer Submitted */}
                {quizAnswerSubmitted && (
                  <div className="rounded-2xl bg-gold/15 p-3.5 text-xs space-y-1">
                    <p className="font-black text-gold uppercase tracking-wider text-[10px]">
                      Instructor's Pedagogical Explanation:
                    </p>
                    <p className="text-ink leading-relaxed">
                      {activeQuiz.questions[currentQuizQuestionIndex].explanation}
                    </p>
                  </div>
                )}

                {/* Quiz Navigation Buttons */}
                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-faint)]">
                  {!quizAnswerSubmitted ? (
                    <button
                      type="button"
                      disabled={selectedQuizOption === null}
                      onClick={handleSubmitQuizAnswer}
                      className="rounded-full bg-gold px-5 py-2.5 text-xs font-black text-black shadow-sm disabled:opacity-50"
                    >
                      Check Answer
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNextQuizQuestion}
                      className="flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-xs font-black text-black shadow-sm"
                    >
                      <span>
                        {currentQuizQuestionIndex + 1 < activeQuiz.questions.length ? "Next Question" : "See Final Score"}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Quiz Completed Score Card */
              <div className="text-center py-6 space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gold/20 text-gold text-3xl">
                  🏆
                </div>
                <div>
                  <h4 className="text-lg font-black text-ink">Quiz Completed!</h4>
                  <p className="text-xs text-ink-500 mt-1">
                    Your answers were submitted to the instructor's gradebook.
                  </p>
                </div>

                <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4 max-w-xs mx-auto">
                  <span className="text-[10px] font-black uppercase text-gold">Score Awarded</span>
                  <p className="text-2xl font-black text-ink">{quizScore} Points</p>
                  <p className="text-[11px] text-green-700 dark:text-green-400 font-bold mt-1">
                    Passed with Distinction!
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveQuiz(null)}
                  className="rounded-full bg-gold px-6 py-2.5 text-xs font-black text-black shadow-sm"
                >
                  Close & Return to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INTERACTIVE LESSON VIEWER MODAL */}
      {/* ========================================================================= */}
      {activeLesson && activeCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--border-faint)] bg-cream p-5 text-ink shadow-2xl dark:bg-black-700 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border-faint)] pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-gold">
                  {activeCourse.institutionName} • {activeCourse.title}
                </span>
                <h3 className="text-base font-black text-ink">{activeLesson.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveLesson(null);
                  setActiveCourse(null);
                }}
                className="rounded-full border border-[var(--border-faint)] p-1 text-ink-500 hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="aspect-video w-full rounded-2xl bg-black flex items-center justify-center text-white relative overflow-hidden">
              <img
                src={activeCourse.thumbnailUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-40"
              />
              <div className="relative text-center space-y-2 p-4">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gold text-black shadow-lg">
                  <Play className="h-6 w-6 ml-0.5 fill-black" />
                </span>
                <p className="text-xs font-black">{activeLesson.title}</p>
                <p className="text-[11px] text-cream/70 font-mono">Duration: {activeLesson.durationMinutes} mins</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <h4 className="font-black text-ink">Lesson Overview</h4>
              <p className="text-ink-500 leading-relaxed">{activeLesson.summary}</p>
            </div>

            {activeLesson.practicalChecklist && (
              <div className="rounded-2xl border border-[var(--border-faint)] bg-cream-50/70 p-3.5 space-y-2 dark:bg-black/30">
                <span className="text-[10px] font-black uppercase text-gold">Instructor Equipment Checklist:</span>
                <ul className="space-y-1 text-xs">
                  {activeLesson.practicalChecklist.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-ink">
                      <Check className="h-3.5 w-3.5 text-gold shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeLesson.quiz && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const q = activeLesson.quiz!;
                    setActiveLesson(null);
                    handleStartQuiz(q);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gold py-2.5 text-xs font-black text-black shadow-sm"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>Take Lesson Quiz ({activeLesson.quiz.questions.length} Questions)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
