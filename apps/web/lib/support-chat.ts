/**
 * Support chat adapter. The UI in components/SupportChat.tsx only talks to `supportChat`.
 * To go live, replace `mockAdapter` with one that calls the real AI and the agent queue
 * (e.g. a Worker endpoint plus a websocket for agent messages). Nothing else needs to change.
 */
export type Sender = "user" | "ai" | "agent" | "system";
export type ChatMessage = { id: string; from: Sender; text: string; at: number; agentName?: string };
export type HandoffEvent =
  | { type: "queued" }
  | { type: "joined"; agentName: string }
  | { type: "message"; message: ChatMessage }
  | { type: "ended" };

export interface SupportChatAdapter {
  /** Ask the AI assistant. Resolves with its reply. */
  askAI(text: string, history: ChatMessage[]): Promise<ChatMessage>;
  /** Ask for a person. Calls `on` as the handoff progresses; returns a function that cancels it. */
  requestAgent(history: ChatMessage[], on: (e: HandoffEvent) => void): () => void;
  /** Send a message to the person once they have joined. */
  sendToAgent(text: string): Promise<void>;
  /** Leave the person and go back to the AI. */
  endAgent(): void;
}

const uid = () => Math.random().toString(36).slice(2, 10);
export const msg = (from: Sender, text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id: uid(), from, text, at: Date.now(), ...extra });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CANNED: [RegExp, string][] = [
  [/track|order|where|deliver|rider/i, "You can follow any order or trip live in the Peebee app under Orders. Tap the order to see where it is and to chat with the person handling it. If something looks wrong, tell me the order number and I can pass it to the team."],
  [/pay|wallet|momo|airtel|mtn|money|top ?up|refund/i, "Peebee runs on one wallet. You top it up from MTN MoMo or Airtel Money, and what a job costs is held in escrow until it is done. You release it with your four-digit PIN. For a missing payment or refund, a person on the team can look at your account."],
  [/partner|earn|join|driver|rider|sell|restaurant|teach/i, "Great! Every kind of partner has its own page on Peebee Partners that explains sign-up, how work reaches you and how you get paid. Open the Partners site from the menu, or tell me what you do and I will point you to the right page."],
  [/person|human|agent|someone/i, "Of course. Tap \"Talk to a person\" at the top and I will hand you over to the support team."],
];

export const mockAdapter: SupportChatAdapter = {
  async askAI(text) {
    await wait(900 + Math.random() * 600);
    const hit = CANNED.find(([re]) => re.test(text));
    return msg("ai", hit ? hit[1] : "Thanks, I have noted that. I can help with orders and trips, the wallet and payments, or becoming a partner. If you would rather talk it through with someone, tap \"Talk to a person\".");
  },
  requestAgent(_h, on) {
    const timers: ReturnType<typeof setTimeout>[] = [];
    on({ type: "queued" });
    timers.push(setTimeout(() => on({ type: "joined", agentName: "Support agent" }), 2600));
    timers.push(setTimeout(() => on({ type: "message", message: msg("agent", "Hello, I am from the Peebee support team and I have read your chat so far. How can I help?", { agentName: "Support agent" }) }), 3800));
    return () => timers.forEach(clearTimeout);
  },
  async sendToAgent() {
    /* demo: the mock agent does not reply further */
  },
  endAgent() {},
};

export const supportChat: SupportChatAdapter = mockAdapter;
