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
  rollerName?: string;
  rollerId?: string;
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
  rollerName,
  rollerId,
  isDm = false,
  isSecret = false,
  visibility = 'public',
  rollType = 'Straight roll',
  label = '',
}: ExecuteRollOptions): DiceRollResult {
  const resolvedSender =
    rollerName && rollerName.trim()
      ? rollerName.trim()
      : sender && sender.trim()
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

    if (displayMode === 'individual') {
      // INDIVIDUAL MODE:
      // Each die/roll is its own standalone evaluated result with its own line item.
      // Grand totals / sums are NOT aggregated or computed.
      if (entry.diceType === 'd20' && (advantageMode === 'advantage' || advantageMode === 'disadvantage')) {
        for (let k = 0; k < entry.count; k++) {
          const rollNumber = allIndividualLineItems.length + 1;
          const valA = rollSingleDie(20);
          const valB = rollSingleDie(20);
          const selected = advantageMode === 'advantage' ? Math.max(valA, valB) : Math.min(valA, valB);
          const discarded = advantageMode === 'advantage' ? Math.min(valA, valB) : Math.max(valA, valB);
          const evaluatedTotal = selected + modifier;

          const modStr = modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : '';
          const lineItem = `Roll ${rollNumber}: [${selected}, ~~${discarded}~~]${modStr} = ${evaluatedTotal}`;

          const pair: PairedD20Roll = {
            pairIndex: rollNumber,
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
      } else {
        for (let i = 0; i < entry.count; i++) {
          const rollNumber = allIndividualLineItems.length + 1;
          const val = rollSingleDie(sides);
          const evaluatedTotal = val + modifier;
          const modStr = modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : '';
          const lineItem = `Roll ${rollNumber}: [${val}]${modStr} = ${evaluatedTotal}`;

          groupRolls.push(val);
          groupRawRolls.push(val);
          allIndividualLineItems.push(lineItem);

          if (entry.diceType === 'd20') {
            if (val === 20) hasCrit = true;
            if (val === 1 && !hasCrit) hasFumble = true;
          }
        }
      }
    } else if (entry.diceType === 'd20' && (advantageMode === 'advantage' || advantageMode === 'disadvantage')) {
      // MULTI-PAIR GENERATION IN SUM MODE (Advantage / Disadvantage):
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
    } else {
      // Sum mode (standard roll or mixed pool):
      // Roll independent dice for this entry.
      // Modifier is added once to final sumTotal, not per individual die.
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

  // Grand totals / sums are only computed and displayed when "sum" mode is explicitly selected
  const total = displayMode === 'individual' ? 0 : (sumTotal + modifier);

  // Append Modifier and Total once ONLY for Sum mode
  if (displayMode === 'sum' && (isMixedPool || (poolEntries.length >= 1 && advantageMode === 'normal'))) {
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
    rollerName: resolvedSender,
    rollerId,
    isDm,
    isSecret: isActuallySecret,
    visibility,
    rollType,
    diceType: primaryDieType,
    count: totalDiceCount,
    modifier,
    rolls: allResolvedRolls,
    breakdown:
      allIndividualLineItems.length > 0
        ? allIndividualLineItems
        : allResolvedRolls.map((r) => String(r)),
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

/**
 * Combines a base macro formula (e.g. 2d6+2 or 1d20) with an active tray modifier (e.g. +3 or +4).
 * Example: 2d6+2 with active tray modifier +3 => 2d6 + 5 (modifier: 5)
 * Example: 1d20 with active tray modifier +4 => 1d20 + 4 (modifier: 4)
 * Ensures modifier is combined once cleanly for the entire roll total.
 */
export function combineFormulaWithModifier(
  formula: string,
  stagedModifier: number
): {
  formula: string;
  combinedModifier: number;
} {
  const cleaned = formula.trim();
  if (stagedModifier === 0) {
    const parsed = parseDiceFormula(cleaned);
    return {
      formula: cleaned,
      combinedModifier: parsed ? parsed.modifier : 0,
    };
  }

  const parsed = parseDiceFormula(cleaned);
  if (!parsed || !parsed.pool || parsed.pool.length === 0) {
    const combinedModifier = stagedModifier;
    const formulaStr = `${cleaned}${stagedModifier > 0 ? ` + ${stagedModifier}` : ` - ${Math.abs(stagedModifier)}`}`;
    return {
      formula: formulaStr,
      combinedModifier,
    };
  }

  const combinedModifier = parsed.modifier + stagedModifier;
  const poolParts = parsed.pool.map((p) => `${p.count}${p.diceType}`);
  let combinedFormula = poolParts.join(' + ');
  if (combinedModifier !== 0) {
    combinedFormula += combinedModifier > 0 ? ` + ${combinedModifier}` : ` - ${Math.abs(combinedModifier)}`;
  }

  return {
    formula: combinedFormula,
    combinedModifier,
  };
}
