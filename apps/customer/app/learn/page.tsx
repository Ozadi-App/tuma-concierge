"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  Sparkles,
  Award,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Camera,
  Play,
  Pause,
  Volume2,
  RotateCcw,
  Upload,
  Calendar,
  FileText,
  AlertCircle,
  QrCode,
  Download,
  Star,
  Users,
  ChevronRight,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  Check,
  X,
  CreditCard,
  MessageSquare,
  Wrench,
  HelpCircle,
  Share2,
  Video,
  Radio,
  Send,
  Paperclip,
  Mic,
} from "lucide-react";
import {
  EDUCATION_STREAMS,
  EducationStream,
  DEMO_INSTITUTIONS,
  DEMO_SPROUTS_ACTIVITIES,
  DEMO_SPROUTS_TIMER,
  DEMO_SPROUTS_COPLAY,
  DEMO_FOUNDATIONS_WORKSHEETS,
  DEMO_FOUNDATIONS_SUBMISSIONS,
  DEMO_FOUNDATIONS_MERITS,
  DEMO_ACADEMY_TIMETABLE,
  DEMO_ACADEMY_EXAM,
  DEMO_ACADEMY_REPORT_CARD,
  DEMO_CAMPUS_COURSE,
  DEMO_CAMPUS_PEER_REVIEW,
  DEMO_CAMPUS_CREDENTIAL,
  DEMO_SKILLS_COURSE,
  DEMO_SKILLS_SUBMISSION,
  DEMO_SKILLS_LOGBOOK,
  DEMO_TUITION_INVOICE,
  DEMO_SUBSCRIPTION_PASSES,
  DEMO_GUARDIAN_ALERTS,
  DEMO_LIVE_MEETINGS,
  DEMO_TUTOR_CONTACTS,
  DEMO_LIVE_CHAT_MESSAGES,
} from "@peebee/shared";

const ugx = (amount: number) => `UGX ${Math.round(amount).toLocaleString()}`;

export default function EducationHubPage() {
  const [activeStream, setActiveStream] = useState<EducationStream>("sprouts");
  const [userRole, setUserRole] = useState<"student" | "parent">("student");

  // Sprouts State
  const [sproutsPlayingAudio, setSproutsPlayingAudio] = useState(false);
  const [sproutsActiveActivityIndex, setSproutsActiveActivityIndex] = useState(0);
  const [sproutsStickersUnlocked, setSproutsStickersUnlocked] = useState<string[]>([
    "sticker_golden_lion",
    "sticker_crowned_crane",
  ]);
  const [sproutsTimerRemaining, setSproutsTimerRemaining] = useState(DEMO_SPROUTS_TIMER.minutesRemainingToday);
  const [sproutsTimerLocked, setSproutsTimerLocked] = useState(false);
  const [parentPinInput, setParentPinInput] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState("");
  const [storybookPage, setStorybookPage] = useState(0);

  // Foundations State
  const [activeWorksheet, setActiveWorksheet] = useState(DEMO_FOUNDATIONS_WORKSHEETS[0]);
  const [showWorksheetModal, setShowWorksheetModal] = useState(false);
  const [worksheetPhotoPreview, setWorksheetPhotoPreview] = useState<string | null>(null);
  const [parentSignName, setParentSignName] = useState("Grace Mukasa");
  const [parentSignPin, setParentSignPin] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submissionsList, setSubmissionsList] = useState(DEMO_FOUNDATIONS_SUBMISSIONS);
  const [totalMerits, setTotalMerits] = useState(DEMO_FOUNDATIONS_MERITS.totalMerits);

  // Academy State
  const [showExamModal, setShowExamModal] = useState(false);
  const [examTabSwitches, setExamTabSwitches] = useState(0);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examScoreResult, setExamScoreResult] = useState<number | null>(null);
  const [examTimerSecs, setExamTimerSecs] = useState(5400); // 90 mins
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({
    q1: "x = 1, x = 1.5",
  });

  // Campus State
  const [campusPlaybackSpeed, setCampusPlaybackSpeed] = useState<number>(1.0);
  const [campusActiveVideoSec, setCampusActiveVideoSec] = useState<number>(45);
  const [campusNoteInput, setCampusNoteInput] = useState("");
  const [campusNotes, setCampusNotes] = useState<{ id: string; timestamp: number; text: string }[]>([
    { id: "n1", timestamp: 35, text: "Key insight: MTN MoMo open API operates on push USSD callback." },
  ]);
  const [showPeerReviewModal, setShowPeerReviewModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);

  // Skills State
  const [skillsSelectedCritiqueSec, setSkillsSelectedCritiqueSec] = useState<number | null>(42);
  const [skillsVideoTime, setSkillsVideoTime] = useState(42);
  const [skillsLogbookList, setSkillsLogbookList] = useState(DEMO_SKILLS_LOGBOOK);
  const [showLogHoursModal, setShowLogHoursModal] = useState(false);
  const [logHoursInput, setLogHoursInput] = useState("6.0");
  const [logTaskInput, setLogTaskInput] = useState("Scissor over comb graduation and neck sanitation");
  const [showUploadVideoModal, setShowUploadVideoModal] = useState(false);

  // Tuition & Invoicing State
  const [showTuitionModal, setShowTuitionModal] = useState(false);
  const [tuitionInvoice, setTuitionInvoice] = useState(DEMO_TUITION_INVOICE);
  const [payAmountInput, setPayAmountInput] = useState("350000");
  const [tuitionPaymentSuccess, setTuitionPaymentSuccess] = useState(false);

  // Live Meetings & Tutor Chat State
  const [showTutorChatDrawer, setShowTutorChatDrawer] = useState(false);
  const [customerActiveTutor, setCustomerActiveTutor] = useState(DEMO_TUTOR_CONTACTS[0]);
  const [customerChatInput, setCustomerChatInput] = useState("");
  const [customerChatMessages, setCustomerChatMessages] = useState(DEMO_LIVE_CHAT_MESSAGES);
  const [customerIsQuestion, setCustomerIsQuestion] = useState(false);

  const handleCustomerSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerChatInput.trim()) return;

    const newMsg = {
      id: `c_msg_${Date.now()}`,
      senderId: "customer_user",
      senderName: userRole === "parent" ? "Grace Mukasa (Parent)" : "Denis Kigozi (Student)",
      senderRole: userRole === "parent" ? ("parent" as const) : ("student" as const),
      text: customerChatInput.trim(),
      timestamp: "Just now",
      isQuestion: customerIsQuestion,
      upvotes: 0,
    };

    setCustomerChatMessages((prev) => [...prev, newMsg]);
    setCustomerChatInput("");
    setCustomerIsQuestion(false);

    setTimeout(() => {
      const replyMsg = {
        id: `c_reply_${Date.now()}`,
        senderId: customerActiveTutor.id,
        senderName: customerActiveTutor.name,
        senderRole: "tutor" as const,
        text: `Hello ${userRole === "parent" ? "Mrs. Mukasa" : "Denis"}, I received your message. I am actively reviewing your academic inquiry right now!`,
        timestamp: "Just now",
      };
      setCustomerChatMessages((prev) => [...prev, replyMsg]);
    }, 1200);
  };

  // Focus integrity listener for Academy Exam simulator
  useEffect(() => {
    if (!showExamModal || examSubmitted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setExamTabSwitches((prev) => prev + 1);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [showExamModal, examSubmitted]);

  // Sprouts Audio Guidance Simulator
  const toggleSproutsAudio = () => {
    setSproutsPlayingAudio((prev) => !prev);
  };

  const handleUnlockPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (parentPinInput === "1234" || parentPinInput === "0000") {
      setSproutsTimerLocked(false);
      setSproutsTimerRemaining(30);
      setShowPinModal(false);
      setParentPinInput("");
      setPinError("");
    } else {
      setPinError("Incorrect 4-digit PIN. (Demo PIN: 1234)");
    }
  };

  const handleWorksheetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentSignPin) {
      alert("Parent digital signature PIN required for primary homework turn-in.");
      return;
    }

    const newSub = {
      id: `sub_${Date.now()}`,
      worksheetId: activeWorksheet.id,
      worksheetTitle: activeWorksheet.title,
      subject: activeWorksheet.subject,
      studentId: "stud_timothy",
      studentName: "Timothy Mukasa",
      scannedPhotoUrls: [worksheetPhotoPreview || activeWorksheet.samplePhotoUrl || ""],
      parentSigned: true,
      parentSignerName: parentSignName,
      parentSignedAt: "Just now",
      status: "graded" as const,
      meritPointsEarned: activeWorksheet.maxMeritPoints,
      teacherRemarks: "Great work! Parent signature verified.",
      submittedAt: "Just now",
    };

    setSubmissionsList([newSub, ...submissionsList]);
    setTotalMerits((prev) => prev + activeWorksheet.maxMeritPoints);
    setSubmissionSuccess(true);
    setTimeout(() => {
      setSubmissionSuccess(false);
      setShowWorksheetModal(false);
      setWorksheetPhotoPreview(null);
    }, 1800);
  };

  const handleExamSubmit = () => {
    let finalScore = 88;
    if (examTabSwitches > 0) {
      finalScore = Math.max(50, finalScore - examTabSwitches * 6);
    }
    setExamScoreResult(finalScore);
    setExamSubmitted(true);
  };

  const handleAddCampusNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campusNoteInput.trim()) return;
    setCampusNotes([
      ...campusNotes,
      {
        id: `n_${Date.now()}`,
        timestamp: campusActiveVideoSec,
        text: campusNoteInput.trim(),
      },
    ]);
    setCampusNoteInput("");
  };

  const handleAddLogbookHours = (e: React.FormEvent) => {
    e.preventDefault();
    const hours = parseFloat(logHoursInput) || 4;
    const newEntry = {
      id: `log_${Date.now()}`,
      studentId: "stud_denis",
      studentName: "Denis Kigozi",
      date: new Date().toISOString().slice(0, 10),
      practicalHours: hours,
      taskPerformed: logTaskInput,
      workshopLocation: "Peebee Barber Studio, Kisementi",
      masterSupervisorName: "Master Alex Mukasa",
      supervisorSignatureRecorded: true,
      supervisorSignedAt: "Just now",
    };
    setSkillsLogbookList([newEntry, ...skillsLogbookList]);
    setShowLogHoursModal(false);
  };

  const handleTuitionPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(payAmountInput, 10) || 100000;
    const newPaid = tuitionInvoice.amountPaidUgx + amount;
    const newBal = Math.max(0, tuitionInvoice.totalTuitionUgx - newPaid);
    setTuitionInvoice({
      ...tuitionInvoice,
      amountPaidUgx: newPaid,
      balanceUgx: newBal,
      status: newBal <= 0 ? "paid" : "partial",
    });
    setTuitionPaymentSuccess(true);
    setTimeout(() => {
      setTuitionPaymentSuccess(false);
      setShowTuitionModal(false);
    }, 1800);
  };

  const currentStreamMeta = EDUCATION_STREAMS.find((s) => s.id === activeStream)!;

  return (
    <div className="mx-auto min-h-screen max-w-xl pb-32 pt-2 px-4 space-y-6">
      {/* Platform Header */}
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-gold uppercase tracking-wider">
              <GraduationCap className="h-4 w-4 text-gold" />
              <span>Peebee Education Platform</span>
            </div>
            <h1 className="mt-1 text-2xl font-black text-ink">Learning Streams</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Role switch toggle */}
            <div className="flex rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setUserRole("student")}
                className={`rounded-xl px-2.5 py-1 transition ${
                  userRole === "student" ? "bg-gold text-ink-gold font-black shadow-sm" : "text-ink-500"
                }`}
              >
                Learner
              </button>
              <button
                type="button"
                onClick={() => setUserRole("parent")}
                className={`rounded-xl px-2.5 py-1 transition ${
                  userRole === "parent" ? "bg-gold text-ink-gold font-black shadow-sm" : "text-ink-500"
                }`}
              >
                Parent / Guardian
              </button>
            </div>

            {/* Tuition Balance Button */}
            <button
              type="button"
              onClick={() => setShowTuitionModal(true)}
              className="relative flex h-10 items-center gap-1.5 rounded-2xl border border-gold/40 bg-gold/10 px-3 text-xs font-black text-gold shadow-sm transition hover:bg-gold/20"
              title="Tuition & Passes"
            >
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Tuition</span>
            </button>
          </div>
        </div>

        {/* 5-Tier Education Stream Tabs */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {EDUCATION_STREAMS.map((st) => {
            const active = activeStream === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setActiveStream(st.id)}
                className={`flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-black transition active:scale-95 ${
                  active
                    ? "bg-gold text-ink-gold shadow-md font-black"
                    : "border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] text-ink-500 hover:text-ink"
                }`}
              >
                <span className="text-base">{st.icon}</span>
                <div className="text-left leading-tight">
                  <div className="font-black">{st.title}</div>
                  <div className="text-[9px] opacity-80 font-medium">{st.ageBracket}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Stream Purpose Banner */}
        <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3.5 py-2.5 text-xs text-ink-500 flex items-start gap-2.5">
          <span className="text-lg shrink-0 mt-0.5">{currentStreamMeta.icon}</span>
          <div>
            <span className="font-bold text-ink">{currentStreamMeta.tagline}:</span>{" "}
            <span>{currentStreamMeta.pedagogicalFocus}</span>
          </div>
        </div>
      </header>

      {/* Live Classroom Streaming Now Banner (Zoom-Style Integration) */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-red-500/30 bg-gradient-to-r from-red-500/10 via-[rgb(var(--surface-card))] to-[rgb(var(--surface-card))] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400">
              Live Classroom Streaming Now
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

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <a
            href="http://localhost:3011/live/live_fintech_101"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-2xl bg-gold px-4 py-2.5 text-xs font-black text-ink-gold shadow-sm transition hover:opacity-95 active:scale-95"
          >
            <Video className="h-4 w-4" />
            Join Live Class (Zoom-Style)
          </a>

          <button
            type="button"
            onClick={() => setShowTutorChatDrawer(true)}
            className="flex items-center gap-1.5 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-4 py-2.5 text-xs font-bold text-ink transition hover:border-gold hover:text-gold"
          >
            <MessageSquare className="h-4 w-4 text-gold" />
            Live Chat with Tutor
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SPROUTS STREAM (AGES 3-6: Non-text, tablet-first, audio guide, stickers) */}
      {/* ========================================================================= */}
      {activeStream === "sprouts" && (
        <section className="space-y-4">
          {/* Audio Character Guide Mascot Banner */}
          <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 via-[rgb(var(--surface-card))] to-emerald-500/5 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-3xl shadow-md">
                  🦁
                </div>
                <div>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-600">
                    Spoken Audio Guide
                  </span>
                  <h2 className="text-lg font-black text-ink">Kigo the Lion Cub</h2>
                  <p className="text-xs text-ink-500">
                    &ldquo;Tap the big green button to hear your mission!&rdquo;
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleSproutsAudio}
                className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition active:scale-95 ${
                  sproutsPlayingAudio
                    ? "bg-emerald-600 text-white animate-pulse"
                    : "bg-emerald-500 text-white"
                }`}
                aria-label="Play character voice instructions"
              >
                {sproutsPlayingAudio ? <Volume2 className="h-6 w-6" /> : <Play className="h-6 w-6 fill-current" />}
              </button>
            </div>

            {sproutsPlayingAudio && (
              <div className="mt-3 rounded-2xl bg-emerald-500/10 p-3 border border-emerald-500/30 flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 animate-fade-in">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Audio Playing: &ldquo;Hello little friend! Tap the shiny vowels to feed Kigo!&rdquo;</span>
              </div>
            )}
          </div>

          {/* Screen Timer & Parental Supervision Bar */}
          <div className="flex items-center justify-between rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3.5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-xs font-bold text-ink">Screen Timer (Eye Rest Guard)</p>
                <p className="text-[10px] text-ink-500">{sproutsTimerRemaining} minutes remaining today</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPinModal(true)}
              className="flex items-center gap-1 rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-2.5 py-1.5 text-[11px] font-bold text-ink-500 hover:text-ink"
            >
              <KeyRound className="h-3.5 w-3.5 text-gold" />
              <span>Parent PIN</span>
            </button>
          </div>

          {/* Interactive Touch Activity: Drag & Drop Vowels */}
          <div className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  Touch & Sound Game
                </span>
                <h3 className="text-base font-black text-ink">
                  {DEMO_SPROUTS_ACTIVITIES[sproutsActiveActivityIndex].title}
                </h3>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-black text-emerald-600">
                ⭐ +1 Sticker
              </span>
            </div>

            {/* Graphic Interactive Canvas Tap Area */}
            <div className="rounded-2xl border-2 border-dashed border-emerald-400/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-6 text-center space-y-4">
              <p className="text-xs font-bold text-ink-500">
                Tap matching sounds or drag the fruits into the basket!
              </p>

              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {DEMO_SPROUTS_ACTIVITIES[0].gameConfig.matchingPairs?.map((pair, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      alert(`Letter ${pair.match} matched! Great job!`);
                      if (!sproutsStickersUnlocked.includes("sticker_super_boda")) {
                        setSproutsStickersUnlocked([...sproutsStickersUnlocked, "sticker_super_boda"]);
                      }
                    }}
                    className="flex flex-col items-center justify-center rounded-2xl border border-emerald-300/40 bg-[rgb(var(--surface-card))] p-3 shadow-md transition hover:scale-105 active:scale-90"
                  >
                    <span className="text-3xl">{pair.item}</span>
                    <span className="mt-1 font-black text-lg text-emerald-600">{pair.match}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Synchronized Read-Along Storybook */}
          <div className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛵</span>
                <div>
                  <h3 className="text-sm font-black text-ink">Read-Along: The Little Boda That Could</h3>
                  <p className="text-[10px] text-ink-500">Page {storybookPage + 1} of 3 · Dual Audio & Text</p>
                </div>
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setStorybookPage(Math.max(0, storybookPage - 1))}
                  disabled={storybookPage === 0}
                  className="rounded-xl border border-[var(--border-faint)] p-2 text-xs text-ink-500 hover:text-ink disabled:opacity-40"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setStorybookPage(Math.min(2, storybookPage + 1))}
                  disabled={storybookPage === 2}
                  className="rounded-xl border border-[var(--border-faint)] p-2 text-xs text-ink-500 hover:text-ink disabled:opacity-40"
                >
                  →
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--border-faint)] bg-black/5">
              <img
                src={DEMO_SPROUTS_ACTIVITIES[2].gameConfig.storyPages?.[storybookPage]?.imageUrl}
                alt="Story illustration"
                className="h-44 w-full object-cover"
              />
              <div className="p-4 bg-[rgb(var(--surface-card))]">
                <p className="text-sm font-bold text-ink leading-relaxed">
                  {DEMO_SPROUTS_ACTIVITIES[2].gameConfig.storyPages?.[storybookPage]?.text}
                </p>
              </div>
            </div>
          </div>

          {/* Sticker Book Rewards Tray */}
          <div className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-ink">My Digital Sticker Album</h3>
              <span className="text-xs font-bold text-emerald-600">{sproutsStickersUnlocked.length} Collected</span>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-center">
                <span className="text-3xl animate-bounce">🦁</span>
                <span className="mt-1 text-[10px] font-black text-ink">Golden Lion</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-center">
                <span className="text-3xl">🦩</span>
                <span className="mt-1 text-[10px] font-black text-ink">Crowned Crane</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-center">
                <span className="text-3xl">🛵</span>
                <span className="mt-1 text-[10px] font-black text-ink">Super Boda</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3 text-center opacity-60">
                <span className="text-3xl">❓</span>
                <span className="mt-1 text-[10px] font-medium text-ink-500">Locked</span>
              </div>
            </div>
          </div>

          {/* Parental Co-Play Offline Prompt */}
          <div className="rounded-3xl border border-gold/40 bg-gold/10 p-4 shadow-sm flex items-start gap-3">
            <span className="text-2xl shrink-0">🏡</span>
            <div className="space-y-1">
              <h4 className="text-xs font-black text-ink">{DEMO_SPROUTS_COPLAY.promptTitle}</h4>
              <p className="text-xs text-ink-500 leading-relaxed">{DEMO_SPROUTS_COPLAY.offlineActionPrompt}</p>
              <p className="text-[10px] font-semibold text-gold pt-1">Parent tip: {DEMO_SPROUTS_COPLAY.parentTip}</p>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 2. FOUNDATIONS STREAM (AGES 6-12: Primary worksheets, photo scan, merits) */}
      {/* ========================================================================= */}
      {activeStream === "foundations" && (
        <section className="space-y-4">
          {/* Merit Points & Habit Streak Wallet */}
          <div className="rounded-3xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 via-[rgb(var(--surface-card))] to-amber-500/5 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                  Daily Habit & Merits Wallet
                </span>
                <h2 className="text-2xl font-black text-ink">{totalMerits} Stars</h2>
                <p className="text-xs text-ink-500">🔥 14-Day Homework Punctuality Streak</p>
              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-ink-gold shadow-md">
                <Star className="h-7 w-7 fill-current" />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-[var(--border-faint)] text-[11px] font-bold text-ink-500">
              <span className="text-amber-600">Recent: +25 Stars (Primary 4 Math homework turned in on time)</span>
            </div>
          </div>

          {/* Active Homework Worksheets Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-ink">Assigned Homework Worksheets</h3>
              <span className="text-xs text-ink-500">{DEMO_FOUNDATIONS_WORKSHEETS.length} due this week</span>
            </div>

            <div className="space-y-2.5">
              {DEMO_FOUNDATIONS_WORKSHEETS.map((ws) => (
                <div
                  key={ws.id}
                  className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-300">
                          {ws.gradeLevel} · {ws.subject}
                        </span>
                        <span className="text-[11px] text-ink-500">{ws.dueDate}</span>
                      </div>
                      <h4 className="text-sm font-black text-ink leading-snug">{ws.title}</h4>
                      <p className="text-xs text-ink-500 line-clamp-2">{ws.instructions}</p>
                    </div>

                    <span className="rounded-xl bg-amber-500/10 px-2 py-1 text-xs font-black text-amber-600 shrink-0">
                      +{ws.maxMeritPoints} Stars
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-faint)]">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveWorksheet(ws);
                        setShowWorksheetModal(true);
                      }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gold py-2.5 text-xs font-black text-ink-gold shadow transition hover:opacity-95 active:scale-98"
                    >
                      <Camera className="h-4 w-4" />
                      Take Photo & Turn In (Parent Sign-Off)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submissions & Graded Exercise History */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-ink">Turned In Work & Teacher Feedback</h3>

            <div className="space-y-2.5">
              {submissionsList.map((sub) => (
                <div
                  key={sub.id}
                  className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3.5 shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-ink">{sub.worksheetTitle}</h4>
                      <p className="text-[10px] text-ink-500">
                        {sub.subject} · Signed by {sub.parentSignerName}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-600">
                      ✓ Graded: +{sub.meritPointsEarned} Stars
                    </span>
                  </div>

                  {sub.teacherRemarks && (
                    <div className="rounded-xl bg-[rgb(var(--surface-muted))] p-2.5 text-xs text-ink-500">
                      <span className="font-bold text-ink">Teacher remarks:</span> {sub.teacherRemarks}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. ACADEMY STREAM (AGES 12-18: Term pacing, timed exams, report cards)   */}
      {/* ========================================================================= */}
      {activeStream === "academy" && (
        <section className="space-y-4">
          {/* Term 1 2026 Academic Calendar & Homeroom Banner */}
          <div className="rounded-3xl border border-indigo-400/40 bg-gradient-to-br from-indigo-500/15 via-[rgb(var(--surface-card))] to-indigo-500/5 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  Greenwood International Academy
                </span>
                <h2 className="text-xl font-black text-ink">Senior 4 East — Term 1</h2>
                <p className="text-xs text-ink-500">Homeroom Master: Mr. Kenneth Ochieng · 98.5% Attendance</p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
                🏛️
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-faint)] text-xs">
              <div>
                <span className="text-ink-500">Midterm Exams:</span>{" "}
                <span className="font-bold text-ink">March 16–20</span>
              </div>
              <div className="text-right">
                <span className="text-ink-500">Terminal Reports:</span>{" "}
                <span className="font-bold text-indigo-600">May 1, 2026</span>
              </div>
            </div>
          </div>

          {/* Timed Examination Simulator Launcher */}
          <div className="rounded-3xl border border-indigo-500/30 bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-black text-indigo-600">
                  Official UNEB Mock Examination
                </span>
                <h3 className="text-base font-black text-ink">{DEMO_ACADEMY_EXAM.title}</h3>
                <p className="text-xs text-ink-500">
                  Duration: {DEMO_ACADEMY_EXAM.durationMinutes} mins · {DEMO_ACADEMY_EXAM.questions.length} sections · Proctored with anti-cheat detection
                </p>
              </div>

              <span className="rounded-2xl bg-indigo-600 px-3 py-2 text-xs font-black text-white shadow shrink-0">
                100 Marks
              </span>
            </div>

            <div className="pt-2 border-t border-[var(--border-faint)]">
              <button
                type="button"
                onClick={() => {
                  setShowExamModal(true);
                  setExamSubmitted(false);
                  setExamTabSwitches(0);
                  setExamScoreResult(null);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-xs font-black text-white shadow transition hover:opacity-95 active:scale-98"
              >
                <ShieldCheck className="h-4 w-4" />
                Enter Secure Exam Hall (Proctored)
              </button>
            </div>
          </div>

          {/* Weekly Period Timetable Grid */}
          <div className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-ink">Weekly Class Timetable</h3>
              <span className="text-xs font-bold text-indigo-600">Senior 4 East</span>
            </div>

            <div className="space-y-2">
              {DEMO_ACADEMY_TIMETABLE[0].periods.map((period) => (
                <div
                  key={period.periodNumber}
                  className="flex items-center justify-between rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-indigo-600 text-[11px]">
                      {period.startTime} - {period.endTime}
                    </span>
                    <div>
                      <p className="font-bold text-ink">{period.subject}</p>
                      <p className="text-[10px] text-ink-500">{period.teacherName}</p>
                    </div>
                  </div>

                  <span className="rounded-lg bg-[rgb(var(--surface-card))] px-2 py-1 text-[10px] font-bold text-ink-500 border border-[var(--border-faint)]">
                    {period.roomOrLink}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Official Terminal Report Card Preview */}
          <div className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-ink">Official Terminal Report Card</h3>
                <p className="text-[10px] text-ink-500">Term 1 — 2026 · Class Rank: {DEMO_ACADEMY_REPORT_CARD.classRank}</p>
              </div>
              <span className="rounded-xl bg-gold/15 px-2.5 py-1 text-xs font-black text-gold">
                Overall: {DEMO_ACADEMY_REPORT_CARD.overallWeightedAverage}% (D1)
              </span>
            </div>

            <div className="divide-y divide-[var(--border-faint)]">
              {DEMO_ACADEMY_REPORT_CARD.subjects.map((sub) => (
                <div key={sub.code} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-ink">{sub.subjectName}</p>
                    <p className="text-[10px] text-ink-500">
                      HW 20% ({sub.homeworkScorePercent}%) · Midterm 30% ({sub.midtermScorePercent}%) · Final 50% ({sub.finalExamScorePercent}%)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-indigo-600 text-sm">{sub.finalGrade}</span>
                    <span className="block text-[10px] text-ink-500">{sub.weightedTotalPercent}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3 text-xs text-ink-500">
              <span className="font-bold text-ink">Principal remarks:</span> {DEMO_ACADEMY_REPORT_CARD.principalRemarks}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 4. CAMPUS STREAM (HIGHER ED & SELF-PACED BUSINESS COURSES: edX/Udemy style) */}
      {/* ========================================================================= */}
      {activeStream === "campus" && (
        <section className="space-y-4">
          {/* Executive Course Spotlight */}
          <div className="rounded-3xl border border-blue-400/40 bg-gradient-to-br from-blue-500/15 via-[rgb(var(--surface-card))] to-blue-500/5 p-5 shadow-sm space-y-3">
            <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-600">
              Executive Higher Education
            </span>
            <h2 className="text-xl font-black text-ink">{DEMO_CAMPUS_COURSE.title}</h2>
            <p className="text-xs text-ink-500 leading-relaxed">{DEMO_CAMPUS_COURSE.description}</p>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-ink-500">
              <span>👨‍🏫 {DEMO_CAMPUS_COURSE.instructorName}</span>
              <span>⭐ {DEMO_CAMPUS_COURSE.rating} ({DEMO_CAMPUS_COURSE.reviewCount} reviews)</span>
              <span>🎓 {DEMO_CAMPUS_COURSE.enrolledStudentsCount} students enrolled</span>
            </div>
          </div>

          {/* Interactive Fast-Paced Video Player with Speed & Notes */}
          <div className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-ink">Module 1.1: Mobile Money Architecture</h3>
              <div className="flex items-center gap-1.5">
                {[0.75, 1.0, 1.25, 1.5, 2.0].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setCampusPlaybackSpeed(spd)}
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-black transition ${
                      campusPlaybackSpeed === spd
                        ? "bg-blue-600 text-white"
                        : "border border-[var(--border-faint)] text-ink-500 hover:text-ink"
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Video preview container */}
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black flex items-center justify-center">
              <img
                src={DEMO_CAMPUS_COURSE.thumbnailUrl}
                alt="Video preview"
                className="h-full w-full object-cover opacity-60"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => alert("Simulating instant video playback at " + campusPlaybackSpeed + "x speed.")}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl transition hover:scale-110 active:scale-95"
                >
                  <Play className="h-6 w-6 fill-current ml-1" />
                </button>
                <span className="font-mono text-xs font-bold text-white/90 bg-black/60 px-2.5 py-1 rounded-full">
                  00:45 / 12:20 · Speed {campusPlaybackSpeed}x
                </span>
              </div>
            </div>

            {/* Video Timestamp Note-Taking Tray */}
            <div className="space-y-2 pt-2">
              <form onSubmit={handleAddCampusNote} className="flex gap-2">
                <div className="field-box flex-1 rounded-2xl border border-[var(--border-faint)]">
                  <input
                    type="text"
                    value={campusNoteInput}
                    onChange={(e) => setCampusNoteInput(e.target.value)}
                    placeholder="Take a private study note pinned to 00:45..."
                    className="w-full bg-transparent px-3 py-2.5 text-xs text-ink focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white shadow"
                >
                  Save Note
                </button>
              </form>

              {campusNotes.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {campusNotes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-start gap-2 rounded-xl bg-[rgb(var(--surface-muted))] p-2.5 text-xs"
                    >
                      <span className="font-mono font-bold text-blue-600 text-[11px] shrink-0">
                        {Math.floor(note.timestamp / 60)}:{(note.timestamp % 60).toString().padStart(2, "0")}
                      </span>
                      <p className="text-ink-500 flex-1">{note.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Modular Syllabus Tree Browser */}
          <div className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-black text-ink">Curriculum Syllabus Tree</h3>

            <div className="space-y-3">
              {DEMO_CAMPUS_COURSE.syllabus.map((mod) => (
                <div key={mod.id} className="rounded-2xl border border-[var(--border-faint)] p-3.5 space-y-2.5">
                  <h4 className="text-xs font-black text-ink">{mod.title}</h4>
                  <p className="text-[11px] text-ink-500">{mod.description}</p>

                  <div className="space-y-1.5">
                    {mod.sections[0].units.map((unit) => (
                      <div
                        key={unit.id}
                        className="flex items-center justify-between rounded-xl bg-[rgb(var(--surface-muted))] p-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Play className="h-3.5 w-3.5 text-blue-600" />
                          <span className="font-medium text-ink">{unit.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-ink-500">
                            {Math.floor(unit.durationSeconds / 60)}m
                          </span>
                          {unit.isPreview && (
                            <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold text-blue-600">
                              Free Preview
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Double-Blind Peer Review & Verifiable Credential */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setShowPeerReviewModal(true)}
              className="flex flex-col justify-between rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 text-left shadow-sm hover:border-blue-500/50 transition active:scale-98"
            >
              <div>
                <span className="text-2xl">👥</span>
                <h4 className="mt-2 text-xs font-black text-ink">Peer Review Capstone</h4>
                <p className="text-[10px] text-ink-500 mt-0.5">Grade 3 anonymous submissions using rubric</p>
              </div>
              <span className="mt-3 text-[11px] font-bold text-blue-600">Open Station →</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCertModal(true)}
              className="flex flex-col justify-between rounded-3xl border border-gold/40 bg-gold/10 p-4 text-left shadow-sm hover:border-gold transition active:scale-98"
            >
              <div>
                <span className="text-2xl">📜</span>
                <h4 className="mt-2 text-xs font-black text-ink">Verifiable Certificate</h4>
                <p className="text-[10px] text-ink-500 mt-0.5">Cryptographic SHA-256 & QR Code</p>
              </div>
              <span className="mt-3 text-[11px] font-bold text-gold">View Certificate →</span>
            </button>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 5. SKILLS STREAM (VOCATIONAL, TRADES & PRACTICAL TRAINING)               */}
      {/* ========================================================================= */}
      {activeStream === "skills" && (
        <section className="space-y-4">
          {/* Trade Masterclass Spotlight */}
          <div className="rounded-3xl border border-orange-400/40 bg-gradient-to-br from-orange-500/15 via-[rgb(var(--surface-card))] to-orange-500/5 p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-orange-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-600">
                {DEMO_SKILLS_COURSE.nationalTradeTestStandard}
              </span>
              <span className="text-2xl">💈</span>
            </div>

            <h2 className="text-xl font-black text-ink">{DEMO_SKILLS_COURSE.title}</h2>
            <p className="text-xs text-ink-500">
              Master Artisan: {DEMO_SKILLS_COURSE.masterArtisanName} · {DEMO_SKILLS_COURSE.workshopLocation}
            </p>
          </div>

          {/* Practical Video Submission Station with Second-Mark Critiques */}
          <div className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                  Performance-Based Submission
                </span>
                <h3 className="text-sm font-black text-ink">{DEMO_SKILLS_SUBMISSION.taskTitle}</h3>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-black text-emerald-600">
                {DEMO_SKILLS_SUBMISSION.finalGrade}
              </span>
            </div>

            {/* Video scrubbing simulator with critique pins */}
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
              <img
                src={DEMO_SKILLS_COURSE.thumbnailUrl}
                alt="Practical submission"
                className="h-full w-full object-cover opacity-70"
              />
              <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-black/80 via-transparent to-black/40">
                <div className="flex items-center justify-between text-white text-xs font-bold">
                  <span>Student: {DEMO_SKILLS_SUBMISSION.studentName}</span>
                  <span className="font-mono">00:42 / 02:45</span>
                </div>

                <div className="space-y-2">
                  {/* Timeline bar with critique pins */}
                  <div className="relative h-2 w-full rounded-full bg-white/30 cursor-pointer">
                    <div className="h-2 rounded-full bg-orange-500 w-[25%]" />
                    {/* Critique pins at specific seconds */}
                    {DEMO_SKILLS_SUBMISSION.critiques.map((crit) => (
                      <button
                        key={crit.id}
                        type="button"
                        onClick={() => {
                          setSkillsSelectedCritiqueSec(crit.timestampSeconds);
                          setSkillsVideoTime(crit.timestampSeconds);
                        }}
                        className={`absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white shadow transition hover:scale-125 ${
                          crit.severity === "praise"
                            ? "bg-emerald-500"
                            : crit.severity === "safety_warning"
                            ? "bg-red-500"
                            : "bg-orange-500"
                        }`}
                        style={{ left: `${(crit.timestampSeconds / 165) * 100}%` }}
                        title={`Critique at 00:${crit.timestampSeconds}`}
                      />
                    ))}
                  </div>

                  <p className="text-[11px] text-white/90">
                    💡 Tap timeline pins above to jump to Master Artisan comments at specific seconds!
                  </p>
                </div>
              </div>
            </div>

            {/* Selected Pin Critique Detail Card */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-black text-ink">Master Artisan Timestamp Critiques:</h4>
              <div className="space-y-2">
                {DEMO_SKILLS_SUBMISSION.critiques.map((crit) => {
                  const isSelected = skillsSelectedCritiqueSec === crit.timestampSeconds;
                  return (
                    <div
                      key={crit.id}
                      onClick={() => setSkillsSelectedCritiqueSec(crit.timestampSeconds)}
                      className={`cursor-pointer rounded-2xl p-3 border transition text-xs space-y-1 ${
                        isSelected
                          ? "border-orange-500 bg-orange-500/10 shadow-sm"
                          : "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-orange-600 text-xs">
                          ⏱️ 00:{crit.timestampSeconds}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                          {crit.severity.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-ink leading-relaxed">{crit.critiqueText}</p>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowUploadVideoModal(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 text-xs font-black text-white shadow transition hover:opacity-95"
              >
                <Upload className="h-4 w-4" />
                Upload New Practical Demonstration Video
              </button>
            </div>
          </div>

          {/* Visual Tool & Equipment Checklists */}
          <div className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-ink">Required Tool & Equipment Checklist</h3>
              <span className="text-xs text-ink-500">{DEMO_SKILLS_COURSE.toolChecklist.length} Items</span>
            </div>

            <div className="space-y-2">
              {DEMO_SKILLS_COURSE.toolChecklist.map((tool, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <div>
                      <p className="font-bold text-ink">{tool.name}</p>
                      <p className="text-[10px] text-ink-500">{tool.specifications}</p>
                    </div>
                  </div>

                  {tool.safetyEquipment && (
                    <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-600 shrink-0">
                      Safety Gear
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step-by-Step Procedure Cards (Laminated style) */}
          <div className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-black text-ink">Step-by-Step Procedure Reference Cards</h3>

            <div className="space-y-2.5">
              {DEMO_SKILLS_COURSE.procedureCards.map((card) => (
                <div
                  key={card.stepNumber}
                  className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3.5 space-y-1.5 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-white">
                      {card.stepNumber}
                    </span>
                    <h4 className="text-xs font-black text-ink">{card.stepTitle}</h4>
                  </div>
                  <p className="text-xs text-ink-500 pl-7">{card.instruction}</p>
                  {card.criticalSafetyNote && (
                    <p className="text-[10px] font-bold text-red-600 pl-7">
                      ⚠️ Safety note: {card.criticalSafetyNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Digital Apprenticeship Logbook */}
          <div className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-ink">Apprenticeship Practical Logbook</h3>
                <p className="text-[10px] text-ink-500">Mentor-Verified Workshop Hours</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLogHoursModal(true)}
                className="rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-black text-white shadow"
              >
                + Log Hours
              </button>
            </div>

            <div className="space-y-2">
              {skillsLogbookList.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink">{entry.date} · {entry.practicalHours} Hours</span>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-600">
                      ✓ Supervisor Signed
                    </span>
                  </div>
                  <p className="text-ink-500">{entry.taskPerformed}</p>
                  <p className="text-[10px] text-ink-500 font-medium">
                    Verified by {entry.masterSupervisorName} ({entry.workshopLocation})
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODALS & DRAWERS                                                          */}
      {/* ========================================================================= */}

      {/* 1. Sprouts Parent PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-gold" />
                <h3 className="text-base font-black text-ink">Parent Lock Override</h3>
              </div>
              <button type="button" onClick={() => setShowPinModal(false)} className="text-ink-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-ink-500">
              Enter your 4-digit Parent Guardian PIN to adjust daily screen allowances or unlock early play.
            </p>

            <form onSubmit={handleUnlockPin} className="space-y-3">
              <div className="field-box rounded-2xl border border-[var(--border-faint)]">
                <input
                  type="password"
                  maxLength={4}
                  value={parentPinInput}
                  onChange={(e) => setParentPinInput(e.target.value)}
                  placeholder="Enter 4-digit PIN (1234)"
                  className="w-full bg-transparent px-4 py-3 text-center text-lg font-black tracking-widest text-ink focus:outline-none"
                  autoFocus
                />
              </div>

              {pinError && <p className="text-xs font-bold text-red-500">{pinError}</p>}

              <button
                type="submit"
                className="w-full rounded-2xl bg-gold py-3 text-xs font-black text-ink-gold shadow"
              >
                Confirm & Unlock Extra 30 Mins
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Foundations Worksheet Camera Photo Upload Modal */}
      {showWorksheetModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-faint)]">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-black text-ink">Turn In Worksheet</h3>
              </div>
              <button type="button" onClick={() => setShowWorksheetModal(false)} className="text-ink-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            {submissionSuccess ? (
              <div className="rounded-2xl bg-amber-500/15 p-6 text-center space-y-2">
                <CheckCircle2 className="mx-auto h-12 w-12 text-amber-500 animate-bounce" />
                <h4 className="text-base font-black text-ink">Homework Turned In!</h4>
                <p className="text-xs text-ink-500">
                  +{activeWorksheet.maxMeritPoints} Stars added to your Merit Wallet. Parent digital signature recorded.
                </p>
              </div>
            ) : (
              <form onSubmit={handleWorksheetSubmit} className="space-y-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-ink">{activeWorksheet.title}</h4>
                  <p className="text-[11px] text-ink-500">{activeWorksheet.instructions}</p>
                </div>

                {/* Photo Preview / Capture Box */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink-500">Homework Exercise Book Photo</label>
                  {worksheetPhotoPreview ? (
                    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[var(--border-faint)] bg-black">
                      <img
                        src={worksheetPhotoPreview}
                        alt="Worksheet scan"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setWorksheetPhotoPreview(null)}
                        className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-400/50 bg-[rgb(var(--surface-muted))] p-6 text-center cursor-pointer transition hover:border-amber-500">
                      <Camera className="h-8 w-8 text-amber-500 mb-2" />
                      <span className="text-xs font-bold text-ink">Take top-down camera photo of page</span>
                      <span className="mt-1 text-[11px] text-ink-500">Auto-contrast and perspective enhancement</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => setWorksheetPhotoPreview(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Required Parent Signature Verification */}
                <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-amber-600" />
                    <h5 className="text-xs font-black text-ink">Parent Digital Sign-Off (Required)</h5>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-ink-500">Parent / Guardian Name</label>
                    <div className="field-box rounded-2xl border border-[var(--border-faint)]">
                      <input
                        type="text"
                        value={parentSignName}
                        onChange={(e) => setParentSignName(e.target.value)}
                        className="w-full bg-transparent px-3 py-2 text-xs text-ink focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-ink-500">Parent Approval PIN</label>
                    <div className="field-box rounded-2xl border border-[var(--border-faint)]">
                      <input
                        type="password"
                        maxLength={4}
                        value={parentSignPin}
                        onChange={(e) => setParentSignPin(e.target.value)}
                        placeholder="Enter 4-digit PIN (1234)"
                        className="w-full bg-transparent px-3 py-2 text-xs text-ink focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-gold py-3 text-xs font-black text-ink-gold shadow transition hover:opacity-95"
                >
                  Confirm Signature & Turn In
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 3. Academy Exam Hall Modal with Anti-Cheat Detection */}
      {showExamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-indigo-500/40 bg-[rgb(var(--surface-card))] p-6 shadow-2xl space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-faint)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-500" />
                <h3 className="text-base font-black text-ink">Proctored Examination Hall</h3>
              </div>
              <button type="button" onClick={() => setShowExamModal(false)} className="text-ink-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Anti-cheat tab switch warning banner */}
            <div
              className={`rounded-2xl p-3 text-xs font-bold flex items-center gap-2 transition ${
                examTabSwitches > 0
                  ? "bg-red-500/15 text-red-600 border border-red-500/30"
                  : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20"
              }`}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                {examTabSwitches > 0
                  ? `Warning: ${examTabSwitches} browser tab switch events recorded and logged for exam proctor!`
                  : "Anti-cheat active: Do not leave or switch browser tabs during this test."}
              </span>
            </div>

            {examSubmitted ? (
              <div className="rounded-2xl bg-indigo-500/15 p-6 text-center space-y-2">
                <CheckCircle2 className="mx-auto h-12 w-12 text-indigo-600 animate-bounce" />
                <h4 className="text-lg font-black text-ink">Exam Submitted!</h4>
                <p className="text-sm font-black text-indigo-600">Calculated Score: {examScoreResult}%</p>
                <p className="text-xs text-ink-500">
                  Continuous Assessment grade has been recorded into your Greenwood terminal report card.
                </p>
                <button
                  type="button"
                  onClick={() => setShowExamModal(false)}
                  className="mt-2 rounded-2xl bg-indigo-600 px-6 py-2.5 text-xs font-black text-white"
                >
                  Close Exam Hall
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  {DEMO_ACADEMY_EXAM.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-ink-500">
                        <span>Question {idx + 1} ({q.questionType.replace("_", " ")})</span>
                        <span className="text-indigo-600">{q.maxPoints} Marks</span>
                      </div>
                      <p className="text-xs font-bold text-ink">{q.questionText}</p>

                      {q.options && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {q.options.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setExamAnswers({ ...examAnswers, [q.id]: opt })}
                              className={`rounded-xl p-2.5 text-xs font-bold text-left transition ${
                                examAnswers[q.id] === opt
                                  ? "bg-indigo-600 text-white font-black"
                                  : "bg-[rgb(var(--surface-card))] border border-[var(--border-faint)] text-ink"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}

                      {q.questionType === "formula_math" && (
                        <div className="field-box rounded-2xl border border-[var(--border-faint)]">
                          <textarea
                            rows={2}
                            placeholder="Enter mathematical derivative working out..."
                            className="w-full bg-transparent px-3 py-2 text-xs text-ink focus:outline-none resize-none font-mono"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleExamSubmit}
                  className="w-full rounded-2xl bg-indigo-600 py-3 text-xs font-black text-white shadow transition hover:opacity-95"
                >
                  Submit Final Examination
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Campus Verifiable Certificate Modal */}
      {showCertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-gold/40 bg-[rgb(var(--surface-card))] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-faint)]">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-gold" />
                <h3 className="text-base font-black text-ink">Verifiable Certificate</h3>
              </div>
              <button type="button" onClick={() => setShowCertModal(false)} className="text-ink-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-2xl border-2 border-gold/50 bg-gradient-to-br from-gold/15 via-[rgb(var(--surface-card))] to-gold/5 p-6 text-center space-y-3">
              <span className="text-xs font-black uppercase tracking-widest text-gold">
                Peebee Global Institute
              </span>
              <h4 className="text-lg font-black text-ink">{DEMO_CAMPUS_CREDENTIAL.studentName}</h4>
              <p className="text-xs text-ink-500">has successfully mastered and completed all capstones for</p>
              <p className="text-sm font-black text-ink">{DEMO_CAMPUS_CREDENTIAL.courseTitle}</p>

              <div className="my-2 flex justify-center">
                <div className="p-3 bg-white rounded-2xl shadow">
                  <QrCode className="h-20 w-20 text-ink" />
                </div>
              </div>

              <div className="space-y-1">
                <span className="block font-mono text-[10px] text-ink-500 break-all">
                  SHA-256: {DEMO_CAMPUS_CREDENTIAL.verificationHash.slice(0, 24)}...
                </span>
                <span className="text-[10px] font-bold text-emerald-600">
                  ✓ Cryptographically Signed & Verified
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => alert("Certificate link copied for LinkedIn Profile integration!")}
                className="flex-1 rounded-2xl bg-gold py-2.5 text-xs font-black text-ink-gold shadow"
              >
                Add to LinkedIn Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Skills Log Practical Hours Modal */}
      {showLogHoursModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-faint)]">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-orange-500" />
                <h3 className="text-base font-black text-ink">Record Practical Hours</h3>
              </div>
              <button type="button" onClick={() => setShowLogHoursModal(false)} className="text-ink-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddLogbookHours} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-ink-500">Hours Executed</label>
                <div className="field-box rounded-2xl border border-[var(--border-faint)]">
                  <input
                    type="number"
                    step="0.5"
                    value={logHoursInput}
                    onChange={(e) => setLogHoursInput(e.target.value)}
                    className="w-full bg-transparent px-3 py-2 text-xs text-ink focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-ink-500">Skills / Practical Tasks Executed</label>
                <div className="field-box rounded-2xl border border-[var(--border-faint)]">
                  <textarea
                    rows={2}
                    value={logTaskInput}
                    onChange={(e) => setLogTaskInput(e.target.value)}
                    className="w-full bg-transparent px-3 py-2 text-xs text-ink focus:outline-none resize-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-orange-500 py-3 text-xs font-black text-white shadow"
              >
                Submit for Master Supervisor Stamp
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 6. Tuition Invoicing & Passes Drawer Modal */}
      {showTuitionModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-faint)]">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-gold" />
                <h3 className="text-base font-black text-ink">Tuition Invoicing & Passes</h3>
              </div>
              <button type="button" onClick={() => setShowTuitionModal(false)} className="text-ink-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            {tuitionPaymentSuccess ? (
              <div className="rounded-2xl bg-gold/15 p-6 text-center space-y-2">
                <CheckCircle2 className="mx-auto h-12 w-12 text-gold animate-bounce" />
                <h4 className="text-base font-black text-ink">Payment Successful!</h4>
                <p className="text-xs text-ink-500">
                  Tuition receipt generated and automated WhatsApp confirmation dispatched to parent.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active Invoice Card */}
                <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gold">
                      {tuitionInvoice.institutionName}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                        tuitionInvoice.status === "paid"
                          ? "bg-emerald-500/20 text-emerald-600"
                          : "bg-amber-500/20 text-amber-600"
                      }`}
                    >
                      {tuitionInvoice.status}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-black text-ink">Total Tuition:</span>
                    <span className="font-mono text-base font-black text-ink">
                      {ugx(tuitionInvoice.totalTuitionUgx)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-ink-500">
                    <span>Paid to date: {ugx(tuitionInvoice.amountPaidUgx)}</span>
                    <span className="font-bold text-red-500">Balance: {ugx(tuitionInvoice.balanceUgx)}</span>
                  </div>
                </div>

                {/* Pay Installment Form */}
                {tuitionInvoice.balanceUgx > 0 && (
                  <form onSubmit={handleTuitionPayment} className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-ink-500">Installment Payment Amount (UGX)</label>
                      <div className="field-box rounded-2xl border border-[var(--border-faint)]">
                        <input
                          type="number"
                          value={payAmountInput}
                          onChange={(e) => setPayAmountInput(e.target.value)}
                          className="w-full bg-transparent px-3 py-2 text-xs text-ink focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                      <button
                        type="submit"
                        className="rounded-2xl bg-gold py-3 text-xs font-black text-ink-gold shadow transition hover:opacity-95"
                      >
                        Pay via Peebee Wallet
                      </button>
                      <button
                        type="submit"
                        className="rounded-2xl border border-gold bg-transparent py-3 text-xs font-black text-gold transition hover:bg-gold/10"
                      >
                        MTN / Airtel MoMo
                      </button>
                    </div>
                  </form>
                )}

                {/* Guardian Alerts Feed */}
                <div className="space-y-2 pt-2 border-t border-[var(--border-faint)]">
                  <h4 className="text-xs font-black text-ink">Recent Guardian SMS / WhatsApp Alerts</h4>
                  <div className="space-y-1.5">
                    {DEMO_GUARDIAN_ALERTS.map((alert) => (
                      <div
                        key={alert.id}
                        className="rounded-xl bg-[rgb(var(--surface-muted))] p-2.5 text-xs text-ink-500 space-y-0.5"
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold text-ink">
                          <span>{alert.channel.toUpperCase()} Dispatch</span>
                          <span>{alert.sentAt}</span>
                        </div>
                        <p>{alert.bodyText}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Quick Action: Live Tutor Chat Launcher */}
      <div className="fixed bottom-24 right-4 z-40">
        <button
          type="button"
          onClick={() => setShowTutorChatDrawer(true)}
          className="flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-xs font-black text-ink-gold shadow-lg transition hover:scale-105 active:scale-95"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-black"></span>
          </span>
          <MessageSquare className="h-4 w-4" />
          <span>Live Tutor Chat</span>
        </button>
      </div>

      {/* Live Tutor Chat Slide-Up Drawer / Modal */}
      {showTutorChatDrawer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
          <div className="relative flex h-[85vh] sm:h-[620px] w-full max-w-lg flex-col rounded-t-[28px] sm:rounded-[28px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={customerActiveTutor.avatarUrl}
                  alt={customerActiveTutor.name}
                  className="h-9 w-9 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="truncate text-xs font-black text-ink">{customerActiveTutor.name}</h3>
                  <p className="truncate text-[10px] text-ink-500">{customerActiveTutor.subject}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="http://localhost:3011/chat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-2.5 py-1 text-[10px] font-bold text-gold hover:border-gold"
                >
                  Open in Learner App ↗
                </a>
                <button
                  type="button"
                  onClick={() => setShowTutorChatDrawer(false)}
                  className="rounded-full bg-[rgb(var(--surface-card))] p-1 text-ink-500 hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Tutor Selector Pills */}
            <div className="flex gap-1.5 border-b border-[var(--border-faint)] px-3 py-2 overflow-x-auto bg-[rgb(var(--surface-card))]">
              {DEMO_TUTOR_CONTACTS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setCustomerActiveTutor(t)}
                  className={`shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-bold transition ${
                    customerActiveTutor.id === t.id
                      ? "bg-gold text-ink-gold font-black shadow-sm"
                      : "text-ink-500 hover:text-ink border border-[var(--border-faint)]"
                  }`}
                >
                  {t.name.split(" ")[0]} ({t.stream})
                </button>
              ))}
            </div>

            {/* Safeguarding Alert */}
            <div className="flex items-center gap-1.5 bg-green-500/10 px-3 py-1.5 text-[10px] font-medium text-green-700 dark:text-green-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>Safe Environment: Monitored for student protection & academic auditing.</span>
            </div>

            {/* Message Thread */}
            <div className="flex-1 space-y-2.5 p-3.5 overflow-y-auto bg-[rgb(var(--surface-muted))]/30">
              {customerChatMessages.map((msg) => {
                const isUser = msg.senderRole === "student" || msg.senderRole === "parent";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <span className="text-[9px] text-ink-500 mb-0.5">
                      {msg.senderName} • {msg.timestamp}
                    </span>
                    <div
                      className={`max-w-[85%] rounded-2xl p-2.5 text-xs ${
                        isUser
                          ? "bg-ink text-cream font-medium dark:bg-gold dark:text-black"
                          : "border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] text-ink"
                      }`}
                    >
                      {msg.isQuestion && (
                        <div className="mb-0.5 text-[9px] font-black uppercase text-gold">
                          Academic Question
                        </div>
                      )}
                      <p>{msg.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Composer */}
            <form onSubmit={handleCustomerSendMessage} className="border-t border-[var(--border-faint)] p-3 bg-[rgb(var(--surface-card))] space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer text-ink-500">
                  <input
                    type="checkbox"
                    checked={customerIsQuestion}
                    onChange={(e) => setCustomerIsQuestion(e.target.checked)}
                    className="rounded text-gold focus:ring-0"
                  />
                  <span>Tag as question for tutor</span>
                </label>
              </div>

              <div className="field-box px-3 py-1.5">
                <input
                  type="text"
                  placeholder={`Message ${customerActiveTutor.name.split(" ")[0]}...`}
                  value={customerChatInput}
                  onChange={(e) => setCustomerChatInput(e.target.value)}
                  className="w-full text-xs text-ink placeholder:text-ink-500/50"
                />
                <button
                  type="submit"
                  disabled={!customerChatInput.trim()}
                  className="ml-2 rounded-xl bg-gold px-3 py-1.5 text-xs font-black text-ink-gold disabled:opacity-40 transition hover:opacity-90"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
