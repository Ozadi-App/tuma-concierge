"use client";

import type { CustomerWallet, WalletShares } from "@peebee/shared";
import { ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useTranslate } from "../../../lib/i18n";
import { formatUgx } from "../../../lib/order-display";
import { HomeSection, HomeStatus, homePanel } from "./HomeSection";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "ready"; wallet: CustomerWallet; shares: WalletShares | null; sharesFailed: boolean };

export function HomeWallet() {
  const t = useTranslate();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let live = true;
    Promise.all([api.getWallet().then((wallet) => ({ wallet, ok: true as const })).catch(() => ({ wallet: null, ok: false as const })), api.getWalletShares().then((shares) => ({ shares, ok: true as const })).catch(() => ({ shares: null, ok: false as const }))]).then(
      ([walletResult, shareResult]) => {
        if (!live) return;
        if (!walletResult.ok || !walletResult.wallet) {
          setState(walletResult.ok ? { status: "empty" } : { status: "error" });
          return;
        }
        setState({
          status: "ready",
          wallet: walletResult.wallet,
          shares: shareResult.ok ? shareResult.shares : null,
          sharesFailed: !shareResult.ok,
        });
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  };

  return (
    <HomeSection title={t("nav_wallet")} sectionId="wallet">
      {state.status === "loading" && <HomeStatus kind="loading" title={t("home_wallet_loading")} />}
      {state.status === "error" && <HomeStatus kind="error" title={t("home_wallet_error")} onRetry={retry} retryLabel={t("rider_retry")} />}
      {state.status === "empty" && <HomeStatus kind="empty" title={t("home_wallet_empty")} />}
      {state.status === "ready" && (
        <div className="space-y-3">
          <div className={`${homePanel} space-y-4 p-4`}>
            <div className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgb(var(--surface-muted))] text-ink">
                  <Wallet className="h-5 w-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink-500">{t("wallet_escrow_title")}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-ink">
                    <ShieldCheck className="h-4 w-4 text-gold" aria-hidden />
                    {t("wallet_protected")}
                  </span>
                </span>
              </span>
              <Link href="/wallet" className="inline-flex min-h-11 items-center rounded-full bg-gold px-4 text-sm font-bold text-ink-gold">
                {t("wallet_top_up")}
              </Link>
            </div>
            <div className="flex items-end justify-between gap-3">
              <p>
                <span className="block text-2xl font-bold tracking-tight text-ink">{formatUgx(state.wallet.balance)}</span>
                <span className="mt-1 block text-sm text-ink-500">
                  {t("wallet_cap")}: {formatUgx(state.wallet.cap)}
                  {state.wallet.verified ? ` · ${t("wallet_verified")}` : ""}
                </span>
              </p>
              <Link href="/wallet" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink">
                {t("wallet_details")}
              </Link>
            </div>
          </div>
          {state.sharesFailed && <HomeStatus kind="error" title={t("home_wallet_shares_error")} onRetry={retry} retryLabel={t("rider_retry")} />}
          {state.shares && <ShareNotes shares={state.shares} />}
        </div>
      )}
    </HomeSection>
  );
}

function ShareNotes({ shares }: { shares: WalletShares }) {
  const t = useTranslate();
  const received = shares.received.filter((item) => item.status === "active");
  const granted = shares.granted.filter((item) => item.status === "active" || item.status === "pending");
  if (received.length === 0 && granted.length === 0) return null;
  return (
    <ul className={`${homePanel} divide-y divide-[var(--border-faint)] px-4`}>
      {received.map((share) => (
        <li key={share.id}>
          <Link href="/wallet" className="flex min-h-12 items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold text-ink">{share.owner_name}</span>
              <span className="block text-sm text-ink-500">{t("wallet_family_pool")}</span>
            </span>
            <span className="shrink-0 text-sm font-bold text-ink">
              {share.owner_balance != null ? formatUgx(share.owner_balance) : t("wallet_shared_balance_hidden")}
            </span>
          </Link>
        </li>
      ))}
      {granted.length > 0 && (
        <li>
          <Link href="/wallet" className="flex min-h-12 items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block text-base font-semibold text-ink">{t("wallet_staff_family_access")}</span>
              <span className="block truncate text-sm text-ink-500">{granted.map((item) => item.grantee_name).join(", ")}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-ink">{t("wallet_manage")}</span>
          </Link>
        </li>
      )}
    </ul>
  );
}
