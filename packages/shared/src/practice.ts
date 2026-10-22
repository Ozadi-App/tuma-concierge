export const PRACTICE_MODE_STORAGE_KEY = "peebee_practice_mode";

/** Whether this device is currently inside the practice world. Kept here (not in the runtime) so light code can ask. */
export function isPracticeStorageOn(): boolean {
  try { return typeof window !== "undefined" && window.localStorage.getItem(PRACTICE_MODE_STORAGE_KEY) === "1"; } catch { return false; }
}

export type PracticeRole = "customer" | "rider" | "restaurant" | "merchant" | "gas" | "learner";

export type PracticeStep = {
  title: string;
  description: string;
  actionLabel: string;
  resultLabel: string;
};

export type PracticeJourney = {
  roleLabel: string;
  heading: string;
  introduction: string;
  sampleAmount: string;
  completionMessage: string;
  steps: PracticeStep[];
};

/** Guided, browser-local scenarios. They deliberately contain no IDs or
 * callbacks into the operational API: completing one can never create an
 * order, move a balance, notify another person, or reach a provider. */
export const PRACTICE_JOURNEYS: Record<PracticeRole, PracticeJourney> = {
  customer: {
    roleLabel: "Customer",
    heading: "Practise placing an order",
    introduction: "Follow a complete sample order from shopping list to delivery. Nothing here is sent to a real rider.",
    sampleAmount: "UGX 32,000",
    completionMessage: "You completed a customer order without spending real money.",
    steps: [
      { title: "Review your shopping list", description: "Your sample basket contains rice, cooking oil and tomatoes, plus the delivery fee.", actionLabel: "Confirm sample list", resultLabel: "Sample list confirmed" },
      { title: "Match with a rider", description: "The simulator finds a training rider and shows how assignment normally appears.", actionLabel: "Find a practice rider", resultLabel: "Practice rider assigned" },
      { title: "Approve Mobile Money", description: "See the same payment checkpoint as a live order, but no prompt is sent to your phone.", actionLabel: "Simulate payment approval", resultLabel: "Simulated payment successful" },
      { title: "Track shopping and delivery", description: "The sample order moves through shopping, pickup and delivery without contacting anyone.", actionLabel: "Advance sample delivery", resultLabel: "Rider arrived at the destination" },
      { title: "Confirm handover", description: "Confirm receipt just as you would when the real rider gives you the items.", actionLabel: "Confirm sample delivery", resultLabel: "Practice order completed" },
    ],
  },
  rider: {
    roleLabel: "Rider",
    heading: "Practise completing a delivery",
    introduction: "Work through a sample job, merchant purchase and customer handover without affecting your real account.",
    sampleAmount: "UGX 35,000 order · UGX 5,000 earnings",
    completionMessage: "You completed a rider job and earned simulated funds.",
    steps: [
      { title: "Review and claim the job", description: "Check the pickup, destination, order value and delivery earnings before accepting.", actionLabel: "Claim practice job", resultLabel: "Practice job assigned to you" },
      { title: "Start shopping", description: "Open the sample list and mark that you have arrived at the shopping location.", actionLabel: "Start sample shopping", resultLabel: "Shopping stage started" },
      { title: "Pay a merchant", description: "Enter the sample outlet code and confirm the purchase amount. No merchant receives money.", actionLabel: "Simulate merchant payment", resultLabel: "Merchant handover confirmed" },
      { title: "Deliver to the customer", description: "Advance the job to arrival and verify the sample customer handover.", actionLabel: "Confirm sample handover", resultLabel: "Customer received the order" },
      { title: "Review your earnings", description: "See how delivery earnings appear in the rider wallet after settlement.", actionLabel: "Settle practice job", resultLabel: "UGX 5,000 added to the practice wallet" },
    ],
  },
  restaurant: {
    roleLabel: "Restaurant",
    heading: "Practise preparing an order",
    introduction: "Process a sample food order from acceptance through rider handover without changing your menu or live orders.",
    sampleAmount: "UGX 42,000",
    completionMessage: "You completed the restaurant fulfilment flow using a sample order.",
    steps: [
      { title: "Review the incoming order", description: "Check the sample customer, food items, options, total and collection method.", actionLabel: "Open sample order", resultLabel: "Order details reviewed" },
      { title: "Accept the order", description: "Confirm that the restaurant can prepare the sample items.", actionLabel: "Accept sample order", resultLabel: "Customer notified in the simulation" },
      { title: "Prepare the food", description: "Move the sample order into preparation while the training rider is assigned.", actionLabel: "Start preparation", resultLabel: "Sample order is being prepared" },
      { title: "Mark it ready", description: "Signal that the packaged order is ready for the rider to collect.", actionLabel: "Mark sample order ready", resultLabel: "Practice rider notified" },
      { title: "Confirm rider handover", description: "Verify the sample rider and complete the pickup without moving real funds.", actionLabel: "Confirm sample pickup", resultLabel: "Restaurant fulfilment completed" },
    ],
  },
  merchant: {
    roleLabel: "Merchant",
    heading: "Practise accepting a Peebee payment",
    introduction: "Confirm a sample rider purchase, watch the balance update and request a simulated settlement.",
    sampleAmount: "UGX 28,000",
    completionMessage: "You completed a merchant sale and simulated settlement without moving real money.",
    steps: [
      { title: "Receive a payment request", description: "A training rider presents an order-linked request for goods at your sample outlet.", actionLabel: "Open sample request", resultLabel: "Order and rider details displayed" },
      { title: "Verify the amount", description: "Compare the sample request with the goods before handing anything over.", actionLabel: "Verify UGX 28,000", resultLabel: "Amount matched" },
      { title: "Confirm goods handover", description: "Use dual confirmation to acknowledge that the training rider received the goods.", actionLabel: "Confirm sample handover", resultLabel: "Simulated payment available" },
      { title: "Review the merchant balance", description: "See how a confirmed sale moves into the available merchant balance.", actionLabel: "View sample balance", resultLabel: "Available balance: UGX 28,000" },
      { title: "Request settlement", description: "Run the withdrawal experience against a mock destination. No Mobile Money transfer is sent.", actionLabel: "Simulate settlement", resultLabel: "Practice settlement successful" },
    ],
  },
  gas: {
    roleLabel: "Fuel Attendant",
    heading: "Practise dispensing fuel to a rider",
    introduction: "Scan a rider's code, verify motorcycle plate number, pump fuel and issue a simulated digital receipt.",
    sampleAmount: "UGX 20,000 (3.67 Litres)",
    completionMessage: "You completed the fuel dispensing and verification flow without real fuel or money.",
    steps: [
      { title: "Scan or enter code", description: "Rider presents a 6-digit PIN or QR code at the pump lane.", actionLabel: "Verify sample code", resultLabel: "Rider Okello Ronald (UFE 429K) verified" },
      { title: "Select fuel & amount", description: "Choose Unleaded Petrol or Diesel and enter litres or whole UGX.", actionLabel: "Set 3.67 L / UGX 20,000", resultLabel: "Pump calculations confirmed" },
      { title: "Dispense and confirm", description: "Pump the fuel and tap dispense to generate the digital receipt.", actionLabel: "Complete dispense", resultLabel: "Receipt RCP-GAS generated" },
      { title: "Review shift summary", description: "Check your station's daily pump shift counter and litre tally.", actionLabel: "View shift report", resultLabel: "Shift total updated with 3.67 Litres" },
    ],
  },
  learner: {
    roleLabel: "Learner & Student",
    heading: "Practise interactive learning across 5 streams",
    introduction: "Explore live Zoom-style classrooms, parent homework sign-off, anti-cheat exam halls, tutor chat, and trade critique pins without affecting real school records.",
    sampleAmount: "5 Streams · 1 Live Room · 4 Tutors",
    completionMessage: "You completed the comprehensive learning module sandbox journey across all 5 streams.",
    steps: [
      {
        title: "Early Play Phonics & Sticker Book (Sprouts)",
        description: "Listen to Kigo the Crane's Luganda/English phonics narration and unlock digital animal stickers with safe screen timer controls.",
        actionLabel: "Complete Sprouts phonics session",
        resultLabel: "Golden Lion sticker unlocked in album",
      },
      {
        title: "Homework Photo Scan & Parent PIN Sign-Off (Basics)",
        description: "Scan a handwritten exercise worksheet and verify the turn-in using parent digital signature PIN.",
        actionLabel: "Simulate homework sign-off",
        resultLabel: "Worksheet verified · +25 Merit Stars earned",
      },
      {
        title: "Anti-Cheat UNEB Mock Exam Hall (Academy)",
        description: "Experience proctored timed examination simulation with automated tab-switch violation detection and weighted terminal report cards.",
        actionLabel: "Submit mock examination",
        resultLabel: "Score 88% (D1) · Term report card published",
      },
      {
        title: "Zoom-Style Live Classroom & Whiteboard",
        description: "Join Dr. Kenneth's live interactive masterclass, test raise hand audio alerts, and review the double-entry reconciliation whiteboard diagram.",
        actionLabel: "Enter live video classroom",
        resultLabel: "Whiteboard diagram reviewed · Question upvoted",
      },
      {
        title: "Direct Tutor Chat & Voice Note Simulator",
        description: "Send questions to assigned tutors, listen to voice note explanations, and share homework attachments in a safeguarded channel.",
        actionLabel: "Send tutor inquiry",
        resultLabel: "Dr. Kenneth replied with voice note (0:24)",
      },
      {
        title: "Capstone Peer Review & Verifiable Credential (Compass)",
        description: "Score anonymized peer capstone projects against instructor rubrics and generate a cryptographically signed LinkedIn-ready certificate.",
        actionLabel: "Verify credential certificate",
        resultLabel: "SHA-256 certificate verified with QR code",
      },
      {
        title: "Practical Video Critique & Apprentice Logbook (Skills)",
        description: "Review second-mark instructor critique pins on barbering video submissions and record on-the-job training hours signed by the master artisan.",
        actionLabel: "Record 4 apprentice hours",
        resultLabel: "Master Alex Mukasa signed the digital logbook",
      },
    ],
  },
};
