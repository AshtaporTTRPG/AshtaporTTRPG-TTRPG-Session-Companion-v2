/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Bookmark, X, Folder } from 'lucide-react';
import { CustomMacro } from '../../types/ttrpg';

export interface EditCustomMacroModalProps {
  isOpen: boolean;
  macro: CustomMacro | null;
  onClose: () => void;
  onSave: (data: {
    id: string;
    name: string;
    formula: string;
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
  const [rollMode, setRollMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');
  const [group, setGroup] = useState('');

  useEffect(() => {
    if (isOpen && macro) {
      setMacroName(macro.name || '');
      setFormula(macro.formula || '1d20+5');
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
      advantageMode: rollMode,
      group: group.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
      <div className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-xl p-3.5 shadow-2xl space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
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

        <form onSubmit={handleSubmit} className="space-y-2 text-xs">
          <div>
            <label className="text-[10px] font-semibold text-slate-300 block mb-0.5">
              Macro Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Dragonite Sword, Sneak Attack"
              value={macroName}
              onChange={(e) => setMacroName(e.target.value)}
              className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 font-sans"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-300 block mb-0.5">
              Formula *
            </label>
            <input
              type="text"
              placeholder="e.g. 1d20+6, 2d6+1d8+3, 8d6"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              className="w-full px-2 py-1 font-mono rounded bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400"
              required
            />
            <p className="text-[9px] text-slate-500 mt-0.5">
              Flat modifier is parsed automatically from formula (e.g. +6, -1).
            </p>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-300 flex items-center gap-1 mb-0.5">
              <Folder className="w-2.5 h-2.5 text-amber-400" />
              <span>Monster / Encounter Profile</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Draconian, Boss, Utility (Optional)"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 font-sans"
            />
            {selectableGroups.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
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
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-300 block mb-0.5">
              Roll Mode
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
