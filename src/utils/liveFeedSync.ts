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
  };
}

type FeedListener = (items: UnifiedFeedItem[], newItem?: UnifiedFeedItem) => void;

const STORAGE_KEY = 'ttrpg_unified_live_feed';

function formatFormula(count: number, die: string, mod: number): string {
  const modStr = mod > 0 ? `+${mod}` : mod < 0 ? `${mod}` : '';
  return `${count}${die}${modStr}`;
}

class LiveFeedSyncManager {
  private items: UnifiedFeedItem[] = [];
  private listeners: Set<FeedListener> = new Set();
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    this.initialized = true;

    // Load persisted feed
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
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
          sender: 'Campaign System',
          message: '⚔️ Session feed connected. Rolls, combat logs, and callouts will sync in real time!',
          timestamp: Date.now() - 30000,
        },
      ];
    }

    // Subscribe to roomSync messages
    roomSync.subscribe((msg: RoomMessage) => {
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
                .map((p) => `Pair ${p.pairIndex}: [${p.selected}] (discarded ${p.discarded})`)
                .join(', ')
            : null;

        const msgText = isIndividual
          ? `rolled ${formula} (Individual: ${roll.individualSummary || pairedSummary || roll.rolls.map((r) => `[${r}]`).join(', ')})`
          : pairedSummary
          ? `rolled ${formula} for a total of ${roll.total}! (${pairedSummary})`
          : `rolled ${formula} for a total of ${roll.total}!`;

        const isSecret = roll.visibility === 'dm' || !!roll.isSecret;
        const senderName = roll.sender || msg.senderName;
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

  private appendItem(item: UnifiedFeedItem, broadcast = false) {
    this.items = [...this.items.slice(-79), item];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {}

    // Notify local subscribers
    this.listeners.forEach((listener) => {
      try {
        listener(this.items, item);
      } catch (err) {
        console.error('Feed listener error:', err);
      }
    });

    // Broadcast if requested
    if (broadcast) {
      if (item.type === 'dice' && item.rollDetails) {
        // Broadcast as DICE_ROLL
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
            .map((p) => `Pair ${p.pairIndex}: [${p.selected}] (discarded ${p.discarded})`)
            .join(', ')
        : null;

    const msgText = isIndividual
      ? `rolled ${formula} (Individual: ${roll.individualSummary || pairedSummary || roll.rolls.map((r) => `[${r}]`).join(', ')})`
      : pairedSummary
      ? `rolled ${formula} for a total of ${roll.total}! (${pairedSummary})`
      : `rolled ${formula} for a total of ${roll.total}!`;

    const isSecret = roll.visibility === 'dm' || !!roll.isSecret;
    const senderName = roll.sender || roomSync.getPeerName();
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

  public clearFeed(): void {
    this.items = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    this.listeners.forEach((listener) => listener([]));
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
