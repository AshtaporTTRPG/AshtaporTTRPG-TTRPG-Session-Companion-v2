import React, { useState, useEffect } from 'react';
import { RosterMember, RosterRole } from '../../types/combat';
import { X, User, Users, Skull, Crown, Layers, Pencil, Plus } from 'lucide-react';

interface AddRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: RosterMember) => void;
  initialMember?: RosterMember | null;
  isDm: boolean;
}

export const AddRosterModal: React.FC<AddRosterModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialMember,
  isDm,
}) => {
  const isEditing = Boolean(initialMember);

  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<RosterRole>('PC');
  const [ac, setAc] = useState<number>(14);
  const [maxHp, setMaxHp] = useState<number>(30);
  const [initMod, setInitMod] = useState<number>(2);

  // Sync state whenever modal opens or initialMember changes
  useEffect(() => {
    if (initialMember) {
      setName(initialMember.name);
      if (!isDm && initialMember.role !== 'PC' && initialMember.role !== 'Ally') {
        setRole('PC');
      } else {
        setRole(initialMember.role);
      }
      setAc(initialMember.ac);
      setMaxHp(initialMember.maxHp);
      setInitMod(initialMember.initiativeMod);
    } else {
      setName('');
      setRole('PC');
      setAc(14);
      setMaxHp(30);
      setInitMod(2);
    }
  }, [initialMember, isOpen, isDm]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let validatedRole: RosterRole = role;
    if (!isDm && role !== 'PC' && role !== 'Ally') {
      validatedRole = 'PC';
    }

    const uniqueId =
      initialMember?.id ||
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `r_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

    const member: RosterMember = {
      id: uniqueId,
      name: name.trim(),
      role: validatedRole,
      ac: Number(ac) || 10,
      maxHp: Math.max(1, Number(maxHp) || 10),
      initiativeMod: Number(initMod) || 0,
    };

    onSave(member);
    onClose();
  };

  const showAllRoles = Boolean(isDm);

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-2xl space-y-3">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            {isEditing ? (
              <Pencil className="w-4 h-4 text-amber-400" />
            ) : (
              <Plus className="w-4 h-4 text-amber-400" />
            )}
            <h3 className="font-bold text-amber-300 text-xs font-display">
              {isEditing ? 'Edit Roster Character' : 'Add Character to Roster'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="space-y-2.5">
          {/* Character Name */}
          <div>
            <label className="text-[10px] text-slate-300 font-semibold block mb-0.5">
              Character Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jack (Familiar), Bandit Chief, Eldrin"
              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              required
              autoFocus
            />
          </div>

          {/* Role Selector: PC, Ally, Monster, Boss, Custom */}
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-[10px] text-slate-300 font-semibold">
                Role
              </label>
              {showAllRoles && (
                <span className="text-[9px] font-mono text-amber-400">
                  {isEditing ? 'Edit Mode (5 Roles)' : 'GM Roster Mode (5 Roles)'}
                </span>
              )}
            </div>

            <div className={`grid gap-1 ${showAllRoles ? 'grid-cols-5' : 'grid-cols-2'}`}>
              {/* PC */}
              <button
                type="button"
                onClick={() => setRole('PC')}
                className={`py-1 text-[10px] font-bold rounded border transition cursor-pointer flex items-center justify-center gap-1 ${
                  role === 'PC'
                    ? 'bg-sky-500 text-slate-950 font-bold border-sky-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <User className="w-2.5 h-2.5" />
                <span>PC</span>
              </button>

              {/* Ally */}
              <button
                type="button"
                onClick={() => setRole('Ally')}
                className={`py-1 text-[10px] font-bold rounded border transition cursor-pointer flex items-center justify-center gap-1 ${
                  role === 'Ally'
                    ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Users className="w-2.5 h-2.5" />
                <span>Ally</span>
              </button>

              {/* Roles: Monster, Boss, Custom */}
              {showAllRoles && (
                <>
                  <button
                    type="button"
                    onClick={() => setRole('Monster')}
                    className={`py-1 text-[10px] font-bold rounded border transition cursor-pointer flex items-center justify-center gap-1 ${
                      role === 'Monster'
                        ? 'bg-rose-500 text-slate-950 font-bold border-rose-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Skull className="w-2.5 h-2.5" />
                    <span>Monster</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('Boss')}
                    className={`py-1 text-[10px] font-bold rounded border transition cursor-pointer flex items-center justify-center gap-1 ${
                      role === 'Boss'
                        ? 'bg-purple-600 text-amber-200 font-bold border-amber-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Crown className="w-2.5 h-2.5" />
                    <span>Boss</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('Custom')}
                    className={`py-1 text-[10px] font-bold rounded border transition cursor-pointer flex items-center justify-center gap-1 ${
                      role === 'Custom'
                        ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-2.5 h-2.5" />
                    <span>Custom</span>
                  </button>
                </>
              )}
            </div>

            {!showAllRoles && (
              <p className="text-[10px] text-slate-500 mt-1">
                Players stage PC and Ally characters. Monster and Boss roles are GM accessible.
              </p>
            )}
          </div>

          {/* Stats Grid: AC, Max HP, Init Mod */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                Armor Class
              </label>
              <input
                type="number"
                value={ac}
                onChange={(e) => setAc(parseInt(e.target.value, 10) || 10)}
                className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-cyan-300 text-center focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                Max HP
              </label>
              <input
                type="number"
                min="1"
                value={maxHp}
                onChange={(e) => setMaxHp(parseInt(e.target.value, 10) || 1)}
                className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-rose-300 text-center focus:outline-none focus:border-rose-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                Init Mod
              </label>
              <input
                type="number"
                value={initMod}
                onChange={(e) => setInitMod(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-amber-300 text-center focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Form Actions */}
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
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 shadow transition cursor-pointer"
            >
              {isEditing ? 'Save Changes' : 'Save to Roster'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddRosterModal;
