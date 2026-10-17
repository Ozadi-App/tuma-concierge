"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Video,
  Radio,
  MessageSquare,
  Users,
  ChevronRight,
  Sparkles,
  BookOpen,
  GraduationCap,
  Wrench,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
} from "lucide-react";
import {
  EDUCATION_STREAMS,
  DEMO_LIVE_MEETINGS,
  DEMO_TUTOR_CONTACTS,
  type EducationStream,
} from "@peebee/shared";
import { useLearnAuth } from "@/lib/auth-context";

export default function LearnHomePage() {
  const { user, activeStream, setActiveStream } = useLearnAuth();
  const [roomCodeInput, setRoomCodeInput] = useState("");

  const activeMeeting = DEMO_LIVE_MEETINGS.find((m) => m.isLiveNow) || DEMO_LIVE_MEETINGS[0];
  const upcomingMeetings = DEMO_LIVE_MEETINGS.filter((m) => !m.isLiveNow);

  return (
    <div className="space-y-5">
      {/* Top Welcome Card */}
      <section className="home-card relative overflow-hidden bg-gradient-to-br from-cream to-cream-100 p-5 dark:from-black-700 dark:to-black-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-gold">
              <Sparkles className="h-3 w-3" />
              Active Track: {activeStream}
            </span>
            <h1 className="mt-2 text-xl font-black text-ink">
              Welcome back, {user?.name.split(" ")[0]}!
            </h1>
            <p className="mt-1 text-xs text-ink-500">
              You have 1 live classroom in session and 2 new feedback notes from your tutors.
            </p>
          </div>
        </div>

        {/* Stream Pills Bar */}
        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
          {EDUCATION_STREAMS.map((st) => {
            const isSelected = activeStream === st.id;
            return (
              <button
                key={st.id}
                onClick={() => setActiveStream(st.id as EducationStream)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-gold text-black shadow-sm font-black"
                    : "border border-[var(--border-faint)] bg-cream/70 text-ink-500 hover:text-ink dark:bg-black/40"
                }`}
              >
                <span>{st.icon}</span>
                <span>{st.title}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Live Classroom Streaming Banner (Zoom-Style) */}
      <section className="home-card relative overflow-hidden border-2 border-red-500/20 bg-gradient-to-r from-red-500/10 via-cream to-cream p-5 dark:from-red-950/30 dark:via-black-700 dark:to-black-900">
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
            {activeMeeting.participantCount} in Room
          </span>
        </div>

        <div className="mt-3">
          <h2 className="text-base font-black text-ink">{activeMeeting.title}</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            {activeMeeting.subject} • Hosted by{" "}
            <span className="font-bold text-ink">{activeMeeting.hostTutorName}</span> (
            {activeMeeting.hostTutorTitle})
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/live/${activeMeeting.id}`}
            className="flex items-center gap-2 rounded-2xl bg-gold px-5 py-2.5 text-xs font-black text-black shadow-sm transition hover:opacity-90 active:scale-95"
          >
            <Video className="h-4 w-4" />
            Join Live Class (Zoom-Style)
          </Link>

          <Link
            href="/live"
            className="flex items-center gap-1.5 text-xs font-bold text-ink-500 hover:text-ink"
          >
            All Live Sessions ({DEMO_LIVE_MEETINGS.length})
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* Quick Room Code Entry */}
      <section className="home-card p-4">
        <label className="text-xs font-black uppercase tracking-wider text-ink-500">
          Have a Classroom Room Code?
        </label>
        <div className="mt-2 flex gap-2">
          <div className="field-box flex-1 px-3 py-2">
            <input
              type="text"
              placeholder="e.g. PB-FIN-101"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              className="w-full text-xs font-bold uppercase tracking-wider text-ink placeholder:text-ink-500/50"
            />
          </div>
          <Link
            href={`/live/${roomCodeInput || activeMeeting.id}`}
            className="flex items-center gap-1.5 rounded-2xl bg-ink px-4 py-2 text-xs font-black text-cream transition hover:opacity-90 active:scale-95 dark:bg-gold dark:text-black"
          >
            Enter Room
          </Link>
        </div>
      </section>

      {/* Live Tutor Chat Previews */}
      <section className="home-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-black text-ink">Live Chat with Your Tutors</h2>
          </div>
          <Link href="/chat" className="text-xs font-bold text-gold hover:underline">
            Open Chat
          </Link>
        </div>
        <p className="mt-1 text-xs text-ink-500">
          Direct 1-on-1 support, homework questions, and voice note explanations.
        </p>

        <div className="mt-4 space-y-2.5">
          {DEMO_TUTOR_CONTACTS.map((tutor) => (
            <Link
              key={tutor.id}
              href={`/chat?tutor=${tutor.id}`}
              className="flex items-center justify-between rounded-2xl border border-[var(--border-faint)] bg-cream/50 p-3 transition hover:bg-cream-100 dark:bg-black/30 dark:hover:bg-black/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={tutor.avatarUrl}
                    alt={tutor.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  {tutor.isOnline && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-cream bg-green-500 dark:border-black-700" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-xs font-black text-ink">{tutor.name}</h3>
                    <span className="rounded bg-gold/15 px-1.5 py-0.2 text-[10px] font-bold text-gold capitalize">
                      {tutor.stream}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-ink-500">{tutor.lastMessage}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-medium text-ink-500">{tutor.lastMessageTime}</span>
                {tutor.unreadCount > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-black text-black">
                    {tutor.unreadCount}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-ink-500" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 5-Stream Feature Directory */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-black text-ink">Explore Education Streams</h2>
          </div>
          <Link href="/streams" className="text-xs font-bold text-gold hover:underline">
            View All
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {EDUCATION_STREAMS.map((st) => (
            <Link
              key={st.id}
              href={`/streams?stream=${st.id}`}
              className="home-card group flex flex-col justify-between p-4 transition hover:border-gold/50"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{st.icon}</span>
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-black uppercase text-gold">
                    {st.title}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-black text-ink group-hover:text-gold transition">
                  {st.title}
                </h3>
                <p className="mt-0.5 text-[11px] text-ink-500">{st.tagline}</p>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[var(--border-faint)] pt-2 text-[11px] font-bold text-ink-500">
                <span>{st.ageBracket}</span>
                <span className="flex items-center gap-1 text-gold">
                  Open Stream <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming Classroom Timetable */}
      <section className="home-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-black text-ink">Upcoming Timetable</h2>
          </div>
          <span className="text-xs font-bold text-ink-500">This Week</span>
        </div>

        <div className="mt-3 divide-y divide-[var(--border-faint)]">
          {upcomingMeetings.map((mt) => (
            <div key={mt.id} className="flex items-center justify-between py-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-gold">
                  {mt.scheduledFor} • {mt.durationMinutes} mins
                </span>
                <h3 className="text-xs font-black text-ink">{mt.title}</h3>
                <p className="text-[11px] text-ink-500">
                  {mt.hostTutorName} ({mt.hostTutorTitle})
                </p>
              </div>

              <Link
                href={`/live/${mt.id}`}
                className="shrink-0 rounded-xl border border-[var(--border-faint)] px-3 py-1.5 text-xs font-bold text-ink transition hover:border-gold hover:text-gold"
              >
                Room Info
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
