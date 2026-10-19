"use client";

import { EDUCATION_STREAMS, type StudioSchool } from "@peebee/shared";
import { GraduationCap, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SchoolForm, type SchoolInput } from "../../components/studio/forms";
import { Button, Chip, EmptyState, Notice, Skeleton, cardCls } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { useStudioSettings } from "../../lib/studio-config";
import { STREAM_UI, plural } from "../../lib/streams";

export default function SchoolsPage() {
  const router = useRouter();
  const settings = useStudioSettings();
  const [schools, setSchools] = useState<StudioSchool[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSchools((await api.studioSchools()).schools);
    } catch (err) {
      setSchools([]);
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
    // "?new=1" opens the form straight away (used by the home page's next step).
    if (new URLSearchParams(window.location.search).has("new")) setCreating(true);
  }, [load]);

  async function create(input: SchoolInput) {
    setBusy(true);
    setFormError(null);
    try {
      const res = await api.studioCreateSchool(input);
      router.push(`/schools/${res.school.id}?new=1`);
    } catch (err) {
      setFormError(errorMessage(err));
      setBusy(false);
    }
  }

  const atLimit = (schools?.length ?? 0) >= settings.maxSchoolsPerUser;

  return (
    <div className="space-y-5 pb-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gold">Peebee Learn</p>
          <h2 className="font-display text-2xl font-semibold text-ink">Your schools</h2>
          <p className="text-sm text-ink-500">Each school holds its own classes, courses and lessons.</p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)} disabled={atLimit || !settings.enabled}>
            <Plus className="h-4 w-4" aria-hidden /> New school
          </Button>
        )}
      </header>

      {!settings.enabled && <Notice tone="info">The Studio is switched off right now, so schools can&apos;t be created or edited. Published courses stay visible to learners.</Notice>}
      {atLimit && settings.enabled && !creating && (
        <Notice tone="info">You&apos;ve reached the limit of {settings.maxSchoolsPerUser} schools. Open one of them to keep building.</Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {creating && (
        <SchoolForm
          settings={settings}
          title="Create your school"
          submitLabel="Create school"
          busy={busy}
          error={formError}
          onSubmit={create}
          onCancel={() => {
            setCreating(false);
            setFormError(null);
          }}
        />
      )}

      {schools === null ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : schools.length === 0 ? (
        !creating && (
          <EmptyState
            icon={GraduationCap}
            title="Start with a school"
            body="Your school is the home for everything you teach. Then add classes, courses and lessons."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" aria-hidden /> Create your school
              </Button>
            }
          />
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {schools.map((school) => (
            <li key={school.id}>
              <Link href={`/schools/${school.id}`} className={`${cardCls} block space-y-3 p-4 transition hover:border-gold/50 hover:shadow-[var(--shadow-card-hover)]`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-ink">{school.name}</h3>
                    <p className="truncate text-xs text-ink-500">{school.tagline || school.location || "No description yet"}</p>
                  </div>
                  {school.status === "suspended" && <Chip tone="gold">Suspended</Chip>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {EDUCATION_STREAMS.filter((s) => school.streams.includes(s.id)).map((s) => (
                    <Chip key={s.id}>{STREAM_UI[s.id].title}</Chip>
                  ))}
                </div>
                <p className="text-xs text-ink-500">
                  {plural(school.classCount, "class", "classes")} · {plural(school.courseCount, "course")} ({school.publishedCourseCount} live) · {plural(school.lessonCount, "lesson")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
