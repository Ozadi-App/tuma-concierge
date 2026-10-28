"use client";

import type { ReactNode } from "react";
import { describeModuleNotice, hiddenLinksCss, moduleForPath, type ModuleRouteRule } from "./module-routes.js";
import type { ModulesView } from "./use-modules.js";

/**
 * The one full-screen notice for a screen whose module is switched off in Admin → Services. What it says (coming soon,
 * back soon, not available), the message and the date all come from Admin. Styled with the apps' own colour tokens,
 * inline, because the apps' Tailwind builds do not scan this package.
 */
export function ModuleNoticeScreen({ title, modules, moduleKey }: { title: string; modules: ModulesView; moduleKey: string }) {
  const { headline, dateLine, message } = describeModuleNotice(modules.notice(moduleKey));
  return (
    <section role="status" style={{ display: "flex", minHeight: "60dvh", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center", padding: "32px 24px", borderRadius: 24, background: "rgb(var(--surface-card))", border: "1px solid var(--border-faint)", color: "rgb(var(--color-ink))" }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgb(var(--color-gold))" }}>{title}</p>
        <h1 style={{ margin: "10px 0 0", fontSize: 24, fontWeight: 700 }}>{headline}</h1>
        {message && <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.5, color: "rgb(var(--color-ink-500))" }}>{message}</p>}
        {dateLine && <p style={{ margin: "12px 0 0", fontSize: 14, fontWeight: 700 }}>{dateLine}</p>}
      </div>
    </section>
  );
}

/** Shows the page, or the notice in its place when the module that owns this path is off. Paths no rule names always show. */
export function ModuleRouteGate({ rules, pathname, modules, children }: { rules: readonly ModuleRouteRule[]; pathname: string; modules: ModulesView; children: ReactNode }) {
  const rule = moduleForPath(pathname, rules);
  const css = hiddenLinksCss(rules, modules);
  const hide = css ? <style>{css}</style> : null;
  if (rule && !modules(rule.module)) return <>{hide}<ModuleNoticeScreen title={rule.title} modules={modules} moduleKey={rule.module} /></>;
  return <>{hide}{children}</>;
}
