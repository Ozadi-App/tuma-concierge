"use client";

import type { TierView } from "@peebee/shared";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Notice, TextArea, TextField } from "../../../components/studio/ui";
import { useMyChannel } from "../../../components/studio/useMyChannel";
import { api, errorMessage } from "../../../lib/api";
import { ugx } from "../../../lib/channels";

export default function MembersPage() {
  const { channel, config, loading } = useMyChannel();
  const [tiers, setTiers] = useState<TierView[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(5000);
  const [perks, setPerks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const money = config?.monetization;

  const load = useCallback(() => { api.myTiers().then((r) => setTiers(r.tiers)).catch((e) => setError(errorMessage(e))); }, []);
  useEffect(() => { if (channel && money?.enabled && money.memberships) load(); }, [channel, money, load]);

  if (loading) return <div className="p-8 text-center text-sm text-ink-500" aria-busy="true">Loading…</div>;
  if (!channel) return <Notice tone="info">Open a channel first to offer memberships.</Notice>;
  if (!money?.enabled || !money.memberships) return <Notice tone="info">Memberships are not available yet.</Notice>;
  const active = (tiers ?? []).filter((t) => t.active !== false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createTier({ name, description: description || undefined, priceUgx: price, perks: perks.split("\n").map((p) => p.trim()).filter(Boolean) });
      setName(""); setDescription(""); setPerks("");
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-ink">Memberships</h1>
      <p className="text-sm text-ink-500">Fans pay monthly from their Peebee wallet. Members can watch your members-only posts, and (by default) skip ads on your videos.</p>
      {error && <Notice tone="error">{error}</Notice>}
      {(tiers ?? []).map((t) => (
        <Card key={t.id}>
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-base font-bold text-ink">{t.name}</h2><p className="text-sm font-bold text-gold">{ugx(t.priceUgx)} / {t.periodDays === 30 ? "month" : `${t.periodDays} days`}</p></div>
            <span className="rounded-full bg-[rgb(var(--surface-muted))] px-3 py-1 text-xs font-bold text-ink">{t.members} member{t.members === 1 ? "" : "s"}</span>
          </div>
          {t.description && <p className="text-sm text-ink-500">{t.description}</p>}
          {t.perks.length > 0 && <ul className="list-disc pl-5 text-sm text-ink">{t.perks.map((p) => <li key={p}>{p}</li>)}</ul>}
          <div className="flex gap-2">
            <Button variant="plain" onClick={async () => { await api.updateTier(t.id, { active: t.active === false }).catch((e) => setError(errorMessage(e))); load(); }} className="!min-h-10 !text-xs">{t.active === false ? "Turn back on" : "Stop selling"}</Button>
          </div>
          {t.active === false && <p className="text-xs text-ink-500">Not for sale. Current members keep access until their period ends.</p>}
        </Card>
      ))}
      {active.length < money.maxTiers && (
        <form onSubmit={create}>
          <Card title="Add a tier" hint={`Up to ${money.maxTiers} tiers, ${ugx(money.minTierPriceUgx)} to ${ugx(money.maxTierPriceUgx)} each`}>
            <TextField id="mt-name" label="Name" value={name} onChange={setName} maxLength={40} required placeholder="Supporter" />
            <TextField id="mt-price" label="Price per month (UGX)" type="number" inputMode="numeric" value={price} onChange={(v) => setPrice(Number(v))} min={money.minTierPriceUgx} max={money.maxTierPriceUgx} required />
            <TextArea id="mt-desc" label="What members get (short)" value={description} onChange={setDescription} rows={2} maxLength={300} />
            <TextArea id="mt-perks" label="Perks, one per line" value={perks} onChange={setPerks} rows={3} placeholder={"Members-only posts\nEarly access"} />
            <Button type="submit" disabled={busy || !name.trim()} className="w-full">{busy ? "Adding…" : "Add tier"}</Button>
          </Card>
        </form>
      )}
    </div>
  );
}
