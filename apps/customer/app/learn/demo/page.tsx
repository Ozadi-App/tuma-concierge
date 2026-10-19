"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import {
  EDUCATION_STREAMS,
  DEMO_CREATORS,
  DEMO_CREATOR_COURSES,
  DEMO_LIVE_MEETINGS,
  DEMO_LIVE_PARTICIPANTS,
  DEMO_LIVE_CHAT_MESSAGES,
  DEMO_TUTOR_CONTACTS,
  DEMO_SPROUTS_ACTIVITIES,
  DEMO_SPROUTS_TIMER,
  DEMO_SPROUTS_COPLAY,
  DEMO_FOUNDATIONS_WORKSHEETS,
  DEMO_FOUNDATIONS_SUBMISSIONS,
  DEMO_FOUNDATIONS_MERITS,
  DEMO_ACADEMY_TIMETABLE,
  DEMO_ACADEMY_EXAM,
  DEMO_ACADEMY_REPORT_CARD,
  DEMO_COMPASS_PEER_REVIEW,
  DEMO_COMPASS_CREDENTIAL,
  DEMO_SKILLS_COURSE,
  DEMO_SKILLS_SUBMISSION,
  DEMO_SKILLS_LOGBOOK,
  DEMO_TUITION_INVOICE,
  DEMO_SUBSCRIPTION_PASSES,
  type EducationStreamId,
  type CreatorProfile,
  type CreatorCourse,
  type CourseLesson,
  type EducationLiveMeeting,
} from "@peebee/shared";
import {
  GraduationCap,
  Search,
  Video,
  MessageSquare,
  Star,
  Users,
  BookOpen,
  CheckCircle2,
  Award,
  Sparkles,
  FileText,
  Clock,
  ChevronRight,
  ArrowLeft,
  Send,
  Mic,
  MicOff,
  VideoOff,
  Hand,
  MonitorUp,
  Plus,
  CreditCard,
  ShieldCheck,
  Volume2,
  Camera,
  Scissors,
  X,
  Download,
  Play,
  Lock,
  Unlock,
  Layers,
} from "lucide-react";

type WorkspaceTab = "explore" | "live" | "tutors" | "tuition";

const STREAM_LABELS: Record<EducationStreamId, string> = {
  sprouts: "Sprouts · Ages 3–6",
  foundations: "Basics · Ages 6–12",
  academy: "Academy · Ages 12–18",
  compass: "Compass · Higher Ed & Business",
  skills: "Skills · Vocational Trades",
};

const CREATOR_TYPE_LABELS: Record<CreatorProfile["type"], string> = {
  school: "Primary School",
  academy: "Academy & Institute",
  vocational_guild: "Vocational Guild",
  early_childhood_center: "Kindergarten Hub",
  independent_tutor: "Independent Tutor",
};

const CATALOG_THUMBS: Record<EducationStreamId, string> = {
  sprouts: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=600&q=80",
  foundations: "https://images.unsplash.com/photo-1596495578065-6e0763fa1178?auto=format&fit=crop&w=600&q=80",
  academy: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80",
  compass: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80",
  skills: "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=600&q=80",
};

function formatUgx(amount: number) {
  return `UGX ${amount.toLocaleString()}`;
}

export default function CustomerLearnPage() {
  const router = useRouter();
  // Navigation & filter state
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("explore");
  const [streamFilter, setStreamFilter] = useState<EducationStreamId | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Mutable state so creators can publish new courses/lessons/quizzes in sandbox
  const [creators, setCreators] = useState<CreatorProfile[]>(DEMO_CREATORS);
  const [courses, setCourses] = useState<CreatorCourse[]>(DEMO_CREATOR_COURSES);

  // Courses educators have published from the Learn Studio. They join the demo courses
  // below; the demo set always stays, so the page is never empty while the catalogue loads.
  useEffect(() => {
    let cancelled = false;
    api
      .getCatalogCourses()
      .then((res) => {
        if (cancelled) return;
        const live: CreatorCourse[] = res.courses.map((c) => ({
          id: c.id,
          creatorId: `school:${c.schoolSlug}`,
          creatorName: c.schoolName,
          creatorAvatar: "",
          creatorRoleTitle: c.className,
          institutionName: c.schoolName,
          title: c.title,
          stream: c.stream,
          category: STREAM_LABELS[c.stream],
          level: c.classLevel || c.className,
          summary: c.summary,
          thumbnailUrl: CATALOG_THUMBS[c.stream],
          priceUgx: c.priceUgx,
          framework: c.framework,
          outcomes: c.outcomes,
          enrolledStudentsCount: 0,
          rating: 0,
          reviewCount: 0,
          modules: [],
        }));
        setCourses((prev) => [...live.filter((l) => !prev.some((p) => p.id === l.id)), ...prev]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Drill-down selection state
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  // A course an educator published opens in the real course player (enrolment, video, quizzes, progress).
  useEffect(() => {
    if (selectedCourseId?.startsWith("crs_")) router.push(`/learn/course/${selectedCourseId}`);
  }, [selectedCourseId, router]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([
    "course_greenwood_math4",
    "course_fintech_101",
    "course_little_stars_phonics",
  ]);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(["les_gw_1"]);

  // Interactive Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmittedLessonId, setQuizSubmittedLessonId] = useState<string | null>(null);

  // Resource Viewer Modal (replaces dead /downloads/... links)
  const [previewResource, setPreviewResource] = useState<{
    name: string;
    size: string;
    courseTitle: string;
    lessonTitle: string;
  } | null>(null);

  // Live Classroom state (replaces dead localhost:3011/live links)
  const [activeLiveRoomId, setActiveLiveRoomId] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [liveStageMode, setLiveStageMode] = useState<"slides" | "whiteboard" | "grid">("slides");
  const [liveRoomMessages, setLiveRoomMessages] = useState(DEMO_LIVE_CHAT_MESSAGES);
  const [liveChatInput, setLiveChatInput] = useState("");

  // Direct Tutor Chat state (replaces dead localhost:3011/chat links)
  const [selectedTutorId, setSelectedTutorId] = useState<string>(DEMO_TUTOR_CONTACTS[0].id);
  const [tutorChatInput, setTutorChatInput] = useState("");
  const [tutorThreads, setTutorThreads] = useState<
    Record<string, Array<{ id: string; sender: "student" | "tutor"; text: string; time: string }>>
  >({
    tutor_ken: [
      {
        id: "tk1",
        sender: "tutor",
        text: "Welcome! Feel free to ask any questions on Mobile Money settlement or idempotency keys.",
        time: "10:14 AM",
      },
    ],
    tutor_brenda: [
      {
        id: "tb1",
        sender: "tutor",
        text: "Parent signature verified on Primary 4 Worksheet #1. Keep up the neat work!",
        time: "Yesterday",
      },
    ],
    tutor_alex: [
      {
        id: "ta1",
        sender: "tutor",
        text: "I reviewed your low skin fade video submission. Check timestamp 01:28 for blade angle feedback.",
        time: "2 days ago",
      },
    ],
    tutor_sharon: [
      {
        id: "ts1",
        sender: "tutor",
        text: "Kigo the Lion's vowel sound activity is ready! Tap the audio speaker icon with your child.",
        time: "9:30 AM",
      },
    ],
    tutor_patrick: [
      {
        id: "tp1",
        sender: "tutor",
        text: "Senior 4 Physics Paper 1 revision starts at 6:00 PM today.",
        time: "11:20 AM",
      },
    ],
  });

  // Stream-specific interactive tool states (inside courses)
  // 1. Sprouts
  const [activeAudioToast, setActiveAudioToast] = useState<string | null>(null);
  const [unlockedStickers, setUnlockedStickers] = useState<string[]>(["sticker_golden_lion"]);
  const [storyPageIndex, setStoryPageIndex] = useState(0);
  const [screenTimerLocked, setScreenTimerLocked] = useState(DEMO_SPROUTS_TIMER.isLocked);
  const [parentPinInput, setParentPinInput] = useState("");

  // 2. Foundations
  const [parentSignName, setParentSignName] = useState("Grace Mukasa (Parent)");
  const [parentSignedOff, setParentSignedOff] = useState(false);
  const [homeworkSubmitted, setHomeworkSubmitted] = useState(false);

  // 3. Academy
  const [examStarted, setExamStarted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examMcqChoice, setExamMcqChoice] = useState<number | null>(0);
  const [examWorkings, setExamWorkings] = useState("d/dx [3x³ - 4sin(x) + e^(2x)] = 9x² - 4cos(x) + 2e^(2x)");

  // 4. Compass
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [videoNotes, setVideoNotes] = useState<Array<{ time: string; note: string }>>([
    { time: "02:15", note: "Idempotency key must be stored in Redis/Postgres with 24h TTL." },
  ]);
  const [newVideoNote, setNewVideoNote] = useState("");
  const [certificateVerified, setCertificateVerified] = useState(false);

  // 5. Skills
  const [checkedTools, setCheckedTools] = useState<Record<string, boolean>>({
    "Professional Cordless Clipper": true,
    "Guard Set (#0.5 to #4)": true,
    "Barbicide & Clipper Spray": true,
  });
  const [selectedCritiqueSec, setSelectedCritiqueSec] = useState<number>(42);
  const [logbookEntries, setLogbookEntries] = useState(DEMO_SKILLS_LOGBOOK);
  const [newLogTask, setNewLogTask] = useState("");
  const [newLogHours, setNewLogHours] = useState("4");

  // Tuition & Passes state
  const [tuitionPaidUgx, setTuitionPaidUgx] = useState(DEMO_TUITION_INVOICE.amountPaidUgx);
  const [activeSubscriptionPassId, setActiveSubscriptionPassId] = useState<string | null>(null);
  const [paymentSuccessNotice, setPaymentSuccessNotice] = useState<string | null>(null);

  // Filtered collections
  const filteredCreators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return creators.filter((c) => {
      const matchesStream =
        streamFilter === "all" || c.stream === streamFilter || c.supportedStreams.includes(streamFilter);
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.leadInstructor.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q);
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
        course.category.toLowerCase().includes(q) ||
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

  const activeLiveMeeting: EducationLiveMeeting | null = useMemo(() => {
    if (!activeLiveRoomId) return null;
    return DEMO_LIVE_MEETINGS.find((m) => m.id === activeLiveRoomId) ?? DEMO_LIVE_MEETINGS[0];
  }, [activeLiveRoomId]);

  const selectedTutor = useMemo(
    () => DEMO_TUTOR_CONTACTS.find((t) => t.id === selectedTutorId) ?? DEMO_TUTOR_CONTACTS[0],
    [selectedTutorId]
  );

  // Handlers
  function openCourse(course: CreatorCourse) {
    setSelectedCourseId(course.id);
    const firstLesson = course.modules[0]?.lessons[0];
    setSelectedLessonId(firstLesson?.id ?? null);
    setQuizAnswers({});
    setQuizSubmittedLessonId(null);
    setActiveTab("explore");
  }

  function openTutorChatForCreator(creatorName: string, stream: EducationStreamId) {
    const match =
      DEMO_TUTOR_CONTACTS.find((t) => creatorName.toLowerCase().includes(t.name.split(" ")[1]?.toLowerCase() ?? "")) ||
      DEMO_TUTOR_CONTACTS.find((t) => t.stream === stream) ||
      DEMO_TUTOR_CONTACTS[0];
    setSelectedTutorId(match.id);
    setActiveTab("tutors");
  }

  function handleSendLiveChat(e: FormEvent) {
    e.preventDefault();
    if (!liveChatInput.trim() || !activeLiveMeeting) return;
    setLiveRoomMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
        roomId: activeLiveMeeting.id,
        senderId: "part_you",
        senderName: "You (Student)",
        senderRole: "student",
        text: liveChatInput.trim(),
        timestamp: "Just now",
      },
    ]);
    setLiveChatInput("");
  }

  function handleSendTutorMessage(e: FormEvent) {
    e.preventDefault();
    if (!tutorChatInput.trim()) return;
    const msgText = tutorChatInput.trim();
    const tutor = selectedTutor;
    setTutorThreads((prev) => ({
      ...prev,
      [tutor.id]: [
        ...(prev[tutor.id] ?? []),
        { id: `u_${Date.now()}`, sender: "student", text: msgText, time: "Just now" },
        {
          id: `r_${Date.now() + 1}`,
          sender: "tutor",
          text: `Thanks for reaching out! I have noted your question regarding "${msgText.slice(0, 40)}${msgText.length > 40 ? "..." : ""}" and attached the study reference in your course module.`,
          time: "Just now",
        },
      ],
    }));
    setTutorChatInput("");
  }

  return (
    <div className="space-y-5 pb-10">
      {/* ─── Clean, Mobile-First Header (matches Pharmacy & Stores) ─── */}
      <header className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gold font-semibold">
              Peebee Learn · Demo
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink mt-0.5">
              Schools, Tutors & Courses
            </h1>
            <p className="text-xs text-ink-500 mt-1">
              Sample data for trying the features. <Link href="/learn" className="font-semibold text-gold underline">Back to Learn</Link>
            </p>
            <p className="text-sm text-ink-500 mt-1">
              Enroll in partner schools, vocational guilds, and tutor-led courses across every age group.
            </p>
            <Link href="/learn/my" className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-semibold text-ink-gold">
              My courses &amp; school fees
            </Link>
          </div>

          {/* Primary Workspace Switcher (Scrollable on small screens, never squished) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-1 self-start sm:self-auto max-w-full">
            {(
              [
                { id: "explore", label: "Explore", icon: BookOpen },
                { id: "live", label: "Live Classes", icon: Video },
                { id: "tutors", label: "Tutor Chat", icon: MessageSquare },
                { id: "tuition", label: "Tuition & Passes", icon: CreditCard },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id !== "explore") {
                      setSelectedCourseId(null);
                    }
                  }}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "bg-gold text-ink-gold"
                      : "text-ink-500 hover:text-ink"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Input (Single solid colour edge-to-edge via field-box per AGENTS.md) */}
        {(activeTab === "explore" || activeTab === "live") && !selectedCourse && !activeLiveMeeting && (
          <div className="field-box flex items-center gap-2.5 rounded-xl px-3.5 py-2.5">
            <Search className="h-4 w-4 text-ink-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search schools, courses, subjects or tutors..."
              className="w-full text-sm text-ink placeholder:text-ink-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-xs text-ink-500 hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Education Stream Pills (Only shown when browsing Explore or Live rooms) */}
        {(activeTab === "explore" || activeTab === "live") && !selectedCourse && !activeLiveMeeting && (
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
                  : "bg-[rgb(var(--surface-muted))] text-ink-500 hover:text-ink"
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
                    setSelectedCreatorId(null);
                  }}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-gold text-ink-gold"
                      : "bg-[rgb(var(--surface-muted))] text-ink-500 hover:text-ink"
                  }`}
                >
                  {s.title} · {s.ageBracket}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* =====================================================================
          VIEW 1: INTERACTIVE COURSE, LESSON & QUIZ PLAYER (When a course is open)
         ===================================================================== */}
      {activeTab === "explore" && selectedCourse && (
        <div className="space-y-5">
          {/* Back bar */}
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
              <button
                type="button"
                onClick={() => openTutorChatForCreator(selectedCourse.creatorRoleTitle, selectedCourse.stream)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-3 py-1.5 text-xs font-semibold text-ink hover:border-gold/40"
              >
                <MessageSquare className="h-3.5 w-3.5 text-gold" />
                Ask Instructor
              </button>
              {enrolledCourseIds.includes(selectedCourse.id) ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-gold/15 px-3 py-1.5 text-xs font-semibold text-gold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Enrolled
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setEnrolledCourseIds((prev) => [...prev, selectedCourse.id])}
                  className="rounded-lg bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink-gold"
                >
                  Enroll · {formatUgx(selectedCourse.priceUgx)}
                </button>
              )}
            </div>
          </div>

          {/* Course Banner Card */}
          <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                  <span className="rounded-md bg-[rgb(var(--surface-muted))] px-2 py-0.5 font-semibold text-gold">
                    {STREAM_LABELS[selectedCourse.stream]}
                  </span>
                  <span>·</span>
                  <span>{selectedCourse.level}</span>
                  <span>·</span>
                  <span>★ {selectedCourse.rating.toFixed(1)} ({selectedCourse.reviewCount} reviews)</span>
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-semibold text-ink">
                  {selectedCourse.title}
                </h2>
                <p className="text-xs sm:text-sm text-ink-500 max-w-3xl">
                  {selectedCourse.summary}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <img
                    src={selectedCourse.creatorAvatar}
                    alt={selectedCourse.creatorName}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                  <span className="text-xs font-medium text-ink">
                    {selectedCourse.creatorName}
                  </span>
                  <span className="text-xs text-ink-500">
                    — {selectedCourse.creatorRoleTitle}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Curriculum & Active Lesson Split */}
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Left Sidebar: Modules & Lessons */}
            <div className="lg:col-span-4 space-y-3">
              <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Course Curriculum ({allLessonsInSelectedCourse.length} Lessons)
                </h3>
                {selectedCourse.modules.map((mod) => (
                  <div key={mod.id} className="space-y-2">
                    <div className="text-xs font-semibold text-ink">{mod.title}</div>
                    <div className="space-y-1.5">
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
                              <span className="text-xs font-semibold text-ink leading-snug">
                                {idx + 1}. {lesson.title}
                              </span>
                              {isDone && (
                                <CheckCircle2 className="h-4 w-4 text-gold shrink-0" />
                              )}
                            </div>
                            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-500">
                              <Clock className="h-3 w-3" />
                              <span>{lesson.durationMinutes} min</span>
                              {lesson.quiz && (
                                <>
                                  <span>·</span>
                                  <span className="text-gold font-medium">Includes Quiz</span>
                                </>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Active Lesson Player, Quiz, and Stream-Specific Interactive Workspace */}
            <div className="lg:col-span-8 space-y-4">
              {activeLesson && (
                <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-faint)] pb-3">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                        Active Lesson · {activeLesson.durationMinutes} Mins
                      </span>
                      <h3 className="font-display text-lg font-semibold text-ink mt-0.5">
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
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        completedLessonIds.includes(activeLesson.id)
                          ? "bg-gold text-ink-gold"
                          : "border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink hover:border-gold/40"
                      }`}
                    >
                      {completedLessonIds.includes(activeLesson.id)
                        ? "✓ Completed"
                        : "Mark Complete"}
                    </button>
                  </div>

                  {/* Interactive Video / Audio Lesson Stage */}
                  <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-ink-gold">
                          <Play className="h-4 w-4 fill-current" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-ink">
                            {selectedCourse.creatorName} Lesson Player
                          </div>
                          <div className="text-[11px] text-ink-500">
                            Instructor: {selectedCourse.creatorRoleTitle}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[0.75, 1, 1.25, 1.5, 2].map((spd) => (
                          <button
                            key={spd}
                            type="button"
                            onClick={() => setPlaybackSpeed(spd)}
                            className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                              playbackSpeed === spd
                                ? "bg-gold text-ink-gold"
                                : "bg-[rgb(var(--surface-card))] text-ink-500 hover:text-ink"
                            }`}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-ink leading-relaxed">
                      {activeLesson.summary}
                    </p>
                  </div>

                  {/* Study Resources (Opens In-App Preview Modal — ZERO dead links!) */}
                  {activeLesson.downloadableResources &&
                    activeLesson.downloadableResources.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                          Lesson Study Materials
                        </h4>
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
                              className="flex items-center justify-between rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3 text-left hover:border-gold/40 transition"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <FileText className="h-4 w-4 text-gold shrink-0" />
                                <div className="truncate">
                                  <div className="truncate text-xs font-semibold text-ink">
                                    {res.name}
                                  </div>
                                  <div className="text-[11px] text-ink-500">{res.size} · Click to open</div>
                                </div>
                              </div>
                              <Download className="h-4 w-4 text-gold shrink-0 ml-2" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Practical Checklist (For Vocational / Skills lessons) */}
                  {activeLesson.practicalChecklist &&
                    activeLesson.practicalChecklist.length > 0 && (
                      <div className="space-y-2 rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3.5">
                        <h4 className="text-xs font-semibold text-gold">
                          Required Workshop Tools & Hygiene Checklist
                        </h4>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {activeLesson.practicalChecklist.map((item) => (
                            <label
                              key={item}
                              className="flex items-center gap-2 text-xs text-ink cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={!!checkedTools[item]}
                                onChange={() =>
                                  setCheckedTools((prev) => ({
                                    ...prev,
                                    [item]: !prev[item],
                                  }))
                                }
                                className="h-4 w-4 accent-[rgb(var(--gold))]"
                              />
                              <span>{item}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Interactive Lesson Quiz */}
                  {activeLesson.quiz && (
                    <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                            Interactive Assessment · {activeLesson.quiz.timeLimitMinutes} Min
                          </span>
                          <h4 className="text-sm font-semibold text-ink">
                            {activeLesson.quiz.title}
                          </h4>
                          <p className="text-xs text-ink-500">{activeLesson.quiz.instructions}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {activeLesson.quiz.questions.map((q, qIdx) => {
                          const chosen = quizAnswers[q.id];
                          const isSubmitted = quizSubmittedLessonId === activeLesson.id;
                          return (
                            <div
                              key={q.id}
                              className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3.5 space-y-2.5"
                            >
                              <div className="text-xs font-semibold text-ink">
                                {qIdx + 1}. {q.questionText}
                              </div>
                              <div className="grid gap-1.5">
                                {q.options.map((opt, oIdx) => {
                                  const selected = chosen === oIdx;
                                  const isCorrect = q.correctOptionIndex === oIdx;
                                  let btnStyle =
                                    "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink hover:border-gold/40";
                                  if (selected) {
                                    btnStyle = "border-gold bg-gold text-ink-gold font-semibold";
                                  }
                                  if (isSubmitted) {
                                    if (isCorrect) {
                                      btnStyle = "border-gold bg-gold/20 text-gold font-semibold";
                                    } else if (selected && !isCorrect) {
                                      btnStyle =
                                        "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink-500 line-through";
                                    }
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
                                      className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition ${btnStyle}`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                              {isSubmitted && (
                                <p className="text-[11px] text-gold pt-1">
                                  ✓ Explanation: {q.explanation}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {quizSubmittedLessonId === activeLesson.id ? (
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-gold">
                              Score:{" "}
                              {
                                activeLesson.quiz.questions.filter(
                                  (q) => quizAnswers[q.id] === q.correctOptionIndex
                                ).length
                              }{" "}
                              / {activeLesson.quiz.questions.length} Correct
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setQuizAnswers({});
                                setQuizSubmittedLessonId(null);
                              }}
                              className="text-xs text-ink-500 underline hover:text-ink"
                            >
                              Retry Quiz
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setQuizSubmittedLessonId(activeLesson.id);
                              setCompletedLessonIds((prev) =>
                                prev.includes(activeLesson.id) ? prev : [...prev, activeLesson.id]
                              );
                            }}
                            className="rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-ink-gold"
                          >
                            Submit Quiz Answers
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── STREAM-SPECIFIC INTERACTIVE TOOLS (Contextual to this course's stream) ─── */}
              {selectedCourse.stream === "sprouts" && (
                <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                        Sprouts Early Childhood Mode (Ages 3–6)
                      </span>
                      <h3 className="font-display text-base font-semibold text-ink">
                        Touch Phonics, Read-Along Storybook & Guardian Screen Timer
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setScreenTimerLocked((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3 py-1.5 text-xs font-semibold text-ink"
                    >
                      {screenTimerLocked ? (
                        <>
                          <Lock className="h-3.5 w-3.5 text-gold" />
                          Screen Locked (20m Limit)
                        </>
                      ) : (
                        <>
                          <Unlock className="h-3.5 w-3.5 text-gold" />
                          {DEMO_SPROUTS_TIMER.minutesRemainingToday}m Left Today
                        </>
                      )}
                    </button>
                  </div>

                  {screenTimerLocked ? (
                    <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-3">
                      <p className="text-xs font-semibold text-ink">
                        Session resting time reached to prevent child screen fatigue. Enter Guardian PIN (1234) to unlock:
                      </p>
                      <div className="flex items-center gap-2 max-w-xs">
                        <input
                          type="password"
                          value={parentPinInput}
                          onChange={(e) => setParentPinInput(e.target.value)}
                          placeholder="Guardian PIN (e.g. 1234)"
                          className="rounded-lg px-3 py-1.5 text-xs text-ink"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setScreenTimerLocked(false);
                            setParentPinInput("");
                          }}
                          className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-ink-gold shrink-0"
                        >
                          Unlock
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Audio Tap Phonics Cards */}
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        {DEMO_SPROUTS_ACTIVITIES.map((act) => {
                          const unlocked = unlockedStickers.includes(act.stickerRewardId);
                          return (
                            <button
                              key={act.id}
                              type="button"
                              onClick={() => {
                                setActiveAudioToast(
                                  `${act.characterGuideAvatar} ${act.characterGuideName}: "${act.instructionsVoiceover}"`
                                );
                                if (!unlocked) {
                                  setUnlockedStickers((prev) => [...prev, act.stickerRewardId]);
                                }
                              }}
                              className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3.5 text-left hover:border-gold/40 transition space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-2xl">{act.characterGuideAvatar}</span>
                                <Volume2 className="h-4 w-4 text-gold" />
                              </div>
                              <div className="text-xs font-semibold text-ink">{act.title}</div>
                              <div className="text-[11px] text-gold font-medium">
                                {unlocked ? `★ Earned: ${act.stickerRewardTitle}` : "Tap to Play & Earn Sticker"}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {activeAudioToast && (
                        <div className="rounded-xl border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-xs text-ink flex items-center justify-between">
                          <span>🔊 {activeAudioToast}</span>
                          <button
                            type="button"
                            onClick={() => setActiveAudioToast(null)}
                            className="text-ink-500 hover:text-ink ml-2"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Read-Along Picture Book + Parent Co-Play Prompt */}
                      {DEMO_SPROUTS_ACTIVITIES[2]?.gameConfig.storyPages && (
                        <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gold">
                              Read-Along Picture Book (Page {storyPageIndex + 1} of{" "}
                              {DEMO_SPROUTS_ACTIVITIES[2].gameConfig.storyPages.length})
                            </span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setStoryPageIndex((i) => Math.max(0, i - 1))}
                                className="rounded bg-[rgb(var(--surface-card))] px-2.5 py-1 text-xs text-ink"
                              >
                                Prev
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setStoryPageIndex((i) =>
                                    Math.min(
                                      (DEMO_SPROUTS_ACTIVITIES[2].gameConfig.storyPages?.length ?? 1) - 1,
                                      i + 1
                                    )
                                  )
                                }
                                className="rounded bg-gold px-2.5 py-1 text-xs font-semibold text-ink-gold"
                              >
                                Next Page
                              </button>
                            </div>
                          </div>
                          <p className="text-sm font-medium text-ink">
                            &ldquo;{DEMO_SPROUTS_ACTIVITIES[2].gameConfig.storyPages[storyPageIndex]?.text}&rdquo;
                          </p>
                          <div className="border-t border-[var(--border-faint)] pt-2.5 text-xs text-ink-500">
                            <strong className="text-ink">{DEMO_SPROUTS_COPLAY.promptTitle}:</strong>{" "}
                            {DEMO_SPROUTS_COPLAY.offlineActionPrompt}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {selectedCourse.stream === "foundations" && (
                <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                        Basics Primary Workflow (Ages 6–12)
                      </span>
                      <h3 className="font-display text-base font-semibold text-ink">
                        Handwritten Worksheet Turn-In & Parent Sign-Off
                      </h3>
                    </div>
                    <span className="rounded-lg bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
                      ★ {DEMO_FOUNDATIONS_MERITS.totalMerits + (homeworkSubmitted ? 25 : 0)} Merit Stars
                    </span>
                  </div>

                  <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-3">
                    <div className="text-xs font-semibold text-ink">
                      {DEMO_FOUNDATIONS_WORKSHEETS[0].title}
                    </div>
                    <p className="text-xs text-ink-500">
                      {DEMO_FOUNDATIONS_WORKSHEETS[0].instructions}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 pt-1">
                      <div>
                        <label className="block text-[11px] text-ink-500 mb-1">
                          Parent / Guardian Full Name for Digital Sign-Off
                        </label>
                        <input
                          type="text"
                          value={parentSignName}
                          onChange={(e) => setParentSignName(e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-xs text-ink"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <button
                          type="button"
                          onClick={() => setParentSignedOff((v) => !v)}
                          className={`rounded-lg px-3 py-2 text-xs font-semibold border transition ${
                            parentSignedOff
                              ? "border-gold bg-gold/15 text-gold"
                              : "border-[var(--border-faint)] bg-[rgb(var(--surface-card))] text-ink"
                          }`}
                        >
                          {parentSignedOff ? "✓ Parent Signed" : "Sign as Parent"}
                        </button>
                        <button
                          type="button"
                          disabled={!parentSignedOff || homeworkSubmitted}
                          onClick={() => setHomeworkSubmitted(true)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3.5 py-2 text-xs font-semibold text-ink-gold disabled:opacity-40"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          {homeworkSubmitted ? "Worksheet Uploaded (+25★)" : "Upload Photo"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedCourse.stream === "academy" && (
                <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                        Academy Secondary Tools (Ages 12–18)
                      </span>
                      <h3 className="font-display text-base font-semibold text-ink">
                        Proctored UNEB Mock Exam & Weighted Terminal Report Card
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExamStarted((prev) => !prev)}
                      className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-ink-gold"
                    >
                      {examStarted ? "View Terminal Report Card" : "Open Proctored Mock Exam"}
                    </button>
                  </div>

                  {examStarted ? (
                    <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-ink">
                          {DEMO_ACADEMY_EXAM.title}
                        </span>
                        <span className="rounded bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
                          Anti-Cheat Tab Guard Active · {DEMO_ACADEMY_EXAM.durationMinutes}m
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-ink">
                          Q1: {DEMO_ACADEMY_EXAM.questions[0].questionText}
                        </div>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {DEMO_ACADEMY_EXAM.questions[0].options?.map((opt, idx) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setExamMcqChoice(idx)}
                              className={`rounded-lg border px-3 py-1.5 text-left text-xs ${
                                examMcqChoice === idx
                                  ? "border-gold bg-gold text-ink-gold font-semibold"
                                  : "border-[var(--border-faint)] bg-[rgb(var(--surface-card))] text-ink"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-ink mb-1">
                          Q2 Formula Workings ({DEMO_ACADEMY_EXAM.questions[1].questionText})
                        </label>
                        <textarea
                          rows={2}
                          value={examWorkings}
                          onChange={(e) => setExamWorkings(e.target.value)}
                          className="w-full rounded-lg p-2.5 text-xs text-ink"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setExamSubmitted(true)}
                        className="rounded-lg bg-gold px-4 py-1.5 text-xs font-semibold text-ink-gold"
                      >
                        {examSubmitted ? "✓ Exam Paper Submitted to Gradebook" : "Submit Exam Paper"}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between text-xs">
                        <span className="font-semibold text-ink">
                          {DEMO_ACADEMY_REPORT_CARD.studentName} · {DEMO_ACADEMY_REPORT_CARD.homeroomClass}
                        </span>
                        <span className="text-gold font-semibold">
                          Weighted Average: {DEMO_ACADEMY_REPORT_CARD.overallWeightedAverage}% (Rank{" "}
                          {DEMO_ACADEMY_REPORT_CARD.classRank})
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {DEMO_ACADEMY_REPORT_CARD.subjects.map((sub) => (
                          <div
                            key={sub.code}
                            className="rounded-lg border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-2.5 text-xs"
                          >
                            <div className="flex items-center justify-between font-semibold text-ink">
                              <span>{sub.subjectName}</span>
                              <span className="text-gold">{sub.finalGrade} ({sub.weightedTotalPercent}%)</span>
                            </div>
                            <div className="text-[11px] text-ink-500 mt-0.5">
                              HW 20%: {sub.homeworkScorePercent}% · Mid 30%: {sub.midtermScorePercent}% · Final 50%: {sub.finalExamScorePercent}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedCourse.stream === "compass" && (
                <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                        Compass Higher Ed & Executive Tools
                      </span>
                      <h3 className="font-display text-base font-semibold text-ink">
                        Timestamped Lecture Notes & Verifiable Credential
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCertificateVerified((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3 py-1.5 text-xs font-semibold text-gold"
                    >
                      <Award className="h-3.5 w-3.5" />
                      {certificateVerified ? "Hide Credential" : "View Verifiable Certificate"}
                    </button>
                  </div>

                  {certificateVerified && (
                    <div className="rounded-xl border border-gold/40 bg-gold/10 p-4 space-y-1.5 text-xs">
                      <div className="font-semibold text-gold">
                        ✓ Cryptographically Signed Certificate · {DEMO_COMPASS_CREDENTIAL.certificateId}
                      </div>
                      <div className="text-ink">
                        Awarded to <strong>{DEMO_COMPASS_CREDENTIAL.studentName}</strong> by{" "}
                        {DEMO_COMPASS_CREDENTIAL.institutionName}
                      </div>
                      <div className="text-[11px] text-ink-500 break-all">
                        SHA-256 Hash: {DEMO_COMPASS_CREDENTIAL.verificationHash}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newVideoNote}
                        onChange={(e) => setNewVideoNote(e.target.value)}
                        placeholder="Pin a study note to current video timestamp (e.g. 04:12)..."
                        className="w-full rounded-lg px-3 py-1.5 text-xs text-ink"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newVideoNote.trim()) return;
                          setVideoNotes((prev) => [
                            ...prev,
                            { time: "04:12", note: newVideoNote.trim() },
                          ]);
                          setNewVideoNote("");
                        }}
                        className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-ink-gold shrink-0"
                      >
                        Pin Note
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {videoNotes.map((n, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3 py-2 text-xs text-ink"
                        >
                          <span className="font-semibold text-gold mr-2">[{n.time}]</span>
                          {n.note}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedCourse.stream === "skills" && (
                <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-4">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                      Skills Vocational Trade Assessment
                    </span>
                    <h3 className="font-display text-base font-semibold text-ink">
                      Video Timestamp Critique & Apprentice Logbook
                    </h3>
                  </div>

                  {/* Timestamped Critique Pins */}
                  <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-3">
                    <div className="text-xs font-semibold text-ink">
                      Practical Submission: {DEMO_SKILLS_SUBMISSION.taskTitle} ({DEMO_SKILLS_SUBMISSION.finalGrade})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {DEMO_SKILLS_SUBMISSION.critiques.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCritiqueSec(c.timestampSeconds)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                            selectedCritiqueSec === c.timestampSeconds
                              ? "bg-gold text-ink-gold"
                              : "bg-[rgb(var(--surface-card))] text-ink"
                          }`}
                        >
                          Pin @ 0{Math.floor(c.timestampSeconds / 60)}:
                          {String(c.timestampSeconds % 60).padStart(2, "0")}
                        </button>
                      ))}
                    </div>
                    {DEMO_SKILLS_SUBMISSION.critiques
                      .filter((c) => c.timestampSeconds === selectedCritiqueSec)
                      .map((c) => (
                        <div
                          key={c.id}
                          className="rounded-lg border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3 text-xs space-y-1"
                        >
                          <div className="font-semibold text-gold">
                            {c.instructorName} · {c.severity.replace("_", " ").toUpperCase()}
                          </div>
                          <p className="text-ink">{c.critiqueText}</p>
                        </div>
                      ))}
                  </div>

                  {/* Apprentice Logbook */}
                  <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-3">
                    <div className="text-xs font-semibold text-ink">
                      Verified Apprentice Workshop Logbook ({logbookEntries.reduce((acc, e) => acc + e.practicalHours, 0)} hrs logged)
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={newLogTask}
                        onChange={(e) => setNewLogTask(e.target.value)}
                        placeholder="Practical task completed today..."
                        className="w-full rounded-lg px-3 py-1.5 text-xs text-ink"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={newLogHours}
                          onChange={(e) => setNewLogHours(e.target.value)}
                          className="w-20 rounded-lg px-2.5 py-1.5 text-xs text-ink"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newLogTask.trim()) return;
                            setLogbookEntries((prev) => [
                              {
                                id: `log_${Date.now()}`,
                                studentId: "stud_denis",
                                studentName: "Denis Kigozi",
                                date: "Today",
                                practicalHours: Number(newLogHours) || 4,
                                taskPerformed: newLogTask.trim(),
                                workshopLocation: selectedCourse.creatorName,
                                masterSupervisorName: selectedCourse.creatorRoleTitle,
                                supervisorSignatureRecorded: true,
                                supervisorSignedAt: "Just now",
                              },
                              ...prev,
                            ]);
                            setNewLogTask("");
                          }}
                          className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-ink-gold shrink-0"
                        >
                          Log Hours
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 2: EXPLORE MARKETPLACE (Partner Schools, Tutors, Courses & Live)
         ===================================================================== */}
      {activeTab === "explore" && !selectedCourse && (
        <div className="space-y-6">
          {/* Stream-Matched Live Class Banner (Only shows rooms for the selected stream!) */}
          {filteredLiveMeetings.length > 0 && (
            <section className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
                      <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                      {filteredLiveMeetings[0].isLiveNow ? "Live Classroom In Progress" : "Upcoming Live Classroom"}
                    </span>
                    <span className="text-xs text-ink-500">
                      Room {filteredLiveMeetings[0].roomCode} · {STREAM_LABELS[filteredLiveMeetings[0].stream]}
                    </span>
                  </div>
                  <h2 className="font-display text-base sm:text-lg font-semibold text-ink">
                    {filteredLiveMeetings[0].title}
                  </h2>
                  <p className="text-xs text-ink-500">
                    Hosted by {filteredLiveMeetings[0].hostTutorName} ({filteredLiveMeetings[0].hostTutorTitle}) ·{" "}
                    {filteredLiveMeetings[0].participantCount} learners in room
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveLiveRoomId(filteredLiveMeetings[0].id);
                      setActiveTab("live");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-ink-gold"
                  >
                    <Video className="h-3.5 w-3.5" />
                    Join Live Class
                  </button>
                  {filteredLiveMeetings.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("live")}
                      className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3 py-2 text-xs font-semibold text-ink hover:border-gold/40"
                    >
                      All ({filteredLiveMeetings.length})
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Partner Schools, Academies & Independent Tutors Directory */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">
                  Partner Schools, Academies & Tutors
                </h2>
                <p className="text-xs text-ink-500">
                  Select an institution or educator to filter their published courses
                </p>
              </div>
              {selectedCreatorId && (
                <button
                  type="button"
                  onClick={() => setSelectedCreatorId(null)}
                  className="text-xs font-semibold text-gold hover:underline"
                >
                  Show All Schools
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
                          <h3 className="font-display text-base font-semibold text-ink truncate">
                            {creator.name}
                          </h3>
                          <p className="text-xs text-ink-500 truncate">
                            {creator.leadInstructor} · {creator.location}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-ink-500 line-clamp-2 leading-relaxed">
                        {creator.bio}
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-[var(--border-faint)]">
                      <div className="flex items-center justify-between text-xs text-ink-500">
                        <span>
                          ★ <strong className="text-ink">{creator.rating.toFixed(1)}</strong> ({creator.reviewCount})
                        </span>
                        <span>{creator.enrolledStudents.toLocaleString()} students</span>
                        <span className="text-gold font-semibold">
                          {creatorCourseCount} {creatorCourseCount === 1 ? "course" : "courses"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCreatorId((prev) => (prev === creator.id ? null : creator.id))
                          }
                          className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                            isSelected
                              ? "bg-gold text-ink-gold"
                              : "bg-[rgb(var(--surface-muted))] text-ink hover:border-gold/40"
                          }`}
                        >
                          {isSelected ? "Showing Courses" : "View Courses"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openTutorChatForCreator(creator.leadInstructor, creator.stream)}
                          className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3 py-2 text-xs font-semibold text-ink hover:border-gold/40"
                          title="Message Instructor"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-gold" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Published Courses, Lessons & Quizzes Catalog */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">
                  {selectedCreator
                    ? `Courses by ${selectedCreator.name}`
                    : "Published Courses, Lessons & Quizzes"}
                </h2>
                <p className="text-xs text-ink-500">
                  Open any course to watch lessons, take interactive quizzes, or submit assignments
                </p>
              </div>
              <span className="text-xs text-ink-500">
                {filteredCourses.length} {filteredCourses.length === 1 ? "course" : "courses"}
              </span>
            </div>

            {filteredCourses.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-8 text-center space-y-2">
                <p className="text-sm font-semibold text-ink">No courses match your current filter</p>
                <p className="text-xs text-ink-500">
                  Try clearing your search query or switching to All Streams.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStreamFilter("all");
                    setSelectedCreatorId(null);
                    setSearchQuery("");
                  }}
                  className="mt-2 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-ink-gold"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCourses.map((course) => {
                  const lessonCount = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
                  const quizCount = course.modules.reduce(
                    (acc, m) => acc + m.lessons.filter((l) => l.quiz).length,
                    0
                  );
                  const isEnrolled = enrolledCourseIds.includes(course.id);

                  return (
                    <div
                      key={course.id}
                      className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] overflow-hidden flex flex-col justify-between hover:border-gold/40 transition"
                    >
                      <div>
                        <div className="relative h-36 w-full bg-[rgb(var(--surface-muted))]">
                          <img
                            src={course.thumbnailUrl}
                            alt={course.title}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute top-2.5 left-2.5 rounded-lg bg-[rgb(var(--surface-card))]/90 backdrop-blur px-2.5 py-1 text-[11px] font-semibold text-gold">
                            {STREAM_LABELS[course.stream]}
                          </div>
                          {isEnrolled && (
                            <div className="absolute top-2.5 right-2.5 rounded-lg bg-gold px-2.5 py-1 text-[11px] font-semibold text-ink-gold">
                              Enrolled
                            </div>
                          )}
                        </div>

                        <div className="p-4 space-y-2">
                          <div className="flex items-center gap-2 text-xs text-ink-500">
                            <span className="font-medium text-ink truncate">
                              {course.creatorName}
                            </span>
                            <span>·</span>
                            <span className="shrink-0">{course.level}</span>
                          </div>

                          <h3 className="font-display text-base font-semibold text-ink leading-snug">
                            {course.title}
                          </h3>

                          <p className="text-xs text-ink-500 line-clamp-2 leading-relaxed">
                            {course.summary}
                          </p>
                        </div>
                      </div>

                      <div className="p-4 pt-0 space-y-3">
                        <div className="flex items-center justify-between text-xs text-ink-500 border-t border-[var(--border-faint)] pt-3">
                          <span>
                            {lessonCount} {lessonCount === 1 ? "Lesson" : "Lessons"} · {quizCount}{" "}
                            {quizCount === 1 ? "Quiz" : "Quizzes"}
                          </span>
                          <span className="font-semibold text-ink">
                            {formatUgx(course.priceUgx)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => openCourse(course)}
                          className="w-full rounded-xl bg-gold px-4 py-2.5 text-xs font-semibold text-ink-gold flex items-center justify-center gap-1.5"
                        >
                          <span>{isEnrolled ? "Continue Course & Quizzes" : "Open Course & Syllabus"}</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* =====================================================================
          VIEW 3: LIVE CLASSROOMS (Zoom-Style In-App Video & Whiteboard Stage)
         ===================================================================== */}
      {activeTab === "live" && (
        <div className="space-y-5">
          {activeLiveMeeting ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveLiveRoomId(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to All Live Classrooms
                </button>
                <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
                  Room {activeLiveMeeting.roomCode} · {activeLiveMeeting.participantCount} Participants
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-12">
                {/* Main Video / Whiteboard Stage */}
                <div className="lg:col-span-8 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                        {STREAM_LABELS[activeLiveMeeting.stream]} · Live Session
                      </span>
                      <h2 className="font-display text-lg font-semibold text-ink">
                        {activeLiveMeeting.title}
                      </h2>
                      <p className="text-xs text-ink-500">
                        Host: {activeLiveMeeting.hostTutorName} ({activeLiveMeeting.hostTutorTitle})
                      </p>
                    </div>
                    <div className="flex gap-1.5 rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-1">
                      {(["slides", "whiteboard", "grid"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setLiveStageMode(mode)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ${
                            liveStageMode === mode
                              ? "bg-gold text-ink-gold"
                              : "text-ink-500 hover:text-ink"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stage Canvas */}
                  <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-5 min-h-[260px] flex flex-col justify-between">
                    {liveStageMode === "slides" && (
                      <div className="space-y-3">
                        <div className="inline-flex items-center gap-1.5 rounded bg-[rgb(var(--surface-card))] px-2.5 py-1 text-[11px] font-semibold text-gold">
                          <MonitorUp className="h-3.5 w-3.5" />
                          {activeLiveMeeting.hostTutorName} is sharing presentation slides
                        </div>
                        <h3 className="font-display text-base sm:text-lg font-semibold text-ink">
                          {activeLiveMeeting.subject}: Live Walkthrough & Worked Examples
                        </h3>
                        <p className="text-xs sm:text-sm text-ink-500 leading-relaxed">
                          Follow along with the live annotated diagram. Use the Raise Hand button below to ask a question on mic, or post in the room chat.
                        </p>
                      </div>
                    )}

                    {liveStageMode === "whiteboard" && (
                      <div className="space-y-3">
                        <div className="text-xs font-semibold text-gold">
                          Interactive Collaborative Whiteboard
                        </div>
                        <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 font-mono text-xs text-ink space-y-1.5">
                          <div>[Step 1] Verify input parameters & boundary conditions</div>
                          <div>[Step 2] Apply curriculum formula & check units</div>
                          <div>[Step 3] Live Q&A checkpoint with {activeLiveMeeting.hostTutorName}</div>
                        </div>
                      </div>
                    )}

                    {liveStageMode === "grid" && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {DEMO_LIVE_PARTICIPANTS.map((part) => (
                          <div
                            key={part.id}
                            className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3 flex items-center gap-2.5"
                          >
                            <img
                              src={part.avatarUrl}
                              alt={part.name}
                              className="h-9 w-9 rounded-full object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-ink">
                                {part.name}
                              </div>
                              <div className="text-[11px] text-ink-500 uppercase">
                                {part.role} {part.hasHandRaised ? "· ✋" : ""}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Classroom Control Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-4 mt-4 border-t border-[var(--border-faint)]">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMicMuted((m) => !m)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                            micMuted
                              ? "bg-[rgb(var(--surface-card))] text-ink"
                              : "bg-gold text-ink-gold"
                          }`}
                        >
                          {micMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                          <span>{micMuted ? "Unmute" : "Mic On"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCamOn((c) => !c)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                            !camOn
                              ? "bg-[rgb(var(--surface-card))] text-ink"
                              : "bg-gold text-ink-gold"
                          }`}
                        >
                          {camOn ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                          <span>{camOn ? "Video On" : "Start Video"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setHandRaised((h) => !h)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                            handRaised
                              ? "bg-gold text-ink-gold"
                              : "bg-[rgb(var(--surface-card))] text-ink"
                          }`}
                        >
                          <Hand className="h-3.5 w-3.5" />
                          <span>{handRaised ? "Hand Raised" : "Raise Hand"}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveLiveRoomId(null)}
                        className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-3.5 py-2 text-xs font-semibold text-ink hover:border-gold/40"
                      >
                        Leave Room
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Room Q&A Chat */}
                <div className="lg:col-span-4 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 flex flex-col justify-between space-y-3">
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                      Live Classroom Chat & Q&A
                    </h3>
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {liveRoomMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-ink">{msg.senderName}</span>
                            <span className="text-[10px] text-ink-500">{msg.timestamp}</span>
                          </div>
                          <p className="text-ink-500 leading-relaxed">{msg.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleSendLiveChat} className="field-box flex items-center gap-2 rounded-xl px-3 py-2">
                    <input
                      type="text"
                      value={liveChatInput}
                      onChange={(e) => setLiveChatInput(e.target.value)}
                      placeholder="Ask a question in the room..."
                      className="w-full text-xs text-ink placeholder:text-ink-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-gold p-1.5 text-ink-gold shrink-0"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredLiveMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="rounded-md bg-[rgb(var(--surface-muted))] px-2 py-0.5 font-semibold text-gold">
                        {STREAM_LABELS[meeting.stream]}
                      </span>
                      <span className="text-ink-500">{meeting.scheduledFor}</span>
                    </div>
                    <h3 className="font-display text-base font-semibold text-ink">
                      {meeting.title}
                    </h3>
                    <div className="flex items-center gap-2.5 pt-1">
                      <img
                        src={meeting.hostTutorAvatar}
                        alt={meeting.hostTutorName}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <div>
                        <div className="text-xs font-semibold text-ink">
                          {meeting.hostTutorName}
                        </div>
                        <div className="text-[11px] text-ink-500">
                          {meeting.hostTutorTitle} · Room {meeting.roomCode}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--border-faint)] pt-3">
                    <span className="text-xs text-ink-500">
                      {meeting.participantCount} / {meeting.maxParticipants} Learners
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveLiveRoomId(meeting.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-ink-gold"
                    >
                      <Video className="h-3.5 w-3.5" />
                      Enter Classroom
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          VIEW 4: DIRECT TUTOR CHAT (In-App Messaging with School Instructors)
         ===================================================================== */}
      {activeTab === "tutors" && (
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Tutor Roster */}
          <div className="lg:col-span-4 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3.5 space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-500">
              Verified School Tutors & Mentors
            </h2>
            <div className="space-y-1.5">
              {DEMO_TUTOR_CONTACTS.map((tutor) => {
                const isSelected = tutor.id === selectedTutor.id;
                return (
                  <button
                    key={tutor.id}
                    type="button"
                    onClick={() => setSelectedTutorId(tutor.id)}
                    className={`w-full text-left rounded-xl p-3 transition flex items-start gap-3 border ${
                      isSelected
                        ? "border-gold bg-gold/10"
                        : "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] hover:border-gold/30"
                    }`}
                  >
                    <img
                      src={tutor.avatarUrl}
                      alt={tutor.name}
                      className="h-10 w-10 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-semibold text-ink">
                          {tutor.name}
                        </span>
                        <span className="text-[10px] text-gold shrink-0">
                          {tutor.isOnline ? "Online" : tutor.lastMessageTime}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-ink-500">{tutor.subject}</div>
                      <div className="truncate text-[11px] text-ink-500 mt-0.5">
                        {tutor.lastMessage}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Conversation */}
          <div className="lg:col-span-8 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-faint)] pb-3">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedTutor.avatarUrl}
                    alt={selectedTutor.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div>
                    <div className="text-sm font-semibold text-ink">{selectedTutor.name}</div>
                    <div className="text-xs text-ink-500">
                      {selectedTutor.title} · {STREAM_LABELS[selectedTutor.stream]}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const matchingRoom =
                      DEMO_LIVE_MEETINGS.find((m) => m.stream === selectedTutor.stream) ??
                      DEMO_LIVE_MEETINGS[0];
                    setActiveLiveRoomId(matchingRoom.id);
                    setActiveTab("live");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3 py-1.5 text-xs font-semibold text-gold hover:border-gold/40"
                >
                  <Video className="h-3.5 w-3.5" />
                  Live Call
                </button>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {(tutorThreads[selectedTutor.id] ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl p-3 text-xs max-w-lg ${
                      m.sender === "student"
                        ? "ml-auto bg-gold text-ink-gold font-medium"
                        : "border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink"
                    }`}
                  >
                    <p className="leading-relaxed">{m.text}</p>
                    <div
                      className={`text-[10px] mt-1 ${
                        m.sender === "student" ? "text-ink-gold/75" : "text-ink-500"
                      }`}
                    >
                      {m.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={handleSendTutorMessage}
              className="field-box flex items-center gap-2 rounded-xl px-3.5 py-2.5"
            >
              <input
                type="text"
                value={tutorChatInput}
                onChange={(e) => setTutorChatInput(e.target.value)}
                placeholder={`Message ${selectedTutor.name}...`}
                className="w-full text-xs sm:text-sm text-ink placeholder:text-ink-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-ink-gold shrink-0"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 5: TUITION BILLING & SUBSCRIPTION PASSES
         ===================================================================== */}
      {activeTab === "tuition" && (
        <div className="space-y-5">
          {paymentSuccessNotice && (
            <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs text-gold flex items-center justify-between">
              <span>✓ {paymentSuccessNotice}</span>
              <button
                type="button"
                onClick={() => setPaymentSuccessNotice(null)}
                className="text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* School Term Tuition Invoice Card */}
            <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                    Term Tuition Installments
                  </span>
                  <h2 className="font-display text-lg font-semibold text-ink">
                    {DEMO_TUITION_INVOICE.institutionName}
                  </h2>
                  <p className="text-xs text-ink-500">
                    Student: {DEMO_TUITION_INVOICE.studentName} · {DEMO_TUITION_INVOICE.termName}
                  </p>
                </div>
                <span className="rounded-lg bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
                  {tuitionPaidUgx >= DEMO_TUITION_INVOICE.totalTuitionUgx ? "Paid in Full" : "Installment Due"}
                </span>
              </div>

              <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3.5 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-ink-500">Total Tuition</div>
                  <div className="font-semibold text-ink mt-0.5">
                    {formatUgx(DEMO_TUITION_INVOICE.totalTuitionUgx)}
                  </div>
                </div>
                <div>
                  <div className="text-ink-500">Paid So Far</div>
                  <div className="font-semibold text-gold mt-0.5">
                    {formatUgx(tuitionPaidUgx)}
                  </div>
                </div>
                <div>
                  <div className="text-ink-500">Remaining</div>
                  <div className="font-semibold text-ink mt-0.5">
                    {formatUgx(Math.max(0, DEMO_TUITION_INVOICE.totalTuitionUgx - tuitionPaidUgx))}
                  </div>
                </div>
              </div>

              {tuitionPaidUgx < DEMO_TUITION_INVOICE.totalTuitionUgx && (
                <button
                  type="button"
                  onClick={() => {
                    setTuitionPaidUgx(DEMO_TUITION_INVOICE.totalTuitionUgx);
                    setPaymentSuccessNotice(
                      `Tuition installment of ${formatUgx(DEMO_TUITION_INVOICE.balanceUgx)} paid to ${DEMO_TUITION_INVOICE.institutionName}. Official receipt issued.`
                    );
                  }}
                  className="w-full rounded-xl bg-gold px-4 py-2.5 text-xs font-semibold text-ink-gold"
                >
                  Pay Remaining Balance ({formatUgx(DEMO_TUITION_INVOICE.balanceUgx)}) via Mobile Money
                </button>
              )}
            </div>

            {/* All-Access Subscription Passes */}
            <div className="space-y-3">
              {DEMO_SUBSCRIPTION_PASSES.map((pass) => {
                const isSubbed = activeSubscriptionPassId === pass.id;
                return (
                  <div
                    key={pass.id}
                    className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">
                          {pass.stream === "all_access" ? "All Streams" : STREAM_LABELS[pass.stream]}
                        </span>
                        <h3 className="font-display text-base font-semibold text-ink">
                          {pass.name}
                        </h3>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gold">
                          {formatUgx(pass.monthlyPriceUgx)}/mo
                        </div>
                        <div className="text-[11px] text-ink-500">
                          or {formatUgx(pass.annualPriceUgx)}/yr
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-1 text-xs text-ink-500">
                      {pass.benefits.map((b) => (
                        <li key={b} className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-gold shrink-0" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveSubscriptionPassId(pass.id);
                        setPaymentSuccessNotice(`Activated ${pass.name}. All stream courses unlocked!`);
                      }}
                      className={`w-full rounded-xl px-4 py-2 text-xs font-semibold ${
                        isSubbed
                          ? "border border-gold bg-gold/15 text-gold"
                          : "bg-gold text-ink-gold"
                      }`}
                    >
                      {isSubbed ? "✓ Pass Active" : "Activate Monthly Pass"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── In-App Study Resource Preview Modal (No 404 /downloads links!) ─── */}
      {previewResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-gold shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-ink">{previewResource.name}</h3>
                  <p className="text-xs text-ink-500">
                    {previewResource.courseTitle} · {previewResource.size}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewResource(null)}
                className="text-ink-500 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3.5 text-xs text-ink space-y-1.5">
              <div className="font-semibold text-gold">Document Summary & Reference</div>
              <p className="text-ink-500 leading-relaxed">
                Official study sheet attached to <strong>{previewResource.lessonTitle}</strong>. Verified for offline revision and practice exercises.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob(
                    [
                      `Peebee Learn Official Study Resource\nCourse: ${previewResource.courseTitle}\nLesson: ${previewResource.lessonTitle}\nFile: ${previewResource.name}\n`,
                    ],
                    { type: "text/plain;charset=utf-8" }
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${previewResource.name}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                  setPreviewResource(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-ink-gold"
              >
                <Download className="h-3.5 w-3.5" />
                Save Copy to Device
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
