import React from "react";
import { Play, History, SlidersHorizontal } from "lucide-react";

interface BottomNavProps {
  currentView: string;
  onSelectView: (view: "dashboard" | "custom") => void;
  onOpenStart: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onSelectView,
  onOpenStart,
}) => {
  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-md p-1.5 rounded-full bg-[#14171d]/90 border border-white/10 backdrop-blur-xl shadow-2xl shadow-black/60 flex items-center justify-between">
      <button
        onClick={onOpenStart}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full font-bold text-sm transition-all duration-200 cursor-pointer ${
          currentView === "focus"
            ? "bg-[#f4a261] text-[#14171d] shadow-md shadow-[#f4a261]/20"
            : "text-[#a3b19b] hover:text-[#fbfff4] hover:bg-white/5"
        }`}
      >
        <Play className="w-4 h-4 fill-current stroke-none" />
        <span>Focus</span>
      </button>

      <button
        onClick={() => onSelectView("dashboard")}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full font-bold text-sm transition-all duration-200 cursor-pointer ${
          currentView === "dashboard"
            ? "bg-white/10 text-[#fbfff4] shadow-sm"
            : "text-[#a3b19b] hover:text-[#fbfff4] hover:bg-white/5"
        }`}
      >
        <History className="w-4 h-4 stroke-[2.5]" />
        <span>History</span>
      </button>

      <button
        onClick={() => onSelectView("custom")}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full font-bold text-sm transition-all duration-200 cursor-pointer ${
          currentView === "custom"
            ? "bg-white/10 text-[#fbfff4] shadow-sm"
            : "text-[#a3b19b] hover:text-[#fbfff4] hover:bg-white/5"
        }`}
      >
        <SlidersHorizontal className="w-4 h-4 stroke-[2.5]" />
        <span>Tune</span>
      </button>
    </nav>
  );
};
