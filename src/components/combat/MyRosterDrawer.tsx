import React, { useState, useEffect } from 'react';
import {
  Users,
  User,
  Plus,
  Trash2,
  Swords,
  Shield,
  Heart,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  Dices,
} from 'lucide-react';
import { RosterMember } from '../../types/combat';

interface MyRosterDrawerProps {
  activeCombatantNames: string[];
  onJoinCombat: (member: RosterMember) => Promise<void> | void;
  isDm: boolean;
  playerName?: string;
}

const LOCAL_ROSTER_KEY = 'ashtapor_my_roster';

const DEFAULT_SAMPLE_ROSTER: RosterMember[] = [
  {
    id: 'roster-valerius',
    name: 'Valerius',
    role: 'PC',
    ac: 18,
    maxHp: 38,
    initiativeMod: 2,
  },
];

export const MyRosterDrawer: React.FC<MyRosterDrawerProps> = ({
  activeCombatantNames,
  onJoinCombat,
  isDm,
  playerName = 'Adventurer',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ashtapor_my_roster_expanded') === 'true';
    } catch {
      return false;
    }
  });

  const [roster, setRoster] = useState<RosterMember[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_ROSTER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return DEFAULT_SAMPLE_ROSTER;
  });

  const [isAddFormOpen, setIsAddFormOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newRole, setNewRole] = useState<'PC' | 'Ally'>('PC');
  const [newAc, setNewAc] = useState<number>(14);
  const [newMaxHp, setNewMaxHp] = useState<number>(30);
  const [newInitMod, setNewInitMod] = useState<number>(2);

  const saveRoster = (updated: RosterMember[]) => {
    setRoster(updated);
    try {
      localStorage.setItem(LOCAL_ROSTER_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save roster to localStorage:', e);
    }
  };

  const handleToggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ashtapor_my_roster_expanded', next ? 'true' : 'false');
      } catch {}
      return next;
    });
  };

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const uniqueId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `r_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const member: RosterMember = {
      id: uniqueId,
      name: newName.trim(),
      role: newRole,
      ac: Number(newAc) || 10,
      maxHp: Math.max(1, Number(newMaxHp) || 10),
      initiativeMod: Number(newInitMod) || 0,
    };

    const updated = [...roster, member];
    saveRoster(updated);

    // Reset form
    setNewName('');
    setNewRole('PC');
    setNewAc(14);
    setNewMaxHp(30);
    setNewInitMod(2);
    setIsAddFormOpen(false);
  };

  const handleDeleteMember = (id: string, name: string) => {
    if (window.confirm(`Remove ${name} from your persistent roster?`)) {
      const updated = roster.filter((m) => m.id !== id);
      saveRoster(updated);
    }
  };

  const activeNamesLower = new Set(activeCombatantNames.map((n) => n.toLowerCase().trim()));

  return (
    <div className="shrink-0 bg-slate-900/90 border border-slate-800 rounded-lg overflow-hidden transition-all shadow-sm">
      {/* Drawer Header Toggle */}
      <div className="h-8 px-2.5 bg-slate-950/80 flex items-center justify-between gap-2 border-b border-slate-800/80">
        <button
          type="button"
          onClick={handleToggleOpen}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-amber-300 transition cursor-pointer select-none"
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}
          <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-display font-bold text-[11px] text-slate-200">My Roster</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-amber-400 border border-slate-700">
            {roster.length}
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (!isOpen) setIsOpen(true);
              setIsAddFormOpen(!isAddFormOpen);
            }}
            className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-400/50 flex items-center gap-1 transition cursor-pointer"
            title="Add persistent PC or Ally to local roster"
          >
            <Plus className="w-3 h-3 stroke-[2.5]" />
            <span>Add Character</span>
          </button>
        </div>
      </div>

      {/* Expanded Drawer Content */}
      {isOpen && (
        <div className="p-2 space-y-2 bg-[#0b0f17]/90 animate-fadeIn">
          {/* Add Character Form (Collapsible) */}
          {isAddFormOpen && (
            <form
              onSubmit={handleCreateMember}
              className="p-2.5 rounded-lg bg-slate-900 border border-amber-500/40 space-y-2 text-xs shadow-md animate-fadeIn"
            >
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="font-bold text-amber-300 text-[11px] font-display flex items-center gap-1">
                  <User className="w-3 h-3 text-amber-400" />
                  <span>Add Character to Local Roster</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddFormOpen(false)}
                  className="text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                    Character Name *
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Valerius, Jack (Familiar)"
                    className="w-full px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                    Role
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setNewRole('PC')}
                      className={`py-1 text-[10px] font-bold rounded border transition cursor-pointer ${
                        newRole === 'PC'
                          ? 'bg-sky-500 text-slate-950 border-sky-400'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      PC
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewRole('Ally')}
                      className={`py-1 text-[10px] font-bold rounded border transition cursor-pointer ${
                        newRole === 'Ally'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      Ally
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                    AC
                  </label>
                  <input
                    type="number"
                    value={newAc}
                    onChange={(e) => setNewAc(parseInt(e.target.value, 10) || 10)}
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
                    value={newMaxHp}
                    onChange={(e) => setNewMaxHp(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-rose-300 text-center focus:outline-none focus:border-rose-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                    Init Mod
                  </label>
                  <input
                    type="number"
                    value={newInitMod}
                    onChange={(e) => setNewInitMod(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-amber-300 text-center focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddFormOpen(false)}
                  className="px-2.5 py-1 text-[11px] rounded bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-[11px] font-bold rounded bg-amber-400 hover:bg-amber-300 text-slate-950 shadow cursor-pointer"
                >
                  Save to Roster
                </button>
              </div>
            </form>
          )}

          {/* Roster Cards List */}
          {roster.length === 0 ? (
            <div className="text-center p-3 text-slate-500 text-[11px] italic bg-slate-950/50 rounded border border-slate-800/80">
              No saved characters in roster. Click "+ Add Character" to save persistent PCs or allies.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {roster.map((member) => {
                const isActive = activeNamesLower.has(member.name.toLowerCase().trim());

                return (
                  <div
                    key={member.id}
                    className={`p-2 rounded-lg border transition flex flex-col justify-between gap-1.5 ${
                      member.role === 'PC'
                        ? 'border-sky-500/40 bg-slate-900/90'
                        : 'border-emerald-500/40 bg-slate-900/90'
                    }`}
                  >
                    {/* Top Row: Name & Role Badge */}
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`px-1 py-0.2 rounded text-[9px] font-bold border uppercase shrink-0 ${
                            member.role === 'PC'
                              ? 'bg-sky-500/20 border-sky-500/50 text-sky-400'
                              : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          }`}
                        >
                          {member.role}
                        </span>
                        <span
                          className="font-bold text-xs text-slate-100 truncate"
                          title={member.name}
                        >
                          {member.name}
                        </span>
                      </div>

                      {/* Delete from local roster */}
                      <button
                        type="button"
                        onClick={() => handleDeleteMember(member.id, member.name)}
                        className="text-slate-500 hover:text-rose-400 p-0.5 rounded hover:bg-slate-800 transition cursor-pointer shrink-0"
                        title="Remove from roster"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Stats Strip: AC, Max HP, Initiative Mod */}
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                      <span className="flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5 text-cyan-400" />
                        <span className="text-slate-300 font-bold">{member.ac}</span> AC
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Heart className="w-2.5 h-2.5 text-rose-400" />
                        <span className="text-slate-300 font-bold">{member.maxHp}</span> HP
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Dices className="w-2.5 h-2.5 text-amber-400" />
                        <span className="text-amber-300 font-bold">
                          {member.initiativeMod >= 0 ? `+${member.initiativeMod}` : member.initiativeMod}
                        </span>{' '}
                        Init
                      </span>
                    </div>

                    {/* Actions Strip */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 gap-1.5">
                      {isActive ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 font-mono text-[9px] font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Active in Battle</span>
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-500 italic">
                          Not in combat
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => onJoinCombat(member)}
                        className="px-2 py-1 text-[10px] font-bold rounded bg-amber-400 hover:bg-amber-300 text-slate-950 transition flex items-center gap-1 shadow-sm cursor-pointer ml-auto"
                        title="Roll 1d20 + Init Mod and add character to combat with full HP"
                      >
                        <Swords className="w-3 h-3" />
                        <span>{isActive ? 'Re-Join' : 'Join Combat'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyRosterDrawer;
