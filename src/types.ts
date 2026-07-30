export const DEFAULT_CAT_DATE = "2026-11-28";
export const STORAGE_KEY = "focus.study.os.v5";
export const ACTIVE_SESSION_KEY = "focus.study.active.session.v1";

export interface Subject {
  id: string;
  name: string;
  hours: number;
  color: string;
  emoji: string;
}

export interface StudyMode {
  id: string;
  name: string;
  hours: number;
  note: string;
}

export interface BreakActivityConfig {
  minutes: number;
  everyMinutes?: number;
  color: string;
  activities: string[];
  emojis: Record<string, string>;
}

export interface BreaksConfig {
  short: BreakActivityConfig;
  long: BreakActivityConfig;
}

export interface SessionRecord {
  id: string;
  date: string;
  createdAt: string;
  totalSeconds: number;
  focusedSeconds: number;
  unplannedBreakSeconds: number;
  completedPomodoros: number;
  status: "Completed" | "Ended Early";
  reason: string;
}

export interface Stats {
  streak: number;
  studyDays: number;
  averageHours: number;
  totalHours: number;
  completedSubjects: number;
  lastStudyDate: string;
  heat: number[];
}

export interface ColorAssignments {
  varc: number;
  dilr: number;
  quant: number;
  short: number;
  long: number;
  [key: string]: number;
}

export interface AppState {
  stats: Stats;
  history: SessionRecord[];
  modes: StudyMode[];
  subjects: Subject[];
  breaks: BreaksConfig;
  theme: string;
  sound: string;
  paletteTheme: string;
  colorAssignments: ColorAssignments;
  catDate: string;
}

export interface TimelineItem {
  type: "study" | "micro" | "medium";
  subject: string;
  minutes: number;
  color: string;
  emoji: string;
}

export interface BreakHistoryEntry {
  id: string;
  durationMs: number;
  resumedAt: string;
  order: number;
}

export interface LiveSession {
  id: string;
  timeline: TimelineItem[];
  index: number;
  remaining: number; // in seconds
  paused: boolean;
  startedAt: number;
  elapsedMs: number;
  completedPomodoros: number;
  focusedMs: number;
  unplannedBreakMs: number;
  currentBreakMs: number;
  breakHistory: BreakHistoryEntry[];
  lastTickAt: number;
  endStep: "confirm" | "reason" | null;
  endReason: string;
  skipStep: "confirm" | null;
  infoView: "end" | "focused" | "total" | "breakTotal";
  infoResetAt: number;
  savedAt?: number;
}

export const colorPalettes: Record<string, { name: string; colors: string[] }> = {
  headspace: { name: "Headspace Calm", colors: ["#e07a5f", "#f4a261", "#52b788", "#457b9d", "#9d4edd"] },
  candy: { name: "Candy Pop", colors: ["#9B5DE5", "#F15BB5", "#FEE440", "#00BBF9", "#00F5D4"] },
  fiesta: { name: "Fiesta", colors: ["#F94144", "#F3722C", "#F8961E", "#43AA8B", "#277DA1"] },
  academic: { name: "Academic", colors: ["#203744", "#15616D", "#FFECD1", "#FF7D00", "#78290F"] },
  modern: { name: "Modern Bright", colors: ["#EF476F", "#FFD166", "#06D6A0", "#118AB2", "#073B4C"] },
  aurora: { name: "Aurora", colors: ["#072AC8", "#1E96FC", "#A2D6F9", "#FCF300", "#FFC600"] },
  pastel: { name: "Pastel Dream", colors: ["#D3FFB8", "#B6DAFC", "#F4D7F0", "#C9B6FF", "#FFFC98"] }
};

export const defaultState: AppState = {
  stats: { streak: 0, studyDays: 0, averageHours: 0, totalHours: 0, completedSubjects: 0, lastStudyDate: "", heat: Array(42).fill(0) },
  history: [],
  modes: [
    { id: "focused", name: "Focused", hours: 6, note: "Sustainable deep work" },
    { id: "intensive", name: "Intensive", hours: 8, note: "Serious but steady" },
    { id: "monk", name: "Monk Mode", hours: 10, note: "A long quiet day" }
  ],
  subjects: [
    { id: "varc", name: "VARC", hours: 2, color: "#f4a261", emoji: "📖" },
    { id: "dilr", name: "DILR", hours: 3, color: "#52b788", emoji: "🧩" },
    { id: "quant", name: "QUANT", hours: 3, color: "#9d4edd", emoji: "∑" }
  ],
  breaks: {
    short: {
      minutes: 5,
      everyMinutes: 50,
      color: "#52b788",
      activities: ["Drink water", "Stand & stretch", "Balcony walk"],
      emojis: { "Drink water": "💧", "Stand & stretch": "🤸", "Balcony walk": "🌿" }
    },
    long: {
      minutes: 15,
      color: "#f4a261",
      activities: ["Mindful Meditation", "Breathing Exercise", "Balcony walk", "Mindful Scribbling"],
      emojis: { "Mindful Meditation": "🧘", "Breathing Exercise": "◌", "Balcony walk": "🌿", "Mindful Scribbling": "✏️" }
    }
  },
  theme: "monk",
  sound: "attention",
  paletteTheme: "headspace",
  colorAssignments: { varc: 1, dilr: 2, quant: 4, short: 0, long: 3 },
  catDate: DEFAULT_CAT_DATE
};
