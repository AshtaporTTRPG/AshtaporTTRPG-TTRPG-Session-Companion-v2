import React, { useState } from 'react';
import { CombatantType } from '../../types/ttrpg';
import { Plus, X, Shield, EyeOff, Eye, Layers, Skull, Crown, User, Users } from 'lucide-react';

export interface NewCombatantData {
  name: string;
  type: CombatantType;
  customRoleLabel?: string;
  initiative: number;
  ac: number;
  hpMax: number;
  hpTemp: number;
  maskStats: boolean;
  isReserve: boolean;
}

interface AddCombatantModalProps {
  isOpen: boolean;
  isDm: boolean;
  onClose: () => void;
  onAdd: (data: NewCombatantData) => void;
}

export const AddCombatantModal: React.FC<AddCombatantModalProps> = ({
  isOpen,
  isDm,
  onClose,
  onAdd,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<CombatantType>(isDm ? 'monster' : 'player');
  const [customRoleLabel, setCustomRoleLabel] = useState('');
  const [initiative, setInitiative] = useState(10);
  const [ac, setAc] = useState(10);
  const [hpMax, setHpMax] = useState(25);
  const [hpTemp, setHpTemp] = useState(0);

  // Checkbox 1: Mask Stats (HP/AC hidden from players, but appears in roster)
  const [maskStats, setMaskStats] = useState<boolean>(() => {
    return isDm ? true : false;
  });

  // Checkbox 2: Reserve / Stage (Reinforcements hidden completely from players until deployed)
  const [isReserve, setIsReserve] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleTypeChange = (newType: CombatantType) => {
    setType(newType);
    if (newType === 'player' || newType === 'ally') {
      setMaskStats(false);
    } else {
      setMaskStats(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      type,
      customRoleLabel: type === 'custom' && customRoleLabel.trim() ? customRoleLabel.trim() : undefined,
      initiative,
      ac,
      hpMax,
      hpTemp,
      maskStats: isDm ? maskStats : false,
      isReserve: isDm ? isReserve : false,
    });

    // Reset fields
    setName('');
    setType(isDm ? 'monster' : 'player');
    setCustomRoleLabel('');
    setInitiative(10);
    setAc(10);
    setHpMax(25);
    setHpTemp(0);
    setMaskStats(isDm ? true : false);
    setIsReserve(false);
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-2xl space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-sm font-bold text-slate-100 font-display flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Add Combatant</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          {/* Name Field */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Valerius, Goblin Raider, Red Dragon"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-sans"
              required
              autoFocus
            />
          </div>

          {/* Combatant Type / Role Selector */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Role
            </label>
            <div className={`grid gap-1 ${isDm ? 'grid-cols-5' : 'grid-cols-2'}`}>
              <button
                type="button"
                onClick={() => handleTypeChange('player')}
                className={`py-1 text-[11px] font-semibold rounded border transition cursor-pointer flex items-center justify-center gap-1 ${
                  type === 'player'
                    ? 'bg-sky-500 text-slate-950 font-bold border-sky-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <User className="w-2.5 h-2.5" />
                <span>PC</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('ally')}
                className={`py-1 text-[11px] font-semibold rounded border transition cursor-pointer flex items-center justify-center gap-1 ${
                  type === 'ally'
                    ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Users className="w-2.5 h-2.5" />
                <span>Ally</span>
              </button>

              {isDm && (
                <button
                  type="button"
                  onClick={() => handleTypeChange('monster')}
                  className={`py-1 text-[11px] font-semibold rounded border transition cursor-pointer flex items-center justify-center gap-1 ${
                    type === 'monster'
                      ? 'bg-rose-500 text-slate-950 font-bold border-rose-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Skull className="w-2.5 h-2.5" />
                  <span>Monster</span>
                </button>
              )}

              {isDm && (
                <button
                  type="button"
                  onClick={() => handleTypeChange('boss')}
                  className={`py-1 text-[11px] font-semibold rounded border transition cursor-pointer flex items-center justify-center gap-1 ${
                    type === 'boss'
                      ? 'bg-purple-600 text-amber-200 font-bold border-amber-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Crown className="w-2.5 h-2.5" />
                  <span>Boss</span>
                </button>
              )}

              {isDm && (
                <button
                  type="button"
                  onClick={() => handleTypeChange('custom')}
                  className={`py-1 text-[11px] font-semibold rounded border transition cursor-pointer flex items-center justify-center gap-1 ${
                    type === 'custom'
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-2.5 h-2.5" />
                  <span>Custom</span>
                </button>
              )}
            </div>

            {!isDm && (
              <p className="text-[10px] text-slate-500 mt-1">
                Players create PC and Ally combatants. Monsters &amp; Bosses are GM managed.
              </p>
            )}
          </div>

          {/* Custom Role Label if Type is Custom */}
          {isDm && type === 'custom' && (
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                Custom Role Label (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Lair Action, Environmental Hazard"
                value={customRoleLabel}
                onChange={(e) => setCustomRoleLabel(e.target.value)}
                className="w-full px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400"
              />
            </div>
          )}

          {/* Numerical Attributes: Initiative, AC, Max HP, Temp HP */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                Initiative
              </label>
              <input
                type="number"
                value={initiative}
                onChange={(e) => setInitiative(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-amber-300 text-center focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                AC
              </label>
              <input
                type="number"
                value={ac}
                onChange={(e) => setAc(parseInt(e.target.value, 10) || 10)}
                className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-cyan-300 text-center focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                Max HP
              </label>
              <input
                type="number"
                min="1"
                value={hpMax}
                onChange={(e) => setHpMax(parseInt(e.target.value, 10) || 1)}
                className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-rose-300 text-center focus:outline-none focus:border-rose-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                Temp HP
              </label>
              <input
                type="number"
                min="0"
                value={hpTemp}
                onChange={(e) => setHpTemp(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-cyan-300 text-center focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* GM Checkboxes: Disentangled FoW & Staged Waves (Token inputs completely removed!) */}
          {isDm && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              {/* Checkbox 1: Mask Stats */}
              <label className="flex items-start gap-2 p-1.5 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={maskStats}
                  onChange={(e) => setMaskStats(e.target.checked)}
                  className="mt-0.5 rounded bg-slate-900 border-slate-700 text-amber-400 cursor-pointer"
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-200 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-amber-400" />
                    <span>Mask Stats</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Visible on player initiative list, but HP, AC, and exact damage numbers are hidden from players.
                  </p>
                </div>
              </label>

              {/* Checkbox 2: Reserve / Stage */}
              <label className="flex items-start gap-2 p-1.5 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isReserve}
                  onChange={(e) => setIsReserve(e.target.checked)}
                  className="mt-0.5 rounded bg-slate-900 border-slate-700 text-purple-400 cursor-pointer"
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-purple-300 flex items-center gap-1">
                    <EyeOff className="w-3 h-3 text-purple-400" />
                    <span>Reserve / Stage</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    For 2nd/3rd wave reinforcements. Players cannot see this combatant at all until deployed.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer shadow"
            >
              Add to Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCombatantModal;
