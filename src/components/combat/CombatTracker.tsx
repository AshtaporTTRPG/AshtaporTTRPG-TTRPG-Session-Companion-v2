import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Combatant,
  CombatantType,
  Condition,
  CustomCondition,
  isCombatantFoW,
  sortInitiativeStrictDescending,
  getEffectiveAc,
  getClonedCombatantName,
} from '../../types/ttrpg';
import { liveFeedSync, UnifiedFeedItem } from '../../utils/liveFeedSync';
import OBR from '@owlbear-rodeo/sdk';
import {
  ROSTER_METADATA_KEY,
  TURN_METADATA_KEY,
  FEED_METADATA_KEY,
  RosterMetadataPayload,
  TurnMetadataPayload,
  FeedMetadataPayload,
  CombatFeedItem,
  RosterMember,
} from '../../types/combat';
import { COMBAT_STATE_KEY, ROOM_METADATA_KEY, CombatState } from '../../utils/obrCombatSync';
import { playTurnSound } from '../../utils/audio';
import { executeDiceRoll } from '../../utils/dice';
import { getHealthThreshold } from '../../utils/combatHealth';
import { isConcentrating, calculateConcentrationDC } from '../../utils/concentration';
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
  Copy,
  Clock,
  Volume2,
  VolumeX,
  Shield,
} from 'lucide-react';
import { CombatantRow } from './CombatantRow';
import { AddCombatantModal, NewCombatantData } from './AddCombatantModal';
import { MyRosterDrawer } from './MyRosterDrawer';
import { ResetCombatModal } from './ResetCombatModal';

export { ROOM_METADATA_KEY, COMBAT_STATE_KEY, ROSTER_METADATA_KEY, TURN_METADATA_KEY, FEED_METADATA_KEY } from '../../types/combat';

interface CombatTrackerProps {
  isDm: boolean;
  playerName?: string;
}

const CONDITIONS_LIST: (Condition | string)[] = [
  '+2 AC (Half Cover / Shield of Faith)',
  '+5 AC (Shield Spell / Three-Quarters Cover)',
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
  if (name.includes('+2 AC')) return 'bg-cyan-950/90 border-cyan-500/80 text-cyan-300 font-bold';
  if (name.includes('+5 AC')) return 'bg-blue-950/90 border-blue-500/80 text-blue-300 font-bold';
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
      timing: 'none',
    };
  }
  return {
    id: c.id || `cond-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: c.name || '',
    isSecret: !!c.isSecret,
    turnsLeft: c.turnsLeft,
    timing: c.timing || 'none',
  };
};

const getTypeBadge = (type: CombatantType, customLabel?: string) => {
  switch (type) {
    case 'player':
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-500/15 border border-sky-800/50 text-sky-400 flex items-center gap-0.5 shrink-0">
          <User className="w-2.5 h-2.5" />
          <span>PC</span>
        </span>
      );
    case 'ally':
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 border border-emerald-800/50 text-emerald-400 flex items-center gap-0.5 shrink-0">
          <Users className="w-2.5 h-2.5" />
          <span>Ally</span>
        </span>
      );
    case 'monster':
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/15 border border-rose-800/50 text-rose-400 flex items-center gap-0.5 shrink-0">
          <Skull className="w-2.5 h-2.5 text-rose-400" />
          <span>Monster</span>
        </span>
      );
    case 'boss':
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/15 border border-purple-700/50 text-purple-300 flex items-center gap-0.5 shrink-0">
          <Crown className="w-2.5 h-2.5 text-purple-400" />
          <span>Boss</span>
        </span>
      );
    case 'custom':
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 border border-amber-800/50 text-amber-400 flex items-center gap-0.5 shrink-0">
          <Layers className="w-2.5 h-2.5 text-amber-400" />
          <span>{customLabel || 'Custom'}</span>
        </span>
      );
    default:
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 border border-slate-700 text-slate-300 shrink-0">
          NPC
        </span>
      );
  }
};

/**
 * Clean Web Audio API turn chime synthesizer (zero external network requests or audio files)
 * Generates a gentle sine-wave oscillator at 587.33 Hz (D5) tapering to 880 Hz (A5) over 250ms
 */
function playWebAudioTurnChime(enabled: boolean = true) {
  if (!enabled) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 350);
  } catch (err) {
    console.warn('Could not play Web Audio turn chime:', err);
  }
}

export const CombatTracker: React.FC<CombatTrackerProps> = ({ isDm, playerName }) => {
  const rollerIdentity = playerName || liveFeedSync.getPlayerName();

  // Encounter Epoch Lifecycle State
  const [encounterId, setEncounterId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('ashtapor_encounter_id');
      if (saved) return saved;
    } catch {}
    const gen = `enc_${Date.now()}`;
    try {
      localStorage.setItem('ashtapor_encounter_id', gen);
    } catch {}
    return gen;
  });
  const encounterIdRef = useRef<string>(encounterId);
  useEffect(() => {
    encounterIdRef.current = encounterId;
  }, [encounterId]);

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

  // Audio Turn Chime Toggle (enabled by default)
  const [isTurnChimeEnabled, setIsTurnChimeEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ashtapor_turn_chime') !== 'false';
    } catch {
      return true;
    }
  });

  // Concentration Damage DC alerts map: combatantId -> { dc, expiresAt }
  const [concentrationAlerts, setConcentrationAlerts] = useState<
    Record<string, { dc: number; expiresAt: number }>
  >({});

  const triggerConcentrationAlert = (combatantId: string, dc: number) => {
    const expiresAt = Date.now() + 6000;
    setConcentrationAlerts((prev) => ({
      ...prev,
      [combatantId]: { dc, expiresAt },
    }));

    setTimeout(() => {
      setConcentrationAlerts((prev) => {
        if (prev[combatantId] && prev[combatantId].expiresAt <= Date.now()) {
          const next = { ...prev };
          delete next[combatantId];
          return next;
        }
        return prev;
      });
    }, 6000);
  };

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [actionMenuCombatantId, setActionMenuCombatantId] = useState<string | null>(null);
  const [editingCombatantId, setEditingCombatantId] = useState<string | null>(null);

  // Transient deletion tombstone set (ID -> expiration timestamp)
  const deletionTombstones = useRef<Map<string, number>>(new Map());

  // Recently added combatants tracking (ID -> expiration timestamp)
  const recentlyAddedIdsRef = useRef<Map<string, number>>(new Map());

  // Timestamp of last local reset/clear encounter
  const lastLocalClearTimeRef = useRef<number>(0);

  // Transaction Mutex Lock for Join Combat / Exit Combat / Add operations
  const isSyncingRef = useRef<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const syncQueueRef = useRef<Array<() => Promise<void>>>([]);

  // Inflight turn change lock & desync rollback prevention
  const [isTurnUpdating, setIsTurnUpdating] = useState<boolean>(false);
  const lastTurnChangeTimeRef = useRef<number>((() => {
    try {
      const saved = localStorage.getItem('ttrpg_last_turn_change_time');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  })());

  const localCombatantsRef = useRef<Combatant[]>(combatants);
  useEffect(() => {
    localCombatantsRef.current = combatants;
  }, [combatants]);

  // Custom condition form state in combatant options menu
  const [conditionInput, setConditionInput] = useState<string>('');
  const [conditionTiming, setConditionTiming] = useState<'none' | 'start' | 'end'>('none');
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

  // Edit draft states
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<CombatantType>('player');
  const [editCustomLabel, setEditCustomLabel] = useState('');
  const [editInit, setEditInit] = useState(10);
  const [editAc, setEditAc] = useState(10);
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
      localStorage.setItem('ashtapor_encounter_id', encounterId);
    } catch {}
  }, [combatants, activeTurnIndex, activeCombatantId, round, combatStatus, encounterId]);

  // Mutex execution helper to prevent concurrent metadata write collisions
  const withSyncLock = useCallback(async (action: () => Promise<void>) => {
    if (isSyncingRef.current) {
      return new Promise<void>((resolve, reject) => {
        syncQueueRef.current.push(async () => {
          try {
            await action();
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    }

    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      await action();
    } finally {
      setTimeout(async () => {
        const nextTask = syncQueueRef.current.shift();
        if (nextTask) {
          try {
            await nextTask();
          } catch (e) {
            console.error('Queued sync error:', e);
          }
        }
        isSyncingRef.current = false;
        setIsSyncing(false);
      }, 250);
    }
  }, []);

  /**
   * STRICT READ-ONLY METADATA LISTENER
   * Breaks the echo loop: Never writes metadata from inside listener!
   * Partitions incoming metadata into roster, turn, and feed streams.
   */
  const handleIncomingMetadata = useCallback((metadata: Record<string, any>) => {
    const now = Date.now();

    // 1. Process ashtapor/turn partitioned stream
    const turnPayload = metadata[TURN_METADATA_KEY] as TurnMetadataPayload | undefined;
    if (turnPayload) {
      if (typeof turnPayload.currentTurnIndex === 'number') {
        setActiveTurnIndex(turnPayload.currentTurnIndex);
      }
      if (typeof turnPayload.currentRound === 'number') {
        setRound(turnPayload.currentRound);
      }
      if (turnPayload.activeCombatantId !== undefined) {
        setActiveCombatantId(turnPayload.activeCombatantId);
      }
    }

    // 2. Process ashtapor/roster partitioned stream
    const rosterPayload = metadata[ROSTER_METADATA_KEY] as RosterMetadataPayload | undefined;
    if (rosterPayload) {
      const incomingEpoch = rosterPayload.encounterId;

      // Drop zombies: If incoming payload has an older encounterId than current local epoch, ignore
      if (incomingEpoch && incomingEpoch < encounterIdRef.current) {
        return;
      }

      // If incoming payload has a strictly newer encounter epoch, adopt it
      if (incomingEpoch && incomingEpoch > encounterIdRef.current) {
        encounterIdRef.current = incomingEpoch;
        setEncounterId(incomingEpoch);
        try {
          localStorage.setItem('ashtapor_encounter_id', incomingEpoch);
        } catch {}
      }

      const activeEpoch = incomingEpoch || encounterIdRef.current;
      const rawList = Array.isArray(rosterPayload.combatants) ? rosterPayload.combatants : [];

      // Clean tombstones
      for (const [id, expiry] of deletionTombstones.current.entries()) {
        if (now > expiry) deletionTombstones.current.delete(id);
      }
      for (const [id, expiry] of recentlyAddedIdsRef.current.entries()) {
        if (now > expiry) recentlyAddedIdsRef.current.delete(id);
      }

      // Drop any combatant tagged with an older encounterId or in tombstones
      const validIncoming = rawList.filter(
        (c) =>
          (!c.encounterId || c.encounterId === activeEpoch) &&
          !deletionTombstones.current.has(c.id)
      );

      const mergedMap = new Map<string, Combatant>();
      for (const inc of validIncoming) {
        const local = localCombatantsRef.current.find((l) => l.id === inc.id);
        if (local && (local.updatedAt || 0) > (inc.updatedAt || 0)) {
          mergedMap.set(inc.id, local);
        } else {
          mergedMap.set(inc.id, { ...inc, encounterId: activeEpoch });
        }
      }

      // Preserve any recently added local combatants in flight
      for (const local of localCombatantsRef.current) {
        if (!mergedMap.has(local.id) && !deletionTombstones.current.has(local.id)) {
          const isRecentlyAdded = recentlyAddedIdsRef.current.has(local.id);
          const isRecentLocal = local.updatedAt && now - local.updatedAt < 6000;
          if ((isRecentlyAdded || isRecentLocal) && (!local.encounterId || local.encounterId === activeEpoch)) {
            mergedMap.set(local.id, local);
          }
        }
      }

      const sorted = sortInitiativeStrictDescending(Array.from(mergedMap.values()));
      setCombatants(sorted);
      localCombatantsRef.current = sorted;
      try {
        localStorage.setItem('ttrpg_combatants', JSON.stringify(sorted));
      } catch {}
      return;
    }

    // 3. Process ashtapor/feed stream
    const feedPayload = metadata[FEED_METADATA_KEY] as FeedMetadataPayload | undefined;
    if (feedPayload && Array.isArray(feedPayload.items)) {
      setCombatFeedItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = feedPayload.items.filter((i) => !existingIds.has(i.id));
        if (newItems.length === 0) return prev;
        const mapped = newItems.map((item) => ({
          id: item.id,
          type: (item.type || 'combat') as any,
          sender: item.sender,
          message: item.message,
          playerMessage: item.playerMessage,
          isSecret: item.isSecret,
          timestamp: item.timestamp,
        }));
        return [...prev, ...mapped].slice(-30);
      });
    }

    // 4. Backwards compatibility fallback for legacy ROOM_METADATA_KEY if partitioned keys absent
    if (!rosterPayload && !turnPayload) {
      const legacyState = (metadata[ROOM_METADATA_KEY] || metadata[COMBAT_STATE_KEY]) as any;
      if (legacyState) {
        const incomingTurnIndex = legacyState.currentTurnIndex ?? legacyState.activeTurnIndex;
        const incomingRound = legacyState.currentRound ?? legacyState.round;
        if (typeof incomingTurnIndex === 'number') setActiveTurnIndex(incomingTurnIndex);
        if (typeof incomingRound === 'number') setRound(incomingRound);
        if (legacyState.activeCombatantId) setActiveCombatantId(legacyState.activeCombatantId);
        if (Array.isArray(legacyState.combatants)) {
          const sorted = sortInitiativeStrictDescending(legacyState.combatants);
          setCombatants(sorted);
          localCombatantsRef.current = sorted;
        }
      }
    }
  }, []);

  // Initial OBR room metadata fetch
  useEffect(() => {
    if (!OBR.isReady) return;
    OBR.room
      .getMetadata()
      .then((meta) => {
        handleIncomingMetadata(meta);
      })
      .catch(() => {});
  }, [handleIncomingMetadata]);

  // Listen for OBR metadata changes - STRICTLY READ ONLY
  useEffect(() => {
    if (!OBR.isReady) return;
    const unsub = OBR.room.onMetadataChange((meta) => {
      handleIncomingMetadata(meta);
    });
    return () => unsub();
  }, [handleIncomingMetadata]);

  /**
   * PARTITIONED BROADCAST HELPERS
   * Rule: Turn advancement or feed logging must NEVER read, write, or overwrite ashtapor/roster!
   */
  const broadcastRoster = async (updatedCombatants: Combatant[]) => {
    if (!OBR.isReady) return;
    try {
      const tagged = updatedCombatants.map((c) => ({
        ...c,
        encounterId: encounterIdRef.current,
      }));
      await OBR.room.setMetadata({
        [ROSTER_METADATA_KEY]: {
          encounterId: encounterIdRef.current,
          combatants: tagged,
        },
      });
    } catch (e) {
      console.error('Failed to set partitioned ashtapor/roster metadata:', e);
    }
  };

  const broadcastTurn = async (
    updatedTurn: number,
    updatedRound: number,
    updatedActiveCombatantId?: string | null
  ) => {
    if (!OBR.isReady) return;
    try {
      await OBR.room.setMetadata({
        [TURN_METADATA_KEY]: {
          encounterId: encounterIdRef.current,
          currentTurnIndex: updatedTurn,
          currentRound: updatedRound,
          activeCombatantId:
            updatedActiveCombatantId !== undefined ? updatedActiveCombatantId : activeCombatantId,
        },
      });
    } catch (e) {
      console.error('Failed to set partitioned ashtapor/turn metadata:', e);
    }
  };

  const broadcastFeedLog = async (
    message: string,
    isSecret?: boolean,
    playerMessage?: string
  ) => {
    const item: CombatFeedItem = {
      id: `cf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      encounterId: encounterIdRef.current,
      message,
      playerMessage: isSecret ? undefined : (playerMessage !== undefined ? playerMessage : message),
      sender: isDm ? 'Game Master' : rollerIdentity,
      timestamp: Date.now(),
      isSecret: Boolean(isSecret),
      type: 'combat',
    };

    // Local live feed record
    liveFeedSync.recordCombatLog(message, false, playerMessage, isSecret);

    if (OBR.isReady) {
      try {
        const meta = await OBR.room.getMetadata();
        const currentFeed = (meta[FEED_METADATA_KEY] as FeedMetadataPayload | undefined)?.items || [];
        const nextItems = [...currentFeed, item].slice(-25);
        await OBR.room.setMetadata({
          [FEED_METADATA_KEY]: {
            items: nextItems,
          },
        });
      } catch (err) {
        console.warn('Failed to update ashtapor/feed metadata:', err);
      }
    }
  };

  // Turn management: NEXT TURN with Auto-Round Increment & Web Audio Turn Bell
  const handleNextTurn = async () => {
    if (combatants.length === 0 || isTurnUpdating) return;
    setIsTurnUpdating(true);
    setConcentrationAlerts({});

    const now = Date.now();
    lastTurnChangeTimeRef.current = now;
    try {
      localStorage.setItem('ttrpg_last_turn_change_time', now.toString());
    } catch {}

    const sorted = sortInitiativeStrictDescending(combatants);

    const currentIndex = activeCombatantId
      ? sorted.findIndex((c) => c.id === activeCombatantId)
      : -1;

    let nextActiveId: string;
    let nextRound = round;

    if (currentIndex === -1 || currentIndex >= sorted.length - 1) {
      nextActiveId = sorted[0].id;
      nextRound = round + 1;
      broadcastFeedLog(`🔔 --- Round ${nextRound} Began ---`, false);
    } else {
      nextActiveId = sorted[currentIndex + 1].id;
    }

    const nextIndex = sorted.findIndex((c) => c.id === nextActiveId);
    const nextCombatant = sorted[nextIndex];

    // Optimistic local update (0ms latency)
    setActiveCombatantId(nextActiveId);
    setActiveTurnIndex(nextIndex);
    setRound(nextRound);

    // Audio Turn Chime (Web Audio API synth)
    if (isTurnChimeEnabled) {
      playWebAudioTurnChime(true);
    } else {
      playTurnSound();
    }

    if (nextCombatant) {
      const isHidden = nextCombatant.isReserve || nextCombatant.hidden || nextCombatant.isSecret;
      if (!isHidden) {
        const announcement = `⚔️ Turn ${nextIndex + 1}/${sorted.length}: It is ${nextCombatant.name}'s turn! (Round ${nextRound})`;
        liveFeedSync.recordTurnAnnouncement(announcement, true);
        if (nextCombatant.type === 'player' || nextCombatant.role === 'PC' || nextCombatant.role === 'Player') {
          setPlayerTurnAlert(`⚔️ ${nextCombatant.name.toUpperCase()}'S TURN!`);
          setTimeout(() => setPlayerTurnAlert(null), 4000);
        } else {
          setPlayerTurnAlert(null);
        }
      } else {
        broadcastFeedLog(
          `⚔️ Turn ${nextIndex + 1}/${sorted.length}: It is ${nextCombatant.name}'s turn! (Round ${nextRound})`,
          true
        );
        setPlayerTurnAlert(null);
      }
    }

    // Direct atomic broadcast to ashtapor/turn ONLY - NEVER writes to ashtapor/roster!
    try {
      await broadcastTurn(nextIndex, nextRound, nextActiveId);
    } finally {
      setIsTurnUpdating(false);
    }
  };

  // PREV TURN
  const handlePrevTurn = async () => {
    if (combatants.length === 0 || isTurnUpdating) return;
    setIsTurnUpdating(true);
    setConcentrationAlerts({});

    const now = Date.now();
    lastTurnChangeTimeRef.current = now;
    try {
      localStorage.setItem('ttrpg_last_turn_change_time', now.toString());
    } catch {}

    const sorted = sortInitiativeStrictDescending(combatants);

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

    // Optimistic local update
    setActiveCombatantId(prevActiveId);
    setActiveTurnIndex(prevIndex);
    setRound(prevRound);

    // Broadcast only to ashtapor/turn
    try {
      await broadcastTurn(prevIndex, prevRound, prevActiveId);
    } finally {
      setIsTurnUpdating(false);
    }
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

    if (isTurnChimeEnabled) {
      playWebAudioTurnChime(true);
    } else {
      playTurnSound();
    }

    if (first) {
      broadcastFeedLog(
        `⚔️ Combat Started! Round 1 begins with ${first.name} (Initiative ${first.initiative}).`,
        false
      );
    }

    broadcastTurn(0, 1, firstId);
    broadcastRoster(sorted);
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
    broadcastRoster(sorted);
    broadcastTurn(newIndex, round, currentActiveId);
  };

  // ROLL INITIATIVE FOR ONE COMBATANT
  const handleRollInitiative = (combatantId: string) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    if (
      !isDm &&
      target.type !== 'player' &&
      target.type !== 'ally' &&
      target.role !== 'PC' &&
      target.role !== 'Player' &&
      target.role !== 'Ally'
    )
      return;

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
      c.id === combatantId ? { ...c, initiative: newInit, updatedAt: Date.now() } : c
    );
    const sorted = sortInitiativeStrictDescending(updated);

    let targetIdx = activeTurnIndex;
    if (activeCombatantId) {
      const found = sorted.findIndex((c) => c.id === activeCombatantId);
      if (found !== -1) targetIdx = found;
    }

    setCombatants(sorted);
    localCombatantsRef.current = sorted;
    setActiveTurnIndex(targetIdx);
    liveFeedSync.recordDiceRoll(rollResult, true);
    broadcastRoster(sorted);
    broadcastTurn(targetIdx, round, activeCombatantId);
  };

  // SMART RESET: OPTION 1 - CLEAR HOSTILES ONLY (Wave Reset within current epoch)
  const handleClearHostilesOnly = async () => {
    const activeEncId = encounterIdRef.current;
    const remainingParty = combatants.filter(
      (c) =>
        c.role !== 'Monster' &&
        c.role !== 'Boss' &&
        c.role !== 'Custom' &&
        c.type !== 'monster' &&
        c.type !== 'boss' &&
        c.type !== 'custom'
    );

    const sortedParty = sortInitiativeStrictDescending(remainingParty);
    const firstPartyId = sortedParty[0]?.id || null;

    setCombatants(sortedParty);
    localCombatantsRef.current = sortedParty;
    setActiveCombatantId(firstPartyId);
    setActiveTurnIndex(0);
    setRound(1);
    setCombatStatus(sortedParty.length > 0 ? 'active' : 'setup');
    setIsClearModalOpen(false);
    setConcentrationAlerts({});

    try {
      localStorage.setItem('ttrpg_combatants', JSON.stringify(sortedParty));
      if (firstPartyId) {
        localStorage.setItem('ttrpg_active_combatant_id', firstPartyId);
      } else {
        localStorage.removeItem('ttrpg_active_combatant_id');
      }
      localStorage.setItem('ttrpg_active_turn_index', '0');
      localStorage.setItem('ttrpg_combat_round', '1');
      localStorage.setItem('ttrpg_combat_status', sortedParty.length > 0 ? 'active' : 'setup');
    } catch {}

    const logMsg = `⚔️ Hostiles cleared! Party preserved (${sortedParty.length} heroes remaining, Round 1).`;
    await broadcastFeedLog(logMsg, false);

    if (OBR.isReady) {
      try {
        await OBR.room.setMetadata({
          [ROSTER_METADATA_KEY]: {
            encounterId: activeEncId,
            combatants: sortedParty,
          },
          [TURN_METADATA_KEY]: {
            encounterId: activeEncId,
            currentTurnIndex: 0,
            currentRound: 1,
            activeCombatantId: firstPartyId,
          },
        });
      } catch (e) {
        console.error('Failed to clear hostiles in OBR room:', e);
      }
    }
  };

  // SMART RESET: OPTION 2 - FULL CLEAR / END ENCOUNTER (Generates fresh new encounterId epoch)
  const handleFullClearCombat = async () => {
    const newEncounterId = `enc_${Date.now()}`;
    encounterIdRef.current = newEncounterId;
    setEncounterId(newEncounterId);
    lastLocalClearTimeRef.current = Date.now();
    recentlyAddedIdsRef.current.clear();
    deletionTombstones.current.clear();

    setCombatants([]);
    localCombatantsRef.current = [];
    setActiveCombatantId(null);
    setActiveTurnIndex(0);
    setRound(1);
    setCombatStatus('setup');
    setIsClearModalOpen(false);
    setConcentrationAlerts({});
    setCombatFeedItems([]);

    try {
      localStorage.setItem('ashtapor_encounter_id', newEncounterId);
      localStorage.setItem('ttrpg_combatants', JSON.stringify([]));
      localStorage.removeItem('ttrpg_active_combatant_id');
      localStorage.setItem('ttrpg_active_turn_index', '0');
      localStorage.setItem('ttrpg_combat_round', '1');
      localStorage.setItem('ttrpg_combat_status', 'setup');
    } catch {}

    liveFeedSync.clearFeed();
    const resetMsg = '⚔️ Encounter ended and reset to a blank slate.';
    liveFeedSync.recordCombatLog(resetMsg, false);

    if (OBR.isReady) {
      try {
        await OBR.room.setMetadata({
          [ROSTER_METADATA_KEY]: {
            encounterId: newEncounterId,
            combatants: [],
          },
          [TURN_METADATA_KEY]: {
            encounterId: newEncounterId,
            currentTurnIndex: 0,
            currentRound: 1,
            activeCombatantId: null,
          },
          [FEED_METADATA_KEY]: {
            items: [
              {
                id: `cf-${Date.now()}`,
                encounterId: newEncounterId,
                message: resetMsg,
                sender: 'Game Master',
                timestamp: Date.now(),
                type: 'combat',
              },
            ],
          },
        });
      } catch (e) {
        console.error('Failed to reset encounter in OBR room:', e);
      }
    }
  };

  // Canonical role helper
  const getCombatantCanonicalRole = (c: Combatant): 'PC' | 'Ally' | 'Monster' | 'Boss' | 'Custom' => {
    const roleStr = (c.role || '').toLowerCase().trim();
    const typeStr = (c.type || '').toLowerCase().trim();
    if (roleStr === 'pc' || roleStr === 'player' || typeStr === 'player') return 'PC';
    if (roleStr === 'ally' || typeStr === 'ally') return 'Ally';
    if (roleStr === 'boss' || typeStr === 'boss') return 'Boss';
    if (roleStr === 'custom' || typeStr === 'custom') return 'Custom';
    return 'Monster';
  };

  // AUDITED HP HANDLER: APPLY HEALING (Strict Factual Reporting)
  const applyHeal = (combatantId: string, amount: number) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    const isPlayerOrAlly =
      target.type === 'player' ||
      target.type === 'ally' ||
      target.role === 'PC' ||
      target.role === 'Player' ||
      target.role === 'Ally';

    if (!isDm && !isPlayerOrAlly) return;

    const healAmount = Math.max(0, Math.round(amount));
    if (healAmount === 0) return;

    const currentHp = Math.min(target.hpMax, target.hpCurrent + healAmount);
    let updatedDeathSaves = target.deathSaves;
    if (currentHp > 0 && isPlayerOrAlly) {
      updatedDeathSaves = { successes: 0, failures: 0 };
    }

    const canonicalRole = getCombatantCanonicalRole(target);
    const isSecret = Boolean(target.isReserve || target.isSecret || target.hidden);

    // Rule:
    // If role is Monster, Boss, or Custom: ZERO LOG ENTRIES. Complete silence in ashtapor/feed!
    // If role is PC or Ally: Log "{name} healed for {amount} HP."
    if (canonicalRole === 'PC' || canonicalRole === 'Ally') {
      const msg = `${target.name} healed for ${healAmount} HP.`;
      broadcastFeedLog(msg, isSecret);
    }

    const now = Date.now();
    const updated = combatants.map((c) =>
      c.id === combatantId
        ? {
            ...c,
            hpCurrent: currentHp,
            hp: currentHp,
            deathSaves: updatedDeathSaves,
            updatedAt: now,
          }
        : c
    );
    setCombatants(updated);
    localCombatantsRef.current = updated;
    try {
      localStorage.setItem('ttrpg_combatants', JSON.stringify(updated));
    } catch {}
    broadcastRoster(updated);
  };

  // AUDITED HP HANDLER: APPLY DAMAGE (Strict Factual Reporting)
  const applyDamage = (combatantId: string, amount: number) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    const isPlayerOrAlly =
      target.type === 'player' ||
      target.type === 'ally' ||
      target.role === 'PC' ||
      target.role === 'Player' ||
      target.role === 'Ally';

    if (!isDm && !isPlayerOrAlly) return;

    const damageAmount = Math.max(0, Math.round(amount));
    if (damageAmount === 0) return;

    let currentTemp = target.tempHp ?? target.hpTemp ?? 0;
    let rem = damageAmount;
    if (currentTemp > 0) {
      if (rem <= currentTemp) {
        currentTemp -= rem;
        rem = 0;
      } else {
        rem -= currentTemp;
        currentTemp = 0;
      }
    }
    const currentHp = Math.max(0, target.hpCurrent - rem);

    // Concentration alert badge trigger
    if (isConcentrating(target)) {
      const dc = calculateConcentrationDC(damageAmount);
      triggerConcentrationAlert(target.id, dc);
    }

    const canonicalRole = getCombatantCanonicalRole(target);
    const isSecret = Boolean(target.isReserve || target.isSecret || target.hidden);
    const isMasked = Boolean(target.maskStats || target.fogOfWar);

    // Rules:
    // If masked:
    //   - Monster: Log "Monster took damage!"
    //   - Boss: Log "Boss took damage!"
    //   - Custom: Log "{name} took damage!"
    //   - PC/Ally: Log "{name} took damage!"
    // If unmasked: Log "{name} took damage!"
    // Never log exact damage numbers for masked combatants.
    let logMsg: string;
    if (isMasked) {
      if (canonicalRole === 'Monster') {
        logMsg = 'Monster took damage!';
      } else if (canonicalRole === 'Boss') {
        logMsg = 'Boss took damage!';
      } else {
        logMsg = `${target.name} took damage!`;
      }
    } else {
      logMsg = `${target.name} took damage!`;
    }

    broadcastFeedLog(logMsg, isSecret);

    const now = Date.now();
    const updated = combatants.map((c) =>
      c.id === combatantId
        ? {
            ...c,
            hpCurrent: currentHp,
            hp: currentHp,
            hpTemp: currentTemp,
            tempHp: currentTemp,
            updatedAt: now,
          }
        : c
    );
    setCombatants(updated);
    localCombatantsRef.current = updated;
    try {
      localStorage.setItem('ttrpg_combatants', JSON.stringify(updated));
    } catch {}
    broadcastRoster(updated);
  };

  // HP DELTA MICRO-BUTTONS (-1, -5, +5, +1) AND INLINE POPOVER DISPATCHER
  const handleHpDelta = (combatantId: string, delta: number) => {
    if (delta < 0) {
      applyDamage(combatantId, Math.abs(delta));
    } else if (delta > 0) {
      applyHeal(combatantId, delta);
    }
  };

  // UPDATE MAX HP
  const handleUpdateMaxHp = (combatantId: string, newMaxHp: number) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    const isPlayerOrAlly =
      target.type === 'player' ||
      target.type === 'ally' ||
      target.role === 'PC' ||
      target.role === 'Player' ||
      target.role === 'Ally';
    if (!isDm && !isPlayerOrAlly) return;

    const clampedHpCurrent = Math.min(target.hpCurrent, newMaxHp);
    const now = Date.now();
    const updated = combatants.map((c) =>
      c.id === combatantId
        ? {
            ...c,
            hpMax: newMaxHp,
            maxHp: newMaxHp,
            hpCurrent: clampedHpCurrent,
            hp: clampedHpCurrent,
            updatedAt: now,
          }
        : c
    );
    setCombatants(updated);
    localCombatantsRef.current = updated;
    try {
      localStorage.setItem('ttrpg_combatants', JSON.stringify(updated));
    } catch {}
    broadcastRoster(updated);
  };

  // UPDATE DEATH SAVES
  const handleUpdateDeathSaves = (
    combatantId: string,
    saves: { successes: number; failures: number }
  ) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    const isPlayerOrAlly =
      target.type === 'player' ||
      target.type === 'ally' ||
      target.role === 'PC' ||
      target.role === 'Player' ||
      target.role === 'Ally';
    if (!isDm && !isPlayerOrAlly) return;

    const now = Date.now();
    const updated = combatants.map((c) =>
      c.id === combatantId
        ? {
            ...c,
            deathSaves: saves,
            updatedAt: now,
          }
        : c
    );
    setCombatants(updated);
    localCombatantsRef.current = updated;
    try {
      localStorage.setItem('ttrpg_combatants', JSON.stringify(updated));
    } catch {}
    broadcastRoster(updated);
  };

  // TABLE-WIDE COMBATANT UPDATE
  const handleUpdateCombatant = async (id: string, updates: Partial<Combatant>) => {
    const target = combatants.find((c) => c.id === id);
    if (!target) return;
    const isPlayerOrAlly =
      target.type === 'player' ||
      target.type === 'ally' ||
      target.role === 'PC' ||
      target.role === 'Player' ||
      target.role === 'Ally';
    if (!isDm && !isPlayerOrAlly) return;

    const now = Date.now();
    const next = combatants.map((c) => {
      if (c.id !== id) return c;
      const updated = { ...c, ...updates, updatedAt: now };
      const nextHp = updates.hpCurrent !== undefined ? updates.hpCurrent : updates.hp;
      if (nextHp !== undefined && nextHp > 0) {
        updated.deathSaves = { successes: 0, failures: 0 };
      }
      return updated;
    });

    setCombatants(next);
    localCombatantsRef.current = next;

    try {
      localStorage.setItem('ttrpg_combatants', JSON.stringify(next));
    } catch {}

    await broadcastRoster(next);
    return next;
  };

  // 1-CLICK DUPLICATE MINION
  const handleDuplicateCombatant = async (combatantId: string) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;

    const uniqueId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `c_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const clonedName = getClonedCombatantName(target.name);

    const cloned: Combatant = {
      ...target,
      id: uniqueId,
      name: clonedName,
      encounterId: encounterIdRef.current,
      sortOrder: (target.sortOrder ?? 0) + 1,
      deathSaves: undefined,
      updatedAt: Date.now(),
    };

    const updated = sortInitiativeStrictDescending([...combatants, cloned]);
    setCombatants(updated);
    localCombatantsRef.current = updated;
    recentlyAddedIdsRef.current.set(uniqueId, Date.now() + 8000);

    try {
      localStorage.setItem('ttrpg_combatants', JSON.stringify(updated));
    } catch {}

    await broadcastFeedLog(`📋 Cloned ${cloned.name} (from ${target.name}).`, false);
    await broadcastRoster(updated);
    setActionMenuCombatantId(null);
  };

  // 1-CLICK DEPLOY RESERVE COMBATANT (GM Action)
  const handleDeployCombatant = async (combatantId: string) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;

    const updated = combatants.map((c) =>
      c.id === combatantId
        ? {
            ...c,
            isReserve: false,
            hidden: false,
            isSecret: false,
            updatedAt: Date.now(),
          }
        : c
    );

    setCombatants(updated);
    localCombatantsRef.current = updated;
    await broadcastFeedLog(`👁️ ${target.name} has entered the encounter from reserves!`, false);
    await broadcastRoster(updated);
  };

  // INLINE TEMP HP SAVE
  const handleSaveInlineThp = (combatantId: string) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    const isPlayerOrAlly =
      target.type === 'player' ||
      target.type === 'ally' ||
      target.role === 'PC' ||
      target.role === 'Player' ||
      target.role === 'Ally';
    if (!isDm && !isPlayerOrAlly) return;

    const val = Math.max(0, inlineThpVal);
    const now = Date.now();
    const updated = combatants.map((c) =>
      c.id === combatantId ? { ...c, tempHp: val, hpTemp: val, updatedAt: now } : c
    );
    setCombatants(updated);
    localCombatantsRef.current = updated;
    setInlineThpId(null);

    const logDm = `🛡️ ${target.name} set Temp HP to +${val} THP.`;
    const logP = isCombatantFoW(target) ? undefined : logDm;
    broadcastFeedLog(logDm, false, logP);

    try {
      localStorage.setItem('ttrpg_combatants', JSON.stringify(updated));
    } catch {}
    broadcastRoster(updated);
  };

  // ADD CUSTOM CONDITION WITH TIMING TAG
  const handleAddCustomCondition = (
    combatantId: string,
    nameToUse?: string,
    timingToUse?: 'none' | 'start' | 'end'
  ) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    const isPlayerOrAlly =
      target.type === 'player' ||
      target.type === 'ally' ||
      target.role === 'PC' ||
      target.role === 'Player' ||
      target.role === 'Ally';
    if (!isDm && !isPlayerOrAlly) return;

    const rawName = (nameToUse || conditionInput).trim();
    if (!rawName) return;

    const timing = timingToUse ?? conditionTiming;

    const newCond: CustomCondition = {
      id: `cond-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: rawName,
      isSecret: isDm ? conditionIsSecret : false,
      timing,
    };

    const existingNormalized = target.conditions.map(normalizeCondition);
    const updatedConditions = [...existingNormalized, newCond];
    const now = Date.now();

    const updated = combatants.map((c) =>
      c.id === combatantId ? { ...c, conditions: updatedConditions, updatedAt: now } : c
    );
    setCombatants(updated);
    localCombatantsRef.current = updated;
    setConditionInput('');
    setConditionTiming('none');
    setConditionIsSecret(false);

    const timingLabel = timing === 'start' ? ' (⏱ Start)' : timing === 'end' ? ' (⏱ End)' : '';
    const logDm = `✨ Condition [${rawName}${timingLabel}]${newCond.isSecret ? ' (Secret)' : ''} applied to ${target.name}.`;
    const logP = newCond.isSecret ? undefined : `✨ Condition [${rawName}${timingLabel}] applied to ${target.name}.`;
    broadcastFeedLog(logDm, newCond.isSecret, logP);

    try {
      localStorage.setItem('ttrpg_combatants', JSON.stringify(updated));
    } catch {}
    broadcastRoster(updated);
  };

  // REMOVE CONDITION
  const handleRemoveCondition = (combatantId: string, condIdOrName: string) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    const isPlayerOrAlly =
      target.type === 'player' ||
      target.type === 'ally' ||
      target.role === 'PC' ||
      target.role === 'Player' ||
      target.role === 'Ally';
    if (!isDm && !isPlayerOrAlly) return;

    const existingNormalized = target.conditions.map(normalizeCondition);
    const condToRemove = existingNormalized.find(
      (cond) => cond.id === condIdOrName || cond.name === condIdOrName
    );
    const updatedConditions = existingNormalized.filter(
      (cond) => cond.id !== condIdOrName && cond.name !== condIdOrName
    );
    const now = Date.now();

    const updated = combatants.map((c) =>
      c.id === combatantId ? { ...c, conditions: updatedConditions, updatedAt: now } : c
    );
    setCombatants(updated);
    localCombatantsRef.current = updated;

    if (condToRemove) {
      const logDm = `✨ Condition [${condToRemove.name}] removed from ${target.name}.`;
      const logP = condToRemove.isSecret ? undefined : logDm;
      broadcastFeedLog(logDm, condToRemove.isSecret, logP);
    }

    try {
      localStorage.setItem('ttrpg_combatants', JSON.stringify(updated));
    } catch {}
    broadcastRoster(updated);
  };

  // MANUAL COMBATANT REORDERING (GM Only)
  const handleMoveCombatant = (combatantId: string, direction: -1 | 1) => {
    if (!isDm || combatants.length <= 1) return;
    const sorted = sortInitiativeStrictDescending(combatants);
    const currentIndex = sorted.findIndex((c) => c.id === combatantId);
    if (currentIndex === -1) return;
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    sorted.forEach((c, idx) => {
      if (c.sortOrder === undefined) c.sortOrder = idx;
    });

    const curr = sorted[currentIndex];
    const target = sorted[targetIndex];

    if (curr.initiative === target.initiative) {
      const tempOrder = curr.sortOrder ?? currentIndex;
      curr.sortOrder = target.sortOrder ?? targetIndex;
      target.sortOrder = tempOrder;
      if (direction === -1 && (curr.sortOrder ?? 0) >= (target.sortOrder ?? 0)) {
        curr.sortOrder = (target.sortOrder ?? 0) - 1;
      } else if (direction === 1 && (curr.sortOrder ?? 0) <= (target.sortOrder ?? 0)) {
        curr.sortOrder = (target.sortOrder ?? 0) + 1;
      }
    } else {
      const tempInit = curr.initiative;
      const tempOrder = curr.sortOrder ?? currentIndex;
      curr.initiative = target.initiative;
      curr.sortOrder = target.sortOrder ?? targetIndex;
      target.initiative = tempInit;
      target.sortOrder = tempOrder;
    }

    const now = Date.now();
    curr.updatedAt = now;
    target.updatedAt = now;

    const reordered = sortInitiativeStrictDescending(sorted);
    setCombatants(reordered);
    localCombatantsRef.current = reordered;

    let targetActiveIdx = activeTurnIndex;
    if (activeCombatantId) {
      const foundIdx = reordered.findIndex((c) => c.id === activeCombatantId);
      if (foundIdx !== -1) targetActiveIdx = foundIdx;
    }
    setActiveTurnIndex(targetActiveIdx);
    broadcastRoster(reordered);
    broadcastTurn(targetActiveIdx, round, activeCombatantId);
  };

  // DELETE COMBATANT (DM Only with tombstone protection)
  const handleDeleteCombatant = (combatantId: string) => {
    if (!isDm) return;
    deletionTombstones.current.set(combatantId, Date.now() + 15000);
    recentlyAddedIdsRef.current.delete(combatantId);

    const target = combatants.find((c) => c.id === combatantId);
    const updated = combatants.filter((c) => c.id !== combatantId);
    setCombatants(updated);
    localCombatantsRef.current = updated;
    setActionMenuCombatantId(null);

    if (target) broadcastFeedLog(`💀 ${target.name} was removed from combat.`, false);

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
    broadcastRoster(updated);
    broadcastTurn(nextActiveIdx, round, nextActiveId);
  };

  // START EDITING COMBATANT
  const handleStartEditing = (c: Combatant) => {
    const isPlayerOrAlly =
      c.type === 'player' ||
      c.type === 'ally' ||
      c.role === 'PC' ||
      c.role === 'Player' ||
      c.role === 'Ally';
    if (!isDm && !isPlayerOrAlly) return;

    setEditingCombatantId(c.id);
    setEditName(c.name);
    setEditType(c.type);
    setEditCustomLabel(c.customRoleLabel || '');
    setEditInit(c.initiative);
    setEditAc(c.ac ?? c.armorClass ?? 10);
    setEditHpMax(c.hpMax);
    setEditHpCurr(c.hpCurrent);
    setEditTempHp(c.tempHp ?? c.hpTemp ?? 0);
  };

  // SAVE EDITED COMBATANT
  const handleSaveEdit = (combatantId: string) => {
    const target = combatants.find((c) => c.id === combatantId);
    if (!target) return;
    const isPlayerOrAlly =
      target.type === 'player' ||
      target.type === 'ally' ||
      target.role === 'PC' ||
      target.role === 'Player' ||
      target.role === 'Ally';
    if (!isDm && !isPlayerOrAlly) return;

    const allowedType: CombatantType = !isDm
      ? target.type === 'ally' || target.role === 'Ally'
        ? 'ally'
        : 'player'
      : editType;

    const newHpCurrent = Math.min(editHpCurr, editHpMax);
    if (newHpCurrent < target.hpCurrent && isConcentrating(target)) {
      const dmg = target.hpCurrent - newHpCurrent;
      const dc = calculateConcentrationDC(dmg);
      triggerConcentrationAlert(target.id, dc);
    }

    let updated = combatants.map((c) =>
      c.id === combatantId
        ? {
            ...c,
            name: editName.trim() || c.name,
            type: allowedType,
            role:
              allowedType === 'player'
                ? 'Player'
                : allowedType === 'ally'
                ? 'Ally'
                : allowedType === 'boss'
                ? 'Boss'
                : 'Monster',
            customRoleLabel: allowedType === 'custom' ? editCustomLabel.trim() : undefined,
            initiative: editInit,
            armorClass: editAc,
            ac: editAc,
            hpMax: editHpMax,
            maxHp: editHpMax,
            hpCurrent: newHpCurrent,
            hp: newHpCurrent,
            hpTemp: Math.max(0, editTempHp),
            tempHp: Math.max(0, editTempHp),
            updatedAt: Date.now(),
          }
        : c
    );
    updated = sortInitiativeStrictDescending(updated);
    setCombatants(updated);
    localCombatantsRef.current = updated;
    setEditingCombatantId(null);
    setActionMenuCombatantId(null);

    let targetIdx = activeTurnIndex;
    if (activeCombatantId) {
      const found = updated.findIndex((c) => c.id === activeCombatantId);
      if (found !== -1) targetIdx = found;
    }
    setActiveTurnIndex(targetIdx);
    broadcastRoster(updated);
    broadcastTurn(targetIdx, round, activeCombatantId);
  };

  // ADD COMBATANT (Wrapped in Transaction Mutex Lock)
  const handleAddCombatant = async (newEntry: Omit<Combatant, 'id'>) => {
    await withSyncLock(async () => {
      const uniqueId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `c_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const newCombatant: Combatant = {
        ...newEntry,
        id: uniqueId,
        encounterId: encounterIdRef.current,
        hp: Number(newEntry.maxHp ?? newEntry.hpMax) || 10,
        maxHp: Number(newEntry.maxHp ?? newEntry.hpMax) || 10,
        hpCurrent: Number(newEntry.hpCurrent ?? newEntry.maxHp ?? newEntry.hpMax) || 10,
        hpMax: Number(newEntry.maxHp ?? newEntry.hpMax) || 10,
        tempHp: Number(newEntry.tempHp ?? newEntry.hpTemp) || 0,
        hpTemp: Number(newEntry.tempHp ?? newEntry.hpTemp) || 0,
        initiative: Number(newEntry.initiative) || 10,
        ac: Number(newEntry.ac ?? newEntry.armorClass) || 10,
        armorClass: Number(newEntry.ac ?? newEntry.armorClass) || 10,
        conditions: newEntry.conditions || [],
        hidden: Boolean(newEntry.hidden),
        sortOrder: combatants.length,
        updatedAt: Date.now(),
      };

      // Fetch fresh server snapshot
      let existingCombatants = combatants;
      if (OBR.isReady) {
        try {
          const currentMeta = await OBR.room.getMetadata();
          const rosterPayload = currentMeta[ROSTER_METADATA_KEY] as RosterMetadataPayload | undefined;
          if (rosterPayload && Array.isArray(rosterPayload.combatants)) {
            existingCombatants = rosterPayload.combatants;
          }
        } catch (err) {
          console.warn('Could not fetch fresh room metadata before adding combatant:', err);
        }
      }

      const updatedList = sortInitiativeStrictDescending([...existingCombatants, newCombatant]);
      setCombatants(updatedList);
      localCombatantsRef.current = updatedList;
      recentlyAddedIdsRef.current.set(newCombatant.id, Date.now() + 8000);

      try {
        localStorage.setItem('ttrpg_combatants', JSON.stringify(updatedList));
      } catch {}

      let targetActiveId = activeCombatantId;
      let targetActiveIndex = activeTurnIndex;

      if (existingCombatants.length === 0) {
        targetActiveId = newCombatant.id;
        targetActiveIndex = 0;
        setActiveCombatantId(newCombatant.id);
        setActiveTurnIndex(0);
      } else if (activeCombatantId) {
        const found = updatedList.findIndex((c) => c.id === activeCombatantId);
        if (found !== -1) targetActiveIndex = found;
        setActiveTurnIndex(targetActiveIndex);
      }

      if (!newCombatant.isReserve && !newCombatant.hidden) {
        await broadcastFeedLog(
          `➕ Added ${newCombatant.name} (Init ${newCombatant.initiative}, ${newCombatant.hpMax} HP, ${newCombatant.ac} AC).`,
          false
        );
      }

      await broadcastRoster(updatedList);
      if (existingCombatants.length === 0) {
        await broadcastTurn(0, round, newCombatant.id);
      }
    });
  };

  const handleAddCombatantFromModal = async (data: NewCombatantData) => {
    await handleAddCombatant({
      name: data.name,
      initiative: data.initiative,
      hp: data.hpMax,
      maxHp: data.hpMax,
      hpCurrent: data.hpMax,
      hpMax: data.hpMax,
      tempHp: data.hpTemp,
      hpTemp: data.hpTemp,
      ac: data.ac,
      armorClass: data.ac,
      role: data.type === 'player' ? 'Player' : data.type === 'ally' ? 'Ally' : data.type === 'boss' ? 'Boss' : 'Monster',
      type: data.type,
      customRoleLabel: data.customRoleLabel,
      conditions: [],
      maskStats: data.maskStats,
      fogOfWar: data.maskStats,
      isReserve: data.isReserve,
      hidden: data.isReserve,
      isSecret: data.isReserve,
    });
    setIsAddModalOpen(false);
  };

  /**
   * MUTEX WRITE LOCK: JOIN COMBAT FROM PERSISTENT MY ROSTER
   * Solves multi-client race conditions with write lock and fresh server snapshot
   */
  const handleJoinCombatFromRoster = async (member: RosterMember) => {
    await withSyncLock(async () => {
      const rollResult = executeDiceRoll({
        diceType: 'd20',
        count: 1,
        modifier: member.initiativeMod,
        sender: rollerIdentity,
        isDm,
        rollType: 'Straight roll',
        label: `Initiative (${member.name})`,
      });

      liveFeedSync.recordDiceRoll(rollResult, true);

      const memberType: CombatantType =
        member.role === 'PC'
          ? 'player'
          : member.role === 'Ally'
          ? 'ally'
          : member.role === 'Monster'
          ? 'monster'
          : member.role === 'Boss'
          ? 'boss'
          : 'custom';

      const memberRoleStr =
        member.role === 'PC'
          ? 'Player'
          : member.role === 'Ally'
          ? 'Ally'
          : member.role === 'Monster'
          ? 'Monster'
          : member.role === 'Boss'
          ? 'Boss'
          : 'Custom';

      // 1. Fetch fresh server snapshot
      let currentRoster: Combatant[] = localCombatantsRef.current;
      let activeEpoch = encounterIdRef.current;

      if (OBR.isReady) {
        try {
          const meta = await OBR.room.getMetadata();
          const rosterPayload = meta[ROSTER_METADATA_KEY] as RosterMetadataPayload | undefined;
          if (rosterPayload && Array.isArray(rosterPayload.combatants)) {
            currentRoster = rosterPayload.combatants;
            activeEpoch = rosterPayload.encounterId || activeEpoch;
          }
        } catch (err) {
          console.warn('Could not fetch server snapshot before join combat:', err);
        }
      }

      // Check if character already active in combat (by rosterId or matching name)
      const existingIdx = currentRoster.findIndex(
        (c) =>
          (c.rosterId && c.rosterId === member.id) ||
          c.name.toLowerCase().trim() === member.name.toLowerCase().trim()
      );

      const uniqueId =
        existingIdx !== -1
          ? currentRoster[existingIdx].id
          : typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `c_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const newCombatant: Combatant = {
        id: uniqueId,
        rosterId: member.id,
        encounterId: activeEpoch,
        name: member.name,
        role: memberRoleStr,
        type: memberType,
        ac: member.ac,
        armorClass: member.ac,
        hp: member.maxHp,
        maxHp: member.maxHp,
        hpCurrent: member.maxHp,
        hpMax: member.maxHp,
        tempHp: 0,
        hpTemp: 0,
        initiative: rollResult.total,
        conditions: [],
        hidden: false,
        maskStats: isDm && (member.role === 'Monster' || member.role === 'Boss'),
        isReserve: false,
        sortOrder: currentRoster.length,
        updatedAt: Date.now(),
      };

      let nextRoster: Combatant[];
      if (existingIdx !== -1) {
        nextRoster = currentRoster.map((c, i) => (i === existingIdx ? newCombatant : c));
      } else {
        nextRoster = [...currentRoster, newCombatant];
      }

      const sortedList = sortInitiativeStrictDescending(nextRoster);
      setCombatants(sortedList);
      localCombatantsRef.current = sortedList;
      recentlyAddedIdsRef.current.set(newCombatant.id, Date.now() + 8000);

      try {
        localStorage.setItem('ttrpg_combatants', JSON.stringify(sortedList));
      } catch {}

      let targetActiveId = activeCombatantId;
      let targetActiveIdx = activeTurnIndex;
      if (currentRoster.length === 0) {
        targetActiveId = newCombatant.id;
        targetActiveIdx = 0;
        setActiveCombatantId(newCombatant.id);
        setActiveTurnIndex(0);
      } else if (activeCombatantId) {
        const found = sortedList.findIndex((c) => c.id === activeCombatantId);
        if (found !== -1) targetActiveIdx = found;
        setActiveTurnIndex(targetActiveIdx);
      }

      await broadcastFeedLog(
        `⚔️ ${newCombatant.name} joined combat! (Init ${newCombatant.initiative}, ${newCombatant.hpMax} HP, ${newCombatant.ac} AC).`,
        false
      );

      // Write partitioned roster
      await broadcastRoster(sortedList);
      if (currentRoster.length === 0) {
        await broadcastTurn(0, round, newCombatant.id);
      }
    });
  };

  /**
   * MUTEX WRITE LOCK: EXIT COMBAT ROSTER ACTION
   * Removes character from table tracker without touching local ashtapor_my_roster in localStorage.
   */
  const handleExitCombatFromRoster = async (rosterMemberId: string) => {
    await withSyncLock(async () => {
      // 1. Fetch fresh server snapshot
      let currentRoster: Combatant[] = localCombatantsRef.current;
      let activeEpoch = encounterIdRef.current;

      if (OBR.isReady) {
        try {
          const meta = await OBR.room.getMetadata();
          const rosterPayload = meta[ROSTER_METADATA_KEY] as RosterMetadataPayload | undefined;
          if (rosterPayload && Array.isArray(rosterPayload.combatants)) {
            currentRoster = rosterPayload.combatants;
            activeEpoch = rosterPayload.encounterId || activeEpoch;
          }
        } catch (err) {
          console.warn('Could not fetch server snapshot before exit combat:', err);
        }
      }

      // Read local roster to get character name
      const localRosterSaved: RosterMember[] = (() => {
        try {
          const s = localStorage.getItem('ashtapor_my_roster');
          return s ? JSON.parse(s) : [];
        } catch {
          return [];
        }
      })();
      const targetMember = localRosterSaved.find((m) => m.id === rosterMemberId);
      const targetName = targetMember ? targetMember.name.toLowerCase().trim() : '';

      const targetCombatant = currentRoster.find(
        (c) =>
          (c.rosterId && c.rosterId === rosterMemberId) ||
          (targetName && c.name.toLowerCase().trim() === targetName)
      );

      if (!targetCombatant) return;

      const removedName = targetCombatant.name;
      deletionTombstones.current.set(targetCombatant.id, Date.now() + 15000);

      const remainingCombatants = currentRoster.filter((c) => c.id !== targetCombatant.id);
      const sortedRemaining = sortInitiativeStrictDescending(remainingCombatants);

      setCombatants(sortedRemaining);
      localCombatantsRef.current = sortedRemaining;
      try {
        localStorage.setItem('ttrpg_combatants', JSON.stringify(sortedRemaining));
      } catch {}

      // Adjust active turn index if needed
      let nextActiveId = activeCombatantId;
      let nextActiveIdx = activeTurnIndex;
      if (activeCombatantId === targetCombatant.id) {
        const candidate = sortedRemaining[activeTurnIndex] || sortedRemaining[0] || null;
        nextActiveId = candidate ? candidate.id : null;
        nextActiveIdx = candidate ? sortedRemaining.findIndex((c) => c.id === candidate.id) : 0;
        setActiveCombatantId(nextActiveId);
        setActiveTurnIndex(nextActiveIdx);
      } else if (activeCombatantId) {
        const found = sortedRemaining.findIndex((c) => c.id === activeCombatantId);
        nextActiveIdx = found !== -1 ? found : 0;
        setActiveTurnIndex(nextActiveIdx);
      }

      // Log: "{character.name} left the combat."
      await broadcastFeedLog(`${removedName} left the combat.`, false);

      // Write partitioned roster
      await broadcastRoster(sortedRemaining);
      await broadcastTurn(nextActiveIdx, round, nextActiveId);
    });
  };

  // SYNC ROSTER MEMBER EDIT TO ACTIVE TABLE TRACKER
  const handleSyncRosterMemberStats = async (member: RosterMember) => {
    const matching = combatants.find(
      (c) =>
        (c.rosterId && c.rosterId === member.id) ||
        c.name.toLowerCase().trim() === member.name.toLowerCase().trim()
    );
    if (!matching) return;

    const newMax = member.maxHp;
    const newAc = member.ac;
    const updated = combatants.map((c) => {
      if (c.id === matching.id) {
        const newHp = Math.min(c.hpCurrent ?? c.hp ?? newMax, newMax);
        return {
          ...c,
          ac: newAc,
          armorClass: newAc,
          maxHp: newMax,
          hpMax: newMax,
          hpCurrent: newHp,
          hp: newHp,
          updatedAt: Date.now(),
        };
      }
      return c;
    });

    setCombatants(updated);
    localCombatantsRef.current = updated;
    await broadcastRoster(updated);
    await broadcastFeedLog(
      `🔄 Synced ${member.name} from roster (AC ${newAc}, Max HP ${newMax}).`,
      false
    );
  };

  const visibleCombatants = combatants.filter(
    (c) => isDm || (!c.isReserve && !c.hidden && !c.isSecret)
  );

  const activeCombatant =
    combatants.find((c) => c.id === activeCombatantId) || combatants[activeTurnIndex];
  const activeTurnName = activeCombatant ? activeCombatant.name : 'None';

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[#0b0f17] select-none relative rounded-lg border border-slate-800">
      {/* FLOATING TURN ALERT BANNER */}
      {playerTurnAlert && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs shadow-xl flex items-center gap-1.5 animate-fadeIn">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>{playerTurnAlert}</span>
        </div>
      )}

      {/* 1. HEADER ROW: Round Counter, Active Turn Name, Chime Bell, Nav Buttons */}
      <div className="h-11 px-2.5 bg-slate-950/95 border-b border-slate-800 flex items-center justify-between shrink-0 gap-2 rounded-t-lg">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 rounded bg-amber-950/90 border border-amber-500/60 text-amber-300 font-mono font-bold text-[11px] shrink-0">
            Round {round}
          </span>

          <div className="truncate text-xs font-medium text-slate-300 flex items-center gap-1">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Turn:</span>
            <span
              className="font-semibold text-amber-300 truncate max-w-[110px]"
              title={activeTurnName}
            >
              {activeTurnName}
            </span>
          </div>

          {/* Web Audio Turn Chime Speaker Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsTurnChimeEnabled((prev) => {
                const next = !prev;
                try {
                  localStorage.setItem('ashtapor_turn_chime', next ? 'true' : 'false');
                } catch {}
                return next;
              });
            }}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            title={isTurnChimeEnabled ? 'Turn Chime: On (Web Audio bell)' : 'Turn Chime: Off (Muted)'}
            aria-label="Toggle Turn Chime"
          >
            {isTurnChimeEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-600" />
            )}
          </button>
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
            disabled={combatants.length === 0 || isTurnUpdating}
            className="h-7 w-7 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition disabled:opacity-40 cursor-pointer"
            title="Previous Turn"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleNextTurn}
            disabled={combatants.length === 0 || isTurnUpdating}
            className="h-7 px-2.5 text-xs font-bold rounded bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1 transition shadow cursor-pointer disabled:opacity-40"
            title="Advance to Next Turn (Cycles and increments round when last turn ends)"
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

      {/* PERSISTENT MY ROSTER DRAWER (Local & Survives Encounter Reset) */}
      <div className="px-2 pt-2 shrink-0">
        <MyRosterDrawer
          activeCombatantNames={combatants.map((c) => c.name)}
          activeCombatants={combatants}
          onJoinCombat={handleJoinCombatFromRoster}
          onExitCombat={handleExitCombatFromRoster}
          isDm={isDm}
          playerName={playerName}
          onUpdateActiveCombatantStats={handleSyncRosterMemberStats}
          isSyncing={isSyncing}
        />
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
              onClick={() => setIsAddModalOpen(true)}
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

            return (
              <CombatantRow
                key={c.id}
                combatant={c}
                index={index}
                totalVisible={visibleCombatants.length}
                isActive={isActive}
                isDm={isDm}
                playerName={playerName}
                isActionMenuOpen={actionMenuCombatantId === c.id}
                onToggleActionMenu={(combatantId) => {
                  if (actionMenuCombatantId === combatantId) {
                    setActionMenuCombatantId(null);
                    setEditingCombatantId(null);
                  } else {
                    setActionMenuCombatantId(combatantId);
                    setEditingCombatantId(null);
                    setConditionInput('');
                    setConditionTiming('none');
                    setConditionIsSecret(false);
                  }
                }}
                onRollInitiative={handleRollInitiative}
                onMoveCombatant={handleMoveCombatant}
                onHpDelta={handleHpDelta}
                onUpdateMaxHp={handleUpdateMaxHp}
                onUpdateDeathSaves={handleUpdateDeathSaves}
                onUpdateCombatant={handleUpdateCombatant}
                onDuplicateCombatant={handleDuplicateCombatant}
                onDeployCombatant={handleDeployCombatant}
                onDeleteCombatant={handleDeleteCombatant}
                onRemoveCondition={handleRemoveCondition}
                concentrationAlert={concentrationAlerts[c.id]}
                inlineThpId={inlineThpId}
                setInlineThpId={setInlineThpId}
                inlineThpVal={inlineThpVal}
                setInlineThpVal={setInlineThpVal}
                onSaveInlineThp={handleSaveInlineThp}
              />
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

            {!isCombatFeedExpanded && (() => {
              const visibleEvent = [...combatFeedItems].reverse().find(
                (evt) => isDm || (!evt.isSecret && evt.playerMessage !== undefined)
              );
              if (!visibleEvent) return null;
              const isSecret = visibleEvent.isSecretRoll || visibleEvent.rollDetails?.visibility === 'gm_only';
              const currentUserId = liveFeedSync.getPlayerId();
              const isRoller = (visibleEvent.rollerId && visibleEvent.rollerId === currentUserId) || visibleEvent.sender === rollerIdentity;
              const isAuthorized = isDm || isRoller;
              const previewMsg = (isSecret && !isAuthorized)
                ? `${visibleEvent.rollerName || visibleEvent.sender} made a secret roll to the DM 🔒`
                : (!isDm && visibleEvent.playerMessage ? visibleEvent.playerMessage : visibleEvent.message);

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
                if (!isDm && (evt.isSecret || evt.playerMessage === undefined)) {
                  return null;
                }
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

      {/* 4. FOOTER CONTROLS: Add Combatant & Reset */}
      <div className="h-10 px-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
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
      <AddCombatantModal
        isOpen={isAddModalOpen}
        isDm={isDm}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddCombatantFromModal}
      />

      {/* SMART COMBAT RESET MODAL (Clear Hostiles Only vs Full Clear with new epoch) */}
      <ResetCombatModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onClearHostilesOnly={handleClearHostilesOnly}
        onFullClear={handleFullClearCombat}
        combatants={combatants}
        encounterId={encounterId}
      />

      {/* MODAL: COMBATANT ACTION / CONDITION POPUP */}
      {actionMenuCombatantId && (() => {
        const menuCombatant = combatants.find((c) => c.id === actionMenuCombatantId);
        if (!menuCombatant) return null;
        const isPlayerOrAlly =
          menuCombatant.type === 'player' ||
          menuCombatant.type === 'ally' ||
          menuCombatant.role === 'PC' ||
          menuCombatant.role === 'Player' ||
          menuCombatant.role === 'Ally';
        const canEdit = isDm || isPlayerOrAlly;
        const isEditing = editingCombatantId === menuCombatant.id;

        return (
          <>
            <div
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-[2px]"
              onClick={() => {
                setActionMenuCombatantId(null);
                setEditingCombatantId(null);
              }}
            />

            <div className="fixed inset-x-4 top-16 z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl p-3 max-h-[75vh] overflow-y-auto space-y-2.5 text-xs animate-fadeIn">
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

              {/* Duplicate Minion Button in Action Menu */}
              <div className="flex items-center gap-2 pb-1 border-b border-neutral-800">
                <button
                  type="button"
                  onClick={() => handleDuplicateCombatant(menuCombatant.id)}
                  className="flex-1 py-1 px-2 text-xs font-semibold rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-amber-400 text-amber-300 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                  title="Create an exact duplicate minion with auto-incremented name"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Duplicate Combatant</span>
                </button>

                {isDm && (menuCombatant.isReserve || menuCombatant.hidden) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDeployCombatant(menuCombatant.id);
                      setActionMenuCombatantId(null);
                    }}
                    className="py-1 px-2.5 text-xs font-bold rounded bg-purple-900 hover:bg-purple-800 border border-purple-600 text-purple-200 flex items-center gap-1 transition cursor-pointer"
                    title="Deploy reserve combatant to player view"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Deploy</span>
                  </button>
                )}
              </div>

              {/* Custom Condition Open Input with Timing Badges */}
              {canEdit && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Add Condition &amp; Timing Reminder
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

                    {/* Timing Selector: None | Start | End */}
                    <div className="flex items-center rounded border border-neutral-700 bg-neutral-950 p-0.5 text-[9px] font-bold shrink-0">
                      <button
                        type="button"
                        onClick={() => setConditionTiming('none')}
                        className={`px-1.5 py-0.5 rounded transition ${
                          conditionTiming === 'none'
                            ? 'bg-neutral-800 text-slate-200'
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                        title="No timing reminder"
                      >
                        None
                      </button>
                      <button
                        type="button"
                        onClick={() => setConditionTiming('start')}
                        className={`px-1.5 py-0.5 rounded transition ${
                          conditionTiming === 'start'
                            ? 'bg-amber-400 text-neutral-950 font-bold'
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                        title="Alert GM at Turn Start"
                      >
                        ⏱ Start
                      </button>
                      <button
                        type="button"
                        onClick={() => setConditionTiming('end')}
                        className={`px-1.5 py-0.5 rounded transition ${
                          conditionTiming === 'end'
                            ? 'bg-sky-400 text-neutral-950 font-bold'
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                        title="Alert GM at Turn End"
                      >
                        ⏱ End
                      </button>
                    </div>

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
                              {cond.timing && cond.timing !== 'none' && (
                                <span className="font-mono text-[8px] opacity-90 px-1 py-0.1 rounded bg-black/40 border border-white/10 ml-0.5">
                                  ⏱ {cond.timing === 'start' ? 'Start' : 'End'}
                                </span>
                              )}
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
                        className="w-full px-1.5 py-0.5 text-xs font-mono rounded bg-neutral-950 border border-neutral-700 text-amber-300 text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">AC</span>
                      <input
                        type="number"
                        value={editAc}
                        onChange={(e) => setEditAc(parseInt(e.target.value, 10) || 10)}
                        className="w-full px-1.5 py-0.5 text-xs font-mono rounded bg-neutral-950 border border-neutral-700 text-slate-200 text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Max HP</span>
                      <input
                        type="number"
                        value={editHpMax}
                        onChange={(e) => setEditHpMax(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-1.5 py-0.5 text-xs font-mono rounded bg-neutral-950 border border-neutral-700 text-slate-200 text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Temp HP</span>
                      <input
                        type="number"
                        value={editTempHp}
                        onChange={(e) => setEditTempHp(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-1.5 py-0.5 text-xs font-mono rounded bg-neutral-950 border border-neutral-700 text-cyan-300 text-center"
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

export default CombatTracker;
