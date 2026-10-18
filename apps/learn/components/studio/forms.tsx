"use client";

import {
  EDUCATION_STREAMS,
  LESSON_CONTENT_TYPES,
  SCHOOL_KINDS,
  STREAM_LEVELS,
  frameworksForStream,
  type ClassKind,
  type CurriculumFramework,
  type EducationStream,
  type LearnSettings,
  type LessonContentType,
  type SchoolKind,
  type StudioClass,
  type StudioCourse,
  type StudioLesson,
  type StudioQuiz,
  type StudioSchool,
} from "@peebee/shared";
import { Plus, Trash2 } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { STREAM_UI } from "../../lib/streams";
import { Button, Field, Notice, Segmented, cardCls, controlCls } from "../ui";

type FormShellProps = { title: string; children: ReactNode; onSubmit: (e: FormEvent) => void; error: string | null; busy: boolean; submitLabel: string; onCancel?: () => void };

function FormShell({ title, children, onSubmit, error, busy, submitLabel, onCancel }: FormShellProps) {
  return (
    <form onSubmit={onSubmit} className={`${cardCls} space-y-4 p-4 sm:p-5`}>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {children}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// School
// ---------------------------------------------------------------------------

export type SchoolInput = {
  name: string;
  kind: SchoolKind;
  streams: EducationStream[];
  tagline: string;
  bio: string;
  location: string;
  motto: string;
  badge: string;
  contactEmail: string;
  contactPhone: string;
};

export function SchoolForm({
  settings,
  initial,
  submitLabel,
  title,
  busy,
  error,
  onSubmit,
  onCancel,
  lockedStreams = [],
}: {
  settings: LearnSettings;
  initial?: StudioSchool;
  submitLabel: string;
  title: string;
  busy: boolean;
  error: string | null;
  onSubmit: (input: SchoolInput) => void;
  onCancel?: () => void;
  /** Streams that already have classes and so cannot be removed. */
  lockedStreams?: EducationStream[];
}) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<SchoolKind>(initial?.kind ?? "school");
  const [streams, setStreams] = useState<EducationStream[]>(initial?.streams ?? []);
  const [tagline, setTagline] = useState(initial?.tagline ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [motto, setMotto] = useState(initial?.motto ?? "");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  function toggle(streamId: EducationStream) {
    if (lockedStreams.includes(streamId)) return;
    setStreams((prev) => (prev.includes(streamId) ? prev.filter((s) => s !== streamId) : [...prev, streamId]));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setLocalError("Give your school a name of at least 2 characters.");
    if (streams.length === 0) return setLocalError("Choose at least one stream, so learners know who it is for.");
    setLocalError(null);
    onSubmit({ name, kind, streams, tagline, bio, location, motto, badge, contactEmail, contactPhone });
  }

  const open = EDUCATION_STREAMS.filter((s) => settings.streams.includes(s.id) || streams.includes(s.id));

  return (
    <FormShell title={title} onSubmit={submit} error={localError ?? error} busy={busy} submitLabel={submitLabel} onCancel={onCancel}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="School, academy or tutor name" htmlFor={`${id}-name`}>
          <input id={`${id}-name`} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={controlCls} placeholder="e.g. Greenfield Primary School" />
        </Field>
        <Field label="What kind of provider are you?" htmlFor={`${id}-kind`}>
          <select id={`${id}-kind`} value={kind} onChange={(e) => setKind(e.target.value as SchoolKind)} className={controlCls}>
            {SCHOOL_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-ink-500">Who do you teach? Choose every stream you offer</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {open.map((s) => {
            const ui = STREAM_UI[s.id];
            const Icon = ui.icon;
            const on = streams.includes(s.id);
            const locked = lockedStreams.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                disabled={locked}
                onClick={() => toggle(s.id)}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed ${on ? "border-gold bg-gold/10" : "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] hover:border-gold/40"}`}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{ui.title}</span>
                  <span className="block text-xs text-ink-500">{ui.audience}</span>
                  {locked && <span className="mt-1 block text-[11px] text-ink-500">Has classes, so it can&apos;t be removed</span>}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="One-line description" htmlFor={`${id}-tag`}>
          <input id={`${id}-tag`} maxLength={200} value={tagline} onChange={(e) => setTagline(e.target.value)} className={controlCls} placeholder="What you teach, in a sentence" />
        </Field>
        <Field label="Location" htmlFor={`${id}-loc`}>
          <input id={`${id}-loc`} maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} className={controlCls} placeholder="Town or area, or “Online”" />
        </Field>
        <Field label="Motto (optional)" htmlFor={`${id}-motto`}>
          <input id={`${id}-motto`} maxLength={200} value={motto} onChange={(e) => setMotto(e.target.value)} className={controlCls} />
        </Field>
        <Field label="Registration or accreditation (optional)" htmlFor={`${id}-badge`}>
          <input id={`${id}-badge`} maxLength={120} value={badge} onChange={(e) => setBadge(e.target.value)} className={controlCls} placeholder="e.g. MoES registered, UNEB centre number" />
        </Field>
        <Field label="Contact email (optional)" htmlFor={`${id}-email`}>
          <input id={`${id}-email`} type="email" maxLength={120} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={controlCls} />
        </Field>
        <Field label="Contact phone (optional)" htmlFor={`${id}-phone`}>
          <input id={`${id}-phone`} inputMode="tel" maxLength={40} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={controlCls} />
        </Field>
      </div>
      <Field label="About (optional)" htmlFor={`${id}-bio`}>
        <textarea id={`${id}-bio`} rows={3} maxLength={2000} value={bio} onChange={(e) => setBio(e.target.value)} className={controlCls} placeholder="Tell parents and learners who you are and how you teach" />
      </Field>
    </FormShell>
  );
}

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

export type ClassInput = {
  stream: EducationStream;
  kind: ClassKind;
  name: string;
  level: string;
  framework: CurriculumFramework;
  academicYear: string;
  term: string;
  teacherName: string;
  capacity: number;
  summary: string;
};

const KIND_COPY: Record<EducationStream, { class: string; masterclass: string }> = {
  sprouts: { class: "Class", masterclass: "Play workshop" },
  foundations: { class: "Class", masterclass: "Holiday masterclass" },
  academy: { class: "Class", masterclass: "Revision masterclass" },
  compass: { class: "Course group", masterclass: "Masterclass" },
  skills: { class: "Class", masterclass: "Masterclass" },
};

export function ClassForm({
  settings,
  school,
  initial,
  submitLabel,
  title,
  busy,
  error,
  onSubmit,
  onCancel,
  presetStream,
}: {
  settings: LearnSettings;
  school: StudioSchool;
  initial?: StudioClass;
  submitLabel: string;
  title: string;
  busy: boolean;
  error: string | null;
  onSubmit: (input: ClassInput) => void;
  onCancel?: () => void;
  presetStream?: EducationStream;
}) {
  const id = useId();
  const editing = Boolean(initial);
  const streamChoices = school.streams.filter((s) => settings.streams.includes(s) || s === initial?.stream);
  const [stream, setStream] = useState<EducationStream>(initial?.stream ?? (presetStream && streamChoices.includes(presetStream) ? presetStream : streamChoices[0] ?? "foundations"));
  const [kind, setKind] = useState<ClassKind>(initial?.kind ?? "class");
  const [name, setName] = useState(initial?.name ?? "");
  const [level, setLevel] = useState(initial?.level ?? "");
  const [framework, setFramework] = useState<CurriculumFramework>(initial?.framework ?? frameworksForStream(stream)[0]?.id ?? "open_syllabus");
  const [academicYear, setAcademicYear] = useState(initial?.academicYear ?? String(new Date().getFullYear()));
  const [term, setTerm] = useState(initial?.term ?? "");
  const [teacherName, setTeacherName] = useState(initial?.teacherName ?? "");
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? 40));
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const frameworks = frameworksForStream(stream);
  const copy = KIND_COPY[stream];

  function changeStream(next: EducationStream) {
    setStream(next);
    setLevel("");
    const options = frameworksForStream(next);
    if (!options.some((f) => f.id === framework)) setFramework(options[0]?.id ?? "open_syllabus");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setLocalError("Give the class a name of at least 2 characters.");
    const seats = Number(capacity);
    if (!Number.isInteger(seats) || seats < 1) return setLocalError("Capacity must be a whole number of 1 or more.");
    setLocalError(null);
    onSubmit({ stream, kind, name, level, framework, academicYear, term, teacherName, capacity: seats, summary });
  }

  return (
    <FormShell title={title} onSubmit={submit} error={localError ?? error} busy={busy} submitLabel={submitLabel} onCancel={onCancel}>
      {!editing && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Stream" htmlFor={`${id}-stream`}>
            <select id={`${id}-stream`} value={stream} onChange={(e) => changeStream(e.target.value as EducationStream)} className={controlCls}>
              {streamChoices.map((s) => (
                <option key={s} value={s}>
                  {STREAM_UI[s].title} · {STREAM_UI[s].audience}
                </option>
              ))}
            </select>
          </Field>
          <div className="space-y-1">
            <span className="block text-xs font-semibold text-ink-500">Format</span>
            <Segmented
              label="Format"
              value={kind}
              onChange={setKind}
              options={[
                { id: "class", label: copy.class },
                { id: "masterclass", label: copy.masterclass, disabled: !settings.masterclassesEnabled },
              ]}
            />
            <p className="text-[11px] text-ink-500">{kind === "class" ? "A fixed group that follows a term or year." : "A short, focused programme anyone can join."}</p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${id}-name`}>
          <input id={`${id}-name`} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={controlCls} placeholder={stream === "skills" ? "e.g. Beginner Tailoring" : "e.g. Primary 4 Blue"} />
        </Field>
        <Field label="Level or grade" htmlFor={`${id}-level`}>
          <input id={`${id}-level`} list={`${id}-levels`} maxLength={120} value={level} onChange={(e) => setLevel(e.target.value)} className={controlCls} placeholder="Pick one or type your own" />
          <datalist id={`${id}-levels`}>
            {STREAM_LEVELS[stream].map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>
        <Field label="Syllabus" htmlFor={`${id}-fw`} hint="The curriculum this class follows">
          <select id={`${id}-fw`} value={framework} onChange={(e) => setFramework(e.target.value as CurriculumFramework)} className={controlCls}>
            {frameworks.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
            {!frameworks.some((f) => f.id === "open_syllabus") && <option value="open_syllabus">Own syllabus</option>}
          </select>
        </Field>
        <Field label="Teacher or lead" htmlFor={`${id}-teacher`}>
          <input id={`${id}-teacher`} maxLength={120} value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className={controlCls} placeholder="Who teaches this class" />
        </Field>
        <Field label="Year" htmlFor={`${id}-year`}>
          <input id={`${id}-year`} maxLength={40} value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className={controlCls} placeholder="2026 or 2026/27" />
        </Field>
        <Field label="Term, semester or intake" htmlFor={`${id}-term`}>
          <input id={`${id}-term`} maxLength={60} value={term} onChange={(e) => setTerm(e.target.value)} className={controlCls} placeholder="e.g. Term 3, Semester 1, 4 weeks" />
        </Field>
        <Field label="Seats" htmlFor={`${id}-cap`}>
          <input id={`${id}-cap`} type="number" min={1} max={100000} inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={controlCls} />
        </Field>
      </div>
      <Field label="What this class covers (optional)" htmlFor={`${id}-sum`}>
        <textarea id={`${id}-sum`} rows={2} maxLength={2000} value={summary} onChange={(e) => setSummary(e.target.value)} className={controlCls} />
      </Field>
    </FormShell>
  );
}

// ---------------------------------------------------------------------------
// Course
// ---------------------------------------------------------------------------

export type CourseInput = { title: string; summary: string; priceUgx: number; framework: CurriculumFramework; outcomes: string[] };

export function CourseForm({
  settings,
  stream,
  defaultFramework,
  initial,
  submitLabel,
  title,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  settings: LearnSettings;
  stream: EducationStream;
  defaultFramework: CurriculumFramework;
  initial?: StudioCourse;
  submitLabel: string;
  title: string;
  busy: boolean;
  error: string | null;
  onSubmit: (input: CourseInput) => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const [courseTitle, setCourseTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [price, setPrice] = useState(String(initial?.priceUgx ?? 0));
  const [framework, setFramework] = useState<CurriculumFramework>(initial?.framework ?? defaultFramework);
  const [outcomes, setOutcomes] = useState((initial?.outcomes ?? []).join("\n"));
  const [localError, setLocalError] = useState<string | null>(null);
  const frameworks = frameworksForStream(stream);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (courseTitle.trim().length < 2) return setLocalError("Give the course a title of at least 2 characters.");
    const priceUgx = Number(price || 0);
    if (!Number.isInteger(priceUgx) || priceUgx < 0) return setLocalError("The price must be a whole number of 0 or more.");
    if (priceUgx > settings.maxCoursePriceUgx) return setLocalError(`A course can cost up to UGX ${settings.maxCoursePriceUgx.toLocaleString("en-UG")}.`);
    setLocalError(null);
    onSubmit({
      title: courseTitle,
      summary,
      priceUgx,
      framework,
      outcomes: outcomes.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 12),
    });
  }

  return (
    <FormShell title={title} onSubmit={submit} error={localError ?? error} busy={busy} submitLabel={submitLabel} onCancel={onCancel}>
      <Field label="Course title" htmlFor={`${id}-title`}>
        <input id={`${id}-title`} required maxLength={120} value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} className={controlCls} placeholder="e.g. Mathematics: Fractions, Decimals & Geometry" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Syllabus" htmlFor={`${id}-fw`}>
          <select id={`${id}-fw`} value={framework} onChange={(e) => setFramework(e.target.value as CurriculumFramework)} className={controlCls}>
            {frameworks.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
            {!frameworks.some((f) => f.id === "open_syllabus") && <option value="open_syllabus">Own syllabus</option>}
          </select>
        </Field>
        <Field label="Price (UGX)" htmlFor={`${id}-price`} hint={settings.paidCoursesEnabled ? "0 makes the course free" : "Paid courses are switched off right now, so courses are free"}>
          <input
            id={`${id}-price`}
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            disabled={!settings.paidCoursesEnabled}
            value={settings.paidCoursesEnabled ? price : "0"}
            onChange={(e) => setPrice(e.target.value)}
            className={controlCls}
          />
        </Field>
      </div>
      <Field label="About this course" htmlFor={`${id}-sum`}>
        <textarea id={`${id}-sum`} rows={3} maxLength={2000} value={summary} onChange={(e) => setSummary(e.target.value)} className={controlCls} placeholder="What will learners study and how will they be assessed?" />
      </Field>
      <Field label="Learning outcomes" htmlFor={`${id}-out`} hint="One per line. What can a learner do after finishing? (up to 12)">
        <textarea id={`${id}-out`} rows={4} value={outcomes} onChange={(e) => setOutcomes(e.target.value)} className={controlCls} placeholder={"Add and subtract fractions\nRead a bar chart"} />
      </Field>
    </FormShell>
  );
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

export function ModuleForm({
  initial,
  title,
  submitLabel,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: { title: string; description: string };
  title: string;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (input: { title: string; description: string }) => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const [moduleTitle, setModuleTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (moduleTitle.trim().length < 2) return setLocalError("Give the module a title of at least 2 characters.");
    setLocalError(null);
    onSubmit({ title: moduleTitle, description });
  }

  return (
    <FormShell title={title} onSubmit={submit} error={localError ?? error} busy={busy} submitLabel={submitLabel} onCancel={onCancel}>
      <Field label="Module title" htmlFor={`${id}-title`} hint="A unit, topic or week">
        <input id={`${id}-title`} required maxLength={120} value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} className={controlCls} placeholder="e.g. Unit 1: Visual fractions" />
      </Field>
      <Field label="What it covers (optional)" htmlFor={`${id}-desc`}>
        <textarea id={`${id}-desc`} rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className={controlCls} />
      </Field>
    </FormShell>
  );
}

// ---------------------------------------------------------------------------
// Lesson (with an optional quiz)
// ---------------------------------------------------------------------------

export type LessonInput = {
  title: string;
  contentType: LessonContentType;
  durationMinutes: number;
  summary: string;
  contentUrl: string;
  quiz: StudioQuiz | null;
};

type QuestionDraft = { question: string; options: string[]; correctIndex: number; explanation: string };

const blankQuestion = (): QuestionDraft => ({ question: "", options: ["", ""], correctIndex: 0, explanation: "" });

export function LessonForm({
  settings,
  initial,
  title,
  submitLabel,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  settings: LearnSettings;
  initial?: StudioLesson;
  title: string;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (input: LessonInput) => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const [lessonTitle, setLessonTitle] = useState(initial?.title ?? "");
  const [contentType, setContentType] = useState<LessonContentType>(initial?.contentType ?? "video");
  const [minutes, setMinutes] = useState(String(initial?.durationMinutes ?? 15));
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [contentUrl, setContentUrl] = useState(initial?.contentUrl ?? "");
  const [withQuiz, setWithQuiz] = useState(Boolean(initial?.quiz));
  const [quizTitle, setQuizTitle] = useState(initial?.quiz?.title ?? "");
  const [passing, setPassing] = useState(String(initial?.quiz?.passingScorePercent ?? 70));
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    initial?.quiz ? initial.quiz.questions.map((q) => ({ question: q.question, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation ?? "" })) : [blankQuestion()],
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const quizAllowed = settings.maxQuizQuestionsPerLesson > 0;

  function patchQuestion(i: number, patch: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (lessonTitle.trim().length < 2) return setLocalError("Give the lesson a title of at least 2 characters.");
    const duration = Number(minutes);
    if (!Number.isInteger(duration) || duration < 1) return setLocalError("Lesson length must be a whole number of minutes.");
    if (duration > settings.maxLessonMinutes) return setLocalError(`A lesson can run up to ${settings.maxLessonMinutes} minutes.`);
    const url = contentUrl.trim();
    if (url && !/^https:\/\//i.test(url)) return setLocalError("Lesson links must start with https://");

    let quiz: StudioQuiz | null = null;
    if (withQuiz && quizAllowed) {
      const cleaned = questions
        .map((q) => ({ ...q, question: q.question.trim(), options: q.options.map((o) => o.trim()) }))
        .filter((q) => q.question || q.options.some(Boolean));
      if (cleaned.length === 0) return setLocalError("Add at least one question, or turn the quiz off.");
      if (cleaned.length > settings.maxQuizQuestionsPerLesson) return setLocalError(`A quiz can have up to ${settings.maxQuizQuestionsPerLesson} questions.`);
      for (const [i, q] of cleaned.entries()) {
        if (!q.question) return setLocalError(`Question ${i + 1} needs its text.`);
        if (q.options.some((o) => !o)) return setLocalError(`Question ${i + 1} has an empty answer. Fill it in or remove it.`);
      }
      const pass = Number(passing);
      if (!Number.isInteger(pass) || pass < 0 || pass > 100) return setLocalError("The pass mark is a percentage from 0 to 100.");
      quiz = {
        title: quizTitle.trim() || `${lessonTitle.trim()} quiz`,
        passingScorePercent: pass,
        questions: cleaned.map((q) => ({ question: q.question, options: q.options, correctIndex: q.correctIndex, ...(q.explanation.trim() ? { explanation: q.explanation.trim() } : {}) })),
      };
    }
    setLocalError(null);
    onSubmit({ title: lessonTitle, contentType, durationMinutes: duration, summary, contentUrl: url, quiz });
  }

  return (
    <FormShell title={title} onSubmit={submit} error={localError ?? error} busy={busy} submitLabel={submitLabel} onCancel={onCancel}>
      <Field label="Lesson title" htmlFor={`${id}-title`}>
        <input id={`${id}-title`} required maxLength={120} value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} className={controlCls} placeholder="e.g. Lesson 1: Halves and quarters" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type" htmlFor={`${id}-type`}>
          <select id={`${id}-type`} value={contentType} onChange={(e) => setContentType(e.target.value as LessonContentType)} className={controlCls}>
            {LESSON_CONTENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Length (minutes)" htmlFor={`${id}-min`}>
          <input id={`${id}-min`} type="number" min={1} max={settings.maxLessonMinutes} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={controlCls} />
        </Field>
        <Field label="Link to the material (optional)" htmlFor={`${id}-url`} className="sm:col-span-1">
          <input id={`${id}-url`} type="url" inputMode="url" maxLength={500} value={contentUrl} onChange={(e) => setContentUrl(e.target.value)} className={controlCls} placeholder="https://…" />
        </Field>
      </div>
      <Field label="Lesson notes" htmlFor={`${id}-sum`}>
        <textarea id={`${id}-sum`} rows={3} maxLength={2000} value={summary} onChange={(e) => setSummary(e.target.value)} className={controlCls} placeholder="Key ideas, instructions and any homework" />
      </Field>

      {quizAllowed && (
        <div className="space-y-3 border-t border-[var(--border-faint)] pt-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input type="checkbox" checked={withQuiz} onChange={(e) => setWithQuiz(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--color-gold))]" />
            Add a quiz to this lesson
          </label>
          {withQuiz && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Quiz title" htmlFor={`${id}-qt`} className="sm:col-span-2">
                  <input id={`${id}-qt`} maxLength={120} value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} className={controlCls} placeholder="Optional" />
                </Field>
                <Field label="Pass mark (%)" htmlFor={`${id}-pass`}>
                  <input id={`${id}-pass`} type="number" min={0} max={100} inputMode="numeric" value={passing} onChange={(e) => setPassing(e.target.value)} className={controlCls} />
                </Field>
              </div>
              {questions.map((q, i) => (
                <fieldset key={i} className="space-y-2 rounded-xl border border-[var(--border-faint)] p-3">
                  <legend className="px-1 text-xs font-semibold text-gold">Question {i + 1}</legend>
                  <Field label="Question" htmlFor={`${id}-q${i}`}>
                    <input id={`${id}-q${i}`} maxLength={200} value={q.question} onChange={(e) => patchQuestion(i, { question: e.target.value })} className={controlCls} />
                  </Field>
                  <p className="text-[11px] text-ink-500">Choose the circle next to the correct answer.</p>
                  {q.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`${id}-correct${i}`}
                        aria-label={`Answer ${oi + 1} is correct`}
                        checked={q.correctIndex === oi}
                        onChange={() => patchQuestion(i, { correctIndex: oi })}
                        className="h-4 w-4 shrink-0 accent-[rgb(var(--color-gold))]"
                      />
                      <input
                        aria-label={`Answer ${oi + 1}`}
                        maxLength={200}
                        value={o}
                        onChange={(e) => patchQuestion(i, { options: q.options.map((x, xi) => (xi === oi ? e.target.value : x)) })}
                        className={controlCls}
                        placeholder={`Answer ${oi + 1}`}
                      />
                      {q.options.length > 2 && (
                        <button
                          type="button"
                          aria-label={`Remove answer ${oi + 1}`}
                          onClick={() => patchQuestion(i, { options: q.options.filter((_, xi) => xi !== oi), correctIndex: q.correctIndex === oi ? 0 : q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex })}
                          className="shrink-0 text-ink-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    {q.options.length < 6 && (
                      <Button variant="secondary" className="!min-h-8 !px-3 !text-xs" onClick={() => patchQuestion(i, { options: [...q.options, ""] })}>
                        <Plus className="h-3.5 w-3.5" /> Add answer
                      </Button>
                    )}
                    {questions.length > 1 && (
                      <Button variant="danger" className="!min-h-8 !px-3 !text-xs" onClick={() => setQuestions((prev) => prev.filter((_, xi) => xi !== i))}>
                        Remove question
                      </Button>
                    )}
                  </div>
                  <Field label="Why is it correct? (optional)" htmlFor={`${id}-e${i}`}>
                    <input id={`${id}-e${i}`} maxLength={2000} value={q.explanation} onChange={(e) => patchQuestion(i, { explanation: e.target.value })} className={controlCls} />
                  </Field>
                </fieldset>
              ))}
              {questions.length < settings.maxQuizQuestionsPerLesson && (
                <Button variant="secondary" onClick={() => setQuestions((prev) => [...prev, blankQuestion()])}>
                  <Plus className="h-4 w-4" /> Add question
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </FormShell>
  );
}
