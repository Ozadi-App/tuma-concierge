"use client";

import type { TalentFrequency, TalentRecurrence } from "@peebee/shared";
import { Repeat } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { BusyButton, Chip, cardClass, FailureNote, Field, secondaryBtn, primaryBtn } from "./JobsUI";
import { fieldClass, formatUgx, formatWorkDate, jobsFailure, type JobsFailure } from "./jobs-utils";

export const FREQ_LABEL: Record<TalentFrequency, string> = { daily: "Every day", weekly: "Every week", biweekly: "Every 2 weeks", monthly: "Every month" };

/** Choose how often to repeat, then save. `kind` decides whether the same worker is rebooked or the job is put up again. */
export function RepeatForm({ frequencies, maxRuns, kind, targetId, onDone }: { frequencies: TalentFrequency[]; maxRuns: number; kind: "rehire" | "repost"; targetId: string; onDone: () => void }) {
  const [freq, setFreq] = useState<TalentFrequency>(frequencies[0] ?? "weekly");
  const [times, setTimes] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<JobsFailure | null>(null);

  async function save() {
    setBusy(true);
    setFailure(null);
    try {
      const input = { frequency: freq, maxRuns: times ? Math.min(Number(times), maxRuns) : undefined };
      if (kind === "rehire") await api.talentRepeatContract(targetId, input);
      else await api.talentRepeatJob(targetId, input);
      onDone();
    } catch (err) {
      setFailure(jobsFailure(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500">{kind === "rehire" ? "The same worker is booked again each time, and the money is held when each one starts." : "A fresh copy of this job is posted each time for workers to apply to."}</p>
      <div className="flex flex-wrap gap-2">{frequencies.map((f) => <Chip key={f} on={freq === f} onClick={() => setFreq(f)}>{FREQ_LABEL[f]}</Chip>)}</div>
      <Field label="How many times? (optional)" hint={`Leave blank to keep going, up to ${maxRuns} times`}>
        <input inputMode="numeric" value={times} onChange={(e) => setTimes(e.target.value.replace(/\D/g, ""))} className={fieldClass} />
      </Field>
      <FailureNote failure={failure} />
      <BusyButton busy={busy} onClick={save} className={primaryBtn}>Start repeating</BusyButton>
    </div>
  );
}

/** The person's repeating jobs, with pause, resume and stop. */
export function RecurrenceList({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<TalentRecurrence[] | null>(null);
  const [failure, setFailure] = useState<JobsFailure | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api.talentRecurrences().then((r) => setRows(r.recurrences)).catch((err) => setFailure(jobsFailure(err)));
  }, []);
  useEffect(load, [load]);

  async function act(id: string, action: "pause" | "resume" | "end") {
    if (action === "end" && !window.confirm("Stop this job repeating? Jobs already booked are not affected.")) return;
    setBusy(id + action);
    try { await api.talentRecurrenceAction(id, action); load(); onChange?.(); } catch (err) { setFailure(jobsFailure(err)); } finally { setBusy(null); }
  }

  if (!rows || rows.length === 0) return <FailureNote failure={failure} />;
  return (
    <section className="space-y-2" aria-label="Repeating jobs">
      <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">Repeating</h2>
      <FailureNote failure={failure} />
      {rows.map((r) => (
        <div key={r.id} className={`${cardClass} space-y-2`}>
          <div className="flex items-start gap-3">
            <Repeat className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
            <div className="min-w-0 flex-1">
              <strong className="block break-words text-sm">{r.title}</strong>
              <span className="block text-xs text-ink-500">{FREQ_LABEL[r.frequency]} · {formatUgx(r.priceUgx)} · {r.kind === "rehire" ? (r.role === "worker" ? "booked with you" : `with ${r.worker?.name ?? "the same worker"}`) : "posted again each time"}</span>
              <span className="block text-xs text-ink-500">{r.status === "paused" ? "Paused" : `Next: ${formatWorkDate(r.nextRunAt)}`} · done {r.runsDone}{r.maxRuns < 520 ? ` of ${r.maxRuns}` : ""} times</span>
              {r.lastError ? <span className="mt-1 block text-xs font-semibold text-gold">{r.lastError}</span> : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {r.role === "employer" ? (r.status === "paused"
              ? <BusyButton busy={busy === r.id + "resume"} className={primaryBtn} onClick={() => act(r.id, "resume")}>Resume</BusyButton>
              : <BusyButton busy={busy === r.id + "pause"} className={secondaryBtn} onClick={() => act(r.id, "pause")}>Pause</BusyButton>) : <span />}
            <BusyButton busy={busy === r.id + "end"} className={secondaryBtn} onClick={() => act(r.id, "end")}>{r.role === "worker" ? "Leave" : "Stop"}</BusyButton>
          </div>
        </div>
      ))}
    </section>
  );
}
