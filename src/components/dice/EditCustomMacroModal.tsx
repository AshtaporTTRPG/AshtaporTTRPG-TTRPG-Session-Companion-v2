/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Bookmark, X, Folder, FileText, Swords, Flame } from 'lucide-react';
import { CustomMacro } from '../../types/ttrpg';

export interface EditCustomMacroModalProps {
  isOpen: boolean;
  macro: CustomMacro | null;
  onClose: () => void;
  onSave: (data: {
    id: string;
    name: string;
    formula: string;
    secondaryFormula?: string;
    notes?: string;
    advantageMode: 'normal' | 'advantage' | 'disadvantage';
    group?: string;
  }) => void;
  existingGroups?: string[];
}

export const EditCustomMacroModal: React.FC<EditCustomMacroModalProps> = ({
  isOpen,
  macro,
  onClose,
  onSave,
  existingGroups = [],
}) => {
  const [macroName, setMacroName] = useState('');
  const [formula, setFormula] = useState('');
  const [secondaryFormula, setSecondaryFormula] = useState('');
  const [notes, setNotes] = useState('');
  const [rollMode, setRollMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');
  const [group, setGroup] = useState('');

  useEffect(() => {
    if (isOpen && macro) {
      setMacroName(macro.name || '');
      setFormula(macro.formula || '1d20+5');
      setSecondaryFormula(macro.secondaryFormula || '');
      setNotes(macro.notes || '');
      setGroup(macro.group && macro.group !== 'General' ? macro.group : '');
      const rawMode = (macro as any).rollMode || macro.advantageMode || 'normal';
      const normalizedMode =
        rawMode === 'advantage' || rawMode === 'Adv' || rawMode === 'adv'
          ? 'advantage'
          : rawMode === 'disadvantage' || rawMode === 'Dis' || rawMode === 'dis'
          ? 'disadvantage'
          : 'normal';
      setRollMode(normalizedMode);
    }
  }, [isOpen, macro]);

  if (!isOpen || !macro) return null;

  const selectableGroups = existingGroups.filter((g) => g !== 'All' && g !== 'General');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!macroName.trim() || !formula.trim()) return;

    onSave({
      id: macro.id,
      name: macroName.trim(),
      formula: formula.trim(),
      secondaryFormula: secondaryFormula.trim() || undefined,
      notes: notes.trim() || undefined,
      advantageMode: rollMode,
      group: group.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2.5 animate-fadeIn">
      <div className="w-full max-w-sm max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-800 shrink-0">
          <h4 className="text-xs font-bold text-slate-100 font-display flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>Edit Macro</span>
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3.5 space-y-2 text-xs overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
          <div>
            <label className="text-[10px] font-semibold text-slate-300 block mb-0.5">
              Macro / Ability Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Dragonite Tail, Psychic Burst, Core Blast"
              value={macroName}
              onChange={(e) => setMacroName(e.target.value)}
              className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 font-sans"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-300 flex items-center gap-1 mb-0.5">
                <Swords className="w-2.5 h-2.5 text-indigo-400" />
                <span>Primary Formula *</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 1d20+9 or 10d6"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                className="w-full px-2 py-1 font-mono rounded bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-300 flex items-center gap-1 mb-0.5">
                <Flame className="w-2.5 h-2.5 text-amber-400" />
                <span>Damage / 2nd Roll</span>
              </label>
              <input
                type="text"
                placeholder="Optional (e.g. 1d12+5)"
                value={secondaryFormula}
                onChange={(e) => setSecondaryFormula(e.target.value)}
                className="w-full px-2 py-1 font-mono rounded bg-slate-950 border border-slate-700 text-emerald-300 focus:outline-none focus:border-amber-400 placeholder:text-slate-600"
              />
            </div>
          </div>
          <p className="text-[9px] text-slate-500 -mt-1">
            Add a 2nd formula to combine Attack + Damage in one row, or leave blank for a standalone roll.
          </p>

          <div>
            <label className="text-[10px] font-semibold text-slate-300 flex items-center gap-1 mb-0.5">
              <FileText className="w-2.5 h-2.5 text-cyan-400" />
              <span>Effects, Save DC & Damage Types (Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Force + Psychic; DC 18 INT save or Frightened"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-400 font-sans placeholder:text-slate-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-300 flex items-center gap-1 mb-0.5">
                <Folder className="w-2.5 h-2.5 text-amber-400" />
                <span>Monster / Profile</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Draco, Witch"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 font-sans"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-300 block mb-0.5">
                Primary Roll Mode
              </label>
              <select
                value={rollMode}
                onChange={(e) => setRollMode(e.target.value as 'normal' | 'advantage' | 'disadvantage')}
                className="w-full px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-slate-200 cursor-pointer focus:outline-none focus:border-amber-400"
              >
                <option value="normal">Straight</option>
                <option value="advantage">Advantage</option>
                <option value="disadvantage">Disadvantage</option>
              </select>
            </div>
          </div>

          {selectableGroups.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {selectableGroups.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroup(g)}
                  className={`px-1.5 py-0.5 text-[9px] rounded border transition cursor-pointer ${
                    group.trim().toLowerCase() === g.toLowerCase()
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 text-xs font-bold rounded bg-amber-400 hover:bg-amber-300 text-slate-950 shadow cursor-pointer transition"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCustomMacroModal;
