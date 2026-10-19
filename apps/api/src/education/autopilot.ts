import { db, executeBatch, type DbStatement } from "../db/client.js";

/**
 * Trial classes: a live session with no tutor behind it. Its run sheet plays on a loop, driven by the clock, so a
 * student who joins at any moment sees a class in progress.
 *
 * Nothing runs in the background. Whenever a phone asks for the class's state, the server works out which step the
 * loop should be on right now. If that step hasn't been applied yet, the first phone to ask claims it (a single
 * compare-and-set on `autopilot_step`) and applies it; everyone else sees the result. A step is a pure function of
 * the clock, so every phone, and every restart of the server, agrees without any coordination.
 */

type Row = Record<string, unknown>;

interface Segment {
  cueId: string;
  kind: string;
  target: string;
  phase: "open" | "reveal";
  start: number;
  end: number;
}

interface Schedule {
  segments: Segment[];
  total: number;
}

const DEFAULT_OPEN = 10;
const SCHEDULE_TTL_MS = 30_000;
const schedules = new Map<string, { at: number; schedule: Schedule }>();

export function resetAutopilotCache(): void {
  schedules.clear();
}

function parse(json: unknown): Row {
  try {
    const v = JSON.parse(String(json ?? "{}"));
    return v && typeof v === "object" ? (v as Row) : {};
  } catch {
    return {};
  }
}

async function scheduleOf(sessionId: string): Promise<Schedule> {
  const known = schedules.get(sessionId);
  if (known && Date.now() - known.at < SCHEDULE_TTL_MS) return known.schedule;
  const res = await db.execute({ sql: "SELECT id, kind, target, payload_json FROM edu_live_cues WHERE session_id = ? ORDER BY position ASC", args: [sessionId] });
  const segments: Segment[] = [];
  let t = 0;
  for (const cue of res.rows as Row[]) {
    const auto = (parse(cue.payload_json).autopilot ?? {}) as Row;
    const open = Math.max(2, Math.floor(Number(auto.open) || DEFAULT_OPEN));
    const reveal = cue.kind === "question" ? Math.max(0, Math.floor(Number(auto.reveal) || 0)) : 0;
    segments.push({ cueId: String(cue.id), kind: String(cue.kind), target: String(cue.target), phase: "open", start: t, end: t + open });
    t += open;
    if (reveal > 0) {
      segments.push({ cueId: String(cue.id), kind: String(cue.kind), target: String(cue.target), phase: "reveal", start: t, end: t + reveal });
      t += reveal;
    }
  }
  const schedule = { segments, total: t };
  schedules.set(sessionId, { at: Date.now(), schedule });
  return schedule;
}

/** Which step of the loop the clock says we are on, and when it ends (ms). */
export function stepAt(schedule: Schedule, nowMs: number): { index: number; step: number; segment: Segment; cycleStartMs: number } | null {
  if (schedule.segments.length === 0 || schedule.total <= 0) return null;
  const nowSec = nowMs / 1000;
  const cycle = Math.floor(nowSec / schedule.total);
  const pos = nowSec - cycle * schedule.total;
  let index = schedule.segments.findIndex((s) => pos >= s.start && pos < s.end);
  if (index < 0) index = schedule.segments.length - 1;
  return { index, step: cycle * schedule.segments.length + index, segment: schedule.segments[index]!, cycleStartMs: cycle * schedule.total * 1000 };
}

const isoOf = (ms: number) => new Date(ms).toISOString();

/**
 * Bring an autopilot session up to date with the clock and return its row. Sessions that aren't on autopilot are
 * returned untouched, with no extra queries.
 */
export async function syncAutopilot(session: Row, nowMs: number = Date.now()): Promise<Row> {
  if (Number(session.autopilot) !== 1 || session.status !== "live") return session;
  const schedule = await scheduleOf(String(session.id));
  const now = stepAt(schedule, nowMs);
  if (!now) return session;
  if (session.autopilot_step !== null && session.autopilot_step !== undefined && Number(session.autopilot_step) === now.step) return session;

  const sessionId = String(session.id);
  const claim = await db.execute({
    sql: "UPDATE edu_live_sessions SET autopilot_step = ? WHERE id = ? AND (autopilot_step IS NULL OR autopilot_step != ?)",
    args: [now.step, sessionId, now.step],
  });
  if ((claim.rowsAffected ?? 0) === 0) return reread(sessionId, session);

  // We hold this step: apply it.
  const { segment, cycleStartMs } = now;
  const opensAt = cycleStartMs + segment.start * 1000;
  const cueId = segment.cueId;
  const openSegment = schedule.segments.find((s) => s.cueId === cueId && s.phase === "open")!;
  const openEndsAt = cycleStartMs + openSegment.end * 1000;
  const hasTimer = segment.kind === "question";

  const cue = (await db.execute({ sql: "SELECT status FROM edu_live_cues WHERE id = ?", args: [cueId] })).rows[0] as Row | undefined;
  const alreadyShowing = cue?.status === "active" && segment.phase === "reveal";

  const statements: DbStatement[] = [
    { sql: "UPDATE edu_live_cues SET status = 'closed', closed_at = datetime('now') WHERE session_id = ? AND status = 'active' AND id != ?", args: [sessionId, cueId] },
  ];
  if (alreadyShowing) {
    statements.push({ sql: "UPDATE edu_live_cues SET revealed = 1 WHERE id = ?", args: [cueId] });
  } else {
    // Entering the item afresh: earlier answers belong to the last time round the loop.
    statements.push({ sql: "DELETE FROM edu_live_responses WHERE cue_id = ?", args: [cueId] });
    statements.push({
      sql: "UPDATE edu_live_cues SET status = 'active', activated_at = ?, ends_at = ?, revealed = ?, closed_at = NULL WHERE id = ?",
      args: [isoOf(opensAt), hasTimer ? isoOf(openEndsAt) : null, segment.phase === "reveal" ? 1 : 0, cueId],
    });
  }
  statements.push({
    // The TV and the phones follow the same item, so a screen and the students' phones stay in step.
    sql: "UPDATE edu_live_sessions SET phones_cue_id = ?, screen_cue_id = ?, version = version + 1 WHERE id = ?",
    args: [cueId, cueId, sessionId],
  });
  await executeBatch(statements);
  return reread(sessionId, session);
}

async function reread(sessionId: string, fallback: Row): Promise<Row> {
  const res = await db.execute({ sql: "SELECT * FROM edu_live_sessions WHERE id = ?", args: [sessionId] });
  return (res.rows[0] as Row | undefined) ?? fallback;
}
