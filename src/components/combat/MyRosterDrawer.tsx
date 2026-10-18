/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Swords,
  Shield,
  Heart,
  Dices,
  Pencil,
  Skull,
  Crown,
  Layers,
  User,
  LogOut,
  X,
  Link as LinkIcon,
} from 'lucide-react';
import { RosterMember, RosterRole, Combatant } from '../../types/combat';
import { AddRosterModal } from './AddRosterModal';
import { EditRosterModal } from '../roster/EditRosterModal';
import OBR from '@owlbear-rodeo/sdk';
import { ROSTER_METADATA_KEY, RosterMetadataPayload } from '../../types/combat';

export interface MyRosterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeCombatantNames?: string[];
  activeCombatants?: Combatant[];
  onJoinCombat: (
    member: RosterMember,
    customInitiative?: number,
    linkedPcId?: string,
    linkedPcName?: string
  ) => Promise<void> | void;
  onExitCombat?: (rosterMemberId: string) => Promise<void> | void;
  isDm: boolean;
  playerName?: string;
  onUpdateActiveCombatantStats?: (member: RosterMember) => void | Promise<void>;
  isSyncing?: boolean;
  onRosterCountChange?: (count: number) => void;
}

const LOCAL_ROSTER_KEY = 'ashtapor_my_roster';

export const MyRosterDrawer: React.FC<MyRosterDrawerProps> = ({
  isOpen,
  onClose,
  activeCombatantNames = [],
  activeCombatants = [],
  onJoinCombat,
  onExitCombat,
  isDm,
  playerName = 'Adventurer',
  onUpdateActiveCombatantStats,
  isSyncing = false,
  onRosterCountChange,
}) => {
  // Purge demo character Valerius and initialize cleanly to []
  const [roster, setRoster] = useState<RosterMember[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_ROSTER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out hardcoded demo character Valerius
          const sanitized = parsed.filter(
            (m) => m && m.id !== 'roster-valerius' && m.name?.trim().toLowerCase() !== 'valerius'
          );
          return sanitized;
        }
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    onRosterCountChange?.(roster.length);
  }, [roster.length, onRosterCountChange]);

  // Modal State for Add & Edit
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingMember, setEditingMember] = useState<RosterMember | null>(null);

  // Selected PC link mapping for Allies in Roster
  const [linkedPcByMemberId, setLinkedPcByMemberId] = useState<Record<string, string>>({});

  // Local loading state to dim buttons for 250ms on click
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null);

  const saveRoster = (updated: RosterMember[]) => {
    setRoster(updated);
    try {
      localStorage.setItem(LOCAL_ROSTER_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save roster to localStorage:', e);
    }
    onRosterCountChange?.(updated.length);
  };

  const handleOpenAdd = () => {
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (member: RosterMember, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMember(member);
  };

  // Sync to active table tracker if active in combat
  const syncToActiveCombatTracker = async (member: RosterMember) => {
    if (onUpdateActiveCombatantStats) {
      try {
        await onUpdateActiveCombatantStats(member);
      } catch (err) {
        console.warn('Error in onUpdateActiveCombatantStats callback:', err);
      }
    }

    try {
      if (OBR.isReady) {
        const meta = await OBR.room.getMetadata();
        const rosterPayload = meta[ROSTER_METADATA_KEY] as RosterMetadataPayload | undefined;

        if (rosterPayload && Array.isArray(rosterPayload.combatants)) {
          let hasChange = false;
          const updatedCombatants = rosterPayload.combatants.map((c) => {
            if (
              (c.rosterId && c.rosterId === member.id) ||
              c.name.toLowerCase().trim() === member.name.toLowerCase().trim()
            ) {
              hasChange = true;
              const newMax = member.maxHp;
              const newCur = Math.min(c.hpCurrent ?? c.hp ?? newMax, newMax);
              return {
                ...c,
                ac: member.ac,
                armorClass: member.ac,
                maxHp: newMax,
                hpMax: newMax,
                hpCurrent: newCur,
                hp: newCur,
                updatedAt: Date.now(),
              };
            }
            return c;
          });

          if (hasChange) {
            await OBR.room.setMetadata({
              [ROSTER_METADATA_KEY]: {
                ...rosterPayload,
                combatants: updatedCombatants,
              },
            });
          }
        }
      }
    } catch (obrErr) {
      console.warn('Could not sync updated roster member to OBR room metadata:', obrErr);
    }
  };

  const handleSaveMember = async (member: RosterMember) => {
    const isExisting = roster.some((m) => m.id === member.id);
    let updated: RosterMember[];

    if (isExisting) {
      updated = roster.map((m) => (m.id === member.id ? member : m));
    } else {
      updated = [...roster, member];
    }

    saveRoster(updated);

    const activeMatch = activeCombatants.find(
      (c) =>
        (c.rosterId && c.rosterId === member.id) ||
        c.name.toLowerCase().trim() === member.name.toLowerCase().trim()
    );
    const isActive =
      Boolean(activeMatch) ||
      activeCombatantNames.some((n) => n.toLowerCase().trim() === member.name.toLowerCase().trim());

    if (isActive) {
      await syncToActiveCombatTracker(member);
    }
  };

  const handleDeleteMember = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Remove ${name} from your persistent roster?`)) {
      const updated = roster.filter((m) => m.id !== id);
      saveRoster(updated);
    }
  };

  const handleJoinCombatClick = async (
    member: RosterMember,
    customInit?: number,
    linkedPcId?: string,
    linkedPcName?: string
  ) => {
    if (isSyncing || loadingMemberId) return;
    setLoadingMemberId(member.id);
    try {
      await onJoinCombat(member, customInit, linkedPcId, linkedPcName);
    } finally {
      setTimeout(() => {
        setLoadingMemberId(null);
      }, 250);
    }
  };

  const handleExitCombatClick = async (memberId: string) => {
    if (isSyncing || loadingMemberId) return;
    setLoadingMemberId(memberId);
    try {
      if (onExitCombat) {
        await onExitCombat(memberId);
      }
    } finally {
      setTimeout(() => {
        setLoadingMemberId(null);
      }, 250);
    }
  };

  const getRoleCardStyle = (role: RosterRole) => {
    switch (role) {
      case 'PC':
        return 'border-sky-500/40 bg-slate-900/90';
      case 'Ally':
        return 'border-emerald-500/40 bg-slate-900/90';
      case 'Monster':
        return 'border-rose-500/40 bg-slate-900/90';
      case 'Boss':
        return 'border-purple-500/50 bg-slate-900/90';
      case 'Custom':
        return 'border-amber-500/40 bg-slate-900/90';
      default:
        return 'border-slate-700 bg-slate-900/90';
    }
  };

  const getRoleBadgeStyle = (role: RosterRole) => {
    switch (role) {
      case 'PC':
        return 'bg-sky-500/20 border-sky-500/50 text-sky-400';
      case 'Ally':
        return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400';
      case 'Monster':
        return 'bg-rose-500/20 border-rose-500/50 text-rose-400';
      case 'Boss':
        return 'bg-purple-600/30 border-purple-400/60 text-purple-300 font-bold';
      case 'Custom':
        return 'bg-amber-500/20 border-amber-500/50 text-amber-300';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  const renderRoleIcon = (role: RosterRole) => {
    switch (role) {
      case 'PC':
        return <User className="w-2.5 h-2.5" />;
      case 'Ally':
        return <Users className="w-2.5 h-2.5" />;
      case 'Monster':
        return <Skull className="w-2.5 h-2.5 text-rose-400" />;
      case 'Boss':
        return <Crown className="w-2.5 h-2.5 text-purple-300" />;
      case 'Custom':
        return <Layers className="w-2.5 h-2.5 text-amber-400" />;
    }
  };

  const activePcs = activeCombatants.filter(
    (c) => c.type === 'player' || c.role === 'PC' || c.role === 'Player'
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Click-away backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over drawer from the right side */}
      <div className="fixed z-50 bg-slate-950/95 border-l border-slate-800 backdrop-blur-sm inset-y-0 right-0 w-80 shadow-2xl p-4 flex flex-col animate-slideInRight">
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="font-display font-bold text-sm text-slate-100">
              Character Roster
            </h3>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-amber-400 border border-slate-700">
              {roster.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-2 py-1 text-xs font-bold rounded bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1 transition cursor-pointer shadow-sm"
              title="Add persistent character to local roster"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
              title="Close Roster"
              aria-label="Close Roster"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Roster Content */}
        <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1 min-h-0 text-xs">
          {roster.length === 0 ? (
            <div className="text-center p-6 text-slate-500 text-xs italic bg-slate-900/40 rounded-lg border border-slate-800/80">
              No saved characters in roster. Click "+ Add" to save persistent characters.
            </div>
          ) : (
            <div className="space-y-2">
              {roster.map((member) => {
                const activeCombatant = activeCombatants.find(
                  (c) =>
                    (c.rosterId && c.rosterId === member.id) ||
                    c.name.toLowerCase().trim() === member.name.toLowerCase().trim()
                );
                const isInCombat =
                  Boolean(activeCombatant) ||
                  activeCombatantNames.some(
                    (n) => n.toLowerCase().trim() === member.name.toLowerCase().trim()
                  );

                const isCardLoading = isSyncing || loadingMemberId === member.id;
                const isAlly = member.role === 'Ally';

                return (
                  <div
                    key={member.id}
                    className={`p-2.5 rounded-xl border transition flex flex-col justify-between gap-2 shadow-sm ${getRoleCardStyle(
                      member.role
                    )}`}
                  >
                    {/* Top Row: Name, Role Badge, Edit & Delete Buttons */}
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase shrink-0 flex items-center gap-0.5 ${getRoleBadgeStyle(
                            member.role
                          )}`}
                        >
                          {renderRoleIcon(member.role)}
                          <span>{member.role}</span>
                        </span>
                        <h4
                          className="font-bold text-slate-100 font-display truncate text-xs"
                          title={member.name}
                        >
                          {member.name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(member, e)}
                          className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition cursor-pointer"
                          title={`Edit ${member.name}`}
                          aria-label={`Edit ${member.name}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteMember(member.id, member.name, e)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                          title={`Delete ${member.name}`}
                          aria-label={`Delete ${member.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Middle Row: Stats (AC, HP, Init Mod) */}
                    <div className="grid grid-cols-3 gap-1.5 py-1 px-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[11px] font-mono">
                      <div className="flex items-center gap-1 text-cyan-300">
                        <Shield className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="text-slate-400 text-[10px]">AC:</span>
                        <span className="font-bold">{member.ac}</span>
                      </div>
                      <div className="flex items-center gap-1 text-rose-300">
                        <Heart className="w-3 h-3 text-rose-400 shrink-0" />
                        <span className="text-slate-400 text-[10px]">HP:</span>
                        <span className="font-bold">{member.maxHp}</span>
                      </div>
                      <div className="flex items-center gap-1 text-amber-300">
                        <Dices className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="text-slate-400 text-[10px]">Init:</span>
                        <span className="font-bold">
                          {member.initiativeMod >= 0 ? `+${member.initiativeMod}` : member.initiativeMod}
                        </span>
                      </div>
                    </div>

                    {/* Linked Ally Initiative Option if member is Ally and not yet in combat */}
                    {!isInCombat && isAlly && activePcs.length > 0 && (
                      <div className="flex items-center justify-between gap-1 p-1.5 rounded bg-slate-950 border border-emerald-500/30 text-[10px]">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                          <LinkIcon className="w-3 h-3" /> Act with PC:
                        </span>
                        <select
                          value={linkedPcByMemberId[member.id] || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            setLinkedPcByMemberId((prev) => ({
                              ...prev,
                              [member.id]: selectedId,
                            }));
                          }}
                          className="bg-slate-900 border border-slate-700 text-slate-200 text-[10px] rounded px-1 py-0.5 max-w-[130px] truncate"
                        >
                          <option value="">-- Roll Standard --</option>
                          {activePcs.map((pc) => (
                            <option key={pc.id} value={pc.id}>
                              {pc.name} (Init {pc.initiative})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Bottom Row: Status Indicator & Join / Exit Action */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                      {isInCombat ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>In Combat</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">
                          Not in battle
                        </span>
                      )}

                      {isInCombat ? (
                        <button
                          type="button"
                          onClick={() => handleExitCombatClick(member.id)}
                          disabled={isCardLoading}
                          className={`bg-rose-950/70 hover:bg-rose-900/90 text-rose-300 border border-rose-800/70 text-xs px-2.5 py-1 rounded font-semibold flex items-center gap-1 transition-colors cursor-pointer ml-auto ${
                            isCardLoading ? 'opacity-40 cursor-wait' : ''
                          }`}
                          title={`Exit combat with ${member.name} (keeps character saved in My Roster)`}
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Exit Combat</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (isAlly && linkedPcByMemberId[member.id]) {
                              const targetPc = activePcs.find(
                                (p) => p.id === linkedPcByMemberId[member.id]
                              );
                              if (targetPc) {
                                const linkedInit = Number((targetPc.initiative - 0.01).toFixed(2));
                                handleJoinCombatClick(member, linkedInit, targetPc.id, targetPc.name);
                                return;
                              }
                            }
                            handleJoinCombatClick(member);
                          }}
                          disabled={isCardLoading}
                          className={`px-2.5 py-1 text-xs font-bold rounded bg-amber-400 hover:bg-amber-300 text-slate-950 transition flex items-center gap-1 shadow-sm cursor-pointer ml-auto ${
                            isCardLoading ? 'opacity-40 cursor-wait' : ''
                          }`}
                          title={
                            isAlly && linkedPcByMemberId[member.id]
                              ? 'Join combat linked to selected PC initiative (-0.01)'
                              : 'Roll 1d20 + Init Mod and add character to combat with full HP'
                          }
                        >
                          <Swords className="w-3.5 h-3.5" />
                          <span>Join Combat</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Character Modal */}
        <AddRosterModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSave={handleSaveMember}
          initialMember={null}
          isDm={isDm}
        />

        {/* Edit Character Modal with strict role gating */}
        <EditRosterModal
          isOpen={Boolean(editingMember)}
          onClose={() => setEditingMember(null)}
          onSave={handleSaveMember}
          member={editingMember}
          isGM={isDm}
        />
      </div>
    </>
  );
};

export default MyRosterDrawer;
