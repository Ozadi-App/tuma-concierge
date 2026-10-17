import type {
  EducationStream,
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
  VideoTimestampCritique,
  ApprenticeLogbookEntry,
  TuitionInvoice,
  SubscriptionPass,
  GuardianAlertMessage,
  EducationLiveMeeting,
  LiveParticipant,
  TutorContact,
  LiveChatMessage,
} from "./education/types.js";

type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export function educationMethods(request: RequestFn) {
  return {
    // ----------------------------------------------------
    // Streams & Institutions
    // ----------------------------------------------------
    async getEducationStreams() {
      return request<{ ok: true; streams: any[] }>("/v1/education/streams");
    },
    async getEducationInstitutions() {
      return request<{ ok: true; institutions: InstitutionProfile[] }>("/v1/education/institutions");
    },
    async getEducationInstitutionBySlug(slug: string) {
      return request<{ ok: true; institution: InstitutionProfile }>(`/v1/education/institutions/${encodeURIComponent(slug)}`);
    },

    // ----------------------------------------------------
    // 1. Sprouts (Ages 3-6)
    // ----------------------------------------------------
    async getSproutsActivities() {
      return request<{
        ok: true;
        activities: SproutsActivity[];
        screenTimer: SproutsScreenTimer;
        coPlayPrompt: SproutsCoPlayPrompt;
      }>("/v1/education/sprouts/activities");
    },
    async unlockSproutsScreenTimer(pin: string) {
      return request<{ ok: true; unlocked: boolean; message: string }>("/v1/education/sprouts/timer/unlock", {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
    },

    // ----------------------------------------------------
    // 2. Foundations (Ages 6-12)
    // ----------------------------------------------------
    async getFoundationsWorksheets() {
      return request<{
        ok: true;
        worksheets: FoundationsWorksheet[];
        submissions: FoundationsSubmission[];
        meritWallet: FoundationsMeritWallet;
      }>("/v1/education/foundations/worksheets");
    },
    async submitFoundationsWorksheet(data: {
      worksheetId: string;
      scannedPhotoUrls: string[];
      parentPin: string;
      parentSignerName: string;
    }) {
      return request<{ ok: true; submission: FoundationsSubmission }>("/v1/education/foundations/worksheets/submit", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    // ----------------------------------------------------
    // 3. Academy (Ages 12-18)
    // ----------------------------------------------------
    async getAcademyDashboard() {
      return request<{
        ok: true;
        timetable: AcademyTimetableDay[];
        activeExam?: AcademyExam;
        reportCard: AcademyTerminalReportCard;
      }>("/v1/education/academy/dashboard");
    },
    async submitAcademyExam(data: {
      examId: string;
      answers: Record<string, string>;
      tabSwitchCount: number;
      focusLossEventsCount: number;
    }) {
      return request<{ ok: true; scorePercent: number; passed: boolean; message: string }>("/v1/education/academy/exam/submit", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    // ----------------------------------------------------
    // 4. Campus (Higher Ed & Business)
    // ----------------------------------------------------
    async getCampusCourse(courseId?: string) {
      const q = courseId ? `?id=${encodeURIComponent(courseId)}` : "";
      return request<{
        ok: true;
        course: CampusCourseDetail;
        peerReview: PeerReviewAssignment;
        credential: CampusVerifiableCredential;
      }>(`/v1/education/campus/course${q}`);
    },
    async saveVideoTimestampNote(data: {
      unitId: string;
      timestampSeconds: number;
      noteText: string;
    }) {
      return request<{ ok: true; noteId: string }>("/v1/education/campus/notes", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async submitPeerReviewEvaluation(data: {
      assignmentId: string;
      anonymousSubmissionId: string;
      scores: { criteriaName: string; scoreAwarded: number; feedback: string }[];
    }) {
      return request<{ ok: true; isComplete: boolean }>("/v1/education/campus/peer-review/submit", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    // ----------------------------------------------------
    // 5. Skills (Vocational & Practical)
    // ----------------------------------------------------
    async getSkillsCourse(skillId?: string) {
      const q = skillId ? `?id=${encodeURIComponent(skillId)}` : "";
      return request<{
        ok: true;
        course: SkillsCourseDetail;
        submission: SkillsVideoSubmission;
        logbook: ApprenticeLogbookEntry[];
      }>(`/v1/education/skills/course${q}`);
    },
    async submitSkillsPracticalVideo(data: {
      trade: string;
      taskTitle: string;
      videoUrl: string;
      durationSeconds: number;
    }) {
      return request<{ ok: true; submission: SkillsVideoSubmission }>("/v1/education/skills/practical/submit", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async addSkillsVideoCritique(data: {
      submissionId: string;
      timestampSeconds: number;
      instructorName: string;
      critiqueText: string;
      severity: "praise" | "technique_correction" | "safety_warning";
    }) {
      return request<{ ok: true; critique: VideoTimestampCritique }>("/v1/education/skills/critiques", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async recordApprenticeHours(data: {
      date: string;
      practicalHours: number;
      taskPerformed: string;
      workshopLocation: string;
      supervisorName: string;
    }) {
      return request<{ ok: true; entry: ApprenticeLogbookEntry }>("/v1/education/skills/logbook", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    // ----------------------------------------------------
    // Tuition Invoicing & Passes
    // ----------------------------------------------------
    async getEducationTuitionInvoices() {
      return request<{
        ok: true;
        invoice: TuitionInvoice;
        passes: SubscriptionPass[];
        guardianAlerts: GuardianAlertMessage[];
      }>("/v1/education/tuition");
    },
    async payTuitionInstallment(data: {
      invoiceId: string;
      installmentNumber: number;
      amountUgx: number;
      paymentMethod: "wallet" | "momo_mtn" | "momo_airtel";
      phoneNumber?: string;
    }) {
      return request<{ ok: true; receiptId: string; newBalanceUgx: number }>("/v1/education/tuition/pay", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    // ----------------------------------------------------
    // Live Meetings & Classroom Video (Zoom-Style)
    // ----------------------------------------------------
    async getEducationLiveMeetings(stream?: EducationStream) {
      const q = stream ? `?stream=${encodeURIComponent(stream)}` : "";
      return request<{
        ok: true;
        meetings: EducationLiveMeeting[];
        activeMeeting?: EducationLiveMeeting;
      }>(`/v1/education/live/meetings${q}`);
    },
    async getEducationLiveMeetingById(meetingId: string) {
      return request<{
        ok: true;
        meeting: EducationLiveMeeting;
        participants: LiveParticipant[];
        messages: LiveChatMessage[];
      }>(`/v1/education/live/meetings/${encodeURIComponent(meetingId)}`);
    },

    // ----------------------------------------------------
    // Live Chat with Tutors & Classroom Channels
    // ----------------------------------------------------
    async getEducationTutors(stream?: EducationStream) {
      const q = stream ? `?stream=${encodeURIComponent(stream)}` : "";
      return request<{
        ok: true;
        tutors: TutorContact[];
      }>(`/v1/education/chat/tutors${q}`);
    },
    async getEducationChatMessages(roomIdOrContactId: string) {
      return request<{
        ok: true;
        messages: LiveChatMessage[];
      }>(`/v1/education/chat/messages?id=${encodeURIComponent(roomIdOrContactId)}`);
    },
    async sendEducationChatMessage(data: {
      roomId?: string;
      channelId?: string;
      recipientId?: string;
      text: string;
      senderRole: "tutor" | "student" | "parent";
      isQuestion?: boolean;
      attachmentUrl?: string;
      voiceDurationSecs?: number;
    }) {
      return request<{ ok: true; message: LiveChatMessage }>("/v1/education/chat/send", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  };
}
