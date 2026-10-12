import React from 'react';
import { RotateCcw, Skull, Trash2, X, Shield, Swords } from 'lucide-react';
import { Combatant } from '../../types/ttrpg';

interface ResetCombatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearHostilesOnly: () => void;
  onFullClear: () => void;
  combatants: Combatant[];
}

export const ResetCombatModal: React.FC<ResetCombatModalProps> = ({
  isOpen,
  onClose,
  onClearHostilesOnly,
  onFullClear,
  combatants,
}) => {
  if (!isOpen) return null;

  const hostileCount = combatants.filter(
    (c) =>
      c.role === 'Monster' ||
      c.role === 'Boss' ||
      c.role === 'Custom' ||
      c.type === 'monster' ||
      c.type === 'boss' ||
      c.type === 'custom'
  ).length;

  const partyCount = combatants.length - hostileCount;

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-3.5">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-100 font-display">
                Reset Encounter
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                {combatants.length} active ({partyCount} PCs/Allies · {hostileCount} Hostiles)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options Description */}
        <p className="text-xs text-slate-300 leading-relaxed">
          Choose how you want to reset the current initiative order:
        </p>

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Option 1: Clear Hostiles Only */}
          <button
            type="button"
            onClick={onClearHostilesOnly}
            disabled={hostileCount === 0}
            className="w-full p-2.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/60 hover:border-amber-400 text-left transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group flex items-start gap-2.5 shadow-sm"
          >
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 group-hover:scale-105 transition">
              <Skull className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-amber-300 flex items-center justify-between">
                <span>Clear Hostiles Only</span>
                <span className="text-[10px] font-mono opacity-80">Wave Reset</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Removes {hostileCount} monsters and bosses. Preserves {partyCount} PCs and allies with their current HP, conditions, and position. Resets Round to 1.
              </p>
            </div>
          </button>

          {/* Option 2: Full Clear */}
          <button
            type="button"
            onClick={onFullClear}
            className="w-full p-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/80 hover:border-rose-500 text-left transition cursor-pointer group flex items-start gap-2.5 shadow-sm"
          >
            <div className="w-6 h-6 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 mt-0.5 group-hover:scale-105 transition">
              <Trash2 className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-rose-300 flex items-center justify-between">
                <span>End Encounter (Full Clear)</span>
                <span className="text-[10px] font-mono opacity-80">Full Wipe</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Clears all combatants and clears combat feed. Players keep their characters safely saved in My Roster.
              </p>
            </div>
          </button>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetCombatModal;
