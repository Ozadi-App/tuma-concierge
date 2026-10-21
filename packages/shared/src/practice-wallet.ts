/**
 * The customer's wallet in practice mode: a browser-local balance that starts loaded with sample credit
 * and really goes down when a practice booking pays from it. Nothing here touches the real wallet.
 */

type Json = Record<string, any>;
const KEY = "peebee_practice_wallet_v1";
/** What every practice account starts with. Practice credit is not real money and resets when practice ends. */
export const PRACTICE_WALLET_START_UGX = 2_000_000;

type Entry = { id: string; type: "topup" | "order_payment" | "refund"; amount: number; balanceAfter: number; note: string; at: string };
type Wallet = { balance: number; ledger: Entry[] };

function fresh(): Wallet {
  return { balance: PRACTICE_WALLET_START_UGX, ledger: [{ id: "practice-wallet-start", type: "topup", amount: PRACTICE_WALLET_START_UGX, balanceAfter: PRACTICE_WALLET_START_UGX, note: "Practice credit", at: new Date().toISOString() }] };
}

function load(): Wallet {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Wallet | null;
    if (parsed && typeof parsed.balance === "number" && Array.isArray(parsed.ledger)) return parsed;
  } catch { /* a corrupt practice wallet is disposable */ }
  const wallet = fresh();
  save(wallet);
  return wallet;
}
function save(wallet: Wallet) { try { window.localStorage.setItem(KEY, JSON.stringify(wallet)); } catch { /* storage full or blocked */ } }

export function practiceWalletBalance(): number { return load().balance; }

/** Takes money from the practice wallet. Returns false (and changes nothing) when it can't cover it. */
export function practiceWalletSpend(amount: number, note: string): boolean {
  const wallet = load();
  if (amount > wallet.balance) return false;
  wallet.balance -= amount;
  wallet.ledger.unshift({ id: `pw-${Date.now().toString(36)}`, type: "order_payment", amount: -amount, balanceAfter: wallet.balance, note, at: new Date().toISOString() });
  save(wallet);
  return true;
}

export function practiceWalletRefund(amount: number, note: string) {
  const wallet = load();
  wallet.balance += amount;
  wallet.ledger.unshift({ id: `pw-${Date.now().toString(36)}`, type: "refund", amount, balanceAfter: wallet.balance, note, at: new Date().toISOString() });
  save(wallet);
}

/** The body of GET /v1/wallet. */
export function practiceWalletView(): Json {
  const wallet = load();
  return {
    balance: wallet.balance, cap: 5_000_000, verified: true,
    ledger: wallet.ledger.map((e) => ({
      id: e.id, user_id: "practice-user", type: e.type, amount: e.amount, balance_after: e.balanceAfter, order_id: null, topup_id: null,
      counterparty_id: null, counterparty_name: null, actor_id: null, actor_name: null, note: e.note, created_at: e.at,
    })),
  };
}

export function resetPracticeWallet() {
  try { window.localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
