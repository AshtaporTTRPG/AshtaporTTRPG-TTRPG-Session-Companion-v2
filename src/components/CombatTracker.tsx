import React, { useState, useEffect, useRef } from 'react';
import {
  Combatant,
  CombatantType,
  Condition,
  isCombatantFoW,
  sortInitiativeStrictDescending,
} from '../types/ttrpg';
import { liveFeedSync } from '../utils/liveFeedSync';
import OBR from '@owlbear-rodeo/sdk';
import { COMBAT_STATE_KEY, CombatState } from '../utils/obrCombatSync';
import { playTurnSound } from '../utils/audio';
import { executeDiceRoll } from '../utils/dice';
import { getHealthThreshold } from '../utils/combatHealth';
import { isConcentrating, calculateConcentrationDC } from '../utils/concentration';
import {
  Swords,
  Plus,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  ArrowUpDown,
  X,
  Sparkles,
  Trash2,
  Dices,
  Eye,
  EyeOff,
  MoreVertical,
  Shield,
  Edit2,
  Check,
  Zap,
  Play,
} from 'lucide-react';

interface CombatTrackerProps {
  isDm: boolean;
  playerName?: string;
}

const CONDITIONS_LIST: Condition[] = [
  'Concentration',
  'Blinded',
  'Charmed',
  'Deafened',
  'Exhaustion',
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
];

export const CombatTracker: React.FC<CombatTrackerProps> = ({ isDm, playerName }) => {
  const rollerIdentity = playerName || liveFeedSync.getPlayerName();

  // Combat State - initialized from local storage
  const [combatants, setCombatants] = useState<Combatant[]>(() => {
    try {
      const saved = localStorage.getItem('ttrpg_combatants');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return sortInitiativeStrictDescending(parsed);
      }
    } catch {}
    return [];
  });

  const [activeCombatantId, setActiveCombatantId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('ttrpg_active_combatant_id') || null;
    } catch {
      return null;
    }
  });

  const [activeTurnIndex, setActiveTurnIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ttrpg_active_turn_index');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [round, setRound] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ttrpg_combat_round');
      return saved ? parseInt(saved, 10) : 1;
    } catch {
      return 1;
    }
  });

  const [combatStatus, setCombatStatus] = useState<'setup' | 'active'>(() => {
    try {
      const saved = localStorage.getItem('ttrpg_combat_status');
      return saved === 'active' ? 'active' : 'setup';
    } catch {
      return 'setup';
    }
  });

  // Modal / Flyout states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [actionMenuCombatantId, setActionMenuCombatantId] = useState<string | null>(null);
  const [editingCombatantId, setEditingCombatantId] = useState<string | null>(null);

  // Form states for Add Combatant
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CombatantType>('player');
  const [newInitiative, setNewInitiative] = useState(10);
  const [newAc, setNewAc] = useState(14);
  const [newHp, setNewHp] = useState(25);
  const [newHidden, setNewHidden] = useState(false);
  const [newIsSecret, setNewIsSecret] = useState(false);
  const [newFogOfWar, setNewFogOfWar] = useState(false);

  // Edit draft states
  const [editName, setEditName] = useState('');
  const [editInit, setEditInit] = useState(10);
  const [editAc, setEditAc] = useState(14);
  const [editHpMax, setEditHpMax] = useState(25);
  const [editHpCurr, setEditHpCurr] = useState(25);

  // Turn alert toast
  const [playerTurnAlert, setPlayerTurnAlert] = useState<string | null>(null);

  // Synchronize active pointer with combatants list
  useEffect(() => {
    if (combatants.length === 0) {
      if (activeCombatantId !== null) setActiveCombatantId(null);
      if (activeTurnIndex !== 0) setActiveTurnIndex(0);
      return;
    }

    if (activeCombatantId) {
      const foundIdx = combatants.findIndex((c) => c.id === activeCombatantId);
      if (foundIdx !== -1) {
        if (foundIdx !== activeTurnIndex) {
          setActiveTurnIndex(foundIdx);
        }
        return;
      }
    }

    const safeIdx = Math.min(Math.max(0, activeTurnIndex), combatants.length - 1);
    const resolved = combatants[safeIdx];
    if (resolved) {
      setActiveCombatantId(resolved.id);
      setActiveTurnIndex(safeIdx);
    }
  }, [combatants, activeCombatantId, activeTurnIndex]);

  // Local storage persistence
  useEffect(() => {
    try {
      localStorage.setItem('ttrpg_combatants', JSON.stringify(combatants));
      localStorage.setItem('ttrpg_active_turn_index', activeTurnIndex.toString());
      if (activeCombatantId) {
        localStorage.setItem('ttrpg_active_combatant_id', activeCombatantId);
      } else {
        localStorage.removeItem('ttrpg_active_combatant_id');
      }
      localStorage.setItem('ttrpg_combat_round', round.toString());
      localStorage.setItem('ttrpg_combat_status', combatStatus);
    } catch {}
  }, [combatants, activeTurnIndex, activeCombatantId, round, combatStatus]);

  // Initial OBR room metadata
  useEffect(() => {
    if (!OBR.isReady) return;
    OBR.room
      .getMetadata()
      .then((metadata) => {
        const state = metadata[COMBAT_STATE_KEY] as CombatState | undefined;
        if (state) {
          if (Array.isArray(state.combatants)) {
            setCombatants(sortInitiativeStrictDescending(state.combatants));
          }
          if (state.activeCombatantId !== undefined) {
            setActiveCombatantId(state.activeCombatantId);
          }
          if (typeof state.activeTurnIndex === 'number') {
            setActiveTurnIndex(state.activeTurnIndex);
          }
          if (typeof state.round === 'number') setRound(state.round);
          if (state.combatStatus) setCombatStatus(state.combatStatus);
        }
      })
      .catch(() => {});
  }, []);

  // Listen for OBR metadata changes
  useEffect(() => {
    if (!OBR.isReady) return;
    const unsub = OBR.room.onMetadataChange((metadata) => {
      const state = metadata[COMBAT_STATE_KEY] as CombatState | undefined;
      if (state) {
        if (Array.isArray(state.combatants)) {
          setCombatants(sortInitiativeStrictDescending(state.combatants));
        }
        if (state.activeCombatantId !== undefined) {
          setActiveCombatantId(state.activeCombatantId);
        }
        if (typeof state.activeTurnIndex === 'number') {
          setActiveTurnIndex(state.activeTurnIndex);
        }
        if (typeof state.round === 'number') setRound(state.round);
        if (state.combatStatus) setCombatStatus(state.combatStatus);
      }
    });
    return () => unsub();
  }, []);

  // Broadcast helper
  const broadcastCombat = async (
    updatedCombatants: Combatant[],
    updatedTurn: number,
    updatedRound: number,
    updatedActiveCombatantId?: string | null,
    updatedCombatStatus?: 'setup' | 'active'
  ) => {
    const statusToBroadcast = updatedCombatStatus || combatStatus;
    const updatedState: CombatState = {
      combatants: updatedCombatants,
      activeTurnIndex: updatedTurn,
      activeCombatantId:
        updatedActiveCombatantId !== undefined ? updatedActiveCombatantId : activeCombatantId,
      round: updatedRound,
      combatStatus: statusToBroadcast,
      lastUpdated: Date.now(),
    };

    try {
      if (OBR.isReady) {
        await OBR.room.setMetadata({
          [COMBAT_STATE_KEY]: updatedState,
        });
      }
    } catch (e) {
      console.error('Failed to set OBR combat metadata:', e);
    }
  };

  // Turn management: NEXT TURN
  const handleNextTurn = () => {
    if (combatants.length === 0) return;
    const currentIdx = activeCombatantId
      ? combatants.findIndex((c) => c.id === activeCombatantId)
      : activeTurnIndex;
    const validCurrentIdx = currentIdx >= 0 ? currentIdx : activeTurnIndex;

    let nextIndex = validCurrentIdx + 1;
    let nextRound = round;

    if (nextIndex >= combatants.length) {
      nextIndex = 0;
      nextRound = round + 1;
      liveFeedSync.recordCombatLog(`🔔 --- Round ${nextRound} Began ---`, true);
    }

    const activeCombatant = combatants[nextIndex];
    const nextId = activeCombatant ? activeCombatant.id : null;

    setActiveCombatantId(nextId);
    setActiveTurnIndex(nextIndex);
    setRound(nextRound);
    playTurnSound();

    if (activeCombatant) {
      const isHidden = activeCombatant.hidden || activeCombatant.isSecret;
      if (!isHidden) {
        const announcement = `⚔️ Turn ${nextIndex + 1}/${combatants.length}: It is ${activeCombatant.name}'s turn! (Round ${nextRound})`;
        liveFeedSync.recordTurnAnnouncement(announcement, true);
        if (activeCombatant.type === 'player') {
          setPlayerTurnAlert(`⚔️ ${activeCombatant.name.toUpperCase()}'S TURN!`);
          setTimeout(() => setPlayerTurnAlert(null), 4000);
        } else {
          setPlayerTurnAlert(null);
        }
      } else {
        liveFeedSync.recordCombatLog(
          `⚔️ Turn ${nextIndex + 1}/${combatants.length}: It is ${activeCombatant.name}'s turn! (Round ${nextRound})`,
          true,
          `⚔️ Turn ${nextIndex + 1}/${combatants.length}: An unseen entity takes their turn... (Round ${nextRound})`
        );
        setPlayerTurnAlert(null);
      }
    }

    broadcastCombat(combatants, nextIndex, nextRound, nextId, combatStatus);
  };

  // PREV TURN
  const handlePrevTurn = () => {
    if (combatants.length === 0) return;
    const currentIdx = activeCombatantId
      ? combatants.findIndex((c) => c.id === activeCombatantId)
      : activeTurnIndex;
    const validCurrentIdx = currentIdx >= 0 ? currentIdx : activeTurnIndex;

    let prevIndex = validCurrentIdx - 1;
    let prevRound = round;

    if (prevIndex < 0) {
      prevIndex = Math.max(0, combatants.length - 1);
      prevRound = Math.max(1, round - 1);
    }

    const activeCombatant = combatants[prevIndex];
    const prevId = activeCombatant ? activeCombatant.id : null;

    setActiveCombatantId(prevId);
    setActiveTurnIndex(prevIndex);
    setRound(prevRound);
    broadcastCombat(combatants, prevIndex, prevRound, prevId, combatStatus);
  };

  // START COMBAT (Strict sort descending, turn 1 on highest initiative)
  const handleStartCombat = () => {
    if (combatants.length === 0) {
      setIsAddModalOpen(true);
      return;
    }
    const sorted = sortInitiativeStrictDescending(combatants);
    const first = sorted[0];
    const firstId = first ? first.id : null;

    setCombatants(sorted);
    setActiveTurnIndex(0);
    setActiveCombatantId(firstId);
    setRound(1);
    setCombatStatus('active');
    playTurnSound();

    if (first) {
      liveFeedSync.recordCombatLog(
        `⚔️ Combat Started! Round 1 begins with ${first.name} (Initiative ${first.initiative}).`,
        true
      );
    }

    broadcastCombat(sorted, 0, 1, firstId, 'active');
  };

  // SORT INITIATIVE (Strict descending)
  const handleSortInitiative = () => {
    if (combatants.length === 0) return;
    const currentActiveId = activeCombatantId || combatants[activeTurnIndex]?.id || null;
    const sorted = sortInitiativeStrictDescending(combatants);

    let newIndex = 0;
    if (currentActiveId) {
      const idx = sorted.findIndex((c) => c.id === currentActiveId);
      if (idx !== -1) newIndex = idx;
    }

    setCombatants(sorted);
    setActiveTurnIndex(newIndex);
    broadcastCombat(sorted, newIndex, round, currentActiveId, combatStatus);
  };

  // ROLL INITIATIVE FOR ONE COMBATANT
  const handleRollInitiative = (combatantId: string) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    if (!isDm && target.type !== 'player' && target.type !== 'ally') return;

    const rollResult = executeDiceRoll({
      diceType: 'd20',
      count: 1,
      sender: rollerIdentity,
      isDm,
      rollType: 'Straight roll',
      label: `Initiative (${target.name})`,
    });

    const newInit = rollResult.total;
    const updated = combatants.map((c) =>
      c.id === combatantId ? { ...c, initiative: newInit } : c
    );
    const sorted = sortInitiativeStrictDescending(updated);

    let targetIdx = activeTurnIndex;
    if (activeCombatantId) {
      const found = sorted.findIndex((c) => c.id === activeCombatantId);
      if (found !== -1) targetIdx = found;
    }

    setCombatants(sorted);
    setActiveTurnIndex(targetIdx);
    liveFeedSync.recordDiceRoll(rollResult, true);
    broadcastCombat(sorted, targetIdx, round, activeCombatantId, combatStatus);
  };

  // ROLL ALL INITIATIVES
  const handleRollAllInitiatives = () => {
    if (!isDm || combatants.length === 0) return;
    const updated = combatants.map((c) => ({
      ...c,
      initiative: Math.floor(Math.random() * 20) + 1,
    }));
    const sorted = sortInitiativeStrictDescending(updated);

    let targetId = activeCombatantId;
    let targetIdx = 0;
    if (combatStatus === 'active' && activeCombatantId) {
      const found = sorted.findIndex((c) => c.id === activeCombatantId);
      if (found !== -1) targetIdx = found;
    } else {
      targetId = sorted[0]?.id || null;
      targetIdx = 0;
    }

    setCombatants(sorted);
    setActiveTurnIndex(targetIdx);
    if (targetId) setActiveCombatantId(targetId);

    liveFeedSync.recordCombatLog(`🎲 All initiatives rolled and sorted descending.`, true);
    broadcastCombat(sorted, targetIdx, round, targetId, combatStatus);
  };

  // RESET ENCOUNTER / CLEAR ALL
  const handleClearCombat = () => {
    setCombatants([]);
    setActiveCombatantId(null);
    setActiveTurnIndex(0);
    setRound(1);
    setCombatStatus('setup');
    setIsClearModalOpen(false);

    try {
      localStorage.setItem('ttrpg_combatants', JSON.stringify([]));
      localStorage.removeItem('ttrpg_active_combatant_id');
      localStorage.setItem('ttrpg_active_turn_index', '0');
      localStorage.setItem('ttrpg_combat_round', '1');
      localStorage.setItem('ttrpg_combat_status', 'setup');
    } catch {}

    liveFeedSync.recordCombatLog('⚔️ Encounter reset to a blank slate.', true);
    broadcastCombat([], 0, 1, null, 'setup');
  };

  // HP DELTA MICRO-BUTTONS (-1, -5, +5, +1)
  const handleHpDelta = (combatantId: string, delta: number) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    const isFoW = isCombatantFoW(target);
    const isPlayerOrAlly = target.type === 'player' || target.type === 'ally';
    if (!isDm && (!isPlayerOrAlly || isFoW)) return;

    let newCurrent = target.hpCurrent;
    let newTemp = target.hpTemp || 0;

    if (delta < 0) {
      // Damage: subtract from temp HP first
      const damage = Math.abs(delta);
      let rem = damage;
      if (newTemp > 0) {
        if (rem <= newTemp) {
          newTemp -= rem;
          rem = 0;
        } else {
          rem -= newTemp;
          newTemp = 0;
        }
      }
      newCurrent = Math.max(0, newCurrent - rem);

      // Concentration check
      if (isConcentrating(target)) {
        const dc = calculateConcentrationDC(damage);
        const dmMsg = `⚡ ${target.name} took ${damage} dmg while concentrating! DC ${dc} CON save required.`;
        const pMsg = isFoW ? `⚔️ ${target.name} took damage.` : dmMsg;
        liveFeedSync.recordCombatLog(dmMsg, true, pMsg);
      }

      const logDm = `⚔️ ${target.name} took ${damage} damage (${newCurrent}/${target.hpMax} HP)`;
      const logP = isFoW ? `⚔️ ${target.name} took damage.` : logDm;
      liveFeedSync.recordCombatLog(logDm, true, logP);
    } else {
      // Heal
      newCurrent = Math.min(target.hpMax, newCurrent + delta);
      const logDm = `💚 ${target.name} healed +${delta} HP (${newCurrent}/${target.hpMax} HP)`;
      const logP = isFoW ? `💚 ${target.name} healed.` : logDm;
      liveFeedSync.recordCombatLog(logDm, true, logP);
    }

    const updated = combatants.map((c) =>
      c.id === combatantId ? { ...c, hpCurrent: newCurrent, hpTemp: newTemp } : c
    );
    setCombatants(updated);
    broadcastCombat(updated, activeTurnIndex, round, activeCombatantId, combatStatus);
  };

  // TOGGLE CONDITION
  const handleToggleCondition = (combatantId: string, conditionName: string) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    const isFoW = isCombatantFoW(target);
    const isPlayerOrAlly = target.type === 'player' || target.type === 'ally';
    if (!isDm && (!isPlayerOrAlly || isFoW)) return;

    const exists = target.conditions.some((c) => c.name === conditionName);
    const newConditions = exists
      ? target.conditions.filter((c) => c.name !== conditionName)
      : [...target.conditions, { name: conditionName }];

    const updated = combatants.map((c) =>
      c.id === combatantId ? { ...c, conditions: newConditions } : c
    );
    setCombatants(updated);

    const action = exists ? 'removed from' : 'applied to';
    const logDm = `✨ Condition [${conditionName}] ${action} ${target.name}.`;
    const logP = isFoW ? undefined : logDm;
    liveFeedSync.recordCombatLog(logDm, true, logP);

    broadcastCombat(updated, activeTurnIndex, round, activeCombatantId, combatStatus);
  };

  // TOGGLE VISIBILITY (DM Only)
  const handleToggleVisibility = (combatantId: string) => {
    if (!isDm) return;
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    const isCurrentlyHidden = !!(target.hidden || target.isSecret);
    const willBeHidden = !isCurrentlyHidden;

    const updated = combatants.map((c) =>
      c.id === combatantId
        ? {
            ...c,
            hidden: willBeHidden,
            isSecret: willBeHidden ? c.isSecret : false,
          }
        : c
    );
    setCombatants(updated);

    if (isCurrentlyHidden && !willBeHidden) {
      liveFeedSync.recordCombatLog(`👁️ ${target.name} has been revealed to players!`, true);
    }

    broadcastCombat(updated, activeTurnIndex, round, activeCombatantId, combatStatus);
  };

  // DELETE COMBATANT (DM Only)
  const handleDeleteCombatant = (combatantId: string) => {
    if (!isDm) return;
    const target = combatants.find((c) => c.id === combatantId);
    const updated = combatants.filter((c) => c.id !== combatantId);
    setCombatants(updated);
    setActionMenuCombatantId(null);

    if (target) liveFeedSync.recordCombatLog(`💀 ${target.name} was removed from combat.`, true);

    let nextActiveId = activeCombatantId;
    let nextActiveIdx = 0;

    if (activeCombatantId === combatantId) {
      const wasIndex = combatants.findIndex((c) => c.id === combatantId);
      const nextCandidate = updated[wasIndex] || updated[0] || null;
      nextActiveId = nextCandidate ? nextCandidate.id : null;
      nextActiveIdx = nextCandidate ? updated.findIndex((c) => c.id === nextCandidate.id) : 0;
    } else if (activeCombatantId) {
      nextActiveIdx = updated.findIndex((c) => c.id === activeCombatantId);
      if (nextActiveIdx === -1) nextActiveIdx = 0;
    }

    setActiveCombatantId(nextActiveId);
    setActiveTurnIndex(nextActiveIdx);
    broadcastCombat(updated, nextActiveIdx, round, nextActiveId, combatStatus);
  };

  // START EDITING COMBATANT
  const handleStartEditing = (c: Combatant) => {
    setEditingCombatantId(c.id);
    setEditName(c.name);
    setEditInit(c.initiative);
    setEditAc(c.armorClass);
    setEditHpMax(c.hpMax);
    setEditHpCurr(c.hpCurrent);
  };

  // SAVE EDITED COMBATANT
  const handleSaveEdit = (combatantId: string) => {
    let updated = combatants.map((c) =>
      c.id === combatantId
        ? {
            ...c,
            name: editName.trim() || c.name,
            initiative: editInit,
            armorClass: editAc,
            hpMax: editHpMax,
            hpCurrent: Math.min(editHpCurr, editHpMax),
          }
        : c
    );
    updated = sortInitiativeStrictDescending(updated);
    setCombatants(updated);
    setEditingCombatantId(null);
    setActionMenuCombatantId(null);

    let targetIdx = activeTurnIndex;
    if (activeCombatantId) {
      const found = updated.findIndex((c) => c.id === activeCombatantId);
      if (found !== -1) targetIdx = found;
    }
    setActiveTurnIndex(targetIdx);
    broadcastCombat(updated, targetIdx, round, activeCombatantId, combatStatus);
  };

  // ADD COMBATANT FORM SUBMISSION
  const handleSaveNewCombatant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const allowedType: CombatantType =
      !isDm && newType !== 'player' && newType !== 'ally' ? 'player' : newType;

    const isMarkedSecretOrHidden = isDm && (newHidden || newIsSecret || allowedType === 'boss');
    const isFoWCombatant =
      isDm &&
      (newFogOfWar ||
        isMarkedSecretOrHidden ||
        allowedType === 'monster' ||
        allowedType === 'boss' ||
        allowedType === 'custom');
    const isHiddenFromPlayers =
      isDm && (newHidden || newIsSecret || newFogOfWar || allowedType === 'boss');

    const newCombatant: Combatant = {
      id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newName.trim(),
      type: allowedType,
      initiative: newInitiative,
      armorClass: newAc,
      hpCurrent: newHp,
      hpMax: newHp,
      hpTemp: 0,
      conditions: [],
      hidden: isHiddenFromPlayers,
      fogOfWar: isFoWCombatant,
      isSecret: isDm && (newIsSecret || isHiddenFromPlayers),
    };

    const updated = sortInitiativeStrictDescending([...combatants, newCombatant]);
    setCombatants(updated);

    let targetActiveId = activeCombatantId;
    let targetActiveIndex = activeTurnIndex;

    if (combatants.length === 0) {
      targetActiveId = newCombatant.id;
      targetActiveIndex = 0;
      setActiveCombatantId(newCombatant.id);
      setActiveTurnIndex(0);
    } else if (activeCombatantId) {
      const found = updated.findIndex((c) => c.id === activeCombatantId);
      if (found !== -1) targetActiveIndex = found;
      setActiveTurnIndex(targetActiveIndex);
    }

    if (!newCombatant.hidden && !newCombatant.isSecret) {
      liveFeedSync.recordCombatLog(
        `➕ Added ${newCombatant.name} with Initiative ${newCombatant.initiative}.`,
        true
      );
    }

    broadcastCombat(updated, targetActiveIndex, round, targetActiveId, combatStatus);

    setIsAddModalOpen(false);
    setNewName('');
    setNewType('player');
    setNewInitiative(10);
    setNewAc(14);
    setNewHp(25);
    setNewHidden(false);
    setNewIsSecret(false);
    setNewFogOfWar(false);
  };

  // Filter visible combatants (players cannot see hidden or secret combatants)
  const visibleCombatants = combatants.filter((c) => isDm || (!c.hidden && !c.isSecret));

  // Active combatant details
  const activeCombatant =
    combatants.find((c) => c.id === activeCombatantId) || combatants[activeTurnIndex];
  const activeTurnName = activeCombatant ? activeCombatant.name : 'None';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0b0f17] select-none relative">
      {/* FLOATING TURN ALERT BANNER */}
      {playerTurnAlert && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs shadow-xl flex items-center gap-1.5 animate-fadeIn">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>{playerTurnAlert}</span>
        </div>
      )}

      {/* 1. HEADER ROW: Round Counter, Active Turn Name, Primary Next Turn Button */}
      <div className="h-11 px-2.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Round Counter */}
          <span className="px-2 py-0.5 rounded bg-amber-950/90 border border-amber-500/60 text-amber-300 font-mono font-bold text-[11px] shrink-0">
            Round {round}
          </span>

          {/* Active Turn Name */}
          <div className="truncate text-xs font-medium text-slate-300 flex items-center gap-1">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Turn:</span>
            <span className="font-semibold text-amber-300 truncate max-w-[130px]" title={activeTurnName}>
              {activeTurnName}
            </span>
          </div>
        </div>

        {/* Turn Nav Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {isDm && combatStatus === 'setup' && combatants.length > 0 && (
            <button
              type="button"
              onClick={handleStartCombat}
              className="h-7 px-2 text-[11px] font-bold rounded bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1 cursor-pointer shadow-sm"
              title="Start Combat"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Start</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrevTurn}
            disabled={combatants.length === 0}
            className="h-7 w-7 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition disabled:opacity-40 cursor-pointer"
            title="Previous Turn"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleNextTurn}
            disabled={combatants.length === 0}
            className="h-7 px-2.5 text-xs font-bold rounded bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1 transition shadow cursor-pointer disabled:opacity-40"
            title="Advance to Next Turn"
          >
            <span>Next Turn</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          {isDm && (
            <button
              type="button"
              onClick={handleSortInitiative}
              className="h-7 w-7 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 flex items-center justify-center transition cursor-pointer"
              title="Strict Descending Initiative Sort"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. COMBATANT LIST CONTAINER: Strictly single source of truth, sorted by initiative descending */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1">
        {visibleCombatants.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
            <Swords className="w-8 h-8 opacity-40 text-amber-400" />
            <p className="text-xs font-medium text-slate-400">
              {combatants.length === 0
                ? 'No combatants in encounter.'
                : 'No visible combatants for your role.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setNewType('player');
                setIsAddModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 transition cursor-pointer"
            >
              + Add First Combatant
            </button>
          </div>
        ) : (
          visibleCombatants.map((c) => {
            const isActive = c.id === (activeCombatantId || combatants[activeTurnIndex]?.id);
            const isFoW = isCombatantFoW(c);
            const isPlayerOrAlly = c.type === 'player' || c.type === 'ally';
            const canEdit = isDm || (isPlayerOrAlly && !isFoW);
            const isMenuOpen = actionMenuCombatantId === c.id;
            const isEditing = editingCombatantId === c.id;
            const health = getHealthThreshold(c.hpCurrent, c.hpMax);

            return (
              <div
                key={c.id}
                className={`h-11 px-2 rounded-lg border transition-all flex items-center justify-between gap-1.5 text-xs select-none ${
                  isActive
                    ? 'bg-amber-950/30 border-amber-500/80 shadow-sm border-l-4 border-l-amber-400 ring-1 ring-amber-400/20'
                    : 'bg-slate-900/80 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                {/* COL 1: Initiative Badge (w-7 h-7 font-bold text-xs rounded bg-neutral-800 text-amber-400) */}
                <button
                  type="button"
                  onClick={() => canEdit && handleRollInitiative(c.id)}
                  title={canEdit ? 'Click to roll 1d20 Initiative' : `Initiative ${c.initiative}`}
                  className="w-7 h-7 font-bold text-xs rounded bg-neutral-800 text-amber-400 flex items-center justify-center shrink-0 tabular-nums border border-neutral-700 hover:border-amber-400 transition cursor-pointer shadow-inner"
                >
                  {c.initiative}
                </button>

                {/* COL 2: Name, Active Turn indicator, and "Hidden/Secret" FoW badge */}
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  <span
                    className={`font-semibold truncate max-w-[110px] ${
                      isActive ? 'text-amber-300 font-bold' : 'text-slate-200'
                    }`}
                    title={c.name}
                  >
                    {c.name}
                  </span>

                  {/* Badges */}
                  {isDm && (c.hidden || c.isSecret) && (
                    <span
                      className="px-1 py-0.2 rounded text-[9px] font-mono bg-rose-950/80 border border-rose-800/80 text-rose-300 shrink-0 flex items-center gap-0.5"
                      title="Hidden from players"
                    >
                      <EyeOff className="w-2.5 h-2.5" />
                      <span>FoW</span>
                    </span>
                  )}

                  {/* Concentration Icon Indicator */}
                  {isConcentrating(c) && (
                    <span
                      className="text-cyan-400 shrink-0 animate-pulse"
                      title="Concentrating (CON save on damage)"
                    >
                      <Zap className="w-3 h-3 fill-current" />
                    </span>
                  )}

                  {/* Conditions count pill if > 0 */}
                  {c.conditions.length > 0 && !isFoW && (
                    <span className="text-[9px] font-mono text-slate-400 shrink-0">
                      ({c.conditions.length})
                    </span>
                  )}
                </div>

                {/* COL 3: Inline HP tracker (current/max) with quick micro-buttons (-1, -5, +5, +1) */}
                <div className="flex items-center gap-1 shrink-0">
                  {isFoW && !isDm ? (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${health.badgeClass}`}>
                      {health.status}
                    </span>
                  ) : (
                    <>
                      {/* Micro damage buttons (-1, -5) */}
                      <button
                        type="button"
                        onClick={() => handleHpDelta(c.id, -1)}
                        disabled={!canEdit}
                        className="h-6 w-5 rounded bg-slate-800 hover:bg-rose-900 border border-slate-700 hover:border-rose-700 text-rose-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
                        title="-1 HP"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHpDelta(c.id, -5)}
                        disabled={!canEdit}
                        className="h-6 w-5 rounded bg-slate-800 hover:bg-rose-900 border border-slate-700 hover:border-rose-700 text-rose-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
                        title="-5 HP"
                      >
                        -5
                      </button>

                      {/* Current / Max HP display */}
                      <span className="text-[11px] font-mono font-bold text-slate-200 tabular-nums px-0.5 min-w-[44px] text-center">
                        <span className={c.hpCurrent <= c.hpMax * 0.5 ? 'text-amber-400' : 'text-slate-100'}>
                          {c.hpCurrent}
                        </span>
                        <span className="text-slate-500 font-normal text-[10px]">/{c.hpMax}</span>
                        {c.hpTemp > 0 && (
                          <span className="text-cyan-400 text-[9px] font-normal">+{c.hpTemp}</span>
                        )}
                      </span>

                      {/* Micro heal buttons (+5, +1) */}
                      <button
                        type="button"
                        onClick={() => handleHpDelta(c.id, 5)}
                        disabled={!canEdit}
                        className="h-6 w-5 rounded bg-slate-800 hover:bg-emerald-900 border border-slate-700 hover:border-emerald-700 text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
                        title="+5 HP"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHpDelta(c.id, 1)}
                        disabled={!canEdit}
                        className="h-6 w-5 rounded bg-slate-800 hover:bg-emerald-900 border border-slate-700 hover:border-emerald-700 text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
                        title="+1 HP"
                      >
                        +1
                      </button>
                    </>
                  )}
                </div>

                {/* COL 4: Quick dropdown/icon for condition badges and DM delete/edit actions */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setActionMenuCombatantId(actionMenuCombatantId === c.id ? null : c.id)
                    }
                    className={`h-7 w-7 rounded flex items-center justify-center border transition cursor-pointer ${
                      c.conditions.length > 0
                        ? 'bg-amber-950/70 border-amber-600/70 text-amber-300'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                    title="Conditions & Combatant Options"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {/* FLYOUT MENU FOR ROW */}
                  {isMenuOpen && (
                    <div className="absolute right-0 bottom-8 z-50 w-64 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl space-y-2.5 text-xs animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="font-bold text-slate-200 truncate">{c.name}</span>
                        <button
                          type="button"
                          onClick={() => setActionMenuCombatantId(null)}
                          className="text-slate-400 hover:text-slate-200 p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Quick Conditions Badges Toggle */}
                      {canEdit && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                            Conditions &amp; Status
                          </span>
                          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-0.5">
                            {CONDITIONS_LIST.map((cond) => {
                              const isActiveCond = c.conditions.some((item) => item.name === cond);
                              return (
                                <button
                                  key={cond}
                                  type="button"
                                  onClick={() => handleToggleCondition(c.id, cond)}
                                  className={`text-[10px] px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                    isActiveCond
                                      ? cond === 'Concentration'
                                        ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                                        : 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  {cond}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Edit Combatant or Stats */}
                      {isEditing ? (
                        <div className="space-y-2 pt-1 border-t border-slate-800">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Combatant Name"
                            className="w-full px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-100"
                          />
                          <div className="grid grid-cols-3 gap-1 text-[11px]">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Init</span>
                              <input
                                type="number"
                                value={editInit}
                                onChange={(e) => setEditInit(parseInt(e.target.value, 10) || 0)}
                                className="w-full px-1.5 py-0.5 text-xs font-mono rounded bg-slate-950 border border-slate-700 text-amber-300"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">AC</span>
                              <input
                                type="number"
                                value={editAc}
                                onChange={(e) => setEditAc(parseInt(e.target.value, 10) || 10)}
                                className="w-full px-1.5 py-0.5 text-xs font-mono rounded bg-slate-950 border border-slate-700 text-slate-200"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Max HP</span>
                              <input
                                type="number"
                                value={editHpMax}
                                onChange={(e) => setEditHpMax(parseInt(e.target.value, 10) || 1)}
                                className="w-full px-1.5 py-0.5 text-xs font-mono rounded bg-slate-950 border border-slate-700 text-slate-200"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(c.id)}
                              className="flex-1 py-1 text-xs font-bold rounded bg-amber-400 text-slate-950 hover:bg-amber-300 transition"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCombatantId(null)}
                              className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        canEdit && (
                          <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-800">
                            <button
                              type="button"
                              onClick={() => handleStartEditing(c)}
                              className="flex-1 py-1 px-2 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center gap-1 transition"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit Stats</span>
                            </button>

                            {isDm && (
                              <button
                                type="button"
                                onClick={() => handleToggleVisibility(c.id)}
                                className={`py-1 px-2 text-[11px] font-semibold rounded flex items-center gap-1 border transition ${
                                  c.hidden || c.isSecret
                                    ? 'bg-rose-950/80 border-rose-800 text-rose-300'
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-100'
                                }`}
                                title="Toggle visibility to players"
                              >
                                {c.hidden || c.isSecret ? (
                                  <EyeOff className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                                <span>{c.hidden || c.isSecret ? 'Hidden' : 'Visible'}</span>
                              </button>
                            )}

                            {isDm && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCombatant(c.id)}
                                className="p-1 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 transition"
                                title="Remove combatant"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. FOOTER DOCK: Compact "+ Add Combatant" button and Encounter Reset */}
      <div className="h-10 px-2.5 bg-slate-950/95 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setNewType(isDm ? 'monster' : 'player');
              setIsAddModalOpen(true);
            }}
            className="h-7 px-2.5 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1 shadow transition cursor-pointer"
            title="Add Combatant to Encounter"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Combatant</span>
          </button>

          {isDm && (
            <button
              type="button"
              onClick={handleRollAllInitiatives}
              disabled={combatants.length === 0}
              className="h-7 px-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
              title="Roll 1d20 for all combatants and sort descending"
            >
              <Dices className="w-3.5 h-3.5 text-amber-400" />
              <span>Roll All</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isDm && (
            <button
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              disabled={combatants.length === 0}
              className="h-7 px-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-rose-950 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-300 flex items-center gap-1 transition cursor-pointer disabled:opacity-30"
              title="Reset encounter to a blank slate"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* MODAL: ADD COMBATANT */}
      {isAddModalOpen && (
        <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100 font-display flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Add Combatant</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewCombatant} className="space-y-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Valerius, Goblin Archer, Dragon"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                  required
                  autoFocus
                />
              </div>

              {/* Role Type */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Type / Allegiance
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setNewType('player')}
                    className={`py-1 text-[11px] font-semibold rounded border transition cursor-pointer ${
                      newType === 'player'
                        ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    PC (Player)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType('ally')}
                    className={`py-1 text-[11px] font-semibold rounded border transition cursor-pointer ${
                      newType === 'ally'
                        ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    NPC / Ally
                  </button>
                  {isDm ? (
                    <button
                      type="button"
                      onClick={() => setNewType('monster')}
                      className={`py-1 text-[11px] font-semibold rounded border transition cursor-pointer ${
                        newType === 'monster'
                          ? 'bg-rose-500 text-slate-950 font-bold border-rose-400'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      Monster
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              </div>

              {/* Numerical Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                    Initiative
                  </label>
                  <input
                    type="number"
                    value={newInitiative}
                    onChange={(e) => setNewInitiative(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-amber-300"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                    AC
                  </label>
                  <input
                    type="number"
                    value={newAc}
                    onChange={(e) => setNewAc(parseInt(e.target.value, 10) || 10)}
                    className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                    Max HP
                  </label>
                  <input
                    type="number"
                    value={newHp}
                    onChange={(e) => setNewHp(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-slate-200"
                  />
                </div>
              </div>

              {/* FoW Toggles for DM */}
              {isDm && (
                <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newHidden}
                      onChange={(e) => setNewHidden(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-amber-400 cursor-pointer"
                    />
                    <span>Hidden (FoW)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newIsSecret}
                      onChange={(e) => setNewIsSecret(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-amber-400 cursor-pointer"
                    />
                    <span>Secret Boss</span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
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
      )}

      {/* CONFIRMATION MODAL: RESET ENCOUNTER */}
      {isClearModalOpen && (
        <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-slate-900 border border-rose-800/80 rounded-xl p-4 shadow-2xl space-y-3 text-center">
            <RotateCcw className="w-8 h-8 text-rose-400 mx-auto" />
            <h4 className="text-sm font-bold text-slate-100 font-display">
              Reset Encounter?
            </h4>
            <p className="text-xs text-slate-400">
              This will clear all combatants and reset the round counter to Round 1.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="px-3 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearCombat}
                className="px-3 py-1 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
