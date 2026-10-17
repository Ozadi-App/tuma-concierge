import type {
  InstitutionProfile,
  SproutsActivity,
  SproutsScreenTimer,
  SproutsCoPlayPrompt,
  FoundationsWorksheet,
  FoundationsSubmission,
  FoundationsMeritWallet,
  AcademyTimetableDay,
  AcademyExam,
  AcademyTerminalReportCard,
  CampusCourseDetail,
  PeerReviewAssignment,
  CampusVerifiableCredential,
  SkillsCourseDetail,
  SkillsVideoSubmission,
  ApprenticeLogbookEntry,
  TuitionInvoice,
  SubscriptionPass,
  GuardianAlertMessage,
  EducationLiveMeeting,
  LiveParticipant,
  TutorContact,
  LiveChatMessage,
} from "./types.js";

// ==========================================
// Demo Institutions
// ==========================================

export const DEMO_INSTITUTIONS: InstitutionProfile[] = [
  {
    id: "inst_greenwood",
    name: "Greenwood International Academy",
    slug: "greenwood",
    subdomain: "greenwood",
    motto: "Excellence in Knowledge & Character",
    address: "Plot 14 Lugogo Bypass, Kampala, Uganda",
    logoUrl: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=120&q=80",
    badge: "UNEB Center No. U0842",
    verifiedNationalAccreditation: true,
    supportedStreams: ["foundations", "academy"],
    contactEmail: "registrar@greenwood.ac.ug",
    contactPhone: "+256 701 555 120",
    academicCalendar: [
      {
        id: "term_1_2026",
        name: "Term 1 — 2026",
        startDate: "2026-02-02",
        endDate: "2026-05-01",
        midtermBreakStart: "2026-03-16",
        midtermBreakEnd: "2026-03-20",
        isCurrent: true,
      },
    ],
  },
  {
    id: "inst_nakawa_vti",
    name: "Kampala Vocational & Trades Institute",
    slug: "nakawa-vti",
    subdomain: "nakawa-vti",
    motto: "Skills that Build the Nation",
    address: "Nakawa Industrial Area, Jinja Road, Kampala",
    logoUrl: "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=120&q=80",
    badge: "DIT & UVQF Certified",
    verifiedNationalAccreditation: true,
    supportedStreams: ["skills"],
    contactEmail: "director@nakawavti.ug",
    contactPhone: "+256 772 444 890",
  },
  {
    id: "inst_peebee_campus",
    name: "Peebee Global Institute & Executive School",
    slug: "peebee-campus",
    subdomain: "campus",
    motto: "Empowering Next-Generation Digital Leaders",
    address: "Innovation Village, Ntinda, Kampala",
    logoUrl: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=120&q=80",
    badge: "Licensed Higher Certifications",
    verifiedNationalAccreditation: true,
    supportedStreams: ["campus", "sprouts"],
    contactEmail: "admissions@peebee.ac.ug",
    contactPhone: "+256 312 999 800",
  },
];

// ==========================================
// 1. Sprouts Demo Data (Ages 3-6)
// ==========================================

export const DEMO_SPROUTS_ACTIVITIES: SproutsActivity[] = [
  {
    id: "sprout_1",
    title: "Letter Safari: Vowel Sounds",
    category: "letters",
    durationMinutes: 4,
    audioPromptUrl: "/audio/sprouts/letter-safari.mp3",
    characterGuideName: "Kigo the Lion Cub",
    characterGuideAvatar: "🦁",
    instructionsVoiceover: "Tap each floating fruit to feed Kigo and hear the letter sound!",
    stickerRewardId: "sticker_golden_lion",
    stickerRewardTitle: "Golden Lion Cub",
    stickerRewardIcon: "⭐🦁",
    touchInteractionType: "drag_drop",
    gameConfig: {
      targetItems: ["A", "E", "I", "O", "U"],
      matchingPairs: [
        { item: "🍎", match: "A" },
        { item: "🥚", match: "E" },
        { item: "🦎", match: "I" },
        { item: "🍊", match: "O" },
        { item: "☂️", match: "U" },
      ],
    },
  },
  {
    id: "sprout_2",
    title: "Shapes Around the Compound",
    category: "shapes",
    durationMinutes: 5,
    audioPromptUrl: "/audio/sprouts/shapes-compound.mp3",
    characterGuideName: "Ami the Crowned Crane",
    characterGuideAvatar: "🦩",
    instructionsVoiceover: "Help Ami sort the matooke baskets into circles and the shields into triangles!",
    stickerRewardId: "sticker_crowned_crane",
    stickerRewardTitle: "Crowned Crane Badge",
    stickerRewardIcon: "🎖️🪶",
    touchInteractionType: "audio_tap",
    gameConfig: {
      targetItems: ["Circle", "Triangle", "Square", "Star"],
    },
  },
  {
    id: "sprout_3",
    title: "Read-Along: The Little Boda That Could",
    category: "storybook",
    durationMinutes: 6,
    audioPromptUrl: "/audio/sprouts/little-boda.mp3",
    characterGuideName: "Boda Bobo",
    characterGuideAvatar: "🛵",
    instructionsVoiceover: "Follow the bouncing star as the story plays!",
    stickerRewardId: "sticker_super_boda",
    stickerRewardTitle: "Super Boda Rider",
    stickerRewardIcon: "🛵✨",
    touchInteractionType: "story_read_along",
    gameConfig: {
      storyPages: [
        {
          pageNumber: 1,
          text: "Once upon a sunny morning in Kampala, little Bobo the Boda zoomed through Kololo hill.",
          audioStartSec: 0,
          audioEndSec: 5,
          imageUrl: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=400&q=80",
        },
        {
          pageNumber: 2,
          text: "He had a basket of fresh golden mangoes to deliver to Grandmother by the lake.",
          audioStartSec: 5,
          audioEndSec: 11,
          imageUrl: "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=400&q=80",
        },
        {
          pageNumber: 3,
          text: "Beep beep! All the animals cheered as Bobo crossed the friendly bridge on time!",
          audioStartSec: 11,
          audioEndSec: 16,
          imageUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&q=80",
        },
      ],
    },
  },
];

export const DEMO_SPROUTS_TIMER: SproutsScreenTimer = {
  dailyAllowanceMinutes: 30,
  sessionLimitMinutes: 20,
  minutesRemainingToday: 18,
  sessionMinutesElapsed: 12,
  isLocked: false,
  parentPinRequiredToUnlock: true,
};

export const DEMO_SPROUTS_COPLAY: SproutsCoPlayPrompt = {
  id: "coplay_fruits",
  promptTitle: "Parent & Child Offline Activity",
  offlineActionPrompt: "Together with your parent, go to the kitchen and find 2 round items. Count them together aloud!",
  parentTip: "Tactile offline connection helps bridge 2D visual screen concepts to real-world sensory development.",
};

// ==========================================
// 2. Foundations Demo Data (Ages 6-12)
// ==========================================

export const DEMO_FOUNDATIONS_WORKSHEETS: FoundationsWorksheet[] = [
  {
    id: "ws_p4_math",
    subject: "Mathematics",
    title: "Primary 4: Fractions and Ugandan Shilling Word Problems",
    gradeLevel: "Primary 4",
    teacherName: "Tr. Kenneth Ochieng",
    instructions: "Complete all 6 sums neatly in your homework exercise book. Take a clear, bright top-down photo and obtain parent signature.",
    maxMeritPoints: 25,
    dueDate: "Tomorrow at 5:00 PM",
    samplePhotoUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "ws_p5_sci",
    subject: "Integrated Science",
    title: "Primary 5: Parts of a Flowering Plant & Seed Germination",
    gradeLevel: "Primary 5",
    teacherName: "Tr. Brenda Namutebi",
    instructions: "Draw and label a bean seed embryo. Write 3 conditions necessary for germination in complete sentences.",
    maxMeritPoints: 20,
    dueDate: "Friday at 4:00 PM",
  },
];

export const DEMO_FOUNDATIONS_SUBMISSIONS: FoundationsSubmission[] = [
  {
    id: "sub_001",
    worksheetId: "ws_p4_math",
    worksheetTitle: "Primary 4: Fractions and Shilling Word Problems",
    subject: "Mathematics",
    studentId: "stud_timothy",
    studentName: "Timothy Mukasa",
    scannedPhotoUrls: [
      "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=600&q=80",
    ],
    parentSigned: true,
    parentSignerName: "Grace Mukasa (Mother)",
    parentSignedAt: "2026-10-16 19:42",
    status: "graded",
    meritPointsEarned: 24,
    teacherRemarks: "Excellent working out on the market fruit budget problem! Keep your margins neat.",
    submittedAt: "2026-10-16 19:45",
  },
];

export const DEMO_FOUNDATIONS_MERITS: FoundationsMeritWallet = {
  totalMerits: 380,
  currentStreakDays: 14,
  punctualityPoints: 160,
  teamworkPoints: 120,
  recentAwards: [
    { id: "m1", reason: "Early Homework Submission (Math)", points: 15, date: "Yesterday" },
    { id: "m2", reason: "Perfect Score in Spelling Bee", points: 25, date: "3 days ago" },
    { id: "m3", reason: "Clean Exercise Book Presentation", points: 10, date: "5 days ago" },
  ],
};

// ==========================================
// 3. Academy Demo Data (Ages 12-18)
// ==========================================

export const DEMO_ACADEMY_TIMETABLE: AcademyTimetableDay[] = [
  {
    dayName: "Monday",
    periods: [
      { periodNumber: 1, startTime: "08:00", endTime: "09:20", subject: "Pure Mathematics (UCE)", teacherName: "Mr. Kenneth Ochieng", roomOrLink: "Lab 3" },
      { periodNumber: 2, startTime: "09:30", endTime: "10:40", subject: "Physics & Mechanics", teacherName: "Dr. Paul Habimana", roomOrLink: "Physics Hall" },
      { periodNumber: 3, startTime: "11:00", endTime: "12:15", subject: "English Literature", teacherName: "Ms. Sarah Kyomugisha", roomOrLink: "Room 12B" },
      { periodNumber: 4, startTime: "14:00", endTime: "15:30", subject: "Chemistry Practicals", teacherName: "Mrs. Brenda Namutebi", roomOrLink: "Science Lab 1" },
    ],
  },
  {
    dayName: "Tuesday",
    periods: [
      { periodNumber: 1, startTime: "08:00", endTime: "09:20", subject: "Biology & Human Anatomy", teacherName: "Mrs. Brenda Namutebi", roomOrLink: "Room 14" },
      { periodNumber: 2, startTime: "09:30", endTime: "10:40", subject: "Geography of East Africa", teacherName: "Mr. Alex Mukasa", roomOrLink: "Room 8" },
      { periodNumber: 3, startTime: "11:00", endTime: "12:15", subject: "Economics & Entrepreneurship", teacherName: "Mr. Kenneth Ochieng", roomOrLink: "Hall A" },
    ],
  },
];

export const DEMO_ACADEMY_EXAM: AcademyExam = {
  id: "exam_uace_math_01",
  title: "Senior 4 UNEB Mock Examination: Mathematics Paper 1",
  subject: "Pure Mathematics",
  term: "Term 1 — 2026",
  durationMinutes: 90,
  totalPoints: 100,
  isProctored: true,
  scheduledWindowStart: "2026-10-18 09:00",
  scheduledWindowEnd: "2026-10-18 17:00",
  questions: [
    {
      id: "q1",
      questionType: "multiple_choice",
      questionText: "Given that f(x) = 2x² - 5x + 3, find the roots of f(x) = 0.",
      options: ["x = 1, x = 1.5", "x = 2, x = -3", "x = -1, x = 2.5", "x = 0.5, x = 3"],
      maxPoints: 5,
    },
    {
      id: "q2",
      questionType: "formula_math",
      questionText: "Calculate the exact derivative d/dx [ 3x³ - 4sin(x) + e^(2x) ]. Show step-by-step differentiation.",
      maxPoints: 15,
    },
    {
      id: "q3",
      questionType: "essay",
      questionText: "A trader borrows UGX 4,500,000 from a commercial bank at 18% compound interest per annum. Calculate the total repayment after 3 years.",
      maxPoints: 20,
    },
  ],
};

export const DEMO_ACADEMY_REPORT_CARD: AcademyTerminalReportCard = {
  studentId: "stud_esther",
  studentName: "Esther Nabirye",
  term: "Term 1",
  academicYear: "2026",
  homeroomClass: "Senior 4 East",
  homeroomTeacher: "Mr. Kenneth Ochieng",
  attendancePercent: 98.5,
  classRank: "3 / 46",
  overallWeightedAverage: 88.4,
  subjects: [
    { subjectName: "Pure Mathematics", code: "MAT401", homeworkScorePercent: 92, midtermScorePercent: 86, finalExamScorePercent: 90, weightedTotalPercent: 89.2, finalGrade: "D1", teacherComment: "Outstanding analytical thinking in calculus and algebra." },
    { subjectName: "Physics", code: "PHY402", homeworkScorePercent: 88, midtermScorePercent: 84, finalExamScorePercent: 86, weightedTotalPercent: 85.8, finalGrade: "D1", teacherComment: "Thorough understanding of electrical circuitry and dynamics." },
    { subjectName: "Chemistry", code: "CHM403", homeworkScorePercent: 85, midtermScorePercent: 82, finalExamScorePercent: 84, weightedTotalPercent: 83.6, finalGrade: "D2", teacherComment: "Good lab technique. Review volumetric titration formulas." },
    { subjectName: "English Language", code: "ENG404", homeworkScorePercent: 90, midtermScorePercent: 92, finalExamScorePercent: 88, weightedTotalPercent: 89.6, finalGrade: "D1", teacherComment: "Eloquent argumentative essays and rich vocabulary." },
  ],
  principalRemarks: "Esther has shown exemplary academic dedication and leadership as assistant class prefect. Promoted to S.5 with Distinction.",
  publishedAt: "2026-05-02",
};

// ==========================================
// 4. Campus Demo Data (Higher Ed & Business)
// ==========================================

export const DEMO_CAMPUS_COURSE: CampusCourseDetail = {
  id: "course_fintech_growth",
  code: "MKT-802",
  title: "FinTech Product Growth, Unit Economics & Mobile Money In Africa",
  instructorName: "Dr. Kenneth Ochieng",
  instructorTitle: "Former Head of Digital Channels, Stanbic Bank & FinTech Fellow",
  institutionName: "Peebee Global Institute & Executive School",
  thumbnailUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80",
  description: "Master modern product growth loops, customer acquisition cost (CAC), LTV modeling, and mobile money API architectures in East African tech ecosystems.",
  priceUgx: 180000,
  rating: 4.96,
  reviewCount: 312,
  enrolledStudentsCount: 1420,
  hasLiveClassrooms: true,
  syllabus: [
    {
      id: "mod_1",
      title: "Module 1: The East African Mobile Money Rail & Settlement Architectures",
      description: "Understanding MTN MoMo, Airtel Money, switch aggregators, and escrow safeguarding.",
      sections: [
        {
          id: "sec_1_1",
          title: "Section 1: Architecture of Instant Telecommunications Wallets",
          units: [
            {
              id: "unit_1_1_1",
              title: "1.1 Introduction: From SMS Stored Value to Open APIs",
              durationSeconds: 740,
              videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
              isPreview: true,
              transcript: "Mobile money in East Africa operates fundamentally as a mobile network operator ledger. In this lecture, we dissect transaction signing...",
              resources: [
                { name: "Financial_Model_Template.xlsx", fileUrl: "/downloads/fintech-model.xlsx", sizeLabel: "2.4 MB" },
                { name: "MoMo_API_Architecture_Slides.pdf", fileUrl: "/downloads/momo-arch.pdf", sizeLabel: "6.1 MB" },
              ],
            },
            {
              id: "unit_1_1_2",
              title: "1.2 Float Management, Agent Liquidity & Merchant Fees",
              durationSeconds: 980,
              videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
              isPreview: false,
            },
          ],
        },
      ],
    },
  ],
};

export const DEMO_CAMPUS_PEER_REVIEW: PeerReviewAssignment = {
  id: "peer_review_capstone",
  capstoneTitle: "FinTech Merchant Settlement Capstone Proposal",
  studentSubmissionUrl: "https://peebee.online/cdn/capstones/esther-fintech-proposal.pdf",
  rubricCriteria: [
    { name: "Unit Economics Validity", maxScore: 10, guidance: "Are CAC, LTV, and payback periods logically derived with local UGX benchmarks?" },
    { name: "Regulatory Compliance", maxScore: 10, guidance: "Does the architecture address Bank of Uganda NPS Act guidelines?" },
    { name: "Technical Feasibility", maxScore: 10, guidance: "Is the webhook reconciliation and idempotency flow robust?" },
  ],
  peerSubmissionsToReview: [
    {
      anonymousSubmissionId: "peer_sub_891",
      studentWorkUrl: "https://peebee.online/cdn/capstones/anon_891.pdf",
      scores: [
        { criteriaName: "Unit Economics Validity", scoreAwarded: 9, feedback: "Great conservative churn assumptions." },
        { criteriaName: "Regulatory Compliance", scoreAwarded: 8, feedback: "Ensure AML reporting thresholds are cited." },
        { criteriaName: "Technical Feasibility", scoreAwarded: 10, feedback: "Solid signature verification diagram." },
      ],
      isSubmitted: true,
    },
  ],
  isComplete: false,
};

export const DEMO_CAMPUS_CREDENTIAL: CampusVerifiableCredential = {
  certificateId: "PB-CERT-2026-89410",
  studentName: "Esther Nabirye",
  courseTitle: "FinTech Product Growth, Unit Economics & Mobile Money In Africa",
  institutionName: "Peebee Global Institute & Executive School",
  issuedAt: "October 16, 2026",
  verificationHash: "e8b1d98a0f443b2f8e02d64a781b0a5135fae19b882361d76378ef8a9f3901b4",
  verificationUrl: "https://peebee.online/verify/cert/PB-CERT-2026-89410",
  instructorSignatureUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=200&q=80",
  qrCodeData: "PB-VERIFIED:PB-CERT-2026-89410:e8b1d98a",
};

// ==========================================
// 5. Skills Demo Data (Vocational & Practical)
// ==========================================

export const DEMO_SKILLS_COURSE: SkillsCourseDetail = {
  id: "skill_barbering_mastery",
  trade: "barbering_styling",
  tradeLabel: "Master Barbering & Precision Fades",
  title: "Professional Barbering: Skin Taper Fades & Beard Sculpting",
  masterArtisanName: "Master Alex Mukasa",
  workshopLocation: "Peebee Studio, Acacia Mall, Kisementi",
  thumbnailUrl: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80",
  videoGuideUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  nationalTradeTestStandard: "Directorate of Industrial Training (DIT) Level 2 — UVQF Hairdressing",
  toolChecklist: [
    { name: "Professional Cordless Clipper", specifications: "Adjustable taper lever (0.5mm - 3.5mm)", isRequired: true, safetyEquipment: false },
    { name: "Guard Set (#0.5 to #4)", specifications: "Magnetic or snap-on precision guides", isRequired: true, safetyEquipment: false },
    { name: "Detail T-Blade Trimmer", specifications: "Zero-gapped for clean hairline contouring", isRequired: true, safetyEquipment: false },
    { name: "Barbicide & Clipper Spray", specifications: "Hospital-grade disinfectant spray (5-in-1)", isRequired: true, safetyEquipment: true },
    { name: "Sanitary Neck Strips", specifications: "Elastic tissue hygiene strips", isRequired: true, safetyEquipment: true },
  ],
  procedureCards: [
    { stepNumber: 1, stepTitle: "Hygiene & Client Consultation", instruction: "Apply clean neck strip. Sanitize clipper blades in front of client. Confirm desired fade height.", criticalSafetyNote: "Inspect scalp for abrasions or foliculitis prior to cutting." },
    { stepNumber: 2, stepTitle: "Establishing the Baseline", instruction: "Use trimmer to cut the baseline guideline around the parietal ridge. Clean bulk hair underneath with foil shaver.", criticalSafetyNote: "Keep wrist light; avoid digging edge into sensitive neck folds." },
    { stepNumber: 3, stepTitle: "Graduating the Blend", instruction: "Lever open on clipper: create 1-inch guideline. Switch to #1 guard half-open to softly buff into crown bulk." },
    { stepNumber: 4, stepTitle: "Detailing & Edge Finishing", instruction: "Zero-gap trimmer for temple taper and sharp, square front lineup. Dust with talc powder." },
  ],
};

export const DEMO_SKILLS_SUBMISSION: SkillsVideoSubmission = {
  id: "vid_sub_920",
  studentId: "stud_denis",
  studentName: "Denis Kigozi",
  trade: "barbering_styling",
  taskTitle: "Execution of Low Skin Fade with Tapered Neckline",
  videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  uploadedAt: "2026-10-15 14:20",
  durationSeconds: 165,
  status: "critiqued",
  finalGrade: "A- (Competent with Distinction)",
  critiques: [
    {
      id: "crit_1",
      timestampSeconds: 42,
      instructorName: "Master Alex Mukasa",
      critiqueText: "Great smooth hand motion while setting the initial bald guideline. Notice how clean the ear clearance is.",
      severity: "praise",
      resolved: true,
    },
    {
      id: "crit_2",
      timestampSeconds: 88,
      instructorName: "Master Alex Mukasa",
      critiqueText: "Angle the corner teeth of your blade slightly higher (15°) when transitioning into the occipital bone to avoid creating a harsh demarcation line.",
      severity: "technique_correction",
      resolved: true,
    },
    {
      id: "crit_3",
      timestampSeconds: 135,
      instructorName: "Master Alex Mukasa",
      critiqueText: "Always hold client's ear folded safely down with your free thumb when edging near the mastoid process.",
      severity: "safety_warning",
      resolved: true,
    },
  ],
};

export const DEMO_SKILLS_LOGBOOK: ApprenticeLogbookEntry[] = [
  {
    id: "log_01",
    studentId: "stud_denis",
    studentName: "Denis Kigozi",
    date: "2026-10-14",
    practicalHours: 6.5,
    taskPerformed: "Completed 5 low skin fades and 3 beard line-ups under mentor supervision.",
    workshopLocation: "Peebee Barber Studio, Kisementi",
    masterSupervisorName: "Alex Mukasa (Master Barber)",
    supervisorSignatureRecorded: true,
    supervisorSignedAt: "2026-10-14 18:30",
  },
  {
    id: "log_02",
    studentId: "stud_denis",
    studentName: "Denis Kigozi",
    date: "2026-10-15",
    practicalHours: 7.0,
    taskPerformed: "Sanitization protocol, hot towel shaving technique, and scissor-over-comb texture layering.",
    workshopLocation: "Peebee Barber Studio, Kisementi",
    masterSupervisorName: "Alex Mukasa (Master Barber)",
    supervisorSignatureRecorded: true,
    supervisorSignedAt: "2026-10-15 19:15",
  },
];

// ==========================================
// Tuition & Monetization Demo Data
// ==========================================

export const DEMO_TUITION_INVOICE: TuitionInvoice = {
  id: "inv_term1_8942",
  studentId: "stud_esther",
  studentName: "Esther Nabirye",
  institutionId: "inst_greenwood",
  institutionName: "Greenwood International Academy",
  termName: "Term 1 — 2026",
  totalTuitionUgx: 850000,
  amountPaidUgx: 500000,
  balanceUgx: 350000,
  dueDate: "2026-11-15",
  status: "partial",
  installments: [
    { installmentNumber: 1, amountUgx: 500000, dueDate: "2026-02-05", isPaid: true, paidAt: "2026-02-04" },
    { installmentNumber: 2, amountUgx: 350000, dueDate: "2026-11-15", isPaid: false },
  ],
};

export const DEMO_SUBSCRIPTION_PASSES: SubscriptionPass[] = [
  {
    id: "pass_skills_pro",
    name: "Peebee Skills Vocational Pass",
    stream: "skills",
    monthlyPriceUgx: 65000,
    annualPriceUgx: 650000,
    benefits: [
      "Unlimited access to all Trade Video masterclasses",
      "Monthly 1-on-1 video critique by certified Master Artisans",
      "Digital Apprenticeship Logbook verified hours certification",
      "DIT National Occupational Exam Preparation Kits",
    ],
  },
  {
    id: "pass_campus_all",
    name: "Peebee Campus Executive Pass",
    stream: "campus",
    monthlyPriceUgx: 120000,
    annualPriceUgx: 1200000,
    benefits: [
      "Access to all Business, Coding, Marketing & FinTech courses",
      "Verifiable tamper-proof cryptographic certificates & LinkedIn badges",
      "Exclusive bi-weekly Live Mastermind sessions with guest executives",
      "Direct Teaching Assistant forum support",
    ],
  },
];

export const DEMO_GUARDIAN_ALERTS: GuardianAlertMessage[] = [
  {
    id: "alert_01",
    studentId: "stud_esther",
    guardianPhoneNumber: "+256 701 555 999",
    channel: "whatsapp",
    type: "attendance",
    bodyText: "Peebee Greenwood Alert: Esther Nabirye was checked into Period 1 (Mathematics) at 08:04 AM.",
    sentAt: "Today at 08:05 AM",
    status: "delivered",
  },
  {
    id: "alert_02",
    studentId: "stud_timothy",
    guardianPhoneNumber: "+256 772 333 444",
    channel: "sms",
    type: "homework_missing",
    bodyText: "Peebee Alert: Timothy's Primary 4 Science worksheet is due today at 5:00 PM. Please review and sign off in the app.",
    sentAt: "Today at 07:30 AM",
    status: "delivered",
  },
];

// ==========================================
// Live Meetings (Zoom-Style) Demo Data
// ==========================================

export const DEMO_LIVE_MEETINGS: EducationLiveMeeting[] = [
  {
    id: "live_fintech_101",
    roomCode: "PB-MKT-802",
    title: "Live FinTech Masterclass: USSD Callback Architectures & Merchant Settlement",
    subject: "FinTech Product Growth",
    stream: "campus",
    hostTutorName: "Dr. Kenneth Ochieng",
    hostTutorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    hostTutorTitle: "FinTech Fellow & Lead Lecturer",
    isLiveNow: true,
    scheduledFor: "Live Now · Started 24 mins ago",
    startedAt: "10:00 AM",
    durationMinutes: 75,
    participantCount: 42,
    maxParticipants: 100,
    whiteboardEnabled: true,
    screenShareActive: true,
    activeWhiteboardSlideUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80",
    recordingAvailable: true,
  },
  {
    id: "live_primary_math_401",
    roomCode: "PB-PRI-401",
    title: "Primary 4 Mathematics: Solving Shilling Word Problems Live Drill",
    subject: "Mathematics",
    stream: "foundations",
    hostTutorName: "Tr. Brenda Namutebi",
    hostTutorAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
    hostTutorTitle: "Lead Primary Educator",
    isLiveNow: false,
    scheduledFor: "Today, 4:00 PM",
    durationMinutes: 45,
    participantCount: 28,
    maxParticipants: 35,
    whiteboardEnabled: true,
    screenShareActive: false,
    recordingAvailable: true,
  },
  {
    id: "live_sprouts_story_hour",
    roomCode: "PB-SPR-001",
    title: "Interactive Story Hour: The Little Boda That Could with Kigo",
    subject: "Early Childhood Phonics",
    stream: "sprouts",
    hostTutorName: "Teacher Sharon",
    hostTutorAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    hostTutorTitle: "Early Childhood Specialist",
    isLiveNow: false,
    scheduledFor: "Saturday, 10:00 AM",
    durationMinutes: 30,
    participantCount: 16,
    maxParticipants: 20,
    whiteboardEnabled: true,
    screenShareActive: false,
    recordingAvailable: true,
  },
  {
    id: "live_skills_barber_demo",
    roomCode: "PB-SKL-702",
    title: "Workshop Masterclass: Zero-Gap Clipper Detailing & Scalp Hygiene",
    subject: "Vocational Barbering",
    stream: "skills",
    hostTutorName: "Master Alex Mukasa",
    hostTutorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    hostTutorTitle: "Master Artisan & DIT Lead Examiner",
    isLiveNow: false,
    scheduledFor: "Tomorrow, 2:00 PM",
    durationMinutes: 60,
    participantCount: 35,
    maxParticipants: 50,
    whiteboardEnabled: false,
    screenShareActive: true,
    recordingAvailable: true,
  },
  {
    id: "live_academy_physics_mock",
    roomCode: "PB-ACD-502",
    title: "Senior 4 UNEB Physics Revision: Mechanics & Energy Conversion",
    subject: "Physics",
    stream: "academy",
    hostTutorName: "Dr. Paul Habimana",
    hostTutorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    hostTutorTitle: "Senior Science Master",
    isLiveNow: false,
    scheduledFor: "Today, 6:00 PM",
    durationMinutes: 60,
    participantCount: 52,
    maxParticipants: 80,
    whiteboardEnabled: true,
    screenShareActive: true,
    recordingAvailable: true,
  },
];

export const DEMO_LIVE_PARTICIPANTS: LiveParticipant[] = [
  {
    id: "part_host",
    name: "Dr. Kenneth Ochieng (Host)",
    role: "host",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    isMuted: false,
    isVideoOn: true,
    hasHandRaised: false,
    isScreenSharing: true,
  },
  {
    id: "part_esther",
    name: "Esther Nabirye",
    role: "student",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    isMuted: true,
    isVideoOn: true,
    hasHandRaised: true,
  },
  {
    id: "part_denis",
    name: "Denis Kigozi",
    role: "student",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    isMuted: true,
    isVideoOn: true,
    hasHandRaised: false,
  },
  {
    id: "part_timothy",
    name: "Timothy Mukasa",
    role: "student",
    avatarUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80",
    isMuted: true,
    isVideoOn: false,
    hasHandRaised: false,
  },
  {
    id: "part_ta_brenda",
    name: "Tr. Brenda Namutebi (TA)",
    role: "ta",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
    isMuted: false,
    isVideoOn: true,
    hasHandRaised: false,
  },
];

export const DEMO_TUTOR_CONTACTS: TutorContact[] = [
  {
    id: "tutor_ken",
    name: "Dr. Kenneth Ochieng",
    title: "Senior FinTech & Academic Fellow",
    subject: "FinTech & Mathematics",
    stream: "campus",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    isOnline: true,
    lastMessage: "Review the float reconciliation diagram before tomorrow's live drill.",
    lastMessageTime: "10:14 AM",
    unreadCount: 1,
  },
  {
    id: "tutor_brenda",
    name: "Tr. Brenda Namutebi",
    title: "Lead Primary & Tech Tutor",
    subject: "P.4 Math & Web Development",
    stream: "foundations",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
    isOnline: true,
    lastMessage: "Parent signature verified on worksheet #4. Great job!",
    lastMessageTime: "Yesterday",
    unreadCount: 0,
  },
  {
    id: "tutor_alex",
    name: "Master Alex Mukasa",
    title: "Master Artisan & Lead Instructor",
    subject: "Vocational Barbering & Mechanics",
    stream: "skills",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    isOnline: false,
    lastMessage: "I left a critique pin on your 01:28 timestamp. Check your blade angle.",
    lastMessageTime: "2 days ago",
    unreadCount: 0,
  },
];

export const DEMO_LIVE_CHAT_MESSAGES: LiveChatMessage[] = [
  {
    id: "msg_1",
    roomId: "live_fintech_101",
    senderId: "part_host",
    senderName: "Dr. Kenneth Ochieng (Host)",
    senderRole: "tutor",
    text: "Welcome everyone to today's live session! We are reviewing Bank of Uganda NPS Act guidelines and mobile wallet reconciliations.",
    timestamp: "10:02 AM",
  },
  {
    id: "msg_2",
    roomId: "live_fintech_101",
    senderId: "part_esther",
    senderName: "Esther Nabirye",
    senderRole: "student",
    text: "Dr. Kenneth, how does the idempotency key prevent double-debiting during telecom network timeouts?",
    timestamp: "10:12 AM",
    isQuestion: true,
    upvotes: 7,
  },
  {
    id: "msg_3",
    roomId: "live_fintech_101",
    senderId: "part_ta_brenda",
    senderName: "Tr. Brenda Namutebi (TA)",
    senderRole: "tutor",
    text: "Great question Esther! Dr. Kenneth is about to illustrate the 3-way handshake on the interactive whiteboard.",
    timestamp: "10:14 AM",
  },
];

