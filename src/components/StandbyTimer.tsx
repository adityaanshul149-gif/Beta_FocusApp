import React, { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { Play, Pause, FastForward, Power, AlertCircle, Sparkles } from "lucide-react";
import { LiveSession, AppState, SessionRecord, BreakHistoryEntry } from "../types";
import { fmtClock, fmtDuration, daysRemaining, todayKey, uid } from "../utils/storage";
import { playMainNotification, playToggleSound, playCardCycleSound, playCountdownBeep } from "../utils/audio";

interface StandbyTimerProps {
  state: AppState;
  live: LiveSession;
  onChangeLive: (updater: (prev: LiveSession | null) => LiveSession | null) => void;
  onFinishSession: (record: SessionRecord) => void;
}

export const StandbyTimer: React.FC<StandbyTimerProps> = ({
  state,
  live,
  onChangeLive,
  onFinishSession,
}) => {
  // 3-2-1 Start Countdown State (3 -> 2 -> 1 -> 0)
  const [countdownStep, setCountdownStep] = useState<number>(3);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(true);

  // Celebration state on block completion
  const [celebration, setCelebration] = useState<{
    title: string;
    subtitle: string;
    isSubjectDone: boolean;
    subjectName: string;
    durationSec: number;
  } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cycleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const catDays = daysRemaining(state.catDate);

  // Set pomodoro active class on body for full-screen PWA mode
  useEffect(() => {
    document.body.classList.add("pomodoro-active");
    return () => {
      document.body.classList.remove("pomodoro-active");
      if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);
    };
  }, []);

  // 3-2-1 Countdown Sequence Effect on Start
  useEffect(() => {
    if (!isCountingDown) return;

    if (countdownStep === 3) {
      playMainNotification(state.sound);
      playCountdownBeep();
      const timer = setTimeout(() => setCountdownStep(2), 1000);
      return () => clearTimeout(timer);
    } else if (countdownStep === 2) {
      playCountdownBeep();
      const timer = setTimeout(() => setCountdownStep(1), 1000);
      return () => clearTimeout(timer);
    } else if (countdownStep === 1) {
      playCountdownBeep();
      const timer = setTimeout(() => setCountdownStep(0), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsCountingDown(false);
    }
  }, [countdownStep, isCountingDown, state.sound]);

  // Main tick effect (runs every 1 second when not in countdown and not in celebration overlay)
  useEffect(() => {
    if (isCountingDown || celebration !== null) return;

    timerRef.current = setInterval(() => {
      onChangeLive((prev) => {
        if (!prev) return null;

        const now = performance.now();
        const deltaMs = Math.max(0, now - prev.lastTickAt);
        const deltaSec = deltaMs / 1000;

        const updated: LiveSession = {
          ...prev,
          lastTickAt: now,
          elapsedMs: (prev.elapsedMs || 0) + deltaMs,
        };

        if (prev.paused) {
          updated.currentBreakMs = (prev.currentBreakMs || 0) + deltaMs;
          return updated;
        }

        const currentItem = prev.timeline[prev.index];
        if (currentItem && currentItem.type === "study") {
          updated.focusedMs = (prev.focusedMs || 0) + deltaMs;
        }

        updated.remaining -= deltaSec;

        // Check block completion
        if (updated.remaining <= 0) {
          handleBlockComplete(updated);
        }

        return updated;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCountingDown, celebration]);

  const handleBlockComplete = (currentLive: LiveSession) => {
    const currentItem = currentLive.timeline[currentLive.index];
    if (currentItem.type === "study") {
      currentLive.completedPomodoros = (currentLive.completedPomodoros || 0) + 1;
    }

    // Play selected Pomodoro finish beep
    playMainNotification(state.sound);

    // Fire celebratory confetti
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 },
    });

    // Check if this was the last study block for this subject
    const remainingStudyBlocksForSubject = currentLive.timeline
      .slice(currentLive.index + 1)
      .filter((x) => x.type === "study" && x.subject === currentItem.subject);

    const isLastSubjectBlock = currentItem.type === "study" && remainingStudyBlocksForSubject.length === 0;

    const celebData = {
      title: isLastSubjectBlock
        ? `🏆 ${currentItem.subject} Completed!`
        : "Nice Work! Block Finished 🎉",
      subtitle: isLastSubjectBlock
        ? `Congratulations on finishing all ${currentItem.subject} study blocks!`
        : "Great focus! Take a deep breath and transition to recovery.",
      isSubjectDone: isLastSubjectBlock,
      subjectName: currentItem.subject,
      durationSec: isLastSubjectBlock ? 5 : 3,
    };

    setCelebration(celebData);

    // Auto dismiss celebration screen after 3s (regular) or 5s (subject completed)
    setTimeout(() => {
      setCelebration(null);
      advanceToNextBlock();
    }, celebData.durationSec * 1000);
  };

  const advanceToNextBlock = () => {
    onChangeLive((prev) => {
      if (!prev) return null;
      const nextIndex = prev.index + 1;

      if (nextIndex >= prev.timeline.length) {
        // Complete entire session
        finishSession("Completed", "", prev);
        return null;
      }

      const nextItem = prev.timeline[nextIndex];
      return {
        ...prev,
        index: nextIndex,
        remaining: nextItem.minutes * 60,
        lastTickAt: performance.now(),
      };
    });
  };

  const togglePause = () => {
    playToggleSound(!live.paused);
    onChangeLive((prev) => {
      if (!prev) return null;

      if (prev.paused) {
        // Resuming focus
        const endedBreakMs = prev.currentBreakMs || 0;
        let updatedHistory = [...(prev.breakHistory || [])];

        if (endedBreakMs >= 15000) {
          const entry: BreakHistoryEntry = {
            id: uid(),
            durationMs: endedBreakMs,
            resumedAt: new Date().toISOString(),
            order: updatedHistory.length,
          };
          updatedHistory = [entry, ...updatedHistory];
        }

        return {
          ...prev,
          paused: false,
          currentBreakMs: 0,
          unplannedBreakMs: (prev.unplannedBreakMs || 0) + endedBreakMs,
          breakHistory: updatedHistory,
          infoView: "end",
          lastTickAt: performance.now(),
        };
      } else {
        // Pausing / Unplanned break
        return {
          ...prev,
          paused: true,
          currentBreakMs: 0,
          infoView: "end",
          lastTickAt: performance.now(),
        };
      }
    });
  };

  const handleSkipBreak = () => {
    const currentItem = live.timeline[live.index];
    if (currentItem.type === "study") return;

    onChangeLive((prev) => {
      if (!prev) return null;
      const nextIndex = prev.index + 1;
      if (nextIndex >= prev.timeline.length) {
        finishSession("Completed", "", prev);
        return null;
      }
      return {
        ...prev,
        index: nextIndex,
        remaining: prev.timeline[nextIndex].minutes * 60,
        skipStep: null,
        lastTickAt: performance.now(),
      };
    });
  };

  const finishSession = (
    status: "Completed" | "Ended Early",
    reason: string = "",
    currentLive: LiveSession = live
  ) => {
    const totalSeconds = Math.max(0, Math.floor((currentLive.elapsedMs || 0) / 1000));
    const focusedSeconds = Math.max(0, Math.floor((currentLive.focusedMs || 0) / 1000));
    const record: SessionRecord = {
      id: currentLive.id,
      date: todayKey(),
      createdAt: new Date().toISOString(),
      totalSeconds,
      focusedSeconds,
      unplannedBreakSeconds: Math.floor((currentLive.unplannedBreakMs || 0) / 1000),
      completedPomodoros: currentLive.completedPomodoros,
      status,
      reason: reason.trim(),
    };

    onFinishSession(record);
    onChangeLive(() => null);
  };

  const cycleInfoView = () => {
    playCardCycleSound();
    onChangeLive((prev) => {
      if (!prev || prev.paused) return prev;
      const views: ("end" | "focused" | "total" | "breakTotal")[] = [
        "end",
        "focused",
        "total",
        "breakTotal",
      ];
      const current = prev.infoView || "end";
      const next = views[(views.indexOf(current) + 1) % views.length];
      return { ...prev, infoView: next };
    });

    if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);
    cycleTimeoutRef.current = setTimeout(() => {
      onChangeLive((prev) => (prev ? { ...prev, infoView: "end" } : null));
    }, 4000);
  };

  const item = live.timeline[live.index];
  const duration = item.minutes * 60;
  const progressPercent = Math.max(0, Math.min(100, (live.remaining / duration) * 100));
  const isRecovery = item.type !== "study";
  const upcoming = live.timeline.slice(live.index + 1);

  const predictedEnd = new Date(
    Date.now() +
      live.timeline
        .slice(live.index + 1)
        .reduce((sum, x) => sum + x.minutes * 60, Math.max(0, live.remaining)) *
        1000
  );

  const formattedEndTime = predictedEnd.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const formattedEndDate = predictedEnd.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className={`fixed inset-0 z-50 select-none bg-[#0d0f12] text-white ${isRecovery ? "is-recovery" : ""}`}>
      {/* 3-2-1 START COUNTDOWN OVERLAY */}
      {isCountingDown && (
        <div className="fixed inset-0 z-[100] bg-[#000000] flex flex-col items-center justify-center p-6 text-center select-none animate-pop">
          <div className="space-y-4 max-w-sm mx-auto">
            <div className="text-4xl">{item.emoji}</div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50">
              Get Ready • {item.subject}
            </p>
            <div className="text-9xl font-black font-display tracking-tight text-[#f4a261] animate-bounce">
              {countdownStep}
            </div>
            <p className="text-xs text-white/40 font-mono">Starting focus timer...</p>
          </div>
        </div>
      )}

      {/* 3s / 5s BLACK CELEBRATION OVERLAY */}
      {celebration && (
        <div className="fixed inset-0 z-[100] bg-[#000000] flex flex-col items-center justify-center p-6 text-center select-none animate-pop">
          <div className="space-y-5 max-w-md mx-auto">
            {celebration.isSubjectDone ? (
              <div className="text-7xl animate-bounce">🏆</div>
            ) : (
              <div className="flex justify-center gap-3 text-5xl animate-bounce">
                <span>🎉</span>
                <span>👏</span>
                <span>⭐</span>
              </div>
            )}

            <div className="space-y-2">
              <h2 className="text-3xl sm:text-5xl font-extrabold text-[#fbfff4] font-display">
                {celebration.title}
              </h2>
              <p className="text-sm text-[#a3b19b]">{celebration.subtitle}</p>
            </div>

            {/* Countdown Progress Line */}
            <div className="w-48 h-1.5 mx-auto bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#f4a261] transition-all ease-linear"
                style={{
                  animation: `shrinkWidth ${celebration.durationSec}s linear forwards`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* StandBy Canvas Card */}
      <div
        className="standby-card"
        style={
          {
            "--card-color": item.color || "#f4a261",
            "--black-width": `${100 - progressPercent}%`,
          } as React.CSSProperties
        }
      >
        {/* Fill layer sweep animation */}
        <div className="empty-layer" />

        {/* Top Session Info Badge */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          <button
            onClick={cycleInfoView}
            className="px-3.5 py-2 rounded-2xl bg-white/90 text-[#14171d] shadow-lg backdrop-blur-md text-left transition-transform active:scale-95 cursor-pointer border border-black/10"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#14171d]/60">
              {live.paused
                ? "Current Break"
                : live.infoView === "focused"
                ? "Focused Time"
                : live.infoView === "total"
                ? "Total Session Time"
                : live.infoView === "breakTotal"
                ? "Unplanned Break Total"
                : "Session Ends At"}
            </div>

            <div className="text-base font-extrabold font-mono tracking-tight text-[#14171d]">
              {live.paused
                ? fmtDuration(Math.floor((live.currentBreakMs || 0) / 1000))
                : live.infoView === "focused"
                ? fmtDuration(Math.floor((live.focusedMs || 0) / 1000))
                : live.infoView === "total"
                ? fmtDuration(Math.floor((live.elapsedMs || 0) / 1000))
                : live.infoView === "breakTotal"
                ? fmtDuration(Math.floor((live.unplannedBreakMs || 0) / 1000))
                : formattedEndTime}
            </div>

            {(!live.paused && (live.infoView === "end" || !live.infoView) && catDays > 0) && (
              <div className="text-[11px] font-semibold text-[#14171d]/60 mt-0.5 font-mono">
                {catDays} Days to CAT
              </div>
            )}
          </button>
        </div>

        {/* Unplanned Break History Dropdown Card */}
        {(live.paused || live.infoView === "breakTotal") && (
          <div className="absolute top-20 left-4 z-20 w-64 p-3.5 rounded-2xl bg-white/95 text-[#14171d] shadow-2xl border border-black/10 text-left space-y-2 animate-pop">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#14171d]/60">
              Unplanned Breaks ({live.breakHistory?.length || 0})
            </div>
            <div className="max-h-32 overflow-y-auto no-scrollbar space-y-1.5 divide-y divide-black/5 text-xs">
              {live.breakHistory && live.breakHistory.length > 0 ? (
                live.breakHistory.map((b) => (
                  <div key={b.id} className="pt-1 flex items-center justify-between font-mono">
                    <span className="font-bold">{fmtDuration(Math.floor(b.durationMs / 1000))}</span>
                    <span className="text-[10px] text-[#14171d]/60">
                      {new Date(b.resumedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-[#14171d]/60 italic pt-1">No unplanned breaks logged yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Main StandBy Display Area */}
        <div className="standby-content">
          <div className="space-y-1">
            <div className="flex items-center gap-2 justify-center">
              <span className="text-3xl">{item.emoji}</span>
              <span className="text-xs font-black uppercase tracking-wider text-white/80">
                {isRecovery ? (item.type === "micro" ? "Micro Recovery" : "Long Recovery") : "Now Studying"}
              </span>
            </div>
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white font-display drop-shadow-md">
              {item.subject}
            </h1>
          </div>

          {/* Giant Countdown Clock */}
          <div className="countdown text-7xl sm:text-9xl md:text-[13rem] font-black font-display tracking-tight text-white my-2 sm:my-6 drop-shadow-lg">
            {fmtClock(live.remaining)}
          </div>
        </div>

        {/* BOTTOM LEFT CONTROLS: FIXED POSITION ON LEFT, NO MOVEMENT */}
        <div className="fixed bottom-6 left-6 sm:bottom-8 sm:left-8 z-30 flex items-center gap-3">
          {isRecovery ? (
            <button
              onClick={() => onChangeLive((prev) => (prev ? { ...prev, skipStep: "confirm" } : null))}
              className="px-6 py-3.5 rounded-full bg-white/90 text-[#14171d] font-extrabold text-sm shadow-xl active:scale-95 transition-all cursor-pointer flex items-center gap-2"
            >
              <FastForward className="w-4 h-4 fill-current" />
              <span>Skip Break</span>
            </button>
          ) : (
            <>
              {/* StandBy Play/Pause Button - Fixed Left Position */}
              <button
                onClick={togglePause}
                aria-label={live.paused ? "Resume Focus" : "Pause Focus"}
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-extrabold shadow-2xl active:scale-95 transition-all cursor-pointer border ${
                  live.paused
                    ? "bg-[#52b788] text-[#14171d] border-[#52b788]/40 shadow-[#52b788]/40"
                    : "bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md shadow-black/50"
                }`}
              >
                {live.paused ? (
                  <Play className="w-7 h-7 sm:w-9 sm:h-9 fill-current ml-0.5" />
                ) : (
                  <Pause className="w-7 h-7 sm:w-9 sm:h-9 fill-current" />
                )}
              </button>

              {/* SUBTLE SMALL POWER BUTTON: APPEARS RIGHT OF PLAY/PAUSE ONLY WHEN PAUSED */}
              {live.paused && (
                <button
                  onClick={() => onChangeLive((prev) => (prev ? { ...prev, endStep: "confirm" } : null))}
                  aria-label="End Session"
                  title="End Session Early"
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md animate-pop shadow-lg"
                >
                  <Power className="w-5 h-5 stroke-[2.5]" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Floating Stack for Upcoming Blocks (Bottom Right) */}
        {upcoming.length > 0 && (
          <div className="floating-stack">
            {upcoming.slice(0, 3).map((x, idx) => (
              <div key={idx} className="stack-card">
                <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                  <span>{x.emoji}</span>
                  <span className="truncate">{x.subject}</span>
                </div>
                <div className="text-[10px] text-white/60 font-mono">
                  {x.minutes}m {x.type === "study" ? "study" : "break"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialogs */}
      {live.skipStep === "confirm" && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#14171d] border border-white/10 p-6 space-y-4 text-center shadow-2xl animate-pop">
            <h3 className="text-xl font-bold text-[#fbfff4] font-display">Skip Break?</h3>
            <p className="text-xs text-[#a3b19b]">
              Your brain recovers quickly during breaks. If you feel clear and ready, you can return to study now.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onChangeLive((prev) => (prev ? { ...prev, skipStep: null } : null))}
                className="flex-1 py-3 rounded-full bg-white/10 text-xs font-bold text-[#fbfff4] hover:bg-white/15 cursor-pointer"
              >
                Keep Break
              </button>
              <button
                onClick={handleSkipBreak}
                className="flex-1 py-3 rounded-full bg-[#f4a261] text-xs font-extrabold text-[#14171d] hover:bg-[#e07a5f] cursor-pointer"
              >
                Skip to Study
              </button>
            </div>
          </div>
        </div>
      )}

      {live.endStep === "confirm" && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#14171d] border border-white/10 p-6 space-y-4 text-center shadow-2xl animate-pop">
            <AlertCircle className="w-10 h-10 text-[#f4a261] mx-auto opacity-80" />
            <h3 className="text-xl font-bold text-[#fbfff4] font-display">End Session Early?</h3>
            <p className="text-xs text-[#a3b19b]">
              Remember why you started today. If your energy is spent, ending honestly still counts.
            </p>
            <div className="space-y-2 pt-2">
              <button
                onClick={() => onChangeLive((prev) => (prev ? { ...prev, endStep: null } : null))}
                className="w-full py-3.5 rounded-full bg-[#52b788] text-[#14171d] font-extrabold text-sm cursor-pointer"
              >
                Continue Session
              </button>
              <button
                onClick={() => onChangeLive((prev) => (prev ? { ...prev, endStep: "reason" } : null))}
                className="w-full py-2.5 rounded-full bg-[#e63946]/15 text-[#e63946] font-bold text-xs hover:bg-[#e63946]/25 cursor-pointer"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {live.endStep === "reason" && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#14171d] border border-white/10 p-6 space-y-4 text-center shadow-2xl animate-pop">
            <h3 className="text-xl font-bold text-[#fbfff4] font-display">What Made You End Early?</h3>
            <textarea
              rows={3}
              value={live.endReason || ""}
              onChange={(e) => {
                const val = e.target.value;
                onChangeLive((prev) => (prev ? { ...prev, endReason: val } : null));
              }}
              placeholder="Write one honest sentence..."
              className="w-full rounded-2xl bg-white/5 border border-white/10 p-3 text-sm text-[#fbfff4] focus:outline-none focus:border-[#f4a261] resize-none"
            />
            <div className="space-y-2 pt-1">
              <button
                disabled={!live.endReason || !live.endReason.trim()}
                onClick={() => finishSession("Ended Early", live.endReason)}
                className="w-full py-3.5 rounded-full bg-[#f4a261] disabled:opacity-40 text-[#14171d] font-extrabold text-sm cursor-pointer"
              >
                Save and Log Session
              </button>
              <button
                onClick={() => onChangeLive((prev) => (prev ? { ...prev, endStep: null } : null))}
                className="w-full py-2 rounded-full bg-white/10 text-xs font-bold text-[#a3b19b] cursor-pointer"
              >
                Return to Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
