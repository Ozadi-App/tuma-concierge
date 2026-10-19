"use client";

import { EDUCATION_STREAMS, type EducationStream, type LearnEnrollment } from "@peebee/shared";
import { ArrowRight, BookOpen, Radio, Receipt, Search, Sparkles, Tv } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { LearnThumb } from "@peebee/shared/learn-thumb";
import { api, errorMessage } from "../../lib/api";

type CatalogCourse = Awaited<ReturnType<typeof api.getCatalogCourses>>["courses"][number];

const card = "rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))]";
const ugx = (n: number) => (n > 0 ? `UGX ${n.toLocaleString("en-UG")}` : "Free");
const LEARN_STUDIO_URL = process.env.NEXT_PUBLIC_LEARN_URL ?? "https://learn.peebee.online";

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[rgb(var(--surface-muted))] ${className}`} aria-hidden />;
}

function JoinLiveClass() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [trials, setTrials] = useState<{ code: string; title: string }[]>([]);

  // Practice classes anyone can try without a tutor. Quietly absent when they're off or you aren't signed in.
  useEffect(() => {
    let cancelled = false;
    api
      .classroomTrial()
      .then((res) => !cancelled && setTrials(res.classes))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function go(e: FormEvent) {
    e.preventDefault();
    if (code.length === 6) router.push(`/learn/live?code=${code}`);
  }

  return (
    <section aria-labelledby="join-h" className={`${card} space-y-3 p-4 sm:p-5`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <Radio className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="join-h" className="text-base font-semibold text-ink">
            Join a live class
          </h2>
          <p className="text-xs text-ink-500">Enter the 6-digit code your tutor shows on the screen.</p>
        </div>
      </div>
      <form onSubmit={go} className="flex gap-2">
        <input
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          aria-label="Class code"
          placeholder="000000"
          className="w-full rounded-xl border border-[var(--border-faint)] text-center font-mono text-lg font-bold tracking-[0.3em] text-ink outline-none focus:border-gold"
        />
        <button type="submit" disabled={code.length !== 6} className="shrink-0 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-ink-gold disabled:opacity-50">
          Join
        </button>
      </form>
      {trials.length > 0 && (
        <div className="space-y-2 border-t border-[var(--border-faint)] pt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
            <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden /> No code yet? Try a practice class. It plays by itself.
          </p>
          <ul className="space-y-1.5">
            {trials.map((t) => (
              <li key={t.code}>
                <button
                  type="button"
                  onClick={() => router.push(`/learn/live?code=${t.code}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3.5 py-2.5 text-left transition hover:border-gold/50"
                >
                  <span className="min-w-0 truncate text-sm font-semibold text-ink">{t.title.replace(/^Trial class: /, "")}</span>
                  <span className="shrink-0 font-mono text-sm font-bold tracking-widest text-gold">{t.code}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function MyLearning() {
  const [enrollments, setEnrollments] = useState<LearnEnrollment[] | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.learnEnrollments(), api.learnInvoices().catch(() => ({ invoices: [] }))])
      .then(([e, i]) => {
        if (cancelled) return;
        setEnrollments(e.enrollments);
        setDueCount(i.invoices.filter((inv) => inv.status === "unpaid" || inv.status === "partial").length);
      })
      .catch(() => {
        if (cancelled) return;
        setEnrollments([]);
        setSignedOut(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = (enrollments ?? []).slice(0, 3);

  return (
    <section aria-labelledby="mine-h" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="mine-h" className="text-base font-semibold text-ink">
          My learning
        </h2>
        <Link href="/learn/my" className="inline-flex items-center gap-1 text-xs font-semibold text-gold">
          {dueCount > 0 ? (
            <>
              <Receipt className="h-3.5 w-3.5" aria-hidden /> {dueCount} fee{dueCount === 1 ? "" : "s"} due
            </>
          ) : (
            <>
              All courses &amp; fees <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </>
          )}
        </Link>
      </div>
      {enrollments === null ? (
        <Skeleton className="h-20" />
      ) : shown.length === 0 ? (
        <p className={`${card} p-4 text-sm text-ink-500`}>{signedOut ? "Sign in to see the courses you've joined." : "You haven't joined a course yet. Pick one below to start."}</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((c) => (
            <li key={c.id}>
              <Link href={`/learn/course/${c.courseId}`} className={`${card} block space-y-2 p-3 transition hover:border-gold/50`}>
                <div className="flex items-start gap-3">
                  <LearnThumb src={api.learnArtUrl("course", c.courseId)} className="w-24 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="truncate text-sm font-semibold text-ink">{c.title}</p>
                    <p className="truncate text-xs text-ink-500">{c.schoolName}</p>
                  </div>
                  <span className="shrink-0 pt-0.5 text-xs font-semibold text-gold">{c.progressPercent === 0 ? "Start" : "Continue"}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]" role="progressbar" aria-valuenow={c.progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.title} progress`}>
                  <div className="h-full bg-gold" style={{ width: `${c.progressPercent}%` }} />
                </div>
                <p className="text-[11px] text-ink-500">
                  {c.completedLessons} of {c.lessonCount} lessons done
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LearnHome() {
  const router = useRouter();
  const [courses, setCourses] = useState<CatalogCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The level lives in the address (/learn?stream=skills) so the bottom menu, links and this page always agree.
  const asked = useSearchParams().get("stream");
  const stream: EducationStream | "all" = EDUCATION_STREAMS.some((s) => s.id === asked) ? (asked as EducationStream) : "all";
  const [school, setSchool] = useState<string | null>(null);
  // A school belongs to one level, so changing level (from the menu or the chips) clears it.
  useEffect(() => setSchool(null), [stream]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .getCatalogCourses()
      .then((res) => !cancelled && setCourses(res.courses))
      .catch((err) => {
        if (cancelled) return;
        setCourses([]);
        setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const inStream = useMemo(() => (courses ?? []).filter((c) => stream === "all" || c.stream === stream), [courses, stream]);

  const schools = useMemo(() => {
    const map = new Map<string, { id: string; slug: string; name: string; count: number }>();
    for (const c of inStream) {
      const entry = map.get(c.schoolSlug) ?? { id: c.schoolId, slug: c.schoolSlug, name: c.schoolName, count: 0 };
      entry.count += 1;
      map.set(c.schoolSlug, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [inStream]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inStream.filter(
      (c) =>
        (!school || c.schoolSlug === school) &&
        (!q || [c.title, c.summary, c.schoolName, c.className, c.classLevel].some((t) => t.toLowerCase().includes(q))),
    );
  }, [inStream, school, query]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-28">
      <header className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">Peebee Learn</p>
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Learn anything, at any age</h1>
        <p className="text-sm text-ink-500">Courses from schools and tutors, from kindergarten to university and practical skills.</p>
      </header>

      <JoinLiveClass />
      <Link href="/learn/tv" className={`${card} flex items-center gap-3 p-3.5 transition hover:border-gold/50`}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <Tv className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">Watch on your TV</span>
          <span className="block text-xs text-ink-500">Link a TV with a code and study your courses on the big screen.</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-gold" aria-hidden />
      </Link>
      <MyLearning />

      <section aria-labelledby="browse-h" className="space-y-3">
        <h2 id="browse-h" className="text-base font-semibold text-ink">
          Find a course
        </h2>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search courses"
            placeholder="Search courses, schools or subjects"
            className="w-full rounded-xl border border-[var(--border-faint)] py-2.5 pl-10 pr-3 text-sm text-ink outline-none focus:border-gold"
          />
        </div>

        <div role="radiogroup" aria-label="Level" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ id: "all" as const, label: "All levels" }, ...EDUCATION_STREAMS.map((s) => ({ id: s.id, label: `${s.title} · ${s.ageBracket}` }))].map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={stream === o.id}
              onClick={() => {
                router.replace(o.id === "all" ? "/learn" : `/learn?stream=${o.id}`, { scroll: false });
                setSchool(null);
              }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${stream === o.id ? "bg-gold text-ink-gold" : "border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink-500 hover:text-ink"}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {schools.length > 1 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Schools">
            {schools.map((s) => (
              <button
                key={s.slug}
                type="button"
                aria-pressed={school === s.slug}
                onClick={() => setSchool(school === s.slug ? null : s.slug)}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${school === s.slug ? "border-gold bg-gold/10 text-ink" : "border-[var(--border-faint)] bg-[rgb(var(--surface-card))] text-ink-500 hover:border-gold/50"}`}
              >
                <LearnThumb src={api.learnArtUrl("school", s.id)} className="w-9 shrink-0 rounded-md" />
                <span className="font-semibold text-ink">{s.name}</span>
                <span>{s.count}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-3 text-sm text-ink">
            {error}
          </p>
        )}

        {courses === null ? (
          <div className="space-y-2">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : visible.length === 0 ? (
          <div className={`${card} flex flex-col items-center gap-2 px-5 py-10 text-center`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/15 text-gold">
              <BookOpen className="h-6 w-6" aria-hidden />
            </span>
            <p className="text-sm font-semibold text-ink">{courses.length === 0 ? "No courses are published yet" : "No courses match"}</p>
            <p className="max-w-xs text-xs text-ink-500">
              {courses.length === 0 ? "When schools and tutors publish courses they appear here." : "Try another level, school or search."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((c) => (
              <li key={c.id}>
                <Link href={`/learn/course/${c.id}`} className={`${card} flex gap-3 p-3 transition hover:border-gold/50`}>
                  <LearnThumb src={api.learnArtUrl("course", c.id)} className="w-28 shrink-0 self-start rounded-xl sm:w-40" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{c.title}</p>
                      <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">{ugx(c.priceUgx)}</span>
                    </div>
                    <p className="text-xs text-ink-500">
                      {c.schoolName} · {c.classLevel || c.className}
                      {c.demo && <span className="ml-2 rounded-full bg-[rgb(var(--surface-muted))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">Demo</span>}
                    </p>
                    {c.summary && <p className="line-clamp-2 text-xs text-ink-500">{c.summary}</p>}
                    <p className="text-[11px] font-semibold text-ink-500">
                      {c.lessonCount} lesson{c.lessonCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="space-y-1 border-t border-[var(--border-faint)] pt-4 text-xs text-ink-500">
        <p>
          Teaching or running a school?{" "}
          <a href={LEARN_STUDIO_URL} className="font-semibold text-gold underline">
            Open the Educator Studio
          </a>
        </p>
        <p>
          Want to look around first?{" "}
          <Link href="/learn/demo" className="font-semibold text-gold underline">
            Try the demo school
          </Link>{" "}
          (sample data)
        </p>
      </footer>
    </div>
  );
}

export default function LearnHomePage() {
  return (
    <Suspense fallback={null}>
      <LearnHome />
    </Suspense>
  );
}
