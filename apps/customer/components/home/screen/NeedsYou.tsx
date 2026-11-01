"use client";

import type { FeeProposal, OrderRow } from "@peebee/shared";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../../lib/api";
import { isFeeProposalSeen, markFeeProposalSeen } from "../../../lib/fee-proposal-seen";
import { useTranslate } from "../../../lib/i18n";
import { formatUgx, orderTitle, stageLabel, stageProgressPct } from "../../../lib/order-display";
import { HomeSection, HomeStatus, homePanel } from "./HomeSection";

type OrderPayload = { order: OrderRow | null; proposal: FeeProposal | null };
type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: OrderPayload };

export function NeedsYou() {
  const t = useTranslate();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedProposal, setDismissedProposal] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .getActiveOrder()
      .then((res) => {
        if (live) setState({ status: "ready", data: { order: res.activeOrder, proposal: res.pendingFeeProposal } });
      })
      .catch((err) => {
        if (live) setState({ status: "error", message: errorMessage(err) });
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  if (state.status === "loading") {
    return (
      <HomeSection title={t("home_needs_you")}>
        <HomeStatus kind="loading" title={t("home_order_loading")} />
      </HomeSection>
    );
  }
  if (state.status === "error") {
    return (
      <HomeSection title={t("home_needs_you")}>
        <HomeStatus kind="error" title={state.message || t("home_order_error")} onRetry={() => { setState({ status: "loading" }); setAttempt((n) => n + 1); }} retryLabel={t("rider_retry")} />
      </HomeSection>
    );
  }

  const { order, proposal } = state.data;
  const showProposal = Boolean(order && proposal && proposal.id !== dismissedProposal && !isFeeProposalSeen(proposal.id));
  if (!order && !showProposal) return null;

  async function decide(approve: boolean) {
    if (!order || !proposal) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.decideFeeProposal(order.id, proposal.id, approve);
      markFeeProposalSeen(proposal.id);
      setDismissedProposal(proposal.id);
    } catch (err) {
      setActionError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <HomeSection title={t("home_needs_you")}>
      <div className="space-y-3">
        {showProposal && order && proposal && (
          <div className={`${homePanel} space-y-3 border-l-4 border-l-gold p-4`}>
            <p className="text-base text-ink">
              {t("fee_proposal_suggests")} <strong>{formatUgx(proposal.proposed_total - ((order.final_total ?? order.estimated_total ?? 0) - (order.delivery_fee ?? 0)))}</strong>{" "}
              <span className="text-ink-500">
                ({t("fee_proposal_was")} {formatUgx(order.delivery_fee ?? 0)})
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => decide(true)} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-gold px-4 text-base font-bold text-ink-gold disabled:opacity-60">
                {t("accept")}
              </button>
              <button type="button" disabled={busy} onClick={() => decide(false)} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] px-4 text-base font-bold text-ink disabled:opacity-60">
                {t("reject")}
              </button>
              <Link href={`/orders/${order.id}`} onClick={() => markFeeProposalSeen(proposal.id)} className="inline-flex min-h-11 items-center px-3 text-base font-semibold text-ink">
                {t("view")}
              </Link>
            </div>
            {actionError && <p role="alert" className="text-sm font-semibold text-ink">{actionError}</p>}
          </div>
        )}
        {order && <OrderCard order={order} />}
      </div>
    </HomeSection>
  );
}

function OrderCard({ order }: { order: OrderRow }) {
  const t = useTranslate();
  const needsPayment = order.stage === "Match" && order.payment_rail === "escrow" && !!order.rider_id;
  const progress = stageProgressPct(order.stage);
  return (
    <Link href={needsPayment ? `/orders/${order.id}/pay` : `/orders/${order.id}`} className={`${homePanel} block overflow-hidden`}>
      <span className="flex">
        <span className={`w-1.5 shrink-0 ${needsPayment ? "bg-gold" : "bg-[rgb(var(--surface-muted))]"}`} aria-hidden />
        <span className="min-w-0 flex-1 space-y-3 px-4 py-4">
          <span className="flex items-start justify-between gap-2">
            <span className="text-base font-bold leading-snug text-ink">{orderTitle(order)}</span>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold ${needsPayment ? "bg-gold/15 text-ink" : "bg-[rgb(var(--surface-muted))] text-ink"}`}>
              {needsPayment ? t("active_order_payment_needed") : stageLabel(order.stage, order.type, order.is_ride === 1)}
            </span>
          </span>
          {needsPayment && <span className="block text-sm font-medium text-ink">{t("active_order_ready_pay")}</span>}
          <span className="flex items-center gap-3">
            <span
              className="h-2 flex-1 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("home_order_progress")}
            >
              <span className="block h-full rounded-full bg-gold" style={{ width: `${progress}%` }} />
            </span>
            {order.eta_minutes != null && <span className="shrink-0 text-sm font-bold text-ink">~{order.eta_minutes} min</span>}
          </span>
          {order.destination_area && (
            <span className="flex items-center gap-1.5 text-sm text-ink-500">
              <MapPin className="h-4 w-4 shrink-0 text-gold" aria-hidden />
              <span>
                {t("active_order_heading_to")} {order.destination_area}
              </span>
            </span>
          )}
          <span className="inline-flex min-h-11 items-center text-base font-bold text-ink">{needsPayment ? t("active_order_payment_needed") : t("active_order_track")}</span>
        </span>
      </span>
    </Link>
  );
}
