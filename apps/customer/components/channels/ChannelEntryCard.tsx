"use client";

import { ChevronRight, Clapperboard } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useChannelsConfig } from "../../lib/channels";

/** On the Account screen: open a channel, or go to the Studio. Hidden until Channels is switched on. */
export function ChannelEntryCard() {
  const { config } = useChannelsConfig();
  const [handle, setHandle] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!config?.enabled) return;
    api.myChannel().then((r) => setHandle(r.channel?.handle ?? null)).catch(() => setHandle(null));
  }, [config?.enabled]);
  if (!config?.enabled) return null;
  return (
    <Link href="/studio" className="home-card flex items-center gap-3 !rounded-2xl !py-3 text-sm font-semibold text-ink">
      <Clapperboard className="h-5 w-5 text-gold" strokeWidth={1.75} aria-hidden />
      <span className="flex-1">{handle ? <>Creator Studio <span className="font-normal text-ink-500">· @{handle}</span></> : config.channelsOpen === false ? "Creator Studio" : "Start your channel"}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-500/60" strokeWidth={1.75} aria-hidden />
    </Link>
  );
}
