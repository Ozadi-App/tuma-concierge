"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, X, Minus, Send, Paperclip, Headset, Bot, ArrowLeft, UserRound } from "lucide-react";
import { Logo } from "./Logo";
import { useFocusTrap } from "../lib/focus";
import { supportChat, msg, type ChatMessage } from "../lib/support-chat";

const CHIPS = ["Track an order", "Payments and wallet", "Become a partner", "Something else"];
type Mode = "ai" | "queue" | "agent";

export function SupportChat({ hidden = false }: { hidden?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("ai");
  const [agentName, setAgentName] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>(() => [msg("ai", "Hi, I am the Peebee assistant. Ask me about orders, trips, the wallet or becoming a partner. You can talk to a person at any time.")]);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const cancel = useRef<(() => void) | null>(null);
  useFocusTrap(panel, open, ".sc-input");

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [msgs, typing, mode]);
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || document.querySelector(".fs[data-open]")) return;
      e.stopPropagation();
      setOpen(false);
      launcher.current?.focus();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);
  useEffect(() => () => cancel.current?.(), []);

  const add = (m: ChatMessage) => setMsgs((l) => [...l, m]);

  async function send(t: string) {
    const body = t.trim();
    if (!body) return;
    setText("");
    const mine = msg("user", body);
    add(mine);
    if (mode === "agent") { await supportChat.sendToAgent(body); return; }
    if (mode === "queue") return;
    setTyping(true);
    try { add(await supportChat.askAI(body, [...msgs, mine])); } finally { setTyping(false); }
  }

  function toPerson() {
    setMode("queue");
    add(msg("system", "Connecting you to a support agent…"));
    cancel.current = supportChat.requestAgent(msgs, (e) => {
      if (e.type === "joined") { setMode("agent"); setAgentName(e.agentName); add(msg("system", `${e.agentName} joined the chat`)); }
      else if (e.type === "message") add(e.message);
      else if (e.type === "ended") backToAI();
    });
  }
  function backToAI() {
    cancel.current?.(); cancel.current = null;
    supportChat.endAgent();
    setMode("ai"); setAgentName(null);
    add(msg("system", "You are back with the AI assistant"));
  }
  function onSubmit(e: FormEvent) { e.preventDefault(); send(text); }

  const human = mode !== "ai";
  return (
    <>
      <button ref={launcher} type="button" className="sc-launch" data-hidden={hidden || open || undefined} aria-label="Open Peebee Support chat" aria-expanded={open} aria-controls="sc-panel" onClick={() => setOpen(true)}>
        <MessageCircle size={26} aria-hidden />
      </button>
      <div ref={panel} id="sc-panel" className="sc" data-open={open || undefined} data-mode={mode} role="dialog" aria-modal="false" aria-labelledby="sc-title" aria-hidden={!open} inert={!open}>
        <header className="sc-head">
          <span className="sc-logo"><Logo className="sc-mark" /></span>
          <span className="sc-who">
            <b id="sc-title">Peebee Support</b>
            <small><span className="sc-dot" aria-hidden />{mode === "agent" ? `${agentName ?? "Support agent"}, a person on the team` : mode === "queue" ? "Finding a support agent" : "AI assistant, replies instantly"}</small>
          </span>
          <button type="button" className="sc-ico" aria-label="Minimise chat" onClick={() => { setOpen(false); launcher.current?.focus(); }}><Minus size={18} aria-hidden /></button>
          <button type="button" className="sc-ico" aria-label="Close chat" onClick={() => { setOpen(false); launcher.current?.focus(); }}><X size={18} aria-hidden /></button>
        </header>
        <div className="sc-bar">
          {human ? (
            <button type="button" className="sc-swap" onClick={backToAI}><ArrowLeft size={15} aria-hidden /> Back to the AI assistant</button>
          ) : (
            <button type="button" className="sc-swap sc-person" onClick={toPerson}><Headset size={15} aria-hidden /> Talk to a person</button>
          )}
        </div>
        <ol ref={list} className="sc-list" aria-live="polite" aria-label="Messages">
          {msgs.map((m) => m.from === "system" ? (
            <li key={m.id} className="sc-sys">{m.text}</li>
          ) : (
            <li key={m.id} className={`sc-msg sc-${m.from}`}>
              {m.from !== "user" && (
                <span className={`sc-av sc-av-${m.from}`} aria-hidden>{m.from === "ai" ? <Bot size={15} /> : <UserRound size={15} />}</span>
              )}
              <div>
                {m.from !== "user" && <span className="sc-tag">{m.from === "ai" ? "AI assistant" : m.agentName ?? "Support agent"}</span>}
                <p className="sc-bubble">{m.text}</p>
              </div>
            </li>
          ))}
          {mode === "queue" && (
            <li className="sc-queue">
              <span className="sc-qav" aria-hidden><UserRound size={22} /></span>
              <span><b>Connecting you to a support agent</b><small>You are in the queue. Stay in this chat and a person from the team will join.</small></span>
              <span className="sc-spin" aria-hidden />
            </li>
          )}
          {typing && <li className="sc-msg sc-ai"><span className="sc-av sc-av-ai" aria-hidden><Bot size={15} /></span><p className="sc-bubble sc-typing" aria-label="The assistant is typing"><i /><i /><i /></p></li>}
          {msgs.length === 1 && mode === "ai" && (
            <li className="sc-chips">{CHIPS.map((c) => <button key={c} type="button" className="sc-chip" onClick={() => send(c)}>{c}</button>)}</li>
          )}
        </ol>
        <form className="sc-form" onSubmit={onSubmit}>
          <button type="button" className="sc-ico" aria-label="Attach a file" title="Attachments are coming soon" aria-disabled="true"><Paperclip size={18} aria-hidden /></button>
          <label className="sr-only" htmlFor="sc-input">Message</label>
          <input id="sc-input" className="sc-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "agent" ? "Message the support agent" : "Ask Peebee Support"} autoComplete="off" />
          <button type="submit" className="sc-send" aria-label="Send message" disabled={!text.trim()}><Send size={17} aria-hidden /></button>
        </form>
      </div>
    </>
  );
}
