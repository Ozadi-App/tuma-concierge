"use client";

import { Check, Flame, Heart, Radio, Send, ShoppingBag, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export interface LiveStreamChannel {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
  category: "groceries" | "stores";
  live_channel_title: string | null;
  live_stream_url: string | null;
  live_viewer_count: number;
}

export interface PinnedProduct {
  id: string;
  title: string;
  price: number;
  compare_at_price?: number;
  image_url?: string;
  badge?: string;
}

interface LiveStreamViewerProps {
  channel: LiveStreamChannel;
  pinnedProduct?: PinnedProduct | null;
  onClose: () => void;
  onAddToCart?: (product: PinnedProduct) => void;
}

const ugx = (val: number) => `UGX ${Number(val).toLocaleString()}`;

export function LiveStreamViewer({
  channel,
  pinnedProduct,
  onClose,
  onAddToCart,
}: LiveStreamViewerProps) {
  const [hearts, setHearts] = useState<number[]>([]);
  const [messages, setMessages] = useState<Array<{ id: string; user: string; text: string; isHost?: boolean }>>([
    {
      id: "m-1",
      user: channel.name,
      text: "Welcome to our live stream! Tap the pinned item below to checkout instantly with free delivery! 🎉",
      isHost: true,
    },
    { id: "m-2", user: "Kato P.", text: "Are the avocado crates fresh from Mbale?" },
    {
      id: "m-3",
      user: channel.name,
      text: "Yes Kato! Freshly delivered this morning at 6 AM, ripe and ready.",
      isHost: true,
    },
    { id: "m-4", user: "Amina K.", text: "Just ordered 2 packs! 🛍️" },
  ]);
  const [inputMsg, setInputMsg] = useState("");
  const [viewerCount, setViewerCount] = useState(channel.live_viewer_count || 142);
  const [showCheckoutDrawer, setShowCheckoutDrawer] = useState(false);
  const [addedNotice, setAddedNotice] = useState(false);

  // Subtle viewer count fluctuation
  useEffect(() => {
    const timer = setInterval(() => {
      setViewerCount((prev) => prev + (Math.random() > 0.5 ? 1 : -1));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  function handleSendChat() {
    if (!inputMsg.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        user: "You",
        text: inputMsg.trim(),
      },
    ]);
    setInputMsg("");
  }

  function handleTapHeart() {
    setHearts((prev) => [...prev, Date.now()]);
    setTimeout(() => {
      setHearts((prev) => prev.slice(1));
    }, 1400);
  }

  function handleQuickBuy() {
    if (pinnedProduct && onAddToCart) {
      onAddToCart(pinnedProduct);
      setAddedNotice(true);
      setTimeout(() => setAddedNotice(false), 2000);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${channel.name} live stream`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-0 sm:p-4 backdrop-blur-md"
    >
      <div className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-black text-white sm:h-[90vh] sm:rounded-[32px] sm:border sm:border-white/10 sm:shadow-2xl">
        {/* Video Player */}
        <div className="absolute inset-0">
          {channel.live_stream_url ? (
            <video
              src={channel.live_stream_url}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-neutral-900">
              <span className="text-6xl animate-pulse">📹</span>
            </div>
          )}
          {/* Subtle gradient vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60" />
        </div>

        {/* Top Header / Host Bar */}
        <div className="relative z-20 flex items-center justify-between p-4 pt-12 sm:pt-4">
          <div className="flex items-center gap-2.5 rounded-full bg-black/45 p-1.5 pr-3.5 backdrop-blur-md border border-white/15">
            <div className="relative h-9 w-9 overflow-hidden rounded-full bg-neutral-800">
              {channel.logo_url ? (
                <img src={channel.logo_url} alt={channel.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-gold">
                  {channel.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-bold text-xs leading-tight text-white drop-shadow">{channel.name}</h3>
              <p className="flex items-center gap-1 text-[10px] text-white/80">
                <Users className="h-2.5 w-2.5 text-gold" />
                <span>{viewerCount} watching</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md animate-pulse">
              <Radio className="h-3 w-3" /> LIVE
            </span>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-md transition hover:bg-black/75 active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Channel Stream Title */}
        {channel.live_channel_title && (
          <div className="relative z-20 px-4">
            <span className="inline-block rounded-xl bg-black/40 px-3 py-1.5 text-xs font-semibold text-white/95 backdrop-blur-sm border border-white/10">
              {channel.live_channel_title}
            </span>
          </div>
        )}

        {/* Live Floating Reactions Track */}
        <div className="pointer-events-none absolute bottom-44 right-4 z-20 flex flex-col items-center">
          {hearts.map((id) => (
            <div
              key={id}
              className="animate-bounce text-2xl text-red-500 transition duration-1000"
              style={{
                transform: `translateX(${(id % 3 - 1) * 12}px)`,
              }}
            >
              ❤️
            </div>
          ))}
        </div>

        {/* Live Comments Overlay */}
        <div className="relative z-20 mt-auto px-4 pb-2">
          <div className="max-h-40 space-y-1.5 overflow-y-auto no-scrollbar mask-gradient">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex items-start gap-1.5 rounded-xl px-2.5 py-1 text-xs backdrop-blur-sm ${
                  m.isHost
                    ? "bg-gold/25 border border-gold/40 text-gold-200"
                    : "bg-black/40 text-white/90 border border-white/10"
                }`}
              >
                <span className={`font-bold ${m.isHost ? "text-gold" : "text-white/80"}`}>
                  {m.user}:
                </span>
                <span className="leading-snug">{m.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pinned Product Card with 1-Tap Checkout */}
        {pinnedProduct && (
          <div className="relative z-20 px-4 py-2">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-900/90 p-2.5 backdrop-blur-lg border border-gold/40 shadow-xl">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-neutral-800">
                  {pinnedProduct.image_url ? (
                    <img
                      src={pinnedProduct.image_url}
                      alt={pinnedProduct.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg">🛍️</div>
                  )}
                  {pinnedProduct.badge && (
                    <span className="absolute top-0 left-0 rounded-br-lg bg-gold px-1.5 py-0.5 text-[8px] font-black text-ink-gold uppercase">
                      {pinnedProduct.badge}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-0.5 rounded-full bg-gold/20 px-1.5 py-0.2 text-[9px] font-black text-gold uppercase">
                      <Flame className="h-2.5 w-2.5" /> Pinned
                    </span>
                  </div>
                  <h4 className="font-bold text-xs leading-tight text-white truncate mt-0.5">
                    {pinnedProduct.title}
                  </h4>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="font-mono text-xs font-black text-gold">
                      {ugx(pinnedProduct.price)}
                    </span>
                    {pinnedProduct.compare_at_price && (
                      <span className="font-mono text-[10px] text-white/50 line-through">
                        {ugx(pinnedProduct.compare_at_price)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleQuickBuy}
                  className="flex items-center gap-1 rounded-full bg-gold px-3.5 py-2 text-xs font-black text-ink-gold shadow-md transition active:scale-95"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>{addedNotice ? "Added! ✓" : "Buy 1-Tap"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Input & Reactions Bar */}
        <div className="relative z-20 flex items-center gap-2 p-4 pt-1 pb-6 sm:pb-4 border-t border-white/10 bg-black/60 backdrop-blur-md">
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
            placeholder="Ask host or comment…"
            className="flex-1 rounded-full bg-white/10 px-4 py-2.5 text-xs text-white placeholder:text-white/50 border border-white/15 focus:border-gold focus:outline-none"
          />

          <button
            onClick={handleSendChat}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-95"
          >
            <Send className="h-4 w-4" />
          </button>

          <button
            onClick={handleTapHeart}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600/90 text-white shadow-md transition hover:bg-red-600 active:scale-90"
          >
            <Heart className="h-4.5 w-4.5 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
}
