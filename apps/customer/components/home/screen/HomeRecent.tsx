"use client";

import type { ListSummary } from "@peebee/shared";
import { ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useTranslate } from "../../../lib/i18n";
import { ListRow, ListRows } from "../../ui/ListRow";
import { HomeSection, HomeStatus } from "./HomeSection";

function listDisplayTitle(list: ListSummary): string {
  if (!list.riderFirstName) return list.title;
  return list.area ? `${list.riderFirstName} · ${list.area}` : `${list.riderFirstName}'s delivery`;
}

function RiderAvatar({ riderId }: { riderId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    api
      .riderPhotoBlob(riderId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [riderId]);
  if (!url) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--surface-muted))] text-ink">
        <ShoppingBag className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
    );
  }
  // Rider photos are blob URLs, so next/image cannot optimize them.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />;
}

type State = { status: "loading" } | { status: "error" } | { status: "ready"; lists: ListSummary[] };

export function HomeRecent() {
  const t = useTranslate();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let live = true;
    api
      .getRecentLists(10)
      .then((res) => {
        if (live) setState({ status: "ready", lists: res.lists ?? [] });
      })
      .catch(() => {
        if (live) setState({ status: "error" });
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  return (
    <HomeSection title={t("recent_lists_title")} sectionId="recent" action={{ href: "/orders", label: t("see_all") }}>
      {state.status === "loading" && <HomeStatus kind="loading" title={t("home_lists_loading")} />}
      {state.status === "error" && (
        <HomeStatus kind="error" title={t("home_lists_error")} onRetry={() => { setState({ status: "loading" }); setAttempt((n) => n + 1); }} retryLabel={t("rider_retry")} />
      )}
      {state.status === "ready" && state.lists.length === 0 && <HomeStatus kind="empty" title={t("home_lists_empty")} />}
      {state.status === "ready" && state.lists.length > 0 && (
        <ListRows>
          {state.lists.map((list) => (
            <li key={list.id}>
              <ListRow
                href={list.orderId && !list.expired ? `/orders/${list.orderId}` : `/orders/lists/${list.listId}`}
                leading={
                  list.riderId && list.riderHasPhoto ? (
                    <RiderAvatar riderId={list.riderId} />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--surface-muted))] text-ink">
                      <ShoppingBag className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </span>
                  )
                }
                title={listDisplayTitle(list)}
                subtitle={list.expired ? t("list_expired_hint") : `${list.itemCount} ${t("items_count")}`}
                trailing={
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold capitalize ${
                      list.expired ? "bg-gold/15 text-ink" : list.status === "delivered" ? "bg-[rgb(var(--surface-muted))] text-ink" : "bg-[rgb(var(--surface-muted))] text-ink-500"
                    }`}
                  >
                    {list.expired ? t("list_expired") : list.status}
                  </span>
                }
              />
            </li>
          ))}
        </ListRows>
      )}
    </HomeSection>
  );
}
