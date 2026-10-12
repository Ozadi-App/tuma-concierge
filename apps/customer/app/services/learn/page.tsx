"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CarFront,
  CheckCircle2,
  Code2,
  GraduationCap,
  Languages,
  Music2,
  Search,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

interface Instructor {
  id: string;
  name: string;
  subject: string;
  category: "driving" | "tech" | "languages" | "academics" | "music";
  rating: number;
  lessonsGiven: number;
  rateUgxPerHour: number;
  experience: string;
  avatarUrl: string;
  bio: string;
  mode: "In-Person & Online" | "In-Person Only" | "Online Only";
}

const INSTRUCTORS: Instructor[] = [
  {
    id: "tutor_1",
    name: "Alex Mukasa",
    subject: "Class B Driving & Defensive Maneuvers",
    category: "driving",
    rating: 4.95,
    lessonsGiven: 340,
    rateUgxPerHour: 35000,
    experience: "8 yrs experience",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    bio: "Certified driving instructor with dual-brake training vehicles. Patient guidance for learners and test preparation.",
    mode: "In-Person Only",
  },
  {
    id: "tutor_2",
    name: "Brenda Namutebi",
    subject: "Frontend Web Dev & UI Design",
    category: "tech",
    rating: 5.0,
    lessonsGiven: 180,
    rateUgxPerHour: 40000,
    experience: "5 yrs experience",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
    bio: "Senior engineer teaching HTML/CSS, React, and Figma fundamentals. Hands-on project portfolio building.",
    mode: "In-Person & Online",
  },
  {
    id: "tutor_3",
    name: "Jean-Paul Habimana",
    subject: "Conversational French & DELF Prep",
    category: "languages",
    rating: 4.9,
    lessonsGiven: 210,
    rateUgxPerHour: 30000,
    experience: "6 yrs experience",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    bio: "Native French speaker focusing on natural speaking fluency, pronunciation, grammar, and international exams.",
    mode: "In-Person & Online",
  },
  {
    id: "tutor_4",
    name: "Dr. Kenneth Ochieng",
    subject: "High School Math & Physics (UCE/UACE)",
    category: "academics",
    rating: 4.98,
    lessonsGiven: 420,
    rateUgxPerHour: 35000,
    experience: "10 yrs experience",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    bio: "Master educator specializing in calculus, algebra, mechanics, and UNEB past-paper exam mastery.",
    mode: "In-Person & Online",
  },
  {
    id: "tutor_5",
    name: "Sarah Kyomugisha",
    subject: "Piano & Acoustic Guitar Essentials",
    category: "music",
    rating: 4.88,
    lessonsGiven: 150,
    rateUgxPerHour: 30000,
    experience: "4 yrs experience",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    bio: "Play songs by ear or learn sheet music sight reading from day one. Friendly, encouraging teaching method.",
    mode: "In-Person & Online",
  },
];

export default function LearnPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [preferredDay, setPreferredDay] = useState("Saturday Morning");
  const [studentLevel, setStudentLevel] = useState("Beginner");

  const filteredInstructors = INSTRUCTORS.filter((inst) => {
    const matchesCategory = activeCategory === "all" || inst.category === activeCategory;
    const matchesSearch =
      inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleConfirmLesson = () => {
    setBookingConfirmed(true);
  };

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg))] pb-28 pt-4 px-4 max-w-lg mx-auto text-ink">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => router.push("/services")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--surface-card))] border border-[var(--border-faint)] text-ink transition-transform active:scale-95"
          aria-label="Back to Services"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gold">Skills & Tutoring</span>
          <h1 className="text-lg font-bold">Learn with Peebee</h1>
        </div>
        <div className="h-10 w-10" />
      </div>

      {bookingConfirmed && selectedInstructor ? (
        <div className="home-card rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-6 text-center space-y-4 animate-in fade-in duration-300">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 text-gold">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold">Lesson Inquiry Sent!</h2>
          <p className="text-sm text-ink-500 leading-relaxed">
            <span className="font-semibold text-ink">{selectedInstructor.name}</span> will contact you within 2 hours to confirm your first lesson for <span className="font-semibold text-ink">{preferredDay}</span>.
          </p>
          <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-4 text-left space-y-2">
            <div className="flex justify-between text-xs text-ink-500">
              <span>Subject</span>
              <span className="font-bold text-ink">{selectedInstructor.subject}</span>
            </div>
            <div className="flex justify-between text-xs text-ink-500">
              <span>Rate</span>
              <span className="font-bold text-gold">UGX {selectedInstructor.rateUgxPerHour.toLocaleString("en-UG")} / hr</span>
            </div>
            <div className="flex justify-between text-xs text-ink-500">
              <span>Mode</span>
              <span className="font-medium text-ink">{selectedInstructor.mode}</span>
            </div>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setBookingConfirmed(false);
                setSelectedInstructor(null);
              }}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-gold font-bold text-ink-gold shadow-[var(--shadow-glow-gold)] active:scale-95 transition-transform"
            >
              Explore More Instructors
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Hero Banner */}
          <div className="home-card rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/15 via-gold/5 to-transparent p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold text-ink-gold">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-bold text-ink">Learn at Your Pace</h2>
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">1-on-1 Sessions</span>
                </div>
                <p className="text-xs text-ink-500 leading-relaxed">
                  Book verified driving tutors, academic teachers, languages, coding mentors, and music instructors.
                </p>
              </div>
            </div>
          </div>

          {/* Search Field */}
          <div className="field-box flex items-center rounded-2xl px-3.5 py-3">
            <Search className="h-4 w-4 text-ink-500 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tutor, subject (e.g. driving, math, python)..."
              className="w-full text-sm font-medium outline-none bg-transparent"
            />
          </div>

          {/* Categories Pill Bar */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "all", label: "All Subjects", icon: BookOpen },
              { id: "driving", label: "Driving", icon: CarFront },
              { id: "tech", label: "Tech & Code", icon: Code2 },
              { id: "academics", label: "Academics", icon: GraduationCap },
              { id: "languages", label: "Languages", icon: Languages },
              { id: "music", label: "Music", icon: Music2 },
            ].map((cat) => {
              const Icon = cat.icon;
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all ${
                    active
                      ? "bg-gold text-ink-gold shadow-sm font-black"
                      : "bg-[rgb(var(--surface-muted))] text-ink-500 hover:text-ink"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Instructors List */}
          <div className="space-y-3 pt-1">
            {filteredInstructors.map((inst) => (
              <div
                key={inst.id}
                className="home-card rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 space-y-3 transition-transform active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={inst.avatarUrl}
                    alt={inst.name}
                    className="h-14 w-14 rounded-2xl object-cover border border-[var(--border-faint)] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-sm font-bold text-ink truncate">{inst.name}</h3>
                      <div className="flex items-center gap-1 shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">
                        <Star className="h-3 w-3 fill-gold" />
                        <span>{inst.rating}</span>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-gold mt-0.5 truncate">{inst.subject}</p>
                    <div className="flex items-center gap-2 text-[11px] text-ink-500 mt-1">
                      <span>{inst.experience}</span>
                      <span>•</span>
                      <span>{inst.lessonsGiven} lessons</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-ink-500 leading-relaxed line-clamp-2">{inst.bio}</p>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-faint)]">
                  <div>
                    <span className="text-base font-extrabold text-gold">UGX {inst.rateUgxPerHour.toLocaleString("en-UG")}</span>
                    <span className="text-[11px] text-ink-500 ml-1">/ hour</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedInstructor(inst)}
                    className="rounded-xl bg-gold px-4 py-2 text-xs font-bold text-ink-gold shadow-[var(--shadow-glow-gold)] active:scale-95 transition-transform"
                  >
                    Book Session
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Booking Modal / Dialog */}
          {selectedInstructor && !bookingConfirmed && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-3">
              <div className="home-card w-full max-w-md rounded-3xl border border-gold/40 bg-[rgb(var(--surface-card))] p-5 space-y-4 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-gold" />
                    <h3 className="text-sm font-bold text-ink">Schedule 1-on-1 Lesson</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedInstructor(null)}
                    className="text-xs font-bold text-ink-500 hover:text-ink px-2 py-1"
                  >
                    Close
                  </button>
                </div>

                <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3 flex items-center gap-3">
                  <img
                    src={selectedInstructor.avatarUrl}
                    alt={selectedInstructor.name}
                    className="h-11 w-11 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-ink truncate">{selectedInstructor.name}</h4>
                    <p className="text-[11px] text-gold truncate">{selectedInstructor.subject}</p>
                    <p className="text-[10px] text-ink-500">{selectedInstructor.mode}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink block">Your Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Beginner", "Intermediate", "Advanced"].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setStudentLevel(lvl)}
                        className={`rounded-xl border p-2 text-center text-xs font-semibold transition-all ${
                          studentLevel === lvl
                            ? "border-gold bg-gold/15 text-gold font-bold"
                            : "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink-500"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink block">Preferred Schedule Slot</label>
                  <div className="field-box flex items-center rounded-xl px-3 py-2.5">
                    <select
                      value={preferredDay}
                      onChange={(e) => setPreferredDay(e.target.value)}
                      className="w-full text-xs font-medium outline-none bg-transparent text-ink"
                    >
                      <option value="Saturday Morning (9:00 AM - 11:00 AM)">Saturday Morning (9:00 AM - 11:00 AM)</option>
                      <option value="Saturday Afternoon (2:00 PM - 4:00 PM)">Saturday Afternoon (2:00 PM - 4:00 PM)</option>
                      <option value="Sunday Afternoon (3:00 PM - 5:00 PM)">Sunday Afternoon (3:00 PM - 5:00 PM)</option>
                      <option value="Weekday Evening (6:00 PM - 7:30 PM)">Weekday Evening (6:00 PM - 7:30 PM)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleConfirmLesson}
                    className="w-full flex h-12 items-center justify-center gap-2 rounded-2xl bg-gold font-bold text-ink-gold shadow-[var(--shadow-glow-gold)] active:scale-95 transition-transform"
                  >
                    <span>Request Lesson • UGX {selectedInstructor.rateUgxPerHour.toLocaleString("en-UG")}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
