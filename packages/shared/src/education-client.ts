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
  CompassCourseDetail,
  PeerReviewAssignment,
  CompassVerifiableCredential,
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
import type {
  LearnSettings,
  SchoolKind,
  SchoolStatus,
  StudioClass,
  StudioCourse,
  StudioCourseDetail,
  StudioLesson,
  StudioModule,
  StudioQuiz,
  StudioSchool,
  StudioStatus,
  LessonContentType,
} from "./education/studio.js";
import type { ClassKind, CurriculumFramework } from "./education/types.js";

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
      return request<{ ok: true; scorePercent: number | null; passed: boolean | null; status: "submitted" | "graded"; tabSwitchCount: number; message: string }>("/v1/education/academy/exam/submit", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    // ----------------------------------------------------
    // 4. Compass (Higher Ed & Business)
    // ----------------------------------------------------
    async getCompassCourse(courseId?: string) {
      const q = courseId ? `?id=${encodeURIComponent(courseId)}` : "";
      return request<{
        ok: true;
        course: CompassCourseDetail;
        peerReview: PeerReviewAssignment;
        credential: CompassVerifiableCredential;
      }>(`/v1/education/compass/course${q}`);
    },
    async saveVideoTimestampNote(data: {
      unitId: string;
      timestampSeconds: number;
      noteText: string;
    }) {
      return request<{ ok: true; noteId: string }>("/v1/education/compass/notes", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async submitPeerReviewEvaluation(data: {
      assignmentId: string;
      anonymousSubmissionId: string;
      scores: { criteriaName: string; scoreAwarded: number; feedback: string }[];
    }) {
      return request<{ ok: true; isComplete: boolean }>("/v1/education/compass/peer-review/submit", {
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

    // ----------------------------------------------------
    // Studio: school → class → course → module → lesson (all scoped to the signed-in educator)
    // ----------------------------------------------------
    async studioConfig() {
      return request<{ ok: true; settings: LearnSettings; usage: { schools: number } }>("/v1/education/studio/config");
    },
    async studioSchools() {
      return request<{ ok: true; schools: StudioSchool[] }>("/v1/education/studio/schools");
    },
    async studioSchool(id: string) {
      return request<{ ok: true; school: StudioSchool }>(`/v1/education/studio/schools/${encodeURIComponent(id)}`);
    },
    async studioCreateSchool(data: {
      name: string;
      kind: SchoolKind;
      streams: EducationStream[];
      tagline?: string;
      bio?: string;
      location?: string;
      motto?: string;
      badge?: string;
      contactEmail?: string;
      contactPhone?: string;
    }) {
      return request<{ ok: true; school: StudioSchool }>("/v1/education/studio/schools", { method: "POST", body: JSON.stringify(data) });
    },
    async studioUpdateSchool(id: string, data: Partial<Omit<StudioSchool, "id" | "slug" | "status" | "createdAt" | "classCount" | "courseCount">>) {
      return request<{ ok: true; school: StudioSchool }>(`/v1/education/studio/schools/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) });
    },
    async studioDeleteSchool(id: string) {
      return request<{ ok: true }>(`/v1/education/studio/schools/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    async studioClasses(schoolId: string) {
      return request<{ ok: true; classes: StudioClass[] }>(`/v1/education/studio/schools/${encodeURIComponent(schoolId)}/classes`);
    },
    async studioCreateClass(
      schoolId: string,
      data: {
        stream: EducationStream;
        kind: ClassKind;
        name: string;
        level: string;
        framework: CurriculumFramework;
        academicYear?: string;
        term?: string;
        teacherName?: string;
        capacity?: number;
        summary?: string;
      },
    ) {
      return request<{ ok: true; class: StudioClass }>(`/v1/education/studio/schools/${encodeURIComponent(schoolId)}/classes`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async studioClass(id: string) {
      return request<{ ok: true; class: StudioClass }>(`/v1/education/studio/classes/${encodeURIComponent(id)}`);
    },
    async studioUpdateClass(id: string, data: Partial<Omit<StudioClass, "id" | "schoolId" | "courseCount">>) {
      return request<{ ok: true; class: StudioClass }>(`/v1/education/studio/classes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) });
    },
    async studioDeleteClass(id: string) {
      return request<{ ok: true }>(`/v1/education/studio/classes/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    async studioCourses(classId: string) {
      return request<{ ok: true; courses: StudioCourse[] }>(`/v1/education/studio/classes/${encodeURIComponent(classId)}/courses`);
    },
    async studioCreateCourse(
      classId: string,
      data: { title: string; summary?: string; priceUgx?: number; framework?: CurriculumFramework; outcomes?: string[] },
    ) {
      return request<{ ok: true; course: StudioCourse }>(`/v1/education/studio/classes/${encodeURIComponent(classId)}/courses`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async studioCourse(id: string) {
      return request<{ ok: true; course: StudioCourseDetail }>(`/v1/education/studio/courses/${encodeURIComponent(id)}`);
    },
    async studioUpdateCourse(
      id: string,
      data: { title?: string; summary?: string; priceUgx?: number; framework?: CurriculumFramework; outcomes?: string[]; status?: StudioStatus },
    ) {
      return request<{ ok: true; course: StudioCourse }>(`/v1/education/studio/courses/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) });
    },
    async studioDeleteCourse(id: string) {
      return request<{ ok: true }>(`/v1/education/studio/courses/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    async studioCreateModule(courseId: string, data: { title: string; description?: string }) {
      return request<{ ok: true; module: StudioModule }>(`/v1/education/studio/courses/${encodeURIComponent(courseId)}/modules`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async studioUpdateModule(id: string, data: { title?: string; description?: string }) {
      return request<{ ok: true; module: StudioModule }>(`/v1/education/studio/modules/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) });
    },
    async studioDeleteModule(id: string) {
      return request<{ ok: true }>(`/v1/education/studio/modules/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    async studioCreateLesson(
      moduleId: string,
      data: {
        title: string;
        contentType?: LessonContentType;
        durationMinutes?: number;
        summary?: string;
        contentUrl?: string;
        quiz?: StudioQuiz | null;
      },
    ) {
      return request<{ ok: true; lesson: StudioLesson }>(`/v1/education/studio/modules/${encodeURIComponent(moduleId)}/lessons`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async studioUpdateLesson(
      id: string,
      data: { title?: string; contentType?: LessonContentType; durationMinutes?: number; summary?: string; contentUrl?: string; quiz?: StudioQuiz | null },
    ) {
      return request<{ ok: true; lesson: StudioLesson }>(`/v1/education/studio/lessons/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) });
    },
    async studioDeleteLesson(id: string) {
      return request<{ ok: true }>(`/v1/education/studio/lessons/${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    // ----------------------------------------------------
    // Admin (staff only)
    // ----------------------------------------------------
    async adminGetLearnSettings() {
      return request<{ learn: LearnSettings }>("/v1/admin/learn-settings");
    },
    async adminUpdateLearnSettings(learn: Partial<LearnSettings>) {
      return request<{ learn: LearnSettings }>("/v1/admin/learn-settings", { method: "PATCH", body: JSON.stringify(learn) });
    },
    async adminLearnSchools() {
      return request<{ ok: true; schools: (StudioSchool & { ownerName: string; ownerId: string })[] }>("/v1/admin/learn-schools");
    },
    async adminSetLearnSchoolStatus(id: string, status: SchoolStatus) {
      return request<{ ok: true; status: SchoolStatus }>(`/v1/admin/learn-schools/${encodeURIComponent(id)}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
    },
  };
}
