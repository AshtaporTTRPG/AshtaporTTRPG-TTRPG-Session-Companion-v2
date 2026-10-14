import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';

export const PRESET_CONDITIONS: string[] = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
  'Concentration',
  'Shield',
  'Bane',
  'Bless',
];

export interface ConditionPickerProps {
  onApplyCondition: (conditionText: string) => void;
  onClose?: () => void;
  activeConditions?: string[];
  title?: string;
  isDm?: boolean;
}

export const ConditionPicker: React.FC<ConditionPickerProps> = ({
  onApplyCondition,
  onClose,
  activeConditions,
  title,
}) => {
  const [conditionText, setConditionText] = useState<string>('');
  const conditionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus input on mount
    conditionInputRef.current?.focus();
  }, []);

  const handleApplyCondition = () => {
    const trimmed = conditionText.trim();
    if (!trimmed) return;
    onApplyCondition(trimmed);
    setConditionText('');
    if (onClose) {
      onClose();
    }
  };

  const handleChipClick = (preset: string) => {
    const populated = `${preset} `;
    setConditionText(populated);
    // Focus conditionInputRef and place text cursor at the end
    setTimeout(() => {
      if (conditionInputRef.current) {
        conditionInputRef.current.focus();
        const len = populated.length;
        conditionInputRef.current.setSelectionRange(len, len);
      }
    }, 0);
  };

  return (
    <div className="space-y-2 text-xs select-none">
      {title && (
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
          <div className="flex items-center gap-1.5 font-bold text-slate-200 truncate">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{title}</span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* 1. Interactive Freeform Input Bar */}
      <div className="flex items-center gap-1.5">
        <input
          ref={conditionInputRef}
          type="text"
          value={conditionText}
          onChange={(e) => setConditionText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleApplyCondition();
            }
          }}
          placeholder="e.g. Blinded, Stunned (end of turn), Shield (+5 AC)"
          className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-amber-500 placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={handleApplyCondition}
          disabled={!conditionText.trim()}
          className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-lg transition-colors shrink-0 cursor-pointer shadow-sm"
        >
          Add
        </button>
      </div>

      {/* 2. Click-to-Populate Preset Chips */}
      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          Preset Conditions
        </span>
        <div className="grid grid-cols-3 gap-1 max-h-36 overflow-y-auto pr-0.5">
          {PRESET_CONDITIONS.map((preset) => {
            const isActive = activeConditions?.some(
              (c) =>
                c.toLowerCase() === preset.toLowerCase() ||
                c.toLowerCase().startsWith(preset.toLowerCase())
            );
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handleChipClick(preset)}
                className={`text-[10px] px-1.5 py-1 rounded border transition cursor-pointer text-left truncate font-medium ${
                  isActive
                    ? 'bg-amber-950/60 border-amber-600/70 text-amber-300 hover:bg-amber-900/60'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border-slate-800 hover:border-slate-700'
                }`}
                title={`Click to populate "${preset} "`}
              >
                {preset}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ConditionPicker;
