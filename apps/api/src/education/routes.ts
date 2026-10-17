import { Hono } from "hono";
import {
  EDUCATION_STREAMS,
  DEMO_INSTITUTIONS,
  DEMO_SPROUTS_ACTIVITIES,
  DEMO_SPROUTS_TIMER,
  DEMO_SPROUTS_COPLAY,
  DEMO_FOUNDATIONS_WORKSHEETS,
  DEMO_FOUNDATIONS_SUBMISSIONS,
  DEMO_FOUNDATIONS_MERITS,
  DEMO_ACADEMY_TIMETABLE,
  DEMO_ACADEMY_EXAM,
  DEMO_ACADEMY_REPORT_CARD,
  DEMO_CAMPUS_COURSE,
  DEMO_CAMPUS_PEER_REVIEW,
  DEMO_CAMPUS_CREDENTIAL,
  DEMO_SKILLS_COURSE,
  DEMO_SKILLS_SUBMISSION,
  DEMO_SKILLS_LOGBOOK,
  DEMO_TUITION_INVOICE,
  DEMO_SUBSCRIPTION_PASSES,
  DEMO_GUARDIAN_ALERTS,
  DEMO_LIVE_MEETINGS,
  DEMO_LIVE_PARTICIPANTS,
  DEMO_TUTOR_CONTACTS,
  DEMO_LIVE_CHAT_MESSAGES,
} from "@peebee/shared";

export const educationRoutes = new Hono();

// In-memory runtime state for submissions and updates
const inMemorySubmissions: any[] = [...DEMO_FOUNDATIONS_SUBMISSIONS];
const inMemorySkillsSubmissions: any[] = [{ ...DEMO_SKILLS_SUBMISSION }];
const inMemoryCritiques: any[] = [...DEMO_SKILLS_SUBMISSION.critiques];
const inMemoryLogbook: any[] = [...DEMO_SKILLS_LOGBOOK];
let inMemoryTuition = { ...DEMO_TUITION_INVOICE };
const inMemoryLiveMeetings: any[] = [...DEMO_LIVE_MEETINGS];
const inMemoryChatMessages: any[] = [...DEMO_LIVE_CHAT_MESSAGES];
const inMemoryTutors: any[] = [...DEMO_TUTOR_CONTACTS];

// ----------------------------------------------------
// Streams & Institutions
// ----------------------------------------------------
educationRoutes.get("/streams", (c) => {
  return c.json({ ok: true, streams: EDUCATION_STREAMS });
});

educationRoutes.get("/institutions", (c) => {
  return c.json({ ok: true, institutions: DEMO_INSTITUTIONS });
});

educationRoutes.get("/institutions/:slug", (c) => {
  const slug = c.req.param("slug");
  const inst = DEMO_INSTITUTIONS.find((i) => i.slug === slug || i.id === slug) || DEMO_INSTITUTIONS[0];
  return c.json({ ok: true, institution: inst });
});

// ----------------------------------------------------
// 1. Sprouts (Ages 3-6)
// ----------------------------------------------------
educationRoutes.get("/sprouts/activities", (c) => {
  return c.json({
    ok: true,
    activities: DEMO_SPROUTS_ACTIVITIES,
    screenTimer: DEMO_SPROUTS_TIMER,
    coPlayPrompt: DEMO_SPROUTS_COPLAY,
  });
});

educationRoutes.post("/sprouts/timer/unlock", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const pin = body.pin;
  if (pin === "1234" || pin === "0000") {
    return c.json({ ok: true, unlocked: true, message: "Screen timer unlocked by parent PIN." });
  }
  return c.json({ ok: false, unlocked: false, message: "Invalid parent PIN." }, 400);
});

// ----------------------------------------------------
// 2. Foundations (Ages 6-12)
// ----------------------------------------------------
educationRoutes.get("/foundations/worksheets", (c) => {
  return c.json({
    ok: true,
    worksheets: DEMO_FOUNDATIONS_WORKSHEETS,
    submissions: inMemorySubmissions,
    meritWallet: DEMO_FOUNDATIONS_MERITS,
  });
});

educationRoutes.post("/foundations/worksheets/submit", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { worksheetId, scannedPhotoUrls, parentPin, parentSignerName } = body;

  const ws = DEMO_FOUNDATIONS_WORKSHEETS.find((w) => w.id === worksheetId) || DEMO_FOUNDATIONS_WORKSHEETS[0];
  const newSub = {
    id: `sub_${Date.now()}`,
    worksheetId: ws.id,
    worksheetTitle: ws.title,
    subject: ws.subject,
    studentId: "stud_timothy",
    studentName: "Timothy Mukasa",
    scannedPhotoUrls: Array.isArray(scannedPhotoUrls) && scannedPhotoUrls.length > 0 ? scannedPhotoUrls : [ws.samplePhotoUrl || ""],
    parentSigned: Boolean(parentPin),
    parentSignerName: parentSignerName || "Parent Guardian",
    parentSignedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    status: "submitted",
    meritPointsEarned: ws.maxMeritPoints,
    teacherRemarks: "Submission received. Pending teacher review.",
    submittedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
  };

  inMemorySubmissions.unshift(newSub);
  return c.json({ ok: true, submission: newSub });
});

// ----------------------------------------------------
// 3. Academy (Ages 12-18)
// ----------------------------------------------------
educationRoutes.get("/academy/dashboard", (c) => {
  return c.json({
    ok: true,
    timetable: DEMO_ACADEMY_TIMETABLE,
    activeExam: DEMO_ACADEMY_EXAM,
    reportCard: DEMO_ACADEMY_REPORT_CARD,
  });
});

educationRoutes.post("/academy/exam/submit", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { tabSwitchCount, focusLossEventsCount } = body;

  // Grade multiple choice / formula answers mock
  let scorePercent = 88;
  if (tabSwitchCount > 2) {
    scorePercent = Math.max(50, scorePercent - tabSwitchCount * 5);
  }

  return c.json({
    ok: true,
    scorePercent,
    passed: scorePercent >= 60,
    tabSwitchCount: tabSwitchCount || 0,
    message: tabSwitchCount > 0
      ? `Exam submitted. ${tabSwitchCount} tab switch events flagged for teacher audit.`
      : "Exam submitted successfully with perfect focus integrity.",
  });
});

// ----------------------------------------------------
// 4. Campus (Higher Ed & Business)
// ----------------------------------------------------
educationRoutes.get("/campus/course", (c) => {
  return c.json({
    ok: true,
    course: DEMO_CAMPUS_COURSE,
    peerReview: DEMO_CAMPUS_PEER_REVIEW,
    credential: DEMO_CAMPUS_CREDENTIAL,
  });
});

educationRoutes.post("/campus/notes", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json({ ok: true, noteId: `note_${Date.now()}`, saved: true });
});

educationRoutes.post("/campus/peer-review/submit", async (c) => {
  return c.json({ ok: true, isComplete: true, message: "Peer review feedback submitted." });
});

// ----------------------------------------------------
// 5. Skills (Vocational & Practical)
// ----------------------------------------------------
educationRoutes.get("/skills/course", (c) => {
  return c.json({
    ok: true,
    course: DEMO_SKILLS_COURSE,
    submission: {
      ...inMemorySkillsSubmissions[0],
      critiques: inMemoryCritiques,
    },
    logbook: inMemoryLogbook,
  });
});

educationRoutes.post("/skills/practical/submit", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const newSub = {
    id: `vid_sub_${Date.now()}`,
    studentId: "stud_denis",
    studentName: "Denis Kigozi",
    trade: body.trade || "barbering_styling",
    taskTitle: body.taskTitle || "Practical Skill Demonstration",
    videoUrl: body.videoUrl || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    uploadedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    durationSeconds: body.durationSeconds || 120,
    status: "under_review",
    critiques: [],
  };
  inMemorySkillsSubmissions.unshift(newSub);
  return c.json({ ok: true, submission: newSub });
});

educationRoutes.post("/skills/critiques", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const critique = {
    id: `crit_${Date.now()}`,
    timestampSeconds: Number(body.timestampSeconds) || 30,
    instructorName: body.instructorName || "Master Artisan",
    critiqueText: body.critiqueText || "Good technique executed here.",
    severity: body.severity || "technique_correction",
    resolved: true,
  };
  inMemoryCritiques.push(critique);
  return c.json({ ok: true, critique });
});

educationRoutes.post("/skills/logbook", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const entry = {
    id: `log_${Date.now()}`,
    studentId: "stud_denis",
    studentName: "Denis Kigozi",
    date: body.date || new Date().toISOString().slice(0, 10),
    practicalHours: Number(body.practicalHours) || 4.0,
    taskPerformed: body.taskPerformed || "Workshop practical training session",
    workshopLocation: body.workshopLocation || "Peebee Barber Studio",
    supervisorName: body.supervisorName || "Master Alex Mukasa",
    supervisorSignatureRecorded: true,
    supervisorSignedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
  };
  inMemoryLogbook.unshift(entry);
  return c.json({ ok: true, entry });
});

// ----------------------------------------------------
// Tuition & Billing
// ----------------------------------------------------
educationRoutes.get("/tuition", (c) => {
  return c.json({
    ok: true,
    invoice: inMemoryTuition,
    passes: DEMO_SUBSCRIPTION_PASSES,
    guardianAlerts: DEMO_GUARDIAN_ALERTS,
  });
});

educationRoutes.post("/tuition/pay", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const amount = Number(body.amountUgx) || 100000;
  const newPaid = inMemoryTuition.amountPaidUgx + amount;
  const newBalance = Math.max(0, inMemoryTuition.totalTuitionUgx - newPaid);

  inMemoryTuition = {
    ...inMemoryTuition,
    amountPaidUgx: newPaid,
    balanceUgx: newBalance,
    status: newBalance <= 0 ? "paid" : "partial",
  };

  return c.json({
    ok: true,
    receiptId: `REC_PB_${Date.now()}`,
    newBalanceUgx: newBalance,
    status: inMemoryTuition.status,
  });
});

// ----------------------------------------------------
// Live Meetings (Zoom-Style)
// ----------------------------------------------------
educationRoutes.get("/live/meetings", (c) => {
  const stream = c.req.query("stream");
  const filtered = stream
    ? inMemoryLiveMeetings.filter((m) => m.stream === stream)
    : inMemoryLiveMeetings;
  const activeMeeting = inMemoryLiveMeetings.find((m) => m.isLiveNow) || inMemoryLiveMeetings[0];
  return c.json({
    ok: true,
    meetings: filtered,
    activeMeeting,
  });
});

educationRoutes.get("/live/meetings/:id", (c) => {
  const id = c.req.param("id");
  const meeting = inMemoryLiveMeetings.find((m) => m.id === id || m.roomCode === id) || inMemoryLiveMeetings[0];
  const messages = inMemoryChatMessages.filter((msg) => msg.roomId === meeting.id || !msg.roomId);
  return c.json({
    ok: true,
    meeting,
    participants: DEMO_LIVE_PARTICIPANTS,
    messages,
  });
});

// ----------------------------------------------------
// Live Chat with Tutors & Classroom Channels
// ----------------------------------------------------
educationRoutes.get("/chat/tutors", (c) => {
  const stream = c.req.query("stream");
  const filtered = stream
    ? inMemoryTutors.filter((t) => t.stream === stream)
    : inMemoryTutors;
  return c.json({
    ok: true,
    tutors: filtered,
  });
});

educationRoutes.get("/chat/messages", (c) => {
  const id = c.req.query("id");
  const filtered = id
    ? inMemoryChatMessages.filter((m) => m.roomId === id || m.channelId === id || m.senderId === id)
    : inMemoryChatMessages;
  return c.json({
    ok: true,
    messages: filtered.length > 0 ? filtered : inMemoryChatMessages,
  });
});

educationRoutes.post("/chat/send", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const newMessage = {
    id: `msg_${Date.now()}`,
    roomId: body.roomId,
    channelId: body.channelId,
    senderId: body.senderId || "part_student_current",
    senderName: body.senderName || "Denis Kigozi",
    senderRole: body.senderRole || "student",
    text: body.text || "",
    timestamp: "Just now",
    isQuestion: Boolean(body.isQuestion),
    upvotes: 0,
    isVoiceNote: Boolean(body.isVoiceNote),
    voiceDurationSecs: body.voiceDurationSecs,
    attachmentUrl: body.attachmentUrl,
  };
  inMemoryChatMessages.push(newMessage);
  return c.json({
    ok: true,
    message: newMessage,
  });
});
