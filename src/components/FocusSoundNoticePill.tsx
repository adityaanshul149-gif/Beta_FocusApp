import React, { useState, useEffect } from "react";
import { Volume2, VolumeX, Check, Sparkles } from "lucide-react";
import { unlockAudio, isAudioReady, testSelectedSound } from "../utils/audio";

interface FocusSoundNoticePillProps {
  soundId: string;
}

export const FocusSoundNoticePill: React.FC<FocusSoundNoticePillProps> = ({ soundId }) => {
  const [notice, setNotice] = useState<{
    visible: boolean;
    isWorking: boolean;
  } | null>(null);

  useEffect(() => {
    let wasHidden = false;
    let autoHideTimer: NodeJS.Timeout | null = null;

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        wasHidden = true;
      } else if (wasHidden) {
        // App regained focus after being hidden/backgrounded
        wasHidden = false;
        const ok = await unlockAudio();
        const ready = isAudioReady() || ok;

        setNotice({
          visible: true,
          isWorking: ready,
        });

        if (autoHideTimer) clearTimeout(autoHideTimer);
        autoHideTimer = setTimeout(() => {
          setNotice(null);
        }, 5000);
      }
    };

    const handleFocus = async () => {
      if (wasHidden) {
        handleVisibilityChange();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      if (autoHideTimer) clearTimeout(autoHideTimer);
    };
  }, []);

  if (!notice || !notice.visible) return null;

  const handleAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (notice.isWorking) {
      const ok = await testSelectedSound(soundId);
      setNotice({ visible: true, isWorking: ok });
    } else {
      const ok = await unlockAudio();
      const ready = isAudioReady() || ok;
      setNotice({ visible: true, isWorking: ready });
    }
  };

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] animate-pop">
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#14171d]/95 text-white shadow-2xl border border-white/20 backdrop-blur-xl text-xs font-bold">
        {notice.isWorking ? (
          <div className="flex items-center gap-1.5 text-[#52b788]">
            <Check className="w-4 h-4" />
            <span>Sound Ready</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[#e07a5f]">
            <VolumeX className="w-4 h-4" />
            <span>Sound Unavailable</span>
          </div>
        )}

        <button
          onClick={handleAction}
          className="ml-1 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-[11px] font-extrabold transition-all active:scale-95 cursor-pointer flex items-center gap-1"
        >
          {notice.isWorking ? (
            <>
              <Sparkles className="w-3 h-3 text-[#f4a261]" />
              <span>Test</span>
            </>
          ) : (
            <span>Retry</span>
          )}
        </button>

        <button
          onClick={() => setNotice(null)}
          className="text-white/40 hover:text-white/80 ml-1 text-sm font-bold cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
