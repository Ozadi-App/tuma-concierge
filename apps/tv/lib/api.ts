import type { LearnEnrollment, LearnerCourse, LearnerLessonDetail, QuizAnswer, QuizAttemptStart, QuizResult, ScreenState } from "@peebee/shared";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000").replace(/\/$/, "");
export const SECRET_KEY = "peebee_tv_secret";

export class TvAuthError extends Error {
  constructor() {
    super("This screen isn't registered.");
  }
}

/** A refusal from the API that the screen can act on: `code` is the API's short name for it ("not_enrolled", "pay_on_phone"). */
export class TvHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, secret: string | null, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Device ${secret}` } : {}) },
    cache: "no-store",
  });
  if (res.status === 401) throw new TvAuthError();
  const body = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!res.ok) throw new TvHttpError(body.message ?? `Request failed (${res.status})`, res.status, body.error ?? "");
  return body;
}

export type PairStart = { deviceId: string; secret: string; code: string; linkUrl: string; expiresInSeconds: number; pollSeconds: number };
export type TrialSlot = "a" | "b";
export type TrialClass = { slot: TrialSlot; code: string; title: string; hostName: string; stream: string | null };
export type Me =
  | { status: "unpaired"; code: string | null; linkUrl: string | null; expiresInSeconds: number; pollSeconds: number; trial: TrialSlot | null }
  | { status: "paired"; name: string; ownerName: string; pollSeconds: number; trial: TrialSlot | null; learnEnabled: boolean; liveEnabled: boolean };

/** A published course in the catalogue, as the browse screen lists it. */
export type CatalogCourse = {
  id: string;
  stream: string;
  title: string;
  summary: string;
  priceUgx: number;
  schoolName: string;
  className: string;
  classLevel: string;
  lessonCount: number;
  demo: boolean;
};

/** A course the person hasn't enrolled in yet: enough to decide, nothing of the lessons. */
export type CatalogPreview = {
  id: string;
  title: string;
  summary: string;
  priceUgx: number;
  schoolName: string;
  outcomes: string[];
  modules: { id: string; title: string; lessons: { id: string; title: string; durationMinutes: number }[] }[];
};

/** The picture for a course. Public, drawn from its title unless the educator set a cover. */
export const courseArt = (courseId: string) => `${BASE}/v1/education/art/course/${encodeURIComponent(courseId)}`;

export const tvApi = {
  start: () => call<PairStart>("/v1/tv/pair/start", null, { method: "POST", body: "{}" }),
  me: (secret: string) => call<Me>("/v1/tv/me", secret),
  screen: (secret: string) => call<ScreenState>("/v1/tv/screen/state", secret),
  /** The practice classes this screen can show. Public, so it works before the TV is paired. */
  trials: () => call<{ ok: true; classes: TrialClass[] }>("/v1/tv/trial", null),
  startTrial: (secret: string, slot: TrialSlot) => call<{ ok: true }>("/v1/tv/trial", secret, { method: "POST", body: JSON.stringify({ slot }) }),
  leaveTrial: (secret: string) => call<{ ok: true }>("/v1/tv/trial", secret, { method: "DELETE" }),
  unpair: (secret: string) => call<{ ok: true }>("/v1/tv/me", secret, { method: "DELETE" }),

  // ---- Learning: the courses of the account this TV is linked to
  enrollments: (secret: string) => call<{ ok: true; enrollments: LearnEnrollment[] }>("/v1/tv/learn/enrollments", secret),
  course: (secret: string, id: string) => call<{ ok: true; course: LearnerCourse }>(`/v1/tv/learn/courses/${encodeURIComponent(id)}`, secret),
  enrol: (secret: string, id: string) => call<{ ok: true }>(`/v1/tv/learn/courses/${encodeURIComponent(id)}/enroll`, secret, { method: "POST", body: "{}" }),
  mediaUrl: (secret: string, lessonId: string) => call<{ ok: true; url: string }>(`/v1/tv/learn/lessons/${encodeURIComponent(lessonId)}/media-url`, secret, { method: "POST", body: "{}" }),
  lesson: (secret: string, lessonId: string) => call<{ ok: true; lesson: LearnerLessonDetail }>(`/v1/tv/learn/lessons/${encodeURIComponent(lessonId)}`, secret),
  startQuiz: (secret: string, lessonId: string) => call<{ ok: true } & QuizAttemptStart>(`/v1/tv/learn/lessons/${encodeURIComponent(lessonId)}/quiz/start`, secret, { method: "POST", body: "{}" }),
  submitQuiz: (secret: string, lessonId: string, attemptToken: string, answers: Record<string, QuizAnswer>) =>
    call<{ ok: true } & QuizResult>(`/v1/tv/learn/lessons/${encodeURIComponent(lessonId)}/quiz/submit`, secret, { method: "POST", body: JSON.stringify({ attemptToken, answers }) }),
  complete: (secret: string, lessonId: string) => call<{ ok: true }>(`/v1/tv/learn/lessons/${encodeURIComponent(lessonId)}/complete`, secret, { method: "POST", body: "{}" }),

  // ---- The public catalogue: anyone may look
  catalog: (stream?: string) => call<{ ok: true; courses: CatalogCourse[] }>(`/v1/education/catalog/courses?limit=50${stream && stream !== "all" ? `&stream=${encodeURIComponent(stream)}` : ""}`, null),
  catalogCourse: (id: string) => call<{ ok: true; course: CatalogPreview }>(`/v1/education/catalog/courses/${encodeURIComponent(id)}`, null),
};
