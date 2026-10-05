import React, { useState, useEffect, useRef } from 'react';
import {
  Combatant,
  CombatantType,
  Condition,
  CustomCondition,
  isCombatantFoW,
  sortInitiativeStrictDescending,
} from '../types/ttrpg';
import { liveFeedSync, UnifiedFeedItem } from '../utils/liveFeedSync';
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
  Eye,
  EyeOff,
  MoreVertical,
  Shield,
  Edit2,
  Check,
  Zap,
  Play,
  Radio,
  ChevronDown,
  ChevronUp,
  Skull,
  User,
  Users,
  Crown,
  Layers,
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

const getConditionBadgeStyle = (name: string): string => {
  switch (name) {
    case 'Concentration':
      return 'bg-cyan-950/90 border-cyan-500/80 text-cyan-300';
    case 'Poisoned':
      return 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300';
    case 'Prone':
      return 'bg-amber-950/90 border-amber-500/80 text-amber-300';
    case 'Blinded':
    case 'Deafened':
      return 'bg-slate-800 border-slate-600 text-slate-300';
    case 'Charmed':
    case 'Frightened':
      return 'bg-purple-950/90 border-purple-500/80 text-purple-300';
    case 'Paralyzed':
    case 'Petrified':
    case 'Stunned':
    case 'Incapacitated':
      return 'bg-yellow-950/90 border-yellow-500/80 text-yellow-300';
    case 'Grappled':
    case 'Restrained':
      return 'bg-blue-950/90 border-blue-500/80 text-blue-300';
    case 'Unconscious':
      return 'bg-rose-950/90 border-rose-600/80 text-rose-300';
    case 'Exhaustion':
      return 'bg-orange-950/90 border-orange-500/80 text-orange-300';
    default:
      return 'bg-slate-800 border-slate-700 text-slate-300';
  }
};

export const normalizeCondition = (c: any): CustomCondition => {
  if (typeof c === 'string') {
    return {
      id: `cond-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: c,
      isSecret: false,
    };
  }
  return {
    id: c.id || `cond-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: c.name || '',
    isSecret: !!c.isSecret,
    turnsLeft: c.turnsLeft,
  };
};

const getTypeBadge = (type: CombatantType, customLabel?: string) => {
  switch (type) {
    case 'player':
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-950/80 border border-cyan-600/80 text-cyan-300 flex items-center gap-0.5 shrink-0">
          <User className="w-2.5 h-2.5" />
          <span>PC</span>
        </span>
      );
    case 'ally':
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950/80 border border-emerald-600/80 text-emerald-300 flex items-center gap-0.5 shrink-0">
          <Users className="w-2.5 h-2.5" />
          <span>Ally</span>
        </span>
      );
    case 'monster':
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950/80 border border-rose-800/80 text-rose-300 flex items-center gap-0.5 shrink-0">
          <Skull className="w-2.5 h-2.5 text-rose-400" />
          <span>Monster</span>
        </span>
      );
    case 'boss':
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950/80 border border-rose-600/80 text-rose-300 flex items-center gap-0.5 shrink-0">
          <Crown className="w-2.5 h-2.5 text-rose-400" />
          <span>Boss</span>
        </span>
      );
    case 'custom':
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950/80 border border-amber-600/80 text-amber-300 flex items-center gap-0.5 shrink-0">
          <Layers className="w-2.5 h-2.5 text-amber-400" />
          <span>{customLabel || 'Custom'}</span>
        </span>
      );
    default:
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 border border-slate-700 text-slate-300 shrink-0">
          NPC
        </span>
      );
  }
};

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

  // Transient deletion tombstone set (ID -> expiration timestamp) to prevent double-delete resurrections
  const deletionTombstones = useRef<Map<string, number>>(new Map());

  // Custom condition form state in combatant options menu
  const [conditionInput, setConditionInput] = useState<string>('');
  const [conditionIsSecret, setConditionIsSecret] = useState<boolean>(false);

  // Inline Temp HP click-edit state
  const [inlineThpId, setInlineThpId] = useState<string | null>(null);
  const [inlineThpVal, setInlineThpVal] = useState<number>(0);

  // Combat Action Feed Dock state
  const [isCombatFeedExpanded, setIsCombatFeedExpanded] = useState<boolean>(false);
  const [combatFeedItems, setCombatFeedItems] = useState<UnifiedFeedItem[]>(() => {
    const feed = liveFeedSync.getFeed();
    return feed.filter((i) => i.type === 'combat' || i.type === 'turn').slice(-30);
  });

  // Form states for Add Combatant
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CombatantType>('player');
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newInitiative, setNewInitiative] = useState(10);
  const [newAc, setNewAc] = useState(14);
  const [newHp, setNewHp] = useState(25);
  const [newTempHp, setNewTempHp] = useState(0);
  const [newHidden, setNewHidden] = useState(false);
  const [newIsSecret, setNewIsSecret] = useState(false);

  // Edit draft states
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<CombatantType>('player');
  const [editCustomLabel, setEditCustomLabel] = useState('');
  const [editInit, setEditInit] = useState(10);
  const [editAc, setEditAc] = useState(14);
  const [editHpMax, setEditHpMax] = useState(25);
  const [editHpCurr, setEditHpCurr] = useState(25);
  const [editTempHp, setEditTempHp] = useState(0);

  // Turn alert toast
  const [playerTurnAlert, setPlayerTurnAlert] = useState<string | null>(null);

  // Listen for live feed updates to update combat dock
  useEffect(() => {
    const unsub = liveFeedSync.subscribe((items) => {
      const combatEvents = items
        .filter((it) => it.type === 'combat' || it.type === 'turn')
        .slice(-30);
      setCombatFeedItems(combatEvents);
    });
    return () => unsub();
  }, []);

  // Synchronize active pointer with combatants list
  useEffect(() => {
    if (combatants.length === 0) {
      if (activeCombatantId !== null) setActiveCombatantId(null);
      if (activeTurnIndex !== 0) setActiveTurnIndex(0);
      return;
    }

    const sorted = sortInitiativeStrictDescending(combatants);

    if (activeCombatantId) {
      const foundIdx = sorted.findIndex((c) => c.id === activeCombatantId);
      if (foundIdx !== -1) {
        if (foundIdx !== activeTurnIndex) {
          setActiveTurnIndex(foundIdx);
        }
        return;
      }
    }

    const first = sorted[0];
    if (first) {
      setActiveCombatantId(first.id);
      setActiveTurnIndex(0);
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
          const now = Date.now();
          for (const [id, expiry] of deletionTombstones.current.entries()) {
            if (now > expiry) deletionTombstones.current.delete(id);
          }
          if (Array.isArray(state.combatants)) {
            const filtered = state.combatants.filter((c) => !deletionTombstones.current.has(c.id));
            setCombatants(sortInitiativeStrictDescending(filtered));
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

  // Listen for OBR metadata changes (filters out combatants matching active deletion tombstones for 500ms+)
  useEffect(() => {
    if (!OBR.isReady) return;
    const unsub = OBR.room.onMetadataChange((metadata) => {
      const state = metadata[COMBAT_STATE_KEY] as CombatState | undefined;
      if (state) {
        const now = Date.now();
        for (const [id, expiry] of deletionTombstones.current.entries()) {
          if (now > expiry) deletionTombstones.current.delete(id);
        }
        if (Array.isArray(state.combatants)) {
          const filtered = state.combatants.filter((c) => !deletionTombstones.current.has(c.id));
          setCombatants(sortInitiativeStrictDescending(filtered));
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
    const sorted = [...combatants].sort(
      (a, b) => b.initiative - a.initiative || a.id.localeCompare(b.id)
    );

    const currentIndex = activeCombatantId
      ? sorted.findIndex((c) => c.id === activeCombatantId)
      : -1;

    let nextActiveId: string;
    let nextRound = round;

    if (currentIndex === -1 || currentIndex >= sorted.length - 1) {
      nextActiveId = sorted[0].id;
      nextRound = round + 1;
      liveFeedSync.recordCombatLog(`🔔 --- Round ${nextRound} Began ---`, true);
    } else {
      nextActiveId = sorted[currentIndex + 1].id;
    }

    const nextIndex = sorted.findIndex((c) => c.id === nextActiveId);
    const activeCombatant = sorted[nextIndex];

    setActiveCombatantId(nextActiveId);
    setActiveTurnIndex(nextIndex);
    setRound(nextRound);
    playTurnSound();

    if (activeCombatant) {
      const isHidden = activeCombatant.hidden || activeCombatant.isSecret;
      if (!isHidden) {
        const announcement = `⚔️ Turn ${nextIndex + 1}/${sorted.length}: It is ${activeCombatant.name}'s turn! (Round ${nextRound})`;
        liveFeedSync.recordTurnAnnouncement(announcement, true);
        if (activeCombatant.type === 'player') {
          setPlayerTurnAlert(`⚔️ ${activeCombatant.name.toUpperCase()}'S TURN!`);
          setTimeout(() => setPlayerTurnAlert(null), 4000);
        } else {
          setPlayerTurnAlert(null);
        }
      } else {
        liveFeedSync.recordCombatLog(
          `⚔️ Turn ${nextIndex + 1}/${sorted.length}: It is ${activeCombatant.name}'s turn! (Round ${nextRound})`,
          true,
          `⚔️ Turn ${nextIndex + 1}/${sorted.length}: An unseen entity takes their turn... (Round ${nextRound})`
        );
        setPlayerTurnAlert(null);
      }
    }

    broadcastCombat(sorted, nextIndex, nextRound, nextActiveId, combatStatus);
  };

  // PREV TURN
  const handlePrevTurn = () => {
    if (combatants.length === 0) return;
    const sorted = [...combatants].sort(
      (a, b) => b.initiative - a.initiative || a.id.localeCompare(b.id)
    );

    const currentIndex = activeCombatantId
      ? sorted.findIndex((c) => c.id === activeCombatantId)
      : 0;

    let prevActiveId: string;
    let prevRound = round;

    if (currentIndex <= 0) {
      if (round > 1) {
        prevActiveId = sorted[sorted.length - 1].id;
        prevRound = round - 1;
      } else {
        prevActiveId = sorted[0].id;
        prevRound = 1;
      }
    } else {
      prevActiveId = sorted[currentIndex - 1].id;
    }

    const prevIndex = sorted.findIndex((c) => c.id === prevActiveId);

    setActiveCombatantId(prevActiveId);
    setActiveTurnIndex(prevIndex);
    setRound(prevRound);
    broadcastCombat(sorted, prevIndex, prevRound, prevActiveId, combatStatus);
  };

  // START COMBAT
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
    const isBossOrMonster = target.type === 'boss' || target.type === 'monster';
    const isPlayerOrAlly = target.type === 'player' || target.type === 'ally';
    // Players can only edit PC & Ally; GM can edit all
    if (!isDm && !isPlayerOrAlly) return;

    let currentTemp = target.tempHp ?? target.hpTemp ?? 0;
    let currentHp = target.hpCurrent;

    if (delta < 0) {
      // Damage math: deduct from tempHp first before depleting currentHp
      const damage = Math.abs(delta);
      let rem = damage;
      if (currentTemp > 0) {
        if (rem <= currentTemp) {
          currentTemp -= rem;
          rem = 0;
        } else {
          rem -= currentTemp;
          currentTemp = 0;
        }
      }
      currentHp = Math.max(0, currentHp - rem);

      // Concentration check
      if (isConcentrating(target)) {
        const dc = calculateConcentrationDC(damage);
        const dmMsg = `⚡ ${target.name} took ${damage} dmg while concentrating! DC ${dc} CON save required.`;
        const pMsg = isCombatantFoW(target) ? `⚔️ ${target.name} took damage.` : dmMsg;
        liveFeedSync.recordCombatLog(dmMsg, true, pMsg);
      }

      const logDm = `⚔️ ${target.name} took ${damage} damage (${currentHp}/${target.hpMax} HP${
        currentTemp > 0 ? `, +${currentTemp} THP` : ''
      })`;
      const logP = isCombatantFoW(target) ? `⚔️ ${target.name} took damage.` : logDm;
      liveFeedSync.recordCombatLog(logDm, true, logP);
    } else {
      // Healing: Healing never increases tempHp
      currentHp = Math.min(target.hpMax, currentHp + delta);
      const logDm = `💚 ${target.name} healed +${delta} HP (${currentHp}/${target.hpMax} HP)`;
      const logP = isCombatantFoW(target) ? `💚 ${target.name} healed.` : logDm;
      liveFeedSync.recordCombatLog(logDm, true, logP);
    }

    const updated = combatants.map((c) =>
      c.id === combatantId
        ? { ...c, hpCurrent: currentHp, hpTemp: currentTemp, tempHp: currentTemp }
        : c
    );
    setCombatants(updated);
    broadcastCombat(updated, activeTurnIndex, round, activeCombatantId, combatStatus);
  };

  // INLINE TEMP HP SAVE
  const handleSaveInlineThp = (combatantId: string) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    const isPlayerOrAlly = target.type === 'player' || target.type === 'ally';
    if (!isDm && !isPlayerOrAlly) return;

    const val = Math.max(0, inlineThpVal);
    const updated = combatants.map((c) =>
      c.id === combatantId ? { ...c, tempHp: val, hpTemp: val } : c
    );
    setCombatants(updated);
    setInlineThpId(null);

    const logDm = `🛡️ ${target.name} set Temp HP to +${val} THP.`;
    const logP = isCombatantFoW(target) ? undefined : logDm;
    liveFeedSync.recordCombatLog(logDm, true, logP);

    broadcastCombat(updated, activeTurnIndex, round, activeCombatantId, combatStatus);
  };

  // ADD CUSTOM CONDITION WITH FOW PRIVACY
  const handleAddCustomCondition = (combatantId: string, nameToUse?: string) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    const isPlayerOrAlly = target.type === 'player' || target.type === 'ally';
    if (!isDm && !isPlayerOrAlly) return;

    const rawName = (nameToUse || conditionInput).trim();
    if (!rawName) return;

    const newCond: CustomCondition = {
      id: `cond-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: rawName,
      isSecret: isDm ? conditionIsSecret : false,
    };

    const existingNormalized = target.conditions.map(normalizeCondition);
    const updatedConditions = [...existingNormalized, newCond];

    const updated = combatants.map((c) =>
      c.id === combatantId ? { ...c, conditions: updatedConditions } : c
    );
    setCombatants(updated);
    setConditionInput('');
    setConditionIsSecret(false);

    const logDm = `✨ Condition [${rawName}]${newCond.isSecret ? ' (Secret)' : ''} applied to ${target.name}.`;
    const logP = newCond.isSecret ? undefined : `✨ Condition [${rawName}] applied to ${target.name}.`;
    liveFeedSync.recordCombatLog(logDm, true, logP);

    broadcastCombat(updated, activeTurnIndex, round, activeCombatantId, combatStatus);
  };

  // REMOVE CONDITION
  const handleRemoveCondition = (combatantId: string, condIdOrName: string) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    const isPlayerOrAlly = target.type === 'player' || target.type === 'ally';
    if (!isDm && !isPlayerOrAlly) return;

    const existingNormalized = target.conditions.map(normalizeCondition);
    const condToRemove = existingNormalized.find(
      (cond) => cond.id === condIdOrName || cond.name === condIdOrName
    );
    const updatedConditions = existingNormalized.filter(
      (cond) => cond.id !== condIdOrName && cond.name !== condIdOrName
    );

    const updated = combatants.map((c) =>
      c.id === combatantId ? { ...c, conditions: updatedConditions } : c
    );
    setCombatants(updated);

    if (condToRemove) {
      const logDm = `✨ Condition [${condToRemove.name}] removed from ${target.name}.`;
      const logP = condToRemove.isSecret ? undefined : logDm;
      liveFeedSync.recordCombatLog(logDm, true, logP);
    }

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
            isSecret: willBeHidden ? (c.isSecret || false) : false,
          }
        : c
    );
    setCombatants(updated);

    if (isCurrentlyHidden && !willBeHidden) {
      liveFeedSync.recordCombatLog(`👁️ ${target.name} has been revealed to players!`, true);
    }

    broadcastCombat(updated, activeTurnIndex, round, activeCombatantId, combatStatus);
  };

  // DELETE COMBATANT (DM Only with double-delete lock)
  const handleDeleteCombatant = (combatantId: string) => {
    if (!isDm) return;
    // Add to transient deletion lock / tombstone map for 800ms (> 500ms required)
    deletionTombstones.current.set(combatantId, Date.now() + 800);

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
    const isPlayerOrAlly = c.type === 'player' || c.type === 'ally';
    if (!isDm && !isPlayerOrAlly) return;

    setEditingCombatantId(c.id);
    setEditName(c.name);
    setEditType(c.type);
    setEditCustomLabel(c.customRoleLabel || '');
    setEditInit(c.initiative);
    setEditAc(c.armorClass);
    setEditHpMax(c.hpMax);
    setEditHpCurr(c.hpCurrent);
    setEditTempHp(c.tempHp ?? c.hpTemp ?? 0);
  };

  // SAVE EDITED COMBATANT
  const handleSaveEdit = (combatantId: string) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    const isPlayerOrAlly = target.type === 'player' || target.type === 'ally';
    if (!isDm && !isPlayerOrAlly) return;

    const allowedType: CombatantType = !isDm
      ? target.type === 'ally'
        ? 'ally'
        : 'player'
      : editType;

    let updated = combatants.map((c) =>
      c.id === combatantId
        ? {
            ...c,
            name: editName.trim() || c.name,
            type: allowedType,
            customRoleLabel: allowedType === 'custom' ? editCustomLabel.trim() : undefined,
            initiative: editInit,
            armorClass: editAc,
            hpMax: editHpMax,
            hpCurrent: Math.min(editHpCurr, editHpMax),
            hpTemp: Math.max(0, editTempHp),
            tempHp: Math.max(0, editTempHp),
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

    // Permission enforcement: Players can only add 'player' (PC) or 'ally'
    let allowedType: CombatantType = newType;
    if (!isDm) {
      allowedType = newType === 'ally' ? 'ally' : 'player';
    }

    const isBossOrMonsterOrCustom =
      allowedType === 'boss' || allowedType === 'monster' || allowedType === 'custom';
    const isHiddenFromPlayers = isDm && (newHidden || newIsSecret);

    const newCombatant: Combatant = {
      id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newName.trim(),
      type: allowedType,
      customRoleLabel:
        allowedType === 'custom' && newCustomLabel.trim() ? newCustomLabel.trim() : undefined,
      initiative: newInitiative,
      armorClass: newAc,
      hpCurrent: newHp,
      hpMax: newHp,
      hpTemp: Math.max(0, newTempHp),
      tempHp: Math.max(0, newTempHp),
      conditions: [],
      hidden: isHiddenFromPlayers,
      fogOfWar: isDm && (isBossOrMonsterOrCustom || newHidden || newIsSecret),
      isSecret: isDm && newIsSecret,
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
    setNewCustomLabel('');
    setNewInitiative(10);
    setNewAc(14);
    setNewHp(25);
    setNewTempHp(0);
    setNewHidden(false);
    setNewIsSecret(false);
  };

  // Filter visible combatants (players cannot see hidden or secret combatants)
  const visibleCombatants = combatants.filter((c) => isDm || (!c.hidden && !c.isSecret));

  // Active combatant details
  const activeCombatant =
    combatants.find((c) => c.id === activeCombatantId) || combatants[activeTurnIndex];
  const activeTurnName = activeCombatant ? activeCombatant.name : 'None';

  // Latest combat event for collapsed feed dock preview
  const latestCombatEvent = combatFeedItems.length > 0 ? combatFeedItems[combatFeedItems.length - 1] : null;

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[#0b0f17] select-none relative rounded-lg border border-slate-800">
      {/* FLOATING TURN ALERT BANNER */}
      {playerTurnAlert && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs shadow-xl flex items-center gap-1.5 animate-fadeIn">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>{playerTurnAlert}</span>
        </div>
      )}

      {/* 1. HEADER ROW: Round Counter, Active Turn Name, Nav Buttons */}
      <div className="h-11 px-2.5 bg-slate-950/95 border-b border-slate-800 flex items-center justify-between shrink-0 gap-2 rounded-t-lg">
        <div className="flex items-center gap-2 min-w-0">
          {/* Round Counter */}
          <span className="px-2 py-0.5 rounded bg-amber-950/90 border border-amber-500/60 text-amber-300 font-mono font-bold text-[11px] shrink-0">
            Round {round}
          </span>

          {/* Active Turn Name */}
          <div className="truncate text-xs font-medium text-slate-300 flex items-center gap-1">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Turn:</span>
            <span className="font-semibold text-amber-300 truncate max-w-[120px]" title={activeTurnName}>
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

      {/* 2. COMBATANT LIST CONTAINER */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 min-h-0">
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
          visibleCombatants.map((c, index) => {
            const isActive = activeCombatantId
              ? c.id === activeCombatantId
              : index === activeTurnIndex;
            const isBossOrMonster = c.type === 'boss' || c.type === 'monster';
            const isFoW = isCombatantFoW(c) || isBossOrMonster;
            const isPlayerOrAlly = c.type === 'player' || c.type === 'ally';
            // Permission rule: players can only edit PC & Ally; GM can edit all
            const canEdit = isDm || isPlayerOrAlly;
            const health = getHealthThreshold(c.hpCurrent, c.hpMax);
            const visibleConditions = c.conditions
              .map(normalizeCondition)
              .filter((cond) => isDm || !cond.isSecret);

            return (
              <div
                key={c.id}
                className={`min-h-[56px] py-1.5 px-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 text-xs select-none relative ${
                  actionMenuCombatantId === c.id ? 'ring-1 ring-amber-400/50' : ''
                } ${
                  isActive
                    ? 'bg-amber-950/30 border-amber-500/80 shadow-md border-l-4 border-l-amber-400 ring-1 ring-amber-400/20'
                    : 'bg-slate-900/85 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* COL 1: Initiative Badge (1-click roll if allowed) */}
                <button
                  type="button"
                  onClick={() => canEdit && handleRollInitiative(c.id)}
                  disabled={!canEdit}
                  title={canEdit ? 'Click to roll 1d20 Initiative' : `Initiative ${c.initiative}`}
                  className="w-8 h-8 font-bold text-xs rounded-lg bg-neutral-800 text-amber-400 flex items-center justify-center shrink-0 tabular-nums border border-neutral-700 hover:border-amber-400 transition cursor-pointer shadow-inner disabled:cursor-default"
                >
                  {c.initiative}
                </button>

                {/* COL 2: Name, Type Badge, Inline Condition Badges */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`font-bold truncate max-w-[130px] ${
                        isActive ? 'text-amber-300' : 'text-slate-200'
                      }`}
                      title={c.name}
                    >
                      {c.name}
                    </span>

                    {/* Type Badge: PC / Ally / Monster / Boss / Custom */}
                    {getTypeBadge(c.type, c.customRoleLabel)}

                    {/* FoW / Secret marker for DM */}
                    {isDm && (c.hidden || c.isSecret) && (
                      <span
                        className="px-1 py-0.2 rounded text-[9px] font-mono bg-rose-950/80 border border-rose-800/80 text-rose-300 shrink-0 flex items-center gap-0.5"
                        title="Hidden/Secret FoW"
                      >
                        <EyeOff className="w-2.5 h-2.5" />
                        <span>FoW</span>
                      </span>
                    )}

                    {/* Concentration pulse icon */}
                    {isConcentrating(c) && (
                      <span
                        className="text-cyan-400 shrink-0 animate-pulse"
                        title="Concentrating"
                      >
                        <Zap className="w-3 h-3 fill-current" />
                      </span>
                    )}
                  </div>

                  {/* Inline Condition Badges row: In Player view, display only public conditions (!cond.isSecret) */}
                  {visibleConditions.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      {visibleConditions.map((cond) => (
                        <span
                          key={cond.id || cond.name}
                          onClick={(e) => {
                            if (canEdit) {
                              e.stopPropagation();
                              handleRemoveCondition(c.id, cond.id || cond.name);
                            }
                          }}
                          className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border flex items-center gap-0.5 shrink-0 transition ${getConditionBadgeStyle(
                            cond.name
                          )} ${
                            cond.isSecret
                              ? 'border-dashed border-rose-500/90 bg-rose-950/80 text-rose-300'
                              : ''
                          } ${canEdit ? 'cursor-pointer hover:opacity-80' : ''}`}
                          title={`${cond.name}${cond.isSecret ? ' (Secret GM condition)' : ''}${
                            canEdit ? ' (click to remove)' : ''
                          }`}
                        >
                          {cond.isSecret && <EyeOff className="w-2.5 h-2.5 text-rose-400" />}
                          <span>{cond.name}</span>
                          {canEdit && <X className="w-2.5 h-2.5 opacity-60 hover:opacity-100" />}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* COL 3: Inline HP Controls with FoW Masking for Boss/Monster */}
                <div className="flex items-center gap-1 shrink-0">
                  {!isDm && isBossOrMonster ? (
                    /* Boss and Monster in Player view: mask all HP (???/???), Temp HP, and AC */
                    <span
                      className="text-[11px] font-mono font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 tabular-nums shadow-inner"
                      title="Enemy HP masked by Fog of War"
                    >
                      ???/???
                    </span>
                  ) : (
                    <>
                      {/* Micro damage buttons (-5, -1) */}
                      <button
                        type="button"
                        onClick={() => handleHpDelta(c.id, -5)}
                        disabled={!canEdit}
                        className="h-6 w-5 rounded bg-slate-800 hover:bg-rose-900 border border-slate-700 hover:border-rose-700 text-rose-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
                        title="-5 HP"
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHpDelta(c.id, -1)}
                        disabled={!canEdit}
                        className="h-6 w-5 rounded bg-slate-800 hover:bg-rose-900 border border-slate-700 hover:border-rose-700 text-rose-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
                        title="-1 HP"
                      >
                        -1
                      </button>

                      {/* Current / Max HP display */}
                      <span className="text-[11px] font-mono font-bold text-slate-200 tabular-nums px-0.5 min-w-[44px] text-center">
                        <span className={c.hpCurrent <= c.hpMax * 0.5 ? 'text-amber-400' : 'text-slate-100'}>
                          {c.hpCurrent}
                        </span>
                        <span className="text-slate-500 font-normal text-[10px]">/{c.hpMax}</span>
                      </span>

                      {/* Inline Click on Temp HP block (+X THP) */}
                      {inlineThpId === c.id ? (
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            value={inlineThpVal}
                            onChange={(e) => setInlineThpVal(parseInt(e.target.value, 10) || 0)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineThp(c.id);
                              if (e.key === 'Escape') setInlineThpId(null);
                            }}
                            autoFocus
                            className="w-10 px-1 py-0.5 text-[10px] font-mono rounded bg-slate-950 border border-cyan-500 text-cyan-300 text-center"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveInlineThp(c.id)}
                            className="p-0.5 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                            title="Save THP"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineThpId(null)}
                            className="p-0.5 text-slate-400 hover:text-slate-300 cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (canEdit) {
                              setInlineThpId(c.id);
                              setInlineThpVal(c.tempHp ?? c.hpTemp ?? 0);
                            }
                          }}
                          disabled={!canEdit}
                          className={`text-[9px] font-mono px-1 py-0.5 rounded border transition cursor-pointer ${
                            (c.tempHp ?? c.hpTemp ?? 0) > 0
                              ? 'text-cyan-300 bg-cyan-950/80 border-cyan-600/70 hover:bg-cyan-900/80'
                              : 'text-slate-500 bg-slate-900 border-slate-800 hover:text-slate-300'
                          }`}
                          title={canEdit ? 'Click to edit Temp HP (+THP)' : `Temp HP: ${c.tempHp ?? c.hpTemp ?? 0}`}
                        >
                          +{(c.tempHp ?? c.hpTemp ?? 0)} THP
                        </button>
                      )}

                      {/* Micro heal buttons (+1, +5) */}
                      <button
                        type="button"
                        onClick={() => handleHpDelta(c.id, 1)}
                        disabled={!canEdit}
                        className="h-6 w-5 rounded bg-slate-800 hover:bg-emerald-900 border border-slate-700 hover:border-emerald-700 text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
                        title="+1 HP"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHpDelta(c.id, 5)}
                        disabled={!canEdit}
                        className="h-6 w-5 rounded bg-slate-800 hover:bg-emerald-900 border border-slate-700 hover:border-emerald-700 text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
                        title="+5 HP"
                      >
                        +5
                      </button>
                    </>
                  )}
                </div>

                {/* COL 4: Options / Conditions Menu Toggle */}
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (actionMenuCombatantId === c.id) {
                        setActionMenuCombatantId(null);
                        setEditingCombatantId(null);
                      } else {
                        setActionMenuCombatantId(c.id);
                        setEditingCombatantId(null);
                        setConditionInput('');
                        setConditionIsSecret(false);
                      }
                    }}
                    className={`h-7 w-7 rounded-lg flex items-center justify-center border transition cursor-pointer ${
                      c.conditions.length > 0 || actionMenuCombatantId === c.id
                        ? 'bg-amber-950/70 border-amber-600/70 text-amber-300'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                    title="Edit Stats & Conditions"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. COMPACT COLLAPSIBLE COMBAT FEED DOCK */}
      <div className="border-t border-slate-800/90 bg-slate-950/95 shrink-0 flex flex-col">
        {/* Dock Header Bar */}
        <div className="h-8 px-2.5 flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={() => setIsCombatFeedExpanded(!isCombatFeedExpanded)}
            className="flex items-center gap-1.5 text-slate-300 hover:text-amber-300 transition cursor-pointer min-w-0"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
            <span className="font-bold font-display text-[11px] shrink-0">Combat Feed</span>
            <span className="text-[10px] text-slate-500 font-mono shrink-0">
              ({combatFeedItems.length})
            </span>

            {/* Collapsed 1-line latest log preview */}
            {!isCombatFeedExpanded && latestCombatEvent && (() => {
              const isSecret = latestCombatEvent.isSecretRoll || latestCombatEvent.rollDetails?.visibility === 'gm_only';
              const currentUserId = liveFeedSync.getPlayerId();
              const isRoller = (latestCombatEvent.rollerId && latestCombatEvent.rollerId === currentUserId) || latestCombatEvent.sender === rollerIdentity;
              const isAuthorized = isDm || isRoller;
              const previewMsg = (isSecret && !isAuthorized)
                ? `${latestCombatEvent.rollerName || latestCombatEvent.sender} made a secret roll to the DM 🔒`
                : (!isDm && latestCombatEvent.playerMessage ? latestCombatEvent.playerMessage : latestCombatEvent.message);

              return (
                <span className="text-[10px] text-slate-400 truncate max-w-[200px] ml-1 opacity-80">
                  • {previewMsg}
                </span>
              );
            })()}

            {isCombatFeedExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
          </button>

          {isCombatFeedExpanded && combatFeedItems.length > 0 && (
            <button
              type="button"
              onClick={() => {
                liveFeedSync.clearFeed();
                setCombatFeedItems([]);
              }}
              className="text-[10px] text-slate-400 hover:text-rose-300 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 transition cursor-pointer"
            >
              Clear Feed
            </button>
          )}
        </div>

        {/* Expanded Feed Items */}
        {isCombatFeedExpanded && (
          <div className="max-h-36 overflow-y-auto px-2.5 py-1.5 space-y-1 text-xs border-t border-slate-800/60 bg-slate-950/80">
            {combatFeedItems.length === 0 ? (
              <div className="text-center p-3 text-slate-500 text-[11px] italic">
                No combat events logged yet. Turns, damage, and conditions will appear here.
              </div>
            ) : (
              combatFeedItems.map((evt) => {
                const time = new Date(evt.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
                const isSecret = evt.isSecretRoll || evt.rollDetails?.visibility === 'gm_only';
                const currentUserId = liveFeedSync.getPlayerId();
                const isRoller = (evt.rollerId && evt.rollerId === currentUserId) || evt.sender === rollerIdentity;
                const isAuthorized = isDm || isRoller;
                const msg = (isSecret && !isAuthorized)
                  ? `${evt.rollerName || evt.sender} made a secret roll to the DM 🔒`
                  : (!isDm && evt.playerMessage ? evt.playerMessage : evt.message);
                const isDamage = msg.includes('took');
                const isHeal = msg.includes('healed');

                return (
                  <div
                    key={evt.id}
                    className={`px-2 py-1 rounded-lg border text-[11px] flex items-center justify-between gap-1.5 ${
                      isDamage
                        ? 'bg-rose-950/30 border-rose-800/50 text-rose-200'
                        : isHeal
                        ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="truncate flex-1">{msg}</span>
                    <span className="text-[9px] font-mono text-slate-500 shrink-0">{time}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 4. FOOTER CONTROLS: Add Combatant & Reset (NO "Roll All Initiative" button) */}
      <div className="h-10 px-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setNewType(isDm ? 'boss' : 'player');
              setIsAddModalOpen(true);
            }}
            className="h-7 px-2.5 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1 shadow transition cursor-pointer"
            title="Add Combatant to Encounter"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Combatant</span>
          </button>
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
        <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3">
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
                  placeholder="e.g. Valerius, Goblin Archer, Dragon, Lair Action"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                  required
                  autoFocus
                />
              </div>

              {/* Supported Combatant Types: PC, Ally, Boss, Custom with Permissions */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Combatant Type
                </label>
                <div className={`grid gap-1 ${isDm ? 'grid-cols-5' : 'grid-cols-2'}`}>
                  {/* PC: Player & GM */}
                  <button
                    type="button"
                    onClick={() => setNewType('player')}
                    className={`py-1 text-[11px] font-semibold rounded border transition cursor-pointer ${
                      newType === 'player'
                        ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    PC
                  </button>

                  {/* Ally: Player & GM */}
                  <button
                    type="button"
                    onClick={() => setNewType('ally')}
                    className={`py-1 text-[11px] font-semibold rounded border transition cursor-pointer ${
                      newType === 'ally'
                        ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    Ally
                  </button>

                  {/* Monster: GM Only */}
                  {isDm && (
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
                  )}

                  {/* Boss: GM Only */}
                  {isDm && (
                    <button
                      type="button"
                      onClick={() => setNewType('boss')}
                      className={`py-1 text-[11px] font-semibold rounded border transition cursor-pointer ${
                        newType === 'boss'
                          ? 'bg-purple-600 text-amber-200 font-bold border-amber-400'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      Boss
                    </button>
                  )}

                  {/* Custom: GM Only */}
                  {isDm && (
                    <button
                      type="button"
                      onClick={() => setNewType('custom')}
                      className={`py-1 text-[11px] font-semibold rounded border transition cursor-pointer ${
                        newType === 'custom'
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      Custom
                    </button>
                  )}
                </div>

                {!isDm && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Players can create &amp; edit PC and Ally combatants. Monsters &amp; Bosses are GM exclusive.
                  </p>
                )}
              </div>

              {/* Custom Role Label input for Custom combatants (GM Only) */}
              {isDm && newType === 'custom' && (
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                    Custom Role Label (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lair Action, Environmental, Mass Combat"
                    value={newCustomLabel}
                    onChange={(e) => setNewCustomLabel(e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-amber-300"
                  />
                </div>
              )}

              {/* Numerical Stats: Initiative, AC, Max HP, Temp HP */}
              <div className="grid grid-cols-4 gap-2">
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
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                    Temp HP
                  </label>
                  <input
                    type="number"
                    value={newTempHp}
                    onChange={(e) => setNewTempHp(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-cyan-300"
                  />
                </div>
              </div>

              {/* FoW Toggles for GM */}
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
                  <label className="flex items-center gap-1.5 cursor-pointer" title="Secret Boss: Completely hidden from Player view and room logs until revealed">
                    <input
                      type="checkbox"
                      checked={newIsSecret}
                      onChange={(e) => setNewIsSecret(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-rose-500 cursor-pointer"
                    />
                    <span className="text-rose-400 font-semibold">Secret Boss</span>
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
        <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
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

      {/* MODAL: COMBATANT ACTION / CONDITION POPUP (OPTION A) */}
      {actionMenuCombatantId && (() => {
        const menuCombatant = combatants.find((c) => c.id === actionMenuCombatantId);
        if (!menuCombatant) return null;
        const isPlayerOrAlly = menuCombatant.type === 'player' || menuCombatant.type === 'ally';
        const canEdit = isDm || isPlayerOrAlly;
        const isEditing = editingCombatantId === menuCombatant.id;

        return (
          <>
            {/* Clear backdrop */}
            <div
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-[2px]"
              onClick={() => {
                setActionMenuCombatantId(null);
                setEditingCombatantId(null);
              }}
            />

            {/* Dedicated modal dialog */}
            <div className="fixed inset-x-4 top-16 z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl p-3 max-h-[70vh] overflow-y-auto space-y-2.5 text-xs animate-fadeIn">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-bold text-slate-100 text-sm truncate">{menuCombatant.name}</span>
                  {getTypeBadge(menuCombatant.type, menuCombatant.customRoleLabel)}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuCombatantId(null);
                    setEditingCombatantId(null);
                  }}
                  className="text-neutral-400 hover:text-slate-100 p-1 rounded hover:bg-neutral-800 cursor-pointer transition"
                  title="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Custom Condition Open Input with Secret Checkbox */}
              {canEdit && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Add Condition
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={conditionInput}
                      onChange={(e) => setConditionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomCondition(menuCombatant.id);
                        }
                      }}
                      placeholder="Type custom condition..."
                      className="flex-1 px-2 py-1 text-xs rounded-lg bg-neutral-950 border border-neutral-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                    {isDm && (
                      <label
                        className="flex items-center gap-1 text-[11px] text-slate-300 shrink-0 cursor-pointer select-none"
                        title="Secret: GM only (concealed from players)"
                      >
                        <input
                          type="checkbox"
                          checked={conditionIsSecret}
                          onChange={(e) => setConditionIsSecret(e.target.checked)}
                          className="rounded bg-neutral-950 border-neutral-700 text-rose-500 cursor-pointer"
                        />
                        <span className="text-[10px] font-bold text-rose-400">Secret</span>
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAddCustomCondition(menuCombatant.id)}
                      className="px-2 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer shrink-0 transition"
                    >
                      Add
                    </button>
                  </div>

                  {/* Quick Suggestion Badges */}
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-0.5">
                    {CONDITIONS_LIST.map((cond) => {
                      const isAlreadyAdded = menuCombatant.conditions.some(
                        (item) => normalizeCondition(item).name === cond
                      );
                      return (
                        <button
                          key={cond}
                          type="button"
                          onClick={() => handleAddCustomCondition(menuCombatant.id, cond)}
                          className={`text-[9px] px-1.5 py-0.5 rounded border transition cursor-pointer ${
                            isAlreadyAdded
                              ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                              : 'bg-neutral-950 border-neutral-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          +{cond}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Conditions in Menu with remove toggle */}
                  {menuCombatant.conditions.length > 0 && (
                    <div className="pt-1.5 border-t border-neutral-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Active Conditions:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {menuCombatant.conditions.map((item) => {
                          const cond = normalizeCondition(item);
                          if (!isDm && cond.isSecret) return null;
                          return (
                            <button
                              key={cond.id}
                              type="button"
                              onClick={() => handleRemoveCondition(menuCombatant.id, cond.id)}
                              className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 cursor-pointer transition ${getConditionBadgeStyle(
                                cond.name
                              )} ${
                                cond.isSecret
                                  ? 'border-dashed border-rose-500 text-rose-300 bg-rose-950'
                                  : ''
                              }`}
                              title="Click to remove"
                            >
                              {cond.isSecret && (
                                <EyeOff className="w-2.5 h-2.5 text-rose-400" />
                              )}
                              <span>{cond.name}</span>
                              <X className="w-2.5 h-2.5 opacity-60 hover:opacity-100" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Edit Combatant Form or Controls */}
              {isEditing ? (
                <div className="space-y-2 pt-1 border-t border-neutral-800">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Combatant Name"
                    className="w-full px-2 py-1 text-xs rounded bg-neutral-950 border border-neutral-700 text-slate-100"
                  />

                  {/* Role edit: GM can change to Monster/Boss/Custom; Players can only choose PC/Ally */}
                  {isDm && (
                    <div className="grid grid-cols-5 gap-1 text-[10px]">
                      {(['player', 'ally', 'monster', 'boss', 'custom'] as CombatantType[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setEditType(t)}
                          className={`py-0.5 rounded border font-semibold capitalize cursor-pointer ${
                            editType === t
                              ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                              : 'bg-neutral-950 border-neutral-800 text-slate-400'
                          }`}
                        >
                          {t === 'player' ? 'PC' : t}
                        </button>
                      ))}
                    </div>
                  )}

                  {editType === 'custom' && isDm && (
                    <input
                      type="text"
                      value={editCustomLabel}
                      onChange={(e) => setEditCustomLabel(e.target.value)}
                      placeholder="Role label (e.g. Lair Action)"
                      className="w-full px-2 py-0.5 text-xs rounded bg-neutral-950 border border-neutral-700 text-amber-300"
                    />
                  )}

                  <div className="grid grid-cols-4 gap-1 text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Init</span>
                      <input
                        type="number"
                        value={editInit}
                        onChange={(e) => setEditInit(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-1.5 py-0.5 text-xs font-mono rounded bg-neutral-950 border border-neutral-700 text-amber-300"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">AC</span>
                      <input
                        type="number"
                        value={editAc}
                        onChange={(e) => setEditAc(parseInt(e.target.value, 10) || 10)}
                        className="w-full px-1.5 py-0.5 text-xs font-mono rounded bg-neutral-950 border border-neutral-700 text-slate-200"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Max HP</span>
                      <input
                        type="number"
                        value={editHpMax}
                        onChange={(e) => setEditHpMax(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-1.5 py-0.5 text-xs font-mono rounded bg-neutral-950 border border-neutral-700 text-slate-200"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Temp HP</span>
                      <input
                        type="number"
                        value={editTempHp}
                        onChange={(e) => setEditTempHp(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-1.5 py-0.5 text-xs font-mono rounded bg-neutral-950 border border-neutral-700 text-cyan-300"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(menuCombatant.id)}
                      className="flex-1 py-1 text-xs font-bold rounded bg-amber-400 text-slate-950 hover:bg-amber-300 transition cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCombatantId(null)}
                      className="px-2 py-1 text-xs rounded bg-neutral-800 text-slate-300 hover:bg-neutral-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                canEdit && (
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-neutral-800">
                    <button
                      type="button"
                      onClick={() => handleStartEditing(menuCombatant)}
                      className="flex-1 py-1 px-2 text-[11px] font-semibold rounded bg-neutral-800 hover:bg-neutral-700 text-slate-200 flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Stats</span>
                    </button>

                    {/* GM Only: Toggle FoW/Secret visibility */}
                    {isDm && (
                      <button
                        type="button"
                        onClick={() => handleToggleVisibility(menuCombatant.id)}
                        className={`py-1 px-2 text-[11px] font-semibold rounded flex items-center gap-1 border transition cursor-pointer ${
                          menuCombatant.hidden || menuCombatant.isSecret
                            ? 'bg-rose-950/80 border-rose-800 text-rose-300'
                            : 'bg-neutral-800 border-neutral-700 text-slate-300 hover:text-slate-100'
                        }`}
                        title="Toggle visibility to players"
                      >
                        {menuCombatant.hidden || menuCombatant.isSecret ? (
                          <EyeOff className="w-3 h-3" />
                        ) : (
                          <Eye className="w-3 h-3" />
                        )}
                        <span>{menuCombatant.hidden || menuCombatant.isSecret ? 'Hidden' : 'Visible'}</span>
                      </button>
                    )}

                    {/* GM Only: Remove combatant */}
                    {isDm && (
                      <button
                        type="button"
                        onClick={() => {
                          handleDeleteCombatant(menuCombatant.id);
                          setActionMenuCombatantId(null);
                        }}
                        className="p-1 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 transition cursor-pointer"
                        title="Remove combatant"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
};
