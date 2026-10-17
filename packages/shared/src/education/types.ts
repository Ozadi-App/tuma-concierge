/**
 * Core Domain Types for the Peebee Education Platform
 * Supporting the 5-Tier Education Stream and Cross-Cutting Infrastructure:
 * 1. Sprouts (Kindergarten / Early Childhood, Ages 3-6)
 * 2. Foundations (Primary / Elementary, Ages 6-12)
 * 3. Academy (Secondary / High School, Ages 12-18)
 * 4. Campus (Higher Ed & Self-Paced Business, edX/Udemy Style)
 * 5. Skills (Vocational, Trades & Practical Training)
 */

export type EducationStream = "sprouts" | "foundations" | "academy" | "campus" | "skills";

export type EducationRole =
  | "super_admin"
  | "school_principal"
  | "teacher"
  | "mentor"
  | "parent_guardian"
  | "student";

export interface EducationStreamMeta {
  id: EducationStream;
  title: string;
  tagline: string;
  ageBracket: string;
  icon: string;
  accentColor: string;
  pedagogicalFocus: string;
}

export const EDUCATION_STREAMS: EducationStreamMeta[] = [
  {
    id: "sprouts",
    title: "Sprouts",
    tagline: "Kindergarten & Early Play",
    ageBracket: "Ages 3–6",
    icon: "🌱",
    accentColor: "text-emerald-500",
    pedagogicalFocus: "Audio-first, touch-friendly, visual storybooks, sticker rewards & parental co-play.",
  },
  {
    id: "foundations",
    title: "Foundations",
    tagline: "Primary & Elementary School",
    ageBracket: "Ages 6–12",
    icon: "🎒",
    accentColor: "text-amber-500",
    pedagogicalFocus: "Worksheet photo uploads, parent homework sign-off, gamified flashcards & merit stars.",
  },
  {
    id: "academy",
    title: "Academy",
    tagline: "Secondary & High School",
    ageBracket: "Ages 12–18",
    icon: "🏛️",
    accentColor: "text-indigo-500",
    pedagogicalFocus: "Academic term pacing, timed exams, tab-switch anti-cheat, UNEB grading & report cards.",
  },
  {
    id: "campus",
    title: "Campus",
    tagline: "Higher Ed & Business Courses",
    ageBracket: "Collegiate & Adult",
    icon: "🎓",
    accentColor: "text-blue-500",
    pedagogicalFocus: "Modular syllabus trees, timestamped video notes, double-blind peer review & QR certs.",
  },
  {
    id: "skills",
    title: "Skills",
    tagline: "Vocational & Practical Trades",
    ageBracket: "Apprentices & Artisans",
    icon: "🛠️",
    accentColor: "text-orange-500",
    pedagogicalFocus: "Hands-on video submissions, second-mark timestamp critiques, tool trays & apprentice logbooks.",
  },
];

// ==========================================
// Multi-Tenancy & School Onboarding
// ==========================================

export interface AcademicTerm {
  id: string;
  name: string; // e.g. "Term 1 - 2026", "Fall Semester"
  startDate: string;
  endDate: string;
  midtermBreakStart?: string;
  midtermBreakEnd?: string;
  isCurrent: boolean;
}

export interface InstitutionProfile {
  id: string;
  name: string;
  slug: string;
  subdomain?: string; // e.g. "greenwood.peebee.online"
  motto?: string;
  address: string;
  logoUrl?: string;
  badge?: string;
  verifiedNationalAccreditation: boolean;
  supportedStreams: EducationStream[];
  academicCalendar?: AcademicTerm[];
  contactEmail: string;
  contactPhone: string;
}

// ==========================================
// 1. Sprouts (Ages 3-6)
// ==========================================

export interface SproutsActivity {
  id: string;
  title: string;
  category: "letters" | "numbers" | "shapes" | "storybook" | "coplay";
  durationMinutes: number;
  audioPromptUrl: string;
  characterGuideName: string;
  characterGuideAvatar: string;
  instructionsVoiceover: string;
  stickerRewardId: string;
  stickerRewardTitle: string;
  stickerRewardIcon: string;
  touchInteractionType: "drag_drop" | "audio_tap" | "trace" | "story_read_along";
  gameConfig: {
    targetItems?: string[];
    matchingPairs?: { item: string; match: string }[];
    storyPages?: { pageNumber: number; text: string; audioStartSec: number; audioEndSec: number; imageUrl: string }[];
  };
}

export interface SproutsScreenTimer {
  dailyAllowanceMinutes: number;
  sessionLimitMinutes: number;
  minutesRemainingToday: number;
  sessionMinutesElapsed: number;
  isLocked: boolean;
  parentPinRequiredToUnlock: boolean;
}

export interface SproutsCoPlayPrompt {
  id: string;
  promptTitle: string;
  offlineActionPrompt: string; // e.g. "Find 3 round items in your room and count them together!"
  audioEncouragementUrl?: string;
  parentTip: string;
}

// ==========================================
// 2. Foundations (Ages 6-12)
// ==========================================

export interface FoundationsWorksheet {
  id: string;
  subject: string;
  title: string;
  gradeLevel: string; // "P.1", "P.4", "Grade 3"
  teacherName: string;
  instructions: string;
  maxMeritPoints: number;
  dueDate: string;
  samplePhotoUrl?: string;
}

export interface FoundationsSubmission {
  id: string;
  worksheetId: string;
  worksheetTitle: string;
  subject: string;
  studentId: string;
  studentName: string;
  scannedPhotoUrls: string[];
  parentSigned: boolean;
  parentSignerName?: string;
  parentSignedAt?: string;
  status: "pending_parent" | "submitted" | "graded";
  meritPointsEarned: number;
  teacherRemarks?: string;
  submittedAt: string;
}

export interface FoundationsMeritWallet {
  totalMerits: number;
  currentStreakDays: number;
  punctualityPoints: number;
  teamworkPoints: number;
  recentAwards: { id: string; reason: string; points: number; date: string }[];
}

// ==========================================
// 3. Academy (Ages 12-18)
// ==========================================

export interface AcademyPeriod {
  periodNumber: number;
  startTime: string; // "08:30"
  endTime: string; // "09:30"
  subject: string;
  teacherName: string;
  roomOrLink: string;
}

export interface AcademyTimetableDay {
  dayName: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  periods: AcademyPeriod[];
}

export interface AcademyQuestion {
  id: string;
  questionText: string;
  questionType: "multiple_choice" | "essay" | "formula_math";
  options?: string[];
  maxPoints: number;
}

export interface AcademyExam {
  id: string;
  title: string;
  subject: string;
  term: string;
  durationMinutes: number;
  totalPoints: number;
  isProctored: boolean;
  scheduledWindowStart: string;
  scheduledWindowEnd: string;
  questions: AcademyQuestion[];
}

export interface AcademyExamIntegrityLog {
  examId: string;
  studentId: string;
  tabSwitchCount: number;
  focusLostEvents: { timestamp: string; durationSeconds: number }[];
  isFlaggedForReview: boolean;
}

export interface AcademyReportCardSubject {
  subjectName: string;
  code: string;
  homeworkScorePercent: number; // weight 20%
  midtermScorePercent: number; // weight 30%
  finalExamScorePercent: number; // weight 50%
  weightedTotalPercent: number;
  finalGrade: "D1" | "D2" | "C3" | "C4" | "C5" | "C6" | "P7" | "P8" | "F9";
  teacherComment: string;
}

export interface AcademyTerminalReportCard {
  studentId: string;
  studentName: string;
  term: string;
  academicYear: string;
  homeroomClass: string;
  homeroomTeacher: string;
  attendancePercent: number;
  classRank: string; // e.g. "4 / 45"
  overallWeightedAverage: number;
  subjects: AcademyReportCardSubject[];
  principalRemarks: string;
  publishedAt: string;
}

// ==========================================
// 4. Campus (Collegiate & Self-Paced Business)
// ==========================================

export interface SyllabusUnit {
  id: string;
  title: string;
  durationSeconds: number;
  videoUrl: string;
  isPreview: boolean;
  transcript?: string;
  resources?: { name: string; fileUrl: string; sizeLabel: string }[];
}

export interface SyllabusSection {
  id: string;
  title: string;
  units: SyllabusUnit[];
}

export interface SyllabusModule {
  id: string;
  title: string;
  description: string;
  sections: SyllabusSection[];
}

export interface CampusCourseDetail {
  id: string;
  code: string;
  title: string;
  instructorName: string;
  instructorTitle: string;
  institutionName: string;
  thumbnailUrl: string;
  description: string;
  priceUgx: number;
  rating: number;
  reviewCount: number;
  enrolledStudentsCount: number;
  syllabus: SyllabusModule[];
  hasLiveClassrooms: boolean;
}

export interface VideoTimestampNote {
  id: string;
  unitId: string;
  timestampSeconds: number;
  noteText: string;
  createdAt: string;
}

export interface PeerReviewAssignment {
  id: string;
  capstoneTitle: string;
  studentSubmissionUrl: string;
  rubricCriteria: { name: string; maxScore: number; guidance: string }[];
  peerSubmissionsToReview: {
    anonymousSubmissionId: string;
    studentWorkUrl: string;
    scores: { criteriaName: string; scoreAwarded: number; feedback: string }[];
    isSubmitted: boolean;
  }[];
  isComplete: boolean;
}

export interface CampusVerifiableCredential {
  certificateId: string;
  studentName: string;
  courseTitle: string;
  institutionName: string;
  issuedAt: string;
  verificationHash: string; // SHA-256 tamper-proof
  verificationUrl: string;
  instructorSignatureUrl: string;
  qrCodeData: string;
}

// ==========================================
// 5. Skills (Vocational & Practical Training)
// ==========================================

export type VocationalTrade =
  | "barbering_styling"
  | "catering_culinary"
  | "automotive_mechanics"
  | "craft_welding"
  | "tailoring_fashion"
  | "electrical_wiring";

export interface PracticalToolItem {
  name: string;
  specifications: string;
  isRequired: boolean;
  safetyEquipment: boolean;
  procurementLink?: string;
}

export interface ProcedureRecipeCard {
  stepNumber: number;
  stepTitle: string;
  instruction: string;
  criticalSafetyNote?: string;
  imageUrl?: string;
}

export interface SkillsCourseDetail {
  id: string;
  trade: VocationalTrade;
  tradeLabel: string;
  title: string;
  masterArtisanName: string;
  workshopLocation: string;
  thumbnailUrl: string;
  videoGuideUrl: string;
  toolChecklist: PracticalToolItem[];
  procedureCards: ProcedureRecipeCard[];
  nationalTradeTestStandard: string; // e.g. "DIT Uganda Level 2 UVQF"
}

export interface VideoTimestampCritique {
  id: string;
  timestampSeconds: number;
  instructorName: string;
  critiqueText: string;
  severity: "praise" | "technique_correction" | "safety_warning";
  resolved: boolean;
}

export interface SkillsVideoSubmission {
  id: string;
  studentId: string;
  studentName: string;
  trade: VocationalTrade;
  taskTitle: string;
  videoUrl: string;
  uploadedAt: string;
  durationSeconds: number;
  status: "under_review" | "critiqued" | "approved";
  critiques: VideoTimestampCritique[];
  finalGrade?: string;
}

export interface ApprenticeLogbookEntry {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  practicalHours: number;
  taskPerformed: string;
  workshopLocation: string;
  masterSupervisorName: string;
  supervisorSignatureRecorded: boolean;
  supervisorSignedAt?: string;
}

// ==========================================
// Unified Monetization & Tuition Invoicing
// ==========================================

export interface TuitionInvoice {
  id: string;
  studentId: string;
  studentName: string;
  institutionId: string;
  institutionName: string;
  termName: string;
  totalTuitionUgx: number;
  amountPaidUgx: number;
  balanceUgx: number;
  dueDate: string;
  status: "unpaid" | "partial" | "paid";
  installments: {
    installmentNumber: number;
    amountUgx: number;
    dueDate: string;
    isPaid: boolean;
    paidAt?: string;
  }[];
}

export interface SubscriptionPass {
  id: string;
  name: string;
  stream: EducationStream | "all_access";
  monthlyPriceUgx: number;
  annualPriceUgx: number;
  benefits: string[];
}

// ==========================================
// Communication & Safeguarding
// ==========================================

export interface GuardianAlertMessage {
  id: string;
  studentId: string;
  guardianPhoneNumber: string;
  channel: "sms" | "whatsapp";
  type: "attendance" | "homework_missing" | "tuition_balance" | "urgent_broadcast";
  bodyText: string;
  sentAt: string;
  status: "delivered" | "sent" | "failed";
}

// ==========================================
// Live Meetings (Zoom-Style) & Tutor Chat
// ==========================================

export interface EducationLiveMeeting {
  id: string;
  roomCode: string;
  title: string;
  subject: string;
  stream: EducationStream;
  hostTutorName: string;
  hostTutorAvatar: string;
  hostTutorTitle: string;
  isLiveNow: boolean;
  scheduledFor: string;
  startedAt?: string;
  durationMinutes: number;
  participantCount: number;
  maxParticipants: number;
  whiteboardEnabled: boolean;
  screenShareActive: boolean;
  activeWhiteboardSlideUrl?: string;
  recordingAvailable: boolean;
}

export interface LiveParticipant {
  id: string;
  name: string;
  role: "host" | "tutor" | "ta" | "student" | "parent";
  avatarUrl: string;
  isMuted: boolean;
  isVideoOn: boolean;
  hasHandRaised: boolean;
  isScreenSharing?: boolean;
}

export interface TutorContact {
  id: string;
  name: string;
  title: string;
  subject: string;
  stream: EducationStream;
  avatarUrl: string;
  isOnline: boolean;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export interface LiveChatMessage {
  id: string;
  roomId?: string;
  channelId?: string;
  senderId: string;
  senderName: string;
  senderRole: "tutor" | "student" | "parent" | "system";
  senderAvatar?: string;
  text: string;
  timestamp: string;
  isQuestion?: boolean;
  upvotes?: number;
  isVoiceNote?: boolean;
  voiceDurationSecs?: number;
  attachmentUrl?: string;
}

