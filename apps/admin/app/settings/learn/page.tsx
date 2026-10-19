"use client";

import { EDUCATION_STREAMS, hasPermission, type EducationStream, type LearnSettings, type SchoolStatus, type StudioSchool } from "@peebee/shared";
import { AlertCircle, CheckCircle2, GraduationCap, Layers, ShieldAlert, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DemoContentCard } from "../../../components/learn/DemoContentCard";
import { ProEducatorsCard } from "../../../components/learn/ProEducatorsCard";
import { SettingsPageShell } from "../../../components/SettingsPageShell";
import { api, errorMessage } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

type AdminSchool = StudioSchool & { ownerName: string; ownerId: string };

type NumberKey = {
  [K in keyof LearnSettings]: LearnSettings[K] extends number ? K : never;
}[keyof LearnSettings];

const LIMITS: { key: NumberKey; label: string; hint: string; min: number; max: number; step?: number }[] = [
  { key: "maxSchoolsPerUser", label: "Schools per educator", hint: "Most schools one account can run", min: 1, max: 100 },
  { key: "maxClassesPerSchool", label: "Classes per school", hint: "Classes and masterclasses together", min: 1, max: 500 },
  { key: "maxCoursesPerClass", label: "Courses per class", hint: "Courses taught in one class", min: 1, max: 200 },
  { key: "maxModulesPerCourse", label: "Modules per course", hint: "Units or weeks in one course", min: 1, max: 200 },
  { key: "maxLessonsPerModule", label: "Lessons per module", hint: "Lessons inside one module", min: 1, max: 200 },
  { key: "maxQuizQuestionsPerLesson", label: "Quiz questions per lesson", hint: "0 turns lesson quizzes off", min: 0, max: 100 },
  { key: "maxLessonMinutes", label: "Longest lesson (minutes)", hint: "Upper limit for one lesson", min: 1, max: 1440 },
  { key: "commissionPercent", label: "Peebee's share (%)", hint: "Taken from every course sale and fee payment", min: 0, max: 60 },
  { key: "maxVideoMb", label: "Largest lesson file (MB)", hint: "Video or audio an educator can upload (100 MB is the most the platform accepts)", min: 1, max: 100 },
  { key: "maxCoverMb", label: "Largest cover picture (MB)", hint: "Picture an educator can set for a school or course. 0 turns cover uploads off; a drawn cover is always shown instead", min: 0, max: 10 },
  { key: "quizAttemptsPerHour", label: "Quiz attempts per hour", hint: "Per learner, across all quizzes", min: 1, max: 200 },
  { key: "examPassPercent", label: "Exam pass mark (%)", hint: "For exams the server marks automatically", min: 0, max: 100 },
  { key: "liveMaxParticipants", label: "Students per live session", hint: "Phones that can join one classroom session", min: 1, max: 500 },
  { key: "livePollSeconds", label: "Live refresh (seconds)", hint: "How often a phone or TV checks for changes. Lower is snappier but costs more.", min: 1, max: 30 },
  { key: "liveMaxCuesPerSession", label: "Run-sheet items per session", hint: "Slides, questions and exams prepared for one session", min: 5, max: 500 },
  { key: "liveQuestionSeconds", label: "Default answer time (seconds)", hint: "For a live question when the tutor sets none", min: 5, max: 600 },
  { key: "liveMaxExamMinutes", label: "Longest live exam (minutes)", hint: "Upper limit for a timed exam on phones", min: 1, max: 600 },
  { key: "maxScreensPerUser", label: "TV screens per educator", hint: "Most screens one account can pair", min: 1, max: 50 },
  { key: "screenPairMinutes", label: "TV pairing code lifetime (minutes)", hint: "How long a code shown on a TV can be used", min: 1, max: 60 },
  { key: "proPriceUgx", label: "Learn Pro price (UGX)", hint: "Taken from the educator's wallet for one period. 0 makes Pro free to claim.", min: 0, max: 100000000, step: 1000 },
  { key: "proDays", label: "Learn Pro length (days)", hint: "How long one purchase lasts", min: 1, max: 3650 },
  { key: "createsPerHour", label: "Creations per hour", hint: "Schools, classes, courses, modules and lessons made by one educator per hour", min: 1, max: 1000 },
];

function Toggle({ on, disabled, onChange, label }: { on: boolean; disabled: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-60 ${
        on ? "bg-gold" : "bg-neutral-300 dark:bg-neutral-700"
      }`}
    >
      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${on ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function SwitchRow({ title, hint, on, disabled, onChange }: { title: string; hint: string; on: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[var(--border-faint)] pt-4">
      <div className="min-w-0">
        <span className="block text-sm font-bold text-ink">{title}</span>
        <span className="text-xs text-ink-500">{hint}</span>
      </div>
      <Toggle on={on} disabled={disabled} onChange={onChange} label={title} />
    </div>
  );
}

export default function LearnSettingsPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user?.adminRole ?? null, "settings.manage");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<LearnSettings | null>(null);
  const [schools, setSchools] = useState<AdminSchool[]>([]);
  const [busySchool, setBusySchool] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, list] = await Promise.all([api.adminGetLearnSettings(), api.adminLearnSchools().catch(() => ({ schools: [] as AdminSchool[] }))]);
    setSettings(s.learn);
    setSchools(list.schools);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [load]);

  function patch<K extends keyof LearnSettings>(key: K, value: LearnSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleStream(id: EducationStream) {
    if (!settings) return;
    patch("streams", settings.streams.includes(id) ? settings.streams.filter((s) => s !== id) : [...settings.streams, id]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || !settings) return;
    for (const limit of LIMITS) {
      const value = settings[limit.key];
      if (!Number.isInteger(value) || value < limit.min || value > limit.max) {
        setError(`${limit.label} must be a whole number from ${limit.min} to ${limit.max}.`);
        return;
      }
    }
    if (!/^\d{6}$/.test(settings.trialCodeA) || !/^\d{6}$/.test(settings.trialCodeB) || settings.trialCodeA === settings.trialCodeB) {
      setError("The two trial class codes must each be six digits and different from each other.");
      return;
    }
    if (!Number.isInteger(settings.maxCoursePriceUgx) || settings.maxCoursePriceUgx < 0) {
      setError("Highest course price must be a whole number of 0 or more.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api.adminUpdateLearnSettings(settings);
      setSettings(res.learn);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(school: AdminSchool, status: SchoolStatus) {
    if (!canManage) return;
    const verb = status === "suspended" ? "Suspend" : "Restore";
    if (!window.confirm(`${verb} “${school.name}”? ${status === "suspended" ? "Its courses leave the catalogue and its owner can no longer edit it." : "Its published courses return to the catalogue."}`)) return;
    setBusySchool(school.id);
    setError(null);
    try {
      await api.adminSetLearnSchoolStatus(school.id, status);
      setSchools((prev) => prev.map((s) => (s.id === school.id ? { ...s, status } : s)));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusySchool(null);
    }
  }

  return (
    <SettingsPageShell title="Peebee Learn" loading={loading}>
      {settings && (
        <form onSubmit={handleSave} className="space-y-6 pb-12">
          {error && (
            <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-3 rounded-2xl bg-green/10 p-4 text-sm font-semibold text-green">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p>Peebee Learn settings saved.</p>
            </div>
          )}

          <section className="space-y-4 rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink">Learn Studio</h2>
                <p className="text-xs text-ink-500">Educators build schools, classes, courses and lessons here</p>
              </div>
            </div>
            <SwitchRow title="Studio open" hint="When off, educators can't create or edit anything. Published courses stay visible." on={settings.enabled} disabled={!canManage} onChange={(v) => patch("enabled", v)} />
            <SwitchRow title="Masterclasses" hint="Short open programmes next to ordinary classes" on={settings.masterclassesEnabled} disabled={!canManage} onChange={(v) => patch("masterclassesEnabled", v)} />
            <SwitchRow title="Enrolment" hint="Learners can join published courses, free or paid from their wallet" on={settings.enrolmentsEnabled} disabled={!canManage} onChange={(v) => patch("enrolmentsEnabled", v)} />
            <SwitchRow title="Video and audio uploads" hint="Educators can attach a file to a lesson" on={settings.videoUploadsEnabled} disabled={!canManage} onChange={(v) => patch("videoUploadsEnabled", v)} />
            <SwitchRow title="School fees" hint="Schools can invoice learners, who pay from their wallet" on={settings.feesEnabled} disabled={!canManage} onChange={(v) => patch("feesEnabled", v)} />
            <SwitchRow title="Live classroom and TV" hint="Educators can run live sessions that push content to a TV and quizzes to students' phones" on={settings.liveEnabled} disabled={!canManage} onChange={(v) => patch("liveEnabled", v)} />
            <SwitchRow title="TV is a Pro feature" hint="Off (the launch setting): every educator can use the TV classroom for free. On: connecting a screen and teaching on it needs Learn Pro, which educators can buy from their wallet or staff can grant. Teaching to phones and the practice classes stay free." on={settings.tvProRequired} disabled={!canManage} onChange={(v) => patch("tvProRequired", v)} />
            <SwitchRow title="Publish automatically" hint="A course goes live as soon as it has its first lesson. When off, the educator publishes it themselves." on={settings.publishByDefault} disabled={!canManage} onChange={(v) => patch("publishByDefault", v)} />
          </section>

          <section className="space-y-4 rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink">Open streams</h2>
                <p className="text-xs text-ink-500">Which kinds of learning educators can create content for</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EDUCATION_STREAMS.map((stream) => {
                const on = settings.streams.includes(stream.id);
                return (
                  <button
                    key={stream.id}
                    type="button"
                    disabled={!canManage}
                    aria-pressed={on}
                    onClick={() => toggleStream(stream.id)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition disabled:opacity-60 ${
                      on ? "border-gold bg-gold/10" : "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))]"
                    }`}
                  >
                    <span className="text-xl" aria-hidden>{stream.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink">{stream.title}</span>
                      <span className="block truncate text-xs text-ink-500">{stream.tagline} · {stream.ageBracket}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4 rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-ink">Trial classes and demo content</h2>
              <p className="text-xs text-ink-500">Two practice live classes that run themselves, opened with a code, and the visibility of demo courses</p>
            </div>
            <SwitchRow title="Trial live classes" hint="Anyone signed in can join a practice class with its code and see a class in progress with no tutor online" on={settings.trialClassesEnabled} disabled={!canManage} onChange={(v) => patch("trialClassesEnabled", v)} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(["trialCodeA", "trialCodeB"] as const).map((key, i) => (
                <div key={key} className="field-box flex flex-col rounded-2xl bg-[rgb(var(--surface-muted))] p-3">
                  <label htmlFor={key} className="mb-1 text-xs font-bold text-ink-500">Trial class {i + 1} code</label>
                  <input
                    id={key}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={settings[key]}
                    disabled={!canManage}
                    onChange={(e) => patch(key, e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full font-mono text-base font-bold tracking-widest text-ink outline-none"
                  />
                  <span className="mt-1 text-[10px] text-ink-500">Six digits. The two codes must be different.</span>
                </div>
              ))}
            </div>
            <SwitchRow title="Show demo courses" hint="Demo schools and courses appear in the catalogue after real ones, marked Demo. Turn off to hide them without removing them." on={settings.demoContentVisible} disabled={!canManage} onChange={(v) => patch("demoContentVisible", v)} />
          </section>

          <section className="space-y-4 rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink">Pricing</h2>
                <p className="text-xs text-ink-500">Whether courses can cost money, and how much</p>
              </div>
            </div>
            <SwitchRow title="Paid courses" hint="When off, every course is free" on={settings.paidCoursesEnabled} disabled={!canManage} onChange={(v) => patch("paidCoursesEnabled", v)} />
            <div className="field-box flex flex-col rounded-2xl bg-[rgb(var(--surface-muted))] p-3 sm:max-w-xs">
              <label htmlFor="max-price" className="mb-1 text-xs font-bold text-ink-500">Highest course price (UGX)</label>
              <input
                id="max-price"
                type="number"
                min={0}
                step={10000}
                value={settings.maxCoursePriceUgx}
                disabled={!canManage}
                onChange={(e) => patch("maxCoursePriceUgx", Number(e.target.value))}
                className="w-full text-base font-bold text-ink outline-none"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-ink">Limits</h2>
              <p className="text-xs text-ink-500">How much one educator can build</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {LIMITS.map((limit) => (
                <div key={limit.key} className="field-box flex flex-col rounded-2xl bg-[rgb(var(--surface-muted))] p-3">
                  <label htmlFor={limit.key} className="mb-1 text-xs font-bold text-ink-500">{limit.label}</label>
                  <input
                    id={limit.key}
                    type="number"
                    min={limit.min}
                    max={limit.max}
                    step={limit.step ?? 1}
                    value={settings[limit.key]}
                    disabled={!canManage}
                    onChange={(e) => patch(limit.key, Number(e.target.value) as never)}
                    className="w-full text-base font-bold text-ink outline-none"
                  />
                  <span className="mt-1 text-[10px] text-ink-500">{limit.hint}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="sticky bottom-4 z-20 flex gap-3">
            <button
              type="submit"
              disabled={!canManage || saving}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gold px-6 text-sm font-bold text-ink-gold shadow-[var(--shadow-glow-gold)] transition active:scale-95 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Learn settings"}
            </button>
          </div>
        </form>
      )}

      {settings && (
        <div className="mb-6">
          <DemoContentCard canManage={canManage} trialCodes={[settings.trialCodeA, settings.trialCodeB]} />
        </div>
      )}

      {settings && (
        <div className="mb-6">
          <ProEducatorsCard canManage={canManage} />
        </div>
      )}

      {settings && (
        <section className="mb-12 space-y-3 rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">Schools</h2>
              <p className="text-xs text-ink-500">Suspend a school that breaks the rules; its courses leave the catalogue</p>
            </div>
          </div>
          {schools.length === 0 ? (
            <p className="rounded-2xl bg-[rgb(var(--surface-muted))] p-4 text-sm text-ink-500">No schools have been created yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-faint)]">
              {schools.map((school) => (
                <li key={school.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{school.name}</p>
                    <p className="truncate text-xs text-ink-500">
                      {school.ownerName} · {school.classCount} classes · {school.courseCount} courses
                      {school.status === "suspended" ? " · Suspended" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canManage || busySchool === school.id}
                    onClick={() => setStatus(school, school.status === "suspended" ? "active" : "suspended")}
                    className={`rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50 ${
                      school.status === "suspended" ? "bg-gold text-ink-gold" : "border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink"
                    }`}
                  >
                    {school.status === "suspended" ? "Restore" : "Suspend"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </SettingsPageShell>
  );
}
