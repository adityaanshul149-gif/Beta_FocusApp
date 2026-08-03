const DEFAULT_CAT_DATE = "2026-11-28";
const STORAGE_KEY = "focus.study.os.v5";
const ACTIVE_SESSION_KEY = "focus.study.active.session.v1";

let tuneTab = "modes";

const appThemes = {
  focus: {
    name: "Headspace Sunshine",
    bg: "#FAF7F2",
    panel: "#FFFFFF",
    panelSoft: "#F4F0E8",
    text: "#1E1E1E",
    muted: "#666666",
    line: "#E8E3DA",
    accent: "#FF632C",
    button: "#FF632C",
    buttonText: "#FFFFFF",
    timerText: "#1E1E1E",
    pill: "#EFECE6",
    dialog: "#FFFFFF"
  },
  monk: {
    name: "Headspace Oasis",
    bg: "#F5F8F5",
    panel: "#FFFFFF",
    panelSoft: "#EAF2EA",
    text: "#1A251A",
    muted: "#5B705B",
    line: "#E1EBE1",
    accent: "#00A86B",
    button: "#00A86B",
    buttonText: "#FFFFFF",
    timerText: "#1A251A",
    pill: "#E6EFE6",
    dialog: "#FFFFFF"
  },
  intensive: {
    name: "Headspace Coral",
    bg: "#FAF5F3",
    panel: "#FFFFFF",
    panelSoft: "#F7ECE8",
    text: "#2B1A17",
    muted: "#785B55",
    line: "#EFE3DE",
    accent: "#FF5C00",
    button: "#FF5C00",
    buttonText: "#FFFFFF",
    timerText: "#2B1A17",
    pill: "#EFE5E1",
    dialog: "#FFFFFF"
  },
  flow: {
    name: "Headspace Breeze",
    bg: "#F4F7FB",
    panel: "#FFFFFF",
    panelSoft: "#EBF0F7",
    text: "#16202C",
    muted: "#586A7E",
    line: "#E0E7F1",
    accent: "#3B82F6",
    button: "#3B82F6",
    buttonText: "#FFFFFF",
    timerText: "#16202C",
    pill: "#E6EDF5",
    dialog: "#FFFFFF"
  }
};

const defaults = {
  stats: { streak: 0, studyDays: 0, averageHours: 0, totalHours: 0, completedSubjects: 0, lastStudyDate: "", heat: Array(42).fill(0) },
  history: [],
  modes: [
    { id: "focused", name: "Focused", hours: 6, note: "Sustainable deep work" },
    { id: "intensive", name: "Intensive", hours: 8, note: "Serious but steady" },
    { id: "monk", name: "Monk Mode", hours: 10, note: "A long quiet day" }
  ],
  subjects: [
    { id: "varc", name: "VARC", hours: 2, color: "#a7d8ff", emoji: "\uD83D\uDCD6" },
    { id: "dilr", name: "DILR", hours: 3, color: "#b8efd4", emoji: "\uD83E\uDDE9" },
    { id: "quant", name: "QUANT", hours: 3, color: "#d6c4ff", emoji: "\u2211" }
  ],
  recovery: {
    micro: ["Water", "Stretch", "Balcony Walk"],
    medium: ["Meditation", "Breathing Exercise", "Balcony Walk", "Mindful Scribbling"],
    enabled: ["Water", "Stretch", "Balcony Walk", "Meditation", "Breathing Exercise", "Mindful Scribbling"]
  },
  breaks: {
    short: { minutes: 5, everyMinutes: 50, color: "#c7f0dd", activities: ["Drink water", "Stand up", "Balcony walk"], emojis: { "Drink water": "\uD83D\uDCA7", "Stand up": "\uD83E\uDD38", "Balcony walk": "\uD83C\uDF3F" } },
    long: { minutes: 15, color: "#ffe3ad", activities: ["Meditation", "Breathing exercise", "Balcony walk", "Mindful scribbling"], emojis: { "Meditation": "\uD83E\uDDD8", "Breathing exercise": "\u25CC", "Balcony walk": "\uD83C\uDF3F", "Mindful scribbling": "\u270E" } }
  },
  theme: "focus",
  sound: "steady",
  paletteTheme: "headspace",
  colorAssignments: { varc: 0, dilr: 1, quant: 2, short: 3, long: 4 }
  ,catDate: DEFAULT_CAT_DATE
};

let state = normalizeState(loadState());
let view = "dashboard";
let flow = null;
let live = loadActiveSession();
let summary = null;
let ticker = null;
let timelineTimer = null;
let modal = null;
let audioContext = null;
let soundStatusTimer = null;
let lastSoundReady = false;
let audioProbeAt = 0;

const app = document.querySelector("#app");

function normalizeState(saved) {
  const subjectDefaults = new Map(defaults.subjects.map((subject) => [subject.id, subject]));
  saved.subjects = (saved.subjects || defaults.subjects).map((subject) => {
    const preset = subjectDefaults.get(subject.id) || {};
    return { ...preset, ...subject, color: subject.color || preset.color || "#a7d8ff", emoji: cleanEmoji(subject.emoji, preset.emoji) };
  });
  if (Array.isArray(saved.modes)) {
    saved.modes = saved.modes.filter((m) => m && m.id && !m.id.startsWith("test_"));
    if (!saved.modes.length) saved.modes = defaults.modes;
  } else {
    saved.modes = defaults.modes;
  }
  saved.recovery = { ...defaults.recovery, ...(saved.recovery || {}) };
  saved.breaks = normalizeBreaks(saved.breaks);
  saved.stats = { ...defaults.stats, ...(saved.stats || {}) };
  saved.history = Array.isArray(saved.history) ? saved.history : [];
  saved.theme = appThemes[saved.theme] ? saved.theme : "focus";
  saved.sound = saved.sound || defaults.sound;
  saved.catDate = /^\d{4}-\d{2}-\d{2}$/.test(saved.catDate || "") ? saved.catDate : DEFAULT_CAT_DATE;
  delete saved.timerUI;
  saved.paletteTheme = colorPalettes()[saved.paletteTheme] ? saved.paletteTheme : defaults.paletteTheme;
  saved.colorAssignments = normalizeColorAssignments(saved.colorAssignments);
  applySectionAssignments(saved);
  return saved;
}

function normalizeBreaks(breaks) {
  const source = breaks || defaults.breaks;
  const shortActivities = source.short?.activities?.length ? source.short.activities : defaults.breaks.short.activities;
  const longActivities = source.long?.activities?.length ? source.long.activities : defaults.breaks.long.activities;
  return {
    short: {
      minutes: clamp(Number(source.short?.minutes || defaults.breaks.short.minutes), 1, 20),
      everyMinutes: normalizeStudyChunkMinutes(source.short?.everyMinutes),
      color: source.short?.color || defaults.breaks.short.color,
      activities: shortActivities,
      emojis: cleanEmojiMap({ ...defaults.breaks.short.emojis, ...(source.short?.emojis || {}) }, defaults.breaks.short.emojis)
    },
    long: {
      minutes: clamp(Number(source.long?.minutes || defaults.breaks.long.minutes), 5, 45),
      color: source.long?.color || defaults.breaks.long.color,
      activities: longActivities,
      emojis: cleanEmojiMap({ ...defaults.breaks.long.emojis, ...(source.long?.emojis || {}) }, defaults.breaks.long.emojis)
    }
  };
}
function colorPalettes() {
  return {
    headspace: { name: "Headspace Mindful", colors: ["#FF632C", "#00A86B", "#3B82F6", "#FFC820", "#9C6ADE"] },
    candy: { name: "Candy Pop", colors: ["#9B5DE5", "#F15BB5", "#FEE440", "#00BBF9", "#00F5D4"] },
    neon: { name: "Neon Pop", colors: ["#390099", "#9E0059", "#FF0054", "#FF5400", "#FFBD00"] },
    fiesta: { name: "Fiesta", colors: ["#F94144", "#F3722C", "#F8961E", "#43AA8B", "#277DA1"] },
    academic: { name: "Academic", colors: ["#203744", "#15616D", "#FFECD1", "#FF7D00", "#78290F"] },
    modern: { name: "Modern Bright", colors: ["#EF476F", "#FFD166", "#06D6A0", "#118AB2", "#073B4C"] },
    aurora: { name: "Aurora", colors: ["#072AC8", "#1E96FC", "#A2D6F9", "#FCF300", "#FFC600"] },
    autumn: { name: "Autumn Fire", colors: ["#FF4E00", "#8EA604", "#F5BB00", "#EC9F05", "#BF3100"] },
    pastel: { name: "Pastel Dream", colors: ["#D3FFB8", "#B6DAFC", "#F4D7F0", "#C9B6FF", "#FFFC98"] },
    royal: { name: "Royal Neon", colors: ["#2D00F7", "#6A00F4", "#8900F2", "#A100F2", "#F20089"] },
    coffee: { name: "Coffee House", colors: ["#26201C", "#49111C", "#F2F4F3", "#A9927D", "#5E503F"] },
    productivity: { name: "Productivity", colors: ["#3C91E6", "#9FD356", "#5B5560", "#FAFFFD", "#FA824C"] },
    focus: { name: "Focus", colors: ["#D00000", "#FFBA08", "#3F88C5", "#164967", "#136F63"] },
    ocean: { name: "Ocean Breeze", colors: ["#247BA0", "#70C1B3", "#B2DBBF", "#F3FFBD", "#FF1654"] }
  };
}
function actionPalettes() {
  return {
    headspace: { play: "#FF632C", pause: "#FFC820", skip: "#3B82F6", end: "#FF5252" },
    candy: { play: "#F15BB5", pause: "#FEE440", skip: "#00BBF9", end: "#9B5DE5" },
    neon: { play: "#FF0054", pause: "#FFBD00", skip: "#390099", end: "#9E0059" },
    fiesta: { play: "#F3722C", pause: "#F8961E", skip: "#277DA1", end: "#F94144" },
    academic: { play: "#15616D", pause: "#FF7D00", skip: "#203744", end: "#78290F" },
    modern: { play: "#06D6A0", pause: "#FFD166", skip: "#118AB2", end: "#EF476F" },
    aurora: { play: "#1E96FC", pause: "#FCF300", skip: "#072AC8", end: "#FFC600" },
    autumn: { play: "#FF4E00", pause: "#F5BB00", skip: "#8EA604", end: "#BF3100" },
    pastel: { play: "#5BBF9B", pause: "#D2B75A", skip: "#8EA4BF", end: "#A45A72" },
    royal: { play: "#00B894", pause: "#C9A24D", skip: "#7B83B7", end: "#8E2D61" },
    coffee: { play: "#4F9B79", pause: "#B99A65", skip: "#7F8B93", end: "#7D3541" },
    productivity: { play: "#1FAE7A", pause: "#C8A64B", skip: "#688CA8", end: "#9A4A3A" },
    focus: { play: "#1FAE8A", pause: "#D3A83F", skip: "#6F8EAA", end: "#8A303A" },
    ocean: { play: "#19A98C", pause: "#C8B85A", skip: "#668BA6", end: "#FF1654" }
  };
}
function sectionTargets() {
  const byId = Object.fromEntries(state.subjects.map((subject) => [subject.id, subject]));
  return [
    { id: "varc", label: "VARC", icon: byId.varc?.emoji || "\uD83D\uDCD6" },
    { id: "dilr", label: "DILR", icon: byId.dilr?.emoji || "\uD83E\uDDE9" },
    { id: "quant", label: "QUANT", icon: byId.quant?.emoji || "\u2211" },
    { id: "short", label: "Short Break", icon: "\uD83D\uDCA7" },
    { id: "long", label: "Long Break", icon: "\uD83E\uDDD8" }
  ];
}
function normalizeColorAssignments(assignments = defaults.colorAssignments) {
  const ids = ["varc", "dilr", "quant", "short", "long"];
  const used = new Set();
  const normalized = {};
  ids.forEach((id, fallback) => {
    let value = Number(assignments?.[id]);
    if (!Number.isInteger(value) || value < 0 || value > 4 || used.has(value)) value = fallback;
    while (used.has(value)) value = (value + 1) % 5;
    used.add(value);
    normalized[id] = value;
  });
  return normalized;
}
function applySectionAssignments(target = state) {
  const palette = colorPalettes()[target.paletteTheme] || colorPalettes().headspace;
  (target.subjects || []).forEach((subject) => {
    if (target.colorAssignments[subject.id] !== undefined) subject.color = palette.colors[target.colorAssignments[subject.id]];
  });
  if (target.breaks?.short) target.breaks.short.color = palette.colors[target.colorAssignments.short];
  if (target.breaks?.long) target.breaks.long.color = palette.colors[target.colorAssignments.long];
}
function assignPaletteColor(colorIndex, sectionId) {
  const assignments = normalizeColorAssignments(state.colorAssignments);
  const currentColorIndex = assignments[sectionId];
  const occupyingSection = Object.keys(assignments).find((key) => key !== sectionId && assignments[key] === colorIndex);
  assignments[sectionId] = colorIndex;
  if (occupyingSection) assignments[occupyingSection] = currentColorIndex;
  state.colorAssignments = normalizeColorAssignments(assignments);
  applySectionAssignments();
  saveState();
  render();
}
function cleanEmoji(value, fallback = "•") {
  return !value || value === "?" || value === "??" || value === "�" ? fallback : value;
}
function cleanEmojiMap(map, fallbackMap) {
  return Object.fromEntries(Object.entries(map).map(([key, value]) => [key, cleanEmoji(value, fallbackMap[key] || recoveryEmoji(key))]));
}
function loadState() {
  try { return { ...structuredClone(defaults), ...JSON.parse(localStorage.getItem(STORAGE_KEY)) }; }
  catch { return structuredClone(defaults); }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function saveActiveSession() {
  if (!live) return localStorage.removeItem(ACTIVE_SESSION_KEY);
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(activeSessionSnapshot()));
}
function normalizeBreakHistory(source) {
  const list = Array.isArray(source) ? source : [];
  return list.map((entry, index) => {
    if (typeof entry === "number") return { id: uid(), durationMs: Math.max(0, entry), resumedAt: "", order: index };
    return {
      id: entry.id || uid(),
      durationMs: Math.max(0, Number(entry.durationMs ?? entry.duration ?? entry.ms ?? 0)),
      resumedAt: typeof entry.resumedAt === "string" ? entry.resumedAt : "",
      order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : index
    };
  }).filter((entry) => entry.durationMs > 0).sort((a, b) => a.order - b.order);
}
function activeSessionSnapshot() {
  if (!live) return null;
  const item = live.timeline?.[live.index] || null;
  const breakHistory = normalizeBreakHistory(live.breakHistory || live.breakHistoryMs);
  const snapshot = {
    ...live,
    savedAt: Date.now(),
    endStep: null,
    endReason: "",
    skipStep: null,
    breakHistory,
    sessionState: live.paused ? "Current Break" : item?.type === "study" ? "Study" : item?.type === "micro" ? "Short Break" : item?.type === "medium" ? "Long Break" : "Unknown",
    scheduledEndAt: new Date(Date.now() + remainingTimelineSeconds() * 1000).toISOString(),
    currentCycle: live.index,
    breakCount: breakHistory.length,
    totalUnplannedBreakMs: live.unplannedBreakMs || 0
  };
  snapshot.breakHistoryMs = breakHistory.map((entry) => entry.durationMs);
  return snapshot;
}
function loadActiveSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY));
    return saved?.timeline?.length ? reconcileActiveSession(saved) : null;
  } catch { return null; }
}
function reconcileActiveSession(saved) {
  const awayMs = Math.max(0, Date.now() - Number(saved.savedAt || Date.now()));
  const elapsedAway = saved.paused ? 0 : awayMs / 1000;
  if (saved.paused) {
    saved.currentBreakMs = (saved.currentBreakMs || 0) + awayMs;
    saved.elapsedMs = (saved.elapsedMs || 0) + awayMs;
  }
  saved.lastTickAt = performance.now();
  saved.endStep = null;
  saved.skipStep = null;
  saved.infoView = saved.infoView || "end";
  saved.currentBreakMs = saved.currentBreakMs || 0;
  saved.breakHistory = normalizeBreakHistory(saved.breakHistory || saved.breakHistoryMs);
  saved.breakHistoryMs = saved.breakHistory.map((entry) => entry.durationMs);
  saved.unplannedBreakMs = saved.breakHistory.reduce((sum, entry) => sum + entry.durationMs, 0);
  saved.infoResetAt = 0;
  saved.infoFlashUntil = 0;
  return advanceSavedSession(saved, elapsedAway);
}
function advanceSavedSession(session, seconds) {
  let remainingSeconds = seconds;
  while (remainingSeconds > 0 && session.index < session.timeline.length) {
    const item = session.timeline[session.index];
    const step = Math.min(session.remaining, remainingSeconds);
    session.remaining -= step;
    remainingSeconds -= step;
    if (item.type === "study") session.focusedMs = (session.focusedMs || 0) + step * 1000;
    session.elapsedMs = (session.elapsedMs || 0) + step * 1000;
    if (session.remaining <= 0) {
      if (item.type === "study") session.completedPomodoros = (session.completedPomodoros || 0) + 1;
      session.index += 1;
      if (session.index >= session.timeline.length) break;
      session.remaining = session.timeline[session.index].minutes * 60;
    }
  }
  return session.index >= session.timeline.length ? null : session;
}
function todayKey() { return new Date().toISOString().slice(0, 10); }
function daysBetween(from, to) { return Math.round((new Date(to) - new Date(from)) / 86400000); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function normalizeStudyChunkMinutes(value) {
  const minutes = Number(value || defaults.breaks.short.everyMinutes);
  return clamp(minutes === 45 ? 50 : minutes, 25, 60);
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function daysRemaining() {
  const target = new Date(`${state.catDate || DEFAULT_CAT_DATE}T00:00:00`);
  if (Number.isNaN(target.getTime())) return 0;
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((target - todayMidnight) / 86400000));
}
function catCountdownLabel() {
  const days = daysRemaining();
  return days > 0 ? `${days} Days to CAT` : "";
}
function fmtHours(hours) {
  const totalSec = Math.round(Number(hours) * 3600);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.round(totalSec / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtPlanDuration(hours) {
  const totalSec = Math.round(Number(hours) * 3600);
  if (totalSec < 60) return `${totalSec}s`;
  const minutes = Math.round(totalSec / 60);
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}
function fmtDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
function fmtClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function applyTheme() {
  const theme = appThemes[state.theme] || appThemes.focus;
  const root = document.documentElement;
  root.style.setProperty("--bg", theme.bg);
  root.style.setProperty("--panel", theme.panel);
  root.style.setProperty("--panel-soft", theme.panelSoft);
  root.style.setProperty("--text", theme.text);
  root.style.setProperty("--muted", theme.muted);
  root.style.setProperty("--line", theme.line);
  root.style.setProperty("--sun", theme.button);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--button-text", theme.buttonText);
  root.style.setProperty("--timer-text", theme.timerText);
  root.style.setProperty("--pill", theme.pill);
  root.style.setProperty("--dialog", theme.dialog);
  const actions = actionPalettes()[state.paletteTheme] || actionPalettes().headspace;
  root.style.setProperty("--action-play", actions.play);
  root.style.setProperty("--action-play-ink", readableInk(actions.play));
  root.style.setProperty("--action-pause", actions.pause);
  root.style.setProperty("--action-pause-ink", readableInk(actions.pause));
  root.style.setProperty("--action-skip", actions.skip);
  root.style.setProperty("--action-skip-ink", readableInk(actions.skip));
  root.style.setProperty("--action-end", actions.end);
  root.style.setProperty("--action-end-ink", readableInk(actions.end));
}

function render() {
  clearInterval(ticker);
  applyTheme();
  const isSessionActive = !!live;
  const isSummaryActive = !!summary;
  const isFlowOpen = !!flow;
  document.body.classList.toggle("pomodoro-active", isSessionActive);
  document.body.classList.toggle("overlay-active", isFlowOpen || !!modal);
  document.body.classList.toggle("summary-active", isSummaryActive);

  if (isSessionActive) {
    app.className = "app-shell live-shell";
    return renderLive();
  }

  if (isSummaryActive) {
    app.className = "app-shell summary-shell";
    app.innerHTML = `
      <main class="screen summary-screen">
        <section class="summary-card">
          <p class="eyebrow">${summary.status === "Completed" ? "Session complete" : "Session ended"}</p>
          <h1>${summary.status === "Completed" ? "Quiet work done." : "Logged honestly."}</h1>
          <div class="metric-grid">
            ${metric(fmtDuration(summary.totalSeconds), "Total time")}
            ${metric(fmtDuration(summary.focusedSeconds), "Focused time")}
            ${metric(summary.completedPomodoros, "Pomodoros")}
            ${metric(summary.status, "Status")}
          </div>
          <button class="primary-btn summary-done-btn" data-action="home">Done</button>
        </section>
      </main>
    `;
    bindEvents();
    return;
  }

  app.className = view === "custom" ? "app-shell tune-shell" : "app-shell dashboard-shell";
  app.innerHTML = `
    <main class="screen">
      <header class="topbar">
        <div class="brand-mark"><div class="logo"></div><div><p class="eyebrow">${view === "dashboard" ? `${daysRemaining()} days to CAT` : "Study OS"}</p>${view === "dashboard" ? "" : "<h1>Focus</h1>"}</div></div>
      </header>
      ${view === "dashboard" ? dashboard() : customization()}
      ${isFlowOpen ? "" : `
      <nav class="bottom-nav">
        <button class="nav-item ${view === "dashboard" ? "active" : ""}" data-view="dashboard">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H4a1 1 0 0 1-1-1V9.5z"/></svg>
          Home
        </button>
        <button class="nav-item ${view === "custom" ? "active" : ""}" data-view="custom">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Tune
        </button>
      </nav>`}
    </main>
    ${flow ? startFlow() : ""}
    ${modal ? modalView() : ""}
  `;
  bindEvents();
}

function dashboard() {
  const rows = [...state.history].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
  return `
    <section class="start-hero">
      <p class="eyebrow">${daysRemaining()} days to CAT</p>
      <h2>Ready for one quiet block?</h2>
      <button class="primary-btn main-start" data-action="open-start">Start</button>
    </section>
    <section class="history-intro">
      <div><p class="eyebrow">Local study history</p><h2>Every session you finish or end appears here.</h2></div>
    </section>
    <section class="history-table-wrap">
      ${rows.length ? historyTable(rows) : emptyHistory()}
    </section>
  `;
}

function emptyHistory() {
  return `<div class="empty-history"><p class="eyebrow">No records yet</p><h2>Start today from zero.</h2><p class="copy">Completed or ended sessions will be saved locally on this device.</p></div>`;
}

function historyTable(rows) {
  return `
    <table class="history-table">
      <thead><tr><th>Date</th><th>Total</th><th>Focus</th><th>Total Unplanned Break</th><th>Pomodoros</th><th>Status</th><th>Reason</th><th></th></tr></thead>
      <tbody>${rows.map((record) => `
        <tr>
          <td>${escapeHtml(record.date)}</td>
          <td>${fmtDuration(record.totalSeconds || 0)}</td>
          <td>${fmtDuration(record.focusedSeconds || 0)}</td>
          <td>${fmtDuration(record.unplannedBreakSeconds || 0)}</td>
          <td>${record.completedPomodoros || 0}</td>
          <td><span class="status-pill ${record.status === "Completed" ? "done" : "early"}">${record.status}</span></td>
          <td class="reason-cell">${escapeHtml(record.reason || "-")}</td>
          <td><button class="tiny-btn table-edit" data-edit-record="${record.id}">Edit</button></td>
        </tr>`).join("")}</tbody>
    </table>`;
}

function metric(value, label) { return `<article class="metric-card"><div class="metric-value">${value}</div><div class="metric-label">${label}</div></article>`; }

function customization() {
  const currentTab = tuneTab || "modes";
  return `
    <div class="tune-wrapper">
      <div class="tune-header">
        <div class="brand-avatar-badge">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="#FF632C"/>
            <circle cx="11" cy="13" r="2.5" fill="#FFFFFF"/>
            <circle cx="21" cy="13" r="2.5" fill="#FFFFFF"/>
            <path d="M10 20 C12 23, 20 23, 22 20" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <p class="eyebrow">Mindful Study OS</p>
          <h2>Tune & Settings</h2>
        </div>
      </div>

      <div class="tune-layout">
        <nav class="tune-sidebar" aria-label="Settings navigation">
          <button class="tune-tab-btn ${currentTab === "modes" ? "active" : ""}" data-tune-tab="modes">
            <span class="tab-icon">🎯</span>
            <span>Modes</span>
          </button>
          <button class="tune-tab-btn ${currentTab === "breaks" ? "active" : ""}" data-tune-tab="breaks">
            <span class="tab-icon">☕</span>
            <span>Breaks</span>
          </button>
          <button class="tune-tab-btn ${currentTab === "theme" ? "active" : ""}" data-tune-tab="theme">
            <span class="tab-icon">🎨</span>
            <span>Colors & Theme</span>
          </button>
          <button class="tune-tab-btn ${currentTab === "sound" ? "active" : ""}" data-tune-tab="sound">
            <span class="tab-icon">🔔</span>
            <span>Sound & Backup</span>
          </button>
        </nav>

        <div class="tune-content-card">
          ${currentTab === "modes" ? tuneModesPanel() : ""}
          ${currentTab === "breaks" ? tuneBreaksPanel() : ""}
          ${currentTab === "theme" ? tuneThemePanel() : ""}
          ${currentTab === "sound" ? tuneSoundPanel() : ""}
        </div>
      </div>
      <p class="app-version">Version 26 · Mindful Focus</p>
    </div>
  `;
}

function tuneModesPanel() {
  return `
    <div class="panel-section">
      <div class="panel-head">
        <div>
          <h2>Study Modes</h2>
          <p class="eyebrow">Configure daily study modes and target hours</p>
        </div>
        <button class="tiny-btn primary-lite" data-action="add-mode">+ Add Custom Mode</button>
      </div>
      <div class="modes-list">
        ${state.modes.map((mode) => `
          <div class="setting-row mode-setting">
            <div class="mode-inputs">
              <input class="field mode-name-field" value="${escapeHtml(mode.name)}" data-mode-name="${mode.id}" placeholder="Mode Name" />
              <input class="field mode-note-field" value="${escapeHtml(mode.note)}" data-mode-note="${mode.id}" placeholder="Short Note" />
            </div>
            <div class="mode-hours-wrap">
              <input class="field hours-field" type="number" min="0.5" max="24" step="0.5" value="${Math.max(0.5, Math.round(mode.hours * 2) / 2)}" data-mode-hours="${mode.id}" style="width: 80px;" />
              <span class="field-unit">hrs (${fmtHours(mode.hours)})</span>
              ${isDefaultMode(mode.id) ? "" : `<button class="tiny-btn danger-lite" data-remove-mode="${mode.id}" title="Delete">✕</button>`}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function tuneBreaksPanel() {
  return `
    <div class="panel-section">
      <div class="panel-head">
        <div>
          <h2>Breaks & Activities</h2>
          <p class="eyebrow">Rest periods between study blocks. Stopwatch counts breaks separately.</p>
        </div>
      </div>
      ${breakEditor("short", "Short Breaks", `Every ${state.breaks.short.everyMinutes}m of study`, state.breaks.short)}
      ${breakEditor("long", "Long Breaks", "After completing a subject block", state.breaks.long)}
    </div>
  `;
}

function tuneThemePanel() {
  return `
    <div class="panel-section">
      <div class="panel-head">
        <div>
          <h2>Colors & Palette</h2>
          <p class="eyebrow">Choose a Headspace color palette and theme</p>
        </div>
      </div>
      <div class="theme-block">
        <h3>Section Colors</h3>
        ${sectionColorEditor()}
      </div>
      <div class="theme-block" style="margin-top: 24px;">
        <h3>Theme Mood</h3>
        <div class="theme-grid">
          ${Object.entries(appThemes).map(([id, theme]) => `
            <button class="theme-card ${state.theme === id ? "active" : ""}" data-theme="${id}" style="--theme-accent:${theme.accent}; --theme-bg:${theme.bg}; --theme-panel:${theme.panel}">
              <span class="theme-dot" style="background:${theme.accent}"></span>
              <strong>${theme.name}</strong>
              <small>${themeMood(id)}</small>
            </button>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function tuneSoundPanel() {
  return `
    <div class="panel-section">
      <div class="panel-head">
        <div>
          <h2>Pomodoro Sound</h2>
          <p class="eyebrow">Select your pomodoro completion alert sound</p>
        </div>
        <button class="tiny-btn primary-lite" data-action="test-chime">Test Sound</button>
      </div>
      <div class="sound-grid">
        ${soundOptions().map((sound) => `
          <button class="chip ${state.sound === sound.id ? "active" : ""}" data-sound="${sound.id}">${sound.name}</button>
        `).join("")}
      </div>

      <div class="panel-sub-card" style="margin-top: 24px;">
        <div class="panel-head">
          <div>
            <h3>CAT Exam Date</h3>
            <p class="eyebrow">Target date for countdown ticker</p>
          </div>
          <label class="mini-field">
            <input class="field" type="date" value="${escapeHtml(state.catDate)}" data-cat-date />
          </label>
        </div>
      </div>

      <div class="panel-sub-card" style="margin-top: 20px;">
        <div class="panel-head">
          <div>
            <h3>Backup & Restore</h3>
            <p class="eyebrow">Export or import your profile JSON</p>
          </div>
        </div>
        <div class="profile-actions">
          <button class="soft-btn" data-action="export-profile">Export JSON</button>
          <label class="soft-btn import-label">Import JSON<input type="file" accept="application/json,.json,.txt" data-import-profile hidden></label>
        </div>
      </div>
    </div>
  `;
}
function colorName(color, index) {
  const names = ["Primary", "Bright", "Warm", "Cool", "Deep"];
  return names[index] || color;
}
function sectionColorEditor() {
  const palettes = colorPalettes();
  const palette = palettes[state.paletteTheme] || palettes.candy;
  const targets = sectionTargets();
  const assignedTo = (index) => targets.find((target) => state.colorAssignments[target.id] === index);
  return `
    <label class="palette-select"><span>Section Color Theme</span><select class="field wide-field" data-palette-theme>${Object.entries(palettes).map(([id, item]) => `<option value="${id}" ${state.paletteTheme === id ? "selected" : ""}>${item.name}</option>`).join("")}</select></label>
    <div class="palette-board">${palette.colors.map((color, index) => {
      const selected = assignedTo(index);
      return `<article class="palette-card" style="--swatch:${color}">
        <div class="palette-meta"><span class="palette-swatch"></span><div><strong>${colorName(color, index)}</strong><code>${color}</code></div></div>
        <div class="assignment-pills">${targets.map((target) => `<button class="assign-pill ${selected?.id === target.id ? "active" : ""}" data-assign-color="${index}:${target.id}"><span>${target.icon}</span>${target.label}</button>`).join("")}</div>
      </article>`;
    }).join("")}</div>`;
}
function timerPalette(subjectColor, isRecovery = false) {
  const base = normalizeHex(subjectColor || (isRecovery ? defaults.breaks.short.color : "#a7d8ff"));
  const accent = mixHex(base, "#f7f3ea", .42);
  return { base, accent, accent2: mixHex(base, "#f7f3ea", .68), ink: readableInk(base) };
}
function normalizeHex(value) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/i.test(raw)) return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  return "#a7d8ff";
}
function hexRgb(hex) {
  const value = parseInt(normalizeHex(hex).slice(1), 16);
  return { r: value >> 16, g: (value >> 8) & 255, b: value & 255 };
}
function mixHex(a, b, amount = .5) {
  const from = hexRgb(a);
  const to = hexRgb(b);
  const mix = (x, y) => Math.round(x + (y - x) * amount).toString(16).padStart(2, "0");
  return `#${mix(from.r, to.r)}${mix(from.g, to.g)}${mix(from.b, to.b)}`;
}
function readableInk(hex) {
  const { r, g, b } = hexRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 165 ? "#0b1620" : "#ffffff";
}
function breakColor(type) {
  return type === "medium" ? state.breaks.long.color || defaults.breaks.long.color : state.breaks.short.color || defaults.breaks.short.color;
}

function breakEditor(type, title, note, config) {
  return `<div class="break-editor"><div class="break-head"><div><strong>${title}</strong><p class="eyebrow">${note}</p></div><label class="mini-field"><span>Minutes</span><input class="field" type="number" min="1" max="45" value="${config.minutes}" data-break-field="${type}:minutes"></label>${type === "short" ? `<label class="mini-field"><span>Every</span><input class="field" type="number" min="25" max="60" value="${config.everyMinutes}" data-break-field="${type}:everyMinutes"></label>` : ""}</div><div class="break-list">${config.activities.map((activity, index) => `<div class="break-row emoji-break-row"><input class="field break-emoji" value="${escapeHtml(config.emojis?.[activity] || recoveryEmoji(activity))}" maxlength="3" data-break-emoji="${type}:${index}"><input class="field break-name" value="${escapeHtml(activity)}" data-break-activity="${type}:${index}"><button class="tiny-btn" data-remove-break="${type}:${index}">Remove</button></div>`).join("")}</div><button class="soft-btn add-break" data-add-break="${type}">Add ${type === "short" ? "short" : "long"} break</button></div>`;
}
function soundOptions() {
  return [
    { id: "steady", name: "Pomodoro High", freq: 2850, gain: .48, wave: "square" },
    { id: "gentle", name: "Pomodoro Mid", freq: 2250, gain: .40, wave: "sine" },
    { id: "soft", name: "Pomodoro Soft", freq: 1750, gain: .35, wave: "sine" },
    { id: "calm", name: "Pomodoro Chime", freq: 1350, gain: .30, wave: "sine" }
  ];
}
function themeMood(id) {
  return { focus: "Clean and bright", monk: "Quiet and grounded", intensive: "Warm and decisive", flow: "Soft and fluid" }[id];
}
function totalSubjectHours() { return state.subjects.reduce((sum, s) => sum + Number(s.hours), 0); }
function allActivities() { return [...new Set([...state.recovery.micro, ...state.recovery.medium])]; }
function themeColor(theme) { return (appThemes[theme] || appThemes.focus).accent; }
function isDefaultMode(id) { return ["focused", "intensive", "monk"].includes(id); }

function openStart() {
  const defaultMode = state.modes[0] || defaults.modes[0];
  flow = { step: "mode", selectedMode: defaultMode.id, editing: false, plan: scalePlan(state.subjects, defaultMode.hours) };
  render();
}

function scalePlan(subjects, targetHours) {
  const total = subjects.reduce((sum, s) => sum + Number(s.hours), 0) || 1;
  const target = Math.max(0.5, Math.round(targetHours * 2) / 2);
  let plan = subjects.map((s) => ({ ...s, hours: Math.max(0.5, Math.round((s.hours / total) * target * 2) / 2) }));
  let delta = Math.round((target - plan.reduce((sum, s) => sum + s.hours, 0)) * 2) / 2;
  plan[plan.length - 1].hours = Math.max(0.5, plan[plan.length - 1].hours + delta);
  return plan;
}

function startFlow() {
  const mode = state.modes.find((m) => m.id === flow.selectedMode) || state.modes[0];
  if (flow.step === "mode") return `
    <div class="overlay"><section class="sheet"><div class="panel-head"><div><p class="eyebrow">Begin gently</p><h2>Choose today</h2></div><button class="icon-btn" data-action="close-flow">x</button></div>
    <div class="mode-grid">${state.modes.map((m) => `<button class="mode-card ${m.id === flow.selectedMode ? "active" : ""}" data-select-mode="${m.id}"><strong>${m.name}</strong><span>${fmtHours(m.hours)} · ${m.note}</span></button>`).join("")}</div>
    <div class="sheet-actions"><button class="primary-btn" data-action="load-plan">Load today's plan</button></div></section></div>`;
  const total = flow.plan.reduce((sum, s) => sum + Number(s.hours), 0);
  const target = mode.hours;
  const isMatch = Math.abs(total - target) < 0.01;
  const valid = isMatch;
  if (flow.step === "breaks") return breakReviewFlow(mode);
  return `
    <div class="overlay"><section class="sheet"><div class="panel-head"><div><p class="eyebrow">${mode.name} · ${fmtHours(mode.hours)} segment</p><h2>Today's plan</h2></div><span class="total-pill ${isMatch ? "good" : "bad"}">${fmtHours(total)}${isMatch ? "" : ` / Target: ${fmtHours(target)}`}</span></div>
    <div class="plan-list">${flow.plan.map((s, i) => `<article class="subject-card" data-index="${i}"><div class="drag subject-icon">${s.emoji || "•"}</div><div><strong>${s.name}</strong><p class="eyebrow">${fmtPlanDuration(s.hours)}</p></div>${flow.editing ? `<div class="subject-controls"><div class="subject-stepper"><button data-nudge="${i}:-30">-</button><button data-nudge="${i}:30">+</button></div><div class="subject-reorder"><button data-move-subject="${i}:-1" ${i === 0 ? "disabled" : ""}>↑</button><button data-move-subject="${i}:1" ${i === flow.plan.length - 1 ? "disabled" : ""}>↓</button></div></div>` : ""}</article>`).join("")}</div>
    <div class="sheet-actions"><button class="primary-btn" data-action="confirm-plan" ${valid ? "" : "disabled"}>Confirm and lock</button><button class="soft-btn" data-action="toggle-edit">${flow.editing ? "Done editing" : "Edit"}</button><button class="tiny-btn" data-action="close-flow">Cancel</button></div></section></div>`;
}

function breakReviewFlow(mode) {
  return `
    <div class="overlay"><section class="sheet"><div class="panel-head"><div><p class="eyebrow">${mode.name} · break structure</p><h2>Review breaks</h2></div><button class="icon-btn" data-action="close-flow">x</button></div>
    <div class="break-plan-list">${breakPlanRows()}</div>
    <div class="sheet-actions"><button class="primary-btn" data-action="start-reviewed-session">Start session</button><button class="soft-btn" data-action="back-to-plan">Back to plan</button></div></section></div>`;
}

function breakPlanRows() {
  return flow.timeline.map((item, index) => item.type === "study" ? `
      <article class="break-plan-row is-study"><span>${item.emoji || "•"}</span><div><strong>${item.subject}</strong><p class="eyebrow">${fmtPlanDuration(item.minutes / 60)} study</p></div></article>` : `
      <article class="break-plan-row"><span>${item.emoji || "•"}</span><div><strong>${item.subject}</strong><p class="eyebrow">${fmtPlanDuration(item.minutes / 60)} break</p></div><select class="field break-select" data-break-kind="${index}"><option value="micro" ${item.type === "micro" ? "selected" : ""}>Short</option><option value="medium" ${item.type === "medium" ? "selected" : ""}>Medium</option><option value="none">Remove</option>${canMergeAround(index) ? `<option value="merge">Remove + merge</option>` : ""}</select><select class="field break-activity-select" data-break-choice="${index}">${breakChoices(item.type).map((choice) => `<option ${choice === item.subject ? "selected" : ""}>${escapeHtml(choice)}</option>`).join("")}</select></article>`).join("");
}

function breakChoices(type) {
  return (type === "medium" ? state.breaks.long.activities : state.breaks.short.activities).filter(Boolean);
}
function refreshBreakReviewRows() {
  const list = document.querySelector(".break-plan-list");
  const sheet = document.querySelector(".sheet");
  const pageY = window.scrollY;
  const scrollTop = sheet?.scrollTop || 0;
  if (!list) return render();
  list.innerHTML = breakPlanRows();
  bindBreakReviewEvents();
  requestAnimationFrame(() => {
    if (sheet) sheet.scrollTop = scrollTop;
    window.scrollTo(0, pageY);
  });
}
function breakEmoji(type, activity) {
  return (type === "medium" ? state.breaks.long.emojis : state.breaks.short.emojis)?.[activity] || recoveryEmoji(activity);
}
function canMergeAround(index) {
  const before = flow.timeline[index - 1];
  const after = flow.timeline[index + 1];
  return before?.type === "study" && after?.type === "study" && before.subject === after.subject && before.minutes + after.minutes <= 60;
}
function mergeAroundBreak(index) {
  if (!canMergeAround(index)) return flow.timeline.splice(index, 1);
  flow.timeline[index - 1].minutes += flow.timeline[index + 1].minutes;
  flow.timeline.splice(index, 2);
}

function buildTimeline(plan) {
  const timeline = [];
  let lastRecovery = "";
  const shortBreak = state.breaks.short;
  const longBreak = state.breaks.long;
  const maxStudyChunk = normalizeStudyChunkMinutes(shortBreak.everyMinutes);

  plan.forEach((subject, subjectIndex) => {
    let remainingStudyMinutes = Math.max(30, subject.hours * 60);
    while (remainingStudyMinutes > 0) {
      const minutes = Math.min(maxStudyChunk, remainingStudyMinutes);
      timeline.push({ type: "study", subject: subject.name, minutes, color: subject.color, emoji: subject.emoji || "•" });
      remainingStudyMinutes -= minutes;
      if (remainingStudyMinutes > 0.0001 && shortBreak.activities.length) {
        const activity = pickActivity(shortBreak.activities, lastRecovery);
        lastRecovery = activity;
        timeline.push({ type: "micro", subject: activity, minutes: shortBreak.minutes, color: breakColor("micro"), emoji: breakEmoji("micro", activity) });
      }
    }
    if (subjectIndex < plan.length - 1 && longBreak.activities.length) {
      const activity = pickActivity(longBreak.activities, lastRecovery);
      lastRecovery = activity;
      timeline.push({ type: "medium", subject: activity, minutes: longBreak.minutes, color: breakColor("medium"), emoji: breakEmoji("medium", activity) });
    }
  });
  return timeline;
}
function pickActivity(list, previous) {
  const pool = list.filter(Boolean);
  return pool.find((item) => item !== previous) || pool[0];
}

async function startLive() {
  flow.plan = flow.plan.map((s) => ({ ...s, id: s.id || uid() }));
  const timeline = flow.timeline || buildTimeline(flow.plan);
  flow = null;
  await runStartupSequence(timeline);
}

async function runStartupSequence(timeline) {
  await playMainNotification();
  app.className = "app-shell live-shell";
  app.innerHTML = `<main class="countdown-start launch-intro"><p>Locking in</p><h1>Starting study session now</h1></main>`;
  setTimeout(() => {
    app.innerHTML = `<main class="countdown-start"><p>Starting in...</p><div class="countdown-number" data-start-count>3</div></main>`;
  }, 2000);
  [3, 2, 1].forEach((num, i) => {
    setTimeout(() => {
      const el = document.querySelector("[data-start-count]");
      if (el) {
        el.textContent = num;
        el.classList.remove("pulse");
        void el.offsetWidth;
        el.classList.add("pulse");
      }
      playCountdownBeep();
    }, 2000 + i * 1000);
  });
  setTimeout(() => beginLive(timeline), 5100);
}

function beginLive(timeline) {
  live = {
    id: uid(), timeline, index: 0, remaining: timeline[0].minutes * 60, paused: false,
    startedAt: Date.now(), elapsedMs: 0, completedPomodoros: 0,
    focusedMs: 0, unplannedBreakMs: 0, currentBreakMs: 0, breakHistoryMs: [], lastTickAt: performance.now(), endStep: null, endReason: "", skipStep: null, infoView: "end", infoResetAt: 0, infoFlashUntil: 0
  };
  saveActiveSession();
  render();
}

function renderLive() {
  clearInterval(ticker);
  const item = live.timeline[live.index];
  const duration = item.minutes * 60;
  const itemLeft = clamp((live.remaining / duration) * 100, 0, 100);
  const isRecovery = item.type !== "study";
  const predictedEnd = new Date(Date.now() + remainingTimelineSeconds() * 1000);
  const upcoming = live.timeline.slice(live.index + 1);
  const totalCommitmentSeconds = Math.floor((live.elapsedMs || 0) / 1000);
  const palette = timerPalette(item.color, isRecovery);
  const liveStateClass = `${isRecovery ? "is-scheduled-break" : "is-study-session"} ${live.paused ? "is-unplanned-break" : ""}`;
  app.innerHTML = `
    <main class="study-mode ${liveStateClass}" style="--card-color:${palette.base}; --timer-accent:${palette.accent}; --timer-accent-2:${palette.accent2}; --timer-ink:${palette.ink}; --card-left:${itemLeft}%; --black-width:${100 - itemLeft}%">
      <section class="standby-card ${isRecovery ? "recovery-card" : ""}">
        <div class="empty-layer"></div>
        <div class="card-grain"></div>
        ${sessionInfoCard(predictedEnd, totalCommitmentSeconds)}
        ${breakHistoryCard()}
        ${isRecovery || live.paused ? `<button class="end-session-btn" data-action="request-end-session">End</button>` : ""}
        <div class="standby-content">
          <div class="session-kicker"><p class="eyebrow">${isRecovery ? recoveryLabel(item.type) : "Now studying"}</p><div class="session-emoji">${item.emoji || "•"}</div></div>
          <div class="subject">${item.subject}</div>
          <div class="timer-wrap"><div class="countdown" data-countdown>${fmtClock(live.remaining)}</div></div>
          <div class="live-actions">${isRecovery ? `<button class="skip-break-btn" data-action="request-skip-break">Skip Break</button>` : `<button class="pause-btn ${live.paused ? "is-paused" : ""}" data-action="pause-live">${live.paused ? "Resume" : "Unplanned Break"}</button>`}</div>
        </div>
      </section>
      <aside class="floating-stack">${upcoming.map((x) => `<div class="stack-card next-${x.type}" style="--mini-color:${x.color}"><span>${x.emoji || "•"}</span><strong>${x.subject}</strong><small><b>${x.minutes}m</b> ${x.type === "study" ? "study" : "break"}</small></div>`).join("")}</aside>
      ${live.endStep ? endSessionDialog() : ""}
      ${live.skipStep ? skipBreakDialog() : ""}
    </main>
  `;
  bindEvents();
  setupUpcomingRail();
  ticker = setInterval(tick, 1000);
}

function sessionInfoCard(predictedEnd, totalCommitmentSeconds) {
  const view = live.paused ? "paused" : (live.infoView || "end");
  const rows = live.paused
    ? [
        ["Current Break", fmtDuration(Math.floor((live.currentBreakMs || 0) / 1000)), "current-break"]
      ]
    : [sessionInfoRow(view, predictedEnd, totalCommitmentSeconds)];
  return `${live.paused ? pausedSessionEndCard(predictedEnd) : ""}<button class="session-info-card ${live.paused ? "is-paused" : ""} is-view-${view}" data-action="cycle-session-info">${sessionInfoRowsHtml(rows)}</button>`;
}
function pausedSessionEndCard(predictedEnd) {
  return `<aside class="session-info-card paused-end-card is-view-end"><span class="session-info-row is-predicted"><small>Session Ends</small><strong data-session-info="paused-predicted">${formatPredictedEnd(predictedEnd)}</strong></span></aside>`;
}
function sessionInfoRowsHtml(rows) {
  return rows.map(([label, value, key, extra]) => `<span class="session-info-row is-${key}"><small>${label}</small><strong data-session-info="${key}">${value}</strong>${extra || ""}</span>`).join("");
}
function sessionInfoRow(view, predictedEnd, totalCommitmentSeconds) {
  if (view === "resumeSummary") return ["Total Unplanned Break", unplannedBreakSummary(), "break-total"];
  if (view === "breakTotal") return ["Total Unplanned Break", unplannedBreakSummary(), "break-total"];
  if (view === "total") return ["Total Session Time", fmtDuration(totalCommitmentSeconds), "total"];
  if (view === "focused") return ["Focused Time", fmtFocusedDuration(Math.floor((live.focusedMs || 0) / 1000)), "focused"];
  const cat = catCountdownLabel();
  return ["Session Ends", formatPredictedEnd(predictedEnd), "predicted", cat ? `<em class="cat-countdown" data-cat-countdown>${cat}</em>` : ""];
}
function breakHistoryCard() {
  const visible = live?.paused || live?.infoView === "breakTotal";
  const entries = normalizeBreakHistory(live?.breakHistory || live?.breakHistoryMs);
  return `<section class="break-history-card ${visible ? "is-visible" : ""}" aria-hidden="${visible ? "false" : "true"}">
    <div class="break-history-head"><small>UNPLANNED BREAKS</small></div>
    <div class="break-history-list">
      ${entries.length ? entries.map((entry, index) => `<div class="break-history-entry" style="--entry-index:${Math.min(index, 6)}"><span class="break-dot">•</span><strong>${fmtBreakEntryDuration(entry.durationMs)}</strong><time>${formatBreakResumeTime(entry.resumedAt)}</time></div>`).join("") : `<div class="break-history-empty">No unplanned breaks yet.<br><span>Great job staying focused.</span></div>`}
    </div>
  </section>`;
}
function unplannedBreakSummary() {
  const count = normalizeBreakHistory(live.breakHistory || live.breakHistoryMs).length;
  return `${fmtDuration(Math.floor((live.unplannedBreakMs || 0) / 1000))} • ${count} Breaks`;
}
function breakHistoryItems(prefix = []) {
  const history = normalizeBreakHistory(live.breakHistory || live.breakHistoryMs).map((entry) => entry.durationMs);
  return [...prefix.filter(Boolean), ...history].map((ms) => fmtCompactDuration(Math.floor(ms / 1000)));
}
function breakHistoryText(prefix = []) {
  return breakHistoryItems(prefix).join(" | ") || "0m";
}
function breakHistoryHtml(prefix = []) {
  return breakHistoryItems(prefix).join(" &bull; ") || "0m";
}
function fmtCompactDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${Math.max(1, m)}m`;
}
function fmtFocusedDuration(seconds) {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m`;
}
function fmtBreakEntryDuration(ms) {
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h && m) return `${h} hr ${String(m).padStart(2, "0")} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
}
function formatBreakResumeTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}
function cycleSessionInfo() {
  if (!live || live.paused) return;
  playCardCycleSound();
  const order = ["end", "focused", "total", "breakTotal"];
  const current = order.includes(live.infoView) ? live.infoView : "end";
  live.infoView = order[(order.indexOf(current) + 1) % order.length];
  live.infoResetAt = Date.now() + 4000;
  live.infoFlashUntil = 0;
  saveActiveSession();
  refreshSessionInfoCard();
}
function refreshSessionInfoCard() {
  const card = document.querySelector(".session-info-card");
  if (!card || !live) return renderLive();
  const predictedEnd = new Date(Date.now() + remainingTimelineSeconds() * 1000);
  const totalCommitmentSeconds = Math.floor((live.elapsedMs || 0) / 1000);
  const view = live.paused ? "paused" : (live.infoView || "end");
  const rows = live.paused ? [["Current Break", fmtDuration(Math.floor((live.currentBreakMs || 0) / 1000)), "current-break"]] : [sessionInfoRow(view, predictedEnd, totalCommitmentSeconds)];
  card.className = `session-info-card ${live.paused ? "is-paused" : ""} is-view-${view}`;
  card.innerHTML = sessionInfoRowsHtml(rows);
  refreshBreakHistoryCard();
  bindEvents();
}
function refreshBreakHistoryCard() {
  const card = document.querySelector(".break-history-card");
  if (!card || !live) return;
  const next = document.createElement("div");
  next.innerHTML = breakHistoryCard().trim();
  card.replaceWith(next.firstElementChild);
}
function remainingTimelineSeconds() {
  if (!live) return 0;
  return live.timeline.slice(live.index + 1).reduce((sum, item) => sum + item.minutes * 60, Math.max(0, live.remaining));
}
function formatPredictedEnd(date) {
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
  const day = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${time} \u2022 ${day}`;
}function skipBreakDialog() {
  return `
    <div class="overlay end-overlay"><section class="sheet confirm-sheet"><p class="eyebrow">Tiny check-in</p><h2>Skip this break? \uD83C\uDF3F</h2><p class="copy">Your brain might need these few minutes. If you still feel clear and ready, you can return to study now.</p><div class="sheet-actions"><button class="soft-btn" data-action="keep-break">Take the break</button><button class="tiny-btn skip-confirm" data-action="confirm-skip-break">Yes, skip break</button></div></section></div>`;
}

function endSessionDialog() {
  if (live.endStep === "confirm") return `
    <div class="overlay end-overlay"><section class="sheet confirm-sheet"><p class="eyebrow">A pause to choose</p><h2>Do you really want to end today's study session?</h2><p class="copy">Remember why you started. If your energy is gone, ending honestly still counts.</p><div class="sheet-actions"><button class="soft-btn" data-action="resume-session">Continue studying</button><button class="tiny-btn danger-lite" data-action="show-end-reason">End session</button></div></section></div>`;
  return `
    <div class="overlay end-overlay"><section class="sheet confirm-sheet"><p class="eyebrow">Before you close</p><h2>What made you end early?</h2><textarea class="reason-input" data-end-reason placeholder="Write one honest sentence...">${escapeHtml(live.endReason || "")}</textarea><div class="sheet-actions"><button class="primary-btn" data-action="confirm-end-session" ${live.endReason.trim() ? "" : "disabled"}>Save and end</button><button class="tiny-btn" data-action="resume-session">Return to session</button></div></section></div>`;
}

function recoveryLabel(type) { return type === "micro" ? "Micro recovery" : "Medium recovery"; }
function recoveryEmoji(activity) {
  const key = activity.toLowerCase();
  if (key.includes("water")) return "\uD83D\uDCA7";
  if (key.includes("stand") || key.includes("stretch")) return "\uD83E\uDD38";
  if (key.includes("balcony") || key.includes("walk")) return "\uD83C\uDF3F";
  if (key.includes("breath")) return "\u25CC";
  if (key.includes("meditat")) return "\uD83E\uDDD8";
  if (key.includes("scribbl") || key.includes("write")) return "\u270E";
  if (key.includes("coffee")) return "\u2615";
  return "?";
}function tick() {
  if (!live) return;
  const now = performance.now();
  const deltaMs = Math.max(0, now - live.lastTickAt);
  const delta = deltaMs / 1000;
  live.lastTickAt = now;
  live.elapsedMs = (live.elapsedMs || 0) + deltaMs;
  if (live.paused) {
    live.currentBreakMs = (live.currentBreakMs || 0) + deltaMs;
  }
  if (!live.paused && delta) {
    const item = live.timeline[live.index];
    if (item.type === "study") live.focusedMs = (live.focusedMs || 0) + deltaMs;
    live.remaining -= delta;
  }
  saveActiveSession();
  if (!live.paused && live.remaining <= 0) {
    completeCurrentBlock();
    return;
  }
  updateLiveDisplay();
}

function updateLiveDisplay() {
  if (!live) return;
  const totalCommitmentSeconds = Math.floor((live.elapsedMs || 0) / 1000);
  const countdown = document.querySelector("[data-countdown]");
  if (countdown) countdown.textContent = fmtClock(live.remaining);
  const now = Date.now();
  if (!live.paused && live.infoResetAt && now >= live.infoResetAt && live.infoView !== "end") {
    live.infoView = "end";
    live.infoResetAt = 0;
    return renderLive();
  }
  if (!live.paused && live.infoFlashUntil && now >= live.infoFlashUntil) {
    live.infoView = "end";
    live.infoFlashUntil = 0;
    return renderLive();
  }
  const predicted = document.querySelector("[data-session-info=\"predicted\"]");
  if (predicted) predicted.textContent = formatPredictedEnd(new Date(Date.now() + remainingTimelineSeconds() * 1000));
  const pausedPredicted = document.querySelector("[data-session-info=\"paused-predicted\"]");
  if (pausedPredicted) pausedPredicted.textContent = formatPredictedEnd(new Date(Date.now() + remainingTimelineSeconds() * 1000));
  const breakTotal = document.querySelector("[data-session-info=\"break-total\"]");
  if (breakTotal) breakTotal.textContent = unplannedBreakSummary();
  const resumeSummary = document.querySelector("[data-session-info=\"resume-summary\"]");
  if (resumeSummary) resumeSummary.textContent = "";
  const currentBreak = document.querySelector("[data-session-info=\"current-break\"]");
  if (currentBreak) currentBreak.textContent = fmtDuration(Math.floor((live.currentBreakMs || 0)/1000));
  const total = document.querySelector("[data-session-info=\"total\"]");
  if (total) total.textContent = fmtDuration(totalCommitmentSeconds);
  const focused = document.querySelector("[data-session-info=\"focused\"]");
  if (focused) focused.textContent = fmtFocusedDuration(Math.floor((live.focusedMs || 0) / 1000));
  const catCountdown = document.querySelector("[data-cat-countdown]");
  if (catCountdown) catCountdown.textContent = catCountdownLabel();
  const item = live.timeline[live.index];
  const duration = item.minutes * 60;
  const itemLeft = clamp((live.remaining / duration) * 100, 0, 100);
  const mode = document.querySelector(".study-mode");
  if (mode) {
    mode.style.setProperty("--card-left", `${itemLeft}%`);
    mode.style.setProperty("--black-width", `${100 - itemLeft}%`);
  }
}

function completeCurrentBlock() {
  if (live.celebrating) return;
  const item = live.timeline[live.index];
  if (item.type === "study") live.completedPomodoros += 1;
  playMainNotification();
  if (item.type === "study") return showCompletionCelebration(item);
  advanceToNextBlock();
}

function advanceToNextBlock() {
  live.celebrating = false;
  live.index += 1;
  if (live.index >= live.timeline.length) return finishSession("Completed");
  live.remaining = live.timeline[live.index].minutes * 60;
  live.lastTickAt = performance.now();
  saveActiveSession();
  renderLive();
}

function showCompletionCelebration(item) {
  live.celebrating = true;
  const isBlockDone = !live.timeline.slice(live.index + 1).some((x) => x.type === "study" && x.subject === item.subject);
  const title = isBlockDone ? `${item.subject} Completed!` : ["Good Job!", "Well Done!", "Nice Work!"][Math.floor(Math.random() * 3)];
  const quote = randomQuote();
  const overlay = document.createElement("div");
  overlay.className = `celebration ${isBlockDone ? "big" : "small"}`;
  overlay.innerHTML = `<div class="celebration-card"><div class="burst">${isBlockDone ? "🏆" : "✨"}</div><h2>${title}</h2>${isBlockDone ? `<p>${quote}</p>` : ""}<div class="particles"><i></i><i></i><i></i><i></i><i></i></div></div>`;
  document.querySelector(".study-mode")?.appendChild(overlay);
  setTimeout(advanceToNextBlock, isBlockDone ? 7000 : 3000);
}

function randomQuote() {
  const quotes = ["🔥 Keep your momentum going.", "📚 Small progress every day becomes massive success.", "💪 One session closer to your goal.", "🚀 Consistency beats intensity.", "🎯 Focus now. Celebrate later.", "🏆 Success is built one focused session at a time."];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

function finishSession(status = "Completed", reason = "") {
  clearInterval(ticker);
  const totalSeconds = Math.max(0, Math.floor((live.elapsedMs || 0) / 1000));
  const focusedSeconds = Math.max(0, Math.floor((live.focusedMs || 0) / 1000));
  const completedPomodoros = live.completedPomodoros;
  const completedSubjects = countCompletedSubjects();
  const record = {
    id: live.id,
    date: todayKey(),
    createdAt: new Date().toISOString(),
    totalSeconds,
    focusedSeconds,
    unplannedBreakSeconds: Math.floor((live.unplannedBreakMs || 0) / 1000),
    completedPomodoros,
    status,
    reason: reason.trim()
  };
  state.history = [record, ...state.history];
  if (status === "Completed") applySessionStats(focusedSeconds / 3600, completedSubjects);
  saveState();
  localStorage.removeItem(ACTIVE_SESSION_KEY);
  live = null;
  summary = { status, totalSeconds, focusedSeconds, completedPomodoros };
  render();
}

function countCompletedSubjects() {
  const studied = live.timeline.slice(0, live.index).filter((x) => x.type === "study").map((x) => x.subject);
  return new Set(studied).size;
}

function applySessionStats(hours, subjects) {
  const today = todayKey();
  const sameDay = state.stats.lastStudyDate === today;
  const yesterday = state.stats.lastStudyDate && daysBetween(state.stats.lastStudyDate, today) === 1;
  state.stats.totalHours = Math.round((Number(state.stats.totalHours || 0) + hours) * 10) / 10;
  state.stats.completedSubjects = Number(state.stats.completedSubjects || 0) + subjects;
  if (!sameDay) {
    state.stats.studyDays = Number(state.stats.studyDays || 0) + 1;
    state.stats.streak = yesterday ? Number(state.stats.streak || 0) + 1 : 1;
    state.stats.lastStudyDate = today;
    state.stats.heat = [...(state.stats.heat || Array(42).fill(0)).slice(-41), heatLevel(hours)];
  } else {
    const heat = [...(state.stats.heat || Array(42).fill(0))];
    heat[heat.length - 1] = Math.max(heat[heat.length - 1] || 0, heatLevel(hours));
    state.stats.heat = heat;
  }
  state.stats.averageHours = state.stats.studyDays ? Math.round((state.stats.totalHours / state.stats.studyDays) * 10) / 10 : 0;
}
function heatLevel(hours) { return hours >= 8 ? 3 : hours >= 4 ? 2 : hours > 0 ? 1 : 0; }

async function playCompletionChime() { return playMainNotification(); }

function playHTMLAudioBeep(selectedObj) {
  try {
    const selected = selectedObj || soundOptions().find((s) => s.id === state.sound) || soundOptions()[0];
    const baseFreq = selected.freq || 2250;
    const sampleRate = 16000;
    const durationSec = 2.0; // Solid 2-second continuous beeeeeep
    const numSamples = Math.floor(sampleRate * durationSec);
    const buffer = new ArrayBuffer(44 + numSamples);
    const view = new DataView(buffer);
    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, "RIFF");
    view.setUint32(4, 36 + numSamples, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    writeString(36, "data");
    view.setUint32(40, numSamples, true);

    const isSquare = selected.wave === "square";
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let amp = 0.8;
      if (t < 0.02) amp *= (t / 0.02);
      if (t > durationSec - 0.05) amp *= ((durationSec - t) / 0.05);
      amp = Math.max(0, amp);

      const raw = isSquare
        ? (Math.sin(2 * Math.PI * baseFreq * t) >= 0 ? 0.7 : -0.7)
        : Math.sin(2 * Math.PI * baseFreq * t);
      const val = raw * amp;
      view.setUint8(44 + i, Math.floor(((val * 0.45) + 1) * 127));
    }
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const audio = new Audio("data:audio/wav;base64," + btoa(binary));
    audio.play().catch(() => {});
  } catch {}
}

async function playMainNotification(retried = false) {
  try {
    if (navigator.vibrate) {
      try { navigator.vibrate([200, 100, 400]); } catch {}
    }
    await unlockAudio();
    const selected = soundOptions().find((sound) => sound.id === state.sound) || soundOptions()[0];

    if (!audioContext || audioContext.state !== "running") {
      playHTMLAudioBeep(selected);
      showAudioFallback();
      return true;
    }

    const now = audioContext.currentTime;
    const duration = 2.0; // 2.0 seconds solid single beeeeeeeeep
    const baseFreq = selected.freq || 950;
    const baseGain = selected.gain || 0.25;

    const master = audioContext.createGain();
    master.gain.setValueAtTime(1, now);
    master.connect(audioContext.destination);

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = selected.wave || "sine";
    osc.frequency.setValueAtTime(baseFreq, now);

    // Smooth single continuous tone envelope
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(baseGain, now + 0.02);
    gain.gain.setValueAtTime(baseGain, now + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.05);

    lastSoundReady = true;
    return true;
  } catch (error) {
    const selected = soundOptions().find((sound) => sound.id === state.sound) || soundOptions()[0];
    playHTMLAudioBeep(selected);
    showAudioFallback();
    return false;
  }
}

function playHTMLAudioTestChime() {
  try {
    const sampleRate = 16000;
    const durationSec = 0.8;
    const numSamples = Math.floor(sampleRate * durationSec);
    const buffer = new ArrayBuffer(44 + numSamples);
    const view = new DataView(buffer);
    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, "RIFF");
    view.setUint32(4, 36 + numSamples, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    writeString(36, "data");
    view.setUint32(40, numSamples, true);

    const notes = [
      { start: 0.0, end: 0.30, freq: 523.25 },
      { start: 0.22, end: 0.55, freq: 659.25 },
      { start: 0.44, end: 0.80, freq: 783.99 }
    ];

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let totalVal = 0;
      notes.forEach((n) => {
        if (t >= n.start && t <= n.end) {
          const relT = t - n.start;
          const dur = n.end - n.start;
          let amp = 0.5;
          if (relT < 0.02) amp *= (relT / 0.02);
          if (relT > dur - 0.05) amp *= ((dur - relT) / 0.05);
          totalVal += Math.sin(2 * Math.PI * n.freq * t) * Math.max(0, amp);
        }
      });
      view.setUint8(44 + i, Math.floor(((totalVal * 0.3) + 1) * 127));
    }
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const audio = new Audio("data:audio/wav;base64," + btoa(binary));
    audio.play().catch(() => {});
  } catch {}
}

async function playTestChimeSound() {
  try {
    await unlockAudio();
    if (!audioContext || audioContext.state !== "running") {
      playHTMLAudioTestChime();
      showAudioFallback();
      return true;
    }
    const now = audioContext.currentTime;
    const master = audioContext.createGain();
    master.gain.setValueAtTime(0.85, now);
    master.connect(audioContext.destination);

    const notes = [
      { delay: 0.0, duration: 0.35, freq: 523.25 },
      { delay: 0.18, duration: 0.35, freq: 659.25 },
      { delay: 0.36, duration: 0.45, freq: 783.99 }
    ];

    notes.forEach((n) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(n.freq, now + n.delay);

      gain.gain.setValueAtTime(0.0001, now + n.delay);
      gain.gain.linearRampToValueAtTime(0.35, now + n.delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.delay + n.duration);

      osc.connect(gain).connect(master);
      osc.start(now + n.delay);
      osc.stop(now + n.delay + n.duration + 0.02);
    });

    lastSoundReady = true;
    return true;
  } catch {
    playHTMLAudioTestChime();
    showAudioFallback();
    return false;
  }
}

async function playCountdownBeep() {
  try {
    await unlockAudio();
    if (!audioContext || audioContext.state !== "running") {
      playHTMLAudioBeep();
      return;
    }
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1150, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch {
    playHTMLAudioBeep();
  }
}

async function playToggleSound() {
  try {
    await unlockAudio();
    if (!audioContext || audioContext.state !== "running") return;
    const now = audioContext.currentTime;
    [live?.paused ? 740 : 520, live?.paused ? 520 : 740].forEach((freq, index) => {
      const start = now + index * 0.055;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.09, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  } catch {}
}

function resetAudioSystem() {
  try { if (audioContext && audioContext.state !== "closed") audioContext.close(); } catch {}
  audioContext = null;
  lastSoundReady = false;
}

function createAudioContext() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  let context;
  try { context = new Context({ latencyHint: "interactive" }); } catch { context = new Context(); }
  return context;
}

async function verifyAudioPlayback() {
  if (!audioContext || audioContext.state !== "running") return false;
  return true;
}

async function recoverAudioSystem(force = false) {
  try {
    if (!window.AudioContext && !window.webkitAudioContext) return false;
    if (!audioContext || audioContext.state === "closed") {
      audioContext = createAudioContext();
    }
    if (!audioContext) return false;
    if (audioContext.state === "suspended") {
      await audioContext.resume().catch(() => {});
    }
    lastSoundReady = audioContext.state === "running";
    return lastSoundReady;
  } catch {
    lastSoundReady = false;
    return false;
  }
}

async function unlockAudio() {
  await recoverAudioSystem();
}
async function checkSoundReady(show = true) {
  let ready = await recoverAudioSystem();
  if (!ready) ready = await recoverAudioSystem(true);
  if (show) showSoundStatus(ready);
  return ready;
}
function showSoundStatus(ready) {
  document.querySelector(".sound-status")?.remove();
  const el = document.createElement("div");
  el.className = `sound-status ${ready ? "is-ready" : "is-failed"}`;
  el.innerHTML = `<span>${ready ? "✓ Sound Ready" : "⚠ Sound Not Ready"}</span><button type="button" data-action="test-chime">Test</button>`;
  document.body.appendChild(el);
  const statusLabel = el.querySelector("span");
  const statusButton = el.querySelector("button");
  if (statusLabel) statusLabel.textContent = ready ? "Sound Ready" : "Sound Unavailable";
  if (statusButton) statusButton.textContent = ready ? "Test" : "Retry";
  el.querySelector("button")?.addEventListener("click", ready ? testSelectedSound : retryAudioRecovery);
  clearTimeout(soundStatusTimer);
  soundStatusTimer = setTimeout(() => {
    el.classList.add("is-hiding");
    setTimeout(() => el.remove(), 260);
  }, 6000);
}
async function retryAudioRecovery() {
  const button = document.querySelector(".sound-status button");
  if (button) button.disabled = true;
  const ok = await recoverAudioSystem(true);
  showSoundStatus(ok);
  const status = document.querySelector(".sound-status span");
  if (status && ok) status.textContent = "Sound Fixed";
  if (status && !ok) status.textContent = "Unable to Restore Audio";
}
function showAudioFallback() {
  const target = document.querySelector(".study-mode") || app;
  const banner = document.createElement("div");
  banner.className = "audio-fallback";
  banner.textContent = "Time's Up";
  target.appendChild(banner);
  setTimeout(() => banner.remove(), 2400);
}
function modalView() {
  if (modal.type === "edit-confirm") return `<div class="overlay"><section class="sheet"><p class="eyebrow">Edit history</p><h2>Are you sure you want to edit this study record?</h2><p class="copy">A little friction keeps your record trustworthy.</p><div class="sheet-actions"><button class="primary-btn" data-action="open-edit-record">Yes, edit</button><button class="tiny-btn" data-action="close-modal">Cancel</button></div></section></div>`;
  if (modal.type === "edit-record") {
    const record = modal.draft;
    if (!record) return "";
    return `<div class="overlay"><section class="sheet"><p class="eyebrow">Study record</p><h2>Edit carefully</h2><label class="edit-label">Date<input class="field wide-field" data-record-field="date" value="${escapeHtml(record.date)}"></label><label class="edit-label">Total minutes<input class="field wide-field" type="number" min="0" data-record-field="totalMinutes" value="${Math.round((record.totalSeconds || 0) / 60)}"></label><label class="edit-label">Focused minutes<input class="field wide-field" type="number" min="0" data-record-field="focusedMinutes" value="${Math.round((record.focusedSeconds || 0) / 60)}"></label><label class="edit-label">Pomodoros<input class="field wide-field" type="number" min="0" data-record-field="completedPomodoros" value="${record.completedPomodoros || 0}"></label><label class="edit-label">Status<select class="field wide-field" data-record-field="status"><option ${record.status === "Completed" ? "selected" : ""}>Completed</option><option ${record.status === "Ended Early" ? "selected" : ""}>Ended Early</option></select></label><label class="edit-label">Reason<textarea class="reason-input compact" data-record-field="reason">${escapeHtml(record.reason || "")}</textarea></label><div class="sheet-actions"><button class="primary-btn" data-action="save-record-edit">Save changes</button><button class="tiny-btn danger-lite" data-action="delete-record">Delete this record</button><button class="tiny-btn" data-action="close-modal">Cancel</button></div></section></div>`;
  }
  return "";
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((btn) => btn.addEventListener("click", () => { view = btn.dataset.view; render(); }));
  document.querySelectorAll("[data-tune-tab]").forEach((btn) => btn.addEventListener("click", () => { tuneTab = btn.dataset.tuneTab; render(); }));
  document.querySelectorAll("[data-action]").forEach((btn) => btn.addEventListener("click", handleAction));
  document.querySelectorAll("[data-select-mode]").forEach((btn) => btn.addEventListener("click", () => {
    const mode = state.modes.find((m) => m.id === btn.dataset.selectMode);
    flow.selectedMode = mode.id;
    flow.plan = scalePlan(state.subjects, mode.hours);
    render();
  }));
  document.querySelectorAll("[data-nudge]").forEach((btn) => btn.addEventListener("click", () => {
    const [index, delta] = btn.dataset.nudge.split(":").map(Number);
    const currentMin = Math.round((flow.plan[index].hours || 0.5) * 60);
    const deltaMin = delta > 0 ? 30 : -30;
    const newMin = Math.max(30, currentMin + deltaMin);
    flow.plan[index].hours = newMin / 60;
    render();
  }));
  document.querySelectorAll("[data-move-subject]").forEach((btn) => btn.addEventListener("click", () => {
    const [index, delta] = btn.dataset.moveSubject.split(":").map(Number);
    const to = index + delta;
    if (to < 0 || to >= flow.plan.length) return;
    const [moved] = flow.plan.splice(index, 1);
    flow.plan.splice(to, 0, moved);
    render();
  }));
  document.querySelectorAll("[data-mode-hours]").forEach((input) => input.addEventListener("change", () => {
    const mode = state.modes.find((m) => m.id === input.dataset.modeHours);
    if (mode) {
      const hrs = Math.max(0.5, Math.round((Number(input.value) || 0.5) * 2) / 2);
      mode.hours = hrs;
      saveState();
      render();
    }
  }));
  document.querySelectorAll("[data-mode-name]").forEach((input) => input.addEventListener("change", () => {
    const mode = state.modes.find((m) => m.id === input.dataset.modeName);
    mode.name = input.value.trim() || "Custom"; saveState(); render();
  }));
  document.querySelectorAll("[data-mode-note]").forEach((input) => input.addEventListener("change", () => {
    const mode = state.modes.find((m) => m.id === input.dataset.modeNote);
    mode.note = input.value.trim() || "Your quiet plan"; saveState(); render();
  }));
  document.querySelectorAll("[data-remove-mode]").forEach((btn) => btn.addEventListener("click", () => {
    state.modes = state.modes.filter((mode) => mode.id !== btn.dataset.removeMode);
    saveState(); render();
  }));
  document.querySelectorAll("[data-subject-hours]").forEach((input) => input.addEventListener("change", () => {
    const subject = state.subjects.find((s) => s.id === input.dataset.subjectHours);
    subject.hours = clamp(Number(input.value), 0.5, 8); saveState(); render();
  }));
  document.querySelectorAll("[data-activity]").forEach((btn) => btn.addEventListener("click", () => {
    const activity = btn.dataset.activity;
    state.recovery.enabled = state.recovery.enabled.includes(activity) ? state.recovery.enabled.filter((x) => x !== activity) : [...state.recovery.enabled, activity];
    saveState(); render();
  }));
  document.querySelectorAll("[data-break-field]").forEach((input) => input.addEventListener("change", () => {
    const [type, field] = input.dataset.breakField.split(":");
    state.breaks[type][field] = Number(input.value);
    state.breaks = normalizeBreaks(state.breaks);
    saveState();
    render();
  }));
  document.querySelectorAll("[data-break-activity]").forEach((input) => input.addEventListener("change", () => {
    const [type, index] = input.dataset.breakActivity.split(":");
    const oldName = state.breaks[type].activities[Number(index)];
    state.breaks[type].activities[Number(index)] = input.value.trim();
    state.breaks[type].emojis[state.breaks[type].activities[Number(index)]] = state.breaks[type].emojis[oldName] || recoveryEmoji(state.breaks[type].activities[Number(index)]);
    saveState();
    render();
  }));
  document.querySelectorAll("[data-break-emoji]").forEach((input) => input.addEventListener("change", () => {
    const [type, index] = input.dataset.breakEmoji.split(":");
    state.breaks[type].emojis[state.breaks[type].activities[Number(index)]] = input.value.trim() || "•";
    saveState();
    render();
  }));
  document.querySelectorAll("[data-cat-date]").forEach((input) => input.addEventListener("change", () => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input.value)) {
      state.catDate = input.value;
      saveState();
      render();
    }
  }));
  document.querySelectorAll("[data-add-break]").forEach((btn) => btn.addEventListener("click", () => {
    const type = btn.dataset.addBreak;
    state.breaks[type].activities.push("");
    state.breaks[type].emojis[""] = "";
    saveState();
    render();
  }));
  document.querySelectorAll("[data-remove-break]").forEach((btn) => btn.addEventListener("click", () => {
    const [type, index] = btn.dataset.removeBreak.split(":");
    if (state.breaks[type].activities.length <= 1) return;
    const [removed] = state.breaks[type].activities.splice(Number(index), 1);
    delete state.breaks[type].emojis[removed];
    saveState();
    render();
  }));
  document.querySelectorAll("[data-sound]").forEach((btn) => btn.addEventListener("click", () => { state.sound = btn.dataset.sound; saveState(); render(); playMainNotification(); }));
  document.querySelectorAll("[data-palette-theme]").forEach((select) => select.addEventListener("change", () => {
    state.paletteTheme = select.value;
    state.colorAssignments = normalizeColorAssignments(state.colorAssignments);
    applySectionAssignments();
    saveState();
    render();
  }));
  document.querySelectorAll("[data-assign-color]").forEach((btn) => btn.addEventListener("click", () => {
    const [colorIndex, sectionId] = btn.dataset.assignColor.split(":");
    assignPaletteColor(Number(colorIndex), sectionId);
  }));
  document.querySelectorAll("[data-theme]").forEach((btn) => btn.addEventListener("click", () => { state.theme = btn.dataset.theme; applyTheme(); saveState(); render(); }));
  document.querySelectorAll("[data-edit-record]").forEach((btn) => btn.addEventListener("click", () => { modal = { type: "edit-confirm", id: btn.dataset.editRecord }; render(); }));
  document.querySelectorAll("[data-end-reason]").forEach((input) => input.addEventListener("input", () => { live.endReason = input.value; const btn = document.querySelector("[data-action=\"confirm-end-session\"]"); if (btn) btn.disabled = !live.endReason.trim(); }));
  document.querySelectorAll("[data-record-field]").forEach((input) => input.addEventListener("input", () => updateModalDraft(input)));
  bindBreakReviewEvents();
  document.querySelectorAll("[data-import-profile]").forEach((input) => input.addEventListener("change", importProfile));
  setupDrag();
}

function bindBreakReviewEvents() {
  document.querySelectorAll("[data-break-kind]").forEach((input) => input.addEventListener("change", () => {
    const index = Number(input.dataset.breakKind);
    if (input.value === "merge") {
      mergeAroundBreak(index);
      refreshBreakReviewRows();
      return;
    }
    if (input.value === "none") {
      flow.timeline.splice(index, 1);
      refreshBreakReviewRows();
      return;
    }
    const row = input.closest(".break-plan-row");
    const choices = breakChoices(input.value);
    const subject = choices[0] || "";
    flow.timeline[index] = { ...flow.timeline[index], type: input.value, minutes: input.value === "micro" ? state.breaks.short.minutes : state.breaks.long.minutes, subject, emoji: breakEmoji(input.value, subject) };
    if (row) {
      row.querySelector("span").textContent = flow.timeline[index].emoji;
      row.querySelector("strong").textContent = subject;
      row.querySelector(".eyebrow").textContent = `${flow.timeline[index].minutes}m break`;
      const choice = row.querySelector("[data-break-choice]");
      if (choice) {
        choice.dataset.breakChoice = String(index);
        choice.innerHTML = choices.map((item) => `<option ${item === subject ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");
      }
    }
  }));
  document.querySelectorAll("[data-break-choice]").forEach((input) => input.addEventListener("change", () => {
    const index = Number(input.dataset.breakChoice);
    flow.timeline[index].subject = input.value;
    flow.timeline[index].emoji = breakEmoji(flow.timeline[index].type, input.value);
    const row = input.closest(".break-plan-row");
    if (row) {
      row.querySelector("span").textContent = flow.timeline[index].emoji;
      row.querySelector("strong").textContent = input.value;
    }
  }));
}

function exportProfile() {
  const activeSession = activeSessionSnapshot();
  const data = {
    schema: "focusapp.backup",
    version: 2,
    appVersion: "24",
    exportedAt: new Date().toISOString(),
    state,
    activeSession,
    backup: {
      history: state.history || [],
      stats: state.stats || {},
      settings: {
        theme: state.theme,
        sound: state.sound,
        paletteTheme: state.paletteTheme,
        colorAssignments: state.colorAssignments,
        breaks: state.breaks,
        modes: state.modes,
        subjects: state.subjects
      },
      activeSession
    }
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `focusapp-profile-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
async function importProfile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!confirm("Import this profile and replace the current app data on this device?")) return;
  try {
    const data = JSON.parse(await file.text());
    const importedState = data?.state || data?.backup?.state || data;
    if (!importedState || typeof importedState !== "object") throw new Error("No app data found in this file.");
    state = normalizeState({ ...structuredClone(defaults), ...importedState });
    const importedSession = data?.activeSession || data?.backup?.activeSession || null;
    live = importedSession?.timeline?.length ? reconcileActiveSession(importedSession) : null;
    saveState();
    saveActiveSession();
    render();
  } catch (error) {
    alert(`Import failed: ${error.message || "This file is not a valid FocusApp backup."}`);
  } finally {
    event.target.value = "";
  }
}
function updateModalDraft(input) {
  const record = modal.draft;
  if (!record) return;
  const field = input.dataset.recordField;
  if (field === "totalMinutes") record.totalSeconds = Math.max(0, Number(input.value || 0)) * 60;
  else if (field === "focusedMinutes") record.focusedSeconds = Math.max(0, Number(input.value || 0)) * 60;
  else if (field === "completedPomodoros") record.completedPomodoros = Math.max(0, Number(input.value || 0));
  else record[field] = input.value;
}

function handleAction(event) {
  unlockAudio();
  const action = event.currentTarget.dataset.action;
  if (action === "open-start") openStart();
  if (action === "close-flow") { flow = null; render(); }
  if (action === "load-plan") { flow.step = "plan"; render(); }
  if (action === "toggle-edit") { flow.editing = !flow.editing; render(); }
  if (action === "confirm-plan") {
    const mode = state.modes.find((m) => m.id === flow.selectedMode) || state.modes[0];
    const total = flow.plan.reduce((sum, s) => sum + Number(s.hours), 0);
    if (Math.abs(total - mode.hours) >= 0.01) return;
    flow.timeline = buildTimeline(flow.plan);
    flow.step = "breaks";
    render();
  }
  if (action === "back-to-plan") { flow.step = "plan"; render(); }
  if (action === "start-reviewed-session") startLive();
  if (action === "test-chime") testSelectedSound();
  if (action === "pause-live") togglePause();
  if (action === "cycle-session-info") cycleSessionInfo();
  if (action === "export-profile") exportProfile();
  if (action === "request-skip-break") { live.skipStep = "confirm"; renderLive(); }
  if (action === "keep-break") { live.skipStep = null; live.lastTickAt = performance.now(); renderLive(); }
  if (action === "confirm-skip-break") skipCurrentBreak();
  if (action === "request-end-session") { live.endStep = "confirm"; renderLive(); }
  if (action === "resume-session") { live.endStep = null; live.endReason = ""; live.lastTickAt = performance.now(); renderLive(); }
  if (action === "show-end-reason") { live.endStep = "reason"; renderLive(); }
  if (action === "confirm-end-session" && live.endReason.trim()) finishSession("Ended Early", live.endReason);
  if (action === "home") { summary = null; view = "dashboard"; render(); }
  if (action === "add-mode") { state.modes.push({ id: uid(), name: "Custom", hours: 7, note: "Your quiet plan" }); saveState(); render(); }
  if (action === "close-modal") { modal = null; render(); }
  if (action === "open-edit-record") { const record = state.history.find((item) => item.id === modal.id); modal = { type: "edit-record", id: modal.id, draft: { ...record } }; render(); }
  if (action === "save-record-edit") { state.history = state.history.map((item) => item.id === modal.id ? { ...modal.draft } : item); saveState(); modal = null; render(); }
  if (action === "delete-record") { if (confirm("Delete this study record?")) { state.history = state.history.filter((item) => item.id !== modal.id); saveState(); modal = null; render(); } }
}

function skipCurrentBreak() {
  if (!live) return;
  const item = live.timeline[live.index];
  if (item.type === "study") return;
  live.skipStep = null;
  live.index += 1;
  if (live.index >= live.timeline.length) return finishSession("Completed");
  live.remaining = live.timeline[live.index].minutes * 60;
  live.lastTickAt = performance.now();
  saveActiveSession();
  renderLive();
}

function togglePause() {
  if (!live) return;
  playToggleSound();
  if (live.paused) {
    const endedBreak = live.currentBreakMs || 0;
    if (endedBreak >= 15000) {
      const history = normalizeBreakHistory(live.breakHistory || live.breakHistoryMs);
      live.unplannedBreakMs = (live.unplannedBreakMs || 0) + endedBreak;
      live.breakHistory = [{ id: uid(), durationMs: endedBreak, resumedAt: new Date().toISOString(), order: history.length ? Math.min(...history.map((entry) => entry.order)) - 1 : 0 }, ...history];
      live.breakHistoryMs = live.breakHistory.map((entry) => entry.durationMs);
    }
    live.currentBreakMs = 0;
    live.paused = false;
    live.infoView = "end";
    live.infoFlashUntil = 0;
    live.infoResetAt = 0;
    live.lastTickAt = performance.now();
  } else {
    live.paused = true;
    live.currentBreakMs = 0;
    live.infoView = "end";
    live.infoResetAt = 0;
    live.infoFlashUntil = 0;
    live.lastTickAt = performance.now();
  }
  saveActiveSession();
  renderLive();
}
async function playCardCycleSound() {
  try {
    await unlockAudio();
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(620, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  } catch {}
}

function setupDrag() {
  let from = null;
  document.querySelectorAll(".subject-card[draggable='true']").forEach((card) => {
    card.addEventListener("dragstart", () => { from = Number(card.dataset.index); });
    card.addEventListener("dragover", (event) => event.preventDefault());
    card.addEventListener("drop", () => {
      const to = Number(card.dataset.index);
      const [moved] = flow.plan.splice(from, 1);
      flow.plan.splice(to, 0, moved);
      render();
    });
  });
}

let upcomingRailTimer = null;
function setupUpcomingRail() {
  const rail = document.querySelector(".floating-stack");
  if (!rail) return;
  const wakeRail = () => {
    rail.classList.add("is-active");
    clearTimeout(upcomingRailTimer);
    upcomingRailTimer = setTimeout(() => rail.classList.remove("is-active"), 3000);
  };
  rail.addEventListener("pointerdown", wakeRail);
  rail.addEventListener("pointermove", wakeRail);
  rail.addEventListener("scroll", wakeRail, { passive: true });
}

let lastTouchEnd = 0;
document.addEventListener("touchend", (event) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) event.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
async function testSelectedSound() {
  let ok = false;
  try {
    ok = await playTestChimeSound();
  } catch {}
  if (ok) lastSoundReady = true;
  showSoundStatus(ok);
}
function handleAudioReturn() {
  saveActiveSession();
  checkSoundReady(true);
}
document.addEventListener("visibilitychange", () => {
  saveActiveSession();
  if (!document.hidden) handleAudioReturn();
});
window.addEventListener("focus", handleAudioReturn);
window.addEventListener("pageshow", handleAudioReturn);
for (const eventName of ["pointerdown", "touchstart", "click", "keydown"]) {
  window.addEventListener(eventName, () => { unlockAudio(); }, { passive: true });
}
window.addEventListener("pagehide", saveActiveSession);
window.addEventListener("beforeunload", saveActiveSession);
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").then((reg) => reg.update()).catch(() => {});
}
applyTheme();
render();



















































