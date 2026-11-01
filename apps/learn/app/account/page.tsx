"use client";

import { exitPracticeMode, isPracticeMode, launchPractice } from "@peebee/shared";
import { ChevronRight, FlaskConical, Laptop, LogOut, Moon, Sun, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Chip, cardCls } from "../../components/ui";
import { useLearnAuth } from "../../lib/auth-context";
import { STREAM_UI } from "../../lib/streams";

type Theme = "light" | "dark" | "auto";

export default function AccountPage() {
  const { user, activeStream, logout } = useLearnAuth();
  const [theme, setTheme] = useState<Theme>("auto");
  const [practice, setPractice] = useState(false);

  useEffect(() => {
    setPractice(isPracticeMode());
    try {
      const stored = localStorage.getItem("peebee-theme");
      if (stored === "light" || stored === "dark" || stored === "auto") setTheme(stored);
    } catch {
      /* private mode */
    }
  }, []);

  function changeTheme(next: Theme) {
    setTheme(next);
    try {
      localStorage.setItem("peebee-theme", next);
      const effective = next === "auto" ? (new Date().getHours() >= 6 && new Date().getHours() < 19 ? "light" : "dark") : next;
      document.documentElement.setAttribute("data-theme", effective);
    } catch {
      /* private mode */
    }
  }

  if (!user) return null;
  const themes: { id: Theme; label: string; icon: typeof Sun }[] = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "auto", label: "Auto", icon: Laptop },
  ];

  return (
    <div className="space-y-5 pb-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-gold">Account</p>
        <h2 className="font-display text-2xl font-semibold text-ink">Your profile</h2>
      </header>

      <section className={`${cardCls} flex items-center gap-4 p-5`}>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold/20 text-xl font-bold text-gold" aria-hidden>
          {user.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-base font-semibold text-ink">{user.name}</h3>
          <p className="truncate text-xs text-ink-500">{user.email || user.phone}</p>
          <Chip tone="gold">Working in {STREAM_UI[activeStream].title}</Chip>
        </div>
      </section>

      <section className={`${cardCls} space-y-3 p-5`}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
            <FlaskConical className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-ink">Sandbox</h3>
            <p className="mt-0.5 text-xs text-ink-500">
              Try building schools, classes, courses and lessons without touching real data. Your changes stay in this browser, and the demo schools are fully editable.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/practice" className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink-gold">
            Open the practice guide <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          {practice ? (
            <Button
              variant="secondary"
              onClick={() => {
                exitPracticeMode("learner");
                window.location.reload();
              }}
            >
              Exit sandbox
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                void launchPractice("learner").then((path) => window.location.assign(path));
              }}
            >
              Turn on sandbox
            </Button>
          )}
        </div>
      </section>

      <section className={`${cardCls} space-y-3 p-5`}>
        <h3 className="text-sm font-semibold text-ink">Appearance</h3>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={theme === t.id}
              onClick={() => changeTheme(t.id)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition ${
                theme === t.id ? "border-gold bg-gold/10 text-gold" : "border-[var(--border-faint)] text-ink-500 hover:text-ink"
              }`}
            >
              <t.icon className="h-5 w-5" aria-hidden />
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <Link href="/help" className="home-card flex items-center gap-3 !rounded-2xl !py-3 text-sm font-semibold text-ink">
        <LifeBuoy className="h-5 w-5 text-gold" strokeWidth={1.75} aria-hidden />
        <span className="flex-1">Help &amp; support</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-500/60" strokeWidth={1.75} aria-hidden />
      </Link>
      <Button variant="danger" className="w-full" onClick={logout}>
        <LogOut className="h-4 w-4" aria-hidden /> Sign out
      </Button>
    </div>
  );
}
