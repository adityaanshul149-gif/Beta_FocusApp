import { AppState, LiveSession, STORAGE_KEY, ACTIVE_SESSION_KEY, defaultState, colorPalettes } from "../types";

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return structuredClone(defaultState);
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state", e);
  }
}

export function normalizeState(saved: Partial<AppState>): AppState {
  const state: AppState = {
    ...defaultState,
    ...saved,
    stats: { ...defaultState.stats, ...(saved.stats || {}) },
    subjects: Array.isArray(saved.subjects) && saved.subjects.length > 0 ? saved.subjects : defaultState.subjects,
    modes: Array.isArray(saved.modes) && saved.modes.length > 0 ? saved.modes : defaultState.modes,
    history: Array.isArray(saved.history) ? saved.history : [],
    breaks: {
      short: { ...defaultState.breaks.short, ...(saved.breaks?.short || {}) },
      long: { ...defaultState.breaks.long, ...(saved.breaks?.long || {}) }
    }
  };

  // Ensure palettes assignment
  applySectionAssignments(state);
  return state;
}

export function applySectionAssignments(state: AppState): void {
  const palette = colorPalettes[state.paletteTheme] || colorPalettes.headspace;
  state.subjects.forEach((subject) => {
    if (state.colorAssignments[subject.id] !== undefined) {
      subject.color = palette.colors[state.colorAssignments[subject.id] % palette.colors.length];
    }
  });
  if (state.breaks?.short) {
    state.breaks.short.color = palette.colors[state.colorAssignments.short % palette.colors.length];
  }
  if (state.breaks?.long) {
    state.breaks.long.color = palette.colors[state.colorAssignments.long % palette.colors.length];
  }
}

export function loadActiveSession(): LiveSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.timeline) || saved.timeline.length === 0) return null;
    return reconcileActiveSession(saved);
  } catch {
    return null;
  }
}

export function saveActiveSession(session: LiveSession | null): void {
  if (!session) {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    return;
  }
  const snapshot: LiveSession = {
    ...session,
    savedAt: Date.now()
  };
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(snapshot));
}

function reconcileActiveSession(saved: LiveSession): LiveSession | null {
  const awayMs = Math.max(0, Date.now() - Number(saved.savedAt || Date.now()));
  const elapsedAwaySec = saved.paused ? 0 : awayMs / 1000;

  if (saved.paused) {
    saved.currentBreakMs = (saved.currentBreakMs || 0) + awayMs;
    saved.elapsedMs = (saved.elapsedMs || 0) + awayMs;
  }

  saved.lastTickAt = performance.now();
  saved.endStep = null;
  saved.skipStep = null;
  saved.infoView = saved.infoView || "end";

  return advanceSavedSession(saved, elapsedAwaySec);
}

function advanceSavedSession(session: LiveSession, seconds: number): LiveSession | null {
  let remainingSeconds = seconds;
  while (remainingSeconds > 0 && session.index < session.timeline.length) {
    const item = session.timeline[session.index];
    const step = Math.min(session.remaining, remainingSeconds);
    session.remaining -= step;
    remainingSeconds -= step;

    if (item.type === "study") {
      session.focusedMs = (session.focusedMs || 0) + step * 1000;
    }
    session.elapsedMs = (session.elapsedMs || 0) + step * 1000;

    if (session.remaining <= 0) {
      if (item.type === "study") {
        session.completedPomodoros = (session.completedPomodoros || 0) + 1;
      }
      session.index += 1;
      if (session.index >= session.timeline.length) break;
      session.remaining = session.timeline[session.index].minutes * 60;
    }
  }

  return session.index >= session.timeline.length ? null : session;
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysRemaining(catDateStr: string): number {
  const target = new Date(`${catDateStr || defaultState.catDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return 0;
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((target.getTime() - todayMidnight.getTime()) / 86400000));
}

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

export function fmtHours(hours: number): string {
  return `${Number(hours).toFixed(hours % 1 ? 1 : 0)}h`;
}

export function fmtPlanDuration(hours: number): string {
  const minutes = Math.round(Number(hours) * 60);
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
