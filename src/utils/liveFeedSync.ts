import { roomSync, RoomMessage } from './roomSync';
import {
  DiceRollResult,
  DieType,
  RollTypeCategory,
  RollVisibility,
  RollDisplayMode,
  DieGroupRoll,
  PairedD20Roll,
} from '../types/ttrpg';

export type FeedEventType = 'dice' | 'turn' | 'combat' | 'chat';

export interface UnifiedFeedItem {
  id: string;
  type: FeedEventType;
  sender: string;
  isDm?: boolean;
  message: string;
  playerMessage?: string; // Obfuscated or generic message for player view (e.g. FoW damage or secret roll notices)
  isSecretRoll?: boolean;
  secretSender?: string;
  timestamp: number;
  rollDetails?: {
    formula: string;
    total: number;
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
    visibility?: RollVisibility;
    isSecret?: boolean;
    label?: string;
    displayMode?: RollDisplayMode;
    poolBreakdown?: DieGroupRoll[];
    individualSummary?: string;
    individualLineItems?: string[];
  };
}

type FeedListener = (items: UnifiedFeedItem[], newItem?: UnifiedFeedItem) => void;

const LEGACY_STORAGE_KEY = 'ttrpg_unified_live_feed';

function formatFormula(count: number, die: string, mod: number): string {
  const modStr = mod > 0 ? `+${mod}` : mod < 0 ? `${mod}` : '';
  return `${count}${die}${modStr}`;
}

class LiveFeedSyncManager {
  private items: UnifiedFeedItem[] = [];
  private listeners: Set<FeedListener> = new Set();
  private initialized = false;
  private clearedAt: number = 0;
  private currentRole: 'dm' | 'player' = 'dm';

  constructor() {
    this.init();
  }

  private getStorageKey(): string {
    return roomSync.getIsDm() ? 'ttrpg_unified_live_feed_dm' : 'ttrpg_unified_live_feed_player';
  }

  private getClearedKey(): string {
    return roomSync.getIsDm() ? 'ttrpg_live_feed_cleared_at_dm' : 'ttrpg_live_feed_cleared_at_player';
  }

  private init() {
    if (this.initialized) return;
    this.initialized = true;

    this.currentRole = roomSync.getIsDm() ? 'dm' : 'player';

    // Load cleared timestamp for this client/role
    try {
      const savedCleared =
        localStorage.getItem(this.getClearedKey()) ||
        sessionStorage.getItem(this.getClearedKey());
      if (savedCleared) {
        this.clearedAt = parseInt(savedCleared, 10) || 0;
      }
    } catch {}

    // Load persisted feed
    let hasSavedData = false;
    try {
      const key = this.getStorageKey();
      let saved = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (saved === null) {
        // Fallback to legacy key on first migration if available
        saved = localStorage.getItem(LEGACY_STORAGE_KEY);
      }
      if (saved !== null) {
        hasSavedData = true;
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.items = parsed;
        }
      }
    } catch {}

    const hasBeenCleared = this.clearedAt > 0;

    // Only populate initial welcome item if completely fresh and never cleared
    if (!hasSavedData && !hasBeenCleared && this.items.length === 0) {
      this.items = [
        {
          id: 'init-1',
          type: 'turn',
          sender: 'Campaign System',
          message: '⚔️ Session feed connected. Rolls, combat logs, and callouts will sync in real time!',
          timestamp: Date.now() - 30000,
        },
      ];
      try {
        localStorage.setItem(this.getStorageKey(), JSON.stringify(this.items));
      } catch {}
    }

    // Storage event listener for multi-tab sync strictly within the SAME role
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === this.getStorageKey()) {
        try {
          if (e.newValue) {
            const parsed = JSON.parse(e.newValue);
            if (Array.isArray(parsed)) {
              this.items = parsed;
              this.notifyListeners();
            }
          } else {
            this.items = [];
            this.notifyListeners();
          }
        } catch {}
      }
    });

    // Listen to local presence/role change to switch storage scope if role toggles locally
    roomSync.subscribePresence(() => {
      const newRole = roomSync.getIsDm() ? 'dm' : 'player';
      if (newRole !== this.currentRole) {
        this.currentRole = newRole;
        try {
          const savedCleared =
            localStorage.getItem(this.getClearedKey()) ||
            sessionStorage.getItem(this.getClearedKey());
          this.clearedAt = savedCleared ? parseInt(savedCleared, 10) || 0 : 0;
          const key = this.getStorageKey();
          let saved = localStorage.getItem(key) || sessionStorage.getItem(key);
          if (saved === null) {
            saved = localStorage.getItem(LEGACY_STORAGE_KEY);
          }
          if (saved !== null) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              this.items = parsed;
              this.notifyListeners();
            }
          }
        } catch {}
      }
    });

    // Subscribe to roomSync messages
    roomSync.subscribe((msg: RoomMessage) => {
      // NOTE: We intentionally DO NOT clear the feed on incoming FEED_CLEAR messages.
      // Clear Log is strictly localized to the local client's current session view.
      if (msg.type === 'FEED_CLEAR') {
        return;
      }

      // Initial state sync snapshot from DM host
      if (msg.type === 'INITIAL_STATE_SYNC' && msg.payload?.feed) {
        this.mergeIncomingSnapshot(msg.payload.feed);
        return;
      }

      // 1. Live Dice Roll from any peer or tab
      if (msg.type === 'DICE_ROLL' && msg.payload?.roll) {
        const roll: DiceRollResult = msg.payload.roll;
        if (roll.visibility === 'self') return; // Do not show self-only rolls to room

        // Avoid duplicate
        if (this.items.some((it) => it.id === roll.id || it.id === `dice-${roll.id}`)) return;

        const formula = roll.formula || formatFormula(roll.count, roll.diceType, roll.modifier);
        const isCrit = roll.isCrit || (roll.diceType === 'd20' && roll.rolls.includes(20));
        const isFumble = roll.isFumble || (roll.diceType === 'd20' && roll.rolls.includes(1));

        const isIndividual = roll.displayMode === 'individual';
        const pairedSummary =
          roll.pairedRolls && roll.pairedRolls.length > 0
            ? roll.pairedRolls
                .map((p) => `[${p.selected}, ~~${p.discarded}~~]`)
                .join(', ')
            : null;

        const msgText = isIndividual
          ? `rolled ${formula} (Individual: ${roll.individualSummary || pairedSummary || roll.rolls.map((r) => `[${r}]`).join(', ')})`
          : pairedSummary
          ? `rolled ${formula} for a total of ${roll.total}! (${pairedSummary})`
          : `rolled ${formula} for a total of ${roll.total}!`;

        const isSecret = roll.visibility === 'dm' || !!roll.isSecret;
        const senderName = roll.sender?.trim() || msg.senderName?.trim() || roomSync.getPeerName();
        const secretNotice = `${senderName} rolled a secret check to the DM.`;

        const newItem: UnifiedFeedItem = {
          id: roll.id || `dice-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'dice',
          sender: senderName,
          isDm: roll.isDm ?? msg.isDm,
          message: msgText,
          playerMessage: isSecret ? secretNotice : undefined,
          isSecretRoll: isSecret,
          secretSender: senderName,
          timestamp: roll.timestamp || msg.timestamp || Date.now(),
          rollDetails: {
            formula,
            total: roll.total,
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
            visibility: roll.visibility,
            isSecret,
            label: roll.label,
            displayMode: roll.displayMode || 'sum',
            poolBreakdown: roll.poolBreakdown,
            individualSummary: roll.individualSummary,
            individualLineItems: roll.individualLineItems,
          },
        };

        this.appendItem(newItem, false);
      }

      // 2. Combat Feed Event
      if (msg.type === 'COMBAT_FEED_EVENT' && msg.payload?.event) {
        const event: UnifiedFeedItem = msg.payload.event;
        if (this.items.some((it) => it.id === event.id)) return;
        this.appendItem(event, false);
      }

      // 3. Turn Announcement
      if (msg.type === 'COMBAT_TURN_ANNOUNCEMENT' && msg.payload?.announcement) {
        const announcement = msg.payload.announcement;
        const id = msg.payload.id || `turn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        if (this.items.some((it) => it.id === id)) return;

        const turnItem: UnifiedFeedItem = {
          id,
          type: 'turn',
          sender: 'Turn Herald',
          isDm: msg.isDm,
          message: announcement,
          timestamp: msg.timestamp || Date.now(),
        };

        this.appendItem(turnItem, false);
      }
    });
  }

  private notifyListeners(newItem?: UnifiedFeedItem) {
    this.listeners.forEach((listener) => {
      try {
        listener(this.items, newItem);
      } catch (err) {
        console.error('Feed listener error:', err);
      }
    });
  }

  public mergeIncomingSnapshot(snapshot: UnifiedFeedItem[]): void {
    if (!Array.isArray(snapshot) || snapshot.length === 0) return;

    const cutoff = this.clearedAt;
    const existingIds = new Set(this.items.map((it) => it.id));
    const toAdd = snapshot.filter((item) => {
      if (!item || !item.id) return false;
      if (existingIds.has(item.id)) return false;
      if (cutoff > 0 && item.timestamp && item.timestamp <= cutoff) return false;
      return true;
    });

    if (toAdd.length > 0) {
      this.items = [...this.items, ...toAdd]
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        .slice(-80);
      try {
        localStorage.setItem(this.getStorageKey(), JSON.stringify(this.items));
      } catch {}
      this.notifyListeners();
    }
  }

  private appendItem(item: UnifiedFeedItem, broadcast = false) {
    if (this.clearedAt > 0 && item.timestamp && item.timestamp < this.clearedAt) {
      return;
    }

    this.items = [...this.items.slice(-79), item];
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.items));
    } catch {}

    this.notifyListeners(item);

    // Broadcast if requested
    if (broadcast) {
      if (item.type === 'dice' && item.rollDetails) {
        const rollObj: DiceRollResult = {
          id: item.id,
          timestamp: item.timestamp,
          sender: item.sender,
          isDm: !!item.isDm,
          visibility: item.rollDetails.visibility || 'public',
          rollType: item.rollDetails.rollType,
          diceType: item.rollDetails.diceType || 'd20',
          count: item.rollDetails.count || 1,
          modifier: item.rollDetails.modifier || 0,
          rolls: item.rollDetails.rolls || [item.rollDetails.total],
          rawRolls: item.rollDetails.rawRolls,
          pairedRolls: item.rollDetails.pairedRolls,
          total: item.rollDetails.total,
          advantageMode: item.rollDetails.advantageMode || 'normal',
          isCrit: item.rollDetails.isCrit,
          isFumble: item.rollDetails.isFumble,
          label: item.rollDetails.label,
          displayMode: item.rollDetails.displayMode || 'sum',
          poolBreakdown: item.rollDetails.poolBreakdown,
          formula: item.rollDetails.formula,
          individualSummary: item.rollDetails.individualSummary,
          individualLineItems: item.rollDetails.individualLineItems,
        };
        roomSync.broadcast('DICE_ROLL', { roll: rollObj });
      } else if (item.type === 'turn') {
        roomSync.broadcast('COMBAT_TURN_ANNOUNCEMENT', {
          id: item.id,
          announcement: item.message,
        });
      } else {
        roomSync.broadcast('COMBAT_FEED_EVENT', { event: item });
      }
    }
  }

  public getFeed(): UnifiedFeedItem[] {
    return this.items;
  }

  public addEvent(
    event: Omit<UnifiedFeedItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number },
    broadcast = true
  ): UnifiedFeedItem {
    const item: UnifiedFeedItem = {
      ...event,
      id: event.id || `feed-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: event.timestamp || Date.now(),
    };
    this.appendItem(item, broadcast);
    return item;
  }

  public recordDiceRoll(roll: DiceRollResult, broadcast = true): UnifiedFeedItem {
    const formula = roll.formula || formatFormula(roll.count, roll.diceType, roll.modifier);
    const isCrit = roll.isCrit || (roll.diceType === 'd20' && roll.rolls.includes(20));
    const isFumble = roll.isFumble || (roll.diceType === 'd20' && roll.rolls.includes(1));

    const isIndividual = roll.displayMode === 'individual';
    const pairedSummary =
      roll.pairedRolls && roll.pairedRolls.length > 0
        ? roll.pairedRolls
            .map((p) => `[${p.selected}, ~~${p.discarded}~~]`)
            .join(', ')
        : null;

    const msgText = isIndividual
      ? `rolled ${formula} (Individual: ${roll.individualSummary || pairedSummary || roll.rolls.map((r) => `[${r}]`).join(', ')})`
      : pairedSummary
      ? `rolled ${formula} for a total of ${roll.total}! (${pairedSummary})`
      : `rolled ${formula} for a total of ${roll.total}!`;

    const isSecret = roll.visibility === 'dm' || !!roll.isSecret;
    const senderName = roll.sender?.trim() || roomSync.getPeerName();
    const secretNotice = `${senderName} rolled a secret check to the DM.`;

    const item: UnifiedFeedItem = {
      id: roll.id || `dice-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'dice',
      sender: senderName,
      isDm: roll.isDm,
      message: msgText,
      playerMessage: isSecret ? secretNotice : undefined,
      isSecretRoll: isSecret,
      secretSender: senderName,
      timestamp: roll.timestamp || Date.now(),
      rollDetails: {
        formula,
        total: roll.total,
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
        visibility: roll.visibility,
        isSecret,
        label: roll.label,
        displayMode: roll.displayMode || 'sum',
        poolBreakdown: roll.poolBreakdown,
        individualSummary: roll.individualSummary,
        individualLineItems: roll.individualLineItems,
      },
    };

    this.appendItem(item, broadcast && roll.visibility !== 'self');
    return item;
  }

  public recordTurnAnnouncement(message: string, broadcast = true): UnifiedFeedItem {
    const item: UnifiedFeedItem = {
      id: `turn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'turn',
      sender: 'Turn Herald',
      message,
      timestamp: Date.now(),
    };
    this.appendItem(item, broadcast);
    return item;
  }

  public recordCombatLog(message: string, broadcast = true, playerMessage?: string): UnifiedFeedItem {
    const item: UnifiedFeedItem = {
      id: `combat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'combat',
      sender: 'Combat Tracker',
      message,
      playerMessage: playerMessage || message,
      timestamp: Date.now(),
    };
    this.appendItem(item, broadcast);
    return item;
  }

  public recordChat(sender: string, isDm: boolean, message: string, broadcast = true): UnifiedFeedItem {
    const item: UnifiedFeedItem = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'chat',
      sender,
      isDm,
      message,
      timestamp: Date.now(),
    };
    this.appendItem(item, broadcast);
    return item;
  }

  /**
   * Localized Live Feed Log Clearing (Client-Side Only).
   * Scopes the "Clear Log" action strictly to the local client's current session view.
   * Does NOT broadcast a global clear event across WebRTC data channels or to other peers.
   * Each participant (DM and individual players) retains independent control over their own feed.
   */
  public clearFeed(): void {
    this.items = [];
    this.clearedAt = Date.now();
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify([]));
      sessionStorage.setItem(this.getStorageKey(), JSON.stringify([]));
      localStorage.setItem(this.getClearedKey(), String(this.clearedAt));
      sessionStorage.setItem(this.getClearedKey(), String(this.clearedAt));
    } catch {}

    this.notifyListeners();
  }

  public subscribe(listener: FeedListener): () => void {
    this.listeners.add(listener);
    listener(this.items);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const liveFeedSync = new LiveFeedSyncManager();
