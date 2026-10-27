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

type FeedListener = (items: UnifiedFeedItem[], newItem?: UnifiedFeedItem) => void;

function formatFormula(count: number, die: string, mod: number): string {
  const modStr = mod > 0 ? `+${mod}` : mod < 0 ? `${mod}` : '';
  return `${count}${die}${modStr}`;
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

class LiveFeedSyncManager {
  private items: UnifiedFeedItem[] = [];
  private listeners: Set<FeedListener> = new Set();
  private initialized = false;
  private currentName = 'Adventurer';
  private currentRoleIsGm = false;
  private currentId = '';

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

        // Listen for live room events (supports both clean object structure and legacy string fallback)
        OBR.room.onMetadataChange((metadata) => {
          const feedPayload = metadata[FEED_EVENT_KEY] as any;
          if (!feedPayload) return;

          let incomingItem: UnifiedFeedItem | undefined;
          if (typeof feedPayload.raw === 'string') {
            try {
              incomingItem = JSON.parse(feedPayload.raw);
            } catch (err) {
              console.warn('Could not parse legacy feed event JSON:', err);
            }
          } else if (feedPayload.item) {
            incomingItem = feedPayload.item;
          } else if (feedPayload.id && feedPayload.type) {
            incomingItem = feedPayload as UnifiedFeedItem;
          }

          if (incomingItem && incomingItem.id) {
            this.handleIncomingItem(incomingItem);
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

  private handleIncomingItem(item: UnifiedFeedItem) {
    if (this.items.some((it) => it.id === item.id)) return;

    const visibility = item.rollDetails?.visibility || (item.isSecretRoll ? 'gm_only' : 'public');
    const rollerId = item.rollerId || item.rollDetails?.rollerId;
    const isRoller = (rollerId && rollerId === this.getPlayerId()) || item.sender === this.currentName;

    if (visibility === 'self' && !isRoller) {
      return;
    }

    this.items.push(item);
    if (this.items.length > 100) {
      this.items = this.items.slice(this.items.length - 100);
    }
    this.persistFeed();
    this.notifyListeners(item);
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
  }

  private async broadcastFeedItem(item: UnifiedFeedItem) {
    try {
      if (typeof OBR !== 'undefined' && OBR.isReady) {
        const sanitizedItem = sanitizeMetadataPayload(item);
        await OBR.room.setMetadata({
          [FEED_EVENT_KEY]: {
            item: sanitizedItem,
            timestamp: Date.now(),
          },
        });
      }
    } catch (e) {
      console.warn('Could not broadcast feed item to OBR room:', e);
    }
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
