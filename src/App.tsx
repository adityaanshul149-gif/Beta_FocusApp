import React, { useState, useEffect } from "react";
import { AppState, LiveSession, SessionRecord, TimelineItem } from "./types";
import { loadState, saveState, loadActiveSession, saveActiveSession, uid } from "./utils/storage";
import { unlockAudio } from "./utils/audio";
import { Header } from "./components/Header";
import { BottomNav } from "./components/BottomNav";
import { DashboardView } from "./components/DashboardView";
import { CustomizationView } from "./components/CustomizationView";
import { SessionFlowModal } from "./components/SessionFlowModal";
import { StandbyTimer } from "./components/StandbyTimer";
import { FocusSoundNoticePill } from "./components/FocusSoundNoticePill";

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [currentView, setCurrentView] = useState<"dashboard" | "custom">("dashboard");
  const [isFlowOpen, setIsFlowOpen] = useState(false);
  const [live, setLive] = useState<LiveSession | null>(() => loadActiveSession());

  // Save state on changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Save active live session on changes
  useEffect(() => {
    saveActiveSession(live);
  }, [live]);

  // Register PWA Service Worker & Unlock Web Audio on iOS touch
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const unlockHandler = () => {
      unlockAudio();
    };

    window.addEventListener("touchstart", unlockHandler, { passive: true });
    window.addEventListener("pointerdown", unlockHandler, { passive: true });

    return () => {
      window.removeEventListener("touchstart", unlockHandler);
      window.removeEventListener("pointerdown", unlockHandler);
    };
  }, []);

  const handleUpdateRecord = (updatedRecord: SessionRecord) => {
    setState((prev) => ({
      ...prev,
      history: prev.history.map((rec) => (rec.id === updatedRecord.id ? updatedRecord : rec)),
    }));
  };

  const handleDeleteRecord = (id: string) => {
    setState((prev) => ({
      ...prev,
      history: prev.history.filter((rec) => rec.id !== id),
    }));
  };

  const handleStartSessionWithTimeline = (timeline: TimelineItem[]) => {
    if (!timeline || timeline.length === 0) return;

    const newLive: LiveSession = {
      id: uid(),
      timeline,
      index: 0,
      remaining: timeline[0].minutes * 60,
      paused: false,
      startedAt: Date.now(),
      elapsedMs: 0,
      completedPomodoros: 0,
      focusedMs: 0,
      unplannedBreakMs: 0,
      currentBreakMs: 0,
      breakHistory: [],
      lastTickAt: performance.now(),
      endStep: null,
      endReason: "",
      skipStep: null,
      infoView: "end",
      infoResetAt: 0,
    };

    setLive(newLive);
    setIsFlowOpen(false);
  };

  const handleFinishSession = (record: SessionRecord) => {
    setState((prev) => {
      const updatedHistory = [record, ...prev.history];
      const hours = record.focusedSeconds / 3600;
      const sameDay = prev.stats.lastStudyDate === record.date;

      return {
        ...prev,
        history: updatedHistory,
        stats: {
          ...prev.stats,
          totalHours: Math.round((prev.stats.totalHours + hours) * 10) / 10,
          studyDays: sameDay ? prev.stats.studyDays : prev.stats.studyDays + 1,
          lastStudyDate: record.date,
        },
      };
    });
  };

  const handleExportProfile = () => {
    const data = {
      schema: "monkfocus.backup",
      exportedAt: new Date().toISOString(),
      state,
      activeSession: live,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `monkfocus-profile-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleImportProfile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.state) {
        setState(parsed.state);
        if (parsed.activeSession) {
          setLive(parsed.activeSession);
        }
        alert("Profile imported successfully!");
      } else {
        alert("Invalid profile backup file.");
      }
    } catch {
      alert("Failed to import profile.");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="min-h-svh bg-[#0d0f12] text-[#fbfff4] selection:bg-[#f4a261] selection:text-[#14171d]">
      {/* Sound focus status pill notice (shows when returning from background) */}
      <FocusSoundNoticePill soundId={state.sound} />

      {/* StandBy Full Screen Timer */}
      {live && (
        <StandbyTimer
          state={state}
          live={live}
          onChangeLive={(updater) => setLive((prev) => updater(prev))}
          onFinishSession={handleFinishSession}
        />
      )}

      {/* Main App Content when not in active live timer */}
      {!live && (
        <main className="max-w-md mx-auto min-h-svh px-4 pt-safe pb-safe">
          <Header
            currentView={currentView}
            catDate={state.catDate}
            onOpenStart={() => setIsFlowOpen(true)}
          />

          {currentView === "dashboard" ? (
            <DashboardView
              state={state}
              onOpenStart={() => setIsFlowOpen(true)}
              onUpdateRecord={handleUpdateRecord}
              onDeleteRecord={handleDeleteRecord}
            />
          ) : (
            <CustomizationView
              state={state}
              onChangeState={(updater) => setState((prev) => updater(prev))}
              onExportProfile={handleExportProfile}
              onImportProfile={handleImportProfile}
            />
          )}

          <BottomNav
            currentView={currentView}
            onSelectView={(view) => setCurrentView(view)}
            onOpenStart={() => setIsFlowOpen(true)}
          />

          {/* Start Session Modal Sheet */}
          {isFlowOpen && (
            <SessionFlowModal
              state={state}
              onClose={() => setIsFlowOpen(false)}
              onStartSession={handleStartSessionWithTimeline}
            />
          )}
        </main>
      )}
    </div>
  );
}
