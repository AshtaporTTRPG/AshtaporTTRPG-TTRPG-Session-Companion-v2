import {
  DiceRollResult,
  DieType,
  RollTypeCategory,
  RollVisibility,
  RollDisplayMode,
  DieGroupRoll,
  PairedD20Roll,
} from '../types/ttrpg';
import { playCritSound, playDiceRollSound, playFumbleSound } from './audio';

export const DIE_SIDES: Record<DieType, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
};

export function rollSingleDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export interface DicePoolEntry {
  diceType: DieType;
  count: number;
}

export interface ExecuteRollOptions {
  diceType?: DieType;
  count?: number;
  pool?: DicePoolEntry[];
  modifier?: number;
  advantageMode?: 'normal' | 'advantage' | 'disadvantage';
  displayMode?: RollDisplayMode;
  sender?: string;
  isDm?: boolean;
  isSecret?: boolean;
  visibility?: RollVisibility;
  rollType?: RollTypeCategory;
  label?: string;
}

export function executeDiceRoll({
  diceType,
  count = 1,
  pool,
  modifier = 0,
  advantageMode = 'normal',
  displayMode = 'sum',
  sender,
  isDm = false,
  isSecret = false,
  visibility = 'public',
  rollType = 'Straight roll',
  label = '',
}: ExecuteRollOptions): DiceRollResult {
  const resolvedSender =
    sender && sender.trim()
      ? sender.trim()
      : typeof window !== 'undefined' && localStorage.getItem('ttrpg_player_name')?.trim()
      ? localStorage.getItem('ttrpg_player_name')!.trim()
      : isDm
      ? 'Dungeon Master'
      : 'Adventurer';
  // Normalize pool: either use provided pool or single die configuration
  const poolEntries: DicePoolEntry[] = [];
  if (pool && pool.length > 0) {
    pool.forEach((p) => {
      if (p.count > 0) {
        poolEntries.push({ diceType: p.diceType, count: p.count });
      }
    });
  } else if (diceType) {
    poolEntries.push({ diceType, count: Math.max(1, count) });
  } else {
    poolEntries.push({ diceType: 'd20', count: 1 });
  }

  // Fallback if empty pool was given
  if (poolEntries.length === 0) {
    poolEntries.push({ diceType: 'd20', count: 1 });
  }

  const poolBreakdown: DieGroupRoll[] = [];
  const allResolvedRolls: number[] = [];
  const allRawRolls: number[] = [];
  const allPairedRolls: PairedD20Roll[] = [];
  const allIndividualLineItems: string[] = [];
  let sumTotal = 0;
  let hasCrit = false;
  let hasFumble = false;

  const primaryDieType = poolEntries[0]?.diceType || 'd20';
  let totalDiceCount = 0;
  const isMixedPool = poolEntries.length > 1;

  poolEntries.forEach((entry) => {
    const sides = DIE_SIDES[entry.diceType] || 20;
    const groupRolls: number[] = [];
    const groupRawRolls: number[] = [];
    const groupPairedRolls: PairedD20Roll[] = [];
    totalDiceCount += entry.count;

    if (entry.diceType === 'd20' && (advantageMode === 'advantage' || advantageMode === 'disadvantage')) {
      // MULTI-PAIR GENERATION (Advantage / Disadvantage):
      const numPairs = entry.count;
      for (let k = 0; k < numPairs; k++) {
        const valA = rollSingleDie(20);
        const valB = rollSingleDie(20);
        const selected = advantageMode === 'advantage' ? Math.max(valA, valB) : Math.min(valA, valB);
        const discarded = advantageMode === 'advantage' ? Math.min(valA, valB) : Math.max(valA, valB);
        const evaluatedTotal = selected + modifier;

        const modStr = modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : '';
        const lineItem = `Roll ${k + 1}: [${selected}, ~~${discarded}~~]${modStr} = ${evaluatedTotal}`;

        const pair: PairedD20Roll = {
          pairIndex: k + 1,
          die1: valA,
          die2: valB,
          selected,
          discarded,
          modifier,
          totalWithModifier: evaluatedTotal,
          lineItem,
        };

        groupPairedRolls.push(pair);
        allPairedRolls.push(pair);
        groupRolls.push(selected);
        groupRawRolls.push(valA, valB);
        allIndividualLineItems.push(lineItem);

        if (selected === 20) hasCrit = true;
        if (selected === 1) hasFumble = true;
      }

      const groupSum = groupRolls.reduce((acc, curr) => acc + curr, 0);
      sumTotal += groupSum;
    } else if (isMixedPool || displayMode === 'sum') {
      // Mixed pool or Sum mode:
      // Roll independent dice for this entry.
      // Modifier is NOT added to individual line items; it is added ONCE to final sum.
      for (let i = 0; i < entry.count; i++) {
        const val = rollSingleDie(sides);
        groupRolls.push(val);
        groupRawRolls.push(val);

        if (entry.diceType === 'd20') {
          if (val === 20) hasCrit = true;
          if (val === 1 && !hasCrit) hasFumble = true;
        }
      }
      const groupSum = groupRolls.reduce((acc, curr) => acc + curr, 0);
      sumTotal += groupSum;

      // Format as exact die rolled, e.g. "1d8: [5]" or "2d6: [4, 2]"
      const dieLabel = `${entry.count}${entry.diceType}`;
      allIndividualLineItems.push(`${dieLabel}: [${groupRolls.join(', ')}]`);
    } else {
      // Dedicated individual straight roll (Multi-D20 individual attacks):
      for (let i = 0; i < entry.count; i++) {
        const val = rollSingleDie(sides);
        const evaluatedTotal = val + modifier;
        const modStr = modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : '';
        const lineItem = `Roll ${i + 1}: [${val}]${modStr} = ${evaluatedTotal}`;

        groupRolls.push(val);
        groupRawRolls.push(val);
        allIndividualLineItems.push(lineItem);

        if (entry.diceType === 'd20') {
          if (val === 20) hasCrit = true;
          if (val === 1 && !hasCrit) hasFumble = true;
        }
      }
      const groupSum = groupRolls.reduce((acc, curr) => acc + curr, 0);
      sumTotal += groupSum;
    }

    poolBreakdown.push({
      dieType: entry.diceType,
      rolls: groupRolls,
      pairedRolls: groupPairedRolls.length > 0 ? groupPairedRolls : undefined,
      rawRolls: groupRawRolls,
    });
    allResolvedRolls.push(...groupRolls);
    allRawRolls.push(...groupRawRolls);
  });

  const total = sumTotal + modifier;

  // Append Modifier and Total once for mixed pools or multi-dice sum pools
  if (isMixedPool || (poolEntries.length >= 1 && displayMode === 'sum' && advantageMode === 'normal')) {
    if (modifier !== 0) {
      allIndividualLineItems.push(`Modifier: ${modifier > 0 ? `+${modifier}` : modifier}`);
    }
    allIndividualLineItems.push(`Total: ${total}`);
  }

  // Build formula string, e.g. "5d20 (advantage) + 4"
  const formulaParts = poolEntries.map((e) => {
    if (e.diceType === 'd20' && advantageMode !== 'normal') {
      return `${e.count}d20 (${advantageMode})`;
    }
    return `${e.count}${e.diceType}`;
  });
  let formula = formulaParts.join(' + ');
  if (modifier !== 0) {
    formula += modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
  }

  // Build individual summary string with paired breakdown when Advantage/Disadvantage is active
  const individualSummary = allIndividualLineItems.join(' | ');

  // Audio feedback
  if (hasCrit) {
    playCritSound();
  } else if (hasFumble) {
    playFumbleSound();
  } else {
    playDiceRollSound();
  }

  const isActuallySecret = visibility === 'dm' || isSecret;

  return {
    id: `roll-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    sender: resolvedSender,
    isDm,
    isSecret: isActuallySecret,
    visibility,
    rollType,
    diceType: primaryDieType,
    count: totalDiceCount,
    modifier,
    rolls: allResolvedRolls,
    rawRolls: allRawRolls,
    pairedRolls: allPairedRolls.length > 0 ? allPairedRolls : undefined,
    total,
    advantageMode,
    label: label.trim() || undefined,
    isCrit: hasCrit,
    isFumble: hasFumble && !hasCrit,
    displayMode,
    poolBreakdown,
    formula,
    individualSummary,
    individualLineItems: allIndividualLineItems,
  };
}

export function parseDiceFormula(formula: string): {
  count: number;
  diceType: DieType;
  modifier: number;
  pool?: DicePoolEntry[];
} | null {
  const cleaned = formula.replace(/\s+/g, '').toLowerCase();

  // Single die formula, e.g. 2d6+3 or 1d20
  const singleMatch = cleaned.match(/^(\d*)d(4|6|8|10|12|20|100)([+-]\d+)?$/);
  if (singleMatch) {
    const count = singleMatch[1] ? parseInt(singleMatch[1], 10) : 1;
    const diceType = (`d${singleMatch[2]}`) as DieType;
    const modifier = singleMatch[3] ? parseInt(singleMatch[3], 10) : 0;
    return { count, diceType, modifier, pool: [{ diceType, count }] };
  }

  // Mixed dice pool formula, e.g. 2d20+1d8+2d6+4 or 1d20+2d6-2
  const poolRegex = /(\d*)d(4|6|8|10|12|20|100)/g;
  let match: RegExpExecArray | null;
  const pool: DicePoolEntry[] = [];
  let totalCount = 0;
  let primaryDie: DieType = 'd20';

  while ((match = poolRegex.exec(cleaned)) !== null) {
    const count = match[1] ? parseInt(match[1], 10) : 1;
    const diceType = (`d${match[2]}`) as DieType;
    if (pool.length === 0) primaryDie = diceType;
    const existing = pool.find((p) => p.diceType === diceType);
    if (existing) {
      existing.count += count;
    } else {
      pool.push({ diceType, count });
    }
    totalCount += count;
  }

  if (pool.length === 0) return null;

  // Extract trailing modifier if present (e.g. +4 or -2)
  const remainder = cleaned.replace(/(\d*)d(4|6|8|10|12|20|100)/g, '');
  let modifier = 0;
  if (remainder) {
    const modMatches = remainder.match(/[+-]?\d+/g);
    if (modMatches) {
      modifier = modMatches.reduce((acc, curr) => acc + parseInt(curr, 10), 0);
    }
  }

  return {
    count: totalCount,
    diceType: primaryDie,
    modifier,
    pool,
  };
}

export function addDieToFormula(currentFormula: string, die: DieType): string {
  const cleaned = currentFormula.trim();
  if (!cleaned) {
    return `1${die}`;
  }

  const parsed = parseDiceFormula(cleaned);
  if (!parsed || !parsed.pool || parsed.pool.length === 0) {
    return `1${die}`;
  }

  const pool = parsed.pool.map((p) => ({ ...p }));
  const existing = pool.find((p) => p.diceType === die);
  if (existing) {
    existing.count += 1;
  } else {
    pool.push({ diceType: die, count: 1 });
  }

  const formulaParts = pool.map((p) => `${p.count}${p.diceType}`);
  let result = formulaParts.join(' + ');
  if (parsed.modifier !== 0) {
    result += parsed.modifier > 0 ? ` + ${parsed.modifier}` : ` - ${Math.abs(parsed.modifier)}`;
  }
  return result;
}

export function setFormulaModifier(currentFormula: string, newMod: number): string {
  const cleaned = currentFormula.trim();
  const parsed = parseDiceFormula(cleaned);
  if (!parsed || !parsed.pool || parsed.pool.length === 0) {
    return newMod !== 0 ? (newMod > 0 ? `+${newMod}` : `${newMod}`) : '';
  }
  const formulaParts = parsed.pool.map((p) => `${p.count}${p.diceType}`);
  let result = formulaParts.join(' + ');
  if (newMod !== 0) {
    result += newMod > 0 ? ` + ${newMod}` : ` - ${Math.abs(newMod)}`;
  }
  return result;
}
