import React from "react";
import { Plus, Trash2, Volume2, Download, Upload, Calendar, Palette, Clock, ShieldCheck } from "lucide-react";
import { AppState, colorPalettes } from "../types";
import { SOUND_OPTIONS, testSelectedSound } from "../utils/audio";
import { uid } from "../utils/storage";

interface CustomizationViewProps {
  state: AppState;
  onChangeState: (updater: (prev: AppState) => AppState) => void;
  onExportProfile: () => void;
  onImportProfile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const CustomizationView: React.FC<CustomizationViewProps> = ({
  state,
  onChangeState,
  onExportProfile,
  onImportProfile,
}) => {
  const selectedPalette = colorPalettes[state.paletteTheme] || colorPalettes.headspace;

  const sectionTargets = [
    { id: "varc", label: "VARC", emoji: state.subjects.find((s) => s.id === "varc")?.emoji || "📖" },
    { id: "dilr", label: "DILR", emoji: state.subjects.find((s) => s.id === "dilr")?.emoji || "🧩" },
    { id: "quant", label: "QUANT", emoji: state.subjects.find((s) => s.id === "quant")?.emoji || "∑" },
    { id: "short", label: "Short Break", emoji: "💧" },
    { id: "long", label: "Long Break", emoji: "🧘" }
  ];

  const handleAssignColor = (colorIndex: number, sectionId: string) => {
    onChangeState((prev) => {
      const assignments = { ...prev.colorAssignments };
      const currentVal = assignments[sectionId];
      const occupying = Object.keys(assignments).find((k) => k !== sectionId && assignments[k] === colorIndex);

      assignments[sectionId] = colorIndex;
      if (occupying) assignments[occupying] = currentVal;

      const updated = { ...prev, colorAssignments: assignments };
      // Apply color to subjects
      updated.subjects = updated.subjects.map((sub) => {
        if (assignments[sub.id] !== undefined) {
          return { ...sub, color: selectedPalette.colors[assignments[sub.id] % selectedPalette.colors.length] };
        }
        return sub;
      });
      if (updated.breaks?.short) updated.breaks.short.color = selectedPalette.colors[assignments.short % selectedPalette.colors.length];
      if (updated.breaks?.long) updated.breaks.long.color = selectedPalette.colors[assignments.long % selectedPalette.colors.length];

      return updated;
    });
  };

  const handleTestChime = (soundId: string) => {
    testSelectedSound(soundId);
  };

  return (
    <div className="space-y-6 pb-28 animate-pop">
      {/* Header Info */}
      <div className="bg-[#14171d] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-[#f4a261] uppercase tracking-wider">Mindful Customization</span>
          <h2 className="text-xl font-bold text-[#fbfff4] font-display">Fine-Tune Monk Focus</h2>
        </div>
        <div className="w-10 h-10 rounded-full bg-[#f4a261]/15 text-[#f4a261] flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" />
        </div>
      </div>

      {/* 1. Study Modes */}
      <section className="bg-[#14171d] rounded-2xl border border-white/10 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#fbfff4] font-display">Study Modes</h2>
            <p className="text-xs text-[#a3b19b]">Configure daily deep work targets</p>
          </div>
          <button
            onClick={() => {
              onChangeState((prev) => ({
                ...prev,
                modes: [...prev.modes, { id: uid(), name: "Custom Mode", hours: 7, note: "Balanced daily block" }]
              }));
            }}
            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-[#fbfff4] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Mode
          </button>
        </div>

        <div className="space-y-3">
          {state.modes.map((mode) => (
            <div key={mode.id} className="p-3.5 rounded-xl bg-[#1d222b] border border-white/5 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={mode.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    onChangeState((prev) => ({
                      ...prev,
                      modes: prev.modes.map((m) => (m.id === mode.id ? { ...m, name: val } : m))
                    }));
                  }}
                  placeholder="Mode Name"
                  className="rounded-lg bg-black/20 border border-white/10 px-3 py-1.5 text-sm font-bold text-[#fbfff4] focus:outline-none focus:border-[#f4a261]"
                />
                <input
                  type="text"
                  value={mode.note}
                  onChange={(e) => {
                    const val = e.target.value;
                    onChangeState((prev) => ({
                      ...prev,
                      modes: prev.modes.map((m) => (m.id === mode.id ? { ...m, note: val } : m))
                    }));
                  }}
                  placeholder="Note"
                  className="rounded-lg bg-black/20 border border-white/10 px-3 py-1.5 text-xs text-[#a3b19b] focus:outline-none focus:border-[#f4a261]"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={mode.hours}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(16, Number(e.target.value)));
                      onChangeState((prev) => ({
                        ...prev,
                        modes: prev.modes.map((m) => (m.id === mode.id ? { ...m, hours: val } : m))
                      }));
                    }}
                    className="w-20 rounded-lg bg-black/20 border border-white/10 px-3 py-1.5 text-sm font-bold text-[#fbfff4] text-center focus:outline-none focus:border-[#f4a261]"
                  />
                  <span className="text-xs text-[#a3b19b]">Hours</span>

                  {!["focused", "intensive", "monk"].includes(mode.id) && (
                    <button
                      onClick={() => {
                        onChangeState((prev) => ({
                          ...prev,
                          modes: prev.modes.filter((m) => m.id !== mode.id)
                        }));
                      }}
                      className="ml-auto p-1.5 rounded-lg text-[#e63946] hover:bg-[#e63946]/15 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Break Settings */}
      <section className="bg-[#14171d] rounded-2xl border border-white/10 p-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#fbfff4] font-display">Break Structure</h2>
          <p className="text-xs text-[#a3b19b]">Breaks occur between study blocks</p>
        </div>

        <div className="space-y-4 divide-y divide-white/5">
          {/* Short Break */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#fbfff4]">Short Break</h3>
                <p className="text-[11px] text-[#a3b19b]">Micro recovery between study chunks</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[11px] font-bold text-[#a3b19b]">
                  Duration:
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={state.breaks.short.minutes}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onChangeState((prev) => ({
                        ...prev,
                        breaks: { ...prev.breaks, short: { ...prev.breaks.short, minutes: val } }
                      }));
                    }}
                    className="ml-1 w-12 rounded-lg bg-black/20 border border-white/10 px-1.5 py-1 text-xs font-bold text-[#fbfff4] text-center"
                  />
                  m
                </label>
                <label className="text-[11px] font-bold text-[#a3b19b]">
                  Every:
                  <input
                    type="number"
                    min="25"
                    max="60"
                    value={state.breaks.short.everyMinutes || 50}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onChangeState((prev) => ({
                        ...prev,
                        breaks: { ...prev.breaks, short: { ...prev.breaks.short, everyMinutes: val } }
                      }));
                    }}
                    className="ml-1 w-14 rounded-lg bg-black/20 border border-white/10 px-1.5 py-1 text-xs font-bold text-[#fbfff4] text-center"
                  />
                  m
                </label>
              </div>
            </div>

            <div className="space-y-2">
              {state.breaks.short.activities.map((act, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={state.breaks.short.emojis[act] || "💧"}
                    onChange={(e) => {
                      const emoji = e.target.value;
                      onChangeState((prev) => {
                        const updatedEmojis = { ...prev.breaks.short.emojis, [act]: emoji };
                        return { ...prev, breaks: { ...prev.breaks, short: { ...prev.breaks.short, emojis: updatedEmojis } } };
                      });
                    }}
                    className="w-10 rounded-lg bg-black/20 border border-white/10 p-1.5 text-center text-sm"
                  />
                  <input
                    type="text"
                    value={act}
                    onChange={(e) => {
                      const newAct = e.target.value;
                      onChangeState((prev) => {
                        const activities = [...prev.breaks.short.activities];
                        activities[idx] = newAct;
                        return { ...prev, breaks: { ...prev.breaks, short: { ...prev.breaks.short, activities } } };
                      });
                    }}
                    className="flex-1 rounded-lg bg-black/20 border border-white/10 px-3 py-1.5 text-xs text-[#fbfff4]"
                  />
                  {state.breaks.short.activities.length > 1 && (
                    <button
                      onClick={() => {
                        onChangeState((prev) => {
                          const activities = prev.breaks.short.activities.filter((_, i) => i !== idx);
                          return { ...prev, breaks: { ...prev.breaks, short: { ...prev.breaks.short, activities } } };
                        });
                      }}
                      className="p-1.5 text-[#e63946] hover:bg-white/5 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Long Break */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#fbfff4]">Long Break</h3>
                <p className="text-[11px] text-[#a3b19b]">Extended recovery after subject blocks</p>
              </div>
              <label className="text-[11px] font-bold text-[#a3b19b]">
                Duration:
                <input
                  type="number"
                  min="5"
                  max="45"
                  value={state.breaks.long.minutes}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    onChangeState((prev) => ({
                      ...prev,
                      breaks: { ...prev.breaks, long: { ...prev.breaks.long, minutes: val } }
                    }));
                  }}
                  className="ml-1 w-12 rounded-lg bg-black/20 border border-white/10 px-1.5 py-1 text-xs font-bold text-[#fbfff4] text-center"
                />
                m
              </label>
            </div>

            <div className="space-y-2">
              {state.breaks.long.activities.map((act, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={state.breaks.long.emojis[act] || "🧘"}
                    onChange={(e) => {
                      const emoji = e.target.value;
                      onChangeState((prev) => {
                        const updatedEmojis = { ...prev.breaks.long.emojis, [act]: emoji };
                        return { ...prev, breaks: { ...prev.breaks, long: { ...prev.breaks.long, emojis: updatedEmojis } } };
                      });
                    }}
                    className="w-10 rounded-lg bg-black/20 border border-white/10 p-1.5 text-center text-sm"
                  />
                  <input
                    type="text"
                    value={act}
                    onChange={(e) => {
                      const newAct = e.target.value;
                      onChangeState((prev) => {
                        const activities = [...prev.breaks.long.activities];
                        activities[idx] = newAct;
                        return { ...prev, breaks: { ...prev.breaks, long: { ...prev.breaks.long, activities } } };
                      });
                    }}
                    className="flex-1 rounded-lg bg-black/20 border border-white/10 px-3 py-1.5 text-xs text-[#fbfff4]"
                  />
                  {state.breaks.long.activities.length > 1 && (
                    <button
                      onClick={() => {
                        onChangeState((prev) => {
                          const activities = prev.breaks.long.activities.filter((_, i) => i !== idx);
                          return { ...prev, breaks: { ...prev.breaks, long: { ...prev.breaks.long, activities } } };
                        });
                      }}
                      className="p-1.5 text-[#e63946] hover:bg-white/5 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Section Color Palette */}
      <section className="bg-[#14171d] rounded-2xl border border-white/10 p-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#fbfff4] font-display">Section Color Theme</h2>
          <p className="text-xs text-[#a3b19b]">Curated Headspace palettes for study sections</p>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-[#a3b19b]">
            Select Theme Palette
            <select
              value={state.paletteTheme}
              onChange={(e) => {
                const paletteKey = e.target.value;
                onChangeState((prev) => {
                  const updated = { ...prev, paletteTheme: paletteKey };
                  const pal = colorPalettes[paletteKey] || colorPalettes.headspace;
                  updated.subjects = updated.subjects.map((sub) => ({
                    ...sub,
                    color: pal.colors[updated.colorAssignments[sub.id] % pal.colors.length]
                  }));
                  if (updated.breaks?.short) updated.breaks.short.color = pal.colors[updated.colorAssignments.short % pal.colors.length];
                  if (updated.breaks?.long) updated.breaks.long.color = pal.colors[updated.colorAssignments.long % pal.colors.length];
                  return updated;
                });
              }}
              className="mt-1 w-full rounded-xl bg-[#1d222b] border border-white/10 px-3 py-2 text-sm text-[#fbfff4] font-bold focus:outline-none focus:border-[#f4a261]"
            >
              {Object.entries(colorPalettes).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {selectedPalette.colors.map((color, colorIdx) => {
              const assigned = sectionTargets.find((t) => state.colorAssignments[t.id] === colorIdx);
              return (
                <div key={colorIdx} className="p-3 rounded-xl bg-[#1d222b] border border-white/5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl shadow-inner border border-black/10" style={{ backgroundColor: color }} />
                    <span className="text-xs font-mono font-bold text-[#a3b19b]">{color}</span>
                  </div>

                  <div className="flex flex-wrap gap-1 justify-end">
                    {sectionTargets.map((target) => {
                      const isSelected = assigned?.id === target.id;
                      return (
                        <button
                          key={target.id}
                          onClick={() => handleAssignColor(colorIdx, target.id)}
                          className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#f4a261] text-[#14171d] shadow-sm"
                              : "bg-black/30 text-[#a3b19b] hover:text-[#fbfff4]"
                          }`}
                        >
                          {target.emoji} {target.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Audio Chimes */}
      <section className="bg-[#14171d] rounded-2xl border border-white/10 p-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#fbfff4] font-display">Chime Sound Design</h2>
          <p className="text-xs text-[#a3b19b]">Web Audio alerts optimized for iPhone PWA</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOUND_OPTIONS.map((sound) => {
            const isSelected = state.sound === sound.id;
            return (
              <div
                key={sound.id}
                onClick={() => {
                  onChangeState((prev) => ({ ...prev, sound: sound.id }));
                  handleTestChime(sound.id);
                }}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#f4a261]/15 border-[#f4a261] text-[#fbfff4]"
                    : "bg-[#1d222b] border-white/5 text-[#a3b19b] hover:border-white/10"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Volume2 className={`w-4 h-4 ${isSelected ? "text-[#f4a261]" : "text-[#a3b19b]"}`} />
                  <span className="text-sm font-bold">{sound.name}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTestChime(sound.id);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/10 text-[10px] font-bold text-[#fbfff4] hover:bg-white/20"
                >
                  Test
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Target Date */}
      <section className="bg-[#14171d] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#fbfff4]">CAT Exam Target Date</h2>
          <p className="text-xs text-[#a3b19b]">Powers countdown badges across the app</p>
        </div>
        <input
          type="date"
          value={state.catDate}
          onChange={(e) => {
            const val = e.target.value;
            onChangeState((prev) => ({ ...prev, catDate: val }));
          }}
          className="rounded-xl bg-[#1d222b] border border-white/10 px-3 py-1.5 text-xs font-bold text-[#fbfff4] focus:outline-none focus:border-[#f4a261]"
        />
      </section>

      {/* 6. Profile Export & Import */}
      <section className="bg-[#14171d] rounded-2xl border border-white/10 p-5 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-[#fbfff4]">Profile Backup & Restore</h2>
          <p className="text-xs text-[#a3b19b]">Save or import all local focus history & settings</p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={onExportProfile}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-[#fbfff4] transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Profile</span>
          </button>

          <label className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-[#fbfff4] transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Import Profile</span>
            <input type="file" accept="application/json" onChange={onImportProfile} hidden />
          </label>
        </div>
      </section>

      <p className="text-center text-xs font-bold text-[#a3b19b]/60 pt-2">
        Monk Focus PWA • v26.0
      </p>
    </div>
  );
};
