import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Swords,
  Footprints,
  Moon,
  Coins,
  Sparkles,
  Dices,
  Copy,
  Check,
  ShieldAlert,
  Flame,
  Activity,
  Heart,
  AlertTriangle,
} from 'lucide-react';
import { liveFeedSync } from '../utils/liveFeedSync';
import { rollSingleDie } from '../utils/dice';

export interface GrimoireRule {
  id: string;
  category: 'combat' | 'movement' | 'rest' | 'world';
  title: string;
  badge: string;
  keywords: string[];
  summary: string;
  details: string[];
  actionType?: 'bonus' | 'action' | 'special' | 'passive';
  interactiveType?: 'emphasis' | 'mass_combat' | 'currency';
}

const GRIMOIRE_RULES: GrimoireRule[] = [
  // 1. COMBAT & ACTION ECONOMY
  {
    id: 'healing-potions',
    category: 'combat',
    title: 'Healing Potions',
    badge: 'Bonus / Action',
    actionType: 'bonus',
    keywords: ['potion', 'healing', 'drink', 'bonus action', 'administer', 'hp', 'heal'],
    summary:
      'Drink as a Bonus Action (roll potion dice) or as an Action (receive maximum possible healing).',
    details: [
      'Self-Administration: Drinking a potion yourself can be done as a Bonus Action (roll standard potion dice) or as an Action (grants the maximum mathematical healing).',
      'Ally Administration: Administering a potion to an adjacent ally uses identical rules: Bonus Action to roll dice, or Action to grant maximum healing.',
      'Common Healing: 2d4+2 (BA) or 10 HP flat (Action).',
      'Greater Healing: 4d4+4 (BA) or 20 HP flat (Action).',
      'Superior Healing: 8d4+8 (BA) or 40 HP flat (Action).',
      'Supreme Healing: 10d4+20 (BA) or 60 HP flat (Action).',
    ],
  },
  {
    id: 'flanking',
    category: 'combat',
    title: 'Flanking System',
    badge: 'Flat Bonus',
    actionType: 'passive',
    keywords: ['flank', 'flanking', 'surround', 'attack bonus', 'advantage', 'melee'],
    summary:
      'Flat attack roll bonuses for surrounding enemies: +1 for 2 allies, +2 for 3 allies, or +3 for 4+ allies.',
    details: [
      'Flat Modifiers: Replaces advantage with a tactical flat modifier to keep d20 advantage distinct.',
      '2 Allies: +1 flat attack roll bonus.',
      '3 Allies: +2 flat attack roll bonus.',
      '4+ Allies: +3 flat attack roll bonus (capped at +3).',
      'Immunity & Counters: Creatures with all-around vision, exceptional passive perception, Blindsight, Tremorsense, or those 2+ size categories larger than all attackers cannot be flanked.',
    ],
  },
  {
    id: 'massive-damage',
    category: 'combat',
    title: 'Massive Damage & Unstable',
    badge: '>50% Max HP',
    actionType: 'special',
    keywords: ['massive damage', 'unstable', 'reaction', 'con save', 'incapacitated'],
    summary:
      'Taking single-source damage exceeding 50% max HP inflicts "Unstable" (lose reactions).',
    details: [
      'Trigger: A character suffers single-source damage exceeding 50% of their maximum HP in a single strike or spell.',
      'Unstable Status: Immediately lose all reactions until stabilized.',
      'Recovery Option 1: An adjacent ally can spend an Action on their turn to physically steady and stabilize the creature.',
      'Recovery Option 2: The unstable creature makes a DC 10 Constitution saving throw at the start of their turn. On a failure, they are Incapacitated until the end of their turn; on a success, Unstable ends.',
    ],
  },
  {
    id: 'lingering-injury',
    category: 'combat',
    title: 'Lingering Injuries',
    badge: 'Crit / Overkill',
    actionType: 'special',
    keywords: ['lingering injury', 'crit', 'critical hit', '0 hp', 'overkill', 'table'],
    summary:
      'Triggered when dropped to 0 HP by a Critical Hit, or from single-source damage greater than max HP.',
    details: [
      'Trigger A: Reduced to 0 HP directly by a Critical Hit.',
      'Trigger B: Taking single-source damage exceeding total maximum HP in one blow.',
      'Resolution: The DM rolls on the Ashtapor Lingering Injury table (e.g., limp, internal bleeding, scar, severed tendon, cracked ribs).',
      'Healing: Requires targeted magical healing (Lesser/Greater Restoration, Regenerate) or extended downtime rest and medical treatment.',
    ],
  },
  {
    id: 'status-callouts',
    category: 'combat',
    title: 'Status Callouts (HP Thresholds)',
    badge: 'Health Tiers',
    actionType: 'passive',
    keywords: ['status', 'hurt', 'bloodied', 'critical', 'health', 'threshold'],
    summary:
      'Visual battlefield HP health indicators: Hurt (>50% HP), Bloodied (<=50% HP), and Critical (single-digit HP).',
    details: [
      'Hurt: Current HP is > 50% max HP but has taken damage. Shows visible minor wear and defensive posture.',
      'Bloodied: Current HP is <= 50% max HP. Noticeable open wounds, breathing heavily, visible blood or distress.',
      'Critical: Single-digit HP remaining (≤ 9 HP). Immediate mortal peril, staggering, barely standing.',
      'Unconscious / Defeated: 0 HP. Incapacitated, prone, rolling death saves or destroyed.',
    ],
  },

  // 2. MOVEMENT & ENVIRONMENT
  {
    id: 'fall-damage',
    category: 'movement',
    title: 'Homebrew Fall Damage',
    badge: 'Flat HP Impact',
    actionType: 'passive',
    keywords: ['fall', 'falling', 'flat damage', 'distance', 'incapacitated', 'prone'],
    summary:
      '1 flat damage per foot beyond 15 ft. Incapacitated creatures take 1 flat damage per foot from 0 ft.',
    details: [
      'Normal Fall: Falls of 15 ft or less deal 0 damage. Falls > 15 ft deal flat damage equal to (Distance - 15) HP bludgeoning.',
      'Incapacitated Fall: Incapacitated or paralyzed creatures take 1 flat damage per foot starting from 0 ft (Distance × 1 HP).',
      'No Dice Rolling: Replaces swingy d6 damage with deterministic kinetic impact.',
      'Prone: Any creature that takes fall damage lands Prone unless protected by special abilities or magic.',
    ],
  },
  {
    id: 'jumping-mechanics',
    category: 'movement',
    title: 'Homebrew Jumping Rules',
    badge: 'No Check Needed',
    actionType: 'passive',
    keywords: ['jump', 'jumping', 'standing', 'running', 'str', 'dex', 'speed'],
    summary:
      'Standing = 5 ft + max(STR, DEX) mod. Running (10-ft lead) = 10 ft + max(STR, DEX) mod. Limited by total movement speed.',
    details: [
      'Best Attribute: Jump calculation uses Math.max(STR modifier, DEX modifier). Agile rogues and muscular warriors both jump effectively.',
      'Standing Jump: 5 ft + max(STR, DEX) modifier (min 0 ft).',
      'Running Jump: 10 ft + max(STR, DEX) modifier with a 10-ft straight lead-up (min 0 ft).',
      'No Athletics Check Required: Distance is guaranteed based on physical attributes.',
      'Speed Limitation: Total jump distance consumed on your turn cannot exceed your remaining movement speed.',
    ],
  },
  {
    id: 'prone-duck-crouch',
    category: 'movement',
    title: 'Prone, Duck & Crouch',
    badge: 'Flat 15 ft Cost',
    actionType: 'passive',
    keywords: ['prone', 'duck', 'crouch', 'crawling', 'maneuver', 'movement speed'],
    summary:
      'Dropping, crawling, or clearing improvised maneuvers costs a flat 15 ft of movement.',
    details: [
      'Flat Cost: Rather than halving entire remaining movement, tactical ground maneuvers cost a flat 15 ft.',
      'Dropping Prone / Ducking: Dropping under cover or crawling through low clearances deducts 15 ft from current turn speed.',
      'Standing Up from Prone: Costs a flat 15 ft of movement (or all remaining speed if less than 15 ft).',
      'Improvised Low Obstacles: Vaulting or sliding under low barricades costs 15 ft.',
    ],
  },
  {
    id: 'lifting-dragging',
    category: 'movement',
    title: 'Lifting & Dragging Capacity',
    badge: '15 × STR Score',
    actionType: 'passive',
    keywords: ['lifting', 'dragging', 'carrying', 'strength', 'size', 'capacity', 'weight'],
    summary:
      'Base capacity = 15 × STR score. Double for each size above Medium (Large ×2, Huge ×4, Gargantuan ×8).',
    details: [
      'Base Capacity: Lift, drag, or push up to 15 × Strength score in pounds without a check.',
      'Size Multipliers:',
      '• Tiny: ×0.5 capacity',
      '• Small / Medium: ×1.0 base capacity (15 × STR)',
      '• Large: ×2 capacity (30 × STR)',
      '• Huge: ×4 capacity (60 × STR)',
      '• Gargantuan: ×8 capacity (120 × STR)',
      'Movement While Dragging: Dragging a creature or weight exceeding carrying limit reduces speed to 5 ft.',
    ],
  },

  // 3. REST & RECOVERY
  {
    id: 'short-rest',
    category: 'rest',
    title: 'Short Rest & Exhaustion Limit',
    badge: '10 Mins · PB/Day',
    actionType: 'special',
    keywords: ['short rest', 'rest', 'exhaustion', 'proficiency bonus', 'hit dice'],
    summary:
      'Short Rest takes 10 minutes. Limited per day to uses equal to Proficiency Bonus; extra rests incur 1 level of Exhaustion.',
    details: [
      'Pacing: 10 minutes allows quick recovery between skirmishes without stalling the dungeon crawl narrative.',
      'Daily Cap: Characters may safely take short rests equal to their Proficiency Bonus per long rest cycle.',
      'Pushing Past Limits: Taking an additional short rest beyond your Proficiency Bonus limit immediately inflicts 1 level of Exhaustion upon completion.',
      'Hit Dice: Spend Hit Dice normally to recover HP during any valid short rest.',
    ],
  },
  {
    id: 'attunement-and-long-rest',
    category: 'rest',
    title: 'Attunement & Long Rest Times',
    badge: '1 Hr / 8 Hrs',
    actionType: 'passive',
    keywords: ['attunement', 'magic item', 'long rest', 'hours', 'downtime'],
    summary:
      'Magic Item Attunement takes 1 hour of focused downtime. Long Rest takes 8 hours in safe conditions.',
    details: [
      'Attunement Duration: Attuning to a magic item requires 1 uninterrupted hour of focused physical contact and practice.',
      'Attunement Slot Limit: Standard 3 attuned magic items per creature unless granted otherwise by class features (e.g. Artificer).',
      'Long Rest: 8 hours (at least 6 hours of sleep and no more than 2 hours of light watch duty).',
      'Sanctuary: Long rests in hostile wilderness or extreme cold/heat require active shelter or Survival checks to avoid interrupted sleep.',
    ],
  },
  {
    id: 'resurrection-ritual',
    category: 'rest',
    title: 'Ashtapor Resurrection Ritual',
    badge: 'Base DC 8 + Deaths',
    actionType: 'special',
    keywords: ['resurrection', 'ritual', 'death', 'soul', 'dc', 'spellcasting', 'secret'],
    summary:
      'Base DC = 8 + previous deaths. Up to 3 allies make secret checks to DM (Success = -1 DC, Nat 20 = -3 DC). Caster makes final check.',
    details: [
      'Soul Willingness: The soul must be free and willing to return.',
      'Base DC: Begins at DC 8 + (number of times the creature has previously died).',
      'Allied Contributions: Up to 3 allies offer heartfelt prayers, sacrifices, relics, or memories to anchor the soul. Each makes a relevant check secretly to the DM:',
      '• Standard Success: -1 to final DC',
      '• Natural 20 Critical: -3 to final DC',
      '• Standard Failure: +1 to final DC',
      '• Natural 1 Fumble: +3 to final DC',
      'Final Caster Check: The primary ritual caster rolls 1d20 + their spellcasting ability modifier against the modified DC. If met or exceeded, the soul returns.',
    ],
  },

  // 4. WORLD & DICE SYSTEMS
  {
    id: 'universal-currency',
    category: 'world',
    title: 'Universal Currency (Units)',
    badge: 'Alloy Units',
    actionType: 'passive',
    interactiveType: 'currency',
    keywords: ['currency', 'units', 'coin', 'cube', 'bar', 'gold', 'money', 'alloy'],
    summary:
      'Standardized metallic alloy: Coin = 1 Unit, Cube = 25 Units, Bar = 100 Units. Formed of 33% Cu, 33% Ag, 33% Au, 1% Pt.',
    details: [
      'The Alloy: A precision blend of 33% Copper, 33% Silver, 33% Gold, and 1% Platinum. Cannot be easily debased or shaved without ruining the distinctive sheen.',
      'Coin (Unit): 1 Unit. Everyday trade, meals, standard tavern stays.',
      'Cube (Block): 25 Units. Standard mercantile transactions, trade goods, basic armor.',
      'Bar (Ingot): 100 Units. High-end property, masterwork equipment, ship transport, magic materials.',
    ],
  },
  {
    id: 'emphasis-rolls',
    category: 'world',
    title: 'Emphasis Rolls (Binary Drama)',
    badge: '2d20 Farthest from 10',
    actionType: 'special',
    interactiveType: 'emphasis',
    keywords: ['emphasis', 'dramatic', 'binary', '2d20', 'grand success', 'grand failure', 'fate'],
    summary:
      'Binary dramatic outcome without modifiers. Roll 2d20; the die farthest from 10 dictates the outcome. Both >10 = Grand Success; both <10 = Grand Failure.',
    details: [
      'Dramatic Binary Check: Used when raw fate, luck, or narrative momentum decides the consequence without skill modifiers.',
      'Resolution Rule: Roll 2d20. Measure distance of each die from 10 (|die - 10|). The die with greater distance dictates the outcome.',
      'Grand Success: Both dice land strictly above 10 (e.g. 14 and 19). Outcome is overwhelmingly positive.',
      'Grand Failure: Both dice land strictly below 10 (e.g. 3 and 7). Outcome is catastrophic.',
      'Divided Fate: If one die is > 10 and one is < 10, whichever is farther from 10 wins out.',
    ],
  },
  {
    id: 'mass-combat',
    category: 'world',
    title: 'Mass Combat Resolution',
    badge: 'Init 20 & 10',
    actionType: 'special',
    interactiveType: 'mass_combat',
    keywords: ['mass combat', 'army', 'initiative 20', 'initiative 10', 'fate roll', 'execution'],
    summary:
      'Contested group rolls at Initiative 20 (Fate Roll: 1d20 Ally vs 1d20 Enemy) and Initiative 10 (Execution Roll).',
    details: [
      'Initiative 20 — Fate Roll: DM and Player roll contested 1d20 for the high-level battlefield morale and environmental favor.',
      'Initiative 10 — Execution Roll: DM and Player roll contested 1d20 for unit cohesion, tactics, and commander discipline.',
      'Decisive Advance: Win both Init 20 and Init 10 rolls. Friendly forces punch through enemy lines or capture key objectives.',
      'Stalemate: Win one roll and lose one roll. Chaotic clash, heavy casualties on both sides, lines remain contested.',
      'Decisive Setback: Lose both Init 20 and Init 10 rolls. Friendly lines buckle, forced retreat, or flank collapsed.',
    ],
  },
];

interface GrimoireProps {
  isDm?: boolean;
}

export const Grimoire: React.FC<GrimoireProps> = ({ isDm }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [openRuleIds, setOpenRuleIds] = useState<Set<string>>(() => new Set(['healing-potions', 'flanking']));
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Toggle individual accordion
  const toggleRule = (id: string) => {
    setOpenRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Expand / Collapse all
  const handleExpandAll = () => {
    setOpenRuleIds(new Set(GRIMOIRE_RULES.map((r) => r.id)));
  };

  const handleCollapseAll = () => {
    setOpenRuleIds(new Set());
  };

  // Copy rule text to clipboard
  const handleCopyRule = (rule: GrimoireRule, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `[Ashtapor Homebrew: ${rule.title}]\n${rule.summary}\n\n${rule.details.join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedId(rule.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Interactive Roll: Emphasis Roll (2d20)
  const handleRollEmphasis = (e: React.MouseEvent) => {
    e.stopPropagation();
    const die1 = rollSingleDie(20);
    const die2 = rollSingleDie(20);
    const dist1 = Math.abs(die1 - 10);
    const dist2 = Math.abs(die2 - 10);

    let decisiveDie = die1;
    let outcome = 'Standard Outcome';
    let isGrandSuccess = false;
    let isGrandFailure = false;

    if (die1 > 10 && die2 > 10) {
      isGrandSuccess = true;
      decisiveDie = Math.max(die1, die2);
      outcome = '🌟 GRAND SUCCESS! (Both dice > 10)';
    } else if (die1 < 10 && die2 < 10) {
      isGrandFailure = true;
      decisiveDie = Math.min(die1, die2);
      outcome = '💀 GRAND FAILURE! (Both dice < 10)';
    } else {
      decisiveDie = dist1 >= dist2 ? die1 : die2;
      outcome = decisiveDie > 10 ? '✨ Success (Farthest from 10)' : '⚠️ Setback (Farthest from 10)';
    }

    const logMsg = `⚖️ Emphasis Roll (2d20): [${die1}, ${die2}] ➔ Decisive: ${decisiveDie} (dist ${Math.max(dist1, dist2)} from 10) — ${outcome}`;
    liveFeedSync.recordCombatLog(logMsg, true);
  };

  // Interactive Roll: Mass Combat Fate Roll (1d20 Ally vs 1d20 Enemy)
  const handleRollMassCombat = (type: 'Fate (Init 20)' | 'Execution (Init 10)', e: React.MouseEvent) => {
    e.stopPropagation();
    const allyRoll = rollSingleDie(20);
    const enemyRoll = rollSingleDie(20);
    let outcome = '';

    if (allyRoll > enemyRoll) {
      outcome = '⚔️ Ally Victory (+1 Advantage)';
    } else if (allyRoll < enemyRoll) {
      outcome = '🛡️ Enemy Victory (-1 Setback)';
    } else {
      outcome = '⚖️ Contested Tie (Bloody Grasp)';
    }

    const logMsg = `🚩 Mass Combat ${type}: Ally [${allyRoll}] vs Enemy [${enemyRoll}] ➔ ${outcome}`;
    liveFeedSync.recordCombatLog(logMsg, true);
  };

  // Filtered rules
  const filteredRules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return GRIMOIRE_RULES.filter((rule) => {
      // Category filter
      if (selectedCategory !== 'all' && rule.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;

      // Text search in title, badge, summary, keywords, and details
      const matchTitle = rule.title.toLowerCase().includes(q);
      const matchBadge = rule.badge.toLowerCase().includes(q);
      const matchSummary = rule.summary.toLowerCase().includes(q);
      const matchKeywords = rule.keywords.some((k) => k.toLowerCase().includes(q));
      const matchDetails = rule.details.some((d) => d.toLowerCase().includes(q));

      return matchTitle || matchBadge || matchSummary || matchKeywords || matchDetails;
    });
  }, [searchQuery, selectedCategory]);

  const categoryCounts = useMemo(() => {
    const counts = { all: GRIMOIRE_RULES.length, combat: 0, movement: 0, rest: 0, world: 0 };
    GRIMOIRE_RULES.forEach((r) => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });
    return counts;
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0b0f17] select-none p-2 gap-2 text-neutral-100">
      {/* 1. COMPACT TOP SEARCH & CATEGORY STRIP */}
      <div className="space-y-1.5 shrink-0 bg-neutral-900/90 border border-neutral-800 rounded-xl p-2 shadow-sm">
        {/* Search Input Bar */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search homebrew rules (e.g. potion, flanking, fall, currency)..."
            className="w-full pl-8 pr-7 py-1 text-xs font-medium rounded-lg bg-neutral-950 border border-neutral-700 text-amber-200 placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 p-0.5 text-neutral-400 hover:text-neutral-200"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills & Expand/Collapse Toggle */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition cursor-pointer shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-amber-400 text-neutral-950'
                  : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
              }`}
            >
              All ({categoryCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('combat')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition cursor-pointer flex items-center gap-1 shrink-0 ${
                selectedCategory === 'combat'
                  ? 'bg-amber-400 text-neutral-950'
                  : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
              }`}
            >
              <Swords className="w-2.5 h-2.5" />
              <span>Combat</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('movement')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition cursor-pointer flex items-center gap-1 shrink-0 ${
                selectedCategory === 'movement'
                  ? 'bg-amber-400 text-neutral-950'
                  : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
              }`}
            >
              <Footprints className="w-2.5 h-2.5" />
              <span>Movement</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('rest')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition cursor-pointer flex items-center gap-1 shrink-0 ${
                selectedCategory === 'rest'
                  ? 'bg-amber-400 text-neutral-950'
                  : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
              }`}
            >
              <Moon className="w-2.5 h-2.5" />
              <span>Rest</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('world')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition cursor-pointer flex items-center gap-1 shrink-0 ${
                selectedCategory === 'world'
                  ? 'bg-amber-400 text-neutral-950'
                  : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
              }`}
            >
              <Coins className="w-2.5 h-2.5" />
              <span>World</span>
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0 text-[10px]">
            <button
              type="button"
              onClick={handleExpandAll}
              className="text-neutral-400 hover:text-amber-300 font-semibold px-1 py-0.5 rounded transition cursor-pointer"
            >
              Expand
            </button>
            <span className="text-neutral-600">·</span>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="text-neutral-400 hover:text-amber-300 font-semibold px-1 py-0.5 rounded transition cursor-pointer"
            >
              Collapse
            </button>
          </div>
        </div>
      </div>

      {/* 2. ACCORDION RULES LIST */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
        {filteredRules.length === 0 ? (
          <div className="text-center py-10 px-4 bg-neutral-900/50 rounded-xl border border-neutral-800 text-neutral-400">
            <BookOpen className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-xs font-semibold">No Ashtapor rules match "{searchQuery}"</p>
            <p className="text-[11px] text-neutral-500 mt-1">
              Try searching for potions, flanking, jumping, short rest, or emphasis rolls.
            </p>
          </div>
        ) : (
          filteredRules.map((rule) => {
            const isOpen = openRuleIds.has(rule.id);
            const isCombat = rule.category === 'combat';
            const isMovement = rule.category === 'movement';
            const isRest = rule.category === 'rest';
            const isWorld = rule.category === 'world';

            return (
              <div
                key={rule.id}
                className="bg-neutral-900/80 border border-neutral-800 rounded-xl overflow-hidden shadow-sm transition-all"
              >
                {/* Header row */}
                <div
                  className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-neutral-800/60 transition gap-2 group"
                >
                  <button
                    type="button"
                    onClick={() => toggleRule(rule.id)}
                    className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
                  >
                    {isCombat && <Swords className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                    {isMovement && <Footprints className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                    {isRest && <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                    {isWorld && <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />}

                    <span className="text-xs font-bold text-neutral-200 truncate group-hover:text-amber-300 transition-colors">
                      {rule.title}
                    </span>

                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold shrink-0 ${
                        isCombat
                          ? 'bg-rose-950/70 border-rose-800/60 text-rose-300'
                          : isMovement
                          ? 'bg-cyan-950/70 border-cyan-800/60 text-cyan-300'
                          : isRest
                          ? 'bg-indigo-950/70 border-indigo-800/60 text-indigo-300'
                          : 'bg-amber-950/70 border-amber-800/60 text-amber-300'
                      }`}
                    >
                      {rule.badge}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleCopyRule(rule, e)}
                      title="Copy rule to clipboard"
                      className="p-1 rounded text-neutral-400 hover:text-amber-300 hover:bg-neutral-800 transition cursor-pointer"
                    >
                      {copiedId === rule.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleRule(rule.id)}
                      className="p-1 rounded text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
                      title={isOpen ? 'Collapse rule' : 'Expand rule'}
                      aria-label={isOpen ? 'Collapse rule' : 'Expand rule'}
                    >
                      {isOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-neutral-800/80 space-y-2 text-xs">
                    {/* Summary callout box */}
                    <div className="p-2 rounded-lg bg-neutral-950/70 border border-neutral-800 text-neutral-200 font-medium leading-relaxed">
                      {rule.summary}
                    </div>

                    {/* Detailed rule breakdown */}
                    <ul className="space-y-1 text-[11px] text-neutral-300 list-disc list-inside">
                      {rule.details.map((detail, dIdx) => (
                        <li key={dIdx} className="leading-snug">
                          {detail}
                        </li>
                      ))}
                    </ul>

                    {/* Interactive 1-click Roll Buttons */}
                    {rule.interactiveType === 'emphasis' && (
                      <div className="pt-1.5 border-t border-neutral-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-neutral-400 italic">
                          Roll 2d20 dramatic binary check
                        </span>
                        <button
                          type="button"
                          onClick={handleRollEmphasis}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 flex items-center gap-1.5 shadow transition cursor-pointer"
                        >
                          <Dices className="w-3.5 h-3.5" />
                          <span>Roll Emphasis (2d20)</span>
                        </button>
                      </div>
                    )}

                    {rule.interactiveType === 'mass_combat' && (
                      <div className="pt-1.5 border-t border-neutral-800/80 flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={(e) => handleRollMassCombat('Fate (Init 20)', e)}
                          className="px-2 py-1 text-[11px] font-bold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-cyan-300 border border-cyan-800/60 flex items-center gap-1 transition cursor-pointer"
                        >
                          <span>Init 20: Fate Roll</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleRollMassCombat('Execution (Init 10)', e)}
                          className="px-2 py-1 text-[11px] font-bold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-800/60 flex items-center gap-1 transition cursor-pointer"
                        >
                          <span>Init 10: Execution</span>
                        </button>
                      </div>
                    )}

                    {rule.interactiveType === 'currency' && (
                      <div className="pt-1.5 border-t border-neutral-800/80 grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
                        <div className="p-1 rounded bg-neutral-950 border border-neutral-800">
                          <span className="text-amber-400 font-bold block">1 Coin</span>
                          <span className="text-neutral-400">1 Unit</span>
                        </div>
                        <div className="p-1 rounded bg-neutral-950 border border-neutral-800">
                          <span className="text-cyan-400 font-bold block">1 Cube</span>
                          <span className="text-neutral-400">25 Units</span>
                        </div>
                        <div className="p-1 rounded bg-neutral-950 border border-neutral-800">
                          <span className="text-emerald-400 font-bold block">1 Bar</span>
                          <span className="text-neutral-400">100 Units</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
