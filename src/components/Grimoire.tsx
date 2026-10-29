/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Swords,
  Footprints,
  Moon,
  Coins,
  Dices,
  Copy,
  Check,
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
  interactiveType?: 'emphasis' | 'mass_combat' | 'currency' | 'potions';
}

const GRIMOIRE_RULES: GrimoireRule[] = [
  // 1. COMBAT & ACTION ECONOMY
  {
    id: 'healing-potions',
    category: 'combat',
    title: 'Healing Potions',
    badge: 'Bonus / Action',
    actionType: 'bonus',
    interactiveType: 'potions',
    keywords: ['potion', 'healing', 'drink', 'bonus action', 'action', 'administer', 'hp'],
    summary:
      'Drink as a Bonus Action (roll dice) or as an Action (maximum healing). Administering to an ally uses identical rules.',
    details: [
      'Self or Ally: Bonus Action to roll standard dice; Action to receive maximum possible healing.',
      'Common: 2d4+2 HP (Bonus Action) · 10 HP flat (Action)',
      'Greater: 4d4+4 HP (Bonus Action) · 20 HP flat (Action)',
      'Superior: 8d4+8 HP (Bonus Action) · 40 HP flat (Action)',
      'Supreme: 10d4+20 HP (Bonus Action) · 60 HP flat (Action)',
    ],
  },
  {
    id: 'flanking',
    category: 'combat',
    title: 'Flanking System',
    badge: 'Flat Bonus',
    actionType: 'passive',
    keywords: ['flank', 'flanking', 'attack bonus', 'surround', 'advantage', 'melee'],
    summary:
      'Flat attack roll bonuses for surrounding enemies: +1 (2 allies), +2 (3 allies), or +3 (4+ allies).',
    details: [
      'Attack Bonuses: +1 (2 allies) · +2 (3 allies) · +3 (4+ allies max).',
      'Immunity: Creatures with all-around vision, high perception, Blindsight, Tremorsense, or who are 2+ sizes larger cannot be flanked.',
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
      'Single-source damage > 50% max HP inflicts Unstable (lose reactions until stabilized).',
    details: [
      'Trigger: Taking single-source damage > 50% of your maximum HP.',
      'Unstable: Immediately lose all reactions until stabilized.',
      'Recovery: An ally can use an Action to steady you, or you must pass a DC 10 Con save at the start of your turn.',
      'Failure Penalty: Failing the Con save inflicts Incapacitated until the end of that turn.',
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
      'Triggered when dropped to 0 HP by a Critical Hit, or from single-source damage > maximum HP.',
    details: [
      'Trigger A: Dropped to 0 HP directly by a Critical Hit.',
      'Trigger B: Single-source damage > maximum HP.',
      'Resolution: DM rolls directly on the lingering injury table.',
    ],
  },
  {
    id: 'status-callouts',
    category: 'combat',
    title: 'Status Callouts (HP Thresholds)',
    badge: 'Health Tiers',
    actionType: 'passive',
    keywords: ['status', 'hurt', 'bloodied', 'critical', 'health', 'threshold', 'hp'],
    summary:
      'Standard HP callout tiers: Hurt (>50% HP), Bloodied (≤50% HP), and Critical (single-digit HP remaining).',
    details: [
      'Hurt: Current HP is above 50% max HP.',
      'Bloodied: Current HP is 50% max HP or lower.',
      'Critical: Single-digit HP remaining (≤ 9 HP).',
    ],
  },

  // 2. MOVEMENT & ENVIRONMENT
  {
    id: 'fall-damage',
    category: 'movement',
    title: 'Fall Damage',
    badge: '1 HP / Foot',
    actionType: 'passive',
    keywords: ['fall', 'falling', 'flat damage', 'distance', 'incapacitated', 'feet'],
    summary:
      '1 flat damage per foot fallen beyond 15 ft. Incapacitated creatures take 1 damage per foot from 0 ft.',
    details: [
      'Standard Fall: 1 flat damage per foot fallen beyond 15 ft (falls of 15 ft or less deal 0 damage).',
      'Incapacitated Fall: Incapacitated creatures take 1 flat damage per foot starting from 0 ft.',
    ],
  },
  {
    id: 'jumping-mechanics',
    category: 'movement',
    title: 'Jumping',
    badge: 'No Check Needed',
    actionType: 'passive',
    keywords: ['jump', 'jumping', 'standing', 'running', 'str', 'dex', 'speed'],
    summary:
      'No check required; limited by total movement speed. Uses the higher of your STR or DEX modifier.',
    details: [
      'Attribute: Uses your STR or DEX modifier (whichever is higher).',
      'Standing Jump: 5 ft + modifier.',
      'Running Jump (10-ft lead): 10 ft + modifier.',
      'Movement Cap: Total jump distance cannot exceed remaining movement speed.',
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
      'Cost: Flat 15 ft deduction from your movement speed.',
      'Applies To: Dropping prone, crawling, ducking under low cover, or clearing improvised maneuvers.',
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
      'Base capacity = 15 × STR score (lbs). Doubles for each size category above Medium.',
    details: [
      'Base Capacity (Medium/Small): 15 × STR score in pounds.',
      'Size Multipliers:',
      '• Large: ×2 capacity (30 × STR score)',
      '• Huge: ×4 capacity (60 × STR score)',
      '• Gargantuan: ×8 capacity (120 × STR score)',
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
      'Duration: 10 minutes.',
      'Daily Cap: Uses per day equal to your Proficiency Bonus.',
      'Exhaustion Penalty: Each additional short rest before a long rest inflicts 1 level of Exhaustion.',
    ],
  },
  {
    id: 'magic-item-attunement',
    category: 'rest',
    title: 'Magic Item Attunement',
    badge: '1 Hour',
    actionType: 'passive',
    keywords: ['attunement', 'magic item', 'rest', 'hours', 'focus'],
    summary: 'Magic item attunement requires 1 hour of focused downtime.',
    details: ['Attunement Time: 1 hour of focused effort and physical contact with the item.'],
  },
  {
    id: 'long-rest',
    category: 'rest',
    title: 'Long Rest',
    badge: '8 Hours',
    actionType: 'passive',
    keywords: ['long rest', 'rest', 'hours', 'sleep', 'recovery'],
    summary: 'Long rest requires 8 hours of downtime.',
    details: ['Duration: 8 hours (standard full rest cycle).'],
  },
  {
    id: 'resurrection-ritual',
    category: 'rest',
    title: 'Resurrection Ritual',
    badge: 'Base DC 8 + Deaths',
    actionType: 'special',
    keywords: ['resurrection', 'ritual', 'death', 'dc', 'spellcasting', 'secret'],
    summary:
      'Base DC = 8 + previous deaths. Up to 3 allies make secret checks to the DM, followed by the caster roll.',
    details: [
      'Base DC: 8 + previous deaths.',
      'Player Contributions (rolled in secret to DM): Up to 3 allies make a skill check/roll to aid the ritual.',
      '• Success: -1 to DC (Natural 20: -3 to DC)',
      '• Failure: +1 to DC (Natural 1: +3 to DC)',
      'Final Check (rolled in secret to DM): Caster rolls d20 + spellcasting ability modifier against the modified DC.',
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
      'Standardized alloy: 33% Copper, 33% Silver, 33% Gold, 1% Platinum. Coin = 1 Unit, Cube = 25 Units, Bar = 100 Units.',
    details: [
      'Alloy Composition: Copper (33%), Silver (33%), Gold (33%), Platinum (1%).',
      'Coin: 1 Unit',
      'Cube: 25 Units',
      'Bar: 100 Units',
    ],
  },
  {
    id: 'emphasis-rolls',
    category: 'world',
    title: 'Emphasis Rolls (Binary Drama)',
    badge: '2d20 vs 10',
    actionType: 'special',
    interactiveType: 'emphasis',
    keywords: ['emphasis', 'dramatic', 'binary', '2d20', 'grand success', 'grand failure', 'fate'],
    summary:
      'Absolute binary dramatic outcome without modifiers. Roll 2d20; the die farthest from 10 dictates the outcome.',
    details: [
      'Roll: 2d20 with no modifiers. The die farthest from 10 dictates the outcome.',
      'Grand Success: Both dice land strictly above 10.',
      'Grand Failure: Both dice land strictly below 10.',
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
      'Contested group checks at Initiative 20 (Fate Roll) and Initiative 10 (Execution Roll). Execute fate at round end.',
    details: [
      'Initiative 20 (Fate Roll): 1d20 Ally Group vs 1d20 Enemy Group (determines situational fate).',
      'Initiative 10 (Execution Roll): Contested d20 rolls to execute fate.',
      'Round Outcomes (executed at end of round):',
      '• Win / Win = Decisive Advance',
      '• Win / Loss or Loss / Win = Stalemate / Hold',
      '• Loss / Loss = Decisive Setback',
    ],
  },
];

export interface GrimoireProps {
  isGM?: boolean;
  isDm?: boolean;
}

export const Grimoire: React.FC<GrimoireProps> = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [openRuleIds, setOpenRuleIds] = useState<Set<string>>(() => new Set(['healing-potions', 'flanking']));
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleRule = (id: string) => {
    setOpenRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    setOpenRuleIds(new Set(GRIMOIRE_RULES.map((r) => r.id)));
  };

  const handleCollapseAll = () => {
    setOpenRuleIds(new Set());
  };

  const handleCopyRule = (rule: GrimoireRule, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `[Ashtapor Homebrew: ${rule.title}]\n${rule.summary}\n\n${rule.details.join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedId(rule.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleRollEmphasis = (e: React.MouseEvent) => {
    e.stopPropagation();
    const die1 = rollSingleDie(20);
    const die2 = rollSingleDie(20);
    const dist1 = Math.abs(die1 - 10);
    const dist2 = Math.abs(die2 - 10);

    let decisiveDie = die1;
    let outcome = 'Standard Outcome';

    if (die1 > 10 && die2 > 10) {
      decisiveDie = Math.max(die1, die2);
      outcome = '🌟 GRAND SUCCESS! (Both dice > 10)';
    } else if (die1 < 10 && die2 < 10) {
      decisiveDie = Math.min(die1, die2);
      outcome = '💀 GRAND FAILURE! (Both dice < 10)';
    } else {
      decisiveDie = dist1 >= dist2 ? die1 : die2;
      outcome = decisiveDie > 10 ? '✨ Success (Farthest from 10)' : '⚠️ Setback (Farthest from 10)';
    }

    const logMsg = `⚖️ Emphasis Roll (2d20): [${die1}, ${die2}] ➔ Decisive: ${decisiveDie} (dist ${Math.max(dist1, dist2)} from 10) — ${outcome}`;
    liveFeedSync.recordCombatLog(logMsg, true);
  };

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

  const filteredRules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return GRIMOIRE_RULES.filter((rule) => {
      if (selectedCategory !== 'all' && rule.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;

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
      {/* 1. TOP SEARCH & CATEGORY FILTER */}
      <div className="space-y-1.5 shrink-0 bg-neutral-900/90 border border-neutral-800 rounded-xl p-2 shadow-sm">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search homebrew rules (potion, flanking, fall, currency)..."
            className="w-full pl-8 pr-7 py-1 text-xs font-medium rounded-lg bg-neutral-950 border border-neutral-700 text-amber-200 placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 p-0.5 text-neutral-400 hover:text-neutral-200 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

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

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleExpandAll}
              className="w-6 h-6 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-amber-300 flex items-center justify-center transition cursor-pointer"
              title="Expand all rules"
              aria-label="Expand all rules"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="w-6 h-6 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-amber-300 flex items-center justify-center transition cursor-pointer"
              title="Collapse all rules"
              aria-label="Collapse all rules"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. ACCORDION RULES LIST */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
        {filteredRules.length === 0 ? (
          <div className="text-center py-10 px-4 bg-neutral-900/50 rounded-xl border border-neutral-800 text-neutral-400">
            <BookOpen className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-xs font-semibold">No rules match "{searchQuery}"</p>
            <p className="text-[11px] text-neutral-500 mt-1">
              Search by keyword like potions, flanking, jumping, short rest, or emphasis.
            </p>
          </div>
        ) : (
          filteredRules.map((rule) => {
            const isOpen = openRuleIds.has(rule.id);
            const isCombat = rule.category === 'combat';
            const isMovement = rule.category === 'movement';
            const isRest = rule.category === 'rest';

            return (
              <div
                key={rule.id}
                className="bg-neutral-900/80 border border-neutral-800 rounded-xl overflow-hidden shadow-sm transition-all"
              >
                {/* Header row */}
                <div className="w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-neutral-800/60 transition gap-1.5 group">
                  <button
                    type="button"
                    onClick={() => toggleRule(rule.id)}
                    className="flex-1 min-w-0 flex items-center gap-1.5 text-left cursor-pointer overflow-hidden"
                  >
                    <span className="w-6 h-6 rounded-md bg-neutral-950/80 border border-neutral-800/80 flex items-center justify-center shrink-0 text-neutral-400 group-hover:text-amber-300 group-hover:border-amber-400/50 transition">
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </span>

                    {isCombat && <Swords className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                    {isMovement && <Footprints className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                    {isRest && <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                    {!isCombat && !isMovement && !isRest && (
                      <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}

                    <span className="flex-1 min-w-0 truncate text-left text-xs font-bold text-neutral-200 group-hover:text-amber-300 transition-colors">
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

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleCopyRule(rule, e)}
                      title="Copy rule to clipboard"
                      className="w-6 h-6 rounded-md bg-neutral-950/80 hover:bg-neutral-800 border border-neutral-800/80 text-neutral-400 hover:text-amber-300 flex items-center justify-center transition cursor-pointer"
                    >
                      {copiedId === rule.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                {isOpen && (
                  <div className="px-3 pb-2.5 pt-1 border-t border-neutral-800/80 space-y-2 text-xs">
                    {/* Compact Specs List */}
                    <div className="space-y-1 text-[11px] text-neutral-300 font-sans">
                      {rule.details.map((detail, dIdx) => (
                        <div key={dIdx} className="leading-relaxed">
                          {detail.startsWith('•') ? (
                            <span className="pl-2 block text-neutral-400">{detail}</span>
                          ) : (
                            <span>{detail}</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Quick Potion Table */}
                    {rule.interactiveType === 'potions' && (
                      <div className="pt-1 border-t border-neutral-800/80 grid grid-cols-2 gap-1 text-[10px] font-mono">
                        <div className="p-1 rounded bg-neutral-950/80 border border-neutral-800">
                          <span className="text-amber-400 font-bold block">Bonus Action (Roll)</span>
                          <span className="text-neutral-400">Roll potion dice</span>
                        </div>
                        <div className="p-1 rounded bg-neutral-950/80 border border-neutral-800">
                          <span className="text-emerald-400 font-bold block">Action (Max)</span>
                          <span className="text-neutral-400">10 / 20 / 40 / 60 HP</span>
                        </div>
                      </div>
                    )}

                    {/* Interactive 1-click Roll: Emphasis Roll */}
                    {rule.interactiveType === 'emphasis' && (
                      <div className="pt-1.5 border-t border-neutral-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-neutral-400 italic">
                          Binary dramatic check (2d20)
                        </span>
                        <button
                          type="button"
                          onClick={handleRollEmphasis}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 flex items-center gap-1.5 shadow transition cursor-pointer"
                        >
                          <Dices className="w-3.5 h-3.5" />
                          <span>Roll Emphasis</span>
                        </button>
                      </div>
                    )}

                    {/* Interactive 1-click Roll: Mass Combat */}
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

                    {/* Currency Visual Grid */}
                    {rule.interactiveType === 'currency' && (
                      <div className="pt-1.5 border-t border-neutral-800/80 grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
                        <div className="p-1 rounded bg-neutral-950 border border-neutral-800">
                          <span className="text-amber-400 font-bold block">Coin</span>
                          <span className="text-neutral-400">1 Unit</span>
                        </div>
                        <div className="p-1 rounded bg-neutral-950 border border-neutral-800">
                          <span className="text-cyan-400 font-bold block">Cube</span>
                          <span className="text-neutral-400">25 Units</span>
                        </div>
                        <div className="p-1 rounded bg-neutral-950 border border-neutral-800">
                          <span className="text-emerald-400 font-bold block">Bar</span>
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

export default Grimoire;
