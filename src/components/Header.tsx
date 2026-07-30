import React from "react";
import { Plus, Sparkles } from "lucide-react";
import { daysRemaining } from "../utils/storage";

interface HeaderProps {
  currentView: string;
  catDate: string;
  onOpenStart: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, catDate, onOpenStart }) => {
  const days = daysRemaining(catDate);

  return (
    <header className="flex items-center justify-between mb-6 pt-2">
      <div className="flex items-center gap-3">
        {/* Headspace inspired warm glowing mark */}
        <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#f4a261] via-[#e07a5f] to-[#e9c46a] shadow-lg shadow-[#f4a261]/20">
          <Sparkles className="w-5 h-5 text-white stroke-[2.5]" />
        </div>
        <div>
          <p className="text-xs font-bold tracking-wider text-[#a3b19b] uppercase">
            {days > 0 ? `${days} Days to CAT` : "Monk Focus OS"}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#fbfff4] font-display">
            {currentView === "dashboard" ? "History" : currentView === "custom" ? "Tune Settings" : "Focus"}
          </h1>
        </div>
      </div>

      <button
        onClick={onOpenStart}
        className="flex items-center justify-center w-11 h-11 rounded-full bg-[#f4a261] text-[#14171d] hover:bg-[#e07a5f] active:scale-95 transition-all shadow-md shadow-[#f4a261]/25 cursor-pointer"
        aria-label="Start Session"
      >
        <Plus className="w-6 h-6 stroke-[3]" />
      </button>
    </header>
  );
};
