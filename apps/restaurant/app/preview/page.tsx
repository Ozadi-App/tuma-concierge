"use client";

import { ApiError, COLOUR_SCENES, DEFAULT_COLOUR_SCENE, type ColourScene, type RestaurantMenu } from "@peebee/shared";
import { Check, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "../../components/shell/Toaster";
import { StorefrontPreview, type PreviewScreen } from "../../components/storefront/StorefrontPreview";
import { Card, PageHeader } from "../../components/ui/Page";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useResolvedTheme } from "../../lib/theme";

const SCREENS: { id: PreviewScreen; label: string }[] = [{ id: "storefront", label: "Storefront" }, { id: "dish", label: "Dish" }, { id: "cart", label: "Cart" }];

/** How customers see this business: storefront, a dish and the cart, in the business's own colours. */
export default function PreviewPage() {
  const { restaurant, restaurantReady, refreshRestaurant } = useAuth();
  const router = useRouter();
  const appTheme = useResolvedTheme();
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"light" | "dark">(appTheme);
  const [screen, setScreen] = useState<PreviewScreen>("storefront");
  const saved = restaurant?.theme_scene ?? DEFAULT_COLOUR_SCENE;
  const [scene, setScene] = useState<ColourScene>(saved);
  const [busy, setBusy] = useState(false);

  // The saved theme drives the preview; it follows any change made elsewhere (Business profile).
  useEffect(() => { setScene(saved); }, [saved]);
  useEffect(() => { if (restaurant?.theme_mode === "light" || restaurant?.theme_mode === "dark") setMode(restaurant.theme_mode); }, [restaurant?.theme_mode]);
  useEffect(() => { if (restaurantReady && !restaurant) router.replace("/business"); }, [restaurantReady, restaurant, router]);
  useEffect(() => {
    api.myMenu().then(setMenu).catch((err) => { if (!(err instanceof ApiError && err.status === 404)) setError(errorMessage(err)); });
  }, []);

  async function applyTheme() {
    setBusy(true);
    try { await api.updateRestaurant({ themeScene: scene, themeMode: restaurant?.theme_mode ?? "auto" }); await refreshRestaurant(); toast("Business theme saved"); }
    catch (err) { toast(errorMessage(err), "error"); }
    finally { setBusy(false); }
  }

  if (!restaurant) return <p className="p-8 text-center text-sm text-ink-500">Loading your storefront…</p>;
  const sceneName = COLOUR_SCENES.find((s) => s.id === scene)?.name;
  return (
    <div className="space-y-5 px-4 pb-6 pt-4 lg:px-8">
      <PageHeader eyebrow="Storefront" title="Customer preview" description="Exactly what customers see: your cover, featured dishes and menu, in your colours." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-3">
          <div className="rs-seg mx-auto max-w-[390px]" role="tablist" aria-label="Preview screen">
            {SCREENS.map((s) => <button key={s.id} type="button" role="tab" aria-selected={screen === s.id} aria-pressed={screen === s.id} onClick={() => setScreen(s.id)}>{s.label}</button>)}
          </div>
          {error && <p role="alert" className="text-center text-sm">{error}</p>}
          {menu ? <StorefrontPreview restaurant={restaurant} menu={menu} scene={scene} mode={mode} screen={screen} onScreen={setScreen} />
            : !error && <div className="mx-auto h-[780px] max-w-[390px] animate-pulse rounded-[52px] bg-[rgb(var(--surface-muted))]" />}
        </div>
        <div className="space-y-5 lg:sticky lg:top-24">
          <Card title="Appearance" description="Customers choose light or dark on their phone. Check both.">
            <div className="rs-seg" role="group" aria-label="Preview appearance">
              <button type="button" aria-pressed={mode === "light"} onClick={() => setMode("light")}><Sun size={14} className="mr-1 inline" />Light</button>
              <button type="button" aria-pressed={mode === "dark"} onClick={() => setMode("dark")}><Moon size={14} className="mr-1 inline" />Dark</button>
            </div>
          </Card>
          <Card title="Colour theme" description={scene === saved ? `${sceneName} is your saved theme.` : `Trying ${sceneName}. Customers still see your saved theme.`}>
            <div className="grid grid-cols-5 gap-2" role="group" aria-label="Try a colour theme">
              {COLOUR_SCENES.map((o) => (
                <button key={o.id} type="button" aria-pressed={scene === o.id} aria-label={o.name} title={o.name} onClick={() => setScene(o.id)} className={`rs-swatch ${scene === o.id ? "is-on" : ""}`}>
                  <span style={{ background: `conic-gradient(${o.colours[0]} 0 50%, ${o.colours[1]} 0 75%, ${o.colours[2]} 0)` }} />
                  {o.id === saved && <Check size={12} className="rs-swatch-check" aria-hidden />}
                </button>
              ))}
            </div>
            {scene !== saved && (
              <div className="flex gap-2">
                <button type="button" onClick={() => setScene(saved)} className="rs-btn rs-btn-ghost flex-1">Reset</button>
                <button type="button" disabled={busy} onClick={() => void applyTheme()} className="rs-btn rs-btn-gold flex-1">{busy ? "Saving…" : "Use this theme"}</button>
              </div>
            )}
            <Link href="/business#theme" className="block text-xs font-bold text-gold">Theme and appearance settings →</Link>
          </Card>
          <Card title="Make it shine">
            <ul className="space-y-2 text-sm text-ink-500">
              <li>Feature 2–4 dishes: they lead your storefront in large cards.</li>
              <li>Add photos to every dish; cards without one show a plain icon.</li>
              <li>Badges (Popular, New, Offer) sit on the photo corner.</li>
            </ul>
            <Link href="/menu" className="block text-xs font-bold text-gold">Edit menu →</Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
