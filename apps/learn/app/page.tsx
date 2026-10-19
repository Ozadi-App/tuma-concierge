"use client";

import { EDUCATION_STREAMS, type EducationStream, type StudioSchool } from "@peebee/shared";
import { ArrowRight, BookOpen, CheckCircle2, Circle, Eye, GraduationCap, Layers, MessageSquare, Plus, Radio, School as SchoolIcon, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chip, EmptyState, LinkButton, Notice, Skeleton, cardCls } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { useLearnAuth } from "../lib/auth-context";
import { STREAM_UI, plural } from "../lib/streams";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

const STRUCTURE = [
  { label: "School", body: "Your school, academy or tutoring brand" },
  { label: "Class", body: "A cohort, or a short masterclass anyone can join" },
  { label: "Course", body: "A subject taught in that class, on a named syllabus" },
  { label: "Module", body: "A unit, topic or week" },
  { label: "Lesson", body: "Video, reading or practical, with an optional quiz" },
];

export default function HomePage() {
  const { user, activeStream, setActiveStream } = useLearnAuth();
  const [schools, setSchools] = useState<StudioSchool[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.studioSchools();
      setSchools(res.schools);
    } catch (err) {
      setSchools([]);
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const list = schools ?? [];
    return {
      schools: list.length,
      classes: list.reduce((n, s) => n + s.classCount, 0),
      courses: list.reduce((n, s) => n + s.courseCount, 0),
      published: list.reduce((n, s) => n + s.publishedCourseCount, 0),
      lessons: list.reduce((n, s) => n + s.lessonCount, 0),
    };
  }, [schools]);

  const streamSchools = useMemo(() => (schools ?? []).filter((s) => s.streams.includes(activeStream)), [schools, activeStream]);
  const firstName = user?.name.split(" ")[0] ?? "there";

  // The one next thing to do, in the order a school gets built.
  const first = schools?.[0];
  const steps = [
    { done: totals.schools > 0, label: "Create your school", hint: "Name it and choose who you teach", href: "/schools?new=1" },
    { done: totals.classes > 0, label: "Add a class or masterclass", hint: "Pick the level and the syllabus", href: first ? `/schools/${first.id}?new=1` : "/schools?new=1" },
    { done: totals.courses > 0, label: "Create a course", hint: "A subject taught in that class", href: first ? `/schools/${first.id}` : "/schools" },
    { done: totals.lessons > 0, label: "Add modules and lessons", hint: "Build the syllabus, lesson by lesson", href: first ? `/schools/${first.id}` : "/schools" },
    { done: totals.published > 0, label: "Publish", hint: "Make the course visible to learners", href: first ? `/schools/${first.id}` : "/schools" },
  ];
  const next = steps.find((s) => !s.done);
  const allDone = !next && schools !== null;

  return (
    <div className="space-y-6 pb-6">
      {/* Welcome */}
      <section className={`${cardCls} relative overflow-hidden p-5 sm:p-7`}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/15" aria-hidden />
        <div className="relative space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-gold">
              {greeting()}, {firstName}
            </p>
            <h2 className="font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">Build learning for every stage of life</h2>
            <p className="max-w-xl text-sm text-ink-500">
              Start a school or a masterclass, add classes, then publish the courses and lessons your learners need, from kindergarten to university to everyday skills.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {totals.schools === 0 && schools !== null ? (
              <LinkButton href="/schools?new=1">
                <Plus className="h-4 w-4" aria-hidden /> Create your school
              </LinkButton>
            ) : (
              next && (
                <LinkButton href={next.href}>
                  {next.label} <ArrowRight className="h-4 w-4" aria-hidden />
                </LinkButton>
              )
            )}
            <LinkButton href="/classroom" variant="secondary">
              <Radio className="h-4 w-4 text-gold" aria-hidden /> Host a live class
            </LinkButton>
          </div>
        </div>
      </section>

      {error && (
        <Notice tone="error">
          <p>{error}</p>
          <button type="button" onClick={() => void load()} className="mt-1 text-xs font-semibold text-gold underline">
            Try again
          </button>
        </Notice>
      )}

      {/* Streams */}
      <section aria-labelledby="streams-heading" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="streams-heading" className="text-base font-semibold text-ink">
              What do you teach?
            </h2>
            <p className="text-xs text-ink-500">Five streams cover every learner, from age 3 to adult.</p>
          </div>
        </div>
        <div role="tablist" aria-label="Learning streams" className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
          {EDUCATION_STREAMS.map((stream) => {
            const ui = STREAM_UI[stream.id];
            const Icon = ui.icon;
            const selected = activeStream === stream.id;
            const count = (schools ?? []).filter((s) => s.streams.includes(stream.id)).length;
            return (
              <button
                key={stream.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveStream(stream.id as EducationStream)}
                className={`flex w-44 shrink-0 flex-col gap-2 rounded-2xl border p-3.5 text-left transition sm:w-auto ${
                  selected ? "border-gold bg-gold/10 shadow-[var(--shadow-card)]" : "border-[var(--border-faint)] bg-[rgb(var(--surface-card))] hover:border-gold/40"
                }`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${selected ? "bg-gold text-ink-gold" : "bg-gold/15 text-gold"}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="block">
                  <span className="block text-sm font-semibold text-ink">{ui.title}</span>
                  <span className="block text-[11px] leading-snug text-ink-500">{ui.audience}</span>
                </span>
                <span className="text-[11px] font-semibold text-gold">{schools === null ? "…" : `${count} of your schools`}</span>
              </button>
            );
          })}
        </div>
        <p className="rounded-xl bg-[rgb(var(--surface-muted))] px-3.5 py-2.5 text-xs text-ink-500">
          <strong className="font-semibold text-ink">{STREAM_UI[activeStream].title}:</strong> {STREAM_UI[activeStream].examples}.
        </p>
      </section>

      {/* Progress or numbers */}
      {schools === null ? (
        <Skeleton className="h-40" />
      ) : allDone ? (
        <section aria-label="Your studio at a glance" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Schools", value: totals.schools, icon: SchoolIcon },
            { label: "Classes", value: totals.classes, icon: Layers },
            { label: "Courses live", value: `${totals.published}/${totals.courses}`, icon: BookOpen },
            { label: "Lessons", value: totals.lessons, icon: GraduationCap },
          ].map((kpi) => (
            <div key={kpi.label} className={`${cardCls} space-y-1 p-4`}>
              <kpi.icon className="h-4 w-4 text-gold" aria-hidden />
              <p className="font-display text-2xl font-semibold text-ink">{kpi.value}</p>
              <p className="text-xs text-ink-500">{kpi.label}</p>
            </div>
          ))}
        </section>
      ) : (
        <section aria-labelledby="setup-heading" className={`${cardCls} space-y-4 p-4 sm:p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="setup-heading" className="text-base font-semibold text-ink">
                Get your first course live
              </h2>
              <p className="text-xs text-ink-500">
                {steps.filter((s) => s.done).length} of {steps.length} steps done
              </p>
            </div>
            <Sparkles className="h-5 w-5 shrink-0 text-gold" aria-hidden />
          </div>
          <ol className="space-y-2">
            {steps.map((step) => {
              const isNext = step === next;
              return (
                <li key={step.label}>
                  <Link
                    href={step.href}
                    aria-current={isNext ? "step" : undefined}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition ${
                      isNext ? "border-gold bg-gold/10" : "border-[var(--border-faint)] hover:border-gold/40"
                    }`}
                  >
                    {step.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green" aria-label="Done" /> : <Circle className="h-5 w-5 shrink-0 text-ink-500" aria-label="To do" />}
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-semibold ${step.done ? "text-ink-500 line-through" : "text-ink"}`}>{step.label}</span>
                      <span className="block text-xs text-ink-500">{step.hint}</span>
                    </span>
                    {isNext && <ArrowRight className="h-4 w-4 shrink-0 text-gold" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Schools */}
      <section aria-labelledby="schools-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="schools-heading" className="text-base font-semibold text-ink">
            Your {STREAM_UI[activeStream].title} schools
          </h2>
          <Link href="/schools" className="text-xs font-semibold text-gold hover:underline">
            See all
          </Link>
        </div>
        {schools === null ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : streamSchools.length === 0 ? (
          <EmptyState
            icon={SchoolIcon}
            title={totals.schools === 0 ? "You haven't created a school yet" : `None of your schools teach ${STREAM_UI[activeStream].title} yet`}
            body={
              totals.schools === 0
                ? "A school is where your classes and courses live. It takes about a minute."
                : `Add ${STREAM_UI[activeStream].title} to a school, or start a new school for it.`
            }
            action={
              <LinkButton href="/schools?new=1">
                <Plus className="h-4 w-4" aria-hidden /> Create a school
              </LinkButton>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {streamSchools.map((school) => (
              <Link key={school.id} href={`/schools/${school.id}`} className={`${cardCls} group space-y-3 p-4 transition hover:border-gold/50 hover:shadow-[var(--shadow-card-hover)]`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-ink">{school.name}</h3>
                    <p className="truncate text-xs text-ink-500">{school.tagline || school.location || "No description yet"}</p>
                  </div>
                  {school.status === "suspended" && <Chip tone="gold">Suspended</Chip>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {school.streams.map((s) => (
                    <Chip key={s} tone={s === activeStream ? "gold" : "muted"}>
                      {STREAM_UI[s].title}
                    </Chip>
                  ))}
                </div>
                <p className="text-xs text-ink-500">
                  {plural(school.classCount, "class", "classes")} · {plural(school.courseCount, "course")} · {plural(school.lessonCount, "lesson")}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* How it fits together */}
      <section aria-labelledby="structure-heading" className={`${cardCls} space-y-4 p-4 sm:p-5`}>
        <div>
          <h2 id="structure-heading" className="text-base font-semibold text-ink">
            How Peebee Learn is organised
          </h2>
          <p className="text-xs text-ink-500">Every stream follows the same simple structure.</p>
        </div>
        <ol className="grid gap-2 sm:grid-cols-5">
          {STRUCTURE.map((step, i) => (
            <li key={step.label} className="relative flex gap-3 rounded-xl border border-[var(--border-faint)] p-3 sm:block sm:space-y-1.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold">{i + 1}</span>
              <span className="block min-w-0">
                <span className="block text-sm font-semibold text-ink">{step.label}</span>
                <span className="block text-xs text-ink-500">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Tools */}
      <section aria-label="More tools" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { href: "/classroom", icon: Radio, title: "Live classroom", body: "Teach in real time with chat and questions" },
          { href: "/chat", icon: MessageSquare, title: "Student messages", body: "Reply to learners, parents and guardians" },
          { href: "/streams", icon: Eye, title: "Preview as a learner", body: "See each stream the way your students do" },
        ].map((tool) => (
          <Link key={tool.href} href={tool.href} className={`${cardCls} flex items-center gap-3 p-4 transition hover:border-gold/50`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <tool.icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{tool.title}</span>
              <span className="block text-xs text-ink-500">{tool.body}</span>
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
