/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import OBR from '@owlbear-rodeo/sdk';
import {
  DiceRollResult,
  DieType,
  RollTypeCategory,
  RollVisibility,
  RollDisplayMode,
  DieGroupRoll,
  PairedD20Roll,
  RollInstance,
} from '../types/ttrpg';

export type FeedEventType = 'dice' | 'turn' | 'combat' | 'chat';

export interface UnifiedFeedItem {
  id: string;
  type: FeedEventType;
  sender: string;
  rollerName?: string;
  rollerId?: string;
  isDm?: boolean;
  message: string;
  playerMessage?: string;
  isSecretRoll?: boolean;
  isSecret?: boolean;
  secretSender?: string;
  timestamp: number;
  rollDetails?: {
    id?: string;
    rollerName?: string;
    rollerId?: string;
    visibility: 'public' | 'gm_only' | 'self';
    formula: string;
    breakdown: string[];
    total?: number;
    timestamp?: number;
    rolls?: number[];
    rawRolls?: number[];
    pairedRolls?: PairedD20Roll[];
    diceType?: DieType;
    count?: number;
    modifier?: number;
    advantageMode?: 'normal' | 'advantage' | 'disadvantage';
    isCrit?: boolean;
    isFumble?: boolean;
    rollType?: RollTypeCategory;
    isSecret?: boolean;
    label?: string;
    displayMode?: RollDisplayMode;
    poolBreakdown?: DieGroupRoll[];
    individualSummary?: string;
    individualLineItems?: string[];
    instances?: RollInstance[];
    macroName?: string;
  };
}

export const FEED_EVENT_KEY = 'ashtapor/feed_event';
export const FEED_BUFFER_KEY = 'ashtapor/recent_feed';
const MAX_BUFFER_BYTES = 3000;

type FeedListener = (items: UnifiedFeedItem[], newItem?: UnifiedFeedItem) => void;

function formatFormula(count: number, die: string, mod: number): string {
  const modStr = mod > 0 ? `+${mod}` : mod < 0 ? `${mod}` : '';
  return `${count}${die}${modStr}`;
}

/**
 * Calculates exact UTF-8 byte length of any JSON-serializable object.
 */
function getByteLength(val: any): number {
  try {
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str).length;
    }
    return encodeURI(str).split(/%..|./).length - 1;
  } catch {
    return 3000;
  }
}

/**
 * Strips all undefined and null values from an object tree
 * to prevent Owlbear's host transformLoadingValues from throwing.
 */
function sanitizeMetadataPayload<T>(obj: T): T {
  if (obj === null || obj === undefined) return undefined as any;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeMetadataPayload(item)) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj as Record<string, any>)) {
      if (val !== undefined && val !== null) {
        cleaned[key] = typeof val === 'object' ? sanitizeMetadataPayload(val) : val;
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Compresses roll objects before broadcasting to ensure minimum byte footprint.
 */
function slimFeedItemForBroadcast(item: UnifiedFeedItem): UnifiedFeedItem {
  const sanitized = sanitizeMetadataPayload(item);
  if (!sanitized || !sanitized.rollDetails) return sanitized;

  const rd = sanitized.rollDetails;
  const slimRollDetails: any = {
    id: rd.id,
    rollerName: rd.rollerName,
    rollerId: rd.rollerId,
    visibility: rd.visibility,
    formula: rd.formula,
    total: rd.total,
    timestamp: rd.timestamp,
    diceType: rd.diceType,
    count: rd.count,
    modifier: rd.modifier,
    advantageMode: rd.advantageMode,
    isCrit: rd.isCrit,
    isFumble: rd.isFumble,
    label: rd.label,
    displayMode: rd.displayMode,
    macroName: rd.macroName,
  };

  if (rd.poolBreakdown && Array.isArray(rd.poolBreakdown)) {
    slimRollDetails.poolBreakdown = rd.poolBreakdown.map((p: any) => ({
      dieType: p.dieType,
      rolls: p.rolls,
    }));
  }

  if (rd.breakdown && Array.isArray(rd.breakdown)) {
    slimRollDetails.breakdown = rd.breakdown.slice(0, 10);
  }

  if (rd.instances && Array.isArray(rd.instances)) {
    slimRollDetails.instances = rd.instances.slice(0, 10).map((inst: any) => ({
      index: inst.index,
      d20Chosen: inst.d20Chosen,
      d20Discarded: inst.d20Discarded,
      isCrit: inst.isCrit,
      isFumble: inst.isFumble,
      riders: inst.riders,
      modifier: inst.modifier,
      total: inst.total,
    }));
  }

  if (rd.rolls && Array.isArray(rd.rolls)) {
    slimRollDetails.rolls = rd.rolls.slice(0, 20);
  }

  return {
    id: sanitized.id,
    type: sanitized.type,
    sender: sanitized.sender,
    rollerName: sanitized.rollerName,
    rollerId: sanitized.rollerId,
    isDm: sanitized.isDm,
    message: sanitized.message,
    playerMessage: sanitized.playerMessage,
    isSecretRoll: sanitized.isSecretRoll,
    timestamp: sanitized.timestamp,
    rollDetails: slimRollDetails,
  };
}

class LiveFeedSyncManager {
  private items: UnifiedFeedItem[] = [];
  private listeners: Set<FeedListener> = new Set();
  private initialized = false;
  private currentName = 'Adventurer';
  private currentRoleIsGm = false;
  private currentId = '';
  private commitQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const saved = localStorage.getItem('ttrpg_ashtapor_feed');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.items = parsed;
        }
      }
    } catch {}

    if (this.items.length === 0) {
      this.items = [
        {
          id: 'init-1',
          type: 'turn',
          sender: 'Session Companion',
          message: '⚔️ Owlbear Rodeo Session connected. Table rolls and combat updates will sync in real time!',
          timestamp: Date.now(),
        },
      ];
    }

    if (typeof window !== 'undefined') {
      OBR.onReady(() => {
        OBR.player.getId().then((id) => {
          if (id) {
            this.currentId = id;
            try { localStorage.setItem('ashtapor_player_id', id); } catch {}
          }
        }).catch(() => {});
        OBR.player.getName().then((n) => {
          if (n) this.currentName = n;
        }).catch(() => {});
        OBR.player.getRole().then((r) => {
          this.currentRoleIsGm = r === 'GM';
        }).catch(() => {});

        OBR.player.onChange((player) => {
          if (player.id) this.currentId = player.id;
          if (player.name) this.currentName = player.name;
          if (player.role) this.currentRoleIsGm = player.role === 'GM';
        });

        // 1. Initial mount rehydration from room buffer
        OBR.room.getMetadata().then((metadata) => {
          if (!metadata) return;
          const buffer = metadata[FEED_BUFFER_KEY];
          if (Array.isArray(buffer)) {
            this.handleIncomingItems(buffer);
          }
        }).catch(() => {});

        // 2. Real-time room metadata listener
        OBR.room.onMetadataChange((metadata) => {
          if (!metadata) return;

          const buffer = metadata[FEED_BUFFER_KEY];
          if (Array.isArray(buffer)) {
            this.handleIncomingItems(buffer);
            return;
          }

          const feedPayload = metadata[FEED_EVENT_KEY] as any;
          if (feedPayload) {
            let incomingItem: UnifiedFeedItem | undefined;
            if (feedPayload.item) {
              incomingItem = feedPayload.item;
            } else if (feedPayload.id && feedPayload.type) {
              incomingItem = feedPayload as UnifiedFeedItem;
            }

            if (incomingItem && incomingItem.id) {
              this.handleIncomingItems([incomingItem]);
            }
          }
        });
      });
    }
  }

  public setIdentity(name: string, isGm: boolean, id?: string) {
    this.currentName = name;
    this.currentRoleIsGm = isGm;
    if (id) {
      this.currentId = id;
      try {
        localStorage.setItem('ashtapor_player_id', id);
      } catch {}
    }
  }

  public getPlayerId(): string {
    if (this.currentId) return this.currentId;
    try {
      const saved = localStorage.getItem('ashtapor_player_id');
      if (saved) {
        this.currentId = saved;
        return saved;
      }
      const gen = `player-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      localStorage.setItem('ashtapor_player_id', gen);
      this.currentId = gen;
      return gen;
    } catch {
      return 'local-player';
    }
  }

  public getPlayerName(): string {
    return this.currentName;
  }

  public getIsGm(): boolean {
    return this.currentRoleIsGm;
  }

  private handleIncomingItems(incoming: UnifiedFeedItem[]) {
    let addedAny = false;

    for (const item of incoming) {
      if (!item || !item.id) continue;
      if (this.items.some((it) => it.id === item.id)) continue;

      const visibility = item.rollDetails?.visibility || (item.isSecretRoll ? 'gm_only' : 'public');
      const rollerId = item.rollerId || item.rollDetails?.rollerId;
      const isRoller = (rollerId && rollerId === this.getPlayerId()) || item.sender === this.currentName;

      if (visibility === 'self' && !isRoller) {
        continue;
      }

      this.items.push(item);
      addedAny = true;
    }

    if (addedAny) {
      this.items.sort((a, b) => a.timestamp - b.timestamp);
      if (this.items.length > 100) {
        this.items = this.items.slice(this.items.length - 100);
      }
      this.persistFeed();
      this.notifyListeners();
    }
  }

  private persistFeed() {
    try {
      localStorage.setItem('ttrpg_ashtapor_feed', JSON.stringify(this.items.slice(-60)));
    } catch {}
  }

  private notifyListeners(newItem?: UnifiedFeedItem) {
    this.listeners.forEach((listener) => {
      try {
        listener([...this.items], newItem);
      } catch (e) {
        console.error('Feed listener error:', e);
      }
    });
  }

  public subscribe(listener: FeedListener): () => void {
    this.listeners.add(listener);
    listener([...this.items]);
    return () => this.listeners.delete(listener);
  }

  public getFeed(): UnifiedFeedItem[] {
    return [...this.items];
  }

  public async clearFeed(): Promise<void> {
    this.items = [];
    this.persistFeed();
    this.notifyListeners();

    if (this.currentRoleIsGm && typeof OBR !== 'undefined' && OBR.isReady) {
      try {
        await OBR.room.setMetadata({
          [FEED_BUFFER_KEY]: [],
          [FEED_EVENT_KEY]: undefined,
        });
      } catch (e) {
        console.warn('Could not clear room feed buffer:', e);
      }
    }
  }

  private async broadcastFeedItem(item: UnifiedFeedItem) {
    this.commitQueue = this.commitQueue.then(async () => {
      try {
        if (typeof OBR !== 'undefined' && OBR.isReady) {
          const meta = await OBR.room.getMetadata();
          const existingBuffer: UnifiedFeedItem[] = Array.isArray(meta[FEED_BUFFER_KEY])
            ? meta[FEED_BUFFER_KEY]
            : [];

          const deduped = existingBuffer.filter((it) => it && it.id !== item.id);
          const slimItem = slimFeedItemForBroadcast(item);
          const nextBuffer = [...deduped, slimItem];

          // STRICT BYTE-SIZE AUTO-PURGE:
          // Keep discarding oldest entries until total payload is strictly <= 3,000 bytes
          while (nextBuffer.length > 1 && getByteLength(nextBuffer) > MAX_BUFFER_BYTES) {
            nextBuffer.shift();
          }

          await OBR.room.setMetadata({
            [FEED_BUFFER_KEY]: nextBuffer,
            [FEED_EVENT_KEY]: {
              item: slimItem,
              timestamp: Date.now(),
            },
          });
        }
      } catch (e) {
        console.warn('Could not broadcast feed buffer to OBR room:', e);
      }
    });
  }

  public recordDiceRoll(roll: DiceRollResult, broadcast: boolean = true) {
    const rawVis = roll.visibility || (roll.isSecret ? 'gm_only' : 'public');
    const visibility: 'public' | 'gm_only' | 'self' =
      rawVis === 'dm' || rawVis === 'gm_only'
        ? 'gm_only'
        : rawVis === 'self'
        ? 'self'
        : 'public';
    const isSecretRoll = visibility === 'gm_only';
    const isSelfRoll = visibility === 'self';

    const rollerId = roll.rollerId || this.getPlayerId();
    const rollerName = roll.rollerName || roll.sender || this.currentName;

    const formula = roll.formula || formatFormula(roll.count, roll.diceType, roll.modifier);
    const isCrit = roll.isCrit || (roll.diceType === 'd20' && roll.rolls.includes(20));
    const isFumble = roll.isFumble || (roll.diceType === 'd20' && roll.rolls.includes(1));

    const isIndividual = roll.displayMode === 'individual';
    const pairedSummary =
      roll.pairedRolls && roll.pairedRolls.length > 0
        ? roll.pairedRolls.map((p) => p.lineItem || `[${p.selected}, ~~${p.discarded}~~]`).join(' | ')
        : '';

    let outcomeSuffix = '';
    if (isCrit) outcomeSuffix = ' 🌟 NATURAL 20 CRITICAL!';
    if (isFumble) outcomeSuffix = ' 💀 CRITICAL FUMBLE (NAT 1)!';

    let message = '';
    if (isIndividual && roll.individualSummary) {
      message = `🎲 ${roll.label ? `${roll.label}: ` : ''}${roll.individualSummary}${outcomeSuffix}`;
    } else if (pairedSummary && roll.count > 1) {
      message = `🎲 ${roll.label ? `${roll.label}: ` : ''}${formula} ➔ ${roll.total} (${pairedSummary})${outcomeSuffix}`;
    } else {
      message = `🎲 ${roll.label ? `${roll.label}: ` : ''}${formula} ➔ ${roll.total}${outcomeSuffix}`;
    }

    const breakdown: string[] =
      roll.breakdown && roll.breakdown.length > 0
        ? roll.breakdown
        : roll.individualLineItems && roll.individualLineItems.length > 0
        ? roll.individualLineItems
        : roll.pairedRolls && roll.pairedRolls.length > 0
        ? roll.pairedRolls.map((p) => p.lineItem || `[${p.selected}, ~~${p.discarded}~~]`)
        : roll.rolls.map((r) => String(r));

    const total = isIndividual ? undefined : roll.total;

    const playerMessage = isSecretRoll
      ? `${rollerName} made a secret roll to the DM 🔒`
      : message;

    const feedItem: UnifiedFeedItem = {
      id: roll.id || `roll-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'dice',
      sender: rollerName,
      rollerName,
      rollerId,
      isDm: !!roll.isDm,
      message,
      playerMessage,
      isSecretRoll,
      timestamp: roll.timestamp || Date.now(),
      rollDetails: {
        id: roll.id || `roll-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        rollerName,
        rollerId,
        visibility,
        formula,
        breakdown,
        total,
        timestamp: roll.timestamp || Date.now(),
        rolls: roll.rolls,
        rawRolls: roll.rawRolls,
        pairedRolls: roll.pairedRolls,
        diceType: roll.diceType,
        count: roll.count,
        modifier: roll.modifier,
        advantageMode: roll.advantageMode,
        isCrit,
        isFumble,
        rollType: roll.rollType,
        isSecret: isSecretRoll,
        label: roll.label,
        displayMode: roll.displayMode,
        poolBreakdown: roll.poolBreakdown,
        individualSummary: roll.individualSummary,
        individualLineItems: roll.individualLineItems,
        instances: roll.instances,
        macroName: roll.macroName,
      },
    };

    this.items.push(feedItem);
    if (this.items.length > 100) this.items = this.items.slice(this.items.length - 100);
    this.persistFeed();
    this.notifyListeners(feedItem);

    if (broadcast && !isSelfRoll) {
      this.broadcastFeedItem(feedItem);
    }
  }

  public recordCombatLog(
    dmMessage: string,
    broadcast: boolean = true,
    playerMessage?: string,
    isSecret?: boolean
  ) {
    const feedItem: UnifiedFeedItem = {
      id: `combat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'combat',
      sender: this.currentRoleIsGm ? 'Game Master' : this.currentName,
      isDm: this.currentRoleIsGm,
      message: dmMessage,
      playerMessage: isSecret ? undefined : (playerMessage !== undefined ? playerMessage : dmMessage),
      isSecret: !!isSecret,
      timestamp: Date.now(),
    };

    this.items.push(feedItem);
    if (this.items.length > 100) this.items = this.items.slice(this.items.length - 100);
    this.persistFeed();
    this.notifyListeners(feedItem);

    if (broadcast) {
      this.broadcastFeedItem(feedItem);
    }
  }

  public recordTurnAnnouncement(announcement: string, broadcast: boolean = true) {
    const feedItem: UnifiedFeedItem = {
      id: `turn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'turn',
      sender: 'Initiative Tracker',
      isDm: true,
      message: announcement,
      timestamp: Date.now(),
    };

    this.items.push(feedItem);
    if (this.items.length > 100) this.items = this.items.slice(this.items.length - 100);
    this.persistFeed();
    this.notifyListeners(feedItem);

    try {
      if (typeof OBR !== 'undefined' && OBR.isReady) {
        OBR.notification.show(announcement, 'INFO').catch(() => {});
      }
    } catch {}

    if (broadcast) {
      this.broadcastFeedItem(feedItem);
    }
  }

  public recordChat(sender: string, isDm: boolean, message: string, broadcast: boolean = true) {
    const feedItem: UnifiedFeedItem = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'chat',
      sender,
      isDm,
      message,
      timestamp: Date.now(),
    };

    this.items.push(feedItem);
    if (this.items.length > 100) this.items = this.items.slice(this.items.length - 100);
    this.persistFeed();
    this.notifyListeners(feedItem);

    if (broadcast) {
      this.broadcastFeedItem(feedItem);
    }
  }
}

export const liveFeedSync = new LiveFeedSyncManager();
