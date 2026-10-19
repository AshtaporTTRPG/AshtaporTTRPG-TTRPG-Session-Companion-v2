/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
import { executeDiceRoll } from '../../utils/dice';
import { liveFeedSync } from '../../utils/liveFeedSync';

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

  // Local loading, atomic join and authoritative exit state
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null);
  const [joiningMemberIds, setJoiningMemberIds] = useState<Set<string>>(new Set());
  const [inCombatMemberIds, setInCombatMemberIds] = useState<Set<string>>(new Set());
  const [exitingMemberIds, setExitingMemberIds] = useState<Set<string>>(new Set());
  const [liveCombatantList, setLiveCombatantList] = useState<Combatant[]>([]);
  const hasJustExited = useRef<Set<string>>(new Set());

  // Subscribe to 'ashtapor/roster' room metadata changes to keep roster status in real-time sync across all clients.
  // When the array is cleared or empty (encounter reset/clear), all roster cards immediately revert to "Not in battle".
  useEffect(() => {
    if (!OBR.isReady) return;

    const handleRosterMetaUpdate = (meta: Record<string, any>) => {
      const raw = meta['ashtapor/roster'] as any;
      const combatantsList: Combatant[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.combatants)
        ? raw.combatants
        : [];

      setLiveCombatantList(combatantsList);

      if (combatantsList.length === 0) {
        // Encounter was cleared/reset: immediately revert all roster cards to Not in battle
        setInCombatMemberIds(new Set());
        setJoiningMemberIds(new Set());
        setExitingMemberIds(new Set());
        hasJustExited.current.clear();
      } else {
        const liveIds = new Set<string>();
        roster.forEach((m) => {
          const isLive = combatantsList.some(
            (c) =>
              (c.rosterId && c.rosterId === m.id) ||
              c.id === m.id ||
              c.name.toLowerCase().trim() === m.name.toLowerCase().trim()
          );
          if (isLive) {
            liveIds.add(m.id);
          }
        });
        setInCombatMemberIds(liveIds);
      }
    };

    OBR.room.getMetadata().then(handleRosterMetaUpdate).catch(() => {});
    const unsub = OBR.room.onMetadataChange((meta) => {
      handleRosterMetaUpdate(meta);
    });

    return () => unsub();
  }, [roster]);

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
        const raw = meta['ashtapor/roster'] as any;
        const currentCombatants: Combatant[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.combatants)
          ? raw.combatants
          : [];

        let hasChange = false;
        const updatedCombatants = currentCombatants.map((c) => {
          if (
            (c.rosterId && c.rosterId === member.id) ||
            c.id === member.id ||
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
            'ashtapor/roster': updatedCombatants,
          });
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
        c.id === member.id ||
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
    if (isSyncing || joiningMemberIds.has(member.id)) return;
    setJoiningMemberIds((prev) => new Set(prev).add(member.id));
    setLoadingMemberId(member.id);

    try {
      if (OBR.isReady) {
        // Step 1: Immediately fetch fresh, authoritative room metadata from Owlbear
        const roomMeta = await OBR.room.getMetadata();
        const rosterData = roomMeta['ashtapor/roster'] as any;
        const currentCombatants: Combatant[] = Array.isArray(rosterData)
          ? rosterData
          : Array.isArray(rosterData?.combatants)
          ? rosterData.combatants
          : [];

        // Calculate initiative
        let finalInitiative = customInit;
        if (finalInitiative === undefined) {
          const rollResult = executeDiceRoll({
            diceType: 'd20',
            count: 1,
            modifier: member.initiativeMod,
            sender: playerName,
            isDm,
            rollType: 'Straight roll',
            label: `Initiative (${member.name})`,
          });
          liveFeedSync.recordDiceRoll(rollResult, true);
          finalInitiative = rollResult.total;
        }

        const memberType =
          member.role === 'PC'
            ? 'player'
            : member.role === 'Ally'
            ? 'ally'
            : member.role === 'Monster'
            ? 'monster'
            : member.role === 'Boss'
            ? 'boss'
            : 'custom';

        const existingIdx = currentCombatants.findIndex(
          (c) =>
            (c.rosterId && c.rosterId === member.id) ||
            c.id === member.id ||
            c.name.toLowerCase().trim() === member.name.toLowerCase().trim()
        );

        const uniqueId =
          existingIdx !== -1
            ? currentCombatants[existingIdx].id
            : typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `c_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const newCombatant: Combatant = {
          id: uniqueId,
          rosterId: member.id,
          name: member.name,
          role: member.role === 'PC' ? 'Player' : member.role,
          type: memberType,
          ac: member.ac,
          armorClass: member.ac,
          hp: member.maxHp,
          maxHp: member.maxHp,
          hpCurrent: member.maxHp,
          hpMax: member.maxHp,
          tempHp: 0,
          hpTemp: 0,
          initiative: finalInitiative,
          linkedPcId,
          linkedPcName,
          conditions: [],
          hidden: false,
          maskStats: isDm && (member.role === 'Monster' || member.role === 'Boss'),
          isReserve: false,
          sortOrder: currentCombatants.length,
          updatedAt: Date.now(),
        };

        const updatedCombatants = existingIdx !== -1
          ? currentCombatants.map((c, i) => (i === existingIdx ? newCombatant : c))
          : [...currentCombatants, newCombatant];

        updatedCombatants.sort((a, b) => {
          if (b.initiative !== a.initiative) return b.initiative - a.initiative;
          return a.id.localeCompare(b.id);
        });

        // Step 2: Append and write back to OBR.room.setMetadata
        await OBR.room.setMetadata({
          'ashtapor/roster': updatedCombatants,
        });
        setLiveCombatantList(updatedCombatants);
      }

      // Step 3: Local callback execution and optimistic state update
      await onJoinCombat(member, customInit, linkedPcId, linkedPcName);
      setInCombatMemberIds((prev) => new Set(prev).add(member.id));
    } catch (err) {
      console.warn('Could not join combat atomically:', err);
    } finally {
      setTimeout(() => {
        setJoiningMemberIds((prev) => {
          const next = new Set(prev);
          next.delete(member.id);
          return next;
        });
        setLoadingMemberId(null);
      }, 250);
    }
  };

  const handleExitCombatClick = async (member: RosterMember) => {
    if (isSyncing || exitingMemberIds.has(member.id)) return;
    setExitingMemberIds((prev) => new Set(prev).add(member.id));
    setLoadingMemberId(member.id);

    try {
      if (OBR.isReady) {
        // Authoritative Exit Execution: Fetch fresh room metadata from Owlbear
        const roomMeta = await OBR.room.getMetadata();
        const rawRoster = roomMeta['ashtapor/roster'] as any;
        const liveCombatants: Combatant[] = Array.isArray(rawRoster)
          ? rawRoster
          : Array.isArray(rawRoster?.combatants)
          ? rawRoster.combatants
          : [];

        // Remove the combatant by matching ID, rosterId, or exact trimmed name
        const updated = liveCombatants.filter(
          (c) =>
            c.id !== member.id &&
            c.rosterId !== member.id &&
            c.name.toLowerCase().trim() !== member.name.toLowerCase().trim()
        );

        // Write the authoritative updated array back to Owlbear
        await OBR.room.setMetadata({ 'ashtapor/roster': updated });
        setLiveCombatantList(updated);
      }

      // Immediately update local state so the card switches from [ ✓ In Combat ] [ ➔ Exit ] back to 'Not in battle'
      setInCombatMemberIds((prev) => {
        const next = new Set(prev);
        next.delete(member.id);
        return next;
      });
      hasJustExited.current.add(member.id);
      setTimeout(() => {
        hasJustExited.current.delete(member.id);
      }, 4000);

      if (onExitCombat) {
        await onExitCombat(member.id);
      }
    } catch (err) {
      console.warn('Could not exit combat authoritatively:', err);
    } finally {
      setTimeout(() => {
        setExitingMemberIds((prev) => {
          const next = new Set(prev);
          next.delete(member.id);
          return next;
        });
        setLoadingMemberId(null);
      }, 200);
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
                const isExiting = exitingMemberIds.has(member.id);
                const isJoining = joiningMemberIds.has(member.id);
                const isCardLoading = isSyncing || loadingMemberId === member.id;
                const isAlly = member.role === 'Ally';

                // Real-time authoritative check against Owlbear room metadata
                const isLiveInRoom = liveCombatantList.some(
                  (c) =>
                    (c.rosterId && c.rosterId === member.id) ||
                    c.id === member.id ||
                    c.name.toLowerCase().trim() === member.name.toLowerCase().trim()
                );

                const isActiveInProps =
                  activeCombatants.some(
                    (c) =>
                      (c.rosterId && c.rosterId === member.id) ||
                      c.id === member.id ||
                      c.name.toLowerCase().trim() === member.name.toLowerCase().trim()
                  ) ||
                  activeCombatantNames.some(
                    (n) => n.toLowerCase().trim() === member.name.toLowerCase().trim()
                  );

                const hasExited = hasJustExited.current.has(member.id);

                // Authoritative presence: If OBR is ready, liveCombatantList determines status.
                // If liveCombatantList is empty, NO ONE is in combat (lock released).
                const isInCombat =
                  !isExiting &&
                  !hasExited &&
                  (OBR.isReady
                    ? isLiveInRoom
                    : inCombatMemberIds.has(member.id) || isActiveInProps);

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
                              {pc.name} (Init {Math.ceil(pc.initiative)})
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
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            disabled
                            className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-950/80 border border-emerald-600/70 text-emerald-300 flex items-center gap-1 cursor-default opacity-90 shadow-sm"
                          >
                            <span>✓ In Combat</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExitCombatClick(member)}
                            disabled={isCardLoading || isJoining || isExiting}
                            className={`bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-700 text-xs px-2 py-0.5 rounded font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                              isExiting ? 'opacity-70 cursor-wait' : isCardLoading ? 'opacity-40 cursor-wait' : ''
                            }`}
                            title={`Exit combat with ${member.name} (keeps character saved in My Roster)`}
                          >
                            {isExiting ? (
                              <>
                                <span className="text-xs">⏳</span>
                                <span>Exiting...</span>
                              </>
                            ) : (
                              <>
                                <LogOut className="w-3 h-3" />
                                <span>Exit</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (isAlly && linkedPcByMemberId[member.id]) {
                              const targetPc = activePcs.find(
                                (p) => p.id === linkedPcByMemberId[member.id]
                              );
                              if (targetPc) {
                                const linkedInit = Number((targetPc.initiative - 0.001).toFixed(3));
                                handleJoinCombatClick(member, linkedInit, targetPc.id, targetPc.name);
                                return;
                              }
                            }
                            handleJoinCombatClick(member);
                          }}
                          disabled={isJoining || isCardLoading}
                          className={`px-2.5 py-1 text-xs font-bold rounded bg-amber-400 hover:bg-amber-300 text-slate-950 transition flex items-center gap-1 shadow-sm ml-auto ${
                            isJoining
                              ? 'pointer-events-none opacity-80 cursor-wait bg-amber-500/80'
                              : isCardLoading
                              ? 'opacity-40 cursor-wait'
                              : 'cursor-pointer'
                          }`}
                          title="Join combat with full HP"
                        >
                          {isJoining ? (
                            <>
                              <span className="text-xs">⏳</span>
                              <span>Joining...</span>
                            </>
                          ) : (
                            <>
                              <Swords className="w-3.5 h-3.5" />
                              <span>Join Combat</span>
                            </>
                          )}
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
