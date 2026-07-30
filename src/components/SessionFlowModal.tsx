import React, { useState } from "react";
import { X, ArrowUp, ArrowDown, Check, Sparkles, AlertCircle } from "lucide-react";
import { AppState, Subject, TimelineItem, StudyMode } from "../types";
import { fmtHours, fmtPlanDuration, uid } from "../utils/storage";

interface SessionFlowModalProps {
  state: AppState;
  onClose: () => void;
  onStartSession: (timeline: TimelineItem[]) => void;
}

export const SessionFlowModal: React.FC<SessionFlowModalProps> = ({
  state,
  onClose,
  onStartSession,
}) => {
  const [step, setStep] = useState<"mode" | "plan" | "breaks">("mode");
  const [selectedModeId, setSelectedModeId] = useState<string>(state.modes[1]?.id || state.modes[0].id);
  const [isEditing, setIsEditing] = useState(false);

  // Scaled plan state
  const selectedMode = state.modes.find((m) => m.id === selectedModeId) || state.modes[0];

  const scalePlan = (subjects: Subject[], targetHours: number): Subject[] => {
    const total = subjects.reduce((sum, s) => sum + Number(s.hours), 0) || 1;
    const plan = subjects.map((s) => ({
      ...s,
      hours: Math.round((s.hours / total) * targetHours * 2) / 2,
    }));
    const currentTotal = plan.reduce((sum, s) => sum + s.hours, 0);
    const delta = Math.round((targetHours - currentTotal) * 2) / 2;
    if (plan.length > 0) {
      plan[plan.length - 1].hours = Math.max(0.5, plan[plan.length - 1].hours + delta);
    }
    return plan;
  };

  const [plan, setPlan] = useState<Subject[]>(() => scalePlan(state.subjects, selectedMode.hours));
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);

  const totalPlanHours = plan.reduce((sum, s) => sum + Number(s.hours), 0);
  const isValidTotal = Math.abs(totalPlanHours - selectedMode.hours) < 0.01;

  const handleSelectMode = (mode: StudyMode) => {
    setSelectedModeId(mode.id);
    setPlan(scalePlan(state.subjects, mode.hours));
  };

  const handleNudge = (index: number, deltaMins: number) => {
    setPlan((prev) => {
      const copy = [...prev];
      const newHours = Math.max(0.5, Math.min(10, Math.round((copy[index].hours + deltaMins / 60) * 2) / 2));
      copy[index] = { ...copy[index], hours: newHours };
      return copy;
    });
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    setPlan((prev) => {
      const copy = [...prev];
      const target = index + direction;
      if (target < 0 || target >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  // Helper to construct timeline
  const buildTimeline = (planSubjects: Subject[]): TimelineItem[] => {
    const result: TimelineItem[] = [];
    const shortBreak = state.breaks.short;
    const longBreak = state.breaks.long;
    const maxStudyChunk = shortBreak.everyMinutes || 50;

    let lastActivity = "";

    planSubjects.forEach((subject, subjectIdx) => {
      let remainingMins = Math.round(subject.hours * 60);

      while (remainingMins > 0) {
        const chunkMins = Math.min(maxStudyChunk, remainingMins);
        result.push({
          type: "study",
          subject: subject.name,
          minutes: chunkMins,
          color: subject.color,
          emoji: subject.emoji || "📖",
        });
        remainingMins -= chunkMins;

        if (remainingMins > 0 && shortBreak.activities.length > 0) {
          const act = shortBreak.activities.find((a) => a !== lastActivity) || shortBreak.activities[0];
          lastActivity = act;
          result.push({
            type: "micro",
            subject: act,
            minutes: shortBreak.minutes,
            color: shortBreak.color,
            emoji: shortBreak.emojis[act] || "💧",
          });
        }
      }

      if (subjectIdx < planSubjects.length - 1 && longBreak.activities.length > 0) {
        const act = longBreak.activities.find((a) => a !== lastActivity) || longBreak.activities[0];
        lastActivity = act;
        result.push({
          type: "medium",
          subject: act,
          minutes: longBreak.minutes,
          color: longBreak.color,
          emoji: longBreak.emojis[act] || "🧘",
        });
      }
    });

    return result;
  };

  const handleConfirmPlan = () => {
    const built = buildTimeline(plan);
    setTimeline(built);
    setStep("breaks");
  };

  const handleStartSession = () => {
    onStartSession(timeline);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-[#12151b] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-2xl animate-pop max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div>
            <p className="text-xs font-bold text-[#f4a261] uppercase tracking-wider">
              {step === "mode" ? "Begin Gently" : step === "plan" ? `${selectedMode.name} • ${fmtHours(selectedMode.hours)}` : "Review Structure"}
            </p>
            <h2 className="text-xl font-bold text-[#fbfff4] font-display">
              {step === "mode" ? "Choose Today's Target" : step === "plan" ? "Review Today's Plan" : "Confirm Breaks & Sequence"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#a3b19b] hover:text-[#fbfff4] hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: Select Mode */}
        {step === "mode" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {state.modes.map((mode) => {
                const isSelected = mode.id === selectedModeId;
                return (
                  <button
                    key={mode.id}
                    onClick={() => handleSelectMode(mode)}
                    className={`p-4 rounded-2xl text-left border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-[#f4a261]/15 border-[#f4a261] text-[#fbfff4] shadow-lg shadow-[#f4a261]/10"
                        : "bg-[#1d222b] border-white/5 text-[#a3b19b] hover:border-white/10"
                    }`}
                  >
                    <div>
                      <h3 className="text-lg font-bold text-[#fbfff4] font-display">{mode.name}</h3>
                      <p className="text-xs text-[#a3b19b] mt-0.5">{mode.note}</p>
                    </div>
                    <span className="text-lg font-extrabold text-[#f4a261] bg-[#f4a261]/10 px-3 py-1 rounded-full">
                      {fmtHours(mode.hours)}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setStep("plan")}
              className="w-full py-4 rounded-full bg-[#f4a261] text-[#14171d] font-extrabold text-lg shadow-md shadow-[#f4a261]/20 hover:bg-[#e07a5f] transition-colors cursor-pointer"
            >
              Load Today's Plan
            </button>
          </div>
        )}

        {/* STEP 2: Review Plan */}
        {step === "plan" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold px-1">
              <span className="text-[#a3b19b]">Total Duration:</span>
              <span className={`px-2.5 py-0.5 rounded-full ${isValidTotal ? "bg-[#52b788]/20 text-[#52b788]" : "bg-[#e63946]/20 text-[#e63946]"}`}>
                {fmtHours(totalPlanHours)} / {fmtHours(selectedMode.hours)}
              </span>
            </div>

            <div className="space-y-2.5">
              {plan.map((s, i) => (
                <div
                  key={s.id || i}
                  className="p-3.5 rounded-2xl bg-[#1d222b] border border-white/5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 rounded-xl bg-black/20">{s.emoji || "📖"}</span>
                    <div>
                      <h4 className="text-sm font-bold text-[#fbfff4]">{s.name}</h4>
                      <p className="text-xs text-[#a3b19b]">{fmtPlanDuration(s.hours)}</p>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-black/30 rounded-xl border border-white/10 p-1">
                        <button
                          onClick={() => handleNudge(i, -30)}
                          className="w-7 h-7 rounded-lg text-sm font-bold hover:bg-white/10 text-[#a3b19b]"
                        >
                          -
                        </button>
                        <button
                          onClick={() => handleNudge(i, 30)}
                          className="w-7 h-7 rounded-lg text-sm font-bold hover:bg-white/10 text-[#a3b19b]"
                        >
                          +
                        </button>
                      </div>

                      <div className="flex flex-col gap-1">
                        <button
                          disabled={i === 0}
                          onClick={() => handleMove(i, -1)}
                          className="p-1 rounded-md bg-white/5 text-[#a3b19b] hover:text-white disabled:opacity-30"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          disabled={i === plan.length - 1}
                          onClick={() => handleMove(i, 1)}
                          className="p-1 rounded-md bg-white/5 text-[#a3b19b] hover:text-white disabled:opacity-30"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 space-y-2">
              <button
                disabled={!isValidTotal}
                onClick={handleConfirmPlan}
                className="w-full py-3.5 rounded-full bg-[#f4a261] disabled:opacity-40 text-[#14171d] font-extrabold text-base shadow-md shadow-[#f4a261]/20 hover:bg-[#e07a5f] transition-all cursor-pointer"
              >
                Confirm and Review Breaks
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex-1 py-2.5 rounded-full bg-white/10 text-xs font-bold text-[#fbfff4] hover:bg-white/15 cursor-pointer"
                >
                  {isEditing ? "Done Adjusting" : "Customize Hours & Sequence"}
                </button>
                <button
                  onClick={() => setStep("mode")}
                  className="px-4 py-2.5 rounded-full bg-white/5 text-xs font-bold text-[#a3b19b] hover:text-[#fbfff4] cursor-pointer"
                >
                  Change Mode
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Review Timeline Breaks */}
        {step === "breaks" && (
          <div className="space-y-4">
            <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar pr-1">
              {timeline.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    item.type === "study"
                      ? "bg-[#1d222b] border-white/5 text-[#fbfff4]"
                      : "bg-[#f4a261]/10 border-[#f4a261]/30 text-[#f4a261]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{item.emoji}</span>
                    <span>{item.subject}</span>
                  </div>
                  <span className="opacity-80 font-mono">{item.minutes}m {item.type === "study" ? "study" : "break"}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={handleStartSession}
                className="w-full py-4 rounded-full bg-[#52b788] text-[#14171d] font-extrabold text-lg shadow-lg shadow-[#52b788]/25 hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5 fill-current" />
                <span>Start Focus Session</span>
              </button>
              <button
                onClick={() => setStep("plan")}
                className="w-full py-2.5 rounded-full bg-white/10 text-xs font-bold text-[#a3b19b] hover:text-[#fbfff4] cursor-pointer"
              >
                Back to Plan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
