"use client";
import { COLOUR_SCENES, DEFAULT_COLOUR_SCENE, type ColourScene, type Restaurant } from "@peebee/shared";
import { storefrontStyle } from "@peebee/shared/storefront-palette";
import { Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { api, errorMessage } from "../lib/api";
import { useResolvedTheme } from "../lib/theme";
import { toast } from "./shell/Toaster";

/** The colours customers see inside your storefront, menu and dish pages, with a live swatch preview. */
export function BusinessStyleEditor({ restaurant, onSaved }: { restaurant: Restaurant; onSaved: () => Promise<void> }) {
  const [scene, setScene] = useState<ColourScene>(restaurant.theme_scene ?? DEFAULT_COLOUR_SCENE);
  const [mode, setMode] = useState<"auto" | "light" | "dark">(restaurant.theme_mode ?? "auto");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const appTheme = useResolvedTheme();
  useEffect(() => { setScene(restaurant.theme_scene ?? DEFAULT_COLOUR_SCENE); setMode(restaurant.theme_mode ?? "auto"); }, [restaurant.theme_scene, restaurant.theme_mode]);
  const dirty = scene !== (restaurant.theme_scene ?? DEFAULT_COLOUR_SCENE) || mode !== (restaurant.theme_mode ?? "auto");
  async function save() {
    setBusy(true); setMessage(null);
    try { await api.updateRestaurant({ themeScene: scene, themeMode: mode }); await onSaved(); toast("Business theme saved"); setMessage("Customers see this theme while browsing your food."); }
    catch (err) { setMessage(errorMessage(err)); toast("Could not save the theme", "error"); }
    finally { setBusy(false); }
  }
  const previewMode = mode === "auto" ? appTheme : mode;
  const name = COLOUR_SCENES.find((s) => s.id === scene)?.name;
  return (
    <section id="theme" className="rs-card scroll-mt-24 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-[15px] font-bold text-ink">Business theme</h2><p className="mt-0.5 text-sm text-ink-500">The colours customers see in your storefront and dish pages.</p></div>
        <Link href="/preview" className="shrink-0 text-xs font-bold text-gold">Full preview →</Link>
      </div>
      <div className="sf-mini" data-sf-mode={previewMode} style={storefrontStyle(scene, previewMode) as CSSProperties} aria-label={`Preview of the ${name} theme`} role="img">
        <span className="sf-mini-hero"><span className="sf-mini-title">{restaurant.name}</span><span className="sf-mini-sub">{restaurant.cuisine ?? "Menu"}</span></span>
        <span className="sf-mini-tabs"><span className="is-on">Featured</span><span>Mains</span><span>Drinks</span></span>
        <span className="sf-mini-card"><span className="sf-mini-badge">Popular</span><span className="sf-mini-line" /><span className="sf-mini-btn">Add +</span></span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Business colour theme">
        {COLOUR_SCENES.map((option) => (
          <button type="button" key={option.id} aria-pressed={scene === option.id} disabled={busy} onClick={() => setScene(option.id)} className={`scene-choice relative ${scene === option.id ? "scene-choice-selected" : ""}`}>
            <span className="scene-swatches" aria-hidden>{option.colours.map((colour) => <span key={colour} style={{ backgroundColor: colour }} />)}</span>
            <span className="scene-name">{option.name}</span>
            {scene === option.id && <Check size={16} className="absolute right-3 top-3 text-gold" aria-hidden />}
          </button>
        ))}
      </div>
      <div className="rs-seg" role="group" aria-label="Business appearance">
        {(["auto", "light", "dark"] as const).map((value) => (
          <button type="button" key={value} aria-pressed={mode === value} disabled={busy} onClick={() => setMode(value)}>{value === "auto" ? "Auto" : value === "light" ? "Light" : "Dark"}</button>
        ))}
      </div>
      <button type="button" disabled={busy} onClick={() => void save()} className="rs-btn rs-btn-gold w-full">{busy ? "Saving…" : "Save business theme"}</button>
      {dirty && !busy && <p className="text-xs text-ink-500">Unsaved: the preview shows your choice; customers see it after you save.</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </section>
  );
}
