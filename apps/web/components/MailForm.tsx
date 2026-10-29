"use client";
import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";

type Field = { name: string; label: string; type?: "text" | "email" | "tel" | "textarea" | "select"; options?: string[]; required?: boolean; autoComplete?: string };

/**
 * Front-end only for now: on send it opens the visitor's email app with the message filled in, addressed to `to`.
 * Nothing is stored on a server.
 */
export function MailForm({ to, subject, fields, cta }: { to: string; subject: string; fields: Field[]; cta: string }) {
  const [done, setDone] = useState(false);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = fields.map((f) => `${f.label}: ${String(fd.get(f.name) ?? "").trim()}`).join("\n");
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setDone(true);
  }
  return (
    <form className="mf" onSubmit={onSubmit}>
      {fields.map((f) => (
        <label key={f.name} className={`mf-f${f.type === "textarea" ? " mf-wide" : ""}`}>
          <span>{f.label}{f.required ? "" : <em> (optional)</em>}</span>
          {f.type === "textarea" ? (
            <textarea name={f.name} rows={5} required={f.required} />
          ) : f.type === "select" ? (
            <select name={f.name} required={f.required} defaultValue="">
              <option value="" disabled>Choose one</option>
              {f.options?.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <input name={f.name} type={f.type ?? "text"} required={f.required} autoComplete={f.autoComplete} />
          )}
        </label>
      ))}
      <div className="mf-wide mf-foot">
        <button type="submit" className="btn btn-gold">{cta} <Send size={16} aria-hidden /></button>
        <p className="quiet" role="status">{done ? "Your email app should open with the message ready. Press send there." : "Sending opens your email app with this message filled in."}</p>
      </div>
    </form>
  );
}
