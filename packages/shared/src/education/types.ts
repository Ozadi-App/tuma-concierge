/**
 * Core Domain Types for the Peebee Learn platform.
 *
 * Five learning streams, one shape of content:
 *
 *   School / academy / tutor  →  Class (or masterclass)  →  Course  →  Module  →  Lesson
 *
 * 1. Sprouts      — kindergarten and early childhood, ages 3–6
 * 2. Foundations  — primary school, ages 6–12
 * 3. Academy      — secondary and senior high school, ages 12–18
 * 4. Compass      — university and college students
 * 5. Skills       — everyday learners: vocational and practical trades, tutorials
 *                   and informal subjects
 */

export type EducationStream = "sprouts" | "foundations" | "academy" | "compass" | "skills";
export type EducationStreamId = EducationStream;

/** Every stream, in the order learners climb them. */
export const EDUCATION_STREAM_IDS: readonly EducationStream[] = ["sprouts", "foundations", "academy", "compass", "skills"];

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
    tagline: "Kindergarten & early play",
    ageBracket: "Ages 3–6",
    icon: "🌱",
    accentColor: "text-gold",
    pedagogicalFocus: "Audio-first, touch-friendly, visual storybooks, sticker rewards & parental co-play.",
  },
  {
    id: "foundations",
    title: "Foundations",
    tagline: "Primary school",
    ageBracket: "Ages 6–12",
    icon: "🎒",
    accentColor: "text-gold",
    pedagogicalFocus: "Worksheet photo uploads, parent homework sign-off, gamified flashcards & merit stars.",
  },
  {
    id: "academy",
    title: "Academy",
    tagline: "Secondary & senior high school",
    ageBracket: "Ages 12–18",
    icon: "🏛️",
    accentColor: "text-gold",
    pedagogicalFocus: "Term pacing, timed exams, tab-switch anti-cheat, national and international exam prep & report cards.",
  },
  {
    id: "compass",
    title: "Compass",
    tagline: "University & college",
    ageBracket: "University students",
    icon: "🎓",
    accentColor: "text-gold",
    pedagogicalFocus: "Modular syllabus trees, timestamped video notes, double-blind peer review & verifiable certificates.",
  },
  {
    id: "skills",
    title: "Skills",
    tagline: "Learn anything practical",
    ageBracket: "Everyone",
    icon: "🛠️",
    accentColor: "text-gold",
    pedagogicalFocus: "Vocational trades, how-to tutorials and informal subjects: video submissions, timestamped critiques, tool trays & logbooks.",
  },
];

/** Accepts a stream id saved by an older build ("campus" became "compass"). */
export function normalizeStream(value: unknown, fallback: EducationStream = "foundations"): EducationStream {
  if (value === "campus") return "compass";
  return typeof value === "string" && (EDUCATION_STREAM_IDS as readonly string[]).includes(value) ? (value as EducationStream) : fallback;
}

// ==========================================
// Classes, levels and syllabus frameworks
// ==========================================

/** A class is a fixed cohort (Primary 4 Blue, S.4 Sciences). A masterclass is a short, focused programme anyone can join. */
export type ClassKind = "class" | "masterclass";

export type CurriculumFramework =
  | "uganda_ecd"
  | "uganda_primary"
  | "uneb_olevel"
  | "uneb_alevel"
  | "cambridge_primary"
  | "cambridge_igcse"
  | "cambridge_a_level"
  | "ib_pyp"
  | "ib_myp"
  | "ib_diploma"
  | "kenya_cbc"
  | "university_credit"
  | "professional_certificate"
  | "uvqf_tvet"
  | "open_syllabus";

export interface CurriculumFrameworkMeta {
  id: CurriculumFramework;
  label: string;
  /** Streams this syllabus is normally taught in. */
  streams: EducationStream[];
}

export const CURRICULUM_FRAMEWORKS: CurriculumFrameworkMeta[] = [
  { id: "uganda_ecd", label: "Uganda ECD Framework", streams: ["sprouts"] },
  { id: "uganda_primary", label: "Uganda Primary Curriculum (NCDC)", streams: ["foundations"] },
  { id: "cambridge_primary", label: "Cambridge Primary", streams: ["foundations"] },
  { id: "ib_pyp", label: "IB Primary Years (PYP)", streams: ["sprouts", "foundations"] },
  { id: "kenya_cbc", label: "Kenya CBC", streams: ["sprouts", "foundations", "academy"] },
  { id: "uneb_olevel", label: "UNEB O-Level (UCE)", streams: ["academy"] },
  { id: "uneb_alevel", label: "UNEB A-Level (UACE)", streams: ["academy"] },
  { id: "cambridge_igcse", label: "Cambridge IGCSE", streams: ["academy"] },
  { id: "cambridge_a_level", label: "Cambridge A-Level", streams: ["academy"] },
  { id: "ib_myp", label: "IB Middle Years (MYP)", streams: ["academy"] },
  { id: "ib_diploma", label: "IB Diploma", streams: ["academy"] },
  { id: "university_credit", label: "University credit course", streams: ["compass"] },
  { id: "professional_certificate", label: "Professional certificate", streams: ["compass", "skills"] },
  { id: "uvqf_tvet", label: "Vocational & TVET (UVQF)", streams: ["skills"] },
  { id: "open_syllabus", label: "Own syllabus", streams: ["sprouts", "foundations", "academy", "compass", "skills"] },
];

/** The class / grade names each stream offers, used to pre-fill the class builder. */
export const STREAM_LEVELS: Record<EducationStream, string[]> = {
  sprouts: ["Baby class (3 yrs)", "Middle class (4 yrs)", "Top class (5–6 yrs)"],
  foundations: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Primary 7"],
  academy: ["Senior 1", "Senior 2", "Senior 3", "Senior 4 (O-Level)", "Senior 5 (A-Level)", "Senior 6 (A-Level)"],
  compass: ["Year 1", "Year 2", "Year 3", "Year 4", "Postgraduate", "Short course"],
  skills: ["Beginner", "Intermediate", "Advanced", "Masterclass"],
};

export function frameworksForStream(stream: EducationStream): CurriculumFrameworkMeta[] {
  return CURRICULUM_FRAMEWORKS.filter((f) => f.streams.includes(stream));
}

export interface SchoolClass {
  id: string;
  /** The school, academy or tutor that runs the class. */
  schoolId: string;
  stream: EducationStream;
  kind: ClassKind;
  /** "Primary 4 Blue", "S.4 Sciences", "Barbering Intensive". */
  name: string;
  /** Grade or level from STREAM_LEVELS, or free text. */
  level: string;
  framework: CurriculumFramework;
  academicYear: string;
  term?: string;
  teacherName: string;
  capacity: number;
  enrolled: number;
  summary: string;
  courseIds: string[];
}

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

export interface QuizQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  points: number;
}

export interface CourseQuiz {
  id: string;
  title: string;
  instructions: string;
  timeLimitMinutes: number;
  passingScorePercent: number;
  questions: QuizQuestion[];
}

export interface CourseLesson {
  id: string;
  title: string;
  durationMinutes: number;
  contentType: "video" | "audio_story" | "reading" | "interactive_h5p" | "practical_demo";
  summary: string;
  contentUrl?: string;
  downloadableResources?: { name: string; url: string; size: string }[];
  quiz?: CourseQuiz;
  worksheetPrompt?: string;
  practicalChecklist?: string[];
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: CourseLesson[];
  moduleQuiz?: CourseQuiz;
}

export interface CreatorCourse {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  creatorRoleTitle: string;
  institutionName: string;
  title: string;
  stream: EducationStream;
  category: string;
  level: string; // "Kindergarten" | "P.4 Primary" | "S.4 O-Level" | "Collegiate" | "Vocational Apprentice"
  summary: string;
  thumbnailUrl: string;
  priceUgx: number; // 0 for term-tuition or free intro
  /** The class this course is taught in. */
  classId?: string;
  /** Syllabus the course follows. */
  framework?: CurriculumFramework;
  /** What a learner can do after finishing, one line each. */
  outcomes?: string[];
  enrolledStudentsCount: number;
  rating: number;
  reviewCount: number;
  modules: CourseModule[];
}

export interface CreatorProfile {
  id: string;
  name: string;
  handle: string;
  type: "school" | "academy" | "vocational_guild" | "independent_tutor" | "early_childhood_center";
  leadInstructor: string;
  leadInstructorTitle: string;
  avatarUrl: string;
  bannerUrl?: string;
  tagline: string;
  bio: string;
  location: string;
  badge?: string; // e.g. "UNEB Center No. U0842", "DIT & UVQF Certified", "MoES Registered"
  stream: EducationStream;
  supportedStreams: EducationStream[];
  enrolledStudents: number;
  rating: number;
  reviewCount: number;
  courses: CreatorCourse[];
  /** Classes and masterclasses the school runs. */
  classes?: SchoolClass[];
  tuitionFeeUgx?: number;
  tuitionCadence?: "term" | "course" | "monthly";
  payoutBalanceUgx: number;
  totalEarningsUgx: number;
  isVerified: boolean;
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
  creatorId?: string;
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
// 4. Compass (Collegiate & Self-Paced Business)
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

export interface CompassCourseDetail {
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

export interface CompassVerifiableCredential {
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

