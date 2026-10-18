"use client";

import { EDUCATION_STREAMS, hasPermission, type EducationStream, type LearnSettings, type SchoolStatus, type StudioSchool } from "@peebee/shared";
import { AlertCircle, CheckCircle2, GraduationCap, Layers, ShieldAlert, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
