import React, { useState } from "react";
import { Play, Calendar, Clock, Flame, CheckCircle, Edit3, Trash2, AlertCircle } from "lucide-react";
import { AppState, SessionRecord } from "../types";
import { daysRemaining, fmtDuration } from "../utils/storage";

interface DashboardViewProps {
  state: AppState;
  onOpenStart: () => void;
  onUpdateRecord: (record: SessionRecord) => void;
  onDeleteRecord: (id: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  onOpenStart,
  onUpdateRecord,
  onDeleteRecord,
}) => {
  const days = daysRemaining(state.catDate);
  const [editingRecord, setEditingRecord] = useState<SessionRecord | null>(null);

  const rows = [...state.history].sort(
    (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
  );

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord) {
      onUpdateRecord(editingRecord);
      setEditingRecord(null);
    }
  };

  return (
    <div className="space-y-6 pb-28 animate-pop">
      {/* Headspace Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1c222c] via-[#14171d] to-[#0d0f12] border border-white/10 p-6 md:p-8 shadow-xl text-center">
        {/* Soft Background Sun Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-[#f4a261]/15 blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4a261]/15 text-[#f4a261] text-xs font-extrabold uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5" />
            {days > 0 ? `${days} Days to CAT Exam` : "CAT Exam Today"}
          </span>

          <h2 className="text-2xl md:text-3xl font-extrabold text-[#fbfff4] font-display max-w-md mx-auto leading-tight">
            Ready for one quiet block of deep study?
          </h2>

          <p className="text-sm text-[#a3b19b] max-w-sm mx-auto">
            Focus deeply on one goal at a time. Every completed block builds sustainable confidence.
          </p>

          <div className="pt-2">
            <button
              onClick={onOpenStart}
              className="w-full max-w-xs py-4 px-8 rounded-full bg-gradient-to-r from-[#f4a261] to-[#e07a5f] text-[#14171d] font-extrabold text-xl shadow-lg shadow-[#f4a261]/25 hover:opacity-95 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2.5 mx-auto"
            >
              <Play className="w-6 h-6 fill-current stroke-none" />
              <span>Start Session</span>
            </button>
          </div>
        </div>
      </section>

      {/* History Intro & Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <span className="text-xs font-bold text-[#a3b19b] uppercase tracking-wider">Study History</span>
            <h2 className="text-xl font-bold text-[#fbfff4] font-display">Completed & Logged Blocks</h2>
          </div>
          <span className="text-xs font-semibold text-[#a3b19b] bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
            {rows.length} Sessions
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#14171d] p-8 text-center space-y-2">
            <Flame className="w-10 h-10 text-[#f4a261] mx-auto opacity-80" />
            <h3 className="text-lg font-bold text-[#fbfff4] font-display">No sessions logged yet</h3>
            <p className="text-sm text-[#a3b19b] max-w-xs mx-auto">
              Finish your first focus session today. All your study achievements will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#14171d] overflow-x-auto shadow-md no-scrollbar">
            <table className="w-full text-left text-xs text-[#fbfff4]">
              <thead className="bg-[#1d222b] text-[#a3b19b] uppercase text-[10px] tracking-wider font-extrabold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Total</th>
                  <th className="py-3 px-3">Focus</th>
                  <th className="py-3 px-3">Unplanned Break</th>
                  <th className="py-3 px-3">Pomodoros</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((record) => (
                  <tr key={record.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-semibold whitespace-nowrap">{record.date}</td>
                    <td className="py-3.5 px-3 text-[#a3b19b] font-mono">{fmtDuration(record.totalSeconds || 0)}</td>
                    <td className="py-3.5 px-3 text-[#52b788] font-mono font-bold">{fmtDuration(record.focusedSeconds || 0)}</td>
                    <td className="py-3.5 px-3 text-[#f4a261] font-mono">{fmtDuration(record.unplannedBreakSeconds || 0)}</td>
                    <td className="py-3.5 px-3 font-extrabold">{record.completedPomodoros || 0}</td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {record.status === "Completed" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#52b788]/15 text-[#52b788]">
                          <CheckCircle className="w-3 h-3" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e63946]/15 text-[#e63946]">
                          <AlertCircle className="w-3 h-3" />
                          Ended Early
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[#a3b19b] max-w-[160px] truncate">{record.reason || "—"}</td>
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditingRecord({ ...record })}
                        className="p-1.5 rounded-lg text-[#a3b19b] hover:text-[#fbfff4] hover:bg-white/10 transition-colors cursor-pointer"
                        title="Edit Record"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit Record Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#14171d] border border-white/10 p-6 space-y-4 shadow-2xl animate-pop">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#fbfff4] font-display">Edit Study Record</h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-[#a3b19b] hover:text-[#fbfff4] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#a3b19b] mb-1">Date</label>
                <input
                  type="date"
                  value={editingRecord.date}
                  onChange={(e) => setEditingRecord({ ...editingRecord, date: e.target.value })}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-[#fbfff4] focus:outline-none focus:border-[#f4a261]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#a3b19b] mb-1">Total Mins</label>
                  <input
                    type="number"
                    min="0"
                    value={Math.round((editingRecord.totalSeconds || 0) / 60)}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        totalSeconds: Math.max(0, Number(e.target.value)) * 60,
                      })
                    }
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-[#fbfff4] focus:outline-none focus:border-[#f4a261]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#a3b19b] mb-1">Focused Mins</label>
                  <input
                    type="number"
                    min="0"
                    value={Math.round((editingRecord.focusedSeconds || 0) / 60)}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        focusedSeconds: Math.max(0, Number(e.target.value)) * 60,
                      })
                    }
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-[#fbfff4] focus:outline-none focus:border-[#f4a261]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#a3b19b] mb-1">Completed Pomodoros</label>
                <input
                  type="number"
                  min="0"
                  value={editingRecord.completedPomodoros || 0}
                  onChange={(e) =>
                    setEditingRecord({
                      ...editingRecord,
                      completedPomodoros: Math.max(0, Number(e.target.value)),
                    })
                  }
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-[#fbfff4] focus:outline-none focus:border-[#f4a261]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#a3b19b] mb-1">Status</label>
                <select
                  value={editingRecord.status}
                  onChange={(e) =>
                    setEditingRecord({
                      ...editingRecord,
                      status: e.target.value as "Completed" | "Ended Early",
                    })
                  }
                  className="w-full rounded-xl bg-[#1d222b] border border-white/10 px-3 py-2 text-sm text-[#fbfff4] focus:outline-none focus:border-[#f4a261]"
                >
                  <option value="Completed">Completed</option>
                  <option value="Ended Early">Ended Early</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#a3b19b] mb-1">Reason / Notes</label>
                <textarea
                  rows={2}
                  value={editingRecord.reason || ""}
                  onChange={(e) => setEditingRecord({ ...editingRecord, reason: e.target.value })}
                  placeholder="Honest reason..."
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-[#fbfff4] focus:outline-none focus:border-[#f4a261] resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Delete this study record permanently?")) {
                      onDeleteRecord(editingRecord.id);
                      setEditingRecord(null);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-[#e63946]/15 text-[#e63946] text-xs font-bold hover:bg-[#e63946]/25 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRecord(null)}
                    className="px-4 py-2 rounded-xl bg-white/10 text-[#a3b19b] hover:text-[#fbfff4] text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#f4a261] text-[#14171d] text-xs font-extrabold hover:bg-[#e07a5f] transition-colors cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
